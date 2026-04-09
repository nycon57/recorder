import { redis } from './redis';

export interface RateLimitConfig {
  /**
   * Unique identifier for this rate limiter (e.g., 'api:global', 'api:search')
   */
  prefix: string;

  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Unix timestamp
  limit: number;
}

/**
 * Sliding window rate limiter using Redis
 *
 * Uses ZADD with timestamps to track requests in a sorted set,
 * then counts requests within the current window.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { prefix, limit, window } = config;
  const key = `ratelimit:${prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - window * 1000;

  try {
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const count = await redis.zcount(key, windowStart, '+inf');

    if (count >= limit) {
      // Get oldest entry to calculate reset time
      const oldestEntries = await redis.zrange(key, 0, 0, { withScores: true });
      const oldestTimestamp = oldestEntries.length > 0
        ? (oldestEntries[0] as { score: number }).score
        : now;
      const reset = Math.ceil((oldestTimestamp + window * 1000) / 1000);

      return {
        success: false,
        remaining: 0,
        reset,
        limit,
      };
    }

    // Add current request
    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });

    // Set expiration on key
    await redis.expire(key, window);

    const remaining = limit - (count + 1);
    const reset = Math.ceil((now + window * 1000) / 1000);

    return {
      success: true,
      remaining,
      reset,
      limit,
    };
  } catch (error) {
    console.error('Rate limit error:', error);

    // Fail open - allow request if Redis is down
    return {
      success: true,
      remaining: limit,
      reset: Math.ceil((now + window * 1000) / 1000),
      limit,
    };
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const rateLimiters = {
  /**
   * Global API rate limit: 100 requests per minute per user
   */
  api: (userId: string) =>
    rateLimit(userId, {
      prefix: 'api:global',
      limit: 100,
      window: 60,
    }),

  /**
   * Search rate limit: 20 requests per minute per user
   */
  search: (userId: string) =>
    rateLimit(userId, {
      prefix: 'api:search',
      limit: 20,
      window: 60,
    }),

  /**
   * Chat/Assistant rate limit: 10 requests per minute per user
   */
  chat: (userId: string) =>
    rateLimit(userId, {
      prefix: 'api:chat',
      limit: 10,
      window: 60,
    }),

  /**
   * Upload rate limit: 5 uploads per hour per org
   */
  upload: (orgId: string) =>
    rateLimit(orgId, {
      prefix: 'api:upload',
      limit: 5,
      window: 3600,
    }),

  /**
   * Share creation rate limit: 50 per day per org
   */
  share: (orgId: string) =>
    rateLimit(orgId, {
      prefix: 'api:share',
      limit: 50,
      window: 86400,
    }),

  /**
   * Anonymous/IP-based rate limit for public endpoints: 10 per minute
   */
  anonymous: (ip: string) =>
    rateLimit(ip, {
      prefix: 'api:anon',
      limit: 10,
      window: 60,
    }),
};

/**
 * Get client IP address from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}
