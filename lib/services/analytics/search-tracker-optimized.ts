import { createClient } from '@/lib/supabase/server';
import { getCache } from '../cache/multi-layer-cache';

export interface SearchTrackingData {
  query: string;
  mode: 'semantic' | 'keyword' | 'agentic';
  resultsCount: number;
  latencyMs: number;
  cacheHit: boolean;
  cacheLayer?: 'edge' | 'redis' | 'memory' | 'none';
  filters?: Record<string, any>;
  clickedResultIds?: string[];
  sessionId?: string;
  userId?: string;
  orgId: string;
}

export class SearchTrackerOptimized {
  private static cache = getCache();

  /**
   * Track a search event (async, non-blocking)
   */
  static async trackSearch(data: SearchTrackingData): Promise<void> {
    // Fire and forget - don't block the search response
    setImmediate(async () => {
      const supabase = await createClient();

      try {
        const { error } = await supabase.from('search_analytics').insert({
          org_id: data.orgId,
          user_id: data.userId,
          query: data.query,
          mode: data.mode,
          results_count: data.resultsCount,
          latency_ms: data.latencyMs,
          cache_hit: data.cacheHit,
          cache_layer: data.cacheLayer,
          filters: data.filters || {},
          clicked_result_ids: data.clickedResultIds || [],
          session_id: data.sessionId,
        });

        if (error) {
          console.error('[SearchTracker] Failed to track search:', error);
        }
      } catch (error) {
        console.error('[SearchTracker] Unexpected error:', error);
      }
    });
  }

  /**
   * Track user feedback on search results (async, batched)
   */
  private static feedbackBatch: any[] = [];
  private static feedbackTimer: NodeJS.Timeout | null = null;

  static async trackFeedback(data: {
    query: string;
    resultId: string;
    resultType: string;
    feedbackType: 'click' | 'thumbs_up' | 'thumbs_down' | 'bookmark' | 'skip';
    position?: number;
    timeToClickMs?: number;
    dwellTimeMs?: number;
    comment?: string;
    userId: string;
    orgId: string;
  }): Promise<void> {
    // Add to batch
    this.feedbackBatch.push({
      user_id: data.userId,
      org_id: data.orgId,
      query: data.query,
      result_id: data.resultId,
      result_type: data.resultType,
      feedback_type: data.feedbackType,
      position: data.position,
      time_to_click_ms: data.timeToClickMs,
      dwell_time_ms: data.dwellTimeMs,
      comment: data.comment,
    });

    // Flush batch after 1 second or when it reaches 10 items
    if (this.feedbackBatch.length >= 10) {
      await this.flushFeedbackBatch();
    } else if (!this.feedbackTimer) {
      this.feedbackTimer = setTimeout(() => this.flushFeedbackBatch(), 1000);
    }
  }

  private static async flushFeedbackBatch(): Promise<void> {
    if (this.feedbackBatch.length === 0) return;

    const batch = [...this.feedbackBatch];
    this.feedbackBatch = [];

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    const supabase = await createClient();

    try {
      const { error } = await supabase.from('search_feedback').insert(batch);

      if (error) {
        console.error('[SearchTracker] Failed to track feedback batch:', error);
      }
    } catch (error) {
      console.error('[SearchTracker] Unexpected error:', error);
    }
  }

  /**
   * Get search metrics for organization (optimized with caching and pagination)
   */
  static async getMetrics(
    orgId: string,
    days: number = 7,
    limit: number = 1000
  ): Promise<{
    totalSearches: number;
    avgLatency: number;
    p95Latency: number;
    cacheHitRate: number;
    topQueries: Array<{ query: string; count: number }>;
    searchesByMode: Record<string, number>;
  }> {
    // Check cache first
    const cacheKey = `metrics:${orgId}:${days}`;
    const cached = await this.cache.get(
      cacheKey,
      async () => {
        const supabase = await createClient();

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Use database aggregation instead of fetching all records
        const { data: stats, error: statsError } = await supabase.rpc(
          'get_search_metrics',
          {
            p_org_id: orgId,
            p_since: since.toISOString(),
            p_limit: limit,
          }
        );

        if (statsError || !stats) {
          return this.getEmptyMetrics();
        }

        // Get top queries from materialized view
        const { data: topQueries } = await supabase
          .from('popular_queries')
          .select('query, query_count, avg_latency')
          .eq('org_id', orgId)
          .order('query_count', { ascending: false })
          .limit(10);

        return {
          totalSearches: stats.total_searches || 0,
          avgLatency: stats.avg_latency || 0,
          p95Latency: stats.p95_latency || 0,
          cacheHitRate: stats.cache_hit_rate || 0,
          topQueries: (topQueries || []).map((q) => ({
            query: q.query,
            count: q.query_count,
          })),
          searchesByMode: stats.searches_by_mode || {},
        };
      },
      {
        ttl: 300, // Cache for 5 minutes
        namespace: 'analytics',
      }
    );

    return cached;
  }

  /**
   * Get popular queries (uses materialized view)
   */
  static async getPopularQueries(
    orgId: string,
    limit: number = 20
  ): Promise<
    Array<{
      query: string;
      count: number;
      avgLatency: number;
      cacheHitRate: number;
    }>
  > {
    // Cache popular queries for 10 minutes
    const cacheKey = `popular:${orgId}:${limit}`;

    return this.cache.get(
      cacheKey,
      async () => {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from('popular_queries')
          .select('query, query_count, avg_latency, cache_hit_rate')
          .eq('org_id', orgId)
          .order('query_count', { ascending: false })
          .limit(limit);

        if (error || !data) {
          console.error('[SearchTracker] Failed to fetch popular queries:', error);
          return [];
        }

        return data.map((row) => ({
          query: row.query,
          count: row.query_count,
          avgLatency: row.avg_latency,
          cacheHitRate: row.cache_hit_rate,
        }));
      },
      {
        ttl: 600, // Cache for 10 minutes
        namespace: 'popular-queries',
      }
    );
  }

  private static getEmptyMetrics() {
    return {
      totalSearches: 0,
      avgLatency: 0,
      p95Latency: 0,
      cacheHitRate: 0,
      topQueries: [],
      searchesByMode: {},
    };
  }
}

// PostgreSQL function for efficient metrics aggregation
export const searchMetricsFunction = `
CREATE OR REPLACE FUNCTION get_search_metrics(
  p_org_id UUID,
  p_since TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 1000
) RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH metrics AS (
    SELECT
      COUNT(*) as total_searches,
      AVG(latency_ms) as avg_latency,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
      AVG(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hit_rate,
      jsonb_object_agg(mode, mode_count) as searches_by_mode
    FROM (
      SELECT
        latency_ms,
        cache_hit,
        mode,
        COUNT(*) OVER (PARTITION BY mode) as mode_count
      FROM search_analytics
      WHERE org_id = p_org_id
        AND created_at >= p_since
      LIMIT p_limit
    ) t
  )
  SELECT to_json(metrics.*) INTO v_result FROM metrics;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index for the function
CREATE INDEX IF NOT EXISTS idx_search_analytics_metrics
ON search_analytics(org_id, created_at DESC, latency_ms, cache_hit, mode)
WHERE created_at > now() - INTERVAL '30 days';
`;