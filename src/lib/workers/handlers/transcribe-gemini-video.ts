/**
 * Video Transcription Handler (Gemini Video Understanding)
 *
 * Downloads recording from Supabase Storage, sends to Gemini 2.5 Flash for
 * multimodal analysis (audio + visual), and stores transcript with visual events.
 *
 * PERF-AI-006: Includes automatic fallback to OpenAI Whisper if Gemini fails.
 */

import { createReadStream, createWriteStream } from 'fs';
import { readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';

import OpenAI from 'openai';
import type { Uploadable } from 'openai/uploads';

import type { Database, Json } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  getGoogleAI,
  getFileManager,
  FileState,
  GOOGLE_CONFIG,
} from '@/lib/google/client';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import {
  streamTranscription,
  isStreamingAvailable,
  sendCompletionNotification,
  type VideoSource,
} from '@/lib/services/llm-streaming-helper';
import {
  shouldSplitVideo,
  splitVideoIntoSegments,
  getVideoDuration,
  compressVideoBeforeSplit,
  SPLIT_THRESHOLD_SECONDS,
} from '@/lib/services/video-splitter';
import {
  FILE_TYPE_TO_MIME_TYPE,
  estimateProcessingTime,
  type ContentType,
  type FileType,
} from '@/lib/types/content';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';
import {
  inferRecordingStorageBucket,
  validateDerivedAudioStoragePath,
  validateRecordingStoragePath,
  type RecordingStorageBucket,
} from '@/lib/recordings/storage-contract';

// Size threshold for using Gemini File API vs inline base64
const FILE_API_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB

const GEMINI_MEDIA_FILE_TYPES: readonly FileType[] = [
  'mp4',
  'mov',
  'webm',
  'avi',
  'mp3',
  'wav',
  'm4a',
  'ogg',
];

/**
 * Sleep helper for polling file processing status
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// PERF-AI-006: Lazy-initialized OpenAI client for fallback transcription
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
 * PERF-AI-006: Check if error is recoverable (should fall back to Whisper)
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

function isRecoverableGeminiError(error: unknown): boolean {
  const errorMessage = getErrorMessage(error);
  const status = getErrorStatus(error);
  return (
    errorMessage.includes('503') ||
    errorMessage.includes('overloaded') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('quota') ||
    status === 503 ||
    status === 429
  );
}

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribePayload {
  recordingId?: unknown;
  orgId?: unknown;
  storagePath?: unknown;
  storageBucket?: unknown;
  contentType?: unknown;
  fileType?: unknown;
}

type TranscribeRecordingRow = {
  content_type?: ContentType | null;
  file_type?: FileType | null;
};

export type ResolvedTranscribeStoragePayload = {
  recordingId: string;
  orgId: string;
  storagePath: string;
  storageBucket: RecordingStorageBucket;
  contentType: ContentType | null;
  fileType: FileType | null;
};

type TranscribeMediaMetadata = {
  fileExtension: FileType;
  mimeType: string;
  mediaKind: 'audio' | 'video';
};

function requirePayloadString(payload: TranscribePayload, key: string): string {
  const value = payload[key as keyof TranscribePayload];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid transcribe payload: ${key} is required`);
  }
  return value;
}

export function resolveTranscribeMediaMetadata(
  fileType: FileType | null,
): TranscribeMediaMetadata {
  const safeFileType =
    fileType && GEMINI_MEDIA_FILE_TYPES.includes(fileType) ? fileType : 'webm';
  const mimeType = FILE_TYPE_TO_MIME_TYPE[safeFileType] || 'video/webm';

  return {
    fileExtension: safeFileType,
    mimeType,
    mediaKind: mimeType.startsWith('audio/') ? 'audio' : 'video',
  };
}

export function buildTranscribeVideoSource({
  geminiFileUri,
  geminiMimeType,
  videoBase64,
  fallbackMimeType,
}: {
  geminiFileUri: string | null;
  geminiMimeType: string | null;
  videoBase64: string | null;
  fallbackMimeType: string;
}): VideoSource {
  return geminiFileUri
    ? {
        type: 'fileApi',
        fileUri: geminiFileUri,
        mimeType: geminiMimeType || fallbackMimeType,
      }
    : {
        type: 'inline',
        base64: videoBase64 || '',
        mimeType: fallbackMimeType,
      };
}

export function resolveTranscribeStoragePayload(
  rawPayload: unknown,
  recording: TranscribeRecordingRow | null,
): ResolvedTranscribeStoragePayload {
  const payload = (rawPayload || {}) as TranscribePayload;
  const recordingId = requirePayloadString(payload, 'recordingId');
  const orgId = requirePayloadString(payload, 'orgId');
  const storagePath = requirePayloadString(payload, 'storagePath');

  const storageBucket = inferRecordingStorageBucket({
    storagePath,
    storageBucket: payload.storageBucket,
    orgId,
    recordingId,
  });

  if (!storageBucket) {
    throw new Error('Invalid transcribe payload: unsupported storage bucket');
  }

  const recordingContentType = recording?.content_type ?? null;
  const recordingFileType = recording?.file_type ?? null;
  const payloadContentType =
    typeof payload.contentType === 'string'
      ? (payload.contentType as ContentType)
      : null;
  const payloadFileType =
    typeof payload.fileType === 'string'
      ? (payload.fileType as FileType)
      : null;
  const contentType = recordingContentType ?? payloadContentType;
  const fileType = recordingFileType ?? payloadFileType;

  const validation = validateRecordingStoragePath({
    storagePath,
    bucket: storageBucket,
    orgId,
    recordingId,
    contentType,
    fileType,
    allowLegacyRecordingsBucket: true,
  });

  if (!validation.valid) {
    const derivedAudioValidation = validateDerivedAudioStoragePath({
      storagePath,
      bucket: storageBucket,
      orgId,
      recordingId,
      sourceContentType: recordingContentType ?? contentType,
      sourceFileType: recordingFileType ?? fileType,
    });

    if (derivedAudioValidation.valid) {
      return {
        recordingId,
        orgId,
        storagePath: derivedAudioValidation.storagePath,
        storageBucket: derivedAudioValidation.bucket,
        contentType: 'audio',
        fileType: 'mp3',
      };
    }

    throw new Error(`Invalid transcribe payload: ${validation.message}`);
  }

  return {
    recordingId,
    orgId,
    storagePath: validation.storagePath,
    storageBucket: validation.bucket,
    contentType,
    fileType,
  };
}

interface VisualEvent {
  timestamp: string; // "MM:SS" format
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string; // UI element name
  location?: string; // e.g., "top right", "menu bar"
  description: string; // Full description of the visual event
  confidence?: number; // Optional confidence score
}

interface AudioSegment {
  timestamp: string; // "MM:SS" format
  startTime: number; // Seconds
  endTime: number; // Seconds
  speaker?: string; // "narrator" | "system" | etc.
  text: string;
}

interface GeminiVideoResponse {
  audioTranscript: AudioSegment[];
  visualEvents: VisualEvent[];
  combinedNarrative: string;
  duration: number; // Total duration in seconds
  keyMoments?: Array<{
    timestamp: string;
    description: string;
  }>;
}

interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface WhisperVerboseResponse {
  text?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

/**
 * PERF-AI-006: Fallback transcription using OpenAI Whisper
 * Used when Gemini is unavailable (503, rate limits, quota exhausted)
 * Note: Returns audio-only transcription (no visual events)
 */
async function transcribeWithWhisperFallback(
  tempFilePath: string,
  logger: ReturnType<typeof createLogger>,
): Promise<GeminiVideoResponse> {
  logger.info('Using Whisper fallback for transcription');

  const openai = getOpenAIClient();

  // Call Whisper API
  const transcription = (await openai.audio.transcriptions.create({
    file: createReadStream(tempFilePath) as Uploadable,
    model: 'whisper-1',
    language: 'en',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  })) as WhisperVerboseResponse;

  // Convert Whisper response to GeminiVideoResponse format
  const segments = transcription.segments ?? [];
  const audioTranscript: AudioSegment[] = segments.map((seg) => ({
    timestamp: formatTimestamp(seg.start ?? 0),
    startTime: seg.start ?? 0,
    endTime: seg.end ?? seg.start ?? 0,
    speaker: 'narrator',
    text: (seg.text ?? '').trim(),
  }));

  const fullText =
    transcription.text || audioTranscript.map((s) => s.text).join(' ');
  const duration =
    transcription.duration ||
    (segments.length > 0 ? (segments[segments.length - 1].end ?? 0) : 0);

  logger.info('Whisper fallback completed', {
    context: {
      segmentCount: audioTranscript.length,
      duration,
      textLength: fullText.length,
    },
  });

  return {
    audioTranscript,
    visualEvents: [], // Whisper doesn't provide visual events
    combinedNarrative: `[Transcribed via Whisper fallback - no visual events available]\n\n${fullText}`,
    duration,
    keyMoments: [], // No key moments from Whisper
  };
}

/**
 * Format seconds to MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Transcribe a video recording using Gemini video understanding
 */
export async function transcribeRecording(job: Job): Promise<void> {
  const logger = createLogger({ service: 'transcribe-gemini' });
  const supabase = createAdminClient();

  const rawPayload = (job.payload || {}) as TranscribePayload;
  let resolvedPayload: ResolvedTranscribeStoragePayload;

  try {
    const recordingIdForLookup = requirePayloadString(
      rawPayload,
      'recordingId',
    );
    const orgIdForLookup = requirePayloadString(rawPayload, 'orgId');

    const { data: recording, error: recordingError } = await supabase
      .from('content')
      .select('id, org_id, content_type, file_type, storage_path_raw')
      .eq('id', recordingIdForLookup)
      .eq('org_id', orgIdForLookup)
      .single();

    if (recordingError || !recording) {
      throw new Error('Invalid transcribe payload: recording not found');
    }

    resolvedPayload = resolveTranscribeStoragePayload(
      rawPayload,
      recording as TranscribeRecordingRow,
    );
  } catch (error) {
    logger.error('Invalid transcription payload', {
      context: { jobId: job.id },
      error: error as Error,
    });
    throw error;
  }

  const { recordingId, orgId, storagePath, storageBucket, fileType } =
    resolvedPayload;
  const mediaMetadata = resolveTranscribeMediaMetadata(fileType);

  // Check if streaming is available for this recording
  const isStreaming = isStreamingAvailable(recordingId);

  logger.info('Starting video transcription', {
    context: {
      recordingId,
      orgId,
      storagePath,
      storageBucket,
      mediaMimeType: mediaMetadata.mimeType,
      mediaKind: mediaMetadata.mediaKind,
      jobId: job.id,
      streamingEnabled: isStreaming,
    },
  });

  // Check if transcript already exists (idempotency check)
  const { data: existingTranscript } = await supabase
    .from('transcripts')
    .select('id, content_id')
    .eq('content_id', recordingId)
    .single();

  if (existingTranscript) {
    logger.info('Transcript already exists, skipping transcription', {
      context: {
        recordingId,
        transcriptId: existingTranscript.id,
      },
    });

    // Ensure recording status is correct
    await supabase
      .from('content')
      .update({
        status:
          getQueuedSourceStatusForJob('doc_generate') ??
          SOURCE_STATUS.DOCUMENT_GENERATING,
      })
      .eq('id', recordingId);

    // Enqueue document generation job (in case pipeline was interrupted)
    const { data: existingDocJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('type', 'doc_generate')
      .eq('dedupe_key', `doc_generate:${recordingId}`)
      .maybeSingle();

    if (!existingDocJob) {
      await supabase.from('jobs').insert({
        type: 'doc_generate',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId: existingTranscript.id,
          orgId,
        },
        dedupe_key: `doc_generate:${recordingId}`,
      });
      console.log(
        `[Transcribe-Video] Enqueued document generation job for existing transcript`,
      );
    }

    // Enqueue metadata generation job (in case pipeline was interrupted)
    const { data: existingMetadataJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('type', 'generate_metadata')
      .eq('dedupe_key', `generate_metadata:${recordingId}`)
      .maybeSingle();

    if (!existingMetadataJob) {
      await supabase.from('jobs').insert({
        type: 'generate_metadata',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId: existingTranscript.id,
          orgId,
        },
        dedupe_key: `generate_metadata:${recordingId}`,
        priority: 1, // JOB_PRIORITY.HIGH — titles appear quickly
      });
      console.log(
        `[Transcribe-Video] Enqueued metadata generation job for existing transcript`,
      );
    }

    return;
  }

  // Update recording status
  await supabase
    .from('content')
    .update({ status: SOURCE_STATUS.TRANSCRIBING })
    .eq('id', recordingId);

  let tempFilePath: string | null = null;

  try {
    // Download video from Supabase Storage using streaming to reduce memory usage
    logger.info('Downloading video from storage', {
      context: { storagePath, storageBucket },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        10,
        'Downloading video from storage...',
      );
    }

    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from(storageBucket)
      .download(storagePath);

    if (downloadError || !videoBlob) {
      throw new Error(
        `Failed to download video: ${downloadError?.message || 'Unknown error'}`,
      );
    }

    // Get file size
    const fileSize = videoBlob.size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    logger.info('Video downloaded successfully', {
      context: { fileSize, fileSizeMB },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        20,
        `Downloaded video (${fileSizeMB} MB)`,
      );
    }

    // Stream video to temp file to reduce memory pressure
    // This avoids holding the entire file in memory as arrayBuffer
    tempFilePath = join(
      tmpdir(),
      `${randomUUID()}.${mediaMetadata.fileExtension}`,
    );

    // Use streaming to write blob to file
    const blobStream = videoBlob.stream();
    const writeStream = createWriteStream(tempFilePath);
    await pipeline(
      Readable.fromWeb(blobStream as WebReadableStream<Uint8Array>),
      writeStream,
    );

    // Verify file was written correctly
    const tempFileStats = await stat(tempFilePath);

    logger.info('Saved to temp file via streaming', {
      context: {
        tempFilePath,
        fileSize: tempFileStats.size,
        matchesBlob: tempFileStats.size === fileSize,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        25,
        'Checking video duration...',
      );
    }

    // Get video duration to check if splitting is needed
    let videoDuration: number;
    try {
      videoDuration = await getVideoDuration(tempFilePath);
      logger.info('Video duration detected', {
        context: {
          recordingId,
          durationSeconds: videoDuration,
          durationMinutes: Math.round(videoDuration / 60),
          needsSplitting: shouldSplitVideo(videoDuration),
        },
      });
    } catch (durationError) {
      logger.warn(
        'Could not determine video duration, proceeding without splitting',
        {
          context: { error: (durationError as Error).message },
        },
      );
      videoDuration = 0;
    }

    // Check if video needs splitting (>30 minutes)
    if (shouldSplitVideo(videoDuration)) {
      logger.info(
        'Video exceeds duration limit, initiating segmented processing',
        {
          context: {
            recordingId,
            durationMinutes: Math.round(videoDuration / 60),
            threshold: Math.round(SPLIT_THRESHOLD_SECONDS / 60),
          },
        },
      );

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          28,
          `Video is ${Math.round(videoDuration / 60)} minutes, compressing before split...`,
        );
      }

      // Compress video before splitting to reduce storage and processing time
      let fileToSplit = tempFilePath;
      let compressedFilePath: string | null = null;

      const compressionResult = await compressVideoBeforeSplit(tempFilePath, {
        crf: 30, // Good quality for AI analysis
        preset: 'veryfast', // Fast compression
        onProgress: (percent, message) => {
          if (isStreaming) {
            // Compression takes 28-38% of progress
            streamingManager.sendProgress(
              recordingId,
              'transcribe',
              28 + percent * 0.1,
              message,
            );
          }
        },
      });

      if (compressionResult.success) {
        fileToSplit = compressionResult.outputPath;
        compressedFilePath = compressionResult.outputPath;

        logger.info('Pre-split compression successful', {
          context: {
            recordingId,
            originalSizeMB: (
              compressionResult.originalSize /
              1024 /
              1024
            ).toFixed(2),
            compressedSizeMB: (
              compressionResult.compressedSize /
              1024 /
              1024
            ).toFixed(2),
            savingsPercent: (
              (1 -
                compressionResult.compressedSize /
                  compressionResult.originalSize) *
              100
            ).toFixed(1),
            compressionTime: compressionResult.compressionTime.toFixed(1),
          },
        });

        if (isStreaming) {
          const savings = (
            (1 -
              compressionResult.compressedSize /
                compressionResult.originalSize) *
            100
          ).toFixed(0);
          streamingManager.sendProgress(
            recordingId,
            'transcribe',
            38,
            `Compressed ${savings}% smaller, now splitting into segments...`,
          );
        }
      } else {
        // Compression failed, continue with original file
        logger.warn('Pre-split compression failed, using original file', {
          context: {
            recordingId,
            error: compressionResult.error,
          },
        });

        if (isStreaming) {
          streamingManager.sendProgress(
            recordingId,
            'transcribe',
            38,
            `Splitting video into segments...`,
          );
        }
      }

      // Split video into segments (using compressed file if available)
      const splitResult = await splitVideoIntoSegments(fileToSplit, {
        onProgress: (percent, message) => {
          if (isStreaming) {
            // Splitting takes 38-50% of progress
            streamingManager.sendProgress(
              recordingId,
              'transcribe',
              38 + percent * 0.12,
              message,
            );
          }
        },
      });

      // Clean up compressed file after splitting (segments are now independent)
      if (compressedFilePath) {
        try {
          await unlink(compressedFilePath);
          logger.debug('Cleaned up compressed file after splitting', {
            context: { compressedFilePath },
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      if (!splitResult.success) {
        throw new Error(`Failed to split video: ${splitResult.error}`);
      }

      logger.info('Video split complete', {
        context: {
          recordingId,
          segmentCount: splitResult.segments.length,
          segments: splitResult.segments.map((s) => ({
            index: s.index,
            duration: Math.round(s.duration),
          })),
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          50,
          `Created ${splitResult.segments.length} segments, queueing transcription jobs...`,
        );
      }

      // Create merge job FIRST with 'waiting' status
      // This ensures segment jobs can reference it immediately, preventing race conditions
      // where a segment might complete before its parent_job_id is set
      const { data: mergeJob, error: mergeJobError } = await supabase
        .from('jobs')
        .insert({
          type: 'merge_transcripts',
          status: 'waiting', // Will transition to 'pending' when all segments complete
          payload: {
            contentId: recordingId,
            orgId,
            parentJobId: job.id,
            segmentCount: splitResult.segments.length,
            totalDuration: splitResult.totalDuration,
            segments: splitResult.segments,
          } as unknown as Json,
          // No run_at delay - job will be triggered by segment completion
          run_at: new Date().toISOString(),
          dedupe_key: `merge_transcripts:${recordingId}`,
          // Track segment completion progress
          segments_completed: 0,
          total_segments: splitResult.segments.length,
        })
        .select('id')
        .single();

      if (mergeJobError || !mergeJob) {
        throw new Error(
          `Failed to create merge job: ${mergeJobError?.message || 'Unknown error'}`,
        );
      }

      logger.info('Created merge transcripts job', {
        context: {
          recordingId,
          mergeJobId: mergeJob.id,
          segmentCount: splitResult.segments.length,
        },
      });

      // Create segment jobs with parent_job_id already set
      // This ensures segments can notify the merge job immediately upon completion
      const segmentJobs = await Promise.all(
        splitResult.segments.map(async (segment) => {
          const { data: segmentJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
              type: 'transcribe_segment',
              status: 'pending',
              payload: {
                contentId: recordingId,
                orgId,
                segmentPath: segment.path,
                segmentIndex: segment.index,
                totalSegments: splitResult.segments.length,
                parentJobId: job.id,
                segmentStartTime: segment.startTime,
                segmentEndTime: segment.endTime,
                segmentDuration: segment.duration,
              },
              dedupe_key: `transcribe_segment:${recordingId}:${segment.index}`,
              // Set parent_job_id at creation time to prevent race condition
              parent_job_id: mergeJob.id,
            })
            .select()
            .single();

          if (jobError) {
            throw new Error(
              `Failed to create segment job: ${jobError.message}`,
            );
          }

          return segmentJob;
        }),
      );

      logger.info(
        'Created segment transcription jobs with dependency tracking',
        {
          context: {
            recordingId,
            mergeJobId: mergeJob.id,
            jobCount: segmentJobs.length,
            jobIds: segmentJobs.map((j) => j.id),
          },
        },
      );

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          60,
          `Processing ${splitResult.segments.length} segments - content will become searchable progressively`,
        );
      }

      // Get processing time estimate (use max for conservative estimate)
      const timeEstimate = estimateProcessingTime(splitResult.totalDuration);
      const estimatedMinutes = timeEstimate.maxMinutes;
      const estimatedCompletionAt = new Date(
        Date.now() + estimatedMinutes * 60 * 1000,
      );

      // Update content with progressive processing fields
      await supabase
        .from('content')
        .update({
          status: SOURCE_STATUS.TRANSCRIBING,
          processing_strategy: splitResult.processingStrategy,
          total_segments: splitResult.segments.length,
          completed_segments: 0,
          estimated_completion_at: estimatedCompletionAt.toISOString(),
          metadata: {
            processing_method: 'segmented',
            segment_count: splitResult.segments.length,
            total_duration: splitResult.totalDuration,
            segment_duration_minutes: Math.round(
              splitResult.segmentDuration / 60,
            ),
            estimated_minutes: estimatedMinutes,
            pre_split_compression: compressionResult.success
              ? {
                  original_size_mb: (
                    compressionResult.originalSize /
                    1024 /
                    1024
                  ).toFixed(2),
                  compressed_size_mb: (
                    compressionResult.compressedSize /
                    1024 /
                    1024
                  ).toFixed(2),
                  savings_percent: (
                    (1 -
                      compressionResult.compressedSize /
                        compressionResult.originalSize) *
                    100
                  ).toFixed(1),
                  compression_time_seconds:
                    compressionResult.compressionTime.toFixed(1),
                }
              : null,
          },
        })
        .eq('id', recordingId);

      // Create initial segment_transcripts records with 'pending' status
      // This allows the progress UI to show all segments from the start
      const segmentRecords = splitResult.segments.map((segment) => ({
        content_id: recordingId,
        parent_job_id: job.id,
        segment_index: segment.index,
        segment_start_time: segment.startTime,
        segment_duration: segment.duration,
        status: 'pending' as const,
        key_moments_count: 0,
        embeddings_generated: false,
      }));

      const { error: segmentInsertError } = await supabase
        .from('segment_transcripts')
        .insert(segmentRecords);

      if (segmentInsertError) {
        logger.warn('Could not create segment_transcripts records', {
          context: { error: segmentInsertError.message },
        });
      }

      // Log processing start event for progress tracking
      try {
        await supabase.from('content_processing_events').insert({
          content_id: recordingId,
          event_type: 'processing_started',
          payload: {
            strategy: splitResult.processingStrategy,
            totalSegments: splitResult.segments.length,
            totalDuration: splitResult.totalDuration,
            estimatedMinutes,
          },
        });
      } catch {
        // Ignore if table doesn't exist yet
      }

      // Clean up main temp file (segments are in their own files now)
      // Note: Don't delete temp file yet, segments reference it
      // Cleanup will happen in merge handler

      logger.info('Segmented transcription pipeline initiated', {
        context: {
          recordingId,
          segmentCount: splitResult.segments.length,
          totalDuration: Math.round(splitResult.totalDuration / 60),
          estimatedMinutes,
          processingStrategy: splitResult.processingStrategy,
        },
      });

      // Return early - the segment jobs will handle transcription
      return;
    }

    // Video doesn't need splitting, proceed with single-pass transcription
    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        30,
        'Preparing video for analysis...',
      );
    }

    // Determine method based on file size
    // Files >20MB must use Gemini File API, smaller files can use inline base64
    const useFileAPI = fileSize >= FILE_API_THRESHOLD_BYTES;

    logger.info('Selected Gemini upload method', {
      context: {
        method: useFileAPI ? 'File API' : 'inline',
        fileSizeMB: fileSizeMB,
        threshold: '20MB',
      },
    });

    // For File API uploads, we need to upload the file first and get a URI
    // For inline uploads, we read the file as base64
    let videoBase64: string | null = null;
    let geminiFileUri: string | null = null;
    let geminiMimeType: string | null = null;

    if (useFileAPI) {
      // Use Gemini File API for large files (>20MB)
      logger.info(`Uploading ${mediaMetadata.mediaKind} to Gemini File API`, {
        context: { fileSizeMB, recordingId },
      });

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          35,
          'Uploading large video to Gemini...',
        );
      }

      const fileManager = getFileManager();

      // Upload file to Gemini
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: mediaMetadata.mimeType,
        displayName: `${mediaMetadata.mediaKind}-${recordingId}`,
      });

      logger.info('File uploaded to Gemini, waiting for processing', {
        context: {
          fileName: uploadResult.file.name,
          state: uploadResult.file.state,
          uri: uploadResult.file.uri,
        },
      });

      // Wait for file to be processed (Gemini needs to process video before use)
      const maxPolls = 120; // 10 minutes max wait (120 * 5 seconds)

      const waitForProcessedFile = async (
        file: typeof uploadResult.file,
        pollCount = 0,
      ): Promise<{ file: typeof uploadResult.file; pollCount: number }> => {
        if (file.state !== FileState.PROCESSING) {
          return { file, pollCount };
        }

        const nextPollCount = pollCount + 1;
        if (nextPollCount > maxPolls) {
          throw new Error(
            'Gemini file processing timeout - video may be too long or complex',
          );
        }

        if (nextPollCount % 6 === 0) {
          // Log every 30 seconds
          logger.info('Waiting for Gemini file processing', {
            context: {
              fileName: file.name,
              pollCount: nextPollCount,
              elapsedSeconds: nextPollCount * 5,
            },
          });

          if (isStreaming) {
            streamingManager.sendProgress(
              recordingId,
              'transcribe',
              35 + Math.min(nextPollCount / 2, 10), // Progress from 35-45%
              `Processing video in Gemini (${Math.round((nextPollCount * 5) / 60)}m)...`,
            );
          }
        }

        await sleep(5000); // Poll every 5 seconds
        const nextFile = await fileManager.getFile(file.name);
        return waitForProcessedFile(nextFile, nextPollCount);
      };

      const { file, pollCount } = await waitForProcessedFile(
        uploadResult.file,
      );

      if (file.state === FileState.FAILED) {
        throw new Error(`Gemini file processing failed: ${file.name}`);
      }

      geminiFileUri = file.uri;
      geminiMimeType = file.mimeType || mediaMetadata.mimeType;

      logger.info('Gemini file processing complete', {
        context: {
          fileName: file.name,
          uri: geminiFileUri,
          mimeType: geminiMimeType,
          pollCount,
          processingTimeSeconds: pollCount * 5,
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          45,
          'Video ready for analysis',
        );
      }
    } else {
      // Use inline base64 for small files (<20MB)
      const videoBytes = await readFile(tempFilePath);
      videoBase64 = videoBytes.toString('base64');

      logger.info('Prepared video for inline upload', {
        context: {
          bytesLength: videoBytes.length,
          base64Length: videoBase64.length,
        },
      });
    }

    // Call Gemini API
    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL, // gemini-2.5-flash
    });

    logger.info('Initialized Gemini model', {
      context: { model: GOOGLE_CONFIG.DOCIFY_MODEL },
    });

    // Structured prompt for video analysis
    const prompt = `Analyze this screen recording tutorial video and extract comprehensive information:

**TASK 1: AUDIO TRANSCRIPTION**
Transcribe all spoken content with precise timestamps (MM:SS format).
For each segment, provide:
- timestamp: exact time when speech starts
- text: the spoken words
- speaker: identify if multiple speakers (e.g., "narrator", "interviewer")

**TASK 2: VISUAL EVENTS**
Extract key visual actions that occur on screen:
- UI elements clicked (button text, icon description, location)
- Text typed into form fields (field name, value if visible)
- Screen/page transitions (what changed)
- Mouse movements to important areas
- Any visual elements referenced in narration
- Pop-ups, modals, notifications that appear

For each visual event, provide:
- timestamp: when it occurred (MM:SS)
- type: 'click' | 'type' | 'navigate' | 'scroll' | 'other'
- target: specific UI element name (e.g., "Settings button", "Email field")
- location: where on screen (e.g., "top right corner", "sidebar", "menu bar")
- description: full description of what happened

**TASK 3: COMBINED NARRATIVE**
Create a unified narrative that merges audio and visual, making it clear WHAT was done and WHERE/HOW.
Example: "At 00:15, the instructor says 'now we configure settings' while clicking the gear icon in the top right corner, then selecting 'Advanced Options' from the dropdown menu."

**TASK 4: KEY MOMENTS**
Identify the 3-5 most important moments in the video (major steps, critical actions).

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON matching this structure:
{
  "audioTranscript": [
    {
      "timestamp": "00:05",
      "startTime": 5.0,
      "endTime": 8.5,
      "speaker": "narrator",
      "text": "First, we open the settings panel"
    }
  ],
  "visualEvents": [
    {
      "timestamp": "00:05",
      "type": "click",
      "target": "Settings gear icon",
      "location": "top right corner",
      "description": "User clicks the gear icon to open settings"
    }
  ],
  "combinedNarrative": "Complete merged narrative here...",
  "duration": 125.5,
  "keyMoments": [
    {"timestamp": "00:05", "description": "Opening settings panel"}
  ]
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting or explanatory text.`;

    const startTime = Date.now();

    // Build video source based on upload method
    const videoSource: VideoSource = buildTranscribeVideoSource({
      geminiFileUri,
      geminiMimeType,
      videoBase64,
      fallbackMimeType: mediaMetadata.mimeType,
    });

    logger.info('Sending video to Gemini for analysis', {
      context: {
        promptLength: prompt.length,
        videoSourceType: videoSource.type,
        videoDataSize:
          videoSource.type === 'inline'
            ? videoSource.base64.length
            : 'File API',
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        50,
        'Analyzing video with Gemini AI...',
      );
    }

    // PERF-AI-006: Track which provider was used for transcription
    let transcriptionProvider: 'gemini' | 'whisper' = 'gemini';
    let parsedResponse: GeminiVideoResponse;

    try {
      // Use streaming helper for transcription (Gemini)
      // Supports both inline base64 (<20MB) and File API (>20MB) sources
      const streamingResult = await streamTranscription(
        model,
        videoSource,
        prompt,
        {
          recordingId,
          chunkBufferSize: 500,
          chunkDelayMs: 100,
          punctuationChunking: true,
          progressUpdateInterval: 5,
        },
      );

      const responseText = streamingResult.fullText;
      const analysisTime = Date.now() - startTime;

      logger.info('Received Gemini response', {
        context: {
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 200),
          analysisTime,
          streamedToClient: streamingResult.streamedToClient,
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          70,
          'Processing Gemini response...',
        );
      }

      // Parse JSON response (strip markdown if present)
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(jsonText);

      logger.info('Parsed Gemini response successfully', {
        context: {
          audioSegments: parsedResponse.audioTranscript.length,
          visualEvents: parsedResponse.visualEvents.length,
          keyMoments: parsedResponse.keyMoments?.length || 0,
          duration: parsedResponse.duration,
          provider: 'gemini',
        },
      });
    } catch (geminiError) {
      // PERF-AI-006: Check if we should fall back to Whisper
      if (
        isRecoverableGeminiError(geminiError) &&
        process.env.OPENAI_API_KEY &&
        tempFilePath
      ) {
        logger.warn('Gemini transcription failed, using Whisper fallback', {
          context: {
            geminiError: getErrorMessage(geminiError),
            recordingId,
          },
        });

        if (isStreaming) {
          streamingManager.sendProgress(
            recordingId,
            'transcribe',
            55,
            'Gemini unavailable, using Whisper fallback...',
          );
        }

        try {
          parsedResponse = await transcribeWithWhisperFallback(
            tempFilePath,
            logger,
          );
          transcriptionProvider = 'whisper';
          logger.info('Whisper fallback successful', {
            context: {
              recordingId,
              audioSegments: parsedResponse.audioTranscript.length,
            },
          });
        } catch (whisperError) {
          logger.error('Both Gemini and Whisper failed', {
            context: {
              geminiError: getErrorMessage(geminiError),
              whisperError: getErrorMessage(whisperError),
              recordingId,
            },
          });
          throw new Error(
            `All transcription providers failed: Gemini (${getErrorMessage(geminiError)}), Whisper (${getErrorMessage(whisperError)})`,
          );
        }
      } else {
        // Not a recoverable error, or no fallback available
        throw geminiError;
      }
    }

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        80,
        `Extracted ${parsedResponse.audioTranscript.length} audio segments` +
          (parsedResponse.visualEvents.length > 0
            ? ` and ${parsedResponse.visualEvents.length} visual events`
            : ''),
      );
    }

    // Convert audio transcript to compatible format (similar to words_json structure)
    const fullTranscript = parsedResponse.audioTranscript
      .map((seg) => seg.text)
      .join(' ')
      .trim();

    // Build words_json compatible structure
    const words_json = {
      segments: parsedResponse.audioTranscript.map((seg) => ({
        start: seg.startTime,
        end: seg.endTime,
        text: seg.text,
      })),
      duration: parsedResponse.duration,
      words: [], // Gemini doesn't provide word-level timestamps, leave empty
    };

    // Prepare video metadata
    const video_metadata = {
      model:
        transcriptionProvider === 'gemini'
          ? GOOGLE_CONFIG.DOCIFY_MODEL
          : 'whisper-1',
      provider:
        transcriptionProvider === 'gemini'
          ? 'gemini-video'
          : 'whisper-fallback', // PERF-AI-006: Track provider
      duration: parsedResponse.duration,
      file_size_mb: (fileSize / 1024 / 1024).toFixed(2),
      processed_at: new Date().toISOString(),
      visual_events_count: parsedResponse.visualEvents.length,
      audio_segments_count: parsedResponse.audioTranscript.length,
      key_moments_count: parsedResponse.keyMoments?.length || 0,
    };

    // Save transcript to database
    logger.info('Saving transcript to database', {
      context: {
        textLength: fullTranscript.length,
        visualEventsCount: parsedResponse.visualEvents.length,
        duration: parsedResponse.duration,
      },
    });

    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        content_id: recordingId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json,
        visual_events: parsedResponse.visualEvents as unknown as Json,
        video_metadata,
        confidence: transcriptionProvider === 'gemini' ? 0.95 : 0.92, // Gemini 95%, Whisper 92%
        provider:
          transcriptionProvider === 'gemini'
            ? 'gemini-video'
            : 'whisper-fallback', // PERF-AI-006
      })
      .select()
      .single();

    if (transcriptError) {
      logger.error('Failed to save transcript', {
        context: { recordingId },
        error: transcriptError,
      });
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    logger.info('Transcript saved successfully', {
      context: {
        transcriptId: transcript.id,
        audioPreview: fullTranscript.substring(0, 100),
        visualEventsCount: parsedResponse.visualEvents.length,
        duration: parsedResponse.duration,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        90,
        'Transcript saved successfully',
      );
    }

    // Update recording status (single-pass processing)
    await supabase
      .from('content')
      .update({
        status:
          getQueuedSourceStatusForJob('doc_generate') ??
          SOURCE_STATUS.DOCUMENT_GENERATING,
        processing_strategy: 'single',
        total_segments: 1,
        completed_segments: 1,
      })
      .eq('id', recordingId);

    // PERF-AI-001: Create all dependent jobs in parallel for faster pipeline execution
    // Previously, jobs were created sequentially which added unnecessary latency
    // Get recording info first for compression job preparation
    const { data: recording } = await supabase
      .from('content')
      .select('content_type, file_type, file_size, storage_path_raw')
      .eq('id', recordingId)
      .single();

    // Build array of jobs to create in parallel
    const jobPromises: Array<Promise<unknown>> = [
      // Document generation job
      Promise.resolve(
        supabase.from('jobs').insert({
          type: 'doc_generate',
          status: 'pending',
          payload: {
            recordingId,
            transcriptId: transcript.id,
            orgId,
          },
          dedupe_key: `doc_generate:${recordingId}`,
        }),
      ).then((res) => res.data),
      // Embeddings generation job - can start in parallel with doc generation
      Promise.resolve(
        supabase.from('jobs').insert({
          type: 'generate_embeddings',
          status: 'pending',
          payload: {
            recordingId,
            transcriptId: transcript.id,
            orgId,
          },
          dedupe_key: `generate_embeddings:${recordingId}`,
        }),
      ).then((res) => res.data),
      // Metadata generation job - generates title, description, and tags
      Promise.resolve(
        supabase.from('jobs').insert({
          type: 'generate_metadata',
          status: 'pending',
          payload: {
            recordingId,
            transcriptId: transcript.id,
            orgId,
          },
          dedupe_key: `generate_metadata:${recordingId}`,
          priority: 1, // JOB_PRIORITY.HIGH — titles appear quickly
        }),
      ).then((res) => res.data),
    ];

    // Add compression job if applicable
    if (recording && recording.storage_path_raw) {
      const contentType = recording.content_type || 'recording';
      const outputPath = recording.storage_path_raw.replace(
        '/raw.',
        '/compressed.',
      );

      // Only compress video/audio content types
      if (['recording', 'video', 'audio'].includes(contentType)) {
        jobPromises.push(
          Promise.resolve(
            supabase.from('jobs').insert({
              type:
                contentType === 'audio' ? 'compress_audio' : 'compress_video',
              status: 'pending',
              payload: {
                recordingId,
                orgId,
                inputPath: recording.storage_path_raw,
                outputPath,
                profile: 'uploadedVideo', // Will be determined by classifier
                contentType,
                fileType: recording.file_type || 'mp4',
              },
              dedupe_key: `compress_${contentType}:${recordingId}`,
            }),
          ).then((res) => res.data),
        );
      }
    }

    // Execute all job creations in parallel
    await Promise.all(jobPromises);

    await supabase
      .from('content')
      .update({
        status:
          getQueuedSourceStatusForJob('doc_generate') ??
          SOURCE_STATUS.DOCUMENT_GENERATING,
      })
      .eq('id', recordingId);

    logger.info('Enqueued all dependent jobs in parallel', {
      context: {
        recordingId,
        transcriptId: transcript.id,
        jobCount: jobPromises.length,
        jobs: [
          'doc_generate',
          'generate_embeddings',
          'generate_metadata',
          recording?.storage_path_raw ? 'compression' : null,
        ].filter(Boolean),
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        95,
        'Processing complete, starting document generation',
      );
    }

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'recording.transcribed',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
        hasVisualContext: true,
        visualEventsCount: parsedResponse.visualEvents.length,
      },
    });

    const totalTime = Date.now() - startTime;
    logger.info('Video transcription completed', {
      context: {
        recordingId,
        transcriptId: transcript.id,
        hasVisualContext: true,
        visualEventsCount: parsedResponse.visualEvents.length,
        totalTime,
      },
    });

    if (isStreaming) {
      sendCompletionNotification(recordingId, 'Transcription', totalTime);
      streamingManager.sendComplete(
        recordingId,
        `Transcription complete in ${Math.round(totalTime / 1000)}s`,
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Video transcription failed';

    logger.error('Video transcription failed', {
      context: {
        recordingId,
        orgId,
        storagePath,
        storageBucket,
        jobId: job.id,
      },
      error: error as Error,
    });

    if (isStreaming) {
      streamingManager.sendError(recordingId, errorMessage);
    }

    // Update recording status to error
    await supabase
      .from('content')
      .update({
        status: SOURCE_STATUS.ERROR,
        metadata: {
          error: errorMessage,
          errorType: 'transcription',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        logger.info('Cleaned up temp file', {
          context: { tempFilePath },
        });
      } catch (err) {
        logger.warn('Failed to delete temp file', {
          context: {
            tempFilePath,
            error: (err as Error).message,
          },
        });
      }
    }
  }
}
