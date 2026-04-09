import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/profile/export
 *
 * Request a data export for the current user
 * Creates a background job to generate a downloadable archive of all user data
 *
 * @returns Job ID and status message
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  const supabase = supabaseAdmin;

  // Get user's internal UUID and org_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, org_id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[POST /api/profile/export] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Create a background job for data export
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      type: 'export_user_data',
      status: 'pending',
      payload: {
        user_id: user.id,
        clerk_id: userId,
        email: user.email,
        requested_at: new Date().toISOString(),
      },
      org_id: user.org_id,
      attempt_count: 0,
      max_attempts: 3,
      run_after: new Date().toISOString(),
    })
    .select('id, type, status, created_at')
    .single();

  if (jobError || !job) {
    console.error('[POST /api/profile/export] Error creating export job:', jobError);
    return errors.internalError();
  }

  return successResponse({
    jobId: job.id,
    status: job.status,
    message: 'Data export request has been queued. You will receive an email when your export is ready.',
    estimatedTime: '5-10 minutes',
    createdAt: job.created_at,
  });
});

/**
 * GET /api/profile/export
 *
 * Get the status of recent export requests
 *
 * @returns List of export jobs and their statuses
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  const supabase = supabaseAdmin;

  // Get user's internal UUID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[GET /api/profile/export] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Fetch recent export jobs for this user
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, status, created_at, completed_at, started_at, error_message, result')
    .eq('type', 'export_user_data')
    .contains('payload', { clerk_id: userId })
    .order('created_at', { ascending: false })
    .limit(10);

  if (jobsError) {
    console.error('[GET /api/profile/export] Error fetching export jobs:', jobsError);
    return errors.internalError();
  }

  // Format the response
  const exports = (jobs || []).map((job) => ({
    id: job.id,
    status: job.status,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    downloadUrl: job.status === 'completed' && job.result?.download_url
      ? job.result.download_url
      : null,
    expiresAt: job.status === 'completed' && job.result?.expires_at
      ? job.result.expires_at
      : null,
    errorMessage: job.error_message,
  }));

  return successResponse({
    exports,
    total: exports.length,
  });
});
