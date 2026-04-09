/**
 * Search Analytics Service
 *
 * Provides SQL-queryable analytics from the search_metrics_archive table.
 * Enables long-term trend analysis, A/B testing evaluation, and search quality insights.
 *
 * Data sources:
 * - Real-time: Redis buffer (24h, via searchMonitor.getRecentMetrics)
 * - Historical: search_metrics_archive table (90-day retention)
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'search-analytics' });

export interface SearchMetricsSummary {
  totalSearches: number;
  successRate: number;
  avgSimilarity: number;
  avgTimeMs: number;
  retryRate: number;
  p50TimeMs: number;
  p95TimeMs: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface SearchTrend {
  date: string;
  totalSearches: number;
  successRate: number;
  avgSimilarity: number;
  avgTimeMs: number;
  retryRate: number;
}

export interface SlowSearchInfo {
  queryId: string;
  queryText: string;
  totalTimeMs: number;
  sourcesFound: number;
  avgSimilarity: number | null;
  retrievalAttempts: number;
  searchTimestamp: Date;
}

export interface FailedSearchInfo {
  queryId: string;
  queryText: string;
  totalTimeMs: number;
  retrievalAttempts: number;
  retriedWithLowerThreshold: boolean;
  retriedWithHybrid: boolean;
  retriedWithKeyword: boolean;
  searchTimestamp: Date;
}

/**
 * Get search metrics summary for an organization
 */
export async function getSearchMetricsSummary(
  orgId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<SearchMetricsSummary> {
  const supabase = createAdminClient();
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

  const { data, error } = await supabase
    .from('search_metrics_archive')
    .select('success, avg_similarity, total_time_ms, retrieval_attempts')
    .eq('org_id', orgId)
    .gte('search_timestamp', startDate.toISOString())
    .lte('search_timestamp', endDate.toISOString());

  if (error) {
    logger.error('Failed to fetch search metrics summary', { error: new Error(error.message) });
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      totalSearches: 0,
      successRate: 0,
      avgSimilarity: 0,
      avgTimeMs: 0,
      retryRate: 0,
      p50TimeMs: 0,
      p95TimeMs: 0,
      period: { start: startDate, end: endDate },
    };
  }

  const successful = data.filter((m) => m.success);
  const withRetries = data.filter((m) => m.retrieval_attempts > 1);
  const timesMs = data.map((m) => m.total_time_ms).sort((a, b) => a - b);

  const avgSimilarity =
    successful.reduce((sum, m) => sum + (m.avg_similarity || 0), 0) / (successful.length || 1);
  const avgTimeMs = data.reduce((sum, m) => sum + m.total_time_ms, 0) / data.length;

  // Calculate percentiles
  const p50Index = Math.floor(timesMs.length * 0.5);
  const p95Index = Math.floor(timesMs.length * 0.95);

  return {
    totalSearches: data.length,
    successRate: successful.length / data.length,
    avgSimilarity,
    avgTimeMs,
    retryRate: withRetries.length / data.length,
    p50TimeMs: timesMs[p50Index] || 0,
    p95TimeMs: timesMs[p95Index] || 0,
    period: { start: startDate, end: endDate },
  };
}

/**
 * Get daily search trends for an organization
 */
export async function getSearchTrends(
  orgId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<SearchTrend[]> {
  const supabase = createAdminClient();
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

  const { data, error } = await supabase
    .from('search_metrics_archive')
    .select('search_timestamp, success, avg_similarity, total_time_ms, retrieval_attempts')
    .eq('org_id', orgId)
    .gte('search_timestamp', startDate.toISOString())
    .lte('search_timestamp', endDate.toISOString())
    .order('search_timestamp', { ascending: true });

  if (error) {
    logger.error('Failed to fetch search trends', { error: new Error(error.message) });
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by date
  const byDate = new Map<string, typeof data>();
  for (const metric of data) {
    const date = new Date(metric.search_timestamp).toISOString().split('T')[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(metric);
  }

  // Calculate daily metrics
  const trends: SearchTrend[] = [];
  for (const [date, metrics] of byDate) {
    const successful = metrics.filter((m) => m.success);
    const withRetries = metrics.filter((m) => m.retrieval_attempts > 1);
    const avgSimilarity =
      successful.reduce((sum, m) => sum + (m.avg_similarity || 0), 0) / (successful.length || 1);
    const avgTimeMs = metrics.reduce((sum, m) => sum + m.total_time_ms, 0) / metrics.length;

    trends.push({
      date,
      totalSearches: metrics.length,
      successRate: successful.length / metrics.length,
      avgSimilarity,
      avgTimeMs,
      retryRate: withRetries.length / metrics.length,
    });
  }

  return trends;
}

/**
 * Get slow searches (above threshold) for an organization
 */
export async function getSlowSearches(
  orgId: string,
  options: {
    thresholdMs?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<SlowSearchInfo[]> {
  const supabase = createAdminClient();
  const { thresholdMs = 2000, limit = 20 } = options;
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('search_metrics_archive')
    .select('query_id, query_text, total_time_ms, sources_found, avg_similarity, retrieval_attempts, search_timestamp')
    .eq('org_id', orgId)
    .gte('total_time_ms', thresholdMs)
    .gte('search_timestamp', startDate.toISOString())
    .lte('search_timestamp', endDate.toISOString())
    .order('total_time_ms', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch slow searches', { error: new Error(error.message) });
    throw error;
  }

  return (data || []).map((s) => ({
    queryId: s.query_id,
    queryText: s.query_text,
    totalTimeMs: s.total_time_ms,
    sourcesFound: s.sources_found,
    avgSimilarity: s.avg_similarity,
    retrievalAttempts: s.retrieval_attempts,
    searchTimestamp: new Date(s.search_timestamp),
  }));
}

/**
 * Get failed searches for an organization
 */
export async function getFailedSearches(
  orgId: string,
  options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<FailedSearchInfo[]> {
  const supabase = createAdminClient();
  const { limit = 20 } = options;
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('search_metrics_archive')
    .select('query_id, query_text, total_time_ms, retrieval_attempts, retried_with_lower_threshold, retried_with_hybrid, retried_with_keyword, search_timestamp')
    .eq('org_id', orgId)
    .eq('success', false)
    .gte('search_timestamp', startDate.toISOString())
    .lte('search_timestamp', endDate.toISOString())
    .order('search_timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch failed searches', { error: new Error(error.message) });
    throw error;
  }

  return (data || []).map((s) => ({
    queryId: s.query_id,
    queryText: s.query_text,
    totalTimeMs: s.total_time_ms,
    retrievalAttempts: s.retrieval_attempts,
    retriedWithLowerThreshold: s.retried_with_lower_threshold,
    retriedWithHybrid: s.retried_with_hybrid,
    retriedWithKeyword: s.retried_with_keyword,
    searchTimestamp: new Date(s.search_timestamp),
  }));
}

/**
 * Compare search metrics between two time periods (for A/B testing analysis)
 */
export async function compareSearchPeriods(
  orgId: string,
  periodA: { start: Date; end: Date },
  periodB: { start: Date; end: Date }
): Promise<{
  periodA: SearchMetricsSummary;
  periodB: SearchMetricsSummary;
  delta: {
    successRateDelta: number;
    avgSimilarityDelta: number;
    avgTimeMsDelta: number;
    retryRateDelta: number;
  };
}> {
  const [metricsA, metricsB] = await Promise.all([
    getSearchMetricsSummary(orgId, { startDate: periodA.start, endDate: periodA.end }),
    getSearchMetricsSummary(orgId, { startDate: periodB.start, endDate: periodB.end }),
  ]);

  return {
    periodA: metricsA,
    periodB: metricsB,
    delta: {
      successRateDelta: metricsB.successRate - metricsA.successRate,
      avgSimilarityDelta: metricsB.avgSimilarity - metricsA.avgSimilarity,
      avgTimeMsDelta: metricsB.avgTimeMs - metricsA.avgTimeMs,
      retryRateDelta: metricsB.retryRate - metricsA.retryRate,
    },
  };
}

/**
 * Get search strategy effectiveness breakdown
 */
export async function getStrategyBreakdown(
  orgId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<Array<{
  strategy: string;
  totalSearches: number;
  successRate: number;
  avgSimilarity: number;
  avgTimeMs: number;
}>> {
  const supabase = createAdminClient();
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('search_metrics_archive')
    .select('strategy, success, avg_similarity, total_time_ms')
    .eq('org_id', orgId)
    .gte('search_timestamp', startDate.toISOString())
    .lte('search_timestamp', endDate.toISOString());

  if (error) {
    logger.error('Failed to fetch strategy breakdown', { error: new Error(error.message) });
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Group by strategy
  const byStrategy = new Map<string, typeof data>();
  for (const metric of data) {
    const strategy = metric.strategy || 'unknown';
    if (!byStrategy.has(strategy)) {
      byStrategy.set(strategy, []);
    }
    byStrategy.get(strategy)!.push(metric);
  }

  // Calculate metrics per strategy
  const breakdown: Array<{
    strategy: string;
    totalSearches: number;
    successRate: number;
    avgSimilarity: number;
    avgTimeMs: number;
  }> = [];

  for (const [strategy, metrics] of byStrategy) {
    const successful = metrics.filter((m) => m.success);
    const avgSimilarity =
      successful.reduce((sum, m) => sum + (m.avg_similarity || 0), 0) / (successful.length || 1);
    const avgTimeMs = metrics.reduce((sum, m) => sum + m.total_time_ms, 0) / metrics.length;

    breakdown.push({
      strategy,
      totalSearches: metrics.length,
      successRate: successful.length / metrics.length,
      avgSimilarity,
      avgTimeMs,
    });
  }

  // Sort by total searches descending
  return breakdown.sort((a, b) => b.totalSearches - a.totalSearches);
}
