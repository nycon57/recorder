import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  LibraryMetadataCache,
  TagsCache,
  CollectionsCache,
  CacheControlHeaders,
  generateETag,
  type CachedLibraryMetadata,
  type CachedTag,
  type CachedCollection,
} from '@/lib/services/cache';

/**
 * GET /api/library/metadata
 *
 * Optimized endpoint that returns all library metadata in a single request:
 * - Tags list with usage counts
 * - Collections list with item counts
 * - Total counts
 *
 * This eliminates N+1 queries by combining multiple requests into one.
 * Cached for 10 minutes since tags/collections are relatively static.
 *
 * @route GET /api/library/metadata
 * @access Protected - Requires organization context
 *
 * @queryParams {
 *   includeUsageCount?: boolean;  // Include usage counts for tags (default: true)
 *   includeItemCount?: boolean;   // Include item counts for collections (default: true)
 * }
 *
 * @returns {
 *   tags: Array<{
 *     id: string;
 *     name: string;
 *     color: string;
 *     usage_count?: number;
 *   }>;
 *   collections: Array<{
 *     id: string;
 *     name: string;
 *     description?: string;
 *     item_count?: number;
 *   }>;
 *   counts: {
 *     totalTags: number;
 *     totalCollections: number;
 *   };
 * }
 *
 * @performance
 *   - Cached for 10 minutes (tags/collections rarely change)
 *   - Single database query per resource type
 *   - ETag support for conditional requests
 *   - Cache-Control headers for browser caching
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - Admin client used for efficiency
 *
 * @errors
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 500: Internal server error
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const requestId = generateRequestId();
  const { orgId } = await requireOrg();

  try {
    // Parse query params
    const url = new URL(request.url);
    const includeUsageCount = url.searchParams.get('includeUsageCount') !== 'false';
    const includeItemCount = url.searchParams.get('includeItemCount') !== 'false';

    // PERFORMANCE OPTIMIZATION: Check cache first
    const cachedMetadata = await LibraryMetadataCache.get(orgId);

    if (cachedMetadata) {
      // Cache hit - return cached metadata with cache headers
      const etag = generateETag(cachedMetadata);
      const response = successResponse(cachedMetadata, requestId);

      response.headers.set('Cache-Control', CacheControlHeaders.metadata);
      response.headers.set('ETag', etag);
      response.headers.set('X-Cache', 'HIT');

      return response;
    }

    // Cache miss - fetch from database
    // Fetch tags and collections in parallel
    const [tagsResult, collectionsResult] = await Promise.all([
      fetchTags(orgId, includeUsageCount),
      fetchCollections(orgId, includeItemCount),
    ]);

    const metadata: CachedLibraryMetadata = {
      tags: tagsResult.tags,
      collections: collectionsResult.collections,
      counts: {
        totalTags: tagsResult.tags.length,
        totalCollections: collectionsResult.collections.length,
      },
    };

    // PERFORMANCE OPTIMIZATION: Cache the metadata
    await LibraryMetadataCache.set(orgId, metadata);

    // Also cache individual resources for use by other endpoints
    await Promise.all([
      TagsCache.set(orgId, metadata.tags),
      CollectionsCache.set(orgId, metadata.collections),
    ]);

    // Add cache headers to response
    const etag = generateETag(metadata);
    const response = successResponse(metadata, requestId);

    response.headers.set('Cache-Control', CacheControlHeaders.metadata);
    response.headers.set('ETag', etag);
    response.headers.set('X-Cache', 'MISS');

    return response;
  } catch (error: any) {
    console.error('[Library Metadata] Request error:', error);
    return errors.internalError(requestId);
  }
});

/**
 * Fetch tags for an org with optional usage counts
 */
async function fetchTags(
  orgId: string,
  includeUsageCount: boolean
): Promise<{ tags: CachedTag[] }> {
  const supabase = supabaseAdmin;

  // Fetch all tags for the org
  const { data: tags, error } = await supabase
    .from('tags')
    .select('id, name, color, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Library Metadata] Error fetching tags:', error);
    throw new Error('Failed to fetch tags');
  }

  let tagsWithCounts: CachedTag[] = tags || [];

  // If usage counts requested, fetch them
  if (includeUsageCount && tags && tags.length > 0) {
    const tagIds = tags.map((t) => t.id);

    // Get usage counts for all tags in a single query
    const { data: counts, error: countError } = await supabase
      .from('content_tags')
      .select('tag_id')
      .in('tag_id', tagIds);

    if (!countError && counts) {
      // Count occurrences of each tag
      const usageMap = counts.reduce((acc, item) => {
        acc[item.tag_id] = (acc[item.tag_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Add usage count to each tag
      tagsWithCounts = tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        usage_count: usageMap[tag.id] || 0,
      }));
    }
  }

  return { tags: tagsWithCounts };
}

/**
 * Fetch collections for an org with optional item counts
 */
async function fetchCollections(
  orgId: string,
  includeItemCount: boolean
): Promise<{ collections: CachedCollection[] }> {
  const supabase = supabaseAdmin;

  // Fetch all collections for the org
  const { data: collections, error } = await supabase
    .from('collections')
    .select('id, name, description, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Library Metadata] Error fetching collections:', error);
    throw new Error('Failed to fetch collections');
  }

  let collectionsWithCounts: CachedCollection[] = collections || [];

  // If item counts requested, fetch them
  if (includeItemCount && collections && collections.length > 0) {
    const collectionIds = collections.map((c) => c.id);

    // Get item counts for all collections in a single query
    const { data: counts, error: countError } = await supabase
      .from('recording_collections')
      .select('collection_id')
      .in('collection_id', collectionIds);

    if (!countError && counts) {
      // Count occurrences of each collection
      const itemMap = counts.reduce((acc, item) => {
        acc[item.collection_id] = (acc[item.collection_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Add item count to each collection
      collectionsWithCounts = collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        item_count: itemMap[collection.id] || 0,
      }));
    }
  }

  return { collections: collectionsWithCounts };
}
