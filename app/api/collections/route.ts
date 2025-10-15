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
  createCollectionSchema,
  listCollectionsQuerySchema,
  type CreateCollectionInput,
  type ListCollectionsQueryInput,
} from '@/lib/validations/api';

/**
 * GET /api/collections - List collections
 *
 * Query params:
 * - parent_id: Filter by parent collection (null for root collections)
 * - search: Search collection names
 * - limit: Number of results
 * - offset: Pagination offset
 * - includeItemCount: Include count of items in each collection
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<ListCollectionsQueryInput>(
    request,
    listCollectionsQuerySchema
  );
  const supabase = await createClient();

  let collectionsQuery = supabase
    .from('collections')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Filter by parent_id (explicit null check for root collections)
  if (query.parent_id !== undefined) {
    if (query.parent_id === null) {
      collectionsQuery = collectionsQuery.is('parent_id', null);
    } else {
      collectionsQuery = collectionsQuery.eq('parent_id', query.parent_id);
    }
  }

  // Apply search filter
  if (query.search) {
    collectionsQuery = collectionsQuery.ilike('name', `%${query.search}%`);
  }

  // Apply sorting (by name ascending by default)
  collectionsQuery = collectionsQuery.order('name', { ascending: true });

  // Apply pagination
  const { data: collections, error, count } = await collectionsQuery.range(
    query.offset,
    query.offset + query.limit - 1
  );

  if (error) {
    console.error('[GET /api/collections] Error fetching collections:', error);
    throw new Error('Failed to fetch collections');
  }

  // If includeItemCount is requested, fetch counts
  let collectionsWithCounts = collections || [];
  if (query.includeItemCount && collections && collections.length > 0) {
    const collectionIds = collections.map((c) => c.id);

    // Get item counts for all collections
    const { data: counts, error: countError } = await supabase
      .from('collection_items')
      .select('collection_id')
      .in('collection_id', collectionIds);

    if (!countError && counts) {
      // Count occurrences of each collection
      const countMap = counts.reduce((acc, item) => {
        acc[item.collection_id] = (acc[item.collection_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Add item count to each collection
      collectionsWithCounts = collections.map((collection) => ({
        ...collection,
        item_count: countMap[collection.id] || 0,
      }));
    }
  }

  return successResponse({
    collections: collectionsWithCounts,
    pagination: {
      total: count || 0,
      limit: query.limit,
      offset: query.offset,
      hasMore: (count || 0) > query.offset + query.limit,
    },
  });
});

/**
 * POST /api/collections - Create a new collection
 *
 * Body:
 * - name: Collection name (required)
 * - description: Collection description (optional)
 * - parent_id: Parent collection ID for nesting (optional)
 * - color: Hex color code (optional, default: #3b82f6)
 * - icon: Icon name/emoji (optional)
 * - visibility: Visibility level (optional, default: org)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody<CreateCollectionInput>(request, createCollectionSchema);
  const supabase = await createClient();

  // If parent_id is provided, verify it exists and belongs to this org
  if (body.parent_id) {
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
  }

  // Create the collection
  const { data: newCollection, error } = await supabase
    .from('collections')
    .insert({
      org_id: orgId,
      created_by: userId,
      name: body.name.trim(),
      description: body.description || null,
      parent_id: body.parent_id || null,
      color: body.color || '#3b82f6',
      icon: body.icon || null,
      visibility: body.visibility || 'org',
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/collections] Error creating collection:', error);
    throw new Error('Failed to create collection');
  }

  // Log activity (non-blocking, errors are logged but don't fail the request)
  try {
    await supabase.from('activity_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'collection.created',
      resource_type: 'collection',
      resource_id: newCollection.id,
      metadata: { name: newCollection.name },
    });
  } catch (activityError) {
    console.error('[POST /api/collections] Failed to log activity:', activityError);
    // Continue without blocking the response
  }

  return successResponse(newCollection, undefined, 201);
});
