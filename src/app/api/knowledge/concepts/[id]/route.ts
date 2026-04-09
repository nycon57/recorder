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
  // Query concept_relationships directly (same as graph API) to ensure consistency
  // This finds all relationships where the concept is either source (concept_a) or target (concept_b)
  if (query.includeRelated) {
    const { data: relationships } = await supabase
      .from('concept_relationships')
      .select(`
        id,
        concept_a_id,
        concept_b_id,
        relationship_type,
        strength,
        concept_a:knowledge_concepts!concept_relationships_concept_a_id_fkey (
          id, name, concept_type, mention_count
        ),
        concept_b:knowledge_concepts!concept_relationships_concept_b_id_fkey (
          id, name, concept_type, mention_count
        )
      `)
      .eq('org_id', orgId)
      .or(`concept_a_id.eq.${id},concept_b_id.eq.${id}`)
      .order('strength', { ascending: false })
      .limit(query.relatedLimit);

    if (relationships) {
      relatedConcepts = relationships.map((rel: any) => {
        // Determine which concept is the "other" one (not the current concept)
        const isConceptA = rel.concept_a_id === id;
        const relatedConcept = isConceptA ? rel.concept_b : rel.concept_a;

        return {
          id: relatedConcept?.id,
          orgId: orgId,
          name: relatedConcept?.name || 'Unknown',
          normalizedName: relatedConcept?.name?.toLowerCase().replace(/\s+/g, '_') || '',
          description: null,
          conceptType: relatedConcept?.concept_type || 'general',
          mentionCount: relatedConcept?.mention_count || 0,
          firstSeenAt: null,
          lastSeenAt: null,
          createdAt: null,
          updatedAt: null,
          relationshipType: rel.relationship_type || 'related',
          strength: rel.strength || 0,
        };
      }).filter((r: any) => r.id); // Filter out any null entries
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
