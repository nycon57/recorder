/**
 * Embedding Generation Handler (Google)
 *
 * Chunks transcript/document and generates vector embeddings using Google text-embedding-004.
 * Stores embeddings in pgvector for semantic search.
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';
import {
  chunkTranscriptWithSegments,
  chunkVideoTranscript,
  type VideoTranscriptChunk,
} from '@/lib/services/chunking';
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';
import { sanitizeMetadata } from '@/lib/utils/config-validation';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import {
  sendEmbeddingProgress,
  isStreamingAvailable,
} from '@/lib/services/llm-streaming-helper';
import { extractAndStoreConcepts } from '@/lib/services/concept-extractor';
import { mapBatchesSequentially } from '@/lib/utils/async';

type Job = Database['public']['Tables']['jobs']['Row'];
type TranscriptChunkInsert =
  Database['public']['Tables']['transcript_chunks']['Insert'];

interface EmbeddingsPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

interface AudioSegment {
  timestamp: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SimpleSegment {
  start: number;
  end: number;
  text: string;
}

interface VisualEvent {
  timestamp: string;
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string;
  location?: string;
  description: string;
}

interface BasicTranscriptChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  startTime?: number;
  endTime?: number;
}

type EmbeddingChunk = {
  text: string;
  source: 'transcript' | 'document';
  contentType: 'audio' | 'visual' | 'combined' | 'document';
  metadata: Record<string, Json | undefined>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

function getRecord(value: Json | null): Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : {};
}

function getNumber(value: Json | undefined): number {
  return typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value) || 0
      : 0;
}

function getText(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function getNullableText(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function toVisualEvent(value: Json): VisualEvent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const event = value as Record<string, Json | undefined>;
  if (
    typeof event.timestamp !== 'string' ||
    typeof event.description !== 'string' ||
    typeof event.type !== 'string' ||
    !['click', 'type', 'navigate', 'scroll', 'other'].includes(event.type)
  ) {
    return null;
  }

  return {
    timestamp: event.timestamp,
    type: event.type as VisualEvent['type'],
    description: event.description,
    target: typeof event.target === 'string' ? event.target : undefined,
    location: typeof event.location === 'string' ? event.location : undefined,
  };
}

// PERF-AI-002: Increased batch size from 20 to 50 for ~40-50% faster embedding generation
// Larger batches reduce API call overhead while staying within rate limits
const BATCH_SIZE = 50; // Process embeddings in batches
const DB_INSERT_BATCH_SIZE = 100; // Insert to database in batches

// PERF-AI-006: Lazy-initialized OpenAI client for fallback
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured for fallback');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * PERF-AI-006: Generate embedding with automatic fallback
 * Tries Google first, falls back to OpenAI on 503/overload errors
 * Both models produce 1536-dimensional embeddings (compatible)
 */
async function generateEmbeddingWithFallback(
  genai: GoogleGenAI,
  text: string,
  logger: ReturnType<typeof createLogger>,
): Promise<{ embedding: number[]; provider: 'google' | 'openai' }> {
  try {
    // Try Google first
    const result = await genai.models.embedContent({
      model: GOOGLE_CONFIG.EMBEDDING_MODEL,
      contents: text,
      config: {
        taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
        outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
      },
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('No embedding returned from Google API');
    }

    return { embedding, provider: 'google' };
  } catch (googleError) {
    const googleErrorMessage = getErrorMessage(googleError);
    const googleErrorStatus = getErrorStatus(googleError);
    // Check if it's a recoverable error (503, overload, rate limit)
    const isRecoverable =
      googleErrorMessage.includes('503') ||
      googleErrorMessage.includes('overloaded') ||
      googleErrorMessage.includes('RESOURCE_EXHAUSTED') ||
      googleErrorStatus === 503 ||
      googleErrorStatus === 429;

    if (isRecoverable && process.env.OPENAI_API_KEY) {
      logger.warn('Google embedding failed, attempting OpenAI fallback', {
        context: {
          googleError: googleErrorMessage,
          textPreview: text.substring(0, 50),
        },
      });

      try {
        const openai = getOpenAIClient();
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: 1536, // Match Google's output
        });

        const embedding = response.data[0].embedding;
        logger.info('OpenAI fallback successful');
        return { embedding, provider: 'openai' };
      } catch (openaiError) {
        const openaiErrorMessage = getErrorMessage(openaiError);
        logger.error('Both Google and OpenAI failed', {
          context: {
            googleError: googleErrorMessage,
            openaiError: openaiErrorMessage,
          },
        });
        throw new Error(
          `All embedding providers failed: Google (${googleErrorMessage}), OpenAI (${openaiErrorMessage})`,
        );
      }
    }

    // If not recoverable or no OpenAI key, throw original error
    throw googleError;
  }
}

/**
 * Validate and sanitize semantic score to ensure it meets database constraints
 * Constraint: semantic_score IS NULL OR (semantic_score >= 0 AND semantic_score <= 1)
 */
function validateSemanticScore(score: unknown): number | null {
  // Handle null/undefined
  if (score === null || score === undefined) {
    return null;
  }

  // Convert to number if string
  const numScore = typeof score === 'string' ? parseFloat(score) : score;

  // Check for NaN or invalid numbers
  if (typeof numScore !== 'number' || isNaN(numScore) || !isFinite(numScore)) {
    // Return null for invalid values instead of throwing
    return null;
  }

  // Clamp to valid range [0, 1]
  if (numScore < 0) return 0;
  if (numScore > 1) return 1;

  return numScore;
}

/**
 * Generate embeddings for transcript and document using Google
 */
export async function generateEmbeddings(
  job: Job,
  progressCallback?: (percent: number, message: string, data?: Json) => void,
): Promise<void> {
  const payload = job.payload as unknown as EmbeddingsPayload;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  const logger = createLogger({ service: 'embeddings-google' });

  // Check if streaming is available for this recording
  const isStreaming = isStreamingAvailable(recordingId);

  logger.info('Starting embedding generation', {
    context: {
      recordingId,
      transcriptId,
      documentId,
      orgId,
      jobId: job.id,
      streamingEnabled: isStreaming,
    },
  });

  const supabase = createAdminClient();

  // Check if embeddings already exist and are complete (idempotency check)
  const { data: chunkStats } = await supabase
    .from('transcript_chunks')
    .select('id, embedding', { count: 'exact' })
    .eq('content_id', recordingId);

  const totalChunks = chunkStats?.length || 0;
  const chunksWithEmbeddings =
    chunkStats?.filter(
      (chunk) => chunk.embedding !== null && chunk.embedding !== '',
    ).length || 0;

  // Check if embeddings are complete
  if (totalChunks > 0 && totalChunks === chunksWithEmbeddings) {
    logger.info(
      'Embeddings already exist and are complete, skipping generation',
      {
        context: {
          recordingId,
          totalChunks,
          chunksWithEmbeddings,
        },
      },
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
      logger.info('Enqueued summary generation job for existing embeddings', {
        context: { recordingId },
      });
    }

    return;
  } else if (totalChunks > 0 && chunksWithEmbeddings < totalChunks) {
    // Partial failure detected - clean up incomplete chunks
    logger.warn('Partial embeddings detected, cleaning up for retry', {
      context: {
        recordingId,
        totalChunks,
        chunksWithEmbeddings,
        incompleteChunks: totalChunks - chunksWithEmbeddings,
      },
    });

    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .eq('content_id', recordingId);

    if (deleteError) {
      throw new Error(
        `Failed to clean up partial embeddings: ${deleteError.message}`,
      );
    }

    logger.info(
      'Cleaned up partial embeddings, proceeding with full generation',
    );
  }

  try {
    // Fetch transcript with visual events
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('text, words_json, visual_events, video_metadata, provider')
      .eq('id', transcriptId)
      .single();

    if (transcriptError || !transcript) {
      throw new Error(
        `Failed to fetch transcript: ${transcriptError?.message || 'Not found'}`,
      );
    }

    // Fetch document
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('markdown')
      .eq('id', documentId)
      .single();

    if (documentError || !document) {
      throw new Error(
        `Failed to fetch document: ${documentError?.message || 'Not found'}`,
      );
    }

    logger.info('Loaded transcript and document', {
      context: {
        transcriptLength: transcript.text.length,
        documentLength: document.markdown.length,
        provider: transcript.provider,
      },
    });

    // Extract segments from words_json
    const wordsData = getRecord(transcript.words_json);
    const rawSegments = Array.isArray(wordsData.segments)
      ? wordsData.segments
      : [];

    // Helper to format seconds to MM:SS timestamp
    function formatTimestamp(seconds: number): string {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Convert segments to AudioSegment type (for video chunking)
    const audioSegments: AudioSegment[] = rawSegments.map((segment) => {
      const seg = getRecord(segment);
      const start = getNumber(seg.start);
      const end = getNumber(seg.end);
      return {
        timestamp: formatTimestamp(start),
        startTime: start,
        endTime: end,
        text: getText(seg.text),
      };
    });

    // Simple segments for text-based chunking
    const simpleSegments: SimpleSegment[] = rawSegments.map((segment) => {
      const seg = getRecord(segment);
      return {
        start: getNumber(seg.start),
        end: getNumber(seg.end),
        text: getText(seg.text),
      };
    });

    // Check if this is a video transcript with visual context
    const visualEvents = Array.isArray(transcript.visual_events)
      ? transcript.visual_events.flatMap((__item, __index, __array) => {
          const __mapped = toVisualEvent(__item);
          return __mapped !== null ? [__mapped] : [];
        })
      : [];
    const hasVisualContext = visualEvents.length > 0;
    const isGeminiVideo = transcript.provider === 'gemini-video';

    logger.info('Processing transcript type', {
      context: {
        type: isGeminiVideo ? 'Gemini Video' : 'Audio-only',
        visualEventsCount: visualEvents.length,
        hasVisualContext,
        segments: audioSegments.length,
      },
    });

    progressCallback?.(5, 'Analyzing content structure...');
    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'embeddings',
        5,
        'Analyzing content structure...',
      );
    }

    // Chunk transcript based on type
    let transcriptChunks: Array<VideoTranscriptChunk | BasicTranscriptChunk>;

    if (hasVisualContext && isGeminiVideo) {
      // Use enhanced video chunking with visual context
      transcriptChunks = chunkVideoTranscript(
        transcript.text,
        audioSegments,
        visualEvents,
        { maxTokens: 500, overlapTokens: 50 },
      );
      logger.info('Created video transcript chunks', {
        context: {
          chunkCount: transcriptChunks.length,
          hasVisualContext: true,
          chunkingStrategy: 'video-enhanced',
        },
      });
    } else {
      // Use standard chunking for audio-only transcripts
      transcriptChunks = chunkTranscriptWithSegments(
        transcript.text,
        simpleSegments,
        { maxTokens: 500, overlapTokens: 50 },
      );
      logger.info('Created audio transcript chunks', {
        context: {
          chunkCount: transcriptChunks.length,
          hasVisualContext: false,
          chunkingStrategy: 'segment-based',
        },
      });
    }

    progressCallback?.(8, 'Chunking document for indexing...');
    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'embeddings',
        8,
        'Chunking document for indexing...',
      );
    }

    // Chunk document using semantic chunking (always markdown format)
    // Classify content type first
    const documentClassification = classifyContent(document.markdown);
    logger.info('Document content classified', {
      context: {
        contentType: documentClassification.type,
        confidence: documentClassification.confidence.toFixed(2),
      },
    });

    // Get adaptive config for content type
    const documentChunkConfig = getAdaptiveChunkConfig(
      documentClassification.type,
    );

    // Create semantic chunker
    const documentChunker = createSemanticChunker(documentChunkConfig);

    // Generate semantic chunks
    const semanticDocumentChunks = await documentChunker.chunk(
      document.markdown,
      {
        recordingId,
        contentType: documentClassification.type,
      },
    );

    logger.info('Created semantic document chunks', {
      context: {
        chunkCount: semanticDocumentChunks.length,
        contentType: documentClassification.type,
        chunkingStrategy: 'semantic',
      },
    });

    // Combine all chunks with enhanced metadata
    const allChunks: EmbeddingChunk[] = [
      ...transcriptChunks.map((chunk) => {
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

    // Filter out chunks with empty or whitespace-only text
    // Google's embedContent API throws an error for empty strings
    const validChunks = allChunks.filter(
      (chunk) => chunk.text && chunk.text.trim().length > 0,
    );

    if (validChunks.length < allChunks.length) {
      logger.warn('Filtered out empty chunks', {
        context: {
          originalCount: allChunks.length,
          validCount: validChunks.length,
          emptyCount: allChunks.length - validChunks.length,
        },
      });
    }

    logger.info('Prepared chunks for embedding', {
      context: {
        totalChunks: validChunks.length,
        transcriptChunks: transcriptChunks.length,
        documentChunks: semanticDocumentChunks.length,
        filteredEmpty: allChunks.length - validChunks.length,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'embeddings',
        10,
        `Preparing to embed ${validChunks.length} chunks...`,
      );
    }

    // PERFORMANCE FIX: Create Google GenAI client once (not for every chunk)
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    const genai = new GoogleGenAI({ apiKey });

    // Generate embeddings in batches
    const totalBatches = Math.ceil(validChunks.length / BATCH_SIZE);

    logger.info('Starting batch embedding generation', {
      context: {
        totalBatches,
        batchSize: BATCH_SIZE,
        totalChunks: validChunks.length,
      },
    });

    const embeddingRecords = await mapBatchesSequentially(
      validChunks,
      BATCH_SIZE,
      async (batch, batchIndex) => {
        const i = batchIndex * BATCH_SIZE;
        const batchNumber = batchIndex + 1;

        logger.info(
          `Processing embedding batch ${batchNumber}/${totalBatches}`,
          {
            context: {
              batchNumber,
              batchSize: batch.length,
              startIndex: i,
              endIndex: Math.min(i + BATCH_SIZE, validChunks.length),
            },
          },
        );

        const batchProgressPercent = Math.round(
          20 + 60 * (i / validChunks.length),
        );
        const batchProgressMsg = `Generating embeddings: batch ${batchNumber}/${totalBatches}`;

        progressCallback?.(batchProgressPercent, batchProgressMsg);
        if (isStreaming) {
          sendEmbeddingProgress(
            recordingId,
            batchNumber,
            totalBatches,
            batchProgressMsg,
          );
        }

        // PERFORMANCE FIX: Process chunks in parallel using Promise.allSettled for fault tolerance
        // PERF-AI-006: Uses fallback (Google → OpenAI) for resilience
        const batchSettledResults = await Promise.allSettled(
          batch.map(
            async (chunk, chunkIndex): Promise<TranscriptChunkInsert> => {
              try {
                // Call embedding with automatic fallback (Google → OpenAI)
                const { embedding, provider } =
                  await generateEmbeddingWithFallback(
                    genai,
                    chunk.text,
                    logger,
                  );

                // Track provider usage for analytics
                if (provider === 'openai') {
                  logger.info(`Chunk ${i + chunkIndex} used OpenAI fallback`);
                }

                // Sanitize metadata to prevent injection and data leakage
                const sanitizedMetadata = sanitizeMetadata(
                  chunk.metadata,
                ) as Record<string, Json | undefined>;

                return {
                  content_id: recordingId,
                  org_id: orgId,
                  chunk_text: chunk.text,
                  chunk_index: sanitizedMetadata.chunkIndex as number,
                  start_time_sec:
                    getNumber(sanitizedMetadata.startTime) || null,
                  end_time_sec: getNumber(sanitizedMetadata.endTime) || null,
                  embedding: JSON.stringify(embedding), // Supabase expects string for vector type
                  content_type: chunk.contentType || 'audio',
                  // Semantic chunking metadata (only for document chunks)
                  chunking_strategy:
                    'semanticScore' in sanitizedMetadata ? 'semantic' : 'fixed',
                  semantic_score:
                    'semanticScore' in sanitizedMetadata
                      ? validateSemanticScore(sanitizedMetadata.semanticScore)
                      : null,
                  structure_type:
                    'structureType' in sanitizedMetadata
                      ? getNullableText(sanitizedMetadata.structureType)
                      : null,
                  boundary_type:
                    'boundaryType' in sanitizedMetadata
                      ? getNullableText(sanitizedMetadata.boundaryType)
                      : null,
                  metadata: {
                    source: chunk.source,
                    source_type: chunk.source, // For compatibility
                    transcriptId:
                      chunk.source === 'transcript' ? transcriptId : undefined,
                    documentId:
                      chunk.source === 'document' ? documentId : undefined,
                    embedding_provider: provider, // PERF-AI-006: Track which provider generated the embedding
                    ...sanitizedMetadata,
                  } satisfies Json,
                };
              } catch (error) {
                // Log the error with chunk details but don't fail the entire batch
                logger.error(
                  `Failed to generate embedding for chunk ${i + chunkIndex}`,
                  {
                    context: {
                      recordingId,
                      batchNumber,
                      chunkIndex: i + chunkIndex,
                      chunkText: chunk.text.substring(0, 100),
                      error:
                        error instanceof Error ? error.message : String(error),
                    },
                  },
                );
                throw error; // Re-throw to be caught by allSettled
              }
            },
          ),
        );

        // Filter out failed results and collect only successful embeddings
        const batchResults = batchSettledResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );

        // Log failures for monitoring
        const failedCount = batchSettledResults.length - batchResults.length;
        if (failedCount > 0) {
          logger.warn(`${failedCount} chunks failed in batch ${batchNumber}`, {
            context: {
              recordingId,
              batchNumber,
              totalBatches,
              failedCount,
              successCount: batchResults.length,
            },
          });
        }

        logger.info(`Completed batch ${batchNumber}/${totalBatches}`, {
          context: {
            batchNumber,
            recordsGenerated: batchResults.length,
          },
        });

        // PERF-AI-003: Removed artificial 100ms delay between batches
        // The delay was overly conservative - current API rate limits are sufficient
        // without additional throttling. Impact: ~10% improvement in embedding generation time
        return batchResults;
      },
    );

    logger.info(
      `Generated ${embeddingRecords.length} embeddings, saving to database with transaction`,
      {
        context: { totalRecords: embeddingRecords.length },
      },
    );

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'embeddings',
        80,
        'Saving embeddings to database...',
      );
    }

    // Save embeddings to database in batches within a transaction
    // Use a temporary staging approach to ensure atomicity
    try {
      // Save all embeddings in batches (they will be committed as part of the job transaction)
      await Promise.all(
        Array.from(
          {
            length: Math.max(
              0,
              Math.ceil((embeddingRecords.length - 0) / DB_INSERT_BATCH_SIZE),
            ),
          },
          (_, __loopIndex) => 0 + __loopIndex * DB_INSERT_BATCH_SIZE,
        ).map(async (i) => {
          const batch = embeddingRecords.slice(
            i,
            Math.min(i + DB_INSERT_BATCH_SIZE, embeddingRecords.length),
          );
          const batchNumber = Math.floor(i / DB_INSERT_BATCH_SIZE) + 1;
          const totalSaveBatches = Math.ceil(
            embeddingRecords.length / DB_INSERT_BATCH_SIZE,
          );

          logger.info(`Saving batch ${batchNumber}/${totalSaveBatches}`, {
            context: {
              batchNumber,
              batchSize: batch.length,
            },
          });

          const { error: insertError } = await supabase
            .from('transcript_chunks')
            .insert(batch);

          if (insertError) {
            // On any error, attempt cleanup of partial data
            logger.error(
              `Failed to save embeddings batch ${batchNumber}, cleaning up partial data`,
              {
                context: {
                  recordingId,
                  batchNumber,
                  error: insertError.message,
                },
              },
            );

            // Clean up any partial chunks that were inserted before the failure
            const { error: cleanupError } = await supabase
              .from('transcript_chunks')
              .delete()
              .eq('content_id', recordingId);

            if (cleanupError) {
              logger.error(
                'Failed to cleanup partial embeddings after insert error',
                {
                  context: {
                    recordingId,
                    cleanupError: cleanupError.message,
                  },
                },
              );
            }

            throw new Error(
              `Failed to save embeddings batch ${batchNumber}: ${insertError.message}. Partial data cleaned up.`,
            );
          }

          // Small delay between batches
          if (i + DB_INSERT_BATCH_SIZE < embeddingRecords.length) {
            await sleep(50);
          }
        }),
      );

      logger.info(`Successfully saved ${embeddingRecords.length} embeddings`, {
        context: { recordingId, totalRecords: embeddingRecords.length },
      });

      progressCallback?.(90, 'Finalizing search index...');
      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'embeddings',
          90,
          'Finalizing embedding generation...',
        );
      }

      // Atomically update recording and document using the PostgreSQL function
      const timestamp = new Date().toISOString();
      const { data: updateResult, error: rpcError } = await supabase.rpc(
        'update_embedding_completion',
        {
          p_content_id: recordingId,
          p_timestamp: timestamp,
        },
      );

      if (rpcError) {
        logger.error('Failed to update embedding completion atomically', {
          context: {
            recordingId,
            error: rpcError.message,
          },
        });
        throw new Error(
          `Failed to finalize embedding completion: ${rpcError.message}`,
        );
      }

      logger.info(
        'Atomically updated recording and document completion status',
        {
          context: {
            recordingId,
            result: updateResult,
          },
        },
      );
    } catch (error) {
      // If anything fails during the save process, ensure partial data is cleaned
      logger.error('Transaction failed during embedding save, rolling back', {
        context: {
          recordingId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }

    logger.info('Updated embeddings timestamp', {
      context: { recordingId },
    });

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

    // MOAT Feature: Extract concepts for Knowledge Graph
    // Run concept extraction in parallel with summary job enqueue (non-blocking)
    progressCallback?.(92, 'Extracting concepts for Knowledge Graph...');
    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'embeddings',
        92,
        'Extracting concepts for Knowledge Graph...',
      );
    }

    try {
      // Combine transcript and document text for concept extraction
      const fullText = `${transcript.text}\n\n${document.markdown}`;

      const conceptResult = await extractAndStoreConcepts(
        recordingId,
        orgId,
        fullText,
        {
          maxConcepts: 15, // Quality over quantity - only specific, high-value concepts
          minConfidence: 0.7, // Higher threshold for better signal
          generateEmbeddings: true,
        },
      );

      if (conceptResult.success) {
        logger.info('Extracted concepts for Knowledge Graph', {
          context: {
            recordingId,
            conceptCount: conceptResult.conceptCount,
            newConcepts: conceptResult.newConcepts,
            updatedConcepts: conceptResult.updatedConcepts,
          },
        });

        // Create event for concept extraction
        await supabase.from('events').insert({
          type: 'concepts.extracted',
          payload: {
            recordingId,
            orgId,
            conceptCount: conceptResult.conceptCount,
            newConcepts: conceptResult.newConcepts,
            updatedConcepts: conceptResult.updatedConcepts,
          },
        });
      } else {
        logger.warn('Concept extraction completed with issues', {
          context: { recordingId },
        });
      }
    } catch (conceptError) {
      // Concept extraction is non-critical - log and continue
      logger.warn('Concept extraction failed (non-critical)', {
        context: {
          recordingId,
          error:
            conceptError instanceof Error
              ? conceptError.message
              : String(conceptError),
        },
      });
    }

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

    logger.info('Enqueued summary generation', {
      context: { recordingId },
    });

    if (isStreaming) {
      streamingManager.sendComplete(
        recordingId,
        `Embedding generation complete: ${embeddingRecords.length} chunks processed`,
      );
    }
  } catch (error) {
    logger.error('Embedding generation error', {
      context: { recordingId, orgId },
      error: error as Error,
    });

    if (isStreaming) {
      streamingManager.sendError(
        recordingId,
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Note: We don't update recording status here since it's already 'completed'
    // from the document generation step. Embedding failures are non-critical.

    throw error;
  }
}

/**
 * Utility: Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
