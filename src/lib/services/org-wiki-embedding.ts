/**
 * Org wiki embedding service — TRIB-36.
 *
 * Generates and queries vector embeddings for org_wiki_pages so the
 * fusion engine (TRIB-35) can rank pages by relevance to a user question.
 *
 * See product-architecture-v2.md Part 3 Component 3 Fusion Logic (line 427):
 * "a lightweight vector similarity check may still be useful — not for
 * RAG-style chunk retrieval, but for matching a question to the right
 * wiki page out of potentially hundreds. The key difference: we're
 * matching to *pages* (pre-compiled knowledge), not *chunks* (raw fragments)."
 *
 * Consumers:
 * - TRIB-31 `compile_wiki` worker dynamically imports
 *   `generateOrgWikiPageEmbedding` inside a try/catch after upserting a
 *   wiki page, so the two features can ship independently.
 * - TRIB-35 `/api/extension/query` route uses `resolveOrgWikiPagesByVector`
 *   to pick the top-N most relevant active org wiki pages for a user
 *   question via cosine distance.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'org-wiki-embedding' });

/**
 * Maximum characters of `content` we include in the embedding input.
 * Embeddings are meant to match question → page topic, not to replace
 * full-text retrieval. 500 chars captures the opening paragraph which
 * typically contains the topic framing and key identifiers without
 * diluting the vector with downstream detail.
 */
const EMBEDDING_INPUT_MAX_CHARS = 500;

/**
 * Default number of org wiki pages returned by vector resolution.
 * Aligns with PRD Part 3 Component 3 fusion logic: pick the top-N
 * relevant pages, not a large RAG-style recall set.
 */
const DEFAULT_MATCH_LIMIT = 3;

/**
 * Generate an embedding for an org_wiki_pages row and write it back.
 *
 * Reads `topic` + first 500 chars of `content` from the row, computes
 * an embedding via the project's Google embedding provider (with OpenAI
 * fallback) as a `RETRIEVAL_DOCUMENT` task, and UPDATEs the row.
 *
 * Idempotent — safe to call multiple times for the same page; later
 * calls overwrite the previous embedding. This matters for
 * `compile_wiki` which may re-run on the same page when sources change.
 *
 * Throws on failure so callers (notably the TRIB-31 compile_wiki worker)
 * can decide whether to fail-open (log + continue) or fail-closed.
 */
export async function generateOrgWikiPageEmbedding(pageId: string): Promise<void> {
  const supabase = createAdminClient();

  // Supabase JS client's current types over-resolve to `never` for
  // several tables in this project (see job-processor.ts, agent-memory.ts
  // for the same pattern). Cast the select result to the narrow row
  // shape we actually need. Build passes with ignoreBuildErrors=true
  // already; this cast keeps the local file type-safe.
  const { data, error: fetchError } = await supabase
    .from('org_wiki_pages')
    .select('id, topic, content')
    .eq('id', pageId)
    .single();

  const page = data as { id: string; topic: string; content: string } | null;

  if (fetchError || !page) {
    const message = `Failed to fetch org_wiki_pages row ${pageId}: ${fetchError?.message ?? 'not found'}`;
    logger.error('generateOrgWikiPageEmbedding fetch failed', {
      context: { pageId },
      error: fetchError ?? undefined,
    });
    throw new Error(message);
  }

  const contentExcerpt = (page.content ?? '').slice(0, EMBEDDING_INPUT_MAX_CHARS);
  const input = `${page.topic}\n\n${contentExcerpt}`.trim();

  if (!input) {
    // Empty input would make the Google embeddings API error out; treat
    // this as a logged no-op so compile_wiki doesn't fail the whole job
    // over a malformed page.
    logger.warn('Skipping embedding generation for empty page', {
      context: { pageId },
    });
    return;
  }

  const { embedding, provider } = await generateEmbeddingWithFallback(
    input,
    'RETRIEVAL_DOCUMENT'
  );

  // Supabase's pgvector integration accepts JSON array strings for
  // vector columns via the JS client — matches the pattern in
  // embeddings-google.ts line 555 and agent-memory.ts line 49.
  // Cast avoids the project-wide `never` type inference on .update().
  const { error: updateError } = await supabase
    .from('org_wiki_pages')
    .update({ embedding: JSON.stringify(embedding) } as never)
    .eq('id', pageId);

  if (updateError) {
    logger.error('Failed to persist org wiki page embedding', {
      context: { pageId, provider },
      error: updateError,
    });
    throw new Error(
      `Failed to persist embedding for org_wiki_pages ${pageId}: ${updateError.message}`
    );
  }

  logger.info('Generated org wiki page embedding', {
    context: {
      pageId,
      provider,
      inputChars: input.length,
      dimensions: embedding.length,
    },
  });
}

export interface ResolveOrgWikiPagesByVectorArgs {
  orgId: string;
  questionEmbedding: number[];
  limit?: number;
}

export interface ResolvedOrgWikiPage {
  id: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  confidence: number;
  distance: number;
}

/**
 * Return currently-active org wiki pages ranked by cosine distance to
 * the query embedding. Used by the fusion engine in TRIB-35.
 *
 * Only pages where `valid_until IS NULL` (currently-active) and
 * `embedding IS NOT NULL` (already processed by compile_wiki) are
 * considered. Results are ordered by ascending distance — lower is
 * more similar.
 *
 * Implementation: delegates to the `match_org_wiki_pages` Postgres
 * function registered via migration `trib_36_match_org_wiki_pages_fn`.
 * Doing this in SQL (vs. a raw parameterized query) keeps the JS client
 * type-safe and matches the pattern used by `match_chunks`.
 */
export async function resolveOrgWikiPagesByVector(
  args: ResolveOrgWikiPagesByVectorArgs
): Promise<ResolvedOrgWikiPage[]> {
  const { orgId, questionEmbedding, limit = DEFAULT_MATCH_LIMIT } = args;

  if (!questionEmbedding || questionEmbedding.length === 0) {
    logger.warn('resolveOrgWikiPagesByVector called with empty embedding', {
      context: { orgId },
    });
    return [];
  }

  const supabase = createAdminClient();

  // Supabase's JS client accepts a number[] for `vector` parameters via
  // rpc and converts it to the pgvector wire format. This mirrors how
  // hierarchical-search.ts and agent-memory.ts pass embeddings to their
  // respective match_* functions.
  const { data, error } = await supabase.rpc('match_org_wiki_pages' as never, {
    query_embedding: questionEmbedding as unknown as string,
    match_org_id: orgId,
    match_limit: limit,
  } as never);

  if (error) {
    logger.error('match_org_wiki_pages RPC failed', {
      context: { orgId, limit },
      error,
    });
    throw new Error(`Failed to resolve org wiki pages by vector: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    org_id: string;
    app: string | null;
    screen: string | null;
    topic: string;
    content: string;
    confidence: number;
    distance: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    app: row.app,
    screen: row.screen,
    topic: row.topic,
    content: row.content,
    confidence: row.confidence,
    distance: row.distance,
  }));
}
