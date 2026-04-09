import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Helper function to map health score to status
 */
function getHealthStatus(health: number | undefined): 'healthy' | 'degraded' | 'down' {
  if (!health) return 'down';
  if (health >= 90) return 'healthy';
  if (health >= 70) return 'degraded';
  return 'down';
}

/**
 * Helper function to map historical health data to trend format
 */
function mapHealthTrend(
  historicalHealth: any[] | null | undefined,
  healthField: string
): Array<{ timestamp: string; health: number }> {
  return historicalHealth
    ? historicalHealth.slice(0, 24).map((h) => ({
        timestamp: h.recorded_at,
        health: h[healthField],
      }))
    : [];
}

/**
 * GET /api/analytics/health/components
 *
 * Get detailed component health information
 *
 * Returns:
 * - components: Array of component health objects with detailed metrics
 */
export const GET = apiHandler(async (request: NextRequest) => {
  await requireAuth();

  // Get latest health log
  const { data: latestHealth, error: latestError } = await supabaseAdmin
    .from('system_health_log')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error('[GET /api/analytics/health/components] Error fetching latest health:', latestError);
    throw new Error('Failed to fetch latest health data');
  }

  // Get historical data for trends (last 24 hours)
  const { data: historicalHealth, error: historicalError } = await supabaseAdmin
    .from('system_health_log')
    .select('*')
    .gte('recorded_at', new Date(Date.now() - 86400000).toISOString())
    .order('recorded_at', { ascending: false });

  if (historicalError) {
    console.error('[GET /api/analytics/health/components] Error fetching historical health:', historicalError);
    throw new Error('Failed to fetch historical health data');
  }

  // Build detailed component information
  // NOTE: Some metrics (uptime, connections, queueDepth, failureRate, errorRate, availability)
  // are currently hardcoded placeholders. TODO: Compute from latestHealth/historicalHealth when available.
  const components = [
    {
      id: '1',
      name: 'Database',
      status: getHealthStatus(latestHealth?.database_health),
      health: latestHealth?.database_health || 0,
      uptime: 99.9, // TODO: Compute from historical success rate
      lastIncident: null,
      metrics: {
        connections: 45, // TODO: Get from latestHealth counters
        // Fixed: Changed from api_response_time to db_query_time for proper DB metric
        queryTime: latestHealth?.db_query_time || 0,
        throughput: latestHealth?.throughput || 0,
      },
      trend: mapHealthTrend(historicalHealth, 'database_health'),
    },
    {
      id: '2',
      name: 'Storage',
      status: getHealthStatus(latestHealth?.storage_health),
      health: latestHealth?.storage_health || 0,
      uptime: 99.8, // TODO: Compute from historical success rate
      lastIncident: null,
      metrics: {
        latency: latestHealth?.storage_latency || 0,
        availability: 99.8, // TODO: Compute from storage metrics
      },
      trend: mapHealthTrend(historicalHealth, 'storage_health'),
    },
    {
      id: '3',
      name: 'API',
      status: getHealthStatus(latestHealth?.api_health),
      health: latestHealth?.api_health || 0,
      uptime: 99.9, // TODO: Compute from historical success rate
      lastIncident: null,
      metrics: {
        responseTime: latestHealth?.api_response_time || 0,
        requestRate: latestHealth?.throughput || 0,
        errorRate: 0.1, // TODO: Compute from error and request counts
      },
      trend: mapHealthTrend(historicalHealth, 'api_health'),
    },
    {
      id: '4',
      name: 'Jobs',
      status: getHealthStatus(latestHealth?.jobs_health),
      health: latestHealth?.jobs_health || 0,
      uptime: 98.2, // TODO: Compute from historical success rate
      lastIncident: null,
      metrics: {
        processingTime: latestHealth?.job_processing_time || 0,
        queueDepth: 8, // TODO: Get from latestHealth counters
        failureRate: 2.1, // TODO: Compute from error and request counts
      },
      trend: mapHealthTrend(historicalHealth, 'jobs_health'),
    },
  ];

  return successResponse({
    components,
    timestamp: new Date().toISOString(),
  });
});
