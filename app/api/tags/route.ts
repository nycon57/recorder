import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import {
  createTagSchema,
  listTagsQuerySchema,
  normalizeTagName,
  type CreateTagInput,
  type ListTagsQueryInput,
} from '@/lib/validations/tags';

/**
 * GET /api/tags - List all organization tags
 *
 * Query params:
 * - search: Search tag names
 * - limit: Number of results
 * - offset: Pagination offset
 * - sort: Sort order
 * - includeUsageCount: Include count of items using each tag
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<ListTagsQueryInput>(request, listTagsQuerySchema);
  const supabase = await createClient();

  // PERFORMANCE OPTIMIZATION: Check cache for simple tag list requests
  // Only cache when no search/sort filters and includeUsageCount is true
  const isCacheable = !query.search && query.sort === 'name_asc' && query.includeUsageCount;

  if (isCacheable) {
    const { TagsCache, CacheControlHeaders, generateETag } = await import('@/lib/services/cache');
    const cachedTags = await TagsCache.get(orgId);

    if (cachedTags) {
      // Apply pagination to cached results
      const paginatedTags = cachedTags.slice(query.offset, query.offset + query.limit);

      const response = successResponse({
        tags: paginatedTags,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: cachedTags.length,
        },
      });

      response.headers.set('Cache-Control', CacheControlHeaders.metadata);
      response.headers.set('ETag', generateETag(paginatedTags));
      response.headers.set('X-Cache', 'HIT');

      return response;
    }
  }

  let tagsQuery = supabase
    .from('tags')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Apply search filter
  if (query.search) {
    tagsQuery = tagsQuery.ilike('name', `%${query.search}%`);
  }

  // Apply sorting
  switch (query.sort) {
    case 'name_asc':
      tagsQuery = tagsQuery.order('name', { ascending: true });
      break;
    case 'name_desc':
      tagsQuery = tagsQuery.order('name', { ascending: false });
      break;
    case 'created_asc':
      tagsQuery = tagsQuery.order('created_at', { ascending: true });
      break;
    case 'created_desc':
      tagsQuery = tagsQuery.order('created_at', { ascending: false });
      break;
    case 'usage_desc':
      // For usage sorting, we'll need to join with recording_tags
      // This is handled separately below
      break;
    default:
      tagsQuery = tagsQuery.order('name', { ascending: true });
  }

  // Apply pagination
  tagsQuery = tagsQuery.range(query.offset, query.offset + query.limit - 1);

  const { data: tags, error } = await tagsQuery;

  if (error) {
    console.error('[GET /api/tags] Error fetching tags:', error);
    throw new Error('Failed to fetch tags');
  }

  // If includeUsageCount is requested, fetch counts
  let tagsWithCounts = tags || [];
  if (query.includeUsageCount && tags && tags.length > 0) {
    const tagIds = tags.map(t => t.id);

    // Get usage counts for all tags
    const { data: counts, error: countError } = await supabase
      .from('recording_tags')
      .select('tag_id')
      .in('tag_id', tagIds);

    if (!countError && counts) {
      // Count occurrences of each tag
      const usageMap = counts.reduce((acc, item) => {
        acc[item.tag_id] = (acc[item.tag_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Add usage count to each tag
      tagsWithCounts = tags.map(tag => ({
        ...tag,
        usage_count: usageMap[tag.id] || 0,
      }));

      // Sort by usage if requested
      if (query.sort === 'usage_desc') {
        tagsWithCounts.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
      }
    }
  }

  // PERFORMANCE OPTIMIZATION: Cache simple tag list responses
  if (isCacheable && tagsWithCounts.length > 0) {
    const { TagsCache } = await import('@/lib/services/cache');
    await TagsCache.set(orgId, tagsWithCounts);
  }

  const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');
  const response = successResponse({
    tags: tagsWithCounts,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: tags?.length || 0, // This is approximate, for exact count we'd need a separate query
    },
  });

  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(tagsWithCounts));
  response.headers.set('X-Cache', isCacheable ? 'MISS' : 'BYPASS');

  return response;
});

/**
 * POST /api/tags - Create a new tag
 *
 * Body:
 * - name: Tag name (required)
 * - color: Hex color code (optional)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const body = await parseBody<CreateTagInput>(request, createTagSchema);
  const supabase = await createClient();

  // Normalize tag name for uniqueness check
  const normalizedName = normalizeTagName(body.name);

  // Check if tag already exists (case-insensitive)
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id, name')
    .eq('org_id', orgId)
    .ilike('name', normalizedName)
    .is('deleted_at', null)
    .single();

  if (existingTag) {
    return errors.badRequest(`Tag "${existingTag.name}" already exists`);
  }

  // Create the tag
  const { data: newTag, error } = await supabase
    .from('tags')
    .insert({
      org_id: orgId,
      name: body.name.trim(),
      color: body.color || '#3b82f6',
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/tags] Error creating tag:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return errors.badRequest('A tag with this name already exists');
    }

    throw new Error('Failed to create tag');
  }

  // PERFORMANCE OPTIMIZATION: Invalidate tags cache
  const { CacheInvalidation } = await import('@/lib/services/cache');
  await CacheInvalidation.invalidateTags(orgId);

  return successResponse(newTag, undefined, 201);
});