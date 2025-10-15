/**
 * Real-Time Metrics API
 *
 * Provides live system metrics for the admin dashboard:
 * - Active searches (concurrent)
 * - Queries per second
 * - Average latency
 * - Cache hit rate
 *
 * Optimized for frequent polling (every 2 seconds)
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/metrics/realtime
 * Retrieve real-time system metrics (last 60 seconds)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // SECURITY: Require system admin privileges
  await requireSystemAdmin();

  // Time window: last 60 seconds for real-time metrics
  const now = new Date();
  const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000);

  // Fetch recent search analytics (last 60 seconds)
  const { data: recentSearches, error: searchError } = await supabaseAdmin
    .from('search_analytics')
    .select('latency_ms, cache_hit, created_at')
    .gte('created_at', sixtySecondsAgo.toISOString());

  if (searchError) {
    console.error('[RealtimeMetrics] Search analytics error:', searchError);
  }

  const searches = recentSearches || [];
  const totalSearches = searches.length;

  // Calculate metrics
  const activeSearches = totalSearches; // Active in last 60s
  const qps = totalSearches / 60; // Queries per second (total searches / 60 seconds)

  // Average latency
  const avgLatency =
    totalSearches > 0
      ? searches.reduce((sum, s) => sum + (s.latency_ms || 0), 0) / totalSearches
      : 0;

  // Cache hit rate
  const cacheHits = searches.filter((s) => s.cache_hit).length;
  const cacheHitRate = totalSearches > 0 ? (cacheHits / totalSearches) * 100 : 0;

  return successResponse({
    activeSearches,
    qps: Math.round(qps * 100) / 100, // Round to 2 decimal places
    avgLatency: Math.round(avgLatency),
    cacheHitRate: Math.round(cacheHitRate * 10) / 10, // Round to 1 decimal place
    timestamp: now.toISOString(),
  });
});
