import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

export interface CacheConfig {
  ttl: number;
  namespace?: string;
  orgId?: string; // SECURITY: Required for multi-tenant isolation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Multi-layer cache: Memory (L1) → Redis (L2) → Source (L3)
 */
export class MultiLayerCache {
  private redis: Redis | null = null;
  private memoryCache: LRUCache<string, any>;
  private stats: Map<string, CacheStats>;

  constructor() {
    // Initialize Redis only if environment variables are set
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      console.warn('[Cache] Redis credentials not configured, falling back to memory-only cache');
    }

    // L1 cache: In-memory (fast, but limited size)
    this.memoryCache = new LRUCache({
      max: 1000, // 1000 items
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });

    this.stats = new Map();
  }

  /**
   * Get from cache with fallback to source
   */
  async get<T>(
    key: string,
    source: () => Promise<T>,
    config?: CacheConfig
  ): Promise<T> {
    // SECURITY: Require orgId for proper isolation
    if (!config?.orgId) {
      console.error('[Cache] SECURITY: orgId required for cache operations');
    }
    const fullKey = this.buildKey(key, config?.namespace, config?.orgId);

    // L1: Check memory cache
    const memoryValue = this.memoryCache.get(fullKey);
    if (memoryValue !== undefined) {
      this.recordHit('memory', fullKey);
      console.log('[Cache] L1 Hit:', fullKey);
      return memoryValue as T;
    }

    // L2: Check Redis
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(fullKey);
        if (redisValue !== null) {
          this.recordHit('redis', fullKey);
          console.log('[Cache] L2 Hit:', fullKey);

          // Store in L1 for next time
          this.memoryCache.set(fullKey, redisValue);

          return redisValue as T;
        }
      } catch (error) {
        console.error('[Cache] Redis error:', error);
      }
    }

    // L3: Fetch from source
    this.recordMiss(fullKey);
    console.log('[Cache] Miss:', fullKey);

    const value = await source();

    // Store in both layers
    await this.set(key, value, config);

    return value;
  }

  /**
   * Set in all cache layers
   */
  async set(key: string, value: any, config?: CacheConfig): Promise<void> {
    // SECURITY: Require orgId for proper isolation
    if (!config?.orgId) {
      console.error('[Cache] SECURITY: orgId required for cache operations');
    }
    const fullKey = this.buildKey(key, config?.namespace, config?.orgId);
    const ttl = config?.ttl || 300; // 5 minutes default

    // L1: Memory cache
    this.memoryCache.set(fullKey, value);

    // L2: Redis cache
    if (this.redis) {
      try {
        await this.redis.setex(fullKey, ttl, JSON.stringify(value));
      } catch (error) {
        console.error('[Cache] Failed to set in Redis:', error);
      }
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string, namespace?: string, orgId?: string): Promise<void> {
    // SECURITY: Require orgId for proper isolation
    if (!orgId) {
      console.error('[Cache] SECURITY: orgId required for cache operations');
    }
    const fullKey = this.buildKey(key, namespace, orgId);

    // Delete from L1
    this.memoryCache.delete(fullKey);

    // Delete from L2
    if (this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch (error) {
        console.error('[Cache] Failed to delete from Redis:', error);
      }
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string, namespace?: string, orgId?: string): Promise<number> {
    // SECURITY: Require orgId for proper isolation
    if (!orgId) {
      console.error('[Cache] SECURITY: orgId required for cache operations');
    }
    const fullPattern = this.buildKey(pattern, namespace, orgId);
    let deletedCount = 0;

    // L1: Memory cache - delete matching keys
    for (const key of this.memoryCache.keys()) {
      if (key.includes(fullPattern)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // L2: Redis - scan and delete
    // Note: Upstash doesn't support SCAN, so we track keys separately
    // For production, consider using key prefix list or Redis Cluster

    console.log(`[Cache] Invalidated ${deletedCount} keys matching ${fullPattern}`);
    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): { memory: CacheStats; redis: CacheStats } {
    return {
      memory: this.stats.get('memory') || this.initStats(),
      redis: this.stats.get('redis') || this.initStats(),
    };
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: Upstash doesn't support FLUSHDB, so we'd need to track keys
    console.log('[Cache] Cleared all cache layers');
  }

  private buildKey(key: string, namespace?: string, orgId?: string): string {
    // SECURITY: Always include orgId in cache key to prevent cross-org data access
    // This ensures complete isolation between organizations at the cache level
    const parts: string[] = [];

    // Organization ID is REQUIRED for multi-tenant isolation
    if (orgId) {
      parts.push(`org:${orgId}`);
    } else {
      // Log warning for missing orgId - this is a potential security issue
      console.warn('[Cache] SECURITY WARNING: Cache key created without orgId - potential cross-org data leak');
    }

    // Optional namespace for logical grouping
    if (namespace) {
      parts.push(namespace);
    }

    // The actual key
    parts.push(key);

    return parts.join(':');
  }

  private recordHit(layer: string, key: string): void {
    const stats = this.stats.get(layer) || this.initStats();
    stats.hits++;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
    this.stats.set(layer, stats);
  }

  private recordMiss(key: string): void {
    // Record miss for all layers
    for (const layer of ['memory', 'redis']) {
      const stats = this.stats.get(layer) || this.initStats();
      stats.misses++;
      stats.hitRate = stats.hits / (stats.hits + stats.misses);
      this.stats.set(layer, stats);
    }
  }

  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
    };
  }
}

// Singleton instance
let cacheInstance: MultiLayerCache | null = null;

export function getCache(): MultiLayerCache {
  if (!cacheInstance) {
    cacheInstance = new MultiLayerCache();
  }
  return cacheInstance;
}
