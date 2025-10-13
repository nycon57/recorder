/**
 * Admin Job Retry API
 *
 * Retry a failed or pending job by resetting its status and run_after timestamp
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/admin/jobs/[id]/retry
 * Retry a failed or pending job
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteParams) => {
  // SECURITY: Require system admin privileges
  await requireSystemAdmin();

  const { id } = await context.params;

  // Fetch the job
  const { data: job, error: fetchError } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    throw errors.notFound('Job not found');
  }

  // Only allow retrying failed or pending jobs
  if (job.status !== 'failed' && job.status !== 'pending') {
    throw errors.badRequest(
      `Cannot retry job with status: ${job.status}. Only failed or pending jobs can be retried.`
    );
  }

  // Reset the job to pending status and schedule for immediate execution
  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      status: 'pending',
      run_at: new Date().toISOString(),
      error: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[AdminJobRetry] Error updating job:', updateError);
    throw errors.internal('Failed to retry job');
  }

  return successResponse({
    message: 'Job retry scheduled successfully',
    jobId: id,
  });
});
