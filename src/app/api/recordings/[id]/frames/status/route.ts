/**
 * Frame Status API
 *
 * GET /api/recordings/[id]/frames/status
 * Check the frame extraction status for a specific recording.
 *
 * This endpoint provides real-time status information about frame extraction,
 * including progress indicators and estimated completion times. Useful for
 * UI polling and status displays.
 *
 * @example Request
 * ```
 * GET /api/recordings/abc-123/frames/status
 * ```
 *
 * @example Response (Processing)
 * ```json
 * {
 *   "data": {
 *     "status": "processing",
 *     "frameCount": 45,
 *     "framesExtracted": true,
 *     "estimatedCompletion": 12,
 *     "progress": {
 *       "completed": 45,
 *       "total": 150
 *     }
 *   }
 * }
 * ```
 *
 * @example Response (Completed)
 * ```json
 * {
 *   "data": {
 *     "status": "completed",
 *     "frameCount": 150,
 *     "framesExtracted": true
 *   }
 * }
 * ```
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  FrameExtractionStatus,
  FrameExtractionMetadata,
} from '@/lib/types/video-frames';

/**
 * GET /api/recordings/[id]/frames/status
 *
 * Check frame extraction status for a recording
 *
 * @security Requires organization authentication and recording access
 * @rateLimit Standard API rate limits apply
 *
 * @param params.id - Recording UUID
 *
 * @returns {FrameExtractionMetadata} Current extraction status and progress
 * @throws {404} When recording not found or user lacks access
 */
export const GET = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireOrg();
    const { id: recordingId } = await params;
    const supabase = await createClient();

    // Verify recording exists and user has access
    const { data: recording, error: recordingError } = await supabase
      .from('content')
      .select('id, title, duration_sec, status, metadata')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      return errors.notFound('Recording');
    }

    // Check for frame extraction job
    const { data: frameJob } = await supabaseAdmin
      .from('jobs')
      .select('status, payload, result, error, started_at, completed_at')
      .eq('type', 'extract_frames')
      .eq('payload->>recordingId', recordingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get current frame count
    const { count: frameCount } = await supabaseAdmin
      .from('video_frames')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', recordingId)
      .eq('org_id', orgId);

    const totalFrames = frameCount || 0;
    const framesExtracted = totalFrames > 0;

    // Determine extraction status
    let status: FrameExtractionStatus = 'pending';
    let estimatedCompletion: number | undefined;
    let error: string | undefined;
    let progress: { completed: number; total: number } | undefined;

    if (frameJob) {
      // Map job status to frame extraction status
      if (frameJob.status === 'completed') {
        status = 'completed';
      } else if (frameJob.status === 'failed') {
        status = 'failed';
        error = frameJob.error || 'Frame extraction failed';
      } else if (frameJob.status === 'processing') {
        status = 'processing';

        // Calculate progress and estimate completion
        if (frameJob.payload && recording.duration_sec) {
          const payload = frameJob.payload as any;
          const extractionRate = payload.extractionRate || 1; // frames per second
          const expectedTotal = Math.ceil(
            recording.duration_sec * extractionRate
          );

          progress = {
            completed: totalFrames,
            total: expectedTotal,
          };

          // Estimate time remaining based on progress
          if (frameJob.started_at && totalFrames > 0) {
            const elapsedMs =
              Date.now() - new Date(frameJob.started_at).getTime();
            const elapsedSec = elapsedMs / 1000;
            const framesPerSec = totalFrames / elapsedSec;
            const remainingFrames = expectedTotal - totalFrames;
            estimatedCompletion = Math.ceil(remainingFrames / framesPerSec);
          }
        }
      }
    } else if (framesExtracted) {
      // No job found but frames exist - assume completed
      status = 'completed';
    } else {
      // No job and no frames - pending
      status = 'pending';
    }

    // Build metadata response
    const metadata: FrameExtractionMetadata = {
      status,
      frameCount: totalFrames,
      framesExtracted,
      extractionRate: frameJob?.payload?.extractionRate,
      totalDuration: recording.duration_sec || undefined,
      startedAt: frameJob?.started_at || undefined,
      completedAt: frameJob?.completed_at || undefined,
      estimatedCompletion,
      error,
    };

    // Add progress if available
    if (progress) {
      (metadata as any).progress = progress;
    }

    return successResponse(metadata);
  }
);
