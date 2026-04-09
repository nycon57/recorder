/**
 * Embedding Generation Handler
 *
 * Chunks transcript/document and generates vector embeddings using OpenAI text-embedding-3-small.
 * Stores embeddings in pgvector for semantic search.
 */

import { openai } from '@/lib/openai/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { chunkTranscriptWithSegments, chunkMarkdown } from '@/lib/services/chunking';

type Job = Database['public']['Tables']['jobs']['Row'];

interface EmbeddingsPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20; // Process embeddings in batches to avoid rate limits

/**
 * Generate embeddings for transcript and document
 */
export async function generateEmbeddings(job: Job): Promise<void> {
  const payload = job.payload as unknown as EmbeddingsPayload;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  console.log(`[Embeddings] Starting embedding generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  try {
    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('text, words_json')
      .eq('id', transcriptId)
      .single();

    if (transcriptError || !transcript) {
      throw new Error(`Failed to fetch transcript: ${transcriptError?.message || 'Not found'}`);
    }

    // Fetch document
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('markdown')
      .eq('id', documentId)
      .single();

    if (documentError || !document) {
      throw new Error(`Failed to fetch document: ${documentError?.message || 'Not found'}`);
    }

    console.log(`[Embeddings] Loaded transcript and document`);

    // Extract segments from words_json
    const wordsData = (transcript.words_json || {}) as Record<string, any>;
    const segments = (wordsData.segments || []) as Array<{ start: number; end: number; text: string }>;

    // Chunk transcript with timing information
    const transcriptChunks = chunkTranscriptWithSegments(
      transcript.text,
      segments,
      { maxTokens: 500, overlapTokens: 50 }
    );

    console.log(`[Embeddings] Created ${transcriptChunks.length} transcript chunks`);

    // Chunk document (always markdown format)
    const documentChunks = chunkMarkdown(document.markdown, { maxTokens: 500, overlapTokens: 50 });

    console.log(`[Embeddings] Created ${documentChunks.length} document chunks`);

    // Combine all chunks
    const allChunks = [
      ...transcriptChunks.map(chunk => ({
        text: chunk.text,
        source: 'transcript' as const,
        metadata: {
          chunkIndex: chunk.index,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        },
      })),
      ...documentChunks.map(chunk => ({
        text: chunk.text,
        source: 'document' as const,
        metadata: {
          chunkIndex: chunk.index,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
        },
      })),
    ];

    console.log(`[Embeddings] Total chunks to embed: ${allChunks.length}`);

    // Generate embeddings in batches
    const embeddingRecords = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(c => c.text);

      console.log(
        `[Embeddings] Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}`
      );

      // Call OpenAI embeddings API
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batchTexts,
      });

      // Create database records
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = response.data[j].embedding;

        embeddingRecords.push({
          content_id: recordingId,
          org_id: orgId,
          chunk_text: chunk.text,
          embedding: JSON.stringify(embedding), // Supabase expects string for vector type
          metadata: {
            source: chunk.source,
            transcriptId: chunk.source === 'transcript' ? transcriptId : undefined,
            documentId: chunk.source === 'document' ? documentId : undefined,
            ...chunk.metadata,
          },
        });
      }

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < allChunks.length) {
        await sleep(100);
      }
    }

    console.log(`[Embeddings] Generated ${embeddingRecords.length} embeddings, saving to database`);

    // Save all embeddings to database
    const { error: insertError } = await supabase
      .from('transcript_chunks')
      .insert(embeddingRecords);

    if (insertError) {
      throw new Error(`Failed to save embeddings: ${insertError.message}`);
    }

    console.log(`[Embeddings] Successfully saved ${embeddingRecords.length} embeddings for recording ${recordingId}`);

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'embeddings.generated',
      payload: {
        recordingId,
        transcriptId,
        documentId,
        orgId,
        chunkCount: embeddingRecords.length,
      },
    });

  } catch (error) {
    console.error(`[Embeddings] Error:`, error);

    // Note: We don't update recording status here since it's already 'completed'
    // from the document generation step. Embedding failures are non-critical.

    throw error;
  }
}

/**
 * Utility: Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
