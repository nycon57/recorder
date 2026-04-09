import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import {
  listConceptsQuerySchema,
  type ListConceptsQueryInput,
  type Concept,
} from '@/lib/validations/knowledge';

/**
 * Escape SQL LIKE pattern metacharacters (%, _, \) to treat them as literals.
 * Backslash must be escaped first to avoid double-escaping.
 */
function escapeLike(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * GET /api/knowledge/concepts - List all organization concepts
 *
 * Query params:
 * - search: Search concept names
 * - type: Filter by concept type
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset
 * - sort: Sort order (mention_count_desc, last_seen_desc, name_asc, name_desc)
 * - minMentions: Minimum mention count filter
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<ListConceptsQueryInput>(request, listConceptsQuerySchema);
  const supabase = await createClient();

  // Build query
  let conceptsQuery = supabase
    .from('knowledge_concepts')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId);

  // Apply search filter
  if (query.search) {
    conceptsQuery = conceptsQuery.ilike('name', `%${escapeLike(query.search)}%`);
  }

  // Apply type filter
  if (query.type) {
    conceptsQuery = conceptsQuery.eq('concept_type', query.type);
  }

  // Apply minimum mentions filter
  if (query.minMentions) {
    conceptsQuery = conceptsQuery.gte('mention_count', query.minMentions);
  }

  // Apply sorting
  switch (query.sort) {
    case 'mention_count_desc':
      conceptsQuery = conceptsQuery.order('mention_count', { ascending: false });
      break;
    case 'last_seen_desc':
      conceptsQuery = conceptsQuery.order('last_seen_at', { ascending: false });
      break;
    case 'name_asc':
      conceptsQuery = conceptsQuery.order('name', { ascending: true });
      break;
    case 'name_desc':
      conceptsQuery = conceptsQuery.order('name', { ascending: false });
      break;
    default:
      conceptsQuery = conceptsQuery.order('mention_count', { ascending: false });
  }

  // Apply pagination
  conceptsQuery = conceptsQuery.range(query.offset, query.offset + query.limit - 1);

  const { data: concepts, error, count } = await conceptsQuery;

  if (error) {
    console.error('[GET /api/knowledge/concepts] Error fetching concepts:', error);
    throw new Error('Failed to fetch concepts');
  }

  // Transform to camelCase
  const transformedConcepts: Concept[] = (concepts || []).map((c) => ({
    id: c.id,
    orgId: c.org_id,
    name: c.name,
    normalizedName: c.normalized_name,
    description: c.description,
    conceptType: c.concept_type,
    mentionCount: c.mention_count,
    firstSeenAt: c.first_seen_at,
    lastSeenAt: c.last_seen_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');

  const response = successResponse({
    concepts: transformedConcepts,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count || 0,
      hasMore: query.offset + transformedConcepts.length < (count || 0),
    },
  });

  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(transformedConcepts));

  return response;
});
