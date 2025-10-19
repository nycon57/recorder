/**
 * Perform Health Check Job Handler
 *
 * Monitors system health and logs metrics for database, storage, API, and jobs.
 * Runs every 5 minutes.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'perform-health-check' });

type Job = Database['public']['Tables']['jobs']['Row'];

export async function handlePerformHealthCheck(job: Job): Promise<void> {
  const supabase = createAdminClient();

  logger.info('Starting health check', { context: { jobId: job.id } });

  try {
    // Check database health
    const dbHealth = await checkDatabaseHealth(supabase);

    // Check storage health
    const storageHealth = await checkStorageHealth(supabase);

    // Check API health
    const apiHealth = await checkAPIHealth();

    // Check jobs health
    const jobsHealth = await checkJobsHealth(supabase);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      (dbHealth.score * 0.3 +
        storageHealth.score * 0.2 +
        apiHealth.score * 0.2 +
        jobsHealth.score * 0.3)
    );

    logger.info('Health check completed', {
      data: {
        overallScore,
        database: dbHealth.score,
        storage: storageHealth.score,
        api: apiHealth.score,
        jobs: jobsHealth.score,
      },
    });

    // Insert health log
    await insertHealthLog(supabase, {
      overall_score: overallScore,
      database_health: dbHealth.score,
      storage_health: storageHealth.score,
      api_health: apiHealth.score,
      jobs_health: jobsHealth.score,
      api_response_time: apiHealth.responseTime ?? 0,
      job_processing_time: jobsHealth.avgProcessingTime ?? 0,
      storage_latency: storageHealth.latency ?? 0,
      throughput: apiHealth.throughput ?? 0,
    });

    // Log warning if overall score is low
    if (overallScore < 70) {
      logger.warn('System health degraded', {
        data: {
          overallScore,
          database: dbHealth.score,
          storage: storageHealth.score,
          api: apiHealth.score,
          jobs: jobsHealth.score,
        },
      });
    }
  } catch (error) {
    logger.error('Health check failed', { error: error as Error });
    throw error;
  }
}

interface HealthCheckResult {
  score: number;
  latency?: number;
  responseTime?: number;
  throughput?: number;
  avgProcessingTime?: number;
}

async function checkDatabaseHealth(
  supabase: ReturnType<typeof createAdminClient>
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Simple query to test database connectivity
    const { error } = await supabase.from('organizations').select('id').limit(1);

    if (error) {
      logger.error('Database health check failed', { error: new Error(error.message) });
      return { score: 0, latency: 0 };
    }

    const latency = Date.now() - start;

    // Score based on latency
    let score = 100;
    if (latency > 50) score = 90;
    if (latency > 100) score = 80;
    if (latency > 200) score = 70;
    if (latency > 500) score = 50;
    if (latency > 1000) score = 30;

    logger.debug('Database health check', { data: { score, latency } });

    return { score, latency };
  } catch (error) {
    logger.error('Database health check exception', { error: error as Error });
    return { score: 0, latency: 0 };
  }
}

async function checkStorageHealth(
  supabase: ReturnType<typeof createAdminClient>
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Try to list files in storage
    const { data, error } = await supabase.storage.from('recordings').list('', { limit: 1 });

    if (error) {
      logger.error('Storage health check failed', { error: new Error(error.message) });
      return { score: 0, latency: 0 };
    }

    const latency = Date.now() - start;

    // Score based on latency
    let score = 100;
    if (latency > 100) score = 90;
    if (latency > 200) score = 80;
    if (latency > 500) score = 70;
    if (latency > 1000) score = 50;
    if (latency > 2000) score = 30;

    logger.debug('Storage health check', { data: { score, latency } });

    return { score, latency };
  } catch (error) {
    logger.error('Storage health check exception', { error: error as Error });
    return { score: 0, latency: 0 };
  }
}

async function checkAPIHealth(): Promise<HealthCheckResult> {
  try {
    // Determine the base URL for API health check
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const healthUrl = `${baseUrl}/api/health`;

    const start = Date.now();
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'HealthCheck/1.0',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      logger.error('API health check failed', {
        data: { status: response.status, responseTime },
      });
      return { score: 0, responseTime: 0, throughput: 0 };
    }

    // Score based on response time
    let score = 100;
    if (responseTime > 100) score = 90;
    if (responseTime > 200) score = 80;
    if (responseTime > 300) score = 70;
    if (responseTime > 500) score = 50;
    if (responseTime > 1000) score = 30;

    const throughput = responseTime > 0 ? 1000 / responseTime : 0; // requests per second

    logger.debug('API health check', { data: { score, responseTime, throughput } });

    return { score, responseTime, throughput };
  } catch (error) {
    logger.error('API health check exception', { error: error as Error });
    return { score: 0, responseTime: 0, throughput: 0 };
  }
}

async function checkJobsHealth(
  supabase: ReturnType<typeof createAdminClient>
): Promise<HealthCheckResult> {
  try {
    // Check recent job completion rate (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('status, created_at, completed_at')
      .gte('created_at', oneHourAgo)
      .limit(100);

    if (!recentJobs || recentJobs.length === 0) {
      // No recent jobs is actually good (100 score)
      logger.debug('Jobs health check - no recent jobs');
      return { score: 100, avgProcessingTime: 0 };
    }

    const completedJobs = recentJobs.filter(j => j.status === 'completed');
    const failedJobs = recentJobs.filter(j => j.status === 'failed');

    const successRate = (completedJobs.length / recentJobs.length) * 100;

    // Calculate average processing time for completed jobs
    const processingTimes = completedJobs
      .filter(j => j.completed_at)
      .map(j => {
        const created = new Date(j.created_at).getTime();
        const completed = new Date(j.completed_at!).getTime();
        return (completed - created) / 1000; // seconds
      });

    const avgProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
        : 0;

    // Score based on success rate and processing time
    let score = 100;
    if (successRate < 95) score = 90;
    if (successRate < 90) score = 80;
    if (successRate < 80) score = 70;
    if (successRate < 70) score = 50;
    if (successRate < 50) score = 30;

    // Penalize slow processing
    if (avgProcessingTime > 300) score = Math.max(0, score - 10);
    if (avgProcessingTime > 600) score = Math.max(0, score - 20);

    logger.debug('Jobs health check', {
      data: {
        score,
        totalJobs: recentJobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        successRate: successRate.toFixed(1),
        avgProcessingTime: avgProcessingTime.toFixed(1),
      },
    });

    return { score: Math.max(0, score), avgProcessingTime };
  } catch (error) {
    logger.error('Jobs health check exception', { error: error as Error });
    return { score: 0, avgProcessingTime: 0 };
  }
}

interface HealthLogData {
  overall_score: number;
  database_health: number;
  storage_health: number;
  api_health: number;
  jobs_health: number;
  api_response_time: number;
  job_processing_time: number;
  storage_latency: number;
  throughput: number;
}

async function insertHealthLog(
  supabase: ReturnType<typeof createAdminClient>,
  data: HealthLogData
): Promise<void> {
  try {
    const { error } = await supabase.from('system_health_log' as any).insert({
      recorded_at: new Date().toISOString(),
      overall_score: data.overall_score,
      database_health: data.database_health,
      storage_health: data.storage_health,
      api_health: data.api_health,
      jobs_health: data.jobs_health,
      api_response_time: data.api_response_time,
      job_processing_time: data.job_processing_time,
      storage_latency: data.storage_latency,
      throughput: data.throughput,
    });

    if (error) {
      throw new Error(`Failed to insert health log: ${error.message}`);
    }

    logger.debug('Health log inserted successfully');
  } catch (error) {
    logger.error('Failed to insert health log - table may not exist yet', {
      error: error as Error,
    });
    // Don't throw - this is non-critical
  }
}
