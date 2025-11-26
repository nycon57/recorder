import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import {
  addTagsToItemSchema,
  setItemTagsSchema,
  type AddTagsToItemInput,
  type SetItemTagsInput,
} from '@/lib/validations/tags';

interface RouteParams {
  params: {
    id: string; // Recording/item ID
  };
}

/**
 * GET /api/library/[id]/tags - Get all tags for a library item
 */
export const GET = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
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

  // Get all tags for this item
  const { data: tags, error } = await supabase
    .from('content_tags')
    .select(`
      tag_id,
      created_at,
      tags!inner (
        id,
        name,
        color,
        created_at,
        updated_at
      )
    `)
    .eq('content_id', id)
    .is('tags.deleted_at', null);

  if (error) {
    console.error('[GET /api/library/[id]/tags] Error fetching tags:', error);
    throw new Error('Failed to fetch item tags');
  }

  // Flatten the response
  const formattedTags = tags?.map(t => ({
    ...t.tags,
    assigned_at: t.created_at,
  })) || [];

  return successResponse({
    tags: formattedTags,
  });
});

/**
 * POST /api/library/[id]/tags - Add tags to a library item
 *
 * Body:
 * - tagIds: Array of tag IDs to add
 */
export const POST = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
  const body = await parseBody<AddTagsToItemInput>(request, addTagsToItemSchema);
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

  // Verify all tags exist and belong to org
  const { data: tags, error: tagsError } = await supabase
    .from('tags')
    .select('id')
    .in('id', body.tagIds)
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (tagsError || !tags) {
    console.error('[POST /api/library/[id]/tags] Error verifying tags:', tagsError);
    throw new Error('Failed to verify tags');
  }

  if (tags.length !== body.tagIds.length) {
    return errors.badRequest('One or more tags not found or do not belong to your organization');
  }

  // Get existing tag associations to avoid duplicates
  const { data: existingTags } = await supabase
    .from('content_tags')
    .select('tag_id')
    .eq('content_id', id)
    .in('tag_id', body.tagIds);

  const existingTagIds = new Set(existingTags?.map(t => t.tag_id) || []);
  const newTagIds = body.tagIds.filter(tagId => !existingTagIds.has(tagId));

  if (newTagIds.length === 0) {
    return successResponse({
      message: 'All tags are already assigned to this item',
      added: 0,
    });
  }

  // Insert new tag associations
  const associations = newTagIds.map(tagId => ({
    content_id: id,
    tag_id: tagId,
  }));

  const { error: insertError } = await supabase
    .from('content_tags')
    .insert(associations);

  if (insertError) {
    console.error('[POST /api/library/[id]/tags] Error adding tags:', insertError);
    throw new Error('Failed to add tags to item');
  }

  // Fetch updated tags
  const { data: updatedTags, error: fetchError } = await supabase
    .from('content_tags')
    .select(`
      tags!inner (
        id,
        name,
        color
      )
    `)
    .eq('content_id', id)
    .is('tags.deleted_at', null);

  if (fetchError) {
    console.error('[POST /api/library/[id]/tags] Error fetching updated tags:', fetchError);
  }

  return successResponse({
    message: `Successfully added ${newTagIds.length} tag(s)`,
    added: newTagIds.length,
    tags: updatedTags?.map(t => t.tags) || [],
  });
});

/**
 * PUT /api/library/[id]/tags - Replace all tags for a library item
 *
 * Body:
 * - tagIds: Array of tag IDs (replaces all existing tags)
 */
export const PUT = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
  const body = await parseBody<SetItemTagsInput>(request, setItemTagsSchema);
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

  // If tagIds is not empty, verify all tags exist and belong to org
  if (body.tagIds.length > 0) {
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('id')
      .in('id', body.tagIds)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (tagsError || !tags) {
      console.error('[PUT /api/library/[id]/tags] Error verifying tags:', tagsError);
      throw new Error('Failed to verify tags');
    }

    if (tags.length !== body.tagIds.length) {
      return errors.badRequest('One or more tags not found or do not belong to your organization');
    }
  }

  // Remove all existing tag associations
  const { error: deleteError } = await supabase
    .from('content_tags')
    .delete()
    .eq('content_id', id);

  if (deleteError) {
    console.error('[PUT /api/library/[id]/tags] Error removing existing tags:', deleteError);
    throw new Error('Failed to update tags');
  }

  // Insert new tag associations if any
  if (body.tagIds.length > 0) {
    const associations = body.tagIds.map(tagId => ({
      content_id: id,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from('content_tags')
      .insert(associations);

    if (insertError) {
      console.error('[PUT /api/library/[id]/tags] Error adding tags:', insertError);
      throw new Error('Failed to update tags');
    }
  }

  // Fetch updated tags
  const { data: updatedTags, error: fetchError } = await supabase
    .from('content_tags')
    .select(`
      tags!inner (
        id,
        name,
        color
      )
    `)
    .eq('content_id', id)
    .is('tags.deleted_at', null);

  if (fetchError) {
    console.error('[PUT /api/library/[id]/tags] Error fetching updated tags:', fetchError);
  }

  return successResponse({
    message: `Tags updated successfully`,
    tags: updatedTags?.map(t => t.tags) || [],
  });
});