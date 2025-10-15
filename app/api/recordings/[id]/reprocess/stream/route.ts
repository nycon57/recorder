/**
 * Streaming Reprocess Endpoint
 *
 * POST /api/recordings/[id]/reprocess/stream
 *
 * Initiates reprocessing of a recording with Server-Sent Events (SSE) for real-time progress.
 * Supports selective reprocessing of transcription, document generation, and embeddings.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, parseBody, errors } from '@/lib/utils/api';
import { reprocessRecordingSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSSEStream, createSSEResponse, streamingManager } from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';
import type { Database } from '@/lib/types/database';

const logger = createLogger({ endpoint: 'reprocess-stream' });

type JobType = Database['public']['Tables']['jobs']['Row']['type'];

interface ReprocessParams {
  params: { id: string };
}

/**
 * POST /api/recordings/[id]/reprocess/stream
 * Initiates reprocessing with SSE streaming and inline job execution
 */
export const POST = apiHandler(async (request: NextRequest, context: ReprocessParams) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const recordingId = context.params.id;

  logger.info('Streaming reprocess request initiated', {
    context: { recordingId, requestId },
  });

  // Authenticate and get org context
  const { orgId, userId } = await requireOrg();

  logger.info('Authentication successful', {
    context: { recordingId, orgId, userId, requestId },
  });

  // Validate request body
  const body = await parseBody(request, reprocessRecordingSchema);
  const { step } = body;

  logger.info('Request body validated', {
    context: { recordingId, step },
  });

  // Verify recording exists and belongs to org
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from('recordings')
    .select('id, org_id, status, title, storage_path')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    logger.warn('Recording not found or access denied', {
      context: { recordingId, orgId, requestId },
    });
    throw new Error('Recording not found');
  }

  logger.info('Recording found', {
    context: { recordingId, orgId, title: recording.title },
  });

  // Determine which jobs to create based on step
  const jobTypes: JobType[] = [];

  if (step === 'all' || step === 'transcribe') {
    jobTypes.push('transcribe', 'doc_generate', 'generate_embeddings');
  } else if (step === 'document') {
    jobTypes.push('doc_generate', 'generate_embeddings');
  } else if (step === 'embeddings') {
    jobTypes.push('generate_embeddings');
  }

  logger.info('Job types determined', {
    context: { recordingId, step },
    data: { jobTypes },
  });

  // Prepare job payloads with all necessary data
  const jobs = jobTypes.map(type => {
    let payload: any = { recordingId, orgId };

    // Add type-specific payload data
    if (type === 'transcribe') {
      payload.storagePath = recording.storage_path;
    }

    return {
      type,
      status: 'pending' as const,
      payload,
      attempts: 0,
      max_attempts: 3,
    };
  });

  // Create jobs in database
  const { data: createdJobs, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert(jobs)
    .select('id, type, payload');

  if (jobError || !createdJobs) {
    logger.error('Failed to create jobs', {
      context: { recordingId, orgId, requestId },
      error: jobError,
    });
    throw new Error('Failed to create reprocessing jobs');
  }

  logger.info('Jobs created successfully', {
    context: { recordingId, orgId },
    data: { jobCount: createdJobs.length, jobs: createdJobs },
  });

  // Update recording status to processing
  await supabaseAdmin
    .from('recordings')
    .update({
      status: 'transcribing',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordingId);

  logger.info('Recording status updated', {
    context: { recordingId, status: 'transcribing' },
  });

  // Create SSE stream
  const stream = createSSEStream(recordingId);

  logger.info('SSE stream created', {
    context: { recordingId },
  });

  // Send initial message
  streamingManager.sendLog(
    recordingId,
    `Reprocessing started: ${step} (${createdJobs.length} jobs created)`,
    {
      step,
      jobs: createdJobs.map(j => ({ id: j.id, type: j.type })),
      recordingTitle: recording.title,
    }
  );

  // Execute jobs inline with streaming (don't await - let it run in background)
  // Import the streaming executor
  const { executeJobPipelineWithStreaming } = await import('@/lib/workers/streaming-job-executor');

  logger.info('Starting inline job execution', {
    context: { recordingId },
    data: { jobIds: createdJobs.map(j => j.id) },
  });

  // Execute pipeline asynchronously (don't block SSE response)
  executeJobPipelineWithStreaming(
    createdJobs.map(j => j.id),
    recordingId,
    3
  ).catch(error => {
    logger.error('Job pipeline execution failed', {
      context: { recordingId },
      error: error as Error,
    });
  });

  logger.info('SSE response ready to send', {
    context: { recordingId, orgId, requestId },
  });

  // Return SSE response immediately
  return createSSEResponse(stream);
});

/**
 * GET /api/recordings/[id]/reprocess/stream
 * Get current reprocessing status (for checking if stream is still active)
 */
export const GET = apiHandler(async (request: NextRequest, context: ReprocessParams) => {
  const recordingId = context.params.id;

  // Authenticate and get org context
  const { orgId } = await requireOrg();

  // Verify recording exists and belongs to org
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from('recordings')
    .select('id, org_id, status')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw new Error('Recording not found');
  }

  // Check for active jobs
  const { data: activeJobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, type, status, progress_percent, progress_message, created_at')
    .eq('payload->>recordingId', recordingId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  if (jobsError) {
    throw new Error('Failed to fetch job status');
  }

  // Check if there's an active stream
  const isStreaming = streamingManager.isConnected(recordingId);

  return new Response(
    JSON.stringify({
      data: {
        recordingId,
        status: recording.status,
        isStreaming,
        activeJobs: activeJobs || [],
        totalActiveJobs: activeJobs?.length || 0,
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
