/**
 * Background Job Processor
 *
 * Polls the jobs table for pending jobs and executes them with retry logic.
 * This is designed to run as a separate process or serverless function.
 */

import { getHeapStatistics } from 'node:v8';

import { streamingManager } from '@/lib/services/streaming-processor';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type {
  CompressAudioJobPayload,
  CompressVideoJobPayload,
  Database,
  Json,
  MigrateStorageTierJobPayload,
} from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

import { claimJobById, claimPendingJobs, type Job } from './job-claiming';
import { handleArchiveSearchMetrics } from './handlers/archive-search-metrics';
import { handleAnalyzeKnowledgeGaps } from './handlers/analyze-knowledge-gaps';
import { handleCollectMetrics } from './handlers/collect-metrics';
import { handleCompileWiki } from './handlers/compile-wiki';
import { handleCompressAudio } from './handlers/compress-audio';
import { handleCompressVideo } from './handlers/compress-video';
import { handleCurateKnowledge } from './handlers/curate-knowledge';
import {
  handleBatchDeduplicate,
  type BatchDeduplicateJobPayload,
  type DeduplicateFileJobPayload,
  handleDeduplicateFile,
} from './handlers/deduplicate-file';
import {
  handleBatchDetectSimilarity,
  type BatchDetectSimilarityJobPayload,
  type DetectSimilarityJobPayload,
  handleDetectSimilarity,
} from './handlers/detect-similarity';
import { generateDocument } from './handlers/docify-google';
import { generateEmbeddings } from './handlers/embeddings-google';
import { handleExtractAudio } from './handlers/extract-audio';
import { handleExtractFrames } from './handlers/extract-frames';
import { handleExtractTextDocx } from './handlers/extract-text-docx';
import { handleExtractTextPdf } from './handlers/extract-text-pdf';
import { generateSummary } from './handlers/generate-summary';
import { handleGenerateAlerts } from './handlers/generate-alerts';
import { handleGenerateMetadata } from './handlers/generate-metadata';
import { handleGenerateOnboardingPlan } from './handlers/generate-onboarding-plan';
import { handleGenerateRecommendations } from './handlers/generate-recommendations';
import { handleGenerateWeeklyDigest } from './handlers/generate-weekly-digest';
import { handleIngestVendorDocs } from './handlers/ingest-vendor-docs';
import { mergeTranscripts } from './handlers/merge-transcripts';
import { handleMigrateStorageTier } from './handlers/migrate-storage-tier';
import { handlePerformHealthCheck } from './handlers/perform-health-check';
import { handleProcessTextNote } from './handlers/process-text-note';
import { processImportedDocument } from './handlers/process-imported-doc';
import { handlePublishDocument } from './handlers/publish-document';
import { processWebhook } from './handlers/process-webhook';
import { syncConnector } from './handlers/sync-connector';
import { transcribeRecording } from './handlers/transcribe-gemini-video';
import { transcribeSegment } from './handlers/transcribe-segment';
import { handleWorkflowExtraction } from './handlers/workflow-extraction';

const processorLogger = createLogger({ service: 'job-processor' });

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

interface JobHandler {
  (job: Job, progressCallback?: ProgressCallback): Promise<void>;
}

export interface ProgressCallback {
  (percent: number, message: string, data?: Json): void;
}

type JobPayloadWithIds = {
  contentId?: string;
  recordingId?: string;
};

class JobTimeoutError extends Error {
  constructor(timeoutMs: number, jobId: string, jobType: string) {
    super(
      `Job timeout exceeded (${Math.round(timeoutMs / 60000)} minutes). ` +
        `Job ID: ${jobId}, Type: ${jobType}. ` +
        'This may indicate the content is too large to process. Consider reducing file size or duration.',
    );
    this.name = 'JobTimeoutError';
  }
}

function isJobTimeoutError(error: unknown): error is JobTimeoutError {
  return error instanceof JobTimeoutError;
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
    'generate_metadata': 'Metadata generated successfully',
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
  data?: Json
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

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  transcribe: transcribeRecording,
  doc_generate: generateDocument,
  generate_embeddings: generateEmbeddings,
  generate_summary: generateSummary,
  generate_metadata: handleGenerateMetadata,
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
    const result = await handleCompressVideo(job.payload as unknown as CompressVideoJobPayload);
    if (!result.success) {
      throw new Error(result.error || 'Video compression failed');
    }
  },
  compress_audio: async (job: Job) => {
    const result = await handleCompressAudio(job.payload as unknown as CompressAudioJobPayload);
    if (!result.success) {
      throw new Error(result.error || 'Audio compression failed');
    }
  },

  // Storage tier migration
  migrate_storage_tier: async (job: Job) => {
    const result = await handleMigrateStorageTier(job.payload as unknown as MigrateStorageTierJobPayload);
    if (!result.success) {
      throw new Error(result.error || 'Storage tier migration failed');
    }
  },

  // Deduplication handlers
  deduplicate_file: async (job: Job) => {
    const result = await handleDeduplicateFile(job.payload as unknown as DeduplicateFileJobPayload);
    if (!result.success) {
      throw new Error(result.error || 'File deduplication failed');
    }
  },
  batch_deduplicate: async (job: Job) => {
    const result = await handleBatchDeduplicate(job.payload as unknown as BatchDeduplicateJobPayload);
    if (!result.success) {
      throw new Error('Batch deduplication failed');
    }
  },

  // Similarity detection handlers
  detect_similarity: async (job: Job) => {
    const result = await handleDetectSimilarity(job.payload as unknown as DetectSimilarityJobPayload);
    if (!result.success) {
      throw new Error(result.error || 'Similarity detection failed');
    }
  },
  batch_detect_similarity: async (job: Job) => {
    const result = await handleBatchDetectSimilarity(job.payload as unknown as BatchDetectSimilarityJobPayload);
    if (!result.success) {
      throw new Error('Batch similarity detection failed');
    }
  },

  // Analytics and monitoring handlers
  collect_metrics: handleCollectMetrics,
  generate_alerts: handleGenerateAlerts,
  generate_recommendations: handleGenerateRecommendations,
  perform_health_check: handlePerformHealthCheck,
  archive_search_metrics: handleArchiveSearchMetrics,

  // Publishing handlers
  publish_document: handlePublishDocument,

  // Long video segmentation handlers
  transcribe_segment: transcribeSegment, // Transcribe a single video segment
  merge_transcripts: mergeTranscripts, // Merge segment transcripts into final transcript

  // Knowledge curation handler
  curate_knowledge: handleCurateKnowledge, // Knowledge Curator Agent

  // Knowledge gap analysis handler
  analyze_knowledge_gaps: handleAnalyzeKnowledgeGaps, // Gap Intelligence Agent

  // Onboarding plan generation handler
  generate_onboarding_plan: handleGenerateOnboardingPlan, // Onboarding Agent

  // Weekly digest generation handler
  generate_weekly_digest: handleGenerateWeeklyDigest, // Digest Agent

  // Workflow extraction handler
  workflow_extraction: handleWorkflowExtraction, // Workflow Extraction Agent

  // Compilation Engine (Wave 3 TRIB-31) — new-page path only;
  // contradiction/update path is TRIB-32.
  compile_wiki: handleCompileWiki,

  // Vendor doc ingestion (TRIB-45)
  ingest_vendor_docs: handleIngestVendorDocs,
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
  // Maximum job execution time (4 hours default)
  // This prevents long-running jobs from blocking the worker indefinitely
  jobTimeoutMs: parseIntWithDefault(process.env.JOB_TIMEOUT_MS, 4 * 60 * 60 * 1000),
  // Memory warning threshold (default: 80% of heap limit)
  memoryWarningThreshold: parseIntWithDefault(process.env.JOB_MEMORY_WARNING_PERCENT, 80),
};

/**
 * Get current memory usage statistics
 * @returns Memory usage in MB with heap statistics
 */
function getMemoryUsage(): {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  heapPercentUsed: number;
  v8HeapLimitMB: number;
} {
  const memoryUsage = process.memoryUsage();
  const heapStats = getHeapStatistics();

  return {
    heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
    heapPercentUsed: Math.round((memoryUsage.heapUsed / heapStats.heap_size_limit) * 100),
    v8HeapLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
  };
}

/**
 * Log memory usage with optional warning for high usage
 * @param context - Description of when this is being logged
 * @param jobId - Optional job ID for context
 * @param jobType - Optional job type for context
 */
function logMemoryUsage(
  context: string,
  jobId?: string,
  jobType?: string
): void {
  const memory = getMemoryUsage();
  const isHighUsage = memory.heapPercentUsed >= CONFIG.memoryWarningThreshold;

  const logData = {
    context: context,
    heapUsedMB: memory.heapUsedMB,
    heapTotalMB: memory.heapTotalMB,
    rssMB: memory.rssMB,
    heapPercent: memory.heapPercentUsed,
    heapLimitMB: memory.v8HeapLimitMB,
    ...(jobId && { jobId }),
    ...(jobType && { jobType }),
  };

  if (isHighUsage) {
    processorLogger.warn(`[Memory] HIGH USAGE: ${context}`, {
      context: { ...logData, warning: 'Consider increasing Node.js memory limit or optimizing job handlers' },
    });

    // Suggest garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      processorLogger.info('[Memory] Triggering garbage collection due to high memory usage');
      global.gc();
    }
  } else {
    processorLogger.debug(`[Memory] ${context}`, {
      context: logData,
    });
  }
}

/**
 * Execute a function with a timeout
 * @throws Error if the function exceeds the timeout
 */
async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  jobId: string,
  jobType: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new JobTimeoutError(timeoutMs, jobId, jobType));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

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
  console.log(`[Job Processor] Job timeout: ${Math.round(CONFIG.jobTimeoutMs / 60000)} minutes, Max retries: ${maxRetries}`);

  // Log initial memory state
  const initialMemory = getMemoryUsage();
  console.log(`[Job Processor] Initial memory: ${initialMemory.heapUsedMB}MB used / ${initialMemory.v8HeapLimitMB}MB limit (${initialMemory.heapPercentUsed}%)`);

  // Exponential backoff state
  let currentPollInterval = pollInterval;
  let consecutiveEmptyPolls = 0;

  // Main processing loop
  while (true) {
    try {
      // PERF-DB-002: Claim pending jobs with content data (eliminates N+1 queries)
      // PERF-WK-001: RPC preserves priority/run_at/created_at ordering while claiming atomically.
      const { jobs, error } = await claimPendingJobs(supabase, batchSize);

      if (error) {
        console.error('[Job Processor] Error claiming jobs:', error);
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

      console.log(`[Job Processor] Claimed ${jobs.length} pending jobs`);

      // Process jobs in parallel
      await Promise.allSettled(
        jobs.map(job => processClaimedJob(job, maxRetries))
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
async function processClaimedJob(job: Job, maxRetries: number): Promise<void> {
  const supabase = createAdminClient();
  // Support both old (recordingId) and new (contentId) payload formats for backward compatibility
  const payloadWithIds = job.payload as JobPayloadWithIds | null;
  const contentId = payloadWithIds?.contentId || payloadWithIds?.recordingId;
  const jobStartTime = Date.now();

  // Log memory at job start (for memory-intensive jobs like transcribe)
  logMemoryUsage('Before job execution', job.id, job.type);

  try {
    processorLogger.info('Processing job', {
      context: { jobId: job.id, contentId, jobType: job.type },
    });

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

    // Execute handler with progress callback and timeout protection
    // This prevents long-running jobs from blocking the worker indefinitely
    await withTimeout(
      () => handler(job, progressCallback),
      CONFIG.jobTimeoutMs,
      job.id,
      job.type
    );

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
      .eq('id', job.id)
      .eq('status', 'processing' as JobStatus);

    // Stream completion
    if (contentId) {
      streamingManager.sendProgress(contentId, 'all', 100, 'Job completed successfully', {
        jobId: job.id,
        jobType: job.type,
      });
    }

    const jobDuration = Date.now() - jobStartTime;

    // Log memory after job completion
    logMemoryUsage('After job execution', job.id, job.type);

    processorLogger.info('Job completed successfully', {
      context: {
        jobId: job.id,
        contentId,
        durationMs: jobDuration,
        durationSec: Math.round(jobDuration / 1000),
      },
    });

  } catch (error) {
    processorLogger.error('Job processing failed', {
      context: { jobId: job.id, contentId },
      error: error as Error,
    });

    const attemptCount = (job.attempts ?? 0) + 1;
    const timedOut = isJobTimeoutError(error);
    const shouldRetry = !timedOut && attemptCount < maxRetries;
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
        .eq('id', job.id)
        .eq('status', 'processing' as JobStatus);

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
      const isDeadLetter =
        !timedOut && attemptCount >= CONFIG.deadLetterAfterRetries;
      const finalStatus = isDeadLetter ? 'dead_letter' : 'failed';

      await supabase
        .from('jobs')
        .update({
          status: finalStatus as JobStatus,
          attempts: attemptCount,
          error: errorMessage,
          progress_percent: null,
          progress_message: timedOut
            ? 'Timed out; retry disabled because the original handler may still be running'
            : isDeadLetter
              ? 'Moved to dead letter queue'
              : 'Failed',
        })
        .eq('id', job.id)
        .eq('status', 'processing' as JobStatus);

      // Stream error
      if (contentId) {
        streamingManager.sendError(
          contentId,
          isDeadLetter
            ? `Job moved to dead letter queue after ${attemptCount} attempts: ${errorMessage}`
            : timedOut
              ? `Job timed out and will not be retried automatically: ${errorMessage}`
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

  const { job, error } = await claimJobById(supabase, jobId);

  if (error) {
    throw new Error(`Failed to claim job ${jobId}: ${error.message}`);
  }

  if (!job) {
    throw new Error(`Job not claimable: ${jobId}`);
  }

  await processClaimedJob(job, 3);
}

/**
 * Utility: Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
