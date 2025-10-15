/**
 * Rate Limiting Middleware
 *
 * Implements sliding window rate limiting using Upstash Redis
 * Provides protection against brute force and DDoS attacks
 *
 * OWASP Reference: A05:2021 – Security Misconfiguration
 * CWE-770: Allocation of Resources Without Limits or Throttling
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate limit tiers with different limits for different endpoint types
 * Using sliding window algorithm for accurate rate limiting
 */
export enum RateLimitTier {
  AUTH = 'auth',           // 5 req/min - Authentication endpoints
  API = 'api',             // 100 req/min - Standard API endpoints
  PUBLIC = 'public',       // 20 req/min - Public endpoints
  ADMIN = 'admin',         // 500 req/min - Admin endpoints (higher limit)
}

// Rate limiter instances for each tier
const rateLimiters: Record<RateLimitTier, Ratelimit> = {
  [RateLimitTier.AUTH]: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  [RateLimitTier.API]: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  }),
  [RateLimitTier.PUBLIC]: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
    analytics: true,
    prefix: 'ratelimit:public',
  }),
  [RateLimitTier.ADMIN]: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, '1 m'), // 500 requests per minute
    analytics: true,
    prefix: 'ratelimit:admin',
  }),
};

/**
 * Get client identifier from request
 * Priority: userId > IP address (fallback for unauthenticated requests)
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() :
             request.headers.get('x-real-ip') ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * Log rate limit violation to audit logs
 */
async function logRateLimitViolation(
  request: NextRequest,
  tier: RateLimitTier,
  identifier: string,
  userId?: string
): Promise<void> {
  try {
    const url = new URL(request.url);
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip');

    // Only log if we have a userId (authenticated request)
    if (userId) {
      // Get user's org_id for audit log
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('org_id')
        .eq('clerk_id', userId)
        .single();

      if (user?.org_id) {
        await supabaseAdmin.from('audit_logs').insert({
          org_id: user.org_id,
          user_id: userId,
          action: 'rate_limit.violated',
          resource_type: 'api',
          metadata: {
            tier,
            identifier,
            path: url.pathname,
            method: request.method,
          },
          ip_address: ip,
          user_agent: request.headers.get('user-agent'),
        });
      }
    }
  } catch (error) {
    // Don't throw - logging failures shouldn't break rate limiting
    console.error('[Rate Limit] Failed to log violation:', error);
  }
}

/**
 * Rate limit middleware
 *
 * @param tier - Rate limit tier to apply
 * @param getUserId - Optional function to extract userId from request
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * export const GET = rateLimit(RateLimitTier.API, async (req) => {
 *   const { userId } = await requireAuth();
 *   return userId;
 * })(async (request: NextRequest) => {
 *   // Your handler code here
 * });
 * ```
 */
export function rateLimit(
  tier: RateLimitTier,
  getUserId?: (request: NextRequest) => Promise<string | undefined>
) {
  return function <T extends (request: NextRequest, ...args: any[]) => Promise<NextResponse>>(
    handler: T
  ): T {
    return (async (request: NextRequest, ...args: any[]) => {
      // Skip rate limiting if Redis is not configured (development)
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        console.warn('[Rate Limit] Redis not configured - skipping rate limit');
        return handler(request, ...args);
      }

      try {
        // Get user ID if provided
        const userId = getUserId ? await getUserId(request) : undefined;

        // Get client identifier
        const identifier = getClientIdentifier(request, userId);

        // Check rate limit
        const { success, limit, remaining, reset } = await rateLimiters[tier].limit(identifier);

        // Add rate limit headers to response
        const headers = {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        };

        if (!success) {
          // Log rate limit violation
          await logRateLimitViolation(request, tier, identifier, userId);

          // Calculate retry-after in seconds
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);

          // Return 429 Too Many Requests
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              message: `Too many requests. Please try again in ${retryAfter} seconds.`,
              retry_after: retryAfter,
            },
            {
              status: 429,
              headers: {
                ...headers,
                'Retry-After': retryAfter.toString(),
                'Content-Type': 'application/json',
              },
            }
          );
        }

        // Execute handler
        const response = await handler(request, ...args);

        // Add rate limit headers to successful response
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      } catch (error) {
        console.error('[Rate Limit] Error in rate limit middleware:', error);
        // On error, allow request through (fail open for availability)
        // In production, you may want to fail closed instead
        return handler(request, ...args);
      }
    }) as T;
  };
}

/**
 * Helper to extract userId from request using requireAuth pattern
 * Use this for authenticated endpoints
 */
export async function extractUserIdFromAuth(request: NextRequest): Promise<string | undefined> {
  try {
    // Import requireAuth dynamically to avoid circular dependencies
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    return userId || undefined;
  } catch (error) {
    // If auth fails, return undefined and rate limit by IP
    return undefined;
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters_preset = {
  /**
   * Auth endpoints (sign-in, sign-up, password reset)
   * 5 requests per minute
   */
  auth: () => rateLimit(RateLimitTier.AUTH),

  /**
   * Standard API endpoints (authenticated)
   * 100 requests per minute
   */
  api: () => rateLimit(RateLimitTier.API, extractUserIdFromAuth),

  /**
   * Public endpoints (unauthenticated)
   * 20 requests per minute
   */
  public: () => rateLimit(RateLimitTier.PUBLIC),

  /**
   * Admin endpoints (admin/owner only)
   * 500 requests per minute
   */
  admin: () => rateLimit(RateLimitTier.ADMIN, extractUserIdFromAuth),
};

/**
 * Check if user is admin for admin-tier rate limiting
 */
export async function extractAdminUserId(request: NextRequest): Promise<string | undefined> {
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();

    if (!userId) return undefined;

    // Check if user is admin/owner
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('clerk_id', userId)
      .single();

    if (user && ['admin', 'owner'].includes(user.role)) {
      return userId;
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}
