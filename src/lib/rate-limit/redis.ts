import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;
let redisFailed = false;
let redisFailedAt = 0;
const CIRCUIT_BREAKER_MS = 60_000; // 60 seconds

/**
 * Get Redis instance (lazy initialization to avoid build-time errors).
 * Returns null if Redis is not configured or if the circuit breaker is open
 * (DNS/network failure within the last 60 seconds).
 */
export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  // Circuit breaker — if Redis failed recently, skip silently
  if (redisFailed) {
    if (Date.now() - redisFailedAt < CIRCUIT_BREAKER_MS) {
      return null;
    }
    // Cooldown expired — allow one retry
    redisFailed = false;
    redisInstance = null;
  }

  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisInstance;
}

/**
 * Mark Redis as failed — activates the circuit breaker for 60 seconds.
 * Called by cache.ts when a DNS/network error is detected.
 */
export function markRedisFailed(): void {
  if (!redisFailed) {
    console.warn('[Redis] Circuit breaker activated — skipping Redis for 60s');
  }
  redisFailed = true;
  redisFailedAt = Date.now();
  redisInstance = null;
}

// For backward compatibility, export a getter
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const instance = getRedis();
    if (!instance) {
      return () => null;
    }
    return instance[prop as keyof Redis];
  }
});
