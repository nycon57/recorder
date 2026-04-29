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
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';
import {
  CURRENT_RECORDING_STORAGE_BUCKET,
  LEGACY_RECORDING_STORAGE_BUCKET,
  buildContentRecordingStoragePath,
  buildLegacyRecordingStoragePath,
  findExactStorageObject,
  inferRecordingStorageBucket,
  validateRecordingStoragePath,
} from '@/lib/recordings/storage-contract';
import type {
  ContentType,
  FileType,
} from '@/lib/types/content';
import type { Database, Json } from '@/lib/types/database';

const logger = createLogger({ endpoint: 'finalize-stream' });

type JobType = Database['public']['Tables']['jobs']['Row']['type'];
type ContentRow = Database['public']['Tables']['content']['Row'];

interface FinalizeParams {
  params: Promise<{ id?: string }>;
}

function isValidRecordingId(recordingId: unknown): recordingId is string {
  return typeof recordingId === 'string' && recordingId.trim().length > 0;
}

function metadataObject(metadata: Json | null): { [key: string]: Json | undefined } {
  return typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)
    ? (metadata as { [key: string]: Json | undefined })
    : {};
}

/**
 * GET /api/recordings/[id]/finalize/stream
 * Finalizes upload and optionally starts processing with SSE streaming
 */
export const GET = apiHandler(
  async (request: NextRequest, context: FinalizeParams) => {
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const { id: recordingId } = await context.params;

    if (!isValidRecordingId(recordingId)) {
      return new Response(
        JSON.stringify({ message: 'Recording ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

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
      .select('id, org_id, status, title, storage_path_raw, metadata, content_type, file_type')
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
      context: {
        recordingId,
        orgId,
        title: recording.title,
        status: recording.status,
      },
    });

    const existingMetadata = metadataObject(recording.metadata);

    // Construct and validate expected storage path before any storage lookup or stream setup.
    const contentType = recording.content_type as ContentType | null;
    const fileType = recording.file_type as FileType | null;
    const storagePath =
      recording.storage_path_raw ||
      (contentType && fileType
        ? buildContentRecordingStoragePath(
            orgId,
            contentType,
            recordingId,
            fileType,
          )
        : buildLegacyRecordingStoragePath(orgId, recordingId));

    const storageBucket = recording.storage_path_raw
      ? inferRecordingStorageBucket({
          storagePath,
          storageBucket: existingMetadata.storageBucket,
          orgId,
          recordingId,
        })
      : contentType && fileType
        ? CURRENT_RECORDING_STORAGE_BUCKET
        : LEGACY_RECORDING_STORAGE_BUCKET;

    const storageValidation = validateRecordingStoragePath({
      storagePath,
      bucket: storageBucket,
      orgId,
      recordingId,
      contentType,
      fileType,
      allowLegacyRecordingsBucket: true,
    });

    if (!storageValidation.valid) {
      return new Response(
        JSON.stringify({
          message: storageValidation.message,
          details: storageValidation.details,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Verify the file exists in storage
    logger.info('Verifying file exists in storage', {
      context: {
        recordingId,
        storagePath: storageValidation.storagePath,
        storageBucket: storageValidation.bucket,
      },
    });

    const fileData = await findExactStorageObject(
      supabaseAdmin,
      storageValidation.bucket,
      storageValidation.storagePath,
    );

    if (!fileData.exists) {
      logger.error('File not found in storage', {
        context: {
          recordingId,
          storagePath: storageValidation.storagePath,
          storageBucket: storageValidation.bucket,
        },
        error: fileData.error as Error | undefined,
      });
      throw new Error(
        'File not found in storage. Please ensure the recording was uploaded successfully.',
      );
    }

    const file = fileData.object;

    logger.info('File found in storage', {
      context: {
        recordingId,
        fileName: file?.name,
        fileSize: file?.metadata?.size,
      },
    });
    const storageObjectSize = file?.metadata?.size;
    if (typeof storageObjectSize !== 'number') {
      logger.warn('Storage object size missing; recording metadata will use zero bytes', {
        context: {
          recordingId,
          storagePath: storageValidation.storagePath,
          storageBucket: storageValidation.bucket,
        },
      });
    }
    const sizeBytes =
      typeof storageObjectSize === 'number' ? storageObjectSize : 0;

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
      },
    );

    // Update recording status and metadata
    const newStatus = startProcessing
      ? (getQueuedSourceStatusForJob('transcribe') ?? SOURCE_STATUS.UPLOADED)
      : SOURCE_STATUS.UPLOADED;

    logger.info('Updating recording status', {
      context: { recordingId, oldStatus: recording.status, newStatus },
    });

    const { data: updatedRecording, error: updateError } = await supabaseAdmin
      .from('content')
      .update({
        storage_path_raw: storageValidation.storagePath,
        status: newStatus,
        error_message: null, // Clear any previous errors
        metadata: {
          ...existingMetadata,
          sizeBytes,
          uploadedAt: new Date().toISOString(),
          storageBucket: storageValidation.bucket,
        } satisfies { [key: string]: Json | undefined },
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
        'Failed to finalize recording. Please try again.',
      );
      throw new Error('Failed to finalize recording');
    }
    const finalizedRecording = updatedRecording as ContentRow;

    logger.info('Recording updated successfully', {
      context: { recordingId, status: finalizedRecording.status },
    });

    streamingManager.sendLog(
      recordingId,
      `Upload finalized. Status: ${newStatus}`,
      {
        recordingId,
        status: newStatus,
        fileSize: sizeBytes,
      },
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
        },
      );

      return createSSEResponse(stream);
    }

    // Create only the first processing job. The worker handlers enqueue dependent
    // jobs after prerequisite transcript/document rows exist.
    logger.info('Creating processing jobs', {
      context: { recordingId, orgId },
    });

    const transcribeJob = {
      type: 'transcribe' as JobType,
      status: 'pending' as const,
      payload: {
        recordingId,
        orgId,
        storagePath: storageValidation.storagePath,
        storageBucket: storageValidation.bucket,
        contentType: recording.content_type,
        fileType: recording.file_type,
      } satisfies { [key: string]: Json | undefined },
      attempts: 0,
      max_attempts: 3,
      run_at: new Date().toISOString(),
      dedupe_key: `transcribe:${recordingId}`,
    };

    logger.info('Job configurations prepared', {
      context: { recordingId },
      data: { jobCount: 1, jobTypes: [transcribeJob.type] },
    });

    streamingManager.sendLog(recordingId, 'Creating processing pipeline...', {
      jobTypes: [transcribeJob.type],
    });

    // Create jobs in database
    const { data: createdJob, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert(transcribeJob)
      .select('id, type, status, payload')
      .single();

    let createdJobs = createdJob ? [createdJob] : null;

    if (jobError) {
      const { data: existingJob, error: existingJobError } = await supabaseAdmin
        .from('jobs')
        .select('id, type, status, payload')
        .eq('dedupe_key', transcribeJob.dedupe_key)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingJobError || !existingJob) {
        logger.error('Failed to create or reuse processing job', {
          context: { recordingId, orgId, requestId },
          error: jobError as Error | undefined,
        });

        streamingManager.sendError(
          recordingId,
          'Failed to create processing jobs. Please try reprocessing from the recordings list.',
        );

        throw new Error('Failed to create processing jobs');
      }

      createdJobs = [existingJob];
    }
    logger.info('Jobs created successfully', {
      context: { recordingId, orgId },
      data: { jobCount: createdJobs.length, jobs: createdJobs },
    });

    streamingManager.sendLog(
      recordingId,
      `Processing pipeline created: ${createdJobs.length} jobs queued`,
      {
        jobs: createdJobs.map((j) => ({ id: j.id, type: j.type })),
      },
    );

    const runnableJobs = createdJobs.filter((job) => job.status === 'pending');

    if (runnableJobs.length === 0) {
      logger.info('Processing job already active; skipping duplicate execution', {
        context: { recordingId, orgId },
        data: { jobs: createdJobs },
      });

      streamingManager.sendLog(
        recordingId,
        'Processing is already running for this recording.',
        {
          jobs: createdJobs.map((j) => ({
            id: j.id,
            type: j.type,
            status: j.status,
          })),
        },
      );

      return createSSEResponse(stream);
    }

    streamingManager.sendProgress(
      recordingId,
      'all',
      0,
      'Starting processing pipeline...',
      {
        totalSteps: createdJobs.length,
        currentStep: 0,
      },
    );

    // Execute jobs inline with streaming (don't await - let it run in background)
    // Import the streaming executor
    const { executeJobPipelineWithStreaming } = await import(
      '@/lib/workers/streaming-job-executor'
    );

    logger.info('Starting inline job execution', {
      context: { recordingId },
      data: { jobIds: runnableJobs.map((j) => j.id) },
    });

    // Execute pipeline asynchronously (don't block SSE response)
    executeJobPipelineWithStreaming(
      runnableJobs.map((j) => j.id),
      recordingId,
      3,
    ).catch((error) => {
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
  },
);

/**
 * POST /api/recordings/[id]/finalize/stream
 * Alternative endpoint that accepts POST with JSON body (for backward compatibility)
 */
export const POST = apiHandler(
  async (request: NextRequest, context: FinalizeParams) => {
    const requestId = request.headers.get('x-request-id') || 'unknown';
    const { id: recordingId } = await context.params;

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
  },
);
