/**
 * Summary Generation Handler (Google Gemini)
 *
 * Generates recording summaries and their embeddings for hierarchical search.
 * Uses Gemini 2.5 Flash for summarization and gemini-embedding-001 for embeddings.
 */

import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { generateRecordingSummary } from '@/lib/services/summarization';
import type { Database } from '@/lib/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

interface SummaryPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

/**
 * Generate summary and embedding for a recording
 */
export async function generateSummary(job: Job): Promise<void> {
  const payload = job.payload as unknown as SummaryPayload;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  console.log(`[Summary] Starting summary generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  try {
    // Check if summary already exists (prevent duplicates)
    const { data: existingSummary } = await supabase
      .from('recording_summaries')
      .select('id')
      .eq('recording_id', recordingId)
      .single();

    if (existingSummary) {
      console.log(`[Summary] Summary already exists for recording ${recordingId}, skipping`);
      return;
    }

    // Generate summary using summarization service
    console.log(`[Summary] Calling summarization service`);
    const { summaryText, wordCount, model } = await generateRecordingSummary(
      recordingId,
      orgId
    );

    console.log(`[Summary] Generated summary (${summaryText.length} chars, ${wordCount} words)`);

    // Generate 3072-dimensional embedding for the summary
    // Using higher dimensions for better summary representation
    console.log(`[Summary] Generating 3072-dim embedding for summary`);

    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    const result = await genai.models.embedContent({
      model: GOOGLE_CONFIG.EMBEDDING_MODEL,
      contents: summaryText,
      config: {
        taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
        outputDimensionality: 3072, // Higher dimension for summary embeddings
      },
    });

    const embedding = result.embeddings[0].values;

    if (!embedding || embedding.length !== 3072) {
      throw new Error(
        `Invalid embedding dimensions: expected 3072, got ${embedding?.length || 0}`
      );
    }

    console.log(`[Summary] Generated embedding (${embedding.length} dimensions)`);

    // Store summary and embedding in database
    const { data: summary, error: insertError } = await supabase
      .from('recording_summaries')
      .insert({
        recording_id: recordingId,
        org_id: orgId,
        summary_text: summaryText,
        summary_embedding: JSON.stringify(embedding), // Supabase expects string for vector type
        model,
        metadata: {
          wordCount,
          transcriptId,
          documentId,
          generatedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save summary: ${insertError.message}`);
    }

    console.log(
      `[Summary] Successfully saved summary ${summary.id} for recording ${recordingId}`
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'summary.generated',
      payload: {
        recordingId,
        summaryId: summary.id,
        orgId,
        wordCount,
      },
    });

    console.log(`[Summary] Summary generation complete for recording ${recordingId}`);
  } catch (error) {
    console.error(`[Summary] Error generating summary:`, error);

    // Note: We don't update recording status here since it's already 'completed'
    // from earlier steps. Summary generation is an enhancement, not critical path.

    throw error;
  }
}

/**
 * Utility: Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
