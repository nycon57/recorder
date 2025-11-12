/**
 * Request Deduplication Middleware
 *
 * Prevents concurrent identical requests from hitting the database.
 * Uses Redis to store in-flight request results for 10 seconds.
 *
 * Benefits:
 * - Reduces database load during concurrent requests
 * - Prevents race conditions
 * - Improves perceived performance for users
 *
 * Usage:
 * ```typescript
 * import { withDeduplication } from '@/lib/middleware/request-dedup';
 *
 * export const GET = withDeduplication(
 *   apiHandler(async (request: NextRequest) => {
 *     // Your handler code
 *   }),
 *   {
 *     // Generate unique key for this request
 *     keyGenerator: (req) => {
 *       const url = new URL(req.url);
 *       return `recordings:${url.searchParams.get('orgId')}:${url.pathname}`;
 *     },
 *   }
 * );
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { RequestDeduplication } from '@/lib/services/cache';

/**
 * Deduplication configuration
 */
interface DeduplicationConfig {
  /**
   * Generate a unique key for the request
   * This key is used to identify identical requests
   *
   * @param request - The incoming request
   * @returns A unique string key for this request
   */
  keyGenerator: (request: NextRequest) => string | Promise<string>;

  /**
   * Optional: Skip deduplication for certain requests
   * Useful for POST/PUT/DELETE that should never be deduplicated
   *
   * @param request - The incoming request
   * @returns True to skip deduplication
   */
  skip?: (request: NextRequest) => boolean | Promise<boolean>;
}

/**
 * Request deduplication middleware wrapper
 *
 * @param handler - The API route handler
 * @param config - Deduplication configuration
 * @returns Wrapped handler with deduplication
 */
export function withDeduplication<T extends (request: NextRequest, ...args: any[]) => Promise<NextResponse>>(
  handler: T,
  config: DeduplicationConfig
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    try {
      // Check if we should skip deduplication
      if (config.skip && await config.skip(request)) {
        return handler(request, ...args);
      }

      // Generate unique key for this request
      const key = await config.keyGenerator(request);

      // Execute with deduplication
      const { result, cacheHit } = await RequestDeduplication.execute(key, async () => {
        // Execute the handler and serialize the response
        const response = await handler(request, ...args);

        // Clone the response to extract data
        const clonedResponse = response.clone();
        const status = clonedResponse.status;
        const headers = Object.fromEntries(clonedResponse.headers.entries());

        // Handle different response types
        let body;
        if (status === 204) {
          // No content - empty body
          body = null;
        } else {
          const contentType = clonedResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            // JSON response
            body = await clonedResponse.json();
          } else {
            // Non-JSON response (text, HTML, etc.)
            body = await clonedResponse.text();
          }
        }

        // Return serializable result
        return { body, headers, status };
      });

      // Reconstruct the response from cached result
      const response = NextResponse.json(result.body, {
        status: result.status,
        headers: result.headers,
      });

      // Add deduplication header reflecting cache hit status
      response.headers.set('X-Dedup', cacheHit ? 'hit' : 'miss');

      return response;
    } catch (error) {
      console.error('[Request Dedup] Error in deduplication middleware:', error);
      // On error, fall back to executing handler directly
      return handler(request, ...args);
    }
  }) as T;
}

/**
 * Common key generators for typical use cases
 */
export const KeyGenerators = {
  /**
   * Generate key based on URL path and query params
   * Good for GET requests
   */
  urlBased: (request: NextRequest): string => {
    const url = new URL(request.url);
    return `url:${url.pathname}:${url.searchParams.toString()}`;
  },

  /**
   * Generate key based on org ID and resource ID
   * Good for resource-specific requests
   */
  orgResourceBased: (orgId: string, resourceType: string, resourceId?: string): string => {
    const parts = [`org:${orgId}`, `resource:${resourceType}`];
    if (resourceId) {
      parts.push(`id:${resourceId}`);
    }
    return parts.join(':');
  },

  /**
   * Generate key based on user ID and action
   * Good for user-specific requests
   */
  userActionBased: (userId: string, action: string): string => {
    return `user:${userId}:action:${action}`;
  },

  /**
   * Generate key based on request body hash
   * Good for POST requests with identical payloads
   */
  bodyHashBased: async (request: NextRequest): Promise<string> => {
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `body:${Math.abs(hash).toString(36)}`;
  },
};

/**
 * Skip deduplication for mutating methods
 */
export const skipMutatingMethods = (request: NextRequest): boolean => {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
};

/**
 * Example configurations for common scenarios
 */
export const DedupConfigs = {
  /**
   * Deduplicate GET requests by URL
   */
  getByUrl: {
    keyGenerator: KeyGenerators.urlBased,
    skip: (req: NextRequest) => req.method !== 'GET',
  },

  /**
   * Deduplicate org-scoped list requests
   */
  orgList: (resourceType: string) => ({
    keyGenerator: async (req: NextRequest) => {
      const { requireOrg } = await import('@/lib/utils/api');
      const { orgId } = await requireOrg();
      const url = new URL(req.url);
      return KeyGenerators.orgResourceBased(orgId, resourceType) + `:${url.searchParams.toString()}`;
    },
    skip: (req: NextRequest) => req.method !== 'GET',
  }),

  /**
   * Deduplicate user profile requests
   */
  userProfile: {
    keyGenerator: async (req: NextRequest) => {
      const { requireAuth } = await import('@/lib/utils/api');
      const { userId } = await requireAuth();
      return KeyGenerators.userActionBased(userId, 'profile');
    },
    skip: (req: NextRequest) => req.method !== 'GET',
  },
};
