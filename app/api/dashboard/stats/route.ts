import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseSearchParams,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dashboardStatsQuerySchema } from '@/lib/validations/library';
import type { ContentType } from '@/lib/types/database';

/**
 * GET /api/dashboard/stats
 *
 * Retrieve comprehensive statistics for the dashboard.
 * Includes total counts, storage usage, recent activity, and content type breakdown.
 *
 * @route GET /api/dashboard/stats
 * @access Protected - Requires organization context
 *
 * @queryParams {
 *   period?: 'week' | 'month' | 'year' | 'all';  // Time period for recent activity (default: 'all')
 *   includeStorage?: boolean;                     // Include storage breakdown (default: true)
 *   includeBreakdown?: boolean;                   // Include content type breakdown (default: true)
 * }
 *
 * @returns {
 *   totalItems: number;              // Total content items
 *   storageUsedBytes: number;        // Total storage used in bytes
 *   itemsThisWeek: number;           // Items created in last 7 days
 *   itemsThisMonth: number;          // Items created in last 30 days (if period includes it)
 *   processingCount: number;         // Items currently processing
 *   breakdown?: {                    // Content type breakdown (if includeBreakdown=true)
 *     recording: { count: number; storageBytes: number; };
 *     video: { count: number; storageBytes: number; };
 *     audio: { count: number; storageBytes: number; };
 *     document: { count: number; storageBytes: number; };
 *     text: { count: number; storageBytes: number; };
 *   };
 *   statusBreakdown?: {              // Status breakdown
 *     uploading: number;
 *     uploaded: number;
 *     transcribing: number;
 *     transcribed: number;
 *     doc_generating: number;
 *     completed: number;
 *     error: number;
 *   };
 * }
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - Admin client used for efficiency
 *
 * @errors
 *   - 400: Invalid query parameters
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 500: Internal server error
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();

  try {
    // Parse and validate query parameters
    const params = parseSearchParams(request, dashboardStatsQuerySchema);
    const { period, includeStorage, includeBreakdown } = params;

    // PERFORMANCE OPTIMIZATION: Check cache first
    // Dashboard stats are expensive to compute, cache for 1 minute
    const { StatsCache, CacheControlHeaders, generateETag } = await import('@/lib/services/cache');
    const cachedStats = await StatsCache.get(orgId, period);

    if (cachedStats) {
      // Cache hit - return cached stats with cache headers
      const etag = generateETag(cachedStats);
      const response = successResponse(cachedStats, requestId);

      response.headers.set('Cache-Control', CacheControlHeaders.stats);
      response.headers.set('ETag', etag);
      response.headers.set('X-Cache', 'HIT');

      return response;
    }

    // Get total items count
    const { count: totalItems, error: countError } = await supabaseAdmin
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (countError) {
      console.error('[Dashboard Stats] Error counting items:', countError);
    }

    // Get total storage used (sum of file sizes)
    const { data: storageData, error: storageError } = await supabaseAdmin
      .from('recordings')
      .select('file_size, content_type')
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (storageError) {
      console.error('[Dashboard Stats] Error calculating storage:', storageError);
    }

    const totalStorageBytes = storageData?.reduce((sum, item) => sum + (item.file_size || 0), 0) || 0;

    // Get items created in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: itemsThisWeek, error: weekError } = await supabaseAdmin
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (weekError) {
      console.error('[Dashboard Stats] Error counting weekly items:', weekError);
    }

    // Get items created in the last 30 days (if period requires it)
    let itemsThisMonth = 0;
    if (period === 'month' || period === 'year' || period === 'all') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: monthCount, error: monthError } = await supabaseAdmin
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!monthError) {
        itemsThisMonth = monthCount || 0;
      }
    }

    // Get processing items count (items in queue)
    const { count: processingCount, error: processingError } = await supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']);

    if (processingError) {
      console.error('[Dashboard Stats] Error counting processing items:', processingError);
    }

    // Build base stats object
    const stats: any = {
      totalItems: totalItems || 0,
      storageUsedBytes: totalStorageBytes,
      itemsThisWeek: itemsThisWeek || 0,
      processingCount: processingCount || 0,
    };

    // Add month count if applicable
    if (period !== 'week') {
      stats.itemsThisMonth = itemsThisMonth;
    }

    // Include content type breakdown if requested
    if (includeBreakdown && storageData) {
      const breakdown: Record<ContentType, { count: number; storageBytes: number }> = {
        recording: { count: 0, storageBytes: 0 },
        video: { count: 0, storageBytes: 0 },
        audio: { count: 0, storageBytes: 0 },
        document: { count: 0, storageBytes: 0 },
        text: { count: 0, storageBytes: 0 },
      };

      storageData.forEach((item) => {
        const contentType = item.content_type as ContentType;
        if (contentType && breakdown[contentType]) {
          breakdown[contentType].count++;
          breakdown[contentType].storageBytes += item.file_size || 0;
        }
      });

      stats.breakdown = breakdown;
    }

    // Get status breakdown
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('recordings')
      .select('status')
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (!statusError && statusData) {
      const statusBreakdown: Record<string, number> = {
        uploading: 0,
        uploaded: 0,
        transcribing: 0,
        transcribed: 0,
        doc_generating: 0,
        completed: 0,
        error: 0,
      };

      statusData.forEach((item) => {
        if (item.status && statusBreakdown[item.status] !== undefined) {
          statusBreakdown[item.status]++;
        }
      });

      stats.statusBreakdown = statusBreakdown;
    }

    // PERFORMANCE OPTIMIZATION: Cache the computed stats
    await StatsCache.set(orgId, stats, period);

    // Add cache headers to response
    const etag = generateETag(stats);
    const response = successResponse(stats, requestId);

    response.headers.set('Cache-Control', CacheControlHeaders.stats);
    response.headers.set('ETag', etag);
    response.headers.set('X-Cache', 'MISS');

    return response;
  } catch (error: any) {
    console.error('[Dashboard Stats] Request error:', error);

    // Check if it's a validation error
    if (error.message?.includes('Invalid search params')) {
      return errors.validationError(error.message, requestId);
    }

    return errors.internalError(requestId);
  }
});
