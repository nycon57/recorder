/**
 * Storage Metrics API
 *
 * GET /api/analytics/metrics
 * - Returns comprehensive storage metrics for the organization
 * - Includes tier breakdown, provider breakdown, optimization stats, etc.
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { getStorageMetrics, getStorageTrends, calculateStorageHealth } from '@/lib/services/storage-metrics';

/**
 * GET /api/analytics/metrics
 *
 * Get comprehensive storage metrics for the organization
 *
 * Query parameters:
 * - includeHealth: boolean (default: false) - Include health score calculation
 * - includeTrends: boolean (default: false) - Include historical trends
 * - trendDays: number (default: 30) - Number of days for trend data
 *
 * @example
 * GET /api/analytics/metrics?includeHealth=true&includeTrends=true&trendDays=90
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  const { searchParams } = new URL(request.url);
  const includeHealth = searchParams.get('includeHealth') === 'true';
  const includeTrends = searchParams.get('includeTrends') === 'true';
  const trendDays = parseInt(searchParams.get('trendDays') || '30', 10);

  // Validate trend days
  if (trendDays < 1 || trendDays > 365) {
    throw new Error('trendDays must be between 1 and 365');
  }

  try {
    // Fetch metrics
    const metrics = await getStorageMetrics(orgId);

    // Optionally include health score
    let health = undefined;
    if (includeHealth) {
      health = await calculateStorageHealth(orgId);
    }

    // Optionally include trends
    let trends = undefined;
    if (includeTrends) {
      trends = await getStorageTrends(orgId, trendDays);
    }

    return successResponse({
      metrics,
      health,
      trends,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics Metrics] Error:', error);
    throw new Error(
      `Failed to fetch storage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
