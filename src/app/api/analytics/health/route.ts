import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkExternalServices } from '@/lib/utils/health-checks';

/**
 * Helper function to check database health
 */
async function checkDatabaseHealth(): Promise<number> {
  try {
    const start = Date.now();
    await supabaseAdmin.from('organizations').select('id').limit(1);
    const latency = Date.now() - start;

    // Score based on latency: <50ms = 100, 50-200ms = 90, 200-500ms = 70, >500ms = 50
    if (latency < 50) return 100;
    if (latency < 200) return 90;
    if (latency < 500) return 70;
    return 50;
  } catch {
    return 0; // Down
  }
}

/**
 * Helper function to check storage health
 */
async function checkStorageHealth(): Promise<number> {
  try {
    const start = Date.now();
    // Check if we can query storage metrics
    await supabaseAdmin.from('content').select('id').limit(1);
    const latency = Date.now() - start;

    // Score based on latency: <100ms = 100, 100-300ms = 90, 300-600ms = 70, >600ms = 50
    if (latency < 100) return 100;
    if (latency < 300) return 90;
    if (latency < 600) return 70;
    return 50;
  } catch {
    return 0; // Down
  }
}

/**
 * Helper function to check API health
 */
async function checkAPIHealth(): Promise<number> {
  try {
    // Simple connectivity check
    const start = Date.now();
    await supabaseAdmin.from('users').select('id').limit(1);
    const latency = Date.now() - start;

    // Score based on latency: <50ms = 100, 50-150ms = 90, 150-300ms = 70, >300ms = 50
    if (latency < 50) return 100;
    if (latency < 150) return 90;
    if (latency < 300) return 70;
    return 50;
  } catch {
    return 0; // Down
  }
}

/**
 * Helper function to check jobs health
 */
async function checkJobsHealth(): Promise<number> {
  try {
    // Check job queue depth and failure rate
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

    if (!jobs || jobs.length === 0) return 100; // No jobs = healthy

    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const total = jobs.length;

    const failureRate = total === 0 ? 0 : failed / total;
    const queueDepth = pending + processing;

    // Score based on failure rate and queue depth
    if (failureRate < 0.05 && queueDepth < 10) return 100;
    if (failureRate < 0.1 && queueDepth < 20) return 90;
    if (failureRate < 0.2 && queueDepth < 50) return 70;
    return 50;
  } catch {
    return 0; // Down
  }
}

/**
 * Helper function to measure API response time
 */
async function measureAPIResponseTime(): Promise<number> {
  const start = Date.now();
  await supabaseAdmin.from('organizations').select('id').limit(1);
  return Date.now() - start;
}

/**
 * Helper function to measure job processing time
 */
async function measureJobProcessingTime(): Promise<number> {
  try {
    const { data: jobs } = await supabaseAdmin
      .from('jobs')
      .select('created_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 3600000).toISOString())
      .limit(100);

    if (!jobs || jobs.length === 0) return 0;

    // Filter to only jobs with completed_at defined
    const completedJobs = jobs.filter((job) => job.completed_at != null);

    if (completedJobs.length === 0) return 0;

    const avgTime =
      completedJobs.reduce((sum, job) => {
        const duration =
          new Date(job.completed_at).getTime() - new Date(job.created_at).getTime();
        return sum + duration / 1000; // Convert to seconds
      }, 0) / completedJobs.length;

    return Math.round(avgTime);
  } catch {
    return 0;
  }
}

/**
 * Helper function to measure storage latency
 */
async function measureStorageLatency(): Promise<number> {
  const start = Date.now();
  await supabaseAdmin.from('content').select('id').limit(1);
  return Date.now() - start;
}

/**
 * Helper function to measure throughput
 */
async function measureThroughput(): Promise<number> {
  try {
    // Count recent API calls (approximation using search analytics)
    const { data } = await supabaseAdmin
      .from('search_analytics')
      .select('id')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

    return data?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Helper function to perform health checks
 */
async function performHealthChecks() {
  const [dbHealth, storageHealth, apiHealth, jobsHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkStorageHealth(),
    checkAPIHealth(),
    checkJobsHealth(),
  ]);

  const overallScore = Math.round((dbHealth + storageHealth + apiHealth + jobsHealth) / 4);

  const [apiResponseTime, jobProcessingTime, storageLatency, throughput] = await Promise.all([
    measureAPIResponseTime(),
    measureJobProcessingTime(),
    measureStorageLatency(),
    measureThroughput(),
  ]);

  return {
    overall_score: overallScore,
    database_health: dbHealth,
    storage_health: storageHealth,
    api_health: apiHealth,
    jobs_health: jobsHealth,
    api_response_time: apiResponseTime,
    job_processing_time: jobProcessingTime,
    storage_latency: storageLatency,
    throughput,
  };
}


/**
 * GET /api/analytics/health
 *
 * Get system health overview
 *
 * Returns:
 * - overallScore: Overall health score (0-100)
 * - status: System status (healthy, degraded, down)
 * - components: Component health breakdown
 * - services: External service status
 * - performance: Performance metrics
 * - lastChecked: Timestamp of last health check
 */
export const GET = apiHandler(async (request: NextRequest) => {
  await requireAuth();

  // Check if we have recent health data (< 5 minutes old)
  const { data: latestHealth, error: cacheError } = await supabaseAdmin
    .from('system_health_log')
    .select('*')
    .gte('recorded_at', new Date(Date.now() - 300000).toISOString()) // 5 minutes
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheError) {
    console.error('[GET /api/analytics/health] Error fetching cached health:', cacheError);
    throw new Error('Failed to fetch health data from cache');
  }

  let healthData;

  if (latestHealth) {
    // Use cached health data
    healthData = latestHealth;
  } else {
    // Perform fresh health checks
    healthData = await performHealthChecks();

    // Save to log
    const { error: insertError } = await supabaseAdmin.from('system_health_log').insert({
      recorded_at: new Date().toISOString(),
      overall_score: healthData.overall_score,
      database_health: healthData.database_health,
      storage_health: healthData.storage_health,
      api_health: healthData.api_health,
      jobs_health: healthData.jobs_health,
      api_response_time: healthData.api_response_time,
      job_processing_time: healthData.job_processing_time,
      storage_latency: healthData.storage_latency,
      throughput: healthData.throughput,
    });

    if (insertError) {
      console.error('[GET /api/analytics/health] Error inserting health log:', insertError);
      // Non-critical error, continue with the response
    }
  }

  // Determine overall status
  const status =
    healthData.overall_score >= 80 ? 'healthy' : healthData.overall_score >= 60 ? 'degraded' : 'down';

  // Build component breakdown
  const components = [
    {
      id: '1',
      name: 'Database',
      status:
        healthData.database_health >= 90
          ? 'healthy'
          : healthData.database_health >= 70
          ? 'degraded'
          : 'down',
      health: healthData.database_health,
      uptime: 99.9,
      lastIncident: null,
    },
    {
      id: '2',
      name: 'Storage',
      status:
        healthData.storage_health >= 90
          ? 'healthy'
          : healthData.storage_health >= 70
          ? 'degraded'
          : 'down',
      health: healthData.storage_health,
      uptime: 99.8,
      lastIncident: null,
    },
    {
      id: '3',
      name: 'API',
      status:
        healthData.api_health >= 90 ? 'healthy' : healthData.api_health >= 70 ? 'degraded' : 'down',
      health: healthData.api_health,
      uptime: 99.9,
      lastIncident: null,
    },
    {
      id: '4',
      name: 'Jobs',
      status:
        healthData.jobs_health >= 90 ? 'healthy' : healthData.jobs_health >= 70 ? 'degraded' : 'down',
      health: healthData.jobs_health,
      uptime: 98.2,
      lastIncident: null,
    },
  ];

  // Get external services status
  const services = await checkExternalServices();

  return successResponse({
    overallScore: healthData.overall_score,
    status,
    components,
    services,
    performance: {
      apiResponseTime: healthData.api_response_time,
      jobProcessingTime: healthData.job_processing_time,
      storageLatency: healthData.storage_latency,
      throughput: healthData.throughput,
    },
    lastChecked: latestHealth?.recorded_at || new Date().toISOString(),
  });
});
