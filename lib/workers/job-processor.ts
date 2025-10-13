/**
 * Background Job Processor
 *
 * Polls the jobs table for pending jobs and executes them with retry logic.
 * This is designed to run as a separate process or serverless function.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

// GEMINI VIDEO MODE: Using Gemini for video understanding, doc generation, and embeddings
import { transcribeRecording } from './handlers/transcribe-gemini-video';
import { generateDocument } from './handlers/docify-google';
import { generateEmbeddings } from './handlers/embeddings-google';
import { generateSummary } from './handlers/generate-summary';
import { handleExtractFrames } from './handlers/extract-frames';
import { syncConnector } from './handlers/sync-connector';
import { processImportedDocument } from './handlers/process-imported-doc';
import { processWebhook } from './handlers/process-webhook';

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
  (job: Job): Promise<void>;
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

  try {
    console.log(`[Job ${job.id}] Processing job type: ${job.type}`);

    // Mark job as processing
    await supabase
      .from('jobs')
      .update({
        status: 'processing' as JobStatus,
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Get handler for job type
    const handler = JOB_HANDLERS[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Execute handler
    await handler(job);

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed' as JobStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`[Job ${job.id}] Completed successfully`);

  } catch (error) {
    console.error(`[Job ${job.id}] Error:`, error);

    const attemptCount = job.attempts + 1;
    const shouldRetry = attemptCount < maxRetries;

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
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', job.id);

      console.log(`[Job ${job.id}] Scheduled retry ${attemptCount}/${maxRetries} in ${retryDelay}ms`);
    } else {
      // Mark as failed
      await supabase
        .from('jobs')
        .update({
          status: 'failed' as JobStatus,
          attempts: attemptCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', job.id);

      console.log(`[Job ${job.id}] Failed after ${maxRetries} attempts`);
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
