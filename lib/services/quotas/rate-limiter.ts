import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let limiters: Record<string, Ratelimit> | null = null;

// Initialize Redis and rate limiters only if credentials are available
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  /**
   * Rate limiter configurations
   */
  limiters = {
    // API rate limiting (per org)
    api: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
      analytics: true,
      prefix: 'ratelimit:api',
    }),

    // Search rate limiting (per org)
    search: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 searches per minute
      analytics: true,
      prefix: 'ratelimit:search',
    }),

    // AI rate limiting (per org)
    ai: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 AI requests per minute
      analytics: true,
      prefix: 'ratelimit:ai',
    }),

    // Upload rate limiting (per user)
    upload: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(10, '1 h'), // 10 uploads per hour
      analytics: true,
      prefix: 'ratelimit:upload',
    }),
  };
} else {
  console.warn('[RateLimiter] Redis credentials not configured, rate limiting disabled');
}

export type RateLimitType = 'api' | 'search' | 'ai' | 'upload';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// SECURITY: Circuit breaker for fail-closed behavior
interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure: number;
  gracePeriod: number; // milliseconds
}

const circuitBreaker: CircuitBreakerState = {
  isOpen: false,
  failures: 0,
  lastFailure: 0,
  gracePeriod: 60000, // 1 minute grace period
};

const CIRCUIT_BREAKER_THRESHOLD = 3; // Open circuit after 3 failures
const CIRCUIT_BREAKER_RESET_TIME = 300000; // 5 minutes to reset

export class RateLimiter {
  /**
   * Check rate limit
   */
  static async checkLimit(
    type: RateLimitType,
    identifier: string
  ): Promise<RateLimitResult> {
    // SECURITY: Check circuit breaker state first
    const now = Date.now();

    // Check if circuit should be reset
    if (circuitBreaker.isOpen &&
        (now - circuitBreaker.lastFailure) > CIRCUIT_BREAKER_RESET_TIME) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
      console.log('[RateLimiter] Circuit breaker reset');
    }

    // SECURITY: Fail closed if circuit is open
    if (circuitBreaker.isOpen) {
      console.warn('[RateLimiter] Circuit breaker OPEN - denying request (fail-closed)');
      return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: Math.floor((circuitBreaker.lastFailure + circuitBreaker.gracePeriod) / 1000),
      };
    }

    if (!limiters || !limiters[type]) {
      console.warn(`[RateLimiter] Rate limiting not configured for ${type}`);
      // SECURITY: Fail closed when not configured
      return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: 0,
      };
    }

    const limiter = limiters[type];

    try {
      const result = await limiter.limit(identifier);

      // Reset failure count on success
      if (circuitBreaker.failures > 0) {
        circuitBreaker.failures = 0;
        console.log('[RateLimiter] Redis connection restored');
      }

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      console.error('[RateLimiter] Error checking limit:', error);

      // SECURITY: Increment failure count and check threshold
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = now;

      if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreaker.isOpen = true;
        console.error(`[RateLimiter] Circuit breaker OPENED after ${circuitBreaker.failures} failures`);
      }

      // SECURITY: Fail closed - deny request if rate limiter fails
      console.warn('[RateLimiter] Redis failure - denying request (fail-closed)');
      return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: Math.floor((now + circuitBreaker.gracePeriod) / 1000),
      };
    }
  }

  /**
   * Reset rate limit for identifier
   */
  static async resetLimit(
    type: RateLimitType,
    identifier: string
  ): Promise<void> {
    if (!limiters || !limiters[type]) {
      return;
    }

    const limiter = limiters[type];

    try {
      await limiter.resetUsage(identifier);
      console.log(`[RateLimiter] Reset ${type} limit for ${identifier}`);
    } catch (error) {
      console.error('[RateLimiter] Error resetting limit:', error);
    }
  }
}
