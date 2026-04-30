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
  CONCEPT_TYPES,
  type GetConceptQueryInput,
  type Concept,
  type ConceptType,
  type RelatedConcept,
  type ConceptMention,
} from '@/lib/validations/knowledge';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface KnowledgeConceptRow {
  id: string;
  org_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  concept_type: string | null;
  mention_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ConceptRelationshipRow {
  id: string;
  concept_a_id: string;
  concept_b_id: string;
  relationship_type: string | null;
  strength: number | null;
  concept_a: KnowledgeConceptRow | null;
  concept_b: KnowledgeConceptRow | null;
}

interface ConceptMentionRow {
  id: string;
  concept_id: string;
  content_id: string;
  chunk_id: string | null;
  context: string | null;
  timestamp_sec: number | null;
  confidence: number | null;
  created_at: string | null;
  content: {
    id: string;
    title: string;
    content_type: string;
    thumbnail_url: string | null;
  } | null;
}

function toConceptType(value: string | null | undefined): ConceptType {
  return CONCEPT_TYPES.includes(value as ConceptType)
    ? (value as ConceptType)
    : 'general';
}

function toConcept(row: KnowledgeConceptRow): Concept {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description,
    conceptType: toConceptType(row.concept_type),
    mentionCount: row.mention_count ?? 0,
    firstSeenAt: row.first_seen_at ?? row.created_at ?? '',
    lastSeenAt: row.last_seen_at ?? row.updated_at ?? row.created_at ?? '',
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? row.created_at ?? '',
  };
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
  const transformedConcept = toConcept(concept);

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
      relatedConcepts = (relationships as unknown as ConceptRelationshipRow[]).map((rel) => {
        // Determine which concept is the "other" one (not the current concept)
        const isConceptA = rel.concept_a_id === id;
        const relatedConcept = isConceptA ? rel.concept_b : rel.concept_a;

        if (!relatedConcept) {
          return null;
        }

        const transformedRelatedConcept = toConcept(relatedConcept);

        return {
          ...transformedRelatedConcept,
          relationshipType: rel.relationship_type || 'related',
          strength: rel.strength || 0,
        };
      }).filter((related): related is RelatedConcept => related !== null);
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
      recentMentions = (mentions as unknown as ConceptMentionRow[]).map((m) => ({
        id: m.id,
        conceptId: m.concept_id,
        contentId: m.content_id,
        chunkId: m.chunk_id,
        context: m.context,
        timestampSec: m.timestamp_sec,
        confidence: m.confidence ?? 0,
        createdAt: m.created_at ?? '',
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
