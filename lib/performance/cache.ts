/**
 * Caching utilities for performance optimization
 *
 * Provides in-memory and Redis caching with TTL support.
 */

import { redis } from '@/lib/rate-limit/redis';
import { logger } from '@/lib/monitoring/logger';

export interface CacheOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Use Redis for distributed caching (default: false, uses in-memory)
   */
  useRedis?: boolean;

  /**
   * Cache key prefix
   */
  prefix?: string;
}

/**
 * In-memory cache with TTL
 */
class MemoryCache {
  private cache = new Map<string, { value: any; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set(key: string, value: any, ttlSeconds: number = 300): void {
    const expires = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expires });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
const memoryCache = new MemoryCache();

/**
 * Get from cache
 */
export async function getCache<T>(key: string, options?: CacheOptions): Promise<T | null> {
  const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;

  try {
    if (options?.useRedis) {
      // Use Redis
      const value = await redis.get(fullKey);
      return value ? (JSON.parse(value as string) as T) : null;
    } else {
      // Use in-memory cache
      return memoryCache.get<T>(fullKey);
    }
  } catch (error) {
    logger.error('Cache get error', error as Error, { key: fullKey });
    return null;
  }
}

/**
 * Set cache
 */
export async function setCache(key: string, value: any, options?: CacheOptions): Promise<void> {
  const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
  const ttl = options?.ttl || 300; // Default 5 minutes

  try {
    if (options?.useRedis) {
      // Use Redis
      await redis.set(fullKey, JSON.stringify(value), { ex: ttl });
    } else {
      // Use in-memory cache
      memoryCache.set(fullKey, value, ttl);
    }
  } catch (error) {
    logger.error('Cache set error', error as Error, { key: fullKey });
  }
}

/**
 * Delete from cache
 */
export async function deleteCache(key: string, options?: CacheOptions): Promise<void> {
  const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;

  try {
    if (options?.useRedis) {
      await redis.del(fullKey);
    } else {
      memoryCache.delete(fullKey);
    }
  } catch (error) {
    logger.error('Cache delete error', error as Error, { key: fullKey });
  }
}

/**
 * Cache wrapper for functions
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await setCache(key, result, options);
  return result;
}

/**
 * Invalidate multiple cache keys by pattern
 */
export async function invalidateCachePattern(pattern: string, options?: CacheOptions): Promise<void> {
  const prefix = options?.prefix || '';
  const fullPattern = prefix ? `${prefix}:${pattern}` : pattern;

  try {
    if (options?.useRedis) {
      // Use Redis SCAN to find matching keys
      const keys = await redis.keys(fullPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Clear entire in-memory cache (no pattern matching)
      memoryCache.clear();
    }
  } catch (error) {
    logger.error('Cache invalidate pattern error', error as Error, { pattern: fullPattern });
  }
}

/**
 * Pre-configured cache helpers
 */
export const cacheHelpers = {
  /**
   * Cache recording metadata
   */
  recording: {
    get: (id: string) => getCache(`recording:${id}`, { ttl: 300 }),
    set: (id: string, data: any) => setCache(`recording:${id}`, data, { ttl: 300 }),
    invalidate: (id: string) => deleteCache(`recording:${id}`),
  },

  /**
   * Cache transcript
   */
  transcript: {
    get: (id: string) => getCache(`transcript:${id}`, { ttl: 600 }),
    set: (id: string, data: any) => setCache(`transcript:${id}`, data, { ttl: 600 }),
    invalidate: (id: string) => deleteCache(`transcript:${id}`),
  },

  /**
   * Cache search results
   */
  search: {
    get: (query: string) => getCache(`search:${query}`, { ttl: 180 }),
    set: (query: string, data: any) => setCache(`search:${query}`, data, { ttl: 180 }),
    invalidate: () => invalidateCachePattern('search:*'),
  },

  /**
   * Cache user embeddings
   */
  embeddings: {
    get: (text: string) =>
      getCache(`embedding:${text}`, { ttl: 3600, useRedis: true }),
    set: (text: string, data: any) =>
      setCache(`embedding:${text}`, data, { ttl: 3600, useRedis: true }),
  },
};
