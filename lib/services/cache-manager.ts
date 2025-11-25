/**
 * Enhanced Cache Manager Service
 *
 * Provides high-performance caching using Upstash Redis with:
 * - Query result caching
 * - API response caching
 * - Dashboard stats caching
 * - Library listings caching
 * - Automatic cache invalidation
 * - Cache warming strategies
 * - Performance monitoring
 */

import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache key generators
 */
export const CacheKeys = {
  // Library cache keys
  // SECURITY: Use SHA-256 instead of MD5 for cache key generation
  libraryListing: (orgId: string, filters: any) =>
    `library:${orgId}:${crypto.createHash('sha256').update(JSON.stringify(filters)).digest('hex')}`,

  libraryItem: (orgId: string, itemId: string) =>
    `library:item:${orgId}:${itemId}`,

  // Dashboard cache keys
  dashboardStats: (orgId: string, period: string) =>
    `dashboard:stats:${orgId}:${period}`,

  dashboardRecent: (orgId: string, limit: number) =>
    `dashboard:recent:${orgId}:${limit}`,

  // Search cache keys
  // SECURITY: Use SHA-256 instead of MD5 for cache key generation
  searchResults: (orgId: string, query: string, type: string) =>
    `search:${orgId}:${type}:${crypto.createHash('sha256').update(query).digest('hex')}`,

  // User/Org cache keys
  orgSettings: (orgId: string) =>
    `org:settings:${orgId}`,

  userProfile: (userId: string) =>
    `user:profile:${userId}`,

  // Tags cache
  tagsList: (orgId: string) =>
    `tags:list:${orgId}`,
};

/**
 * Cache TTL configuration (in seconds)
 */
export const CacheTTL = {
  // Short-lived caches
  searchResults: 300,        // 5 minutes
  dashboardRecent: 300,      // 5 minutes

  // Medium-lived caches
  libraryListing: 600,       // 10 minutes
  dashboardStats: 600,       // 10 minutes
  tagsList: 600,             // 10 minutes

  // Long-lived caches
  libraryItem: 900,          // 15 minutes
  orgSettings: 1800,         // 30 minutes
  userProfile: 3600,         // 1 hour

  // Performance metrics
  metrics: 3600,             // 1 hour
};

/**
 * Cache statistics tracking
 */
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  totalLatency: number;
  operationCount: number;
}

class CacheStatTracker {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalLatency: 0,
    operationCount: 0,
  };

  recordHit(latency: number) {
    this.stats.hits++;
    this.stats.totalLatency += latency;
    this.stats.operationCount++;
  }

  recordMiss(latency: number) {
    this.stats.misses++;
    this.stats.totalLatency += latency;
    this.stats.operationCount++;
  }

  recordError() {
    this.stats.errors++;
  }

  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    const avgLatency = this.stats.totalLatency / this.stats.operationCount || 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      avgLatency: Math.round(avgLatency),
    };
  }

  reset() {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalLatency: 0,
      operationCount: 0,
    };
  }
}

const cacheStats = new CacheStatTracker();

/**
 * Generic cache wrapper function with performance tracking
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300,
  options?: {
    forceRefresh?: boolean;
    skipCache?: boolean;
    compress?: boolean;
  }
): Promise<T> {
  const startTime = Date.now();

  // Skip cache if requested
  if (options?.skipCache) {
    return await fetcher();
  }

  // Force refresh if requested
  if (options?.forceRefresh) {
    const data = await fetcher();
    await setCached(key, data, ttl);
    return data;
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key);

    if (cached !== null) {
      const latency = Date.now() - startTime;
      cacheStats.recordHit(latency);

      // Log slow cache reads
      if (latency > 100) {
        console.warn(`[Cache] Slow read: ${key} took ${latency}ms`);
      }

      return cached as T;
    }

    // Cache miss - fetch fresh data
    cacheStats.recordMiss(Date.now() - startTime);

    const data = await fetcher();

    // Set in cache (fire and forget for performance)
    setCached(key, data, ttl).catch(error => {
      console.error('[Cache] Error setting cache:', error);
    });

    return data;

  } catch (error) {
    cacheStats.recordError();
    console.error('[Cache] Error accessing cache:', error);

    // Fallback to fetcher on cache error
    return await fetcher();
  }
}

/**
 * Set value in cache
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = 300
): Promise<void> {
  try {
    await redis.setex(key, ttl, value as any);
  } catch (error) {
    console.error('[Cache] Error setting value:', error);
    throw error;
  }
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    // For Upstash, we need to use scan to find matching keys
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });

      cursor = typeof result[0] === 'string' ? parseInt(result[0], 10) : result[0];
      keys.push(...(result[1] || []));
    } while (cursor !== 0);

    if (keys.length === 0) {
      return 0;
    }

    // Delete all matching keys
    await Promise.all(keys.map(key => redis.del(key)));

    console.log(`[Cache] Invalidated ${keys.length} keys matching ${pattern}`);
    return keys.length;

  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
    return 0;
  }
}

/**
 * Invalidate all caches for an organization
 */
export async function invalidateOrgCache(orgId: string): Promise<void> {
  const patterns = [
    `library:${orgId}:*`,
    `dashboard:*:${orgId}:*`,
    `search:${orgId}:*`,
    `org:settings:${orgId}`,
    `tags:list:${orgId}`,
  ];

  await Promise.all(patterns.map(pattern => invalidateCache(pattern)));
}

/**
 * Cache warming strategies
 */
export class CacheWarmer {
  /**
   * Warm dashboard stats cache
   */
  static async warmDashboardStats(orgId: string): Promise<void> {
    const periods = ['week', 'month', 'year', 'all'];

    await Promise.all(periods.map(async (period) => {
      const key = CacheKeys.dashboardStats(orgId, period);

      try {
        // Check if already cached
        const exists = await redis.exists(key);
        if (exists) return;

        // Fetch and cache stats
        const response = await fetch(`/api/dashboard/stats?period=${period}`, {
          headers: {
            'x-org-id': orgId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          await setCached(key, data, CacheTTL.dashboardStats);
        }
      } catch (error) {
        console.error(`[CacheWarmer] Error warming dashboard stats for ${period}:`, error);
      }
    }));
  }

  /**
   * Warm library cache for common filters
   */
  static async warmLibraryCache(orgId: string): Promise<void> {
    const commonFilters = [
      {}, // No filters (default view)
      { content_type: 'recording' },
      { content_type: 'document' },
      { status: 'completed' },
      { limit: 20 }, // First page
    ];

    await Promise.all(commonFilters.map(async (filters) => {
      const key = CacheKeys.libraryListing(orgId, filters);

      try {
        const exists = await redis.exists(key);
        if (exists) return;

        // Build query string
        const params = new URLSearchParams(filters as any);
        const response = await fetch(`/api/library?${params}`, {
          headers: {
            'x-org-id': orgId,
          },
        });

        if (response.ok) {
          const data = await response.json();
          await setCached(key, data, CacheTTL.libraryListing);
        }
      } catch (error) {
        console.error('[CacheWarmer] Error warming library cache:', error);
      }
    }));
  }
}

/**
 * Batch cache operations for efficiency
 */
export class BatchCache {
  private operations: Array<{
    type: 'get' | 'set' | 'del';
    key: string;
    value?: any;
    ttl?: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  private flushTimer?: NodeJS.Timeout;
  private readonly flushDelay = 10; // milliseconds
  private readonly maxBatchSize = 100;

  /**
   * Batch get operation
   */
  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.operations.push({
        type: 'get',
        key,
        resolve,
        reject,
      });

      this.scheduleFlush();
    });
  }

  /**
   * Batch set operation
   */
  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    return new Promise((resolve, reject) => {
      this.operations.push({
        type: 'set',
        key,
        value,
        ttl,
        resolve,
        reject,
      });

      this.scheduleFlush();
    });
  }

  /**
   * Schedule batch flush
   */
  private scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    if (this.operations.length >= this.maxBatchSize) {
      this.flush();
    } else {
      this.flushTimer = setTimeout(() => this.flush(), this.flushDelay);
    }
  }

  /**
   * Flush batch operations
   */
  private async flush() {
    if (this.operations.length === 0) return;

    const ops = [...this.operations];
    this.operations = [];

    // Group operations by type
    const getOps = ops.filter(op => op.type === 'get');
    const setOps = ops.filter(op => op.type === 'set');
    const delOps = ops.filter(op => op.type === 'del');

    try {
      // Execute batch gets
      if (getOps.length > 0) {
        const keys = getOps.map(op => op.key);
        const values = await redis.mget(...keys);

        getOps.forEach((op, index) => {
          op.resolve(values[index]);
        });
      }

      // Execute batch sets using pipeline
      if (setOps.length > 0) {
        const pipeline = redis.pipeline();

        setOps.forEach(op => {
          pipeline.setex(op.key, op.ttl || 300, op.value);
        });

        await pipeline.exec();

        setOps.forEach(op => {
          op.resolve(undefined);
        });
      }

      // Execute batch deletes
      if (delOps.length > 0) {
        const keys = delOps.map(op => op.key);
        await redis.del(...keys);

        delOps.forEach(op => {
          op.resolve(undefined);
        });
      }

    } catch (error) {
      // Reject all operations in this batch
      ops.forEach(op => {
        op.reject(error);
      });
    }
  }
}

export const batchCache = new BatchCache();

/**
 * Performance monitoring for cache operations
 */
export async function getCacheMetrics(): Promise<{
  stats: ReturnType<typeof cacheStats.getStats>;
  info: {
    keyCount?: number;
    memoryUsage?: string;
  };
}> {
  const stats = cacheStats.getStats();

  // Note: Upstash doesn't provide detailed info like memory usage
  // through the REST API, but we can get basic info
  let info = {};

  try {
    const dbSize = await redis.dbsize();
    info = {
      keyCount: dbSize,
    };
  } catch (error) {
    console.error('[Cache] Error getting cache info:', error);
  }

  return {
    stats,
    info,
  };
}

/**
 * Reset cache statistics (useful for monitoring periods)
 */
export function resetCacheStats() {
  cacheStats.reset();
}

/**
 * Export singleton instance for direct Redis access if needed
 */
export { redis };