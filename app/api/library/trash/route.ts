/**
 * GET /api/library/trash
 *
 * List soft-deleted recordings that can be restored or permanently deleted
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ContentType } from '@/lib/types/database';

/**
 * GET /api/library/trash
 * List all soft-deleted content items for the current org
 *
 * Query params:
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 * - content_type: Filter by content type (recording, video, audio, document, text)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  // Parse query params with validation
  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit') || '50');
  const offsetParam = parseInt(url.searchParams.get('offset') || '0');

  // Guard against negative values and enforce upper bounds
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);
  const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);
  const contentTypeFilter = url.searchParams.get('content_type') as ContentType | null;

  // Build query for deleted items only
  let query = supabase
    .from('content')
    .select('id, title, content_type, file_type, file_size, deleted_at, deleted_by, deletion_reason, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .not('deleted_at', 'is', null) // Only soft-deleted items
    .order('deleted_at', { ascending: false }); // Most recently deleted first

  // Apply content type filter if provided
  if (contentTypeFilter) {
    query = query.eq('content_type', contentTypeFilter);
  }

  // Execute query with pagination
  const { data: items, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('[API /api/library/trash] Error fetching trash items:', error);
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
    },
  });
});

/**
 * DELETE /api/library/trash - Empty trash (permanent delete all)
 */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  console.log('[API /api/library/trash] Emptying trash for org:', orgId);

  // Find all soft-deleted recordings for this org
  const { data: deletedRecordings, error: fetchError } = await supabase
    .from('content')
    .select('id, storage_path_raw, storage_path_processed')
    .eq('org_id', orgId)
    .not('deleted_at', 'is', null);

  if (fetchError) {
    console.error('[API /api/library/trash] Error fetching deleted items:', fetchError);
    return errors.internalError();
  }

  if (!deletedRecordings || deletedRecordings.length === 0) {
    return successResponse({
      success: true,
      message: 'Trash is already empty',
      deletedCount: 0
    });
  }

  // Delete storage files
  const filesToDelete = deletedRecordings.flatMap((rec) =>
    [rec.storage_path_raw, rec.storage_path_processed].filter(Boolean)
  );

  if (filesToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('content')
      .remove(filesToDelete);

    if (storageError) {
      console.error('[API /api/library/trash] Error deleting storage files:', storageError);
      // Continue with database deletion even if storage fails
    }
  }

  // Permanently delete all soft-deleted recordings
  const { error: deleteError } = await supabase
    .from('content')
    .delete()
    .eq('org_id', orgId)
    .not('deleted_at', 'is', null);

  if (deleteError) {
    console.error('[API /api/library/trash] Error permanently deleting:', deleteError);
    return errors.internalError();
  }

  console.log('[API /api/library/trash] Successfully emptied trash:', {
    deletedCount: deletedRecordings.length
  });

  return successResponse({
    success: true,
    message: `Permanently deleted ${deletedRecordings.length} items from trash`,
    deletedCount: deletedRecordings.length
  });
});
