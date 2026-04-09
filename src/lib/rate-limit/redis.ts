import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * Get Redis instance (lazy initialization to avoid build-time errors)
 * Returns null if Redis is not configured (allows build to succeed)
 */
export function getRedis(): Redis | null {
  // Skip Redis if env vars not available (e.g., during build)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  // Lazy initialization - only create instance when first needed
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisInstance;
}

// For backward compatibility, export a getter
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const instance = getRedis();
    if (!instance) {
      console.warn('[Redis] Redis not configured - operation skipped');
      return () => null;
    }
    return instance[prop as keyof Redis];
  }
});
