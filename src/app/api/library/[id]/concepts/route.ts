import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import {
  getContentConceptsQuerySchema,
  type GetContentConceptsQueryInput,
  type Concept,
} from '@/lib/validations/knowledge';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/library/[id]/concepts - Get all concepts for a content item
 *
 * Query params:
 * - limit: Maximum number of concepts to return (default: 20)
 */
export const GET = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = await params;
  const query = parseSearchParams<GetContentConceptsQueryInput>(
    request,
    getContentConceptsQuerySchema
  );
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

  // Use database function to get concepts for this content
  const { data: concepts, error } = await supabase.rpc('get_content_concepts', {
    p_content_id: id,
    p_limit: query.limit,
  });

  if (error) {
    console.error('[GET /api/library/[id]/concepts] Error fetching concepts:', error);
    throw new Error('Failed to fetch concepts');
  }

  // Transform to camelCase and add mention context
  const transformedConcepts: (Concept & { mentionContext?: string; confidence?: number })[] = (
    concepts || []
  ).map((c: any) => ({
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
    // Additional fields from the join
    mentionContext: c.mention_context,
    confidence: c.confidence,
  }));

  // Group concepts by type for UI convenience
  const groupedByType = transformedConcepts.reduce(
    (acc, concept) => {
      const type = concept.conceptType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(concept);
      return acc;
    },
    {} as Record<string, typeof transformedConcepts>
  );

  const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');

  const responseData = {
    concepts: transformedConcepts,
    groupedByType,
    total: transformedConcepts.length,
  };

  const response = successResponse(responseData);

  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(responseData));

  return response;
});
