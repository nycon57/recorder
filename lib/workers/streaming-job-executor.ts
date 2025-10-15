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
  extract_frames: handleExtractFrames,
  sync_connector: syncConnector,
  process_imported_doc: processImportedDocument,
  process_webhook: processWebhook,
};

/**
 * Execute a single job with streaming progress updates
 * This is designed to be called from the streaming reprocess endpoint
 */
export async function executeJobWithStreaming(
  jobId: string,
  recordingId: string,
  maxRetries: number = 3
): Promise<void> {
  const supabase = createAdminClient();

  logger.info('Starting streaming job execution', {
    context: { jobId, recordingId },
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
      context: { jobId, recordingId },
      error: jobError,
    });
    streamingManager.sendError(recordingId, errorMsg);
    throw new Error(errorMsg);
  }

  try {
    logger.info('Executing job handler', {
      context: { jobId, recordingId, jobType: job.type },
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
    streamingManager.sendProgress(recordingId, 'all', 0, `Starting ${job.type}...`, {
      jobId,
      jobType: job.type,
    });

    // Get handler for job type
    const handler = JOB_HANDLERS[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Create streaming progress callback
    const progressCallback: ProgressCallback = (percent, message, data) => {
      logger.debug('Job progress update', {
        context: { jobId, recordingId },
        data: { percent, message },
      });

      // Update database
      updateJobProgress(jobId, recordingId, percent, message, data);
    };

    // Execute handler with progress callback
    logger.info('Calling job handler', {
      context: { jobId, recordingId, jobType: job.type },
    });

    await handler(job, progressCallback);

    logger.info('Job handler completed successfully', {
      context: { jobId, recordingId, jobType: job.type },
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
    streamingManager.sendProgress(recordingId, 'all', 100, `${job.type} completed successfully`, {
      jobId,
      jobType: job.type,
    });

    logger.info('Job completed successfully', {
      context: { jobId, recordingId, jobType: job.type },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Job execution failed', {
      context: { jobId, recordingId },
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
        recordingId,
        `Job failed, scheduling retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`,
        { error: errorMessage }
      );

      logger.info('Job retry scheduled', {
        context: { jobId, recordingId, attemptCount, maxRetries, retryDelay },
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
        recordingId,
        `Job failed after ${maxRetries} attempts: ${errorMessage}`
      );

      logger.error('Job failed permanently', {
        context: { jobId, recordingId, attemptCount, maxRetries },
        error: error as Error,
      });
    }

    throw error;
  }
}

/**
 * Execute multiple jobs sequentially with streaming updates
 * Used for processing entire pipelines (transcribe -> document -> embeddings)
 */
export async function executeJobPipelineWithStreaming(
  jobIds: string[],
  recordingId: string,
  maxRetries: number = 3
): Promise<void> {
  logger.info('Starting job pipeline execution', {
    context: { recordingId, jobCount: jobIds.length },
    data: { jobIds },
  });

  streamingManager.sendLog(
    recordingId,
    `Starting pipeline with ${jobIds.length} jobs`,
    { jobIds }
  );

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i];

    logger.info(`Executing pipeline job ${i + 1}/${jobIds.length}`, {
      context: { recordingId, jobId },
    });

    streamingManager.sendLog(
      recordingId,
      `Processing step ${i + 1}/${jobIds.length}`,
      { jobId }
    );

    try {
      await executeJobWithStreaming(jobId, recordingId, maxRetries);
    } catch (error) {
      logger.error('Pipeline job failed', {
        context: { recordingId, jobId, step: i + 1 },
        error: error as Error,
      });

      // Continue with remaining jobs even if one fails
      // (some jobs like embeddings are non-critical)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      streamingManager.sendLog(
        recordingId,
        `Step ${i + 1} failed: ${errorMsg}, continuing with next step`,
        { jobId, error: errorMsg }
      );
    }
  }

  logger.info('Job pipeline execution completed', {
    context: { recordingId, jobCount: jobIds.length },
  });

  streamingManager.sendComplete(
    recordingId,
    'Pipeline completed',
    { totalJobs: jobIds.length }
  );
}
