import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string; // Recording/item ID
    tagId: string; // Tag ID
  }>;
}

/**
 * DELETE /api/library/[id]/tags/[tagId] - Remove a specific tag from a library item
 */
export const DELETE = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id, tagId } = await params;
  const supabase = await createClient();

  // Verify item exists and belongs to org
  const { data: item, error: itemError } = await supabase
    .from('content')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (itemError || !item) {
    return errors.notFound('Library item');
  }

  // Verify tag exists and belongs to org
  const { data: tag, error: tagError } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (tagError || !tag) {
    return errors.notFound('Tag');
  }

  // Remove the tag association
  const { error: deleteError } = await supabase
    .from('content_tags')
    .delete()
    .eq('content_id', id)
    .eq('tag_id', tagId);

  if (deleteError) {
    console.error('[DELETE /api/library/[id]/tags/[tagId]] Error removing tag:', deleteError);
    throw new Error('Failed to remove tag from item');
  }

  return successResponse({
    success: true,
    message: 'Tag removed successfully',
  });
});