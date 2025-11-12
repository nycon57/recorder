/**
 * Centralized Caching Service
 *
 * Provides Redis-based caching with TTL, invalidation, and deduplication.
 * Optimizes API performance by reducing redundant database queries.
 *
 * Performance improvements:
 * - User lookups: Cached for 5 minutes (eliminates 10+ DB queries per request)
 * - Tags/Collections: Cached for 10 minutes (static data, rarely changes)
 * - Dashboard stats: Cached for 1 minute (aggregation queries are expensive)
 * - Request deduplication: Prevents concurrent identical requests
 */

import { getRedis } from '@/lib/rate-limit/redis';

/**
 * Cache key prefixes for different data types
 */
const CACHE_PREFIXES = {
  USER: 'cache:user',
  TAGS: 'cache:tags',
  COLLECTIONS: 'cache:collections',
  STATS: 'cache:stats',
  LIBRARY_META: 'cache:library:meta',
  DEDUP: 'dedup',
} as const;

/**
 * Cache TTL (time-to-live) in seconds
 */
const CACHE_TTL = {
  USER: 300,          // 5 minutes - User data changes infrequently
  TAGS: 600,          // 10 minutes - Tags are relatively static
  COLLECTIONS: 600,   // 10 minutes - Collections are relatively static
  STATS: 60,          // 1 minute - Stats need to be relatively fresh
  LIBRARY_META: 600,  // 10 minutes - Combined tags + collections metadata
  DEDUP: 10,          // 10 seconds - Request deduplication window
} as const;

/**
 * User data cache entry
 */
export interface CachedUser {
  id: string;           // Internal UUID
  clerkUserId: string;  // Clerk user ID
  orgId: string;        // Internal org UUID
  role: string;
  email?: string;
  name?: string;
}

/**
 * Tag cache entry
 */
export interface CachedTag {
  id: string;
  name: string;
  color: string;
  usage_count?: number;
}

/**
 * Collection cache entry
 */
export interface CachedCollection {
  id: string;
  name: string;
  description?: string;
  item_count?: number;
}

/**
 * Dashboard stats cache entry
 */
export interface CachedStats {
  totalItems: number;
  storageUsedBytes: number;
  itemsThisWeek: number;
  itemsThisMonth?: number;
  processingCount: number;
  breakdown?: Record<string, { count: number; storageBytes: number }>;
  statusBreakdown?: Record<string, number>;
}

/**
 * Library metadata cache entry
 */
export interface CachedLibraryMetadata {
  tags: CachedTag[];
  collections: CachedCollection[];
  counts: {
    totalTags: number;
    totalCollections: number;
  };
}

/**
 * Generic cache get/set/delete operations
 */
export class CacheService {
  /**
   * Get cached data by key
   */
  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) {
      return null;
    }

    try {
      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      // Redis returns string, parse JSON
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch (error) {
      console.error('[Cache] Error getting cached value:', error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('[Cache] Error setting cached value:', error);
    }
  }

  /**
   * Delete cached data
   */
  static async delete(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.del(key);
    } catch (error) {
      console.error('[Cache] Error deleting cached value:', error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Uses non-blocking SCAN to iterate through matching keys
   * WARNING: Use sparingly in production
   */
  static async deletePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    if (!redis) {
      return;
    }

    try {
      let cursor = '0';
      let keysToDelete: string[] = [];
      const batchSize = 100; // Delete in batches to avoid excessive memory usage

      do {
        // Scan for matching keys (non-blocking)
        const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        const matchedKeys = result[1];

        if (matchedKeys.length > 0) {
          keysToDelete.push(...matchedKeys);

          // Delete in batches to avoid building up too many keys in memory
          if (keysToDelete.length >= batchSize) {
            // Use unlink for non-blocking deletion
            await redis.unlink(...keysToDelete);
            keysToDelete = [];
          }
        }
      } while (cursor !== '0');

      // Delete any remaining keys
      if (keysToDelete.length > 0) {
        await redis.unlink(...keysToDelete);
      }
    } catch (error) {
      console.error('[Cache] Error deleting pattern:', error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Cache] Error checking key existence:', error);
      return false;
    }
  }
}

/**
 * User-specific caching operations
 */
export class UserCache {
  /**
   * Build cache key for user by Clerk ID
   */
  private static buildKey(clerkUserId: string): string {
    return `${CACHE_PREFIXES.USER}:${clerkUserId}`;
  }

  /**
   * Get cached user by Clerk ID
   */
  static async get(clerkUserId: string): Promise<CachedUser | null> {
    const key = this.buildKey(clerkUserId);
    return CacheService.get<CachedUser>(key);
  }

  /**
   * Set cached user data
   */
  static async set(clerkUserId: string, user: CachedUser): Promise<void> {
    const key = this.buildKey(clerkUserId);
    await CacheService.set(key, user, CACHE_TTL.USER);
  }

  /**
   * Invalidate user cache
   */
  static async invalidate(clerkUserId: string): Promise<void> {
    const key = this.buildKey(clerkUserId);
    await CacheService.delete(key);
  }

  /**
   * Invalidate all users in an org (e.g., when org settings change)
   */
  static async invalidateOrg(orgId: string): Promise<void> {
    // This is expensive - use sparingly
    await CacheService.deletePattern(`${CACHE_PREFIXES.USER}:*`);
  }
}

/**
 * Tags caching operations
 */
export class TagsCache {
  /**
   * Build cache key for org tags
   */
  private static buildKey(orgId: string): string {
    return `${CACHE_PREFIXES.TAGS}:${orgId}`;
  }

  /**
   * Get cached tags for org
   */
  static async get(orgId: string): Promise<CachedTag[] | null> {
    const key = this.buildKey(orgId);
    return CacheService.get<CachedTag[]>(key);
  }

  /**
   * Set cached tags for org
   */
  static async set(orgId: string, tags: CachedTag[]): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.set(key, tags, CACHE_TTL.TAGS);
  }

  /**
   * Invalidate tags cache for org
   */
  static async invalidate(orgId: string): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.delete(key);
  }
}

/**
 * Collections caching operations
 */
export class CollectionsCache {
  /**
   * Build cache key for org collections
   */
  private static buildKey(orgId: string): string {
    return `${CACHE_PREFIXES.COLLECTIONS}:${orgId}`;
  }

  /**
   * Get cached collections for org
   */
  static async get(orgId: string): Promise<CachedCollection[] | null> {
    const key = this.buildKey(orgId);
    return CacheService.get<CachedCollection[]>(key);
  }

  /**
   * Set cached collections for org
   */
  static async set(orgId: string, collections: CachedCollection[]): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.set(key, collections, CACHE_TTL.COLLECTIONS);
  }

  /**
   * Invalidate collections cache for org
   */
  static async invalidate(orgId: string): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.delete(key);
  }
}

/**
 * Dashboard stats caching operations
 */
export class StatsCache {
  /**
   * Build cache key for dashboard stats
   */
  private static buildKey(orgId: string, period?: string): string {
    const periodSuffix = period ? `:${period}` : '';
    return `${CACHE_PREFIXES.STATS}:${orgId}${periodSuffix}`;
  }

  /**
   * Get cached dashboard stats
   */
  static async get(orgId: string, period?: string): Promise<CachedStats | null> {
    const key = this.buildKey(orgId, period);
    return CacheService.get<CachedStats>(key);
  }

  /**
   * Set cached dashboard stats
   */
  static async set(orgId: string, stats: CachedStats, period?: string): Promise<void> {
    const key = this.buildKey(orgId, period);
    await CacheService.set(key, stats, CACHE_TTL.STATS);
  }

  /**
   * Invalidate dashboard stats cache
   */
  static async invalidate(orgId: string): Promise<void> {
    // Invalidate all period variations
    await CacheService.deletePattern(`${CACHE_PREFIXES.STATS}:${orgId}*`);
  }
}

/**
 * Library metadata caching operations
 */
export class LibraryMetadataCache {
  /**
   * Build cache key for library metadata
   */
  private static buildKey(orgId: string): string {
    return `${CACHE_PREFIXES.LIBRARY_META}:${orgId}`;
  }

  /**
   * Get cached library metadata
   */
  static async get(orgId: string): Promise<CachedLibraryMetadata | null> {
    const key = this.buildKey(orgId);
    return CacheService.get<CachedLibraryMetadata>(key);
  }

  /**
   * Set cached library metadata
   */
  static async set(orgId: string, metadata: CachedLibraryMetadata): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.set(key, metadata, CACHE_TTL.LIBRARY_META);
  }

  /**
   * Invalidate library metadata cache
   */
  static async invalidate(orgId: string): Promise<void> {
    const key = this.buildKey(orgId);
    await CacheService.delete(key);

    // Also invalidate individual caches
    await TagsCache.invalidate(orgId);
    await CollectionsCache.invalidate(orgId);
  }
}

/**
 * Request deduplication service
 * Prevents concurrent identical requests from hitting the database
 */
export class RequestDeduplication {
  /**
   * Build dedup key
   */
  private static buildKey(uniqueId: string): string {
    return `${CACHE_PREFIXES.DEDUP}:${uniqueId}`;
  }

  /**
   * Check if request is already in-flight
   * Returns cached result if available
   */
  static async get<T>(uniqueId: string): Promise<T | null> {
    const key = this.buildKey(uniqueId);
    return CacheService.get<T>(key);
  }

  /**
   * Mark request as in-flight and cache the result
   */
  static async set<T>(uniqueId: string, result: T): Promise<void> {
    const key = this.buildKey(uniqueId);
    await CacheService.set(key, result, CACHE_TTL.DEDUP);
  }

  /**
   * Execute function with deduplication
   * If another request is in-flight, wait for its result
   * Returns both the result and whether it was a cache hit
   */
  static async execute<T>(
    uniqueId: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; cacheHit: boolean }> {
    const redis = getRedis();
    const lockKey = `${this.buildKey(uniqueId)}:lock`;
    const lockTTL = 30; // Lock expires after 30 seconds to prevent deadlocks
    const lockToken = Math.random().toString(36).substring(7);

    // First, quick check without lock
    const quickCheck = await this.get<T>(uniqueId);
    if (quickCheck !== null) {
      return { result: quickCheck, cacheHit: true };
    }

    // Try to acquire lock using SETNX (set if not exists)
    if (redis) {
      try {
        const acquired = await redis.set(lockKey, lockToken, 'EX', lockTTL, 'NX');

        if (acquired === 'OK') {
          // We got the lock - check cache again (in case it was set while we were acquiring lock)
          const recheck = await this.get<T>(uniqueId);
          if (recheck !== null) {
            // Cache was populated by another request, release lock and return
            await this.releaseLock(lockKey, lockToken);
            return { result: recheck, cacheHit: true };
          }

          // Execute function and cache result
          try {
            const result = await fn();
            await this.set(uniqueId, result);
            return { result, cacheHit: false };
          } finally {
            // Always release lock, even if fn() throws
            await this.releaseLock(lockKey, lockToken);
          }
        } else {
          // Lock is held by another request, wait and poll for cached result
          const pollResult = await this.pollForResult<T>(uniqueId, 5000); // Wait up to 5 seconds
          if (pollResult !== null) {
            return { result: pollResult, cacheHit: true };
          }
          // Fallback: execute anyway if polling times out
        }
      } catch (error) {
        console.error('[RequestDedup] Lock acquisition error:', error);
        // Fallback to executing without lock
      }
    }

    // Fallback path (no Redis or lock failed): execute and cache
    const result = await fn();
    await this.set(uniqueId, result);
    return { result, cacheHit: false };
  }

  /**
   * Release lock safely (only if we own it)
   */
  private static async releaseLock(lockKey: string, lockToken: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      // Lua script to safely release lock only if we own it
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(script, 1, lockKey, lockToken);
    } catch (error) {
      console.error('[RequestDedup] Lock release error:', error);
    }
  }

  /**
   * Poll for cached result (used when waiting for another request to finish)
   */
  private static async pollForResult<T>(
    uniqueId: string,
    timeoutMs: number
  ): Promise<T | null> {
    const startTime = Date.now();
    const pollInterval = 100; // Poll every 100ms

    while (Date.now() - startTime < timeoutMs) {
      const cached = await this.get<T>(uniqueId);
      if (cached !== null) {
        return cached;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return null;
  }
}

/**
 * Cache invalidation helpers
 * Call these when data changes to ensure cache consistency
 */
export const CacheInvalidation = {
  /**
   * Invalidate all caches for an org
   * Use when org-level data changes (rare)
   */
  async invalidateOrg(orgId: string): Promise<void> {
    await Promise.all([
      TagsCache.invalidate(orgId),
      CollectionsCache.invalidate(orgId),
      StatsCache.invalidate(orgId),
      LibraryMetadataCache.invalidate(orgId),
    ]);
  },

  /**
   * Invalidate when a tag is created/updated/deleted
   */
  async invalidateTags(orgId: string): Promise<void> {
    await Promise.all([
      TagsCache.invalidate(orgId),
      LibraryMetadataCache.invalidate(orgId),
    ]);
  },

  /**
   * Invalidate when a collection is created/updated/deleted
   */
  async invalidateCollections(orgId: string): Promise<void> {
    await Promise.all([
      CollectionsCache.invalidate(orgId),
      LibraryMetadataCache.invalidate(orgId),
    ]);
  },

  /**
   * Invalidate when content is created/updated/deleted
   */
  async invalidateContent(orgId: string): Promise<void> {
    await StatsCache.invalidate(orgId);
    // Also invalidate library metadata if counts change
    await LibraryMetadataCache.invalidate(orgId);
  },

  /**
   * Invalidate user cache (e.g., when user role changes)
   */
  async invalidateUser(clerkUserId: string): Promise<void> {
    await UserCache.invalidate(clerkUserId);
  },
};

/**
 * Generate ETag for cache validation
 */
export function generateETag(data: any): string {
  // Simple hash based on stringified data
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `"${Math.abs(hash).toString(36)}"`;
}

/**
 * Cache control headers for different data types
 */
export const CacheControlHeaders = {
  /**
   * User data - Cache for 5 minutes
   */
  user: 'private, max-age=300, must-revalidate',

  /**
   * Tags/Collections - Cache for 10 minutes
   */
  metadata: 'private, max-age=600, must-revalidate',

  /**
   * Dashboard stats - Cache for 1 minute
   */
  stats: 'private, max-age=60, must-revalidate',

  /**
   * Content list - Cache for 30 seconds (changes frequently)
   */
  content: 'private, max-age=30, must-revalidate',

  /**
   * No cache - Always fetch fresh
   */
  noCache: 'private, no-cache, no-store, must-revalidate',
};
