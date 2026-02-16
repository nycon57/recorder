/**
 * MCP Tool Handlers
 *
 * Dedicated handler functions for MCP tools that match the US-050
 * acceptance criteria exactly. Each returns structured JSON that
 * external agents can parse.
 *
 * All queries are scoped by org_id for multi-tenant isolation.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { injectRAGContext } from '@/lib/services/chat-rag-integration';

/** Org context passed to every handler. */
export interface McpToolContext {
  orgId: string;
}

/** MCP error with a machine-readable code. */
export class McpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

// Supabase join result shapes (the generated types don't cover joins)
interface ContentJoinRow {
  id: string;
  title: string | null;
  org_id: string;
  duration_sec?: number | null;
}

interface RelatedConceptJoinRow {
  id: string;
  name: string;
  concept_type: string;
  mention_count: number;
  description: string | null;
  org_id: string;
}

// ---------------------------------------------------------------------------
// searchRecordings
// ---------------------------------------------------------------------------

interface SearchRecordingsInput {
  query: string;
  limit: number;
  contentTypes?: string[];
}

interface SearchRecordingResult {
  id: string;
  title: string;
  contentType: string;
  snippet: string;
  similarity: number;
  createdAt: string;
}

export async function handleSearchRecordings(
  input: SearchRecordingsInput,
  ctx: McpToolContext
): Promise<SearchRecordingResult[]> {
  const { query, limit, contentTypes } = input;

  // Map contentTypes filter to RAG options
  const includeTranscripts =
    !contentTypes || contentTypes.some((t) => ['recording', 'video', 'audio'].includes(t));
  const includeDocuments =
    !contentTypes || contentTypes.some((t) => ['document', 'text'].includes(t));

  const ragContext = await injectRAGContext(query, ctx.orgId, {
    limit,
    minRelevance: 0.3,
    includeTranscripts,
    includeDocuments,
    useHierarchical: true,
    enableCache: true,
  });

  if (!ragContext.sources || ragContext.sources.length === 0) {
    return [];
  }

  // Look up content metadata for sources that have contentId
  const contentIds = [
    ...new Set(ragContext.sources.map((s) => s.contentId).filter(Boolean)),
  ] as string[];

  const contentMap = new Map<
    string,
    { title: string; content_type: string; created_at: string }
  >();

  if (contentIds.length > 0) {
    const { data: contentItems } = await supabaseAdmin
      .from('content')
      .select('id, title, content_type, created_at')
      .in('id', contentIds)
      .eq('org_id', ctx.orgId);

    for (const item of contentItems ?? []) {
      contentMap.set(item.id, {
        title: item.title ?? 'Untitled',
        content_type: item.content_type ?? 'recording',
        created_at: item.created_at,
      });
    }
  }

  const results: SearchRecordingResult[] = ragContext.sources
    .filter((s) => s.contentId)
    .map((source) => {
      const meta = contentMap.get(source.contentId!);
      return {
        id: source.contentId!,
        title: meta?.title ?? source.title,
        contentType: meta?.content_type ?? (source.type === 'document' ? 'document' : 'recording'),
        snippet: source.excerpt,
        similarity: Math.round(source.relevanceScore * 100) / 100,
        createdAt: meta?.created_at ?? '',
      };
    });

  // Apply contentTypes filter on the final results if specified
  if (contentTypes && contentTypes.length > 0) {
    return results.filter((r) => contentTypes.includes(r.contentType));
  }

  return results;
}

// ---------------------------------------------------------------------------
// searchConcepts
// ---------------------------------------------------------------------------

interface SearchConceptsInput {
  query: string;
  conceptType?: string;
  limit: number;
}

interface SearchConceptResult {
  id: string;
  name: string;
  type: string;
  description: string | null;
  mentionCount: number;
}

export async function handleSearchConcepts(
  input: SearchConceptsInput,
  ctx: McpToolContext
): Promise<SearchConceptResult[]> {
  const { query, conceptType, limit } = input;

  // Build query with description included
  let dbQuery = supabaseAdmin
    .from('knowledge_concepts')
    .select('id, name, normalized_name, concept_type, mention_count, description')
    .eq('org_id', ctx.orgId)
    .gte('mention_count', 1)
    .order('mention_count', { ascending: false })
    .limit(limit * 3); // Fetch extra for scoring

  if (conceptType) {
    dbQuery = dbQuery.eq('concept_type', conceptType);
  }

  const { data: concepts, error } = await dbQuery;

  if (error) {
    throw new McpToolError('internal_error', `Database error: ${error.message}`);
  }

  if (!concepts || concepts.length === 0) {
    return [];
  }

  // Score concepts by name match (same logic as concept-search.ts)
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return [];
  }

  const scored = concepts
    .map((c) => {
      const conceptName = c.name.toLowerCase();
      let score = 0;

      if (conceptName === normalizedQuery) {
        score = 1.0;
      } else if (normalizedQuery.includes(conceptName)) {
        score = 0.9;
      } else if (conceptName.includes(normalizedQuery)) {
        score = 0.8;
      } else {
        const conceptWords = conceptName.split(/[\s_-]+/);
        const matching = queryWords.filter((qw: string) =>
          conceptWords.some((cw: string) => cw.includes(qw) || qw.includes(cw))
        );
        if (matching.length > 0) {
          score =
            0.5 +
            (matching.length / Math.max(queryWords.length, conceptWords.length)) * 0.3;
        }
      }

      return { concept: c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ concept }) => ({
    id: concept.id,
    name: concept.name,
    type: concept.concept_type,
    description: concept.description ?? null,
    mentionCount: concept.mention_count,
  }));
}

// ---------------------------------------------------------------------------
// exploreKnowledgeGraph
// ---------------------------------------------------------------------------

interface ExploreKnowledgeGraphInput {
  conceptId: string;
  depth: number;
}

interface ConceptNode {
  id: string;
  name: string;
  type: string;
  description: string | null;
  mentionCount: number;
}

interface RelatedConceptEdge {
  concept: ConceptNode;
  relationship: string;
  strength: number;
}

interface ExploreKnowledgeGraphResult {
  concept: ConceptNode;
  relatedConcepts: RelatedConceptEdge[];
}

export async function handleExploreKnowledgeGraph(
  input: ExploreKnowledgeGraphInput,
  ctx: McpToolContext
): Promise<ExploreKnowledgeGraphResult> {
  const { conceptId, depth } = input;

  // Fetch the root concept, scoped by org_id
  const { data: rootConcept, error: rootError } = await supabaseAdmin
    .from('knowledge_concepts')
    .select('id, name, concept_type, mention_count, description')
    .eq('id', conceptId)
    .eq('org_id', ctx.orgId)
    .single();

  if (rootError || !rootConcept) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }

  const concept: ConceptNode = {
    id: rootConcept.id,
    name: rootConcept.name,
    type: rootConcept.concept_type,
    description: rootConcept.description ?? null,
    mentionCount: rootConcept.mention_count,
  };

  // Traverse relationships up to the requested depth using BFS
  const visited = new Set<string>([conceptId]);
  let frontier = [conceptId];
  const allEdges: RelatedConceptEdge[] = [];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const { data: relationships } = await supabaseAdmin
      .from('concept_relationships')
      .select(
        `
        relationship_type,
        strength,
        related:related_concept_id(id, name, concept_type, mention_count, description, org_id)
      `
      )
      .in('concept_id', frontier)
      .order('strength', { ascending: false });

    const nextFrontier: string[] = [];

    for (const rel of relationships ?? []) {
      // Supabase returns the joined row as a nested object
      const related = rel.related as unknown as RelatedConceptJoinRow | null;
      if (!related?.id || related.org_id !== ctx.orgId) continue;
      if (visited.has(related.id)) continue;

      visited.add(related.id);
      nextFrontier.push(related.id);

      allEdges.push({
        concept: {
          id: related.id,
          name: related.name,
          type: related.concept_type,
          description: related.description ?? null,
          mentionCount: related.mention_count,
        },
        relationship: rel.relationship_type,
        strength: Math.round(rel.strength * 100) / 100,
      });
    }

    frontier = nextFrontier;
  }

  return { concept, relatedConcepts: allEdges };
}

// ---------------------------------------------------------------------------
// getDocument
// ---------------------------------------------------------------------------

interface GetDocumentInput {
  contentId: string;
}

interface GetDocumentResult {
  id: string;
  title: string;
  content: string;
  format: string;
  createdAt: string;
}

export async function handleGetDocument(
  input: GetDocumentInput,
  ctx: McpToolContext
): Promise<GetDocumentResult> {
  const { contentId } = input;

  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select(
      `
      id,
      markdown,
      html,
      created_at,
      content!inner (
        id,
        title,
        org_id
      )
    `
    )
    .eq('content_id', contentId)
    .single();

  if (error || !doc) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }

  // Verify org access via the joined content row
  const joined = (Array.isArray(doc.content) ? doc.content[0] : doc.content) as unknown as ContentJoinRow;
  if (joined?.org_id !== ctx.orgId) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }

  // Determine format based on available content
  const format = doc.markdown ? 'markdown' : doc.html ? 'html' : 'markdown';
  const body = doc.markdown || doc.html || '';

  return {
    id: doc.id,
    title: joined?.title ?? 'Untitled',
    content: body,
    format,
    createdAt: doc.created_at,
  };
}

// ---------------------------------------------------------------------------
// getTranscript
// ---------------------------------------------------------------------------

interface GetTranscriptInput {
  contentId: string;
}

interface GetTranscriptResult {
  id: string;
  text: string;
  language: string;
  duration: number | null;
}

export async function handleGetTranscript(
  input: GetTranscriptInput,
  ctx: McpToolContext
): Promise<GetTranscriptResult> {
  const { contentId } = input;

  const { data: transcript, error } = await supabaseAdmin
    .from('transcripts')
    .select(
      `
      id,
      text,
      language,
      content!inner (
        id,
        org_id,
        duration_sec
      )
    `
    )
    .eq('content_id', contentId)
    .single();

  if (error || !transcript) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }

  // Verify org access via the joined content row
  const joined = (Array.isArray(transcript.content)
    ? transcript.content[0]
    : transcript.content) as unknown as ContentJoinRow;
  if (joined?.org_id !== ctx.orgId) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }

  return {
    id: transcript.id,
    text: transcript.text,
    language: transcript.language ?? 'en',
    duration: joined?.duration_sec ?? null,
  };
}
