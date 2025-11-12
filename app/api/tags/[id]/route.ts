import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import {
  updateTagSchema,
  normalizeTagName,
  type UpdateTagInput,
} from '@/lib/validations/tags';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/tags/[id] - Get a specific tag
 */
export const GET = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
  const supabase = await createClient();

  const { data: tag, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (error || !tag) {
    return errors.notFound('Tag');
  }

  // Get usage count
  const { count } = await supabase
    .from('recording_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', id);

  return successResponse({
    ...tag,
    usage_count: count || 0,
  });
});

/**
 * PATCH /api/tags/[id] - Update a tag
 *
 * Body:
 * - name: New tag name (optional)
 * - color: New hex color code (optional)
 */
export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
  const body = await parseBody<UpdateTagInput>(request, updateTagSchema);
  const supabase = await createClient();

  // Check if tag exists
  const { data: existingTag, error: fetchError } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existingTag) {
    return errors.notFound('Tag');
  }

  // If updating name, check for duplicates
  if (body.name && body.name !== existingTag.name) {
    const normalizedName = normalizeTagName(body.name);

    const { data: duplicateTag } = await supabase
      .from('tags')
      .select('id, name')
      .eq('org_id', orgId)
      .neq('id', id)
      .ilike('name', normalizedName)
      .is('deleted_at', null)
      .single();

    if (duplicateTag) {
      return errors.badRequest(`Tag "${duplicateTag.name}" already exists`);
    }
  }

  // Update the tag
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (body.name) {
    updateData.name = body.name.trim();
  }

  if (body.color) {
    updateData.color = body.color;
  }

  const { data: updatedTag, error: updateError } = await supabase
    .from('tags')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateError) {
    console.error('[PATCH /api/tags/[id]] Error updating tag:', updateError);
    throw new Error('Failed to update tag');
  }

  // PERFORMANCE OPTIMIZATION: Invalidate tags cache
  const { CacheInvalidation } = await import('@/lib/services/cache');
  await CacheInvalidation.invalidateTags(orgId);

  return successResponse(updatedTag);
});

/**
 * DELETE /api/tags/[id] - Delete a tag (soft delete)
 *
 * This will:
 * 1. Soft delete the tag (set deleted_at timestamp)
 * 2. Remove all associations with recordings
 */
export const DELETE = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = params;
  const supabase = await createClient();

  // Check if tag exists
  const { data: tag, error: fetchError } = await supabase
    .from('tags')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !tag) {
    return errors.notFound('Tag');
  }

  // Start a transaction by performing both operations
  // 1. Remove all tag associations
  const { error: deleteAssociationsError } = await supabase
    .from('recording_tags')
    .delete()
    .eq('tag_id', id);

  if (deleteAssociationsError) {
    console.error('[DELETE /api/tags/[id]] Error deleting tag associations:', deleteAssociationsError);
    throw new Error('Failed to delete tag associations');
  }

  // 2. Soft delete the tag
  const { error: deleteError } = await supabase
    .from('tags')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);

  if (deleteError) {
    console.error('[DELETE /api/tags/[id]] Error deleting tag:', deleteError);
    throw new Error('Failed to delete tag');
  }

  // PERFORMANCE OPTIMIZATION: Invalidate tags cache
  const { CacheInvalidation } = await import('@/lib/services/cache');
  await CacheInvalidation.invalidateTags(orgId);

  return successResponse({ success: true });
});