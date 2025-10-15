/**
 * Enhanced Database Query Optimization
 *
 * Provides:
 * - Query performance monitoring
 * - Automatic slow query detection
 * - Query result caching
 * - Connection pooling optimization
 * - Index usage tracking
 * - Query explain plan analysis
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getCached, setCached, CacheTTL } from '@/lib/services/cache-manager';

/**
 * Performance thresholds
 */
const THRESHOLDS = {
  SLOW_QUERY_MS: 500,      // Warn if query > 500ms
  CRITICAL_QUERY_MS: 1000,  // Error if query > 1s
  CACHE_ELIGIBLE_MS: 100,   // Cache if query > 100ms
};

/**
 * Query performance metrics
 */
interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  rowCount?: number;
  cached: boolean;
}

class QueryPerformanceTracker {
  private metrics: QueryMetrics[] = [];
  private slowQueries: QueryMetrics[] = [];

  record(metrics: QueryMetrics) {
    this.metrics.push(metrics);

    // Keep only last 1000 queries
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Track slow queries separately
    if (metrics.duration >= THRESHOLDS.SLOW_QUERY_MS) {
      this.slowQueries.push(metrics);

      if (metrics.duration >= THRESHOLDS.CRITICAL_QUERY_MS) {
        console.error('[QueryOptimizer] CRITICAL slow query detected:', {
          query: metrics.query,
          duration: `${metrics.duration}ms`,
          rowCount: metrics.rowCount,
        });
      } else {
        console.warn('[QueryOptimizer] Slow query detected:', {
          query: metrics.query,
          duration: `${metrics.duration}ms`,
          rowCount: metrics.rowCount,
        });
      }
    }
  }

  getStats() {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        avgDuration: 0,
        slowQueryCount: 0,
        cacheHitRate: 0,
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const cachedQueries = this.metrics.filter(m => m.cached).length;

    return {
      totalQueries: this.metrics.length,
      avgDuration: Math.round(totalDuration / this.metrics.length),
      slowQueryCount: this.slowQueries.length,
      cacheHitRate: Math.round((cachedQueries / this.metrics.length) * 100),
      slowestQueries: this.slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
    };
  }

  reset() {
    this.metrics = [];
    this.slowQueries = [];
  }
}

const queryTracker = new QueryPerformanceTracker();

/**
 * Optimized query executor with caching and monitoring
 */
export async function executeQuery<T>(
  supabase: SupabaseClient,
  queryBuilder: () => any,
  options?: {
    cacheKey?: string;
    cacheTTL?: number;
    skipCache?: boolean;
    queryName?: string;
  }
): Promise<{ data: T | null; error: any; metrics: QueryMetrics }> {
  const startTime = Date.now();
  const queryName = options?.queryName || 'unknown';

  // Try cache first
  if (options?.cacheKey && !options?.skipCache) {
    try {
      const cached = await getCached<T>(
        options.cacheKey,
        async () => {
          const result = await queryBuilder();
          return result.data;
        },
        options.cacheTTL || CacheTTL.searchResults
      );

      const metrics: QueryMetrics = {
        query: queryName,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        cached: true,
      };

      queryTracker.record(metrics);

      return { data: cached, error: null, metrics };
    } catch (error) {
      console.error('[QueryOptimizer] Cache error:', error);
      // Fall through to direct query
    }
  }

  // Execute query
  const result = await queryBuilder();
  const duration = Date.now() - startTime;

  const metrics: QueryMetrics = {
    query: queryName,
    duration,
    timestamp: new Date(),
    rowCount: Array.isArray(result.data) ? result.data.length : 1,
    cached: false,
  };

  queryTracker.record(metrics);

  // Cache result if query was slow
  if (
    options?.cacheKey &&
    !options?.skipCache &&
    duration >= THRESHOLDS.CACHE_ELIGIBLE_MS &&
    !result.error
  ) {
    setCached(options.cacheKey, result.data, options.cacheTTL || CacheTTL.searchResults)
      .catch(error => console.error('[QueryOptimizer] Error caching result:', error));
  }

  return { data: result.data, error: result.error, metrics };
}

/**
 * Batch query executor for parallel operations
 */
export async function executeBatchQueries<T extends Record<string, any>>(
  queries: Record<string, () => Promise<any>>
): Promise<T> {
  const startTime = Date.now();

  const entries = Object.entries(queries);
  const results = await Promise.all(
    entries.map(([key, queryFn]) =>
      queryFn()
        .then(result => ({ key, result, error: null }))
        .catch(error => ({ key, result: null, error }))
    )
  );

  const duration = Date.now() - startTime;

  // Log if batch took too long
  if (duration > THRESHOLDS.SLOW_QUERY_MS) {
    console.warn(`[QueryOptimizer] Slow batch query: ${duration}ms for ${entries.length} queries`);
  }

  // Combine results
  const combined = results.reduce((acc, { key, result, error }) => {
    if (error) {
      console.error(`[QueryOptimizer] Batch query error for ${key}:`, error);
    }
    acc[key] = result;
    return acc;
  }, {} as T);

  return combined;
}

/**
 * Optimized paginated query with cursor-based pagination
 */
export interface PaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'next' | 'prev';
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export async function paginatedQuery<T extends { id: string; created_at: string }>(
  supabase: SupabaseClient,
  table: string,
  params: PaginationParams & {
    filters?: Record<string, any>;
    orderBy?: keyof T;
    orderDir?: 'asc' | 'desc';
    select?: string;
    cacheKey?: string;
  }
): Promise<PaginatedResponse<T>> {
  const {
    limit = 50,
    cursor,
    direction = 'next',
    filters = {},
    orderBy = 'created_at' as keyof T,
    orderDir = 'desc',
    select = '*',
  } = params;

  const startTime = Date.now();

  // Build query
  let query = supabase
    .from(table)
    .select(select, { count: 'exact' });

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'object' && value.operator) {
        // Support advanced operators like { operator: 'gte', value: date }
        const { operator, value: filterValue } = value;
        query = (query as any)[operator](key, filterValue);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  // Apply cursor pagination
  if (cursor) {
    const operator = direction === 'next'
      ? (orderDir === 'desc' ? 'lt' : 'gt')
      : (orderDir === 'desc' ? 'gt' : 'lt');

    query = (query as any)[operator](orderBy, cursor);
  }

  // Order and limit (get one extra to check hasMore)
  query = query
    .order(orderBy as string, { ascending: orderDir === 'asc' })
    .limit(limit + 1);

  // Execute query with caching
  const result = await executeQuery<T[]>(
    supabase,
    () => query,
    {
      cacheKey: params.cacheKey,
      cacheTTL: CacheTTL.libraryListing,
      queryName: `paginated_${table}`,
    }
  );

  if (result.error) {
    throw result.error;
  }

  const items = result.data || [];
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  // Calculate cursors
  const nextCursor = hasMore && pageItems.length > 0
    ? pageItems[pageItems.length - 1][orderBy] as string
    : undefined;

  const prevCursor = cursor && pageItems.length > 0
    ? pageItems[0][orderBy] as string
    : undefined;

  const duration = Date.now() - startTime;

  // Log performance
  if (duration > THRESHOLDS.SLOW_QUERY_MS) {
    console.warn(`[QueryOptimizer] Slow paginated query on ${table}: ${duration}ms`);
  }

  return {
    data: pageItems,
    nextCursor,
    prevCursor,
    hasMore,
    totalCount: (query as any).count || undefined,
  };
}

/**
 * Query optimization recommendations
 */
export const OPTIMIZATION_QUERIES = {
  // Add missing indexes for new content type support
  contentTypeIndexes: `
    -- Content type filtering optimization
    CREATE INDEX IF NOT EXISTS idx_recordings_org_content_created
      ON recordings(org_id, content_type, created_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_recordings_org_content_status
      ON recordings(org_id, content_type, status)
      WHERE deleted_at IS NULL;
  `,

  // Status-based queries optimization
  statusIndexes: `
    -- Status filtering optimization
    CREATE INDEX IF NOT EXISTS idx_recordings_status_created
      ON recordings(status, created_at DESC)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_recordings_org_status
      ON recordings(org_id, status)
      WHERE deleted_at IS NULL;
  `,

  // Search optimization
  searchIndexes: `
    -- Text search optimization
    CREATE INDEX IF NOT EXISTS idx_recordings_title_trgm
      ON recordings USING gin (title gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_recordings_description_trgm
      ON recordings USING gin (description gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_recordings_filename_trgm
      ON recordings USING gin (original_filename gin_trgm_ops);
  `,

  // Soft delete optimization
  softDeleteIndexes: `
    -- Soft delete optimization
    CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at
      ON recordings(deleted_at)
      WHERE deleted_at IS NOT NULL;
  `,

  // Tags optimization
  tagsIndexes: `
    -- Tags optimization
    CREATE INDEX IF NOT EXISTS idx_tags_org_deleted
      ON tags(org_id, deleted_at);

    CREATE INDEX IF NOT EXISTS idx_recording_tags_composite
      ON recording_tags(recording_id, tag_id);
  `,

  // Jobs optimization
  jobsIndexes: `
    -- Jobs queue optimization
    CREATE INDEX IF NOT EXISTS idx_jobs_pending_run_after
      ON jobs(run_after, created_at)
      WHERE status = 'pending';

    CREATE INDEX IF NOT EXISTS idx_jobs_org_status
      ON jobs(org_id, status, created_at DESC);
  `,

  // Analytics queries optimization
  analyticsIndexes: `
    -- Analytics optimization
    CREATE INDEX IF NOT EXISTS idx_search_logs_org_created
      ON search_logs(org_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_search_logs_user_created
      ON search_logs(user_id, created_at DESC);
  `,
};

/**
 * Connection pool optimization settings
 */
export const CONNECTION_POOL_CONFIG = {
  // Maximum number of connections
  max: 20,

  // Minimum number of connections
  min: 2,

  // Connection timeout in milliseconds
  connectionTimeoutMillis: 10000,

  // Idle timeout in milliseconds
  idleTimeoutMillis: 30000,

  // Statement timeout in milliseconds
  statement_timeout: 30000,

  // Query timeout in milliseconds
  query_timeout: 30000,
};

/**
 * Get query performance statistics
 */
export function getQueryStats() {
  return queryTracker.getStats();
}

/**
 * Reset query statistics
 */
export function resetQueryStats() {
  queryTracker.reset();
}

/**
 * Export query plan analyzer (for debugging)
 */
export async function analyzeQuery(
  supabase: SupabaseClient,
  sql: string
): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('explain_query', {
      query_text: sql,
    });

    if (error) {
      console.error('[QueryOptimizer] Error analyzing query:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[QueryOptimizer] Error analyzing query:', error);
    return null;
  }
}