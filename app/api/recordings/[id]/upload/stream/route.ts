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
    // Send initial status for first pending/running job (natural language)
    const firstActiveJob = jobs.find(j => j.status === 'pending' || j.status === 'running');

    if (firstActiveJob) {
      const jobLabel = getJobLabel(firstActiveJob.type);
      const progress = firstActiveJob.status === 'running' ? 50 : 0;
      const statusText = firstActiveJob.status === 'running' ? 'in progress...' : 'starting...';

      streamingManager.sendProgress(
        recordingId,
        firstActiveJob.type as any,
        progress,
        `${jobLabel} ${statusText}`,
        {
          jobId: firstActiveJob.id,
          jobType: firstActiveJob.type,
        }
      );
    }

    logger.info('Initial job status sent', {
      context: { recordingId },
      data: { jobCount: jobs.length },
    });
  } else {
    // No jobs yet, recording might still be in pending_metadata or uploaded state
    streamingManager.sendLog(
      recordingId,
      `Preparing to process your content...`
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
      // Query all jobs for this recording (including progress columns!)
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from('jobs')
        .select('id, type, status, error, created_at, started_at, completed_at, progress_percent, progress_message')
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

      // Send updates for jobs that changed status OR progress
      for (const job of jobs) {
        const lastStatus = lastKnownStatus[job.id];
        const currentStatus = job.status;
        const currentProgress = job.progress_percent ?? 0;

        // Check if status changed, progress changed, or newly discovered job
        const statusChanged = !lastStatus || lastStatus.status !== currentStatus;
        const progressChanged = !lastStatus || lastStatus.progress !== currentProgress;

        if (statusChanged || progressChanged) {
          // Use actual progress from database, fallback to estimates
          let progressPercent = currentProgress;
          let progressMessage = job.progress_message;

          if (currentStatus === 'completed') {
            progressPercent = 100;
            completedJobs.add(job.id);

            // If the progress message is generic "Completed", use a better description
            const finalMessage = progressMessage === 'Completed'
              ? `${getJobLabel(job.type)} complete`
              : (progressMessage || `${getJobLabel(job.type)} complete`);

            streamingManager.sendProgress(
              recordingId,
              job.type as any,
              100,
              finalMessage,
              {
                jobId: job.id,
                jobType: job.type,
                duration: job.completed_at && job.started_at
                  ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                  : null,
              }
            );
          } else if (currentStatus === 'running') {
            // Use actual progress from database, fallback to 50% if not set
            progressPercent = currentProgress > 0 ? currentProgress : 50;

            streamingManager.sendProgress(
              recordingId,
              job.type as any,
              progressPercent,
              progressMessage || `${getJobLabel(job.type)} in progress...`,
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
    transcribe: 'Transcription',
    extract_audio: 'Audio extraction',
    extract_frames: 'Frame extraction',
    doc_generate: 'Document generation',
    generate_embeddings: 'Search indexing',
    extract_text_pdf: 'PDF text extraction',
    extract_text_docx: 'Document text extraction',
    process_text_note: 'Text processing',
    generate_summary: 'Summary generation',
  };

  return labels[jobType] || jobType;
}

/**
 * POST not supported (use GET for SSE)
 */
export const POST = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use GET to stream progress.');
});
