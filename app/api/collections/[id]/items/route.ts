import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import {
  addCollectionItemsSchema,
  removeCollectionItemsSchema,
  listCollectionItemsQuerySchema,
  type AddCollectionItemsInput,
  type RemoveCollectionItemsInput,
  type ListCollectionItemsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/collections/[id]/items - List items in a collection
 *
 * Query params:
 * - limit: Number of results
 * - offset: Pagination offset
 * - content_type: Filter by content type
 * - sort: Sort order (created_asc, created_desc, title_asc, title_desc)
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const query = parseSearchParams<ListCollectionItemsQueryInput>(
      request,
      listCollectionItemsQuerySchema
    );
    const supabase = await createClient();
    const { id: collectionId } = await params;

    // Verify collection exists and belongs to this org
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !collection) {
      return errors.notFound('Collection', undefined);
    }

    // Build query for collection items with content
    let itemsQuery = supabase
      .from('collection_items')
      .select(
        `
        content_id,
        added_at,
        content!inner(
          id,
          title,
          content_type,
          created_at,
          deleted_at
        )
      `,
        { count: 'exact' }
      )
      .eq('collection_id', collectionId)
      .is('content.deleted_at', null);

    // Apply content_type filter
    if (query.content_type) {
      itemsQuery = itemsQuery.eq('content.content_type', query.content_type);
    }

    // Apply sorting
    switch (query.sort) {
      case 'created_asc':
        itemsQuery = itemsQuery.order('content(created_at)', { ascending: true });
        break;
      case 'created_desc':
        itemsQuery = itemsQuery.order('content(created_at)', { ascending: false });
        break;
      case 'title_asc':
        itemsQuery = itemsQuery.order('content(title)', { ascending: true });
        break;
      case 'title_desc':
        itemsQuery = itemsQuery.order('content(title)', { ascending: false });
        break;
      default:
        itemsQuery = itemsQuery.order('added_at', { ascending: false });
    }

    // Apply pagination
    const { data: items, error, count } = await itemsQuery.range(
      query.offset,
      query.offset + query.limit - 1
    );

    if (error) {
      console.error('[GET /api/collections/[id]/items] Error fetching items:', error);
      throw new Error('Failed to fetch collection items');
    }

    // Transform the data
    const formattedItems = (items || []).map((item: any) => ({
      id: item.content.id,
      title: item.content.title,
      content_type: item.content.content_type,
      created_at: item.content.created_at,
      added_at: item.added_at,
    }));

    return successResponse({
      items: formattedItems,
      pagination: {
        total: count || 0,
        limit: query.limit,
        offset: query.offset,
        hasMore: (count || 0) > query.offset + query.limit,
      },
    });
  }
);

/**
 * POST /api/collections/[id]/items - Add items to a collection
 *
 * Body:
 * - item_ids: Array of recording IDs to add (1-100 items)
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody<AddCollectionItemsInput>(request, addCollectionItemsSchema);
    const supabase = await createClient();
    const { id: collectionId } = await params;

    // Verify collection exists and belongs to this org
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !collection) {
      return errors.notFound('Collection', undefined);
    }

    // Verify all recordings exist and belong to this org
    const { data: recordings, error: recordingsError } = await supabase
      .from('content')
      .select('id')
      .in('id', body.item_ids)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (recordingsError) {
      console.error('[POST /api/collections/[id]/items] Error verifying recordings:', recordingsError);
      throw new Error('Failed to verify recordings');
    }

    if (!recordings || recordings.length !== body.item_ids.length) {
      return errors.badRequest('One or more recordings not found or do not belong to this organization');
    }

    // Insert collection items (ignore duplicates)
    const itemsToInsert = body.item_ids.map((contentId) => ({
      collection_id: collectionId,
      content_id: contentId,
      added_by: userId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('collection_items')
      .upsert(itemsToInsert, {
        onConflict: 'collection_id,content_id',
        ignoreDuplicates: true,
      })
      .select();

    if (insertError) {
      console.error('[POST /api/collections/[id]/items] Error adding items:', insertError);
      throw new Error('Failed to add items to collection');
    }

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'collection.item_added',
      resource_type: 'collection',
      resource_id: collectionId,
      metadata: {
        collection_name: collection.name,
        items_added: inserted?.length || 0,
      },
    });

    return successResponse({
      added: inserted?.length || 0,
      skipped: body.item_ids.length - (inserted?.length || 0),
    });
  }
);

/**
 * DELETE /api/collections/[id]/items - Remove items from a collection
 *
 * Body:
 * - item_ids: Array of recording IDs to remove (1-100 items)
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody<RemoveCollectionItemsInput>(request, removeCollectionItemsSchema);
    const supabase = await createClient();
    const { id: collectionId } = await params;

    // Verify collection exists and belongs to this org
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !collection) {
      return errors.notFound('Collection', undefined);
    }

    // Remove items from collection
    const { error: deleteError } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .in('content_id', body.item_ids);

    if (deleteError) {
      console.error('[DELETE /api/collections/[id]/items] Error removing items:', deleteError);
      throw new Error('Failed to remove items from collection');
    }

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'collection.item_removed',
      resource_type: 'collection',
      resource_id: collectionId,
      metadata: {
        collection_name: collection.name,
        items_removed: body.item_ids.length,
      },
    });

    return successResponse({ removed: body.item_ids.length });
  }
);
