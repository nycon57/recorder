import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

/**
 * Track Recording View Schema
 */
const trackViewSchema = z.object({
  source: z.enum(['library', 'search', 'share', 'direct', 'assistant']).optional(),
  duration_sec: z.number().int().positive().optional(),
  session_id: z.string().optional(),
  referrer: z.string().optional(),
});

type TrackViewInput = z.infer<typeof trackViewSchema>;

/**
 * POST /api/recordings/[id]/view
 *
 * Track a view of a recording for analytics
 *
 * @param id - Recording UUID
 * @body source - Where the view originated from
 * @body duration_sec - How long the recording was viewed (optional)
 * @body session_id - Session identifier (optional)
 * @body referrer - Referrer URL (optional)
 *
 * @returns View tracking confirmation with view ID
 */
export const POST = apiHandler(async (request: NextRequest, context: any) => {
  const { userId } = await requireAuth();
  const params = await context.params;
  const recordingId = params.id;

  // Validate request body
  const body = await parseBody(request, trackViewSchema);

  const supabase = supabaseAdmin;

  // Get user's internal UUID and org_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[POST /api/recordings/:id/view] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Verify recording exists and belongs to user's organization
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('id, org_id')
    .eq('id', recordingId)
    .single();

  if (recordingError || !recording) {
    return errors.notFound('Recording');
  }

  if (recording.org_id !== user.org_id) {
    return errors.forbidden();
  }

  // Extract IP and user agent from request
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             null;
  const userAgent = request.headers.get('user-agent') || null;

  // Track the view using the database function
  const { data: viewId, error: trackError } = await supabase.rpc(
    'track_recording_view',
    {
      p_recording_id: recordingId,
      p_user_id: user.id,
      p_org_id: user.org_id,
      p_source: body.source || null,
      p_session_id: body.session_id || null,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_referrer: body.referrer || null,
    }
  );

  if (trackError) {
    console.error('[POST /api/recordings/:id/view] Error tracking view:', trackError);
    return errors.internalError();
  }

  // Optionally update view duration if provided
  if (body.duration_sec && viewId) {
    const { error: updateError } = await supabase.rpc(
      'update_view_duration',
      {
        p_view_id: viewId,
        p_duration_sec: body.duration_sec,
      }
    );

    if (updateError) {
      console.error('[POST /api/recordings/:id/view] Error updating duration:', updateError);
      // Don't fail the request, just log the error
    }
  }

  return successResponse({
    viewId,
    recordingId,
    tracked: true,
  });
});

/**
 * GET /api/recordings/[id]/view
 *
 * Get view count and statistics for a recording
 *
 * @param id - Recording UUID
 *
 * @returns View count and statistics
 */
export const GET = apiHandler(async (request: NextRequest, context: any) => {
  const { userId } = await requireAuth();
  const params = await context.params;
  const recordingId = params.id;

  const supabase = supabaseAdmin;

  // Get user's org_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[GET /api/recordings/:id/view] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Verify recording exists and belongs to user's organization
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('id, org_id')
    .eq('id', recordingId)
    .single();

  if (recordingError || !recording) {
    return errors.notFound('Recording');
  }

  if (recording.org_id !== user.org_id) {
    return errors.forbidden();
  }

  // Get view count using the database function
  const { data: viewCount, error: countError } = await supabase.rpc(
    'get_recording_view_count',
    { p_recording_id: recordingId }
  );

  if (countError) {
    console.error('[GET /api/recordings/:id/view] Error getting view count:', countError);
    return errors.internalError();
  }

  // Try to get detailed stats from materialized view
  const { data: viewStats } = await supabase
    .from('recording_view_counts')
    .select('total_views, unique_viewers, last_viewed_at, avg_view_duration_sec')
    .eq('recording_id', recordingId)
    .single();

  return successResponse({
    recordingId,
    viewCount: viewCount || 0,
    stats: viewStats || {
      total_views: viewCount || 0,
      unique_viewers: 0,
      last_viewed_at: null,
      avg_view_duration_sec: null,
    },
  });
});
