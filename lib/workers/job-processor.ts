/**
 * Background Job Processor
 *
 * Polls the jobs table for pending jobs and executes them with retry logic.
 * This is designed to run as a separate process or serverless function.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';

const processorLogger = createLogger({ service: 'job-processor' });

// GEMINI VIDEO MODE: Using Gemini for video understanding, doc generation, and embeddings
import { transcribeRecording } from './handlers/transcribe-gemini-video';
import { generateDocument } from './handlers/docify-google';
import { generateEmbeddings } from './handlers/embeddings-google';
import { generateSummary } from './handlers/generate-summary';
import { handleExtractFrames } from './handlers/extract-frames';
import { syncConnector } from './handlers/sync-connector';
import { processImportedDocument } from './handlers/process-imported-doc';
import { processWebhook } from './handlers/process-webhook';

// Content processing handlers
import { handleExtractAudio } from './handlers/extract-audio';
import { handleExtractTextPdf } from './handlers/extract-text-pdf';
import { handleExtractTextDocx } from './handlers/extract-text-docx';
import { handleProcessTextNote } from './handlers/process-text-note';

// Compression handlers
import { handleCompressVideo } from './handlers/compress-video';
import { handleCompressAudio } from './handlers/compress-audio';

// Storage tier migration handlers
import { handleMigrateStorageTier } from './handlers/migrate-storage-tier';

// Deduplication handlers
import { handleDeduplicateFile, handleBatchDeduplicate } from './handlers/deduplicate-file';

// Similarity detection handlers
import { handleDetectSimilarity, handleBatchDetectSimilarity } from './handlers/detect-similarity';

// Analytics and monitoring handlers
import { handleCollectMetrics } from './handlers/collect-metrics';
import { handleGenerateAlerts } from './handlers/generate-alerts';
import { handleGenerateRecommendations } from './handlers/generate-recommendations';
import { handlePerformHealthCheck } from './handlers/perform-health-check';

// Publishing handlers
import { handlePublishDocument } from './handlers/publish-document';

// ALTERNATIVE: Google Cloud Speech-to-Text mode (requires API enablement)
// import { transcribeRecording } from './handlers/transcribe-google';
// import { generateDocument } from './handlers/docify-google';
// import { generateEmbeddings } from './handlers/embeddings-google';

// HYBRID MODE: OpenAI transcription + Google doc generation + Google embeddings
// Uncomment this if you want to use OpenAI Whisper for transcription instead
// import { transcribeRecording } from './handlers/transcribe-simplified';
// import { generateDocument } from './handlers/docify-google';
// import { generateEmbeddings } from './handlers/embeddings-google';

// FULL OPENAI MODE (not supported - no API access)
// import { transcribeRecording } from './handlers/transcribe';
// import { generateDocument } from './handlers/docify';
// import { generateEmbeddings } from './handlers/embeddings';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobType = JobRow['type'];
type JobStatus = JobRow['status'];

// PERF-DB-002: Extended job type with prefetched content data
// This eliminates N+1 queries by joining jobs with content in the initial fetch
interface PrefetchedContent {
  id: string;
  org_id: string;
  title: string | null;
  status: string;
  content_type: string;
  file_type: string | null;
  storage_path_raw: string | null;
  storage_path_processed: string | null;
  file_size: number | null;
}

type Job = JobRow & {
  content?: PrefetchedContent | null;
};

interface JobHandler {
  (job: Job, progressCallback?: ProgressCallback): Promise<void>;
}

export interface ProgressCallback {
  (percent: number, message: string, data?: any): void;
}

/**
 * Get contextual completion message for job type
 */
function getCompletionMessage(jobType: string): string {
  const messages: Record<string, string> = {
    'extract_text_docx': 'Text extracted successfully',
    'extract_text_pdf': 'PDF text extracted successfully',
    'extract_audio': 'Audio extracted successfully',
    'transcribe': 'Transcription complete',
    'doc_generate': 'Document generated successfully',
    'generate_embeddings': 'Search indexing complete',
    'generate_summary': 'AI summary generated',
    'extract_frames': 'Video frames extracted',
    'sync_connector': 'External sync complete',
    'publish_document': 'Document published successfully',
  };

  return messages[jobType] || 'Processing complete';
}

/**
 * Update job progress in database and stream to connected clients
 */
export async function updateJobProgress(
  jobId: string,
  contentId: string,
  percent: number,
  message: string,
  data?: any
): Promise<void> {
  const supabase = createAdminClient();

  // Update database
  await supabase
    .from('jobs')
    .update({
      progress_percent: Math.min(100, Math.max(0, percent)),
      progress_message: message,
    })
    .eq('id', jobId);

  // Stream to connected clients
  streamingManager.sendProgress(contentId, 'all', percent, message, data);

  processorLogger.debug('Job progress updated', {
    context: { jobId, contentId },
    data: { percent, message },
  });
}

// Stub handlers for future job types
const stubHandler: JobHandler = async (job: Job) => {
  console.log(`[Job Processor] Job type '${job.type}' not yet implemented, marking as completed`);
};

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  transcribe: transcribeRecording,
  doc_generate: generateDocument,
  generate_embeddings: generateEmbeddings,
  generate_summary: generateSummary,
  extract_frames: handleExtractFrames as unknown as JobHandler, // Phase 4 - Video frame extraction and indexing
  sync_connector: syncConnector, // Phase 5 - Connector sync
  process_imported_doc: processImportedDocument, // Phase 5 - Process imported documents
  process_webhook: processWebhook, // Phase 5 - Process webhook events

  // Content processing handlers
  extract_audio: handleExtractAudio, // Extract audio track from video files
  extract_text_pdf: handleExtractTextPdf, // Extract text from PDF documents
  extract_text_docx: handleExtractTextDocx, // Extract text from DOCX documents
  process_text_note: handleProcessTextNote, // Process user-created text notes

  // Compression handlers
  compress_video: async (job: Job) => {
    const result = await handleCompressVideo(job.payload as any);
    if (!result.success) {
      throw new Error(result.error || 'Video compression failed');
    }
  },
  compress_audio: async (job: Job) => {
    const result = await handleCompressAudio(job.payload as any);
    if (!result.success) {
      throw new Error(result.error || 'Audio compression failed');
    }
  },

  // Storage tier migration
  migrate_storage_tier: async (job: Job) => {
    const result = await handleMigrateStorageTier(job.payload as any);
    if (!result.success) {
      throw new Error(result.error || 'Storage tier migration failed');
    }
  },

  // Deduplication handlers
  deduplicate_file: async (job: Job) => {
    const result = await handleDeduplicateFile(job.payload as any);
    if (!result.success) {
      throw new Error(result.error || 'File deduplication failed');
    }
  },
  batch_deduplicate: async (job: Job) => {
    const result = await handleBatchDeduplicate(job.payload as any);
    if (!result.success) {
      throw new Error('Batch deduplication failed');
    }
  },

  // Similarity detection handlers
  detect_similarity: async (job: Job) => {
    const result = await handleDetectSimilarity(job.payload as any);
    if (!result.success) {
      throw new Error(result.error || 'Similarity detection failed');
    }
  },
  batch_detect_similarity: async (job: Job) => {
    const result = await handleBatchDetectSimilarity(job.payload as any);
    if (!result.success) {
      throw new Error('Batch similarity detection failed');
    }
  },

  // Analytics and monitoring handlers
  collect_metrics: handleCollectMetrics,
  generate_alerts: handleGenerateAlerts,
  generate_recommendations: handleGenerateRecommendations,
  perform_health_check: handlePerformHealthCheck,

  // Publishing handlers
  publish_document: handlePublishDocument,
};

// PERF-WK-001: Job priority levels (0 = highest, 3 = lowest)
export const JOB_PRIORITY = {
  CRITICAL: 0, // User is actively waiting (transcribe, extract)
  HIGH: 1,     // Processing pipeline (doc_generate, embeddings)
  NORMAL: 2,   // Background operations (sync, compress)
  LOW: 3,      // Analytics and monitoring (metrics, alerts)
} as const;

// CFG-001-003: Environment-based configuration with sensible defaults
function parseIntWithDefault(value: string | undefined, defaultValue: number): number {
  const parsed = parseInt(value || '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
}

const CONFIG = {
  batchSize: parseIntWithDefault(process.env.JOB_BATCH_SIZE, 10),
  pollInterval: parseIntWithDefault(process.env.JOB_POLL_INTERVAL_MS, 2000),
  maxPollInterval: parseIntWithDefault(process.env.JOB_MAX_POLL_INTERVAL_MS, 10000),
  maxRetries: parseIntWithDefault(process.env.JOB_MAX_RETRIES, 3),
  deadLetterAfterRetries: parseIntWithDefault(process.env.JOB_DEAD_LETTER_RETRIES, 5),
};

/**
 * Main job processing loop with exponential backoff for idle periods
 * PERF-WK-001: Jobs are now processed by priority (0=critical, 3=low)
 * CFG-001-003: Configuration is now environment-based
 */
export async function processJobs(options?: {
  batchSize?: number;
  pollInterval?: number;
  maxRetries?: number;
  maxPollInterval?: number;
}) {
  const {
    batchSize = CONFIG.batchSize,
    pollInterval = CONFIG.pollInterval,
    maxRetries = CONFIG.maxRetries,
    maxPollInterval = CONFIG.maxPollInterval,
  } = options || {};

  const supabase = createAdminClient();

  console.log('[Job Processor] Starting job processor with exponential backoff...');
  console.log(`[Job Processor] Batch size: ${batchSize}, Base poll interval: ${pollInterval}ms, Max poll interval: ${maxPollInterval}ms`);

  // Exponential backoff state
  let currentPollInterval = pollInterval;
  let consecutiveEmptyPolls = 0;

  // Main processing loop
  while (true) {
    try {
      // PERF-DB-002: Fetch pending jobs with content data (eliminates N+1 queries)
      // PERF-WK-001: Order by priority (0=critical first), then run_at, then created_at
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          *,
          content:content!jobs_content_id_fkey (
            id,
            org_id,
            title,
            status,
            content_type,
            file_type,
            storage_path_raw,
            storage_path_processed,
            file_size
          )
        `)
        .eq('status', 'pending')
        .lte('run_at', new Date().toISOString()) // Only jobs ready to run
        .order('priority', { ascending: true })   // High priority first (0 before 3)
        .order('run_at', { ascending: true })     // Then by scheduled time
        .order('created_at', { ascending: true }) // Then by creation time
        .limit(batchSize);

      if (error) {
        console.error('[Job Processor] Error fetching jobs:', error);
        await sleep(currentPollInterval);
        continue;
      }

      if (!jobs || jobs.length === 0) {
        // No jobs to process - increase poll interval with exponential backoff
        consecutiveEmptyPolls++;

        // Double the interval with each empty poll, up to max
        currentPollInterval = Math.min(
          pollInterval * Math.pow(2, consecutiveEmptyPolls),
          maxPollInterval
        );

        // Log backoff changes to help with monitoring
        if (consecutiveEmptyPolls === 1) {
          console.log(`[Job Processor] No jobs found, entering backoff mode (current interval: ${currentPollInterval}ms)`);
        } else if (consecutiveEmptyPolls % 5 === 0) {
          console.log(`[Job Processor] Still idle after ${consecutiveEmptyPolls} polls (current interval: ${currentPollInterval}ms)`);
        }

        await sleep(currentPollInterval);
        continue;
      }

      // Jobs found! Reset backoff
      if (consecutiveEmptyPolls > 0) {
        console.log(`[Job Processor] Jobs detected, resetting poll interval to ${pollInterval}ms`);
        consecutiveEmptyPolls = 0;
        currentPollInterval = pollInterval;
      }

      console.log(`[Job Processor] Found ${jobs.length} pending jobs`);

      // Process jobs in parallel
      await Promise.allSettled(
        jobs.map(job => processJob(job, maxRetries))
      );

      // After processing, poll immediately for more jobs
      // (Don't sleep if we just processed a batch)

    } catch (error) {
      console.error('[Job Processor] Unexpected error in main loop:', error);
      await sleep(currentPollInterval);
    }
  }
}

/**
 * Process a single job
 */
async function processJob(job: Job, maxRetries: number): Promise<void> {
  const supabase = createAdminClient();
  // Support both old (recordingId) and new (contentId) payload formats for backward compatibility
  const contentId = (job.payload as any)?.contentId || (job.payload as any)?.recordingId;

  try {
    processorLogger.info('Processing job', {
      context: { jobId: job.id, contentId, jobType: job.type },
    });

    // Mark job as processing
    await supabase
      .from('jobs')
      .update({
        status: 'processing' as JobStatus,
        started_at: new Date().toISOString(),
        progress_percent: 0,
        progress_message: 'Starting job...',
      })
      .eq('id', job.id);

    // Stream initial progress
    if (contentId) {
      streamingManager.sendProgress(contentId, 'all', 0, 'Starting job...', {
        jobId: job.id,
        jobType: job.type,
      });
    }

    // Get handler for job type
    const handler = JOB_HANDLERS[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Create progress callback
    const progressCallback: ProgressCallback = (percent, message, data) => {
      if (contentId) {
        updateJobProgress(job.id, contentId, percent, message, data);
      }
    };

    // Execute handler with progress callback
    await handler(job, progressCallback);

    // Mark job as completed (preserve contextual message)
    const completionMessage = getCompletionMessage(job.type);
    await supabase
      .from('jobs')
      .update({
        status: 'completed' as JobStatus,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        progress_message: completionMessage,
      })
      .eq('id', job.id);

    // Stream completion
    if (contentId) {
      streamingManager.sendProgress(contentId, 'all', 100, 'Job completed successfully', {
        jobId: job.id,
        jobType: job.type,
      });
    }

    processorLogger.info('Job completed successfully', {
      context: { jobId: job.id, contentId },
    });

  } catch (error) {
    processorLogger.error('Job processing failed', {
      context: { jobId: job.id, contentId },
      error: error as Error,
    });

    const attemptCount = job.attempts + 1;
    const shouldRetry = attemptCount < maxRetries;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, attemptCount), 60000); // Max 1 minute
      const runAfter = new Date(Date.now() + retryDelay).toISOString();

      await supabase
        .from('jobs')
        .update({
          status: 'pending' as JobStatus,
          attempts: attemptCount,
          run_at: runAfter,
          error: errorMessage,
          progress_percent: null,
          progress_message: `Retry scheduled (${attemptCount}/${maxRetries})`,
        })
        .eq('id', job.id);

      // Stream retry notification
      if (contentId) {
        streamingManager.sendLog(
          contentId,
          `Job failed, scheduling retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`,
          { error: errorMessage }
        );
      }

      processorLogger.info('Job retry scheduled', {
        context: { jobId: job.id, contentId, attemptCount, maxRetries, retryDelay },
      });
    } else {
      // PERF-WK-002: Determine if job should go to dead letter queue
      // Jobs that exceed deadLetterAfterRetries go to dead_letter for manual review
      const isDeadLetter = attemptCount >= CONFIG.deadLetterAfterRetries;
      const finalStatus = isDeadLetter ? 'dead_letter' : 'failed';

      await supabase
        .from('jobs')
        .update({
          status: finalStatus as JobStatus,
          attempts: attemptCount,
          error: errorMessage,
          progress_percent: null,
          progress_message: isDeadLetter ? 'Moved to dead letter queue' : 'Failed',
        })
        .eq('id', job.id);

      // Stream error
      if (contentId) {
        streamingManager.sendError(
          contentId,
          isDeadLetter
            ? `Job moved to dead letter queue after ${attemptCount} attempts: ${errorMessage}`
            : `Job failed after ${maxRetries} attempts: ${errorMessage}`
        );
      }

      processorLogger.error(isDeadLetter ? 'Job moved to dead letter queue' : 'Job failed permanently', {
        context: { jobId: job.id, contentId, attemptCount, maxRetries, isDeadLetter },
        error: error as Error,
      });
    }
  }
}

/**
 * Process a single job immediately (useful for testing or one-off jobs)
 */
export async function processJobById(jobId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  await processJob(job, 3);
}

/**
 * Utility: Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
