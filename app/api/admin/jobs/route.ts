/**
 * Admin Jobs API
 *
 * Monitor and manage background job queue:
 * - View all jobs and their status
 * - Filter by status (pending, processing, completed, failed)
 * - View job metrics and statistics
 * - Retry failed jobs
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/jobs
 * Retrieve all jobs with metrics
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // SECURITY: Require system admin privileges
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // Optional filter: pending, processing, completed, failed
  const limit = parseInt(searchParams.get('limit') || '100');

  // Build query
  let query = supabaseAdmin
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply status filter if provided
  if (status) {
    query = query.eq('status', status);
  }

  const { data: jobs, error: jobsError } = await query;

  if (jobsError) {
    console.error('[AdminJobs] Error fetching jobs:', jobsError);
    return successResponse({
      jobs: [],
      metrics: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalJobs: 0,
      },
    });
  }

  // Calculate metrics
  const allJobs = jobs || [];
  const metrics = {
    pending: allJobs.filter((j) => j.status === 'pending').length,
    processing: allJobs.filter((j) => j.status === 'processing').length,
    completed: allJobs.filter((j) => j.status === 'completed').length,
    failed: allJobs.filter((j) => j.status === 'failed').length,
    totalJobs: allJobs.length,
  };

  // Transform jobs to match frontend interface
  const transformedJobs = allJobs.map((job) => ({
    id: job.id,
    type: job.type,
    status: job.status,
    attemptCount: job.attempts || 0,
    maxAttempts: job.max_attempts || 3,
    createdAt: job.created_at,
    runAfter: job.run_at,
    processingStartedAt: job.started_at,
    completedAt: job.completed_at,
    error: job.error,
    payload: job.payload,
  }));

  return successResponse({
    jobs: transformedJobs,
    metrics,
  });
});
