/**
 * Streaming-Aware Job Executor
 *
 * Executes jobs inline with real-time streaming updates via SSE.
 * This allows the reprocess streaming endpoint to trigger immediate processing
 * while sending progress updates to connected clients.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type {
  CompressAudioJobPayload,
  CompressVideoJobPayload,
  Database,
  MigrateStorageTierJobPayload,
} from '@/lib/types/database';
import { streamingManager } from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';

import { updateJobProgress, type ProgressCallback } from './job-processor';
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

const logger = createLogger({ service: 'streaming-job-executor' });

type Job = Database['public']['Tables']['jobs']['Row'];
type JobType = Job['type'];
type JobStatus = Job['status'];
type JobPayload = Record<string, unknown> | null;

interface JobHandler {
  (job: Job, progressCallback?: ProgressCallback): Promise<void>;
}

const JOB_HANDLERS: Record<JobType, JobHandler> = {
  transcribe: transcribeRecording,
  doc_generate: generateDocument,
  generate_embeddings: generateEmbeddings,
  generate_summary: generateSummary,
  generate_metadata: handleGenerateMetadata,
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
    const result = await handleCompressVideo(
      job.payload as unknown as CompressVideoJobPayload,
    );
    if (!result.success) {
      throw new Error(result.error || 'Video compression failed');
    }
  },
  compress_audio: async (job: Job) => {
    const result = await handleCompressAudio(
      job.payload as unknown as CompressAudioJobPayload,
    );
    if (!result.success) {
      throw new Error(result.error || 'Audio compression failed');
    }
  },

  // Storage tier migration
  migrate_storage_tier: async (job: Job) => {
    const result = await handleMigrateStorageTier(
      job.payload as unknown as MigrateStorageTierJobPayload,
    );
    if (!result.success) {
      throw new Error(result.error || 'Storage tier migration failed');
    }
  },

  // Deduplication handlers
  deduplicate_file: async (job: Job) => {
    const result = await handleDeduplicateFile(
      job.payload as unknown as DeduplicateFileJobPayload,
    );
    if (!result.success) {
      throw new Error(result.error || 'File deduplication failed');
    }
  },
  batch_deduplicate: async (job: Job) => {
    const result = await handleBatchDeduplicate(
      job.payload as unknown as BatchDeduplicateJobPayload,
    );
    if (!result.success) {
      throw new Error('Batch deduplication failed');
    }
  },

  // Similarity detection handlers
  detect_similarity: async (job: Job) => {
    const result = await handleDetectSimilarity(
      job.payload as unknown as DetectSimilarityJobPayload,
    );
    if (!result.success) {
      throw new Error(result.error || 'Similarity detection failed');
    }
  },
  batch_detect_similarity: async (job: Job) => {
    const result = await handleBatchDetectSimilarity(
      job.payload as unknown as BatchDetectSimilarityJobPayload,
    );
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
  transcribe_segment: transcribeSegment,
  merge_transcripts: mergeTranscripts,

  // Knowledge curation handler
  curate_knowledge: handleCurateKnowledge,

  // Knowledge gap analysis handler
  analyze_knowledge_gaps: handleAnalyzeKnowledgeGaps,

  // Onboarding plan generation handler
  generate_onboarding_plan: handleGenerateOnboardingPlan,

  // Weekly digest generation handler
  generate_weekly_digest: handleGenerateWeeklyDigest,

  // Workflow extraction handler
  workflow_extraction: handleWorkflowExtraction,

  // Compilation Engine (Wave 3 TRIB-31) — new-page path only;
  // contradiction/update path is TRIB-32.
  compile_wiki: handleCompileWiki,

  // Vendor doc ingestion (TRIB-45)
  ingest_vendor_docs: handleIngestVendorDocs,
};

const PIPELINE_JOB_ORDER: JobType[] = [
  'transcribe',
  'doc_generate',
  'generate_embeddings',
  'generate_metadata',
  'workflow_extraction',
  'compile_wiki',
];
const PIPELINE_JOB_TYPES = new Set<JobType>(PIPELINE_JOB_ORDER);

function getPayload(job: Pick<Job, 'payload'>): JobPayload {
  return typeof job.payload === 'object' && job.payload !== null
    ? (job.payload as Record<string, unknown>)
    : null;
}

function hasStringPayloadValue(payload: JobPayload, key: string): boolean {
  return typeof payload?.[key] === 'string' && payload[key].length > 0;
}

async function maybeFillEmbeddingsDocumentId(job: Job): Promise<Job> {
  const payload = getPayload(job);

  if (
    job.type !== 'generate_embeddings' ||
    !payload ||
    hasStringPayloadValue(payload, 'documentId')
  ) {
    return job;
  }

  const recordingId = payload.recordingId;
  const orgId = payload.orgId;
  if (typeof recordingId !== 'string' || recordingId.length === 0) {
    return job;
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('documents')
    .select('id')
    .eq('content_id', recordingId);

  if (typeof orgId === 'string' && orgId.length > 0) {
    query = query.eq('org_id', orgId);
  }

  const { data: document, error } = await query.maybeSingle();
  if (error || !document?.id) {
    return job;
  }

  const nextPayload = {
    ...payload,
    documentId: document.id,
  };

  const { data: updatedJob, error: updateError } = await supabase
    .from('jobs')
    .update({ payload: nextPayload })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (updateError || !updatedJob) {
    logger.warn('Unable to attach document prerequisite to embeddings job', {
      context: { jobId: job.id, recordingId, documentId: document.id },
      error: updateError as Error | undefined,
    });
    return job;
  }

  return updatedJob as Job;
}

function hasPrerequisites(job: Pick<Job, 'type' | 'payload'>): boolean {
  const payload = getPayload(job);

  if (!hasStringPayloadValue(payload, 'recordingId')) {
    return false;
  }

  if (job.type === 'doc_generate') {
    return hasStringPayloadValue(payload, 'transcriptId');
  }

  if (job.type === 'generate_embeddings') {
    return (
      hasStringPayloadValue(payload, 'transcriptId') &&
      hasStringPayloadValue(payload, 'documentId')
    );
  }

  if (job.type === 'compile_wiki') {
    return true;
  }

  return true;
}

function sortPipelineJobs(a: Pick<Job, 'type'>, b: Pick<Job, 'type'>): number {
  const aIndex = PIPELINE_JOB_ORDER.indexOf(a.type);
  const bIndex = PIPELINE_JOB_ORDER.indexOf(b.type);

  return (
    (aIndex === -1 ? PIPELINE_JOB_ORDER.length : aIndex) -
    (bIndex === -1 ? PIPELINE_JOB_ORDER.length : bIndex)
  );
}

export async function findRunnableDependentJobs(
  contentId: string,
  seenJobIds: Set<string>,
): Promise<Job[]> {
  const supabase = createAdminClient();
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('payload->>recordingId', contentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !jobs) {
    logger.warn('Unable to load dependent pipeline jobs', {
      context: { contentId },
      error: error as Error | undefined,
    });
    return [];
  }

  const runnableJobs = (
    await Promise.all(
      (jobs as Job[]).map(async (job): Promise<Job | null> => {
        if (seenJobIds.has(job.id)) return null;
        if (!PIPELINE_JOB_TYPES.has(job.type)) return null;

        const preparedJob = await maybeFillEmbeddingsDocumentId(job);
        return hasPrerequisites(preparedJob) ? preparedJob : null;
      }),
    )
  ).filter((job): job is Job => Boolean(job));

  return runnableJobs.sort(sortPipelineJobs);
}

/**
 * Execute a single job with streaming progress updates
 * This is designed to be called from the streaming reprocess endpoint
 * @param contentId - The content ID (supports both old recordingId and new contentId naming)
 */
export async function executeJobWithStreaming(
  jobId: string,
  contentId: string,
  maxRetries: number = 3,
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

  const currentJob = job as Job;

  try {
    logger.info('Executing job handler', {
      context: { jobId, contentId, jobType: currentJob.type },
    });

    const { data: claimedJob, error: claimError } = await supabase
      .from('jobs')
      .update({
        status: 'processing' as JobStatus,
        started_at: new Date().toISOString(),
        progress_percent: 0,
        progress_message: 'Starting job...',
      })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (claimError) {
      throw new Error(`Failed to claim job: ${claimError.message}`);
    }

    if (!claimedJob) {
      logger.info('Skipping streaming job because it was already claimed', {
        context: { jobId, contentId, currentStatus: currentJob.status },
      });
      streamingManager.sendLog(
        contentId,
        `${currentJob.type} is already running or no longer pending.`,
        { jobId, jobType: currentJob.type, status: currentJob.status },
      );
      return;
    }

    const processingJob = claimedJob as Job;

    // Stream initial progress
    streamingManager.sendProgress(
      contentId,
      'all',
      0,
      `Starting ${currentJob.type}...`,
      {
        jobId,
        jobType: processingJob.type,
      },
    );

    // Get handler for job type
    const handler = JOB_HANDLERS[processingJob.type as JobType];
    if (!handler) {
      throw new Error(`Unknown job type: ${processingJob.type}`);
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
      context: { jobId, contentId, jobType: processingJob.type },
    });

    await handler(processingJob, progressCallback);

    logger.info('Job handler completed successfully', {
      context: { jobId, contentId, jobType: processingJob.type },
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
      .eq('id', jobId)
      .eq('status', 'processing' as JobStatus);

    // Stream completion
    streamingManager.sendProgress(
      contentId,
      'all',
      100,
      `${currentJob.type} completed successfully`,
      {
        jobId,
        jobType: processingJob.type,
      },
    );

    logger.info('Job completed successfully', {
      context: { jobId, contentId, jobType: processingJob.type },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Job execution failed', {
      context: { jobId, contentId },
      error: error as Error,
    });

    const attemptCount = (job.attempts ?? 0) + 1;
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
        .eq('id', jobId)
        .eq('status', 'processing' as JobStatus);

      // Stream retry notification
      streamingManager.sendLog(
        contentId,
        `Job failed, scheduling retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`,
        { error: errorMessage },
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
        .eq('id', jobId)
        .eq('status', 'processing' as JobStatus);

      // Stream error
      streamingManager.sendError(
        contentId,
        `Job failed after ${maxRetries} attempts: ${errorMessage}`,
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
  maxRetries: number = 3,
): Promise<void> {
  logger.info('Starting job pipeline execution', {
    context: { contentId, jobCount: jobIds.length },
    data: { jobIds },
  });

  streamingManager.sendLog(
    contentId,
    `Starting pipeline with ${jobIds.length} jobs`,
    { jobIds },
  );

  const queuedJobIds = [...jobIds];
  const seenJobIds = new Set<string>();

  await Promise.all(
    Array.from(
      { length: Math.max(0, Math.ceil((queuedJobIds.length - 0) / 1)) },
      (_, __loopIndex) => 0 + __loopIndex * 1,
    ).map(async (i) => {
      const totalSteps = queuedJobIds.length;
      const jobId = queuedJobIds[i];
      seenJobIds.add(jobId);

      logger.info(`Executing pipeline job ${i + 1}/${totalSteps}`, {
        context: { contentId, jobId },
      });

      streamingManager.sendLog(
        contentId,
        `Processing step ${i + 1}/${totalSteps}`,
        { jobId },
      );

      try {
        await executeJobWithStreaming(jobId, contentId, maxRetries);

        const dependentJobs = await findRunnableDependentJobs(
          contentId,
          seenJobIds,
        );
        for (const dependentJob of dependentJobs) {
          seenJobIds.add(dependentJob.id);
          queuedJobIds.push(dependentJob.id);
        }
      } catch (error) {
        logger.error('Pipeline job failed', {
          context: { contentId, jobId, step: i + 1 },
          error: error as Error,
        });

        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        streamingManager.sendError(
          contentId,
          `Step ${i + 1} failed: ${errorMsg}`,
          { jobId, error: errorMsg },
        );
        throw error;
      }
    }),
  );

  logger.info('Job pipeline execution completed', {
    context: { contentId, jobCount: queuedJobIds.length },
  });

  streamingManager.sendComplete(contentId, 'Pipeline completed', {
    totalJobs: queuedJobIds.length,
  });
}
