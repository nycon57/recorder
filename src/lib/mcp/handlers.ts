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
import {
  buildCompiledMemoryCitations,
  resolveCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability,
  type CompiledMemoryAnswerObservability,
} from '@/lib/services/compiled-memory-answer-context';
import { generateCompiledMemoryGroundedAnswer } from '@/lib/services/compiled-memory-answer';
import {
  getOrgWikiPage,
  getVendorWikiPage,
  searchCompiledOrgWikiPages,
  searchVendorWikiPages,
} from '@/lib/services/wiki-search';

/** Org context passed to every handler. */
export interface McpToolContext {
  orgId: string;
  userId?: string;
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
  mention_count: number | null;
  description: string | null;
  org_id: string;
}

interface DocumentJoinResultRow {
  id: string;
  markdown: string | null;
  html: string | null;
  created_at: string;
  content: ContentJoinRow | ContentJoinRow[] | null;
}

interface TranscriptJoinResultRow {
  id: string;
  text: string;
  language: string | null;
  content: ContentJoinRow | ContentJoinRow[] | null;
}

/** Unwrap a Supabase `.single()` result, throwing McpToolError on failure. */
function unwrapSingleRow<T>(
  data: T | null,
  error: { code: string; message: string } | null
): T {
  if (error) {
    if (error.code === 'PGRST116') {
      throw new McpToolError('not_found', 'Content not found or not accessible');
    }
    throw new McpToolError('internal_error', `Database error: ${error.message}`);
  }
  if (!data) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }
  return data;
}

/** Extract the joined content row and verify org ownership. */
function verifyOrgAccess(joinedContent: unknown, orgId: string): ContentJoinRow {
  const joined = (
    Array.isArray(joinedContent) ? joinedContent[0] : joinedContent
  ) as ContentJoinRow;
  if (joined?.org_id !== orgId) {
    throw new McpToolError('not_found', 'Content not found or not accessible');
  }
  return joined;
}

// ---------------------------------------------------------------------------
// answerQuestion
// ---------------------------------------------------------------------------

interface AnswerQuestionInput {
  question: string;
  app?: string;
  screen?: string;
  limit?: number;
}

interface AnswerQuestionResult {
  answer: string;
  answerContext: string;
  citations: ReturnType<typeof buildCompiledMemoryCitations>;
  priorTopics: string[];
  observability: CompiledMemoryAnswerObservability;
}

export async function handleAnswerQuestion(
  input: AnswerQuestionInput,
  ctx: McpToolContext
): Promise<AnswerQuestionResult> {
  const compiledMemory = await resolveCompiledMemoryAnswerContext({
    orgId: ctx.orgId,
    userId: ctx.userId,
    question: input.question,
    app: input.app,
    screen: input.screen,
    limit: input.limit,
  });

  const answer = await generateCompiledMemoryGroundedAnswer({
    question: input.question,
    answerContext: compiledMemory,
  });

  return {
    answer,
    answerContext: compiledMemory.context,
    citations: buildCompiledMemoryCitations(compiledMemory.sources),
    priorTopics: compiledMemory.priorTopics,
    observability: summarizeCompiledMemoryAnswerObservability(compiledMemory),
  };
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
  const { query, limit } = input;
  const pages = await searchCompiledOrgWikiPages({
    orgId: ctx.orgId,
    query,
    limit,
  });

  if (pages.length === 0) {
    return [];
  }

  return pages.map((page) => ({
    id: page.id,
    title: page.title,
    contentType: 'compiled_wiki',
    snippet: page.snippet,
    similarity: Math.round(page.similarity * 100) / 100,
    createdAt: page.updatedAt,
  }));
}

// ---------------------------------------------------------------------------
// searchKnowledge
// ---------------------------------------------------------------------------

interface SearchKnowledgeInput {
  query: string;
  limit: number;
  app?: string;
  screen?: string;
  contentTypes?: string[];
}

type SearchKnowledgeResult =
  | Awaited<ReturnType<typeof searchCompiledOrgWikiPages>>[number]
  | Awaited<ReturnType<typeof searchVendorWikiPages>>[number];

export async function handleSearchKnowledge(
  input: SearchKnowledgeInput,
  ctx: McpToolContext
): Promise<SearchKnowledgeResult[]> {
  const limit = Math.max(1, Math.min(20, input.limit ?? 5));
  const [orgWiki, vendorWiki] = await Promise.all([
    searchCompiledOrgWikiPages({
      orgId: ctx.orgId,
      query: input.query,
      limit,
    }),
    searchVendorWikiPages({
      query: input.query,
      limit,
      app: input.app,
      screen: input.screen,
    }),
  ]);

  return [
    ...orgWiki.sort((left, right) => right.similarity - left.similarity),
    ...vendorWiki.sort((left, right) => right.similarity - left.similarity),
  ].slice(0, limit);
}

// ---------------------------------------------------------------------------
// getWikiPage
// ---------------------------------------------------------------------------

interface GetWikiPageInput {
  source: 'org_wiki' | 'vendor_wiki';
  pageId: string;
}

export async function handleGetWikiPage(
  input: GetWikiPageInput,
  ctx: McpToolContext
): Promise<Awaited<ReturnType<typeof getOrgWikiPage>>> {
  const page =
    input.source === 'org_wiki'
      ? await getOrgWikiPage({ orgId: ctx.orgId, pageId: input.pageId })
      : await getVendorWikiPage({ pageId: input.pageId });

  if (!page) {
    throw new McpToolError('not_found', 'Wiki page not found or not accessible');
  }

  return page;
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
    mentionCount: concept.mention_count ?? 0,
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

  const clampedDepth = Math.max(1, Math.min(3, depth));

  // Fetch the root concept, scoped by org_id
  const { data, error } = await supabaseAdmin
    .from('knowledge_concepts')
    .select('id, name, concept_type, mention_count, description')
    .eq('id', conceptId)
    .eq('org_id', ctx.orgId)
    .single();

  const rootConcept = unwrapSingleRow(data, error);

  const concept: ConceptNode = {
    id: rootConcept.id,
    name: rootConcept.name,
    type: rootConcept.concept_type,
    description: rootConcept.description ?? null,
    mentionCount: rootConcept.mention_count ?? 0,
  };

  // Traverse relationships up to the requested depth using BFS
  const visited = new Set<string>([conceptId]);
  let frontier = [conceptId];
  const allEdges: RelatedConceptEdge[] = [];

  for (let d = 0; d < clampedDepth && frontier.length > 0; d++) {
    const { data: relationships, error: relError } = await supabaseAdmin
      .from('concept_relationships')
      .select(
        `
        relationship_type,
        strength,
        related:related_concept_id(id, name, concept_type, mention_count, description, org_id)
      `
      )
      .in('concept_id', frontier)
      .eq('org_id', ctx.orgId)
      .order('strength', { ascending: false });

    if (relError) {
      throw new McpToolError('internal_error', `Failed fetching concept_relationships: ${relError.message}`);
    }

    const nextFrontier: string[] = [];

    const relationshipRows = (relationships ?? []) as unknown as Array<{
      relationship_type: string;
      strength: number | null;
      related: RelatedConceptJoinRow | RelatedConceptJoinRow[] | null;
    }>;

    for (const rel of relationshipRows) {
      // Supabase returns the joined row as a nested object
      const related = (
        Array.isArray(rel.related) ? rel.related[0] : rel.related
      ) as RelatedConceptJoinRow | null;
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
          mentionCount: related.mention_count ?? 0,
        },
        relationship: rel.relationship_type,
        strength: Math.round((rel.strength ?? 0) * 100) / 100,
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

  const { data, error } = await supabaseAdmin
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

  const doc = unwrapSingleRow<DocumentJoinResultRow>(
    data as DocumentJoinResultRow | null,
    error,
  );
  const joined = verifyOrgAccess(doc.content, ctx.orgId);

  const format = doc.markdown ? 'markdown' : 'html';
  const body = doc.markdown || doc.html || '';

  return {
    id: doc.id,
    title: joined.title ?? 'Untitled',
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

  const { data, error } = await supabaseAdmin
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

  const transcript = unwrapSingleRow<TranscriptJoinResultRow>(
    data as TranscriptJoinResultRow | null,
    error,
  );
  const joined = verifyOrgAccess(transcript.content, ctx.orgId);

  return {
    id: transcript.id,
    text: transcript.text,
    language: transcript.language ?? 'en',
    duration: joined.duration_sec ?? null,
  };
}
