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
import { chunkTranscriptWithSegments, chunkVideoTranscript, type VideoTranscriptChunk } from '@/lib/services/chunking';
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';
import { sanitizeMetadata } from '@/lib/utils/config-validation';

type Job = Database['public']['Tables']['jobs']['Row'];

interface EmbeddingsPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

const BATCH_SIZE = 20; // Process embeddings in batches
const DB_INSERT_BATCH_SIZE = 100; // Insert to database in batches

/**
 * Generate embeddings for transcript and document using Google
 */
export async function generateEmbeddings(job: Job): Promise<void> {
  const payload = job.payload as unknown as EmbeddingsPayload;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  console.log(`[Embeddings] Starting embedding generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  // Check if embeddings already exist (idempotency check)
  const { data: existingChunks, count } = await supabase
    .from('transcript_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('recording_id', recordingId);

  if (count && count > 0) {
    console.log(
      `[Embeddings] Embeddings already exist (${count} chunks), skipping generation`
    );

    // Enqueue summary generation job (in case pipeline was interrupted)
    const { data: existingSummaryJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('type', 'generate_summary')
      .eq('dedupe_key', `generate_summary:${recordingId}`)
      .maybeSingle();

    if (!existingSummaryJob) {
      await supabase.from('jobs').insert({
        type: 'generate_summary',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId,
          documentId,
          orgId,
        },
        dedupe_key: `generate_summary:${recordingId}`,
      });
      console.log(
        `[Embeddings] Enqueued summary generation job for existing embeddings`
      );
    }

    return;
  }

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

    // Chunk document using semantic chunking (always markdown format)
    // Classify content type first
    const documentClassification = classifyContent(document.markdown);
    console.log(`[Embeddings] Document content type: ${documentClassification.type} (confidence: ${documentClassification.confidence.toFixed(2)})`);

    // Get adaptive config for content type
    const documentChunkConfig = getAdaptiveChunkConfig(documentClassification.type);

    // Create semantic chunker
    const documentChunker = createSemanticChunker(documentChunkConfig);

    // Generate semantic chunks
    const semanticDocumentChunks = await documentChunker.chunk(document.markdown, {
      recordingId,
      contentType: documentClassification.type,
    });

    console.log(`[Embeddings] Created ${semanticDocumentChunks.length} semantic document chunks`);

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
      ...semanticDocumentChunks.map((chunk, index) => ({
        text: chunk.text,
        source: 'document' as const,
        contentType: 'document' as const,
        metadata: {
          chunkIndex: index,
          startChar: chunk.startPosition,
          endChar: chunk.endPosition,
          hasVisualContext: false,
          contentType: 'document' as const,
          // Semantic chunking metadata
          semanticScore: chunk.semanticScore,
          structureType: chunk.structureType,
          boundaryType: chunk.boundaryType,
          tokenCount: chunk.tokenCount,
          sentenceCount: chunk.sentences.length,
        },
      })),
    ];

    console.log(`[Embeddings] Total chunks to embed: ${allChunks.length}`);

    // PERFORMANCE FIX: Create Google GenAI client once (not for every chunk)
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    // Generate embeddings in batches
    const embeddingRecords = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);

      console.log(
        `[Embeddings] Generating embeddings for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / BATCH_SIZE)}`
      );

      // PERFORMANCE FIX: Process chunks in parallel using Promise.all
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          // Call embedContent with proper dimension specification
          const result = await genai.models.embedContent({
            model: GOOGLE_CONFIG.EMBEDDING_MODEL,
            contents: chunk.text,
            config: {
              taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
              outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS, // Match database vector dimension (1536)
            },
          });

          const embedding = result.embeddings?.[0]?.values;

          if (!embedding) {
            throw new Error('No embedding returned from Google API');
          }

          // Sanitize metadata to prevent injection and data leakage
          const sanitizedMetadata = sanitizeMetadata(chunk.metadata);

          return {
            recording_id: recordingId,
            org_id: orgId,
            chunk_text: chunk.text,
            chunk_index: sanitizedMetadata.chunkIndex as number,
            start_time_sec: ('startTime' in sanitizedMetadata ? sanitizedMetadata.startTime : null) || null,
            end_time_sec: ('endTime' in sanitizedMetadata ? sanitizedMetadata.endTime : null) || null,
            embedding: JSON.stringify(embedding), // Supabase expects string for vector type
            content_type: chunk.contentType || 'audio',
            // Semantic chunking metadata (only for document chunks)
            chunking_strategy: ('semanticScore' in sanitizedMetadata) ? 'semantic' : 'fixed',
            semantic_score: ('semanticScore' in sanitizedMetadata ? sanitizedMetadata.semanticScore : null) || null,
            structure_type: ('structureType' in sanitizedMetadata ? sanitizedMetadata.structureType : null) || null,
            boundary_type: ('boundaryType' in sanitizedMetadata ? sanitizedMetadata.boundaryType : null) || null,
            metadata: {
              source: chunk.source,
              source_type: chunk.source, // For compatibility
              transcriptId: chunk.source === 'transcript' ? transcriptId : undefined,
              documentId: chunk.source === 'document' ? documentId : undefined,
              ...sanitizedMetadata,
            },
          };
        })
      );

      // Add batch results to records
      embeddingRecords.push(...batchResults);

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < allChunks.length) {
        await sleep(100);
      }
    }

    console.log(`[Embeddings] Generated ${embeddingRecords.length} embeddings, saving to database in batches`);

    // Save embeddings to database in batches to prevent memory issues and timeout
    for (let i = 0; i < embeddingRecords.length; i += DB_INSERT_BATCH_SIZE) {
      const batch = embeddingRecords.slice(i, Math.min(i + DB_INSERT_BATCH_SIZE, embeddingRecords.length));

      console.log(
        `[Embeddings] Saving batch ${Math.floor(i / DB_INSERT_BATCH_SIZE) + 1}/${Math.ceil(embeddingRecords.length / DB_INSERT_BATCH_SIZE)} (${batch.length} records)`
      );

      const { error: insertError } = await supabase
        .from('transcript_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(
          `Failed to save embeddings batch ${Math.floor(i / DB_INSERT_BATCH_SIZE) + 1}: ${insertError.message}`
        );
      }

      // Small delay between batches
      if (i + DB_INSERT_BATCH_SIZE < embeddingRecords.length) {
        await sleep(50);
      }
    }

    console.log(`[Embeddings] Successfully saved ${embeddingRecords.length} embeddings for recording ${recordingId}`);

    // Update recording with embeddings timestamp and clear refresh flag
    await supabase
      .from('recordings')
      .update({
        embeddings_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    // Clear needs_embeddings_refresh flag on document
    await supabase
      .from('documents')
      .update({
        needs_embeddings_refresh: false,
        updated_at: new Date().toISOString(),
      })
      .eq('recording_id', recordingId);

    console.log(`[Embeddings] Updated embeddings timestamp for recording ${recordingId}`);

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

    // Enqueue summary generation job
    await supabase.from('jobs').insert({
      type: 'generate_summary',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId,
        documentId,
        orgId,
      },
      dedupe_key: `generate_summary:${recordingId}`,
    });

    console.log(`[Embeddings] Enqueued summary generation for recording ${recordingId}`);

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
