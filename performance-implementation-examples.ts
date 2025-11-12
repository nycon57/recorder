/**
 * Performance Optimization Implementation Examples
 *
 * Ready-to-use code snippets for immediate performance improvements
 * Based on the performance audit findings
 */

// ============================================
// EXAMPLE 1: Cache-Enabled Library API Route
// ============================================

// app/api/library/route.ts - OPTIMIZED VERSION
import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCached, CacheKeys, CacheTTL, invalidateCache } from '@/lib/services/cache-manager';
import { ContentType } from '@/lib/types/database';

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  // Parse query params
  const url = new URL(request.url);
  const filters = {
    limit: Math.min(parseInt(url.searchParams.get('limit') || '50'), 100),
    offset: parseInt(url.searchParams.get('offset') || '0'),
    content_type: url.searchParams.get('content_type'),
    status: url.searchParams.get('status'),
    view: url.searchParams.get('view') || 'active',
    search: url.searchParams.get('search'),
  };

  // Generate cache key based on org and filters
  const cacheKey = CacheKeys.libraryListing(orgId, filters);

  // Use cache wrapper - automatically handles cache miss
  const result = await getCached(
    cacheKey,
    async () => {
      // This only runs on cache miss
      const supabase = supabaseAdmin;

      let query = supabase
        .from('recordings')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.view === 'active') {
        query = query.is('deleted_at', null);
      } else if (filters.view === 'trash') {
        query = query.not('deleted_at', 'is', null);
      }

      if (filters.content_type) {
        query = query.eq('content_type', filters.content_type);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data: items, error, count } = await query.range(
        filters.offset,
        filters.offset + filters.limit - 1
      );

      if (error) {
        throw error;
      }

      return {
        data: items || [],
        pagination: {
          total: count || 0,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: (count || 0) > filters.offset + filters.limit,
        },
        filters,
      };
    },
    CacheTTL.libraryListing, // 10 minutes cache
    {
      // Skip cache for real-time requirements
      skipCache: url.searchParams.get('realtime') === 'true',
    }
  );

  return successResponse(result);
});

// ============================================
// EXAMPLE 2: Cached User/Org Lookup Middleware
// ============================================

// lib/utils/cached-auth.ts
import { auth } from '@clerk/nextjs/server';
import { getCached, CacheTTL } from '@/lib/services/cache-manager';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function getCachedUserData(userId: string, orgId: string) {
  const cacheKey = `user:${userId}:org:${orgId}:data`;

  return getCached(
    cacheKey,
    async () => {
      const supabase = supabaseAdmin;

      // Fetch user and org data in parallel
      const [userResult, orgResult] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('clerk_user_id', userId)
          .single(),
        supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single(),
      ]);

      if (userResult.error || orgResult.error) {
        throw new Error('Failed to fetch user/org data');
      }

      return {
        user: userResult.data,
        organization: orgResult.data,
      };
    },
    CacheTTL.userProfile // 1 hour cache
  );
}

// Use in API routes:
export async function requireOrgWithCache() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error('Unauthorized');
  }

  const userData = await getCachedUserData(userId, orgId);

  return {
    userId,
    orgId,
    user: userData.user,
    organization: userData.organization,
  };
}

// ============================================
// EXAMPLE 3: Batch Dashboard API
// ============================================

// app/api/dashboard/batch/route.ts
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { getCached, CacheKeys, CacheTTL } from '@/lib/services/cache-manager';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const GET = apiHandler(async (request) => {
  const { orgId } = await requireOrg();
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'week';

  // Fetch all dashboard data in parallel with caching
  const [stats, recentItems, tags, collections, activity] = await Promise.all([
    // Dashboard stats
    getCached(
      CacheKeys.dashboardStats(orgId, period),
      async () => {
        const supabase = supabaseAdmin;
        const { data } = await supabase
          .from('recordings')
          .select('status, content_type, created_at')
          .eq('org_id', orgId);

        // Calculate stats
        return {
          total: data?.length || 0,
          completed: data?.filter(r => r.status === 'completed').length || 0,
          processing: data?.filter(r => r.status === 'processing').length || 0,
          byType: {
            recordings: data?.filter(r => r.content_type === 'recording').length || 0,
            documents: data?.filter(r => r.content_type === 'document').length || 0,
            videos: data?.filter(r => r.content_type === 'video').length || 0,
          },
        };
      },
      CacheTTL.dashboardStats // 10 minutes
    ),

    // Recent items
    getCached(
      CacheKeys.dashboardRecent(orgId, 10),
      async () => {
        const supabase = supabaseAdmin;
        const { data } = await supabase
          .from('recordings')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10);

        return data || [];
      },
      CacheTTL.dashboardRecent // 5 minutes
    ),

    // Tags
    getCached(
      CacheKeys.tagsList(orgId),
      async () => {
        const supabase = supabaseAdmin;
        const { data } = await supabase
          .from('tags')
          .select('*')
          .eq('org_id', orgId)
          .order('name');

        return data || [];
      },
      CacheTTL.tagsList // 10 minutes
    ),

    // Collections
    getCached(
      `collections:list:${orgId}`,
      async () => {
        const supabase = supabaseAdmin;
        const { data } = await supabase
          .from('collections')
          .select('*')
          .eq('org_id', orgId)
          .order('name');

        return data || [];
      },
      900 // 15 minutes
    ),

    // Recent activity
    getCached(
      `activity:recent:${orgId}`,
      async () => {
        const supabase = supabaseAdmin;
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(20);

        return data || [];
      },
      300 // 5 minutes
    ),
  ]);

  return successResponse({
    stats,
    recentItems,
    tags,
    collections,
    activity,
    _cache: {
      timestamp: new Date().toISOString(),
      ttl: 300, // Client can cache for 5 minutes
    },
  });
});

// ============================================
// EXAMPLE 4: Supabase Realtime for Worker
// ============================================

// scripts/worker-realtime.ts
import { createClient } from '@supabase/supabase-js';
import { processJob } from '@/lib/workers/job-processor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function startRealtimeWorker() {
  console.log('[Worker] Starting Realtime subscription for jobs...');

  // Subscribe to new job inserts
  const subscription = supabase
    .channel('job-inserts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'jobs',
        filter: 'status=eq.pending',
      },
      async (payload) => {
        console.log('[Worker] New job detected:', payload.new.id);
        await processJob(payload.new as any, 3);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: 'status=eq.pending',
      },
      async (payload) => {
        // Handle retries
        if (payload.old.status === 'failed' && payload.new.status === 'pending') {
          console.log('[Worker] Job retry detected:', payload.new.id);
          await processJob(payload.new as any, 3);
        }
      }
    )
    .subscribe();

  // Fallback polling for missed events (every 30 seconds)
  setInterval(async () => {
    const { data: pendingJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 60000).toISOString()) // Older than 1 minute
      .limit(10);

    if (pendingJobs && pendingJobs.length > 0) {
      console.log(`[Worker] Found ${pendingJobs.length} stale jobs, processing...`);
      await Promise.all(pendingJobs.map(job => processJob(job, 3)));
    }
  }, 30000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Worker] Shutting down Realtime subscription...');
    await subscription.unsubscribe();
    process.exit(0);
  });
}

// ============================================
// EXAMPLE 5: Cache Invalidation on Mutations
// ============================================

// app/api/recordings/[id]/route.ts - UPDATE endpoint
import { invalidateCache, invalidateOrgCache } from '@/lib/services/cache-manager';

export const PUT = apiHandler(async (request: NextRequest, { params }) => {
  const { orgId } = await requireOrg();
  const { id } = params;

  // ... perform update ...

  // Invalidate relevant caches
  await Promise.all([
    // Invalidate specific item cache
    invalidateCache(`library:item:${orgId}:${id}`),

    // Invalidate all library listings for this org
    invalidateCache(`library:${orgId}:*`),

    // Invalidate dashboard stats
    invalidateCache(`dashboard:stats:${orgId}:*`),

    // Invalidate recent items
    invalidateCache(`dashboard:recent:${orgId}:*`),
  ]);

  return successResponse({ success: true });
});

// ============================================
// EXAMPLE 6: HTTP Cache Headers
// ============================================

// lib/utils/api-cache.ts
export function setCacheHeaders(
  response: Response,
  options: {
    maxAge?: number;      // Seconds to cache
    sMaxAge?: number;      // CDN cache time
    staleWhileRevalidate?: number;
    private?: boolean;
    noStore?: boolean;
  } = {}
): Response {
  const {
    maxAge = 0,
    sMaxAge = maxAge,
    staleWhileRevalidate = 0,
    private: isPrivate = true,
    noStore = false,
  } = options;

  if (noStore) {
    response.headers.set('Cache-Control', 'no-store');
  } else {
    const directives = [
      isPrivate ? 'private' : 'public',
      `max-age=${maxAge}`,
      `s-maxage=${sMaxAge}`,
    ];

    if (staleWhileRevalidate > 0) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    response.headers.set('Cache-Control', directives.join(', '));
  }

  // Add ETag for conditional requests
  // Note: generateETag needs to be imported from '@/lib/services/cache'
  // import { generateETag } from '@/lib/services/cache';
  // const etag = generateETag(response);
  // if (etag) {
  //   response.headers.set('ETag', etag);
  // }

  return response;
}

// Use in API routes:
export const GET = apiHandler(async (request) => {
  // Note: getCachedData is a placeholder - replace with your actual data fetching logic
  // Example: const data = await getCached('some-key', () => fetchYourData(), CacheTTL.default);
  const data = { message: 'Replace with actual cached data fetching' };

  const response = successResponse(data);

  // Cache for 5 minutes in browser, 10 minutes in CDN
  return setCacheHeaders(response, {
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 60,
  });
});

// ============================================
// EXAMPLE 7: Database Connection Pooling
// ============================================

// lib/supabase/pooled-admin.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_CLIENTS = 10;
const clients: SupabaseClient[] = [];
let currentIndex = 0;

/**
 * Get a pooled Supabase client for better connection management
 */
export function getPooledClient(): SupabaseClient {
  // Create clients lazily up to MAX_CLIENTS
  if (clients.length < MAX_CLIENTS) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-connection-pool': 'true',
          },
        },
      }
    );
    clients.push(client);
    return client;
  }

  // Round-robin through existing clients
  const client = clients[currentIndex];
  currentIndex = (currentIndex + 1) % MAX_CLIENTS;
  return client;
}

// ============================================
// EXAMPLE 8: Query Result Streaming
// ============================================

// app/api/export/stream/route.ts
export async function GET(request: NextRequest) {
  const { orgId } = await requireOrg();

  // Create a readable stream for large datasets
  const stream = new ReadableStream({
    async start(controller) {
      const BATCH_SIZE = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseAdmin
          .from('recordings')
          .select('*')
          .eq('org_id', orgId)
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          controller.error(error);
          return;
        }

        if (data && data.length > 0) {
          // Send batch to client
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(data) + '\n')
          );
          offset += BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

// ============================================
// EXAMPLE 9: Performance Monitoring Middleware
// ============================================

// lib/utils/performance-middleware.ts
export function withPerformanceTracking(
  handler: (req: NextRequest, ctx: any) => Promise<Response>
) {
  return async (req: NextRequest, ctx: any) => {
    const start = Date.now();
    const url = new URL(req.url);

    try {
      const response = await handler(req, ctx);
      const duration = Date.now() - start;

      // Log slow requests
      if (duration > 1000) {
        console.warn(`[Performance] Slow request: ${url.pathname} took ${duration}ms`);
      }

      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`);
      response.headers.set('X-Cache-Status', response.headers.get('X-Cache-Hit') ? 'HIT' : 'MISS');

      // Report to monitoring
      if (process.env.NODE_ENV === 'production') {
        // Note: reportMetric is a placeholder - implement with your monitoring service
        // Examples:
        // - DataDog: await datadog.metric('api.response_time', duration);
        // - New Relic: newrelic.recordMetric('Custom/ResponseTime', duration);
        // - Custom: await supabase.from('metrics').insert({ endpoint: url.pathname, duration });
        // reportMetric({
        //   endpoint: url.pathname,
        //   duration,
        //   status: response.status,
        //   cacheHit: response.headers.get('X-Cache-Hit') === 'true',
        // });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      console.error(`[Performance] Request failed: ${url.pathname} after ${duration}ms`, error);

      throw error;
    }
  };
}

// Use as middleware:
export const GET = withPerformanceTracking(apiHandler(async (request) => {
  // ... your handler logic
}));

// ============================================
// EXAMPLE 10: Smart Cache Warming
// ============================================

// lib/services/cache-warmer-enhanced.ts
import { CacheWarmer } from '@/lib/services/cache-manager';

export class SmartCacheWarmer {
  private static warmingInProgress = false;

  /**
   * Warm caches based on user activity patterns
   */
  static async warmForUser(userId: string, orgId: string) {
    if (this.warmingInProgress) return;
    this.warmingInProgress = true;

    try {
      // Warm in priority order
      await Promise.allSettled([
        // High priority - user will likely need these immediately
        this.warmUserProfile(userId, orgId),
        this.warmDashboardData(orgId),

        // Medium priority - prefetch likely next actions
        this.warmRecentItems(orgId),
        this.warmTags(orgId),

        // Low priority - background prefetch
        this.warmLibraryViews(orgId),
      ]);
    } finally {
      this.warmingInProgress = false;
    }
  }

  private static async warmUserProfile(userId: string, orgId: string) {
    const key = `user:${userId}:org:${orgId}:data`;
    // Check if already cached
    // Note: redis needs to be imported from '@/lib/rate-limit/redis'
    // import { getRedis } from '@/lib/rate-limit/redis';
    // const redis = getRedis();
    // if (redis) {
    //   const exists = await redis.exists(key);
    //   if (!exists) {
    //     await getCachedUserData(userId, orgId);
    //   }
    // } else {
      // Fallback: just warm the cache
      await getCachedUserData(userId, orgId);
    // }
  }

  private static async warmDashboardData(orgId: string) {
    // Warm stats for common time periods
    const periods = ['week', 'month'];
    // Note: fetchDashboardStats is a placeholder - implement with your actual stats fetching logic
    // Example implementation at lines 187-205 in this file (Example 3)
    const fetchDashboardStats = async (orgId: string, period: string) => {
      const supabase = supabaseAdmin;
      const { data } = await supabase
        .from('recordings')
        .select('status, content_type, created_at')
        .eq('org_id', orgId);

      return {
        total: data?.length || 0,
        completed: data?.filter(r => r.status === 'completed').length || 0,
        processing: data?.filter(r => r.status === 'processing').length || 0,
      };
    };

    await Promise.all(
      periods.map(period =>
        getCached(
          CacheKeys.dashboardStats(orgId, period),
          () => fetchDashboardStats(orgId, period),
          CacheTTL.dashboardStats
        )
      )
    );
  }

  // ... other warming methods
}

// Trigger cache warming on user login
export async function onUserLogin(userId: string, orgId: string) {
  // Don't block the login flow
  SmartCacheWarmer.warmForUser(userId, orgId).catch(error => {
    console.error('[CacheWarmer] Failed to warm cache:', error);
  });
}