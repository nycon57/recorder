/**
 * Frame Retrieval API Route
 *
 * GET - List frames for a recording with pagination and filters
 * POST - Trigger frame extraction for a recording
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { frameRetrievalSchema } from '@/lib/validations/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function getFrameNumber(metadata: unknown, fallback: number): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return fallback;
  }

  const frameNumber =
    (metadata as { frameNumber?: unknown; frame_number?: unknown })
      .frameNumber ??
    (metadata as { frameNumber?: unknown; frame_number?: unknown })
      .frame_number;

  return typeof frameNumber === 'number' && Number.isFinite(frameNumber)
    ? frameNumber
    : fallback;
}

function getMetadataObject(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function getMetadataString(metadata: unknown, key: string): string | undefined {
  const value = getMetadataObject(metadata)[key];
  return typeof value === 'string' ? value : undefined;
}

function getMetadataStringArray(metadata: unknown, key: string): string[] {
  const value = getMetadataObject(metadata)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * GET /api/recordings/[id]/frames
 * Retrieve frames for a recording with pagination and optional filters
 */
export const GET = apiHandler(
  async (request: NextRequest, context: RouteContext) => {
    const [{ orgId }, { id: recordingId }] = await Promise.all([
      requireOrg(),
      context.params,
    ]);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      includeDescriptions: searchParams.get('includeDescriptions'),
      includeOcr: searchParams.get('includeOcr'),
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
    };

    const params = frameRetrievalSchema.parse(rawParams);
    const { page, limit, includeDescriptions, includeOcr, startTime, endTime } =
      params;

    const supabase = await createClient();

    // Verify recording exists and user has access
    const { data: recording, error: recordingError } = await supabase
      .from('content')
      .select('id, org_id, title, duration_sec, metadata')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      return errors.notFound('Recording');
    }

    // Build query for frames
    let query = supabase
      .from('video_frames')
      .select(
        'id, content_id, frame_time_sec, frame_url, visual_description, ocr_text, metadata, created_at',
        {
          count: 'exact',
        },
      )
      .eq('content_id', recordingId)
      .eq('org_id', orgId)
      .order('frame_time_sec', { ascending: true });

    // Apply time range filters
    if (startTime !== undefined) {
      query = query.gte('frame_time_sec', startTime);
    }

    if (endTime !== undefined) {
      query = query.lte('frame_time_sec', endTime);
    }

    // Calculate pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: frames, error: framesError, count } = await query;

    if (framesError) {
      console.error('[Frames API] Error fetching frames:', framesError);
      throw new Error('Failed to fetch frames');
    }

    // Generate presigned URLs for frame images
    const framesWithUrls = await Promise.all(
      (frames || []).map(async (frame, index) => {
        let signedUrl = null;

        if (frame.frame_url) {
          try {
            const { data: urlData } = await supabaseAdmin.storage
              .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
              .createSignedUrl(frame.frame_url, 3600); // 1 hour expiry

            signedUrl = urlData?.signedUrl || null;
          } catch (error) {
            console.error('[Frames API] Error generating signed URL:', error);
          }
        }

        return {
          id: frame.id,
          recordingId: frame.content_id,
          frameNumber: getFrameNumber(frame.metadata, offset + index + 1),
          frameTimeSec: frame.frame_time_sec,
          frameUrl: signedUrl,
          visualDescription: includeDescriptions
            ? frame.visual_description
            : undefined,
          ocrText: includeOcr ? frame.ocr_text : undefined,
          sceneType: getMetadataString(frame.metadata, 'sceneType'),
          detectedElements: getMetadataStringArray(
            frame.metadata,
            'detectedElements',
          ),
          metadata: frame.metadata || {},
          createdAt: frame.created_at,
        };
      }),
    );

    const totalFrames = count || 0;
    const totalPages = Math.ceil(totalFrames / limit);
    const hasMore = page < totalPages;

    return successResponse({
      frames: framesWithUrls,
      pagination: {
        page,
        limit,
        total: totalFrames,
        totalPages,
        hasMore,
        hasPrevious: page > 1,
      },
      recording: {
        id: recording.id,
        title: recording.title,
        durationSec: recording.duration_sec,
      },
    });
  },
);

/**
 * POST /api/recordings/[id]/frames
 * Trigger frame extraction for a recording
 */
export const POST = apiHandler(
  async (request: NextRequest, context: RouteContext) => {
    const [{ orgId }, { id: recordingId }, supabase] = await Promise.all([
      requireOrg(),
      context.params,
      createClient(),
    ]);

    // Check if recording exists and belongs to org
    const { data: recording, error: recordingError } = await supabase
      .from('content')
      .select('id, storage_path_raw, storage_path_processed')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      throw new Error('Recording not found');
    }

    const videoStoragePath =
      recording.storage_path_processed ?? recording.storage_path_raw;
    if (!videoStoragePath) {
      throw new Error('Recording has no stored video path');
    }

    // Check if frames already exist
    const { count: existingCount } = await supabase
      .from('video_frames')
      .select('id', { count: 'exact', head: true })
      .eq('content_id', recordingId);

    if (existingCount && existingCount > 0) {
      return successResponse({
        message: 'Frames already extracted',
        frameCount: existingCount,
      });
    }

    // Queue frame extraction job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        type: 'extract_frames',
        status: 'pending',
        payload: {
          recordingId,
          orgId,
          videoUrl: videoStoragePath,
        },
        dedupe_key: `extract_frames:${recordingId}`,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to queue frame extraction: ${jobError?.message}`);
    }

    return successResponse({
      message: 'Frame extraction queued',
      jobId: job.id,
    });
  },
);
