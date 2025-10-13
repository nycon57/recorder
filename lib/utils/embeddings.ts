/**
 * Embeddings Utilities
 *
 * Helper functions for checking embeddings staleness and managing vector database accuracy
 */

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

/**
 * Generate embedding vector for text using Google's text-embedding-004 model
 *
 * @param text - Text to embed
 * @returns Array of embedding values (768 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('[generateEmbedding] Error:', error);
    throw new Error(`Failed to generate embedding: ${error}`);
  }
}

export interface EmbeddingsStatus {
  exists: boolean;
  isStale: boolean;
  needsRefresh: boolean;
  lastUpdated: Date | null;
  chunkCount: number;
  staleness: {
    documentModifiedAfterEmbeddings: boolean;
    neverGenerated: boolean;
    tooOld: boolean;
    flaggedForRefresh: boolean;
  };
}

/**
 * Check if embeddings for a recording are stale and need refresh
 *
 * @param recordingId - The recording ID to check
 * @param thresholdHours - Hours after which embeddings are considered old (default: 168 = 7 days)
 * @returns EmbeddingsStatus object with detailed staleness information
 */
export async function checkEmbeddingsStatus(
  recordingId: string,
  thresholdHours: number = 168
): Promise<EmbeddingsStatus> {
  const supabase = supabaseAdmin;

  // Get recording embeddings timestamp
  const { data: recording } = await supabase
    .from('recordings')
    .select('embeddings_updated_at')
    .eq('id', recordingId)
    .single();

  // Get document info
  const { data: document } = await supabase
    .from('documents')
    .select('updated_at, needs_embeddings_refresh')
    .eq('recording_id', recordingId)
    .single();

  // Count existing chunks
  const { count: chunkCount } = await supabase
    .from('transcript_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', recordingId);

  const embeddingsUpdated = recording?.embeddings_updated_at
    ? new Date(recording.embeddings_updated_at)
    : null;

  const documentUpdated = document?.updated_at
    ? new Date(document.updated_at)
    : null;

  // Calculate staleness factors
  const neverGenerated = embeddingsUpdated === null;
  const documentModifiedAfterEmbeddings =
    documentUpdated !== null &&
    embeddingsUpdated !== null &&
    documentUpdated > embeddingsUpdated;

  const tooOld =
    embeddingsUpdated !== null &&
    new Date().getTime() - embeddingsUpdated.getTime() >
      thresholdHours * 60 * 60 * 1000;

  const flaggedForRefresh = document?.needs_embeddings_refresh === true;

  const isStale =
    neverGenerated ||
    documentModifiedAfterEmbeddings ||
    tooOld ||
    flaggedForRefresh;

  return {
    exists: (chunkCount ?? 0) > 0,
    isStale,
    needsRefresh: isStale,
    lastUpdated: embeddingsUpdated,
    chunkCount: chunkCount ?? 0,
    staleness: {
      neverGenerated,
      documentModifiedAfterEmbeddings,
      tooOld,
      flaggedForRefresh,
    },
  };
}

/**
 * Get human-readable staleness message
 */
export function getStalenessMessage(status: EmbeddingsStatus): string {
  if (!status.isStale) {
    return 'Embeddings are up to date';
  }

  const { staleness, lastUpdated } = status;

  if (staleness.neverGenerated) {
    return 'Embeddings have not been generated yet';
  }

  if (staleness.flaggedForRefresh) {
    return 'Document was edited - embeddings need refresh';
  }

  if (staleness.documentModifiedAfterEmbeddings) {
    return 'Document was updated after embeddings were generated';
  }

  if (staleness.tooOld && lastUpdated) {
    const daysOld = Math.floor(
      (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `Embeddings are ${daysOld} days old and may be outdated`;
  }

  return 'Embeddings may be stale';
}

/**
 * Trigger embeddings refresh for a recording
 * Deletes old chunks and enqueues regeneration job
 */
export async function triggerEmbeddingsRefresh(
  recordingId: string,
  orgId: string
): Promise<{ jobId: string; message: string }> {
  const supabase = supabaseAdmin;

  // Get transcript and document IDs
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id')
    .eq('recording_id', recordingId)
    .eq('superseded', false)
    .single();

  const { data: document } = await supabase
    .from('documents')
    .select('id')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (!transcript || !document) {
    throw new Error('Recording must have transcript and document to refresh embeddings');
  }

  // Delete existing chunks
  await supabase
    .from('transcript_chunks')
    .delete()
    .eq('recording_id', recordingId);

  // Enqueue embeddings job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      type: 'generate_embeddings',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        documentId: document.id,
        orgId,
      },
      dedupe_key: `generate_embeddings:${recordingId}:${Date.now()}`,
    })
    .select('id')
    .single();

  if (jobError || !job) {
    throw new Error(`Failed to enqueue embeddings job: ${jobError?.message}`);
  }

  return {
    jobId: job.id,
    message: 'Embeddings refresh queued successfully',
  };
}

/**
 * Check staleness using Postgres function (more efficient for bulk checks)
 */
export async function checkEmbeddingsStalenessDB(
  recordingId: string,
  thresholdHours: number = 24
): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase.rpc('are_embeddings_stale', {
    p_recording_id: recordingId,
    p_threshold_hours: thresholdHours,
  });

  if (error) {
    console.error('[Embeddings] Error checking staleness:', error);
    return false;
  }

  return data === true;
}

/**
 * Get recordings with stale embeddings (for background refresh jobs)
 */
export async function getRecordingsWithStaleEmbeddings(
  orgId: string,
  limit: number = 50
): Promise<Array<{ id: string; title: string; lastUpdated: Date | null }>> {
  const supabase = supabaseAdmin;

  // Get recordings where document was updated after embeddings
  const { data: recordings } = await supabase
    .from('recordings')
    .select(
      `
      id,
      title,
      embeddings_updated_at,
      documents!inner (
        updated_at,
        needs_embeddings_refresh
      )
    `
    )
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .or(
      'embeddings_updated_at.is.null,documents.needs_embeddings_refresh.eq.true',
      { foreignTable: 'documents' }
    )
    .limit(limit);

  if (!recordings) {
    return [];
  }

  return recordings.map((r: any) => ({
    id: r.id,
    title: r.title,
    lastUpdated: r.embeddings_updated_at ? new Date(r.embeddings_updated_at) : null,
  }));
}
