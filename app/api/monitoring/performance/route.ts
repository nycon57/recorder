import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
} from '@/lib/utils/api';
import {
  getPerformanceMetrics,
  resetMetrics,
  PERFORMANCE_TARGETS,
} from '@/lib/monitoring/performance-metrics';
import {
  getCacheMetrics,
  resetCacheStats,
} from '@/lib/services/cache-manager';
import {
  getQueryStats,
  resetQueryStats,
} from '@/lib/performance/query-optimizer';

/**
 * GET /api/monitoring/performance
 *
 * Get comprehensive performance metrics for the application
 *
 * @returns {
 *   timestamp: string;
 *   metrics: {
 *     api: API performance metrics
 *     jobs: Job processing metrics
 *     cache: Cache performance metrics
 *     database: Database performance metrics
 *     errors: Error tracking metrics
 *   };
 *   targets: Performance targets/thresholds
 *   health: Overall health score (0-100)
 * }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Get URL params
  const url = new URL(request.url);
  const includeDetails = url.searchParams.get('details') === 'true';

  try {
    // Fetch all metrics in parallel
    const [performanceMetrics, cacheMetrics, queryStats] = await Promise.all([
      getPerformanceMetrics(),
      getCacheMetrics(),
      getQueryStats(),
    ]);

    // Calculate health score based on performance targets
    let healthScore = 100;
    const healthIssues: string[] = [];

    // Check API performance
    const apiEndpoints = Object.values(performanceMetrics.api.endpoints);
    if (apiEndpoints.length > 0) {
      const avgP95 = apiEndpoints.reduce((sum, e) => sum + e.p95, 0) / apiEndpoints.length;
      if (avgP95 > PERFORMANCE_TARGETS.api.p95) {
        healthScore -= 20;
        healthIssues.push(`API p95 latency (${Math.round(avgP95)}ms) exceeds target (${PERFORMANCE_TARGETS.api.p95}ms)`);
      }

      const avgErrorRate = apiEndpoints.reduce((sum, e) => sum + e.errorRate, 0) / apiEndpoints.length;
      if (avgErrorRate > 5) {
        healthScore -= 15;
        healthIssues.push(`API error rate (${avgErrorRate.toFixed(1)}%) is high`);
      }
    }

    // Check cache performance
    if (cacheMetrics.stats.hitRate < PERFORMANCE_TARGETS.cache.hitRate) {
      healthScore -= 10;
      healthIssues.push(
        `Cache hit rate (${cacheMetrics.stats.hitRate}%) below target (${PERFORMANCE_TARGETS.cache.hitRate}%)`
      );
    }

    // Check database performance
    if (queryStats.avgDuration > PERFORMANCE_TARGETS.database.queryTime) {
      healthScore -= 15;
      healthIssues.push(
        `Average query time (${queryStats.avgDuration}ms) exceeds target (${PERFORMANCE_TARGETS.database.queryTime}ms)`
      );
    }

    if (queryStats.slowQueryCount > 10) {
      healthScore -= 10;
      healthIssues.push(`High number of slow queries (${queryStats.slowQueryCount})`);
    }

    // Ensure health score doesn't go below 0
    healthScore = Math.max(0, healthScore);

    // Build response
    const response: any = {
      timestamp: new Date().toISOString(),
      metrics: {
        api: {
          endpoints: performanceMetrics.api.endpoints,
          slowestEndpoints: performanceMetrics.api.slowest,
          summary: {
            totalEndpoints: Object.keys(performanceMetrics.api.endpoints).length,
            averageP95: apiEndpoints.length > 0
              ? Math.round(apiEndpoints.reduce((sum, e) => sum + e.p95, 0) / apiEndpoints.length)
              : 0,
            averageErrorRate: apiEndpoints.length > 0
              ? (apiEndpoints.reduce((sum, e) => sum + e.errorRate, 0) / apiEndpoints.length).toFixed(1)
              : 0,
          },
        },
        jobs: {
          throughput: performanceMetrics.jobs.throughput,
          summary: {
            totalThroughput: Object.values(performanceMetrics.jobs.throughput)
              .reduce((sum, val) => sum + val, 0),
          },
        },
        cache: {
          hitRate: cacheMetrics.stats.hitRate,
          hits: cacheMetrics.stats.hits,
          misses: cacheMetrics.stats.misses,
          errors: cacheMetrics.stats.errors,
          avgLatency: cacheMetrics.stats.avgLatency,
          keyCount: cacheMetrics.info.keyCount,
        },
        database: {
          totalQueries: queryStats.totalQueries,
          avgDuration: queryStats.avgDuration,
          slowQueryCount: queryStats.slowQueryCount,
          cacheHitRate: queryStats.cacheHitRate,
          slowestQueries: includeDetails ? queryStats.slowestQueries : undefined,
        },
        errors: {
          contexts: performanceMetrics.errors.contexts,
          total: Object.values(performanceMetrics.errors.contexts)
            .reduce((sum, count) => sum + count, 0),
        },
      },
      targets: PERFORMANCE_TARGETS,
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'degraded' : 'unhealthy',
        issues: healthIssues,
      },
    };

    // Add recommendations if health score is low
    if (healthScore < 80) {
      response.recommendations = generateRecommendations(response.metrics, PERFORMANCE_TARGETS);
    }

    return successResponse(response);

  } catch (error) {
    console.error('[Performance API] Error fetching metrics:', error);
    return errors.internalError();
  }
});

/**
 * POST /api/monitoring/performance/reset
 *
 * Reset performance metrics (admin only)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // TODO: Add admin check here
  // For now, we'll allow any authenticated user to reset (for testing)

  try {
    // Reset all metrics
    await Promise.all([
      resetMetrics(),
      resetCacheStats(),
      resetQueryStats(),
    ]);

    return successResponse({
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Performance API] Error resetting metrics:', error);
    return errors.internalError();
  }
});

/**
 * Generate performance recommendations based on metrics
 */
function generateRecommendations(metrics: any, targets: any): string[] {
  const recommendations: string[] = [];

  // API recommendations
  if (metrics.api.summary.averageP95 > targets.api.p95) {
    recommendations.push('Consider implementing response caching for slow API endpoints');
    recommendations.push('Review database queries in slow endpoints for optimization opportunities');
  }

  if (metrics.api.summary.averageErrorRate > 5) {
    recommendations.push('Investigate error logs to identify and fix recurring API errors');
    recommendations.push('Implement retry logic with exponential backoff for transient failures');
  }

  // Cache recommendations
  if (metrics.cache.hitRate < targets.cache.hitRate) {
    recommendations.push('Increase cache TTL for frequently accessed data');
    recommendations.push('Implement cache warming for predictable access patterns');
    recommendations.push('Review cache key generation to ensure proper invalidation');
  }

  // Database recommendations
  if (metrics.database.avgDuration > targets.database.queryTime) {
    recommendations.push('Add database indexes for frequently queried columns');
    recommendations.push('Consider query result caching for expensive operations');
    recommendations.push('Review and optimize N+1 query patterns');
  }

  if (metrics.database.slowQueryCount > 10) {
    recommendations.push('Analyze slow query log to identify optimization opportunities');
    recommendations.push('Consider denormalizing data for complex join queries');
    recommendations.push('Implement pagination for large result sets');
  }

  // Job throughput recommendations
  const totalThroughput = metrics.jobs.summary.totalThroughput;
  if (totalThroughput < 10) {
    recommendations.push('Scale up job workers to increase processing throughput');
    recommendations.push('Optimize job handler code for better performance');
    recommendations.push('Consider batch processing for similar jobs');
  }

  // Error recommendations
  if (metrics.errors.total > 100) {
    recommendations.push('Set up error alerting for critical issues');
    recommendations.push('Implement error recovery mechanisms');
    recommendations.push('Add comprehensive error logging with context');
  }

  return recommendations;
}