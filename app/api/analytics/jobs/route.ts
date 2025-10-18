/**
 * Jobs Analytics API
 *
 * GET /api/analytics/jobs
 * - Returns job statistics by status
 * - Includes recent jobs and performance metrics
 */

import { apiHandler, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import type { JobType } from '@/lib/types/database';

interface JobPerformance {
  type: JobType;
  total: number;
  success: number;
  failed: number;
  avgDuration: number;
  successRate: number;
}

/**
 * GET /api/analytics/jobs
 *
 * Get job statistics, performance metrics, and recent jobs
 *
 * @example
 * GET /api/analytics/jobs
 */
export const GET = apiHandler(async () => {
  const supabase = createClient();

  try {
    // Fetch all jobs for status counts
    const { data: allJobs, error: allJobsError } = await supabase
      .from('jobs')
      .select('status, type, created_at, completed_at, started_at');

    if (allJobsError) {
      console.error('[Analytics Jobs] Error fetching jobs:', allJobsError);
      throw new Error(`Failed to fetch jobs: ${allJobsError.message}`);
    }

    if (!allJobs || allJobs.length === 0) {
      // Return empty stats if no jobs
      return successResponse({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        activeJobs: 0,
        avgProcessingTime: 0,
        recentJobs: [],
        byType: [],
      });
    }

    // Count jobs by status
    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    allJobs.forEach((job) => {
      if (job.status === 'pending') {
        statusCounts.pending++;
      } else if (job.status === 'processing') {
        statusCounts.processing++;
      } else if (job.status === 'completed') {
        statusCounts.completed++;
      } else if (job.status === 'failed') {
        statusCounts.failed++;
      }
    });

    const activeJobs = statusCounts.pending + statusCounts.processing;

    // Calculate average processing time from completed jobs
    const completedJobs = allJobs.filter(
      (j) => j.status === 'completed' && j.started_at && j.completed_at
    );

    let avgProcessingTime = 0;
    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        const startTime = new Date(job.started_at!).getTime();
        const endTime = new Date(job.completed_at!).getTime();
        const durationSeconds = (endTime - startTime) / 1000;
        return sum + durationSeconds;
      }, 0);
      avgProcessingTime = totalDuration / completedJobs.length;
    }

    // Fetch recent jobs (last 10)
    const { data: recentJobsData, error: recentJobsError } = await supabase
      .from('jobs')
      .select('id, type, status, progress_percent, created_at, started_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentJobsError) {
      console.error('[Analytics Jobs] Error fetching recent jobs:', recentJobsError);
      // Don't fail the request, just use empty array
    }

    const recentJobs =
      recentJobsData?.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress_percent || 0,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      })) || [];

    // Calculate performance by job type
    const typeMap = new Map<JobType, { total: number; success: number; failed: number; durations: number[] }>();

    allJobs.forEach((job) => {
      const existing = typeMap.get(job.type) || { total: 0, success: 0, failed: 0, durations: [] };

      existing.total++;
      if (job.status === 'completed') {
        existing.success++;
        if (job.started_at && job.completed_at) {
          const startTime = new Date(job.started_at).getTime();
          const endTime = new Date(job.completed_at).getTime();
          const durationSeconds = (endTime - startTime) / 1000;
          existing.durations.push(durationSeconds);
        }
      } else if (job.status === 'failed') {
        existing.failed++;
      }

      typeMap.set(job.type, existing);
    });

    const byType: JobPerformance[] = Array.from(typeMap.entries()).map(([type, stats]) => {
      const avgDuration =
        stats.durations.length > 0
          ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length
          : 0;
      const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;

      return {
        type,
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        avgDuration: parseFloat(avgDuration.toFixed(2)),
        successRate: parseFloat(successRate.toFixed(2)),
      };
    });

    // Sort by total jobs (most active types first)
    byType.sort((a, b) => b.total - a.total);

    return successResponse({
      pending: statusCounts.pending,
      processing: statusCounts.processing,
      completed: statusCounts.completed,
      failed: statusCounts.failed,
      activeJobs,
      avgProcessingTime: parseFloat(avgProcessingTime.toFixed(2)),
      recentJobs,
      byType,
    });
  } catch (error) {
    console.error('[Analytics Jobs] Error:', error);
    throw new Error(
      `Failed to fetch job analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
