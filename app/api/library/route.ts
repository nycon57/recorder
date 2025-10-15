import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { ContentType } from '@/lib/types/database';

/**
 * GET /api/library
 * List all content items (recordings, videos, audio, documents, text) for the current org
 *
 * Query params:
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - content_type: Filter by content type (recording, video, audio, document, text)
 * - status: Filter by processing status
 * - search: Search query for title, description, or filename
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const supabase = await createClient();

  console.log('[API /api/library] Request from orgId:', orgId, 'userId:', userId);

  // Parse query params
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const contentTypeFilter = url.searchParams.get('content_type') as ContentType | null;
  const statusFilter = url.searchParams.get('status');
  const searchQuery = url.searchParams.get('search');

  console.log('[API /api/library] Query params:', { limit, offset, contentTypeFilter, statusFilter, searchQuery });

  // Build query
  let query = supabase
    .from('recordings')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Apply filters
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

  return successResponse({
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
      search: searchQuery,
    },
  });
});
