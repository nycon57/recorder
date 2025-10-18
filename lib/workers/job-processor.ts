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

type Job = Database['public']['Tables']['jobs']['Row'];
type JobType = Job['type'];
type JobStatus = Job['status'];

interface JobHandler {
  (job: Job, progressCallback?: ProgressCallback): Promise<void>;
}

export interface ProgressCallback {
  (percent: number, message: string, data?: any): void;
}

/**
 * Update job progress in database and stream to connected clients
 */
export async function updateJobProgress(
  jobId: string,
  recordingId: string,
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
  streamingManager.sendProgress(recordingId, 'all', percent, message, data);

  processorLogger.debug('Job progress updated', {
    context: { jobId, recordingId },
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
  extract_frames: handleExtractFrames, // Phase 4 - Video frame extraction and indexing
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
};

/**
 * Main job processing loop
 */
export async function processJobs(options?: {
  batchSize?: number;
  pollInterval?: number;
  maxRetries?: number;
}) {
  const {
    batchSize = 10,
    pollInterval = 5000,
    maxRetries = 3,
  } = options || {};

  const supabase = createAdminClient();

  console.log('[Job Processor] Starting job processor...');
  console.log(`[Job Processor] Batch size: ${batchSize}, Poll interval: ${pollInterval}ms`);

  // Main processing loop
  while (true) {
    try {
      // Fetch pending jobs
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (error) {
        console.error('[Job Processor] Error fetching jobs:', error);
        await sleep(pollInterval);
        continue;
      }

      if (!jobs || jobs.length === 0) {
        // No jobs to process
        await sleep(pollInterval);
        continue;
      }

      console.log(`[Job Processor] Found ${jobs.length} pending jobs`);

      // Process jobs in parallel
      await Promise.allSettled(
        jobs.map(job => processJob(job, maxRetries))
      );

    } catch (error) {
      console.error('[Job Processor] Unexpected error in main loop:', error);
      await sleep(pollInterval);
    }
  }
}

/**
 * Process a single job
 */
async function processJob(job: Job, maxRetries: number): Promise<void> {
  const supabase = createAdminClient();
  const recordingId = (job.payload as any)?.recordingId;

  try {
    processorLogger.info('Processing job', {
      context: { jobId: job.id, recordingId, jobType: job.type },
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
    if (recordingId) {
      streamingManager.sendProgress(recordingId, 'all', 0, 'Starting job...', {
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
      if (recordingId) {
        updateJobProgress(job.id, recordingId, percent, message, data);
      }
    };

    // Execute handler with progress callback
    await handler(job, progressCallback);

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed' as JobStatus,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        progress_message: 'Completed',
      })
      .eq('id', job.id);

    // Stream completion
    if (recordingId) {
      streamingManager.sendProgress(recordingId, 'all', 100, 'Job completed successfully', {
        jobId: job.id,
        jobType: job.type,
      });
    }

    processorLogger.info('Job completed successfully', {
      context: { jobId: job.id, recordingId },
    });

  } catch (error) {
    processorLogger.error('Job processing failed', {
      context: { jobId: job.id, recordingId },
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
      if (recordingId) {
        streamingManager.sendLog(
          recordingId,
          `Job failed, scheduling retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`,
          { error: errorMessage }
        );
      }

      processorLogger.info('Job retry scheduled', {
        context: { jobId: job.id, recordingId, attemptCount, maxRetries, retryDelay },
      });
    } else {
      // Mark as failed
      await supabase
        .from('jobs')
        .update({
          status: 'failed' as JobStatus,
          attempts: attemptCount,
          error: errorMessage,
          progress_percent: null,
          progress_message: 'Failed',
        })
        .eq('id', job.id);

      // Stream error
      if (recordingId) {
        streamingManager.sendError(
          recordingId,
          `Job failed after ${maxRetries} attempts: ${errorMessage}`
        );
      }

      processorLogger.error('Job failed permanently', {
        context: { jobId: job.id, recordingId, attemptCount, maxRetries },
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
