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
  updateCollectionSchema,
  type UpdateCollectionInput,
} from '@/lib/validations/api';

/**
 * GET /api/collections/[id] - Get a single collection
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = await createClient();
    const { id: collectionId } = await params;

    const { data: collection, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !collection) {
      return errors.notFound('Collection', undefined);
    }

    // Get item count
    const { count: itemCount } = await supabase
      .from('collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    return successResponse({
      ...collection,
      item_count: itemCount || 0,
    });
  }
);

/**
 * PATCH /api/collections/[id] - Update a collection
 *
 * Body:
 * - name: Collection name (optional)
 * - description: Collection description (optional)
 * - parent_id: Parent collection ID (optional, null to make root)
 * - color: Hex color code (optional)
 * - icon: Icon name/emoji (optional)
 * - visibility: Visibility level (optional)
 */
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody<UpdateCollectionInput>(request, updateCollectionSchema);
    const supabase = await createClient();
    const { id: collectionId } = await params;

    // Verify collection exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return errors.notFound('Collection', undefined);
    }

    // If parent_id is being updated, verify it exists and prevent circular references
    if (body.parent_id !== undefined && body.parent_id !== null) {
      // Prevent making a collection its own parent
      if (body.parent_id === collectionId) {
        return errors.badRequest('Collection cannot be its own parent');
      }

      // Verify parent exists
      const { data: parent, error: parentError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', body.parent_id)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single();

      if (parentError || !parent) {
        return errors.notFound('Parent collection', undefined);
      }

      // Check for circular references by traversing up the parent chain
      const checkCircularReference = async (parentId: string): Promise<boolean> => {
        const visited = new Set<string>();
        let currentId: string | null = parentId;

        while (currentId) {
          // If we encounter the collection we're editing, it's a circular reference
          if (currentId === collectionId) {
            return true;
          }
          // Prevent infinite loops in case of existing bad data
          if (visited.has(currentId)) {
            break;
          }
          visited.add(currentId);

          const { data: parentCollection } = await supabase
            .from('collections')
            .select('parent_id')
            .eq('id', currentId)
            .eq('org_id', orgId)
            .is('deleted_at', null)
            .single();

          currentId = parentCollection?.parent_id || null;
        }

        return false;
      };

      const hasCircularRef = await checkCircularReference(body.parent_id);
      if (hasCircularRef) {
        return errors.badRequest(
          'Cannot set this parent: it would create a circular reference'
        );
      }
    }

    // Update the collection
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description;
    if (body.parent_id !== undefined) updateData.parent_id = body.parent_id;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;

    const { data: updated, error: updateError } = await supabase
      .from('collections')
      .update(updateData)
      .eq('id', collectionId)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH /api/collections/[id]] Error updating collection:', updateError);
      throw new Error('Failed to update collection');
    }

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'collection.updated',
      resource_type: 'collection',
      resource_id: collectionId,
      metadata: { name: updated.name },
    });

    return successResponse(updated);
  }
);

/**
 * DELETE /api/collections/[id] - Delete a collection
 *
 * Soft deletes the collection. Items in the collection are not deleted.
 * Child collections can be optionally handled (future enhancement).
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = await createClient();
    const { id: collectionId } = await params;

    // Verify collection exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return errors.notFound('Collection', undefined);
    }

    // Check if collection has children
    const { count: childCount } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', collectionId)
      .is('deleted_at', null);

    if (childCount && childCount > 0) {
      return errors.badRequest(
        'Cannot delete collection with child collections. Please delete or move child collections first.'
      );
    }

    // Soft delete the collection
    const { error: deleteError } = await supabase
      .from('collections')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId);

    if (deleteError) {
      console.error('[DELETE /api/collections/[id]] Error deleting collection:', deleteError);
      throw new Error('Failed to delete collection');
    }

    // Remove all items from the collection
    await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId);

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'collection.deleted',
      resource_type: 'collection',
      resource_id: collectionId,
      metadata: { name: existing.name },
    });

    return successResponse({ deleted: true });
  }
);
