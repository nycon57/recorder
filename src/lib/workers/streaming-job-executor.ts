/**
 * Streaming-Aware Job Executor
 *
 * Executes jobs inline with real-time streaming updates via SSE.
 * This allows the reprocess streaming endpoint to trigger immediate processing
 * while sending progress updates to connected clients.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { streamingManager } from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';

import { updateJobProgress, type ProgressCallback } from './job-processor';

// Import job handlers
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

const logger = createLogger({ service: 'streaming-job-executor' });

type Job = Database['public']['Tables']['jobs']['Row'];
type JobType = Job['type'];
type JobStatus = Job['status'];

interface JobHandler {
  (job: Job, progressCallback?: ProgressCallback): Promise<void>;
}

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  transcribe: transcribeRecording,
  doc_generate: generateDocument,
  generate_embeddings: generateEmbeddings,
  generate_summary: generateSummary,
  extract_frames: handleExtractFrames as unknown as JobHandler,
  sync_connector: syncConnector,
  process_imported_doc: processImportedDocument,
  process_webhook: processWebhook,

  // Content processing handlers
  extract_audio: handleExtractAudio,
  extract_text_pdf: handleExtractTextPdf,
  extract_text_docx: handleExtractTextDocx,
  process_text_note: handleProcessTextNote,

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
 * Execute a single job with streaming progress updates
 * This is designed to be called from the streaming reprocess endpoint
 * @param contentId - The content ID (supports both old recordingId and new contentId naming)
 */
export async function executeJobWithStreaming(
  jobId: string,
  contentId: string,
  maxRetries: number = 3
): Promise<void> {
  const supabase = createAdminClient();

  logger.info('Starting streaming job execution', {
    context: { jobId, contentId },
  });

  // Fetch job details
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    const errorMsg = `Job not found: ${jobId}`;
    logger.error(errorMsg, {
      context: { jobId, contentId },
      error: jobError as Error | undefined,
    });
    streamingManager.sendError(contentId, errorMsg);
    throw new Error(errorMsg);
  }

  try {
    logger.info('Executing job handler', {
      context: { jobId, contentId, jobType: job.type },
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
      .eq('id', jobId);

    // Stream initial progress
    streamingManager.sendProgress(contentId, 'all', 0, `Starting ${job.type}...`, {
      jobId,
      jobType: job.type,
    });

    // Get handler for job type
    const handler = JOB_HANDLERS[job.type as JobType];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Create streaming progress callback
    const progressCallback: ProgressCallback = (percent, message, data) => {
      logger.debug('Job progress update', {
        context: { jobId, contentId },
        data: { percent, message },
      });

      // Update database
      updateJobProgress(jobId, contentId, percent, message, data);
    };

    // Execute handler with progress callback
    logger.info('Calling job handler', {
      context: { jobId, contentId, jobType: job.type },
    });

    await handler(job, progressCallback);

    logger.info('Job handler completed successfully', {
      context: { jobId, contentId, jobType: job.type },
    });

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed' as JobStatus,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        progress_message: 'Completed',
      })
      .eq('id', jobId);

    // Stream completion
    streamingManager.sendProgress(contentId, 'all', 100, `${job.type} completed successfully`, {
      jobId,
      jobType: job.type,
    });

    logger.info('Job completed successfully', {
      context: { jobId, contentId, jobType: job.type },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Job execution failed', {
      context: { jobId, contentId },
      error: error as Error,
    });

    const attemptCount = job.attempts + 1;
    const shouldRetry = attemptCount < maxRetries;

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, attemptCount), 60000);
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
        .eq('id', jobId);

      // Stream retry notification
      streamingManager.sendLog(
        contentId,
        `Job failed, scheduling retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`,
        { error: errorMessage }
      );

      logger.info('Job retry scheduled', {
        context: { jobId, contentId, attemptCount, maxRetries, retryDelay },
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
        .eq('id', jobId);

      // Stream error
      streamingManager.sendError(
        contentId,
        `Job failed after ${maxRetries} attempts: ${errorMessage}`
      );

      logger.error('Job failed permanently', {
        context: { jobId, contentId, attemptCount, maxRetries },
        error: error as Error,
      });
    }

    throw error;
  }
}

/**
 * Execute multiple jobs sequentially with streaming updates
 * Used for processing entire pipelines (transcribe -> document -> embeddings)
 * @param contentId - The content ID (supports both old recordingId and new contentId naming)
 */
export async function executeJobPipelineWithStreaming(
  jobIds: string[],
  contentId: string,
  maxRetries: number = 3
): Promise<void> {
  logger.info('Starting job pipeline execution', {
    context: { contentId, jobCount: jobIds.length },
    data: { jobIds },
  });

  streamingManager.sendLog(
    contentId,
    `Starting pipeline with ${jobIds.length} jobs`,
    { jobIds }
  );

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i];

    logger.info(`Executing pipeline job ${i + 1}/${jobIds.length}`, {
      context: { contentId, jobId },
    });

    streamingManager.sendLog(
      contentId,
      `Processing step ${i + 1}/${jobIds.length}`,
      { jobId }
    );

    try {
      await executeJobWithStreaming(jobId, contentId, maxRetries);
    } catch (error) {
      logger.error('Pipeline job failed', {
        context: { contentId, jobId, step: i + 1 },
        error: error as Error,
      });

      // Continue with remaining jobs even if one fails
      // (some jobs like embeddings are non-critical)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      streamingManager.sendLog(
        contentId,
        `Step ${i + 1} failed: ${errorMsg}, continuing with next step`,
        { jobId, error: errorMsg }
      );
    }
  }

  logger.info('Job pipeline execution completed', {
    context: { contentId, jobCount: jobIds.length },
  });

  streamingManager.sendComplete(
    contentId,
    'Pipeline completed',
    { totalJobs: jobIds.length }
  );
}
