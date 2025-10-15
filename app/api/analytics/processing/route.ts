import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  processingStatsQuerySchema,
  type ProcessingStatsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/analytics/processing - Get processing time statistics
 *
 * Query params:
 * - date_from: Start date
 * - date_to: End date
 * - job_type: Filter by job type
 * - includeFailures: Include failed jobs in stats
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<ProcessingStatsQueryInput>(
    request,
    processingStatsQuerySchema
  );
  const supabase = supabaseAdmin;

  // Build query for jobs
  let jobsQuery = supabase
    .from('jobs')
    .select('type, status, started_at, completed_at')
    .eq('payload->>org_id', orgId);

  // Apply filters
  if (query.date_from) {
    jobsQuery = jobsQuery.gte('started_at', query.date_from);
  }
  if (query.date_to) {
    jobsQuery = jobsQuery.lte('started_at', query.date_to);
  }
  if (query.job_type) {
    jobsQuery = jobsQuery.eq('type', query.job_type);
  }

  const { data: jobs, error } = await jobsQuery;

  if (error) {
    console.error('[GET /api/analytics/processing] Error fetching jobs:', error);
    throw new Error('Failed to fetch processing stats');
  }

  // Group by job type and calculate statistics
  const statsByType: Record<
    string,
    {
      total_jobs: number;
      completed_jobs: number;
      failed_jobs: number;
      processing_times: number[];
    }
  > = {};

  (jobs || []).forEach((job: any) => {
    const type = job.type;
    if (!statsByType[type]) {
      statsByType[type] = {
        total_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        processing_times: [],
      };
    }

    if (job.status === 'completed') {
      statsByType[type].total_jobs += 1;
      statsByType[type].completed_jobs += 1;

      // Calculate processing time if both timestamps are available
      if (job.started_at && job.completed_at) {
        const startTime = new Date(job.started_at).getTime();
        const endTime = new Date(job.completed_at).getTime();
        const processingTime = endTime - startTime;
        statsByType[type].processing_times.push(processingTime);
      }
    } else if (job.status === 'failed') {
      // Only include failed jobs in totals when includeFailures is true
      if (query.includeFailures) {
        statsByType[type].total_jobs += 1;
        statsByType[type].failed_jobs += 1;
      }
    } else {
      // For any other status (pending, etc.), count in total_jobs
      statsByType[type].total_jobs += 1;
    }
  });

  // Calculate average, min, max processing times
  const stats = Object.entries(statsByType).map(([jobType, data]) => {
    const times = data.processing_times;
    const avgTime = times.length > 0
      ? times.reduce((sum, t) => sum + t, 0) / times.length
      : null;
    const minTime = times.length > 0 ? Math.min(...times) : null;
    const maxTime = times.length > 0 ? Math.max(...times) : null;

    return {
      job_type: jobType,
      total_jobs: data.total_jobs,
      completed_jobs: data.completed_jobs,
      failed_jobs: data.failed_jobs,
      avg_processing_time_ms: avgTime,
      min_processing_time_ms: minTime,
      max_processing_time_ms: maxTime,
    };
  });

  const totalJobs = stats.reduce((sum, s) => sum + s.total_jobs, 0);
  const totalCompleted = stats.reduce((sum, s) => sum + s.completed_jobs, 0);
  const overallSuccessRate = totalJobs > 0 ? (totalCompleted / totalJobs) * 100 : 0;

  return successResponse({
    stats,
    total_jobs: totalJobs,
    overall_success_rate: overallSuccessRate,
  });
});
