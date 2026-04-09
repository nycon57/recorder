/**
 * Streaming Finalize Endpoint
 *
 * GET /api/recordings/[id]/finalize/stream?startProcessing=true
 *
 * Finalizes a recording upload and optionally starts processing with Server-Sent Events (SSE)
 * for real-time progress feedback. This provides users with immediate visibility into the
 * processing pipeline as soon as they save a new recording.
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  createSSEStream,
  createSSEResponse,
  streamingManager,
} from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';
import type { Database } from '@/lib/types/database';

const logger = createLogger({ endpoint: 'finalize-stream' });

type JobType = Database['public']['Tables']['jobs']['Row']['type'];

interface FinalizeParams {
  params: { id: string };
}

/**
 * GET /api/recordings/[id]/finalize/stream
 * Finalizes upload and optionally starts processing with SSE streaming
 */
export const GET = apiHandler(async (request: NextRequest, context: FinalizeParams) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const recordingId = context.params.id;

  logger.info('Streaming finalize request initiated', {
    context: { recordingId, requestId },
  });

  // Authenticate and get org context
  const { orgId, userId } = await requireOrg();

  logger.info('Authentication successful', {
    context: { recordingId, orgId, userId, requestId },
  });

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const startProcessing = searchParams.get('startProcessing') === 'true';

  logger.info('Query parameters parsed', {
    context: { recordingId, startProcessing },
  });

  // Verify recording exists and belongs to org
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from('content')
    .select('id, org_id, status, title, storage_path_raw')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    logger.warn('Recording not found or access denied', {
      context: { recordingId, orgId, requestId },
      error: recordingError,
    });
    throw new Error('Recording not found');
  }

  logger.info('Recording found', {
    context: { recordingId, orgId, title: recording.title, status: recording.status },
  });

  // Construct expected storage path
  const storagePath = recording.storage_path_raw || `org_${orgId}/recordings/${recordingId}/raw.webm`;

  // Verify the file exists in storage
  logger.info('Verifying file exists in storage', {
    context: { recordingId, storagePath },
  });

  const { data: fileData, error: fileError } = await supabaseAdmin.storage
    .from('content')
    .list(`org_${orgId}/recordings/${recordingId}`);

  if (fileError || !fileData || fileData.length === 0) {
    logger.error('File not found in storage', {
      context: { recordingId, storagePath },
      error: fileError as Error | undefined,
    });
    throw new Error('File not found in storage. Please ensure the recording was uploaded successfully.');
  }

  // Get file info
  const file = fileData.find(f => f.name === 'raw.webm');
  if (!file) {
    logger.error('raw.webm file not found', {
      context: { recordingId, availableFiles: fileData.map(f => f.name) },
    });
    throw new Error('raw.webm file not found in storage');
  }

  logger.info('File found in storage', {
    context: { recordingId, fileName: file.name, fileSize: file.metadata?.size },
  });

  // Create SSE stream before any processing starts
  const stream = createSSEStream(recordingId);

  logger.info('SSE stream created', {
    context: { recordingId },
  });

  // Send initial connection message
  streamingManager.sendLog(
    recordingId,
    'Connection established. Finalizing upload...',
    {
      recordingId,
      recordingTitle: recording.title,
      startProcessing,
    }
  );

  // Update recording status and metadata
  const newStatus = startProcessing ? 'transcribing' : 'uploaded';

  logger.info('Updating recording status', {
    context: { recordingId, oldStatus: recording.status, newStatus },
  });

  const { data: updatedRecording, error: updateError } = await supabaseAdmin
    .from('content')
    .update({
      storage_path_raw: storagePath,
      status: newStatus,
      error_message: null, // Clear any previous errors
      metadata: {
        sizeBytes: file.metadata?.size || 0,
        uploadedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateError || !updatedRecording) {
    logger.error('Failed to update recording', {
      context: { recordingId, orgId },
      error: updateError as Error | undefined,
    });
    streamingManager.sendError(
      recordingId,
      'Failed to finalize recording. Please try again.'
    );
    throw new Error('Failed to finalize recording');
  }

  logger.info('Recording updated successfully', {
    context: { recordingId, status: updatedRecording.status },
  });

  streamingManager.sendLog(
    recordingId,
    `Upload finalized. Status: ${newStatus}`,
    {
      recordingId,
      status: newStatus,
      fileSize: file.metadata?.size || 0,
    }
  );

  // If not starting processing, complete immediately
  if (!startProcessing) {
    logger.info('Finalization complete (no processing)', {
      context: { recordingId },
    });

    streamingManager.sendComplete(
      recordingId,
      'Recording saved successfully. You can start processing from the recordings list.',
      {
        recordingId,
        status: 'uploaded',
      }
    );

    return createSSEResponse(stream);
  }

  // Create processing jobs for the full pipeline
  logger.info('Creating processing jobs', {
    context: { recordingId, orgId },
  });

  const jobTypes: JobType[] = ['transcribe', 'doc_generate', 'generate_embeddings'];

  // Prepare job payloads with all necessary data
  const jobs = jobTypes.map(type => {
    const payload: Record<string, unknown> = { recordingId, orgId };

    // Add type-specific payload data
    if (type === 'transcribe') {
      payload.storagePath = storagePath;
    }

    return {
      type,
      status: 'pending' as const,
      payload,
      attempts: 0,
      max_attempts: 3,
      run_at: new Date().toISOString(),
    };
  });

  logger.info('Job configurations prepared', {
    context: { recordingId },
    data: { jobCount: jobs.length, jobTypes },
  });

  streamingManager.sendLog(
    recordingId,
    'Creating processing pipeline...',
    { jobTypes }
  );

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

    streamingManager.sendError(
      recordingId,
      'Failed to create processing jobs. Please try reprocessing from the recordings list.'
    );

    throw new Error('Failed to create processing jobs');
  }

  logger.info('Jobs created successfully', {
    context: { recordingId, orgId },
    data: { jobCount: createdJobs.length, jobs: createdJobs },
  });

  streamingManager.sendLog(
    recordingId,
    `Processing pipeline created: ${createdJobs.length} jobs queued`,
    {
      jobs: createdJobs.map(j => ({ id: j.id, type: j.type })),
    }
  );

  streamingManager.sendProgress(
    recordingId,
    'all',
    0,
    'Starting processing pipeline...',
    {
      totalSteps: createdJobs.length,
      currentStep: 0,
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

    // Error will be sent via SSE by the executor
    // We don't need to close the stream here as the executor handles it
  });

  logger.info('SSE response ready to send', {
    context: { recordingId, orgId, requestId },
  });

  // Return SSE response immediately (stream will remain open for updates)
  return createSSEResponse(stream);
});

/**
 * POST /api/recordings/[id]/finalize/stream
 * Alternative endpoint that accepts POST with JSON body (for backward compatibility)
 */
export const POST = apiHandler(async (request: NextRequest, context: FinalizeParams) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const recordingId = context.params.id;

  logger.info('POST streaming finalize request initiated', {
    context: { recordingId, requestId },
  });

  // Parse body parameters
  let body: { startProcessing?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional, default to startProcessing=true
    body = { startProcessing: true };
  }
  const { startProcessing = true } = body;

  // Create a new URL with the startProcessing query parameter
  const url = new URL(request.url);
  url.searchParams.set('startProcessing', String(startProcessing));

  // Create a new request with GET method and updated URL
  const getRequest = new NextRequest(url, {
    method: 'GET',
    headers: request.headers,
  });

  // Delegate to GET handler
  logger.info('Delegating to GET handler', {
    context: { recordingId, startProcessing },
  });

  return GET(getRequest, context);
});
