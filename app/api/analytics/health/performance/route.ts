import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Helper function to calculate average of a field from historical health data
 */
function calculateAverage(historicalHealth: any[] | null | undefined, field: string): number {
  if (!historicalHealth || historicalHealth.length === 0) {
    return 0;
  }
  return Math.round(
    historicalHealth.reduce((sum, h) => sum + (h[field] || 0), 0) / historicalHealth.length
  );
}

/**
 * Helper function to map historical data to trend format
 */
function mapTrendData(
  historicalHealth: any[] | null | undefined,
  field: string
): Array<{ timestamp: string; value: number }> {
  return historicalHealth
    ? historicalHealth.slice(0, 24).map((h) => ({
        timestamp: h.recorded_at,
        value: h[field],
      }))
    : [];
}

/**
 * GET /api/analytics/health/performance
 *
 * Get detailed performance metrics with trends
 *
 * Returns:
 * - current: Current performance metrics
 * - trends: Historical performance data (last 24 hours)
 * - averages: Average performance over different time periods
 */
export const GET = apiHandler(async (request: NextRequest) => {
  await requireAuth();

  // Get latest health log
  const { data: latestHealth } = await supabaseAdmin
    .from('system_health_log')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get historical data for trends (last 24 hours)
  const { data: historicalHealth } = await supabaseAdmin
    .from('system_health_log')
    .select('*')
    .gte('recorded_at', new Date(Date.now() - 86400000).toISOString())
    .order('recorded_at', { ascending: false });

  // Calculate averages (guards against empty array division)
  const avgApiResponseTime = calculateAverage(historicalHealth, 'api_response_time');
  const avgJobProcessingTime = calculateAverage(historicalHealth, 'job_processing_time');
  const avgStorageLatency = calculateAverage(historicalHealth, 'storage_latency');
  const avgThroughput = calculateAverage(historicalHealth, 'throughput');

  // Build trends data
  const trends = {
    apiResponseTime: mapTrendData(historicalHealth, 'api_response_time'),
    jobProcessingTime: mapTrendData(historicalHealth, 'job_processing_time'),
    storageLatency: mapTrendData(historicalHealth, 'storage_latency'),
    throughput: mapTrendData(historicalHealth, 'throughput'),
  };

  return successResponse({
    current: {
      apiResponseTime: latestHealth?.api_response_time || 0,
      jobProcessingTime: latestHealth?.job_processing_time || 0,
      storageLatency: latestHealth?.storage_latency || 0,
      throughput: latestHealth?.throughput || 0,
    },
    averages: {
      last24Hours: {
        apiResponseTime: avgApiResponseTime,
        jobProcessingTime: avgJobProcessingTime,
        storageLatency: avgStorageLatency,
        throughput: avgThroughput,
      },
    },
    trends,
    timestamp: new Date().toISOString(),
  });
});
