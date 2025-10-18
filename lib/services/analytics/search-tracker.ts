import { createClient } from '@/lib/supabase/admin';

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

export class SearchTracker {
  /**
   * Track a search event
   */
  static async trackSearch(data: SearchTrackingData): Promise<void> {
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
  }

  /**
   * Track user feedback on search results
   */
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
    const supabase = await createClient();

    try {
      const { error } = await supabase.from('search_feedback').insert({
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

      if (error) {
        console.error('[SearchTracker] Failed to track feedback:', error);
      }
    } catch (error) {
      console.error('[SearchTracker] Unexpected error:', error);
    }
  }

  /**
   * Get search metrics for organization
   */
  static async getMetrics(
    orgId: string,
    days: number = 7
  ): Promise<{
    totalSearches: number;
    avgLatency: number;
    p95Latency: number;
    cacheHitRate: number;
    topQueries: Array<{ query: string; count: number }>;
    searchesByMode: Record<string, number>;
  }> {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: analytics, error } = await supabase
      .from('search_analytics')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', since.toISOString());

    if (error || !analytics || analytics.length === 0) {
      return {
        totalSearches: 0,
        avgLatency: 0,
        p95Latency: 0,
        cacheHitRate: 0,
        topQueries: [],
        searchesByMode: {},
      };
    }

    // Calculate metrics
    const totalSearches = analytics.length;
    const avgLatency =
      analytics.reduce((sum, a) => sum + a.latency_ms, 0) / totalSearches;

    // P95 latency
    const sortedLatencies = analytics
      .map((a) => a.latency_ms)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] || 0;

    // Cache hit rate
    const cacheHits = analytics.filter((a) => a.cache_hit).length;
    const cacheHitRate = cacheHits / totalSearches;

    // Top queries
    const queryCounts = new Map<string, number>();
    analytics.forEach((a) => {
      queryCounts.set(a.query, (queryCounts.get(a.query) || 0) + 1);
    });

    const topQueries = Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Searches by mode
    const searchesByMode: Record<string, number> = {};
    analytics.forEach((a) => {
      searchesByMode[a.mode] = (searchesByMode[a.mode] || 0) + 1;
    });

    return {
      totalSearches,
      avgLatency,
      p95Latency,
      cacheHitRate,
      topQueries,
      searchesByMode,
    };
  }

  /**
   * Get popular queries
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
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('popular_queries')
      .select('*')
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
  }
}
