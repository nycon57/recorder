/**
 * Embedding Generation Handler (Google)
 *
 * Chunks transcript/document and generates vector embeddings using Google text-embedding-004.
 * Stores embeddings in pgvector for semantic search.
 */

import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { chunkTranscriptWithSegments, chunkMarkdown, chunkVideoTranscript, type VideoTranscriptChunk } from '@/lib/services/chunking';

type Job = Database['public']['Tables']['jobs']['Row'];

interface EmbeddingsPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

const BATCH_SIZE = 20; // Process embeddings in batches

/**
 * Generate embeddings for transcript and document using Google
 */
export async function generateEmbeddings(job: Job): Promise<void> {
  const payload = job.payload as unknown as EmbeddingsPayload;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  console.log(`[Embeddings] Starting embedding generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  try {
    // Fetch transcript with visual events
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('text, words_json, visual_events, video_metadata, provider')
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

    // Check if this is a video transcript with visual context
    const visualEvents = (transcript.visual_events || []) as any[];
    const hasVisualContext = visualEvents.length > 0;
    const isGeminiVideo = transcript.provider === 'gemini-video';

    console.log(`[Embeddings] Transcript type: ${isGeminiVideo ? 'Gemini Video' : 'Audio-only'}, Visual events: ${visualEvents.length}`);

    // Chunk transcript based on type
    let transcriptChunks: VideoTranscriptChunk[] | Array<any>;

    if (hasVisualContext && isGeminiVideo) {
      // Use enhanced video chunking with visual context
      transcriptChunks = chunkVideoTranscript(
        transcript.text,
        segments,
        visualEvents,
        { maxTokens: 500, overlapTokens: 50 }
      );
      console.log(`[Embeddings] Created ${transcriptChunks.length} video transcript chunks (with visual context)`);
    } else {
      // Use standard chunking for audio-only transcripts
      transcriptChunks = chunkTranscriptWithSegments(
        transcript.text,
        segments,
        { maxTokens: 500, overlapTokens: 50 }
      );
      console.log(`[Embeddings] Created ${transcriptChunks.length} audio transcript chunks`);
    }

    // Chunk document (always markdown format)
    const documentChunks = chunkMarkdown(document.markdown, { maxTokens: 500, overlapTokens: 50 });

    console.log(`[Embeddings] Created ${documentChunks.length} document chunks`);

    // Combine all chunks with enhanced metadata
    const allChunks = [
      ...transcriptChunks.map(chunk => {
        const baseMetadata = {
          chunkIndex: chunk.index,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        };

        // Add visual context metadata if available
        const isVideoChunk = 'contentType' in chunk;
        if (isVideoChunk) {
          const videoChunk = chunk as VideoTranscriptChunk;
          return {
            text: videoChunk.text,
            source: 'transcript' as const,
            contentType: videoChunk.contentType,
            metadata: {
              ...baseMetadata,
              hasVisualContext: videoChunk.hasVisualContext,
              visualDescription: videoChunk.visualDescription,
              timestampRange: videoChunk.timestampRange,
              contentType: videoChunk.contentType,
            },
          };
        }

        return {
          text: chunk.text,
          source: 'transcript' as const,
          contentType: 'audio' as const,
          metadata: {
            ...baseMetadata,
            hasVisualContext: false,
            contentType: 'audio' as const,
          },
        };
      }),
      ...documentChunks.map(chunk => ({
        text: chunk.text,
        source: 'document' as const,
        contentType: 'document' as const,
        metadata: {
          chunkIndex: chunk.index,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          hasVisualContext: false,
          contentType: 'document' as const,
        },
      })),
    ];

    console.log(`[Embeddings] Total chunks to embed: ${allChunks.length}`);

    // Generate embeddings in batches
    const embeddingRecords = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);

      console.log(
        `[Embeddings] Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}`
      );

      // Process each chunk in the batch
      for (const chunk of batch) {
        // Initialize new Google GenAI client (supports outputDimensionality)
        const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

        // Call embedContent with proper dimension specification
        const result = await genai.models.embedContent({
          model: GOOGLE_CONFIG.EMBEDDING_MODEL,
          contents: chunk.text,
          config: {
            taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
            outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS, // Match database vector dimension (1536)
          },
        });

        const embedding = result.embeddings[0].values;

        embeddingRecords.push({
          recording_id: recordingId,
          org_id: orgId,
          chunk_text: chunk.text,
          chunk_index: chunk.metadata.chunkIndex,
          start_time_sec: chunk.metadata.startTime || null,
          end_time_sec: chunk.metadata.endTime || null,
          embedding: JSON.stringify(embedding), // Supabase expects string for vector type
          content_type: chunk.contentType || 'audio',
          metadata: {
            source: chunk.source,
            source_type: chunk.source, // For compatibility
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
