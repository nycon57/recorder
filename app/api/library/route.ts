import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ContentType } from '@/lib/types/database';
import { withDeduplication } from '@/lib/middleware/request-dedup';
import { CacheControlHeaders, generateETag } from '@/lib/services/cache';

/**
 * GET /api/library
 * List all content items (recordings, videos, audio, documents, text) for the current org
 *
 * Query params:
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - content_type: Filter by content type (recording, video, audio, document, text)
 * - status: Filter by processing status (pending, transcribing, completed, etc.)
 * - view: Filter by deletion status - 'active' (default), 'trash', or 'all'
 * - search: Search query for title, description, or filename
 */
const libraryHandler = async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const supabase = supabaseAdmin;

  console.log('[API /api/library] Request from orgId:', orgId, 'userId:', userId);

  // Parse query params
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const contentTypeFilter = url.searchParams.get('content_type') as ContentType | null;
  const statusFilter = url.searchParams.get('status');
  const viewFilter = url.searchParams.get('view') || 'active'; // Default to 'active' view
  const searchQuery = url.searchParams.get('search');

  // Validate view parameter
  if (!['active', 'trash', 'all'].includes(viewFilter)) {
    return errors.badRequest('Invalid view parameter. Must be "active", "trash", or "all".');
  }

  console.log('[API /api/library] Query params:', { limit, offset, contentTypeFilter, statusFilter, viewFilter, searchQuery });

  // Build query
  let query = supabase
    .from('content')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Apply view filter (deletion status)
  if (viewFilter === 'active') {
    query = query.is('deleted_at', null);
  } else if (viewFilter === 'trash') {
    query = query.not('deleted_at', 'is', null);
  }
  // If viewFilter === 'all', no filter on deleted_at

  // Apply other filters
  if (contentTypeFilter) {
    query = query.eq('content_type', contentTypeFilter);
  }

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  if (searchQuery) {
    query = query.or(
      `title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,original_filename.ilike.%${searchQuery}%`
    );
  }

  // Execute query with pagination
  const { data: items, error, count } = await query.range(offset, offset + limit - 1);

  console.log('[API /api/library] Query results:', {
    itemCount: items?.length || 0,
    totalCount: count,
    error: error?.message,
  });

  if (error) {
    console.error('[API /api/library] Error fetching library items:', error);
    return errors.internalError();
  }

    const responseData = {
      data: items || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      filters: {
        content_type: contentTypeFilter,
        status: statusFilter,
        view: viewFilter,
        search: searchQuery,
      },
    };

  const response = successResponse(responseData);

  // Add cache headers for client-side caching
  response.headers.set('Cache-Control', CacheControlHeaders.content);
  response.headers.set('ETag', generateETag(responseData));

  return response;
};

export const GET = withDeduplication(
  apiHandler(libraryHandler),
  {
    // Deduplicate by org + query params
    // Note: keyGenerator is called before the handler, so we need to authenticate here
    keyGenerator: async (req: NextRequest) => {
      const { orgId } = await requireOrg();
      const url = new URL(req.url);
      return `library:${orgId}:${url.searchParams.toString()}`;
    },
    skip: (req: NextRequest) => req.method !== 'GET',
  }
);
