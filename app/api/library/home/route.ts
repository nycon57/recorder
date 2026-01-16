import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/library/home
 * Returns data for the library home/root view:
 * - Root collections (depth 0)
 * - Recent items (last 10)
 * - Uncategorized count (items not in any collection)
 * - Favorites count
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  // Parse query params
  const url = new URL(request.url);
  const recentLimit = Math.min(parseInt(url.searchParams.get('recentLimit') || '10'), 20);

  // Execute all queries in parallel for performance
  const [
    collectionsResult,
    recentItemsResult,
    uncategorizedResult,
    favoritesResult,
    totalContentResult,
  ] = await Promise.all([
    // 1. Root collections (depth 0) with item counts
    supabase
      .from('collections')
      .select(`
        id,
        name,
        description,
        color,
        icon,
        depth,
        created_at,
        updated_at
      `)
      .eq('org_id', orgId)
      .eq('depth', 0)
      .is('deleted_at', null)
      .order('name', { ascending: true }),

    // 2. Recent items (not deleted, across all collections)
    supabase
      .from('content')
      .select('id, title, content_type, file_type, status, thumbnail_url, duration_sec, created_at, collection_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(recentLimit),

    // 3. Count of uncategorized items (no collection_id)
    supabase
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .is('collection_id', null),

    // 4. Count of favorited items
    supabase
      .from('favorites')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),

    // 5. Total content count
    supabase
      .from('content')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null),
  ]);

  // Handle errors
  if (collectionsResult.error) {
    console.error('[GET /api/library/home] Collections error:', collectionsResult.error);
    throw new Error('Failed to fetch collections');
  }
  if (recentItemsResult.error) {
    console.error('[GET /api/library/home] Recent items error:', recentItemsResult.error);
    throw new Error('Failed to fetch recent items');
  }

  // Get item counts for each root collection
  const collectionIds = collectionsResult.data?.map(c => c.id) || [];
  let collectionsWithCounts = collectionsResult.data || [];

  if (collectionIds.length > 0) {
    // Count items in each collection (including nested items via collection_id)
    const { data: contentCounts } = await supabase
      .from('content')
      .select('collection_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('collection_id', collectionIds);

    // Count subcollections for each root collection
    const { data: subcollectionCounts } = await supabase
      .from('collections')
      .select('parent_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('parent_id', collectionIds);

    // Build count maps
    const itemCountMap: Record<string, number> = {};
    const subcollectionCountMap: Record<string, number> = {};

    contentCounts?.forEach(item => {
      if (item.collection_id) {
        itemCountMap[item.collection_id] = (itemCountMap[item.collection_id] || 0) + 1;
      }
    });

    subcollectionCounts?.forEach(sub => {
      if (sub.parent_id) {
        subcollectionCountMap[sub.parent_id] = (subcollectionCountMap[sub.parent_id] || 0) + 1;
      }
    });

    // Add counts to collections
    collectionsWithCounts = collectionsResult.data?.map(collection => ({
      ...collection,
      item_count: itemCountMap[collection.id] || 0,
      subcollection_count: subcollectionCountMap[collection.id] || 0,
    })) || [];
  }

  return successResponse({
    collections: collectionsWithCounts,
    recentItems: recentItemsResult.data || [],
    counts: {
      uncategorized: uncategorizedResult.count || 0,
      favorites: favoritesResult.count || 0,
      total: totalContentResult.count || 0,
    },
  });
});
