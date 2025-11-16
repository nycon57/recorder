/**
 * Upload Progress Streaming Endpoint
 *
 * GET /api/recordings/[id]/upload/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time upload and processing progress.
 * Streams progress updates for all jobs associated with a recording.
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSSEStream, createSSEResponse, streamingManager } from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ endpoint: 'upload-stream' });

interface StreamParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/[id]/upload/stream
 * Stream real-time progress updates for upload and processing
 */
export const GET = apiHandler(async (request: NextRequest, context: StreamParams) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const { id: recordingId } = await context.params;

  logger.info('Upload stream request initiated', {
    context: { recordingId, requestId },
  });

  // Authenticate and get org context
  const { orgId, userId } = await requireOrg();

  logger.info('Authentication successful', {
    context: { recordingId, orgId, userId, requestId },
  });

  // Verify recording exists and belongs to org
  const { data: recording, error: recordingError } = await supabaseAdmin
    .from('recordings')
    .select('id, org_id, status, title, content_type, file_type')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    logger.warn('Recording not found or access denied', {
      context: { recordingId, orgId, requestId },
    });
    return errors.notFound('Recording not found', requestId);
  }

  logger.info('Recording found', {
    context: { recordingId, orgId, title: recording.title },
  });

  // Create SSE stream
  const stream = createSSEStream(recordingId);

  logger.info('SSE stream created', {
    context: { recordingId },
  });

  // Send initial message with recording info
  streamingManager.sendLog(
    recordingId,
    `Connected to upload progress stream for: ${recording.title}`,
    {
      recordingId,
      title: recording.title,
      contentType: recording.content_type,
      fileType: recording.file_type,
      status: recording.status,
    }
  );

  // Query current jobs for this recording
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, type, status, created_at')
    .eq('payload->>recordingId', recordingId)
    .in('status', ['pending', 'running', 'completed'])
    .order('created_at', { ascending: true });

  if (!jobsError && jobs && jobs.length > 0) {
    // Send initial job status
    streamingManager.sendProgress(
      recordingId,
      'all',
      0,
      `Processing pipeline: ${jobs.length} jobs`,
      {
        totalJobs: jobs.length,
        jobs: jobs.map(j => ({
          type: j.type,
          status: j.status,
        })),
      }
    );

    logger.info('Initial job status sent', {
      context: { recordingId },
      data: { jobCount: jobs.length },
    });
  } else {
    // No jobs yet, recording might still be in pending_metadata or uploaded state
    streamingManager.sendProgress(
      recordingId,
      'all',
      0,
      `Waiting for processing to start... (Status: ${recording.status})`
    );
  }

  // Start polling for job updates in the background
  // This runs asynchronously and sends updates via streamingManager
  startJobProgressPolling(recordingId, orgId).catch(error => {
    logger.error('Job progress polling failed', {
      context: { recordingId },
      error: error as Error,
    });
    streamingManager.sendError(
      recordingId,
      `Failed to poll job progress: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  });

  logger.info('SSE response ready to send', {
    context: { recordingId, orgId, requestId },
  });

  // Return SSE response immediately
  return createSSEResponse(stream);
});

/**
 * Poll for job progress updates and send via SSE
 */
async function startJobProgressPolling(recordingId: string, orgId: string): Promise<void> {
  const pollInterval = 2000; // Poll every 2 seconds
  const maxDuration = 30 * 60 * 1000; // Max 30 minutes
  const startTime = Date.now();

  logger.info('Starting job progress polling', {
    context: { recordingId },
  });

  let lastKnownStatus: Record<string, { status: string; progress: number }> = {};
  let completedJobs = new Set<string>();

  const poll = async () => {
    // Check if stream is still connected
    if (!streamingManager.isConnected(recordingId)) {
      logger.info('Stream disconnected, stopping polling', {
        context: { recordingId },
      });
      return;
    }

    // Check if max duration exceeded
    if (Date.now() - startTime > maxDuration) {
      logger.warn('Max polling duration exceeded', {
        context: { recordingId },
      });
      streamingManager.sendError(
        recordingId,
        'Processing taking longer than expected. Please check back later.'
      );
      return;
    }

    try {
      // Query all jobs for this recording
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from('jobs')
        .select('id, type, status, error, created_at, started_at, completed_at')
        .eq('payload->>recordingId', recordingId)
        .order('created_at', { ascending: true });

      if (jobsError) {
        logger.error('Failed to query jobs', {
          context: { recordingId },
          error: jobsError as Error,
        });
        return;
      }

      if (!jobs || jobs.length === 0) {
        // No jobs yet, wait a bit longer
        setTimeout(poll, pollInterval);
        return;
      }

      // Calculate overall progress
      const totalJobs = jobs.length;
      const completedJobCount = jobs.filter(j => j.status === 'completed').length;
      const failedJobCount = jobs.filter(j => j.status === 'failed').length;
      const overallProgress = Math.round((completedJobCount / totalJobs) * 100);

      // Send updates for jobs that changed status
      for (const job of jobs) {
        const lastStatus = lastKnownStatus[job.id];
        const currentStatus = job.status;

        // Check if status changed or newly completed
        if (!lastStatus || lastStatus.status !== currentStatus) {
          // Map job type to progress step
          let stepLabel = job.type;
          let progressPercent = 0;

          if (currentStatus === 'completed') {
            progressPercent = 100;
            completedJobs.add(job.id);

            streamingManager.sendProgress(
              recordingId,
              job.type as any,
              100,
              `${getJobLabel(job.type)} complete`,
              {
                jobId: job.id,
                jobType: job.type,
                duration: job.completed_at && job.started_at
                  ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                  : null,
              }
            );
          } else if (currentStatus === 'running') {
            progressPercent = 50; // Estimate mid-progress for running jobs

            streamingManager.sendProgress(
              recordingId,
              job.type as any,
              progressPercent,
              `${getJobLabel(job.type)} in progress...`,
              {
                jobId: job.id,
                jobType: job.type,
              }
            );
          } else if (currentStatus === 'failed') {
            streamingManager.sendError(
              recordingId,
              `${getJobLabel(job.type)} failed: ${job.error || 'Unknown error'}`,
              {
                jobId: job.id,
                jobType: job.type,
                error: job.error,
              }
            );
          } else if (currentStatus === 'pending') {
            streamingManager.sendProgress(
              recordingId,
              job.type as any,
              0,
              `${getJobLabel(job.type)} queued...`,
              {
                jobId: job.id,
                jobType: job.type,
              }
            );
          }

          // Update last known status
          lastKnownStatus[job.id] = {
            status: currentStatus,
            progress: progressPercent,
          };
        }
      }

      // Check if all jobs are complete
      if (completedJobCount + failedJobCount === totalJobs) {
        if (failedJobCount > 0) {
          streamingManager.sendError(
            recordingId,
            `Processing completed with ${failedJobCount} failed jobs out of ${totalJobs}`,
            {
              completedJobs: completedJobCount,
              failedJobs: failedJobCount,
              totalJobs,
            }
          );
        } else {
          streamingManager.sendComplete(
            recordingId,
            `Processing complete! All ${totalJobs} jobs finished successfully.`,
            {
              totalJobs,
              duration: Math.round((Date.now() - startTime) / 1000),
            }
          );
        }

        logger.info('All jobs completed, stopping polling', {
          context: { recordingId },
          data: { completedJobCount, failedJobCount, totalJobs },
        });

        return; // Stop polling
      }

      // Continue polling
      setTimeout(poll, pollInterval);
    } catch (error) {
      logger.error('Polling iteration failed', {
        context: { recordingId },
        error: error as Error,
      });

      // Continue polling despite error
      setTimeout(poll, pollInterval);
    }
  };

  // Start polling
  poll();
}

/**
 * Get human-readable label for job type
 */
function getJobLabel(jobType: string): string {
  const labels: Record<string, string> = {
    transcribe: 'Transcribing content',
    extract_audio: 'Extracting audio',
    extract_frames: 'Extracting frames',
    doc_generate: 'Generating document',
    generate_embeddings: 'Creating search embeddings',
    extract_text_pdf: 'Extracting text from PDF',
    extract_text_docx: 'Extracting text from Word document',
    process_text_note: 'Processing text note',
    generate_summary: 'Generating summary',
  };

  return labels[jobType] || jobType;
}

/**
 * POST not supported (use GET for SSE)
 */
export const POST = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use GET to stream progress.');
});
