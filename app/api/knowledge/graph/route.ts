import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import {
  getGraphQuerySchema,
  type GetGraphQueryInput,
  type KnowledgeGraphData,
  type GraphNode,
  type GraphEdge,
} from '@/lib/validations/knowledge';

/**
 * GET /api/knowledge/graph - Fetch knowledge graph data for visualization
 *
 * Query params:
 * - maxNodes: Maximum number of nodes to return (10-200, default: 100)
 * - minStrength: Minimum relationship strength (0-1, default: 0.3)
 * - minMentions: Minimum mention count for concepts (default: 2)
 * - types: Comma-separated concept types to filter (e.g., "tool,process")
 * - focusConceptId: Optional concept ID to center the graph around
 *
 * Returns:
 * - nodes: Array of graph nodes (concepts with id, name, type, mentionCount)
 * - edges: Array of graph edges (relationships between concepts)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const query = parseSearchParams<GetGraphQueryInput>(request, getGraphQuerySchema);
  const supabase = await createClient();

  // ============================================================================
  // Fetch Nodes (Concepts)
  // ============================================================================

  let nodesQuery = supabase
    .from('knowledge_concepts')
    .select('id, name, concept_type, mention_count')
    .eq('org_id', orgId)
    .gte('mention_count', query.minMentions)
    .order('mention_count', { ascending: false });

  // Apply type filter if provided
  if (query.types && query.types.length > 0) {
    nodesQuery = nodesQuery.in('concept_type', query.types);
  }

  // If focusing on a specific concept, fetch it and its related concepts
  if (query.focusConceptId) {
    // Defense in depth: Validate UUID format before using in query
    // UUID regex: 8-4-4-4-12 hex characters with hyphens
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(query.focusConceptId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid focusConceptId format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Store validated value to use in queries
    const validatedFocusConceptId = query.focusConceptId;

    // Fetch the focus concept
    const { data: focusConcept, error: focusError } = await supabase
      .from('knowledge_concepts')
      .select('id, name, concept_type, mention_count')
      .eq('id', validatedFocusConceptId)
      .eq('org_id', orgId)
      .single();

    if (focusError) {
      console.error('[GET /api/knowledge/graph] Error fetching focus concept:', focusError);
      throw new Error('Failed to fetch focus concept');
    }

    if (!focusConcept) {
      throw new Error('Focus concept not found');
    }

    // Fetch related concepts through relationships
    const { data: relatedConcepts, error: relatedError } = await supabase
      .from('concept_relationships')
      .select(`
        concept_a_id,
        concept_b_id,
        strength,
        knowledge_concepts!concept_relationships_concept_a_id_fkey (id, name, concept_type, mention_count),
        knowledge_concepts!concept_relationships_concept_b_id_fkey (id, name, concept_type, mention_count)
      `)
      .eq('org_id', orgId)
      .gte('strength', query.minStrength)
      .or(`concept_a_id.eq.${validatedFocusConceptId},concept_b_id.eq.${validatedFocusConceptId}`);

    if (relatedError) {
      console.error('[GET /api/knowledge/graph] Error fetching related concepts:', relatedError);
      throw new Error('Failed to fetch related concepts');
    }

    // Build focused node set (focus concept + related concepts)
    const nodeMap = new Map<string, any>();
    nodeMap.set(focusConcept.id, focusConcept);

    (relatedConcepts || []).forEach((rel: any) => {
      const conceptA = rel.knowledge_concepts?.[0] || rel['knowledge_concepts!concept_relationships_concept_a_id_fkey'];
      const conceptB = rel.knowledge_concepts?.[1] || rel['knowledge_concepts!concept_relationships_concept_b_id_fkey'];

      if (conceptA && conceptA.id !== validatedFocusConceptId) {
        nodeMap.set(conceptA.id, conceptA);
      }
      if (conceptB && conceptB.id !== validatedFocusConceptId) {
        nodeMap.set(conceptB.id, conceptB);
      }
    });

    // Limit to maxNodes
    const nodesArray = Array.from(nodeMap.values())
      .slice(0, query.maxNodes);

    // Transform to GraphNode format
    const nodes: GraphNode[] = nodesArray.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.concept_type,
      mentionCount: c.mention_count || 0,
    }));

    // Fetch edges for these nodes (both endpoints must be in the selected node set)
    const nodeIds = nodes.map((n) => n.id);
    const { data: edges, error: edgesError } = await supabase
      .from('concept_relationships')
      .select('id, concept_a_id, concept_b_id, relationship_type, strength')
      .eq('org_id', orgId)
      .gte('strength', query.minStrength)
      .in('concept_a_id', nodeIds)
      .in('concept_b_id', nodeIds);

    if (edgesError) {
      console.error('[GET /api/knowledge/graph] Error fetching edges:', edgesError);
      throw new Error('Failed to fetch relationships');
    }

    // Transform edges
    const transformedEdges: GraphEdge[] = (edges || []).map((e) => ({
      id: e.id,
      source: e.concept_a_id,
      target: e.concept_b_id,
      type: e.relationship_type || 'related',
      strength: e.strength || 0,
    }));

    const graphData: KnowledgeGraphData = {
      nodes,
      edges: transformedEdges,
    };

    const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');
    const response = successResponse(graphData);
    response.headers.set('Cache-Control', CacheControlHeaders.metadata);
    response.headers.set('ETag', generateETag(graphData));

    return response;
  }

  // ============================================================================
  // Standard Graph (No Focus) - Fetch Top Concepts
  // ============================================================================

  // Limit to maxNodes
  nodesQuery = nodesQuery.limit(query.maxNodes);

  const { data: concepts, error: conceptsError } = await nodesQuery;

  if (conceptsError) {
    console.error('[GET /api/knowledge/graph] Error fetching concepts:', conceptsError);
    throw new Error('Failed to fetch concepts');
  }

  // Transform to GraphNode format
  const nodes: GraphNode[] = (concepts || []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.concept_type,
    mentionCount: c.mention_count || 0,
  }));

  // ============================================================================
  // Fetch Edges (Relationships)
  // ============================================================================

  // Get all relationships between the selected concepts
  const conceptIds = nodes.map((n) => n.id);

  if (conceptIds.length === 0) {
    // No concepts found, return empty graph
    const emptyGraph: KnowledgeGraphData = {
      nodes: [],
      edges: [],
    };

    const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');
    const response = successResponse(emptyGraph);
    response.headers.set('Cache-Control', CacheControlHeaders.metadata);
    response.headers.set('ETag', generateETag(emptyGraph));

    return response;
  }

  const { data: relationships, error: relationshipsError } = await supabase
    .from('concept_relationships')
    .select('id, concept_a_id, concept_b_id, relationship_type, strength')
    .eq('org_id', orgId)
    .gte('strength', query.minStrength)
    .in('concept_a_id', conceptIds)
    .in('concept_b_id', conceptIds);

  if (relationshipsError) {
    console.error('[GET /api/knowledge/graph] Error fetching relationships:', relationshipsError);
    throw new Error('Failed to fetch relationships');
  }

  // Transform to GraphEdge format
  const edges: GraphEdge[] = (relationships || []).map((r) => ({
    id: r.id,
    source: r.concept_a_id,
    target: r.concept_b_id,
    type: r.relationship_type || 'related',
    strength: r.strength || 0,
  }));

  // ============================================================================
  // Return Graph Data
  // ============================================================================

  const graphData: KnowledgeGraphData = {
    nodes,
    edges,
  };

  const { CacheControlHeaders, generateETag } = await import('@/lib/services/cache');

  const response = successResponse(graphData);
  response.headers.set('Cache-Control', CacheControlHeaders.metadata);
  response.headers.set('ETag', generateETag(graphData));

  return response;
});
