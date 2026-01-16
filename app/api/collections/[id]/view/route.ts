import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/collections/[id]/view
 * Returns complete view data for a collection:
 * - Collection details
 * - Subcollections (children)
 * - Content items in this collection
 * - Breadcrumb path from root
 *
 * Query params:
 * - limit: Number of content items (default: 50, max: 100)
 * - offset: Pagination offset for content items
 * - sort: Sort order (recent, oldest, name-asc, name-desc)
 */
export const GET = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireOrg();
    const { id: collectionId } = await params;
    const supabase = supabaseAdmin;

    // Parse query params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sort = url.searchParams.get('sort') || 'recent';

    // 1. Fetch the collection and verify access
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (collectionError || !collection) {
      return errors.notFound('Collection');
    }

    // 2. Build breadcrumb path from root to current collection
    const breadcrumb = await buildBreadcrumb(supabase, collection, orgId);

    // 3. Fetch subcollections
    const { data: subcollections, error: subError } = await supabase
      .from('collections')
      .select('id, name, description, color, icon, depth, created_at')
      .eq('org_id', orgId)
      .eq('parent_id', collectionId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (subError) {
      console.error('[GET /api/collections/[id]/view] Subcollections error:', subError);
      throw new Error('Failed to fetch subcollections');
    }

    // Get item counts for subcollections
    const subcollectionIds = subcollections?.map(s => s.id) || [];
    let subcollectionsWithCounts = subcollections || [];

    if (subcollectionIds.length > 0) {
      const { data: itemCounts } = await supabase
        .from('content')
        .select('collection_id')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .in('collection_id', subcollectionIds);

      const countMap: Record<string, number> = {};
      itemCounts?.forEach(item => {
        if (item.collection_id) {
          countMap[item.collection_id] = (countMap[item.collection_id] || 0) + 1;
        }
      });

      subcollectionsWithCounts = subcollections?.map(sub => ({
        ...sub,
        item_count: countMap[sub.id] || 0,
      })) || [];
    }

    // 4. Fetch content items in this collection
    let contentQuery = supabase
      .from('content')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('collection_id', collectionId)
      .is('deleted_at', null);

    // Apply sorting
    switch (sort) {
      case 'oldest':
        contentQuery = contentQuery.order('created_at', { ascending: true });
        break;
      case 'name-asc':
        contentQuery = contentQuery.order('title', { ascending: true, nullsFirst: false });
        break;
      case 'name-desc':
        contentQuery = contentQuery.order('title', { ascending: false, nullsFirst: false });
        break;
      case 'recent':
      default:
        contentQuery = contentQuery.order('created_at', { ascending: false });
        break;
    }

    const { data: items, error: itemsError, count } = await contentQuery
      .range(offset, offset + limit - 1);

    if (itemsError) {
      console.error('[GET /api/collections/[id]/view] Items error:', itemsError);
      throw new Error('Failed to fetch content items');
    }

    return successResponse({
      collection: {
        ...collection,
        item_count: count || 0,
        subcollection_count: subcollectionsWithCounts.length,
      },
      breadcrumb,
      subcollections: subcollectionsWithCounts,
      items: items || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  }
);

/**
 * Build breadcrumb path from root to current collection
 */
async function buildBreadcrumb(
  supabase: typeof supabaseAdmin,
  collection: { id: string; name: string; parent_id: string | null },
  orgId: string
): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let current: { id: string; name: string; parent_id: string | null } | null = collection;
  const visited = new Set<string>();

  // Traverse up to root (max 10 iterations for safety)
  while (current && path.length < 10) {
    // Check for circular reference
    if (visited.has(current.id)) {
      console.warn('[buildBreadcrumb] Circular reference detected');
      break;
    }
    visited.add(current.id);

    path.unshift({ id: current.id, name: current.name });

    if (!current.parent_id) break;

    // Fetch parent
    const { data: parent } = await supabase
      .from('collections')
      .select('id, name, parent_id')
      .eq('id', current.parent_id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    current = parent;
  }

  return path;
}
