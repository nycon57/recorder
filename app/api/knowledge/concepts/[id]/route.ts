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
  getConceptQuerySchema,
  type GetConceptQueryInput,
  type Concept,
  type RelatedConcept,
  type ConceptMention,
} from '@/lib/validations/knowledge';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/knowledge/concepts/[id] - Get a specific concept with related data
 *
 * Query params:
 * - includeRelated: Include related concepts (default: true)
 * - includeMentions: Include recent mentions (default: true)
 * - relatedLimit: Max related concepts (default: 10)
 * - mentionsLimit: Max mentions (default: 10)
 */
export const GET = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = await params;
  const query = parseSearchParams<GetConceptQueryInput>(request, getConceptQuerySchema);
  const supabase = await createClient();

  // Get the concept
  const { data: concept, error } = await supabase
    .from('knowledge_concepts')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !concept) {
    return errors.notFound('Concept');
  }

  // Transform concept to camelCase
  const transformedConcept: Concept = {
    id: concept.id,
    orgId: concept.org_id,
    name: concept.name,
    normalizedName: concept.normalized_name,
    description: concept.description,
    conceptType: concept.concept_type,
    mentionCount: concept.mention_count,
    firstSeenAt: concept.first_seen_at,
    lastSeenAt: concept.last_seen_at,
    createdAt: concept.created_at,
    updatedAt: concept.updated_at,
  };

  let relatedConcepts: RelatedConcept[] = [];
  let recentMentions: ConceptMention[] = [];

  // Get related concepts if requested
  // SECURITY NOTE: The get_related_concepts RPC function joins on concept_relationships
  // which are scoped by org_id in the database. The concept itself is already verified
  // to belong to the requesting organization (line 45 above).
  if (query.includeRelated) {
    const { data: related } = await supabase.rpc('get_related_concepts', {
      p_concept_id: id,
      p_limit: query.relatedLimit,
    });

    if (related) {
      relatedConcepts = related.map((r: any) => ({
        id: r.id,
        orgId: r.org_id,
        name: r.name,
        normalizedName: r.normalized_name,
        description: r.description,
        conceptType: r.concept_type,
        mentionCount: r.mention_count,
        firstSeenAt: r.first_seen_at,
        lastSeenAt: r.last_seen_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        relationshipType: r.relationship_type,
        strength: r.strength,
      }));
    }
  }

  // Get recent mentions if requested
  if (query.includeMentions) {
    const { data: mentions } = await supabase
      .from('concept_mentions')
      .select(
        `
        id,
        concept_id,
        content_id,
        chunk_id,
        context,
        timestamp_sec,
        confidence,
        created_at,
        content:content_id (
          id,
          title,
          content_type,
          thumbnail_url
        )
      `
      )
      .eq('concept_id', id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(query.mentionsLimit);

    if (mentions) {
      recentMentions = mentions.map((m: any) => ({
        id: m.id,
        conceptId: m.concept_id,
        contentId: m.content_id,
        chunkId: m.chunk_id,
        context: m.context,
        timestampSec: m.timestamp_sec,
        confidence: m.confidence,
        createdAt: m.created_at,
        content: m.content
          ? {
              id: m.content.id,
              title: m.content.title,
              contentType: m.content.content_type,
              thumbnailUrl: m.content.thumbnail_url,
            }
          : undefined,
      }));
    }
  }

  const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');

  const responseData = {
    concept: transformedConcept,
    relatedConcepts,
    recentMentions,
  };

  const response = successResponse(responseData);

  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(responseData));

  return response;
});
