import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseSearchParams,
  generateRequestId,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { dashboardRecentQuerySchema } from '@/lib/validations/library';

/**
 * GET /api/dashboard/recent
 *
 * Retrieve the most recent content items for the dashboard.
 * Returns mixed content types (recordings, videos, audio, documents, text notes).
 * Includes minimal metadata optimized for dashboard cards.
 *
 * @route GET /api/dashboard/recent
 * @access Protected - Requires organization context
 *
 * @queryParams {
 *   limit?: number;        // Number of items to return (1-50, default: 8)
 *   types?: string[];      // Filter by content types (comma-separated)
 * }
 *
 * @returns {
 *   data: Array<{
 *     id: string;
 *     title: string;
 *     description: string | null;
 *     content_type: ContentType;
 *     file_type: string | null;
 *     status: string;
 *     file_size: number | null;
 *     duration_sec: number | null;
 *     thumbnail_url: string | null;
 *     created_at: string;
 *     updated_at: string;
 *     created_by: string;
 *   }>;
 *   total: number;
 * }
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - RLS policies enforced by Supabase
 *   - Excludes soft-deleted items
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
    const params = parseSearchParams(request, dashboardRecentQuerySchema);
    const { limit, types } = params;

    const supabase = await createClient();

    // Build query for recent items
    let query = supabase
      .from('recordings')
      .select(
        `
        id,
        title,
        description,
        content_type,
        file_type,
        status,
        file_size,
        duration_sec,
        thumbnail_url,
        created_at,
        updated_at,
        created_by
      `,
        { count: 'exact' }
      )
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply content type filter if specified
    if (types && types.length > 0) {
      query = query.in('content_type', types);
    }

    // Execute query
    const { data: items, error, count } = await query;

    if (error) {
      console.error('[Dashboard Recent] Query error:', error);
      return errors.internalError(requestId);
    }

    return successResponse(
      {
        data: items || [],
        total: count || 0,
      },
      requestId
    );
  } catch (error: any) {
    console.error('[Dashboard Recent] Request error:', error);

    // Check if it's a validation error
    if (error.message?.includes('Invalid search params')) {
      return errors.validationError(error.message, requestId);
    }

    return errors.internalError(requestId);
  }
});
