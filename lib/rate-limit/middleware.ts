import { NextRequest, NextResponse } from 'next/server';

import { errorResponse } from '@/lib/utils/api';

import { rateLimiters, RateLimitResult, getClientIp } from './limiter';

/**
 * Rate limiting middleware for API routes
 *
 * @example
 * export const GET = withRateLimit(
 *   async (request: NextRequest) => { ... },
 *   { limiter: 'api', identifier: (req) => req.userId }
 * );
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T) => Promise<Response>,
  options: {
    limiter: keyof typeof rateLimiters;
    identifier?: (request: T) => string | Promise<string>;
  }
) {
  return async (request: T) => {
    try {
      // Get identifier (user ID, org ID, or IP)
      let identifier: string;
      if (options.identifier) {
        identifier = await options.identifier(request);
      } else {
        // Default to IP address for anonymous endpoints
        identifier = getClientIp(request);
      }

      // Check rate limit
      const limiter = rateLimiters[options.limiter];
      const result: RateLimitResult = await limiter(identifier);

      // Add rate limit headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', result.limit.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', result.reset.toString());

      if (!result.success) {
        const retryAfter = result.reset - Math.floor(Date.now() / 1000);
        headers.set('Retry-After', retryAfter.toString());

        return errorResponse(
          {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: {
              limit: result.limit,
              reset: result.reset,
              retryAfter,
            },
          },
          429,
          headers
        );
      }

      // Execute handler
      const response = await handler(request);

      // Add rate limit headers to successful response
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Fail open - continue to handler if middleware fails
      return handler(request);
    }
  };
}
