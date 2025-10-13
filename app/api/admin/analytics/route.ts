/**
 * Admin Analytics API
 *
 * Detailed time-series analytics for admins:
 * - Search performance trends
 * - Cache effectiveness over time
 * - Usage patterns by organization
 * - Resource consumption metrics
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/analytics
 * Retrieve time-series analytics data
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // SECURITY: Require system admin privileges for system-wide analytics
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '7d';
  const metric = searchParams.get('metric') || 'all';
  const orgIdParam = searchParams.get('orgId');
  const granularity = searchParams.get('granularity') || 'day';

  // SECURITY: Validate UUID format to prevent SQL injection
  let orgId: string | null = null;
  if (orgIdParam) {
    // Use centralized UUID validation
    const { isValidUUID } = await import('@/lib/utils/validation');
    if (!isValidUUID(orgIdParam)) {
      return errors.badRequest('Invalid organization ID format', { orgId: orgIdParam });
    }
    orgId = orgIdParam;
  }

  // Calculate time window
  const timeWindows: Record<string, number> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  const daysAgo = timeWindows[timeRange] || 7;
  const since = new Date();
  since.setDate(since.getDate() - daysAgo);

  // Determine time bucket for grouping
  const timeBuckets: Record<string, string> = {
    hour: "date_trunc('hour', created_at)",
    day: "date_trunc('day', created_at)",
    week: "date_trunc('week', created_at)",
  };

  const timeBucket = timeBuckets[granularity] || timeBuckets.day;

  // For specific metrics, return simple time-series array
  // This is what the MetricsChart component expects
  const isSpecificMetric = ![
    'all',
    'searches',
    'latency',
    'cache',
    'usage',
  ].includes(metric);

  const analyticsData: any = {
    timeRange,
    granularity,
    orgId,
    generatedAt: new Date().toISOString(),
  };

  // Fetch search metrics if requested
  if (
    metric === 'all' ||
    metric === 'searches' ||
    metric === 'search_volume' ||
    metric === 'search_latency'
  ) {
    let query = supabaseAdmin.from('search_analytics').select('*');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data: searches, error } = await query.gte(
      'created_at',
      since.toISOString()
    );

    if (error) {
      console.error('[AdminAnalytics] Search analytics error:', error);
    }

    // Group by time bucket
    const searchesByTime: Record<string, any> = {};

    (searches || []).forEach((s) => {
      const timestamp = new Date(s.created_at);
      let bucket: string;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucket = timestamp.toISOString();
      } else if (granularity === 'week') {
        const dayOfWeek = timestamp.getDay();
        timestamp.setDate(timestamp.getDate() - dayOfWeek);
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      } else {
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      }

      if (!searchesByTime[bucket]) {
        searchesByTime[bucket] = {
          timestamp: bucket,
          count: 0,
          totalLatency: 0,
          cacheHits: 0,
          results: 0,
        };
      }

      searchesByTime[bucket].count += 1;
      searchesByTime[bucket].totalLatency += s.latency_ms || 0;
      searchesByTime[bucket].cacheHits += s.cache_hit ? 1 : 0;
      searchesByTime[bucket].results += s.results_count || 0;
    });

    const searchesArray = Object.values(searchesByTime)
      .map((bucket: any) => ({
        timestamp: bucket.timestamp,
        searches: bucket.count,
        avgLatency:
          bucket.count > 0
            ? Math.round(bucket.totalLatency / bucket.count)
            : 0,
        cacheHitRate:
          bucket.count > 0
            ? Math.round((bucket.cacheHits / bucket.count) * 100) / 100
            : 0,
        avgResults:
          bucket.count > 0 ? Math.round(bucket.results / bucket.count) : 0,
      }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    analyticsData.searches = searchesArray;

    // Return specific metric data if requested
    if (metric === 'search_volume') {
      return successResponse(
        searchesArray.map((s) => ({ timestamp: s.timestamp, value: s.searches }))
      );
    }
    if (metric === 'search_latency') {
      return successResponse(
        searchesArray.map((s) => ({ timestamp: s.timestamp, value: s.avgLatency }))
      );
    }
  }

  // Fetch latency percentiles if requested
  if (
    metric === 'all' ||
    metric === 'latency' ||
    metric === 'p95_latency' ||
    metric === 'p99_latency'
  ) {
    let query = supabaseAdmin
      .from('search_analytics')
      .select('latency_ms, created_at');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data: latencies, error } = await query.gte(
      'created_at',
      since.toISOString()
    );

    if (error) {
      console.error('[AdminAnalytics] Latency error:', error);
    }

    // Group latencies by time bucket and calculate percentiles
    const latenciesByTime: Record<string, number[]> = {};

    (latencies || []).forEach((l) => {
      const timestamp = new Date(l.created_at);
      let bucket: string;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucket = timestamp.toISOString();
      } else if (granularity === 'week') {
        const dayOfWeek = timestamp.getDay();
        timestamp.setDate(timestamp.getDate() - dayOfWeek);
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      } else {
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      }

      if (!latenciesByTime[bucket]) {
        latenciesByTime[bucket] = [];
      }

      latenciesByTime[bucket].push(l.latency_ms || 0);
    });

    const latencyArray = Object.entries(latenciesByTime)
      .map(([timestamp, values]) => {
        const sorted = values.sort((a, b) => a - b);
        return {
          timestamp,
          p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p75: sorted[Math.floor(sorted.length * 0.75)] || 0,
          p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
          p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
          max: sorted[sorted.length - 1] || 0,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    analyticsData.latency = latencyArray;

    // Return specific metric data if requested
    if (metric === 'p95_latency') {
      return successResponse(
        latencyArray.map((l) => ({ timestamp: l.timestamp, value: l.p95 }))
      );
    }
    if (metric === 'p99_latency') {
      return successResponse(
        latencyArray.map((l) => ({ timestamp: l.timestamp, value: l.p99 }))
      );
    }
  }

  // Fetch cache metrics if requested
  if (metric === 'all' || metric === 'cache' || metric === 'cache_hit_rate') {
    let query = supabaseAdmin
      .from('search_analytics')
      .select('cache_hit, cache_layer, created_at');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data: cacheData, error } = await query.gte(
      'created_at',
      since.toISOString()
    );

    if (error) {
      console.error('[AdminAnalytics] Cache error:', error);
    }

    // Group cache stats by time bucket
    const cacheByTime: Record<string, any> = {};

    (cacheData || []).forEach((c) => {
      const timestamp = new Date(c.created_at);
      let bucket: string;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucket = timestamp.toISOString();
      } else if (granularity === 'week') {
        const dayOfWeek = timestamp.getDay();
        timestamp.setDate(timestamp.getDate() - dayOfWeek);
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      } else {
        timestamp.setHours(0, 0, 0, 0);
        bucket = timestamp.toISOString();
      }

      if (!cacheByTime[bucket]) {
        cacheByTime[bucket] = {
          timestamp: bucket,
          total: 0,
          hits: 0,
          layers: {} as Record<string, number>,
        };
      }

      cacheByTime[bucket].total += 1;
      cacheByTime[bucket].hits += c.cache_hit ? 1 : 0;

      const layer = c.cache_layer || 'none';
      cacheByTime[bucket].layers[layer] =
        (cacheByTime[bucket].layers[layer] || 0) + 1;
    });

    const cacheArray = Object.values(cacheByTime)
      .map((bucket: any) => ({
        timestamp: bucket.timestamp,
        hitRate:
          bucket.total > 0
            ? Math.round((bucket.hits / bucket.total) * 100) / 100
            : 0,
        hits: bucket.hits,
        misses: bucket.total - bucket.hits,
        layers: bucket.layers,
      }))
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

    analyticsData.cache = cacheArray;

    // Return specific metric data if requested
    if (metric === 'cache_hit_rate') {
      return successResponse(
        cacheArray.map((c) => ({ timestamp: c.timestamp, value: c.hitRate }))
      );
    }
  }

  // Handle other specific metrics with empty data
  if (metric === 'rerank_usage' || metric === 'embedding_generation') {
    // These metrics aren't currently tracked, return empty array
    console.warn(`[AdminAnalytics] Metric ${metric} not yet implemented`);
    return successResponse([]);
  }

  // Fetch usage metrics if requested
  if (metric === 'all' || metric === 'usage') {
    const { data: quotas, error } = await supabaseAdmin
      .from('org_quotas')
      .select('*');

    if (error) {
      console.error('[AdminAnalytics] Usage error:', error);
    }

    analyticsData.usage = {
      totalOrgs: quotas?.length || 0,
      byPlan: {} as Record<string, any>,
      aggregated: {
        totalSearches: 0,
        totalRecordings: 0,
        totalAiRequests: 0,
        totalStorageGb: 0,
      },
    };

    (quotas || []).forEach((q) => {
      const plan = q.plan_tier;
      if (!analyticsData.usage.byPlan[plan]) {
        analyticsData.usage.byPlan[plan] = {
          count: 0,
          searches: 0,
          recordings: 0,
          aiRequests: 0,
          storageGb: 0,
        };
      }

      analyticsData.usage.byPlan[plan].count += 1;
      analyticsData.usage.byPlan[plan].searches += q.searches_used || 0;
      analyticsData.usage.byPlan[plan].recordings += q.recordings_used || 0;
      analyticsData.usage.byPlan[plan].aiRequests += q.ai_requests_used || 0;
      analyticsData.usage.byPlan[plan].storageGb +=
        Number(q.storage_used_gb) || 0;

      analyticsData.usage.aggregated.totalSearches += q.searches_used || 0;
      analyticsData.usage.aggregated.totalRecordings += q.recordings_used || 0;
      analyticsData.usage.aggregated.totalAiRequests +=
        q.ai_requests_used || 0;
      analyticsData.usage.aggregated.totalStorageGb +=
        Number(q.storage_used_gb) || 0;
    });
  }

  return successResponse(analyticsData);
});
