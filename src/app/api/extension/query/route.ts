/**
 * POST /api/extension/query
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Accepts:
 *   {
 *     question: string;
 *     context: PageContext;       // { url, appSignature, elements? }
 *     conversationId?: string;
 *     orgId?: string;             // ignored — resolved from session
 *   }
 *
 * Query parameters:
 *   ?as_of=<ISO 8601 timestamp>   // TRIB-40: optional point-in-time
 *                                 //   knowledge retrieval. When provided,
 *                                 //   the fusion engine pulls the org wiki
 *                                 //   state as of that instant instead of
 *                                 //   the currently-active set.
 *
 * Returns an SSE stream with event types:
 *   text_chunk  — { text: string }
 *   element_ref — { selector: string, label: string, action: "highlight" | "point" | "pulse" }
 *   citation    — { sourceId: string, title: string, recordingUrl?: string }
 *   done        — {}
 *
 * TRIB-35/TRIB-54: Three-layer fusion.
 *
 * Flow:
 *   1. requireOrg() — fail fast before touching the stream.
 *   2. Resolve {app, screen} from appSignature.
 *   3. Layer 1: resolveVendorWikiPage({ app, screen }) — generic vendor docs.
 *   4. Embed the user question via generateEmbeddingWithFallback (RETRIEVAL_QUERY).
 *   5. Layer 2 (TRIB-54): If the org has a vendor_org_id, resolve the VENDOR
 *              ORG's wiki pages by vector — vendor training docs. Respects
 *              knowledge_scope from white_label_configs.
 *   6. Layer 3: resolveOrgWikiPagesByVector({ orgId, questionEmbedding, limit: 3 })
 *              — top-3 currently-active customer org wiki pages by cosine similarity.
 *   7. If all layers are empty → graceful "no documentation" fallback + done.
 *   8. Build the fusion prompt with three sections: VENDOR KNOWLEDGE,
 *      VENDOR TRAINING, YOUR TEAM'S KNOWLEDGE. Precedence: customer > vendor
 *      training > generic vendor docs.
 *   8. Call ai.models.generateContentStream(...) with temperature 0.4 and
 *      maxOutputTokens 2048 for a snappy conversational response.
 *   9. Each streamed chunk goes through a TagStreamParser state machine which:
 *        - Buffers tokens
 *        - Emits plain text as `text_chunk` events (word-chunked ~120 chars)
 *        - Parses complete `[ELEMENT:selector:label]` tags into `element_ref`
 *        - Parses complete `[SOURCE:id:title]` tags into `citation`
 *        - Holds partial tag prefixes across chunk boundaries
 *        - Passes malformed tags through as plain text
 *  10. On stream end or error, emit a terminal `done` event and close.
 *
 * Runtime: nodejs (NOT edge) — Vercel Fluid Compute supports long-running
 * SSE streams on Node. Preserve the existing SSE headers.
 */

import { NextRequest, after } from 'next/server';
import { GoogleGenAI } from '@google/genai';

import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { resolveVendorWikiPage } from '@/lib/services/vendor-wiki-resolver';
import { resolveOrgWikiPagesByVector } from '@/lib/services/org-wiki-embedding';
import type { ResolvedOrgWikiPage } from '@/lib/services/org-wiki-embedding';
import { resolveClusterContext } from '@/lib/services/wiki-clusters';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import { getVendorForOrg } from '@/lib/services/vendor-customers';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Preflight handler for SDK cross-origin requests
export function OPTIONS() {
  return corsPreflightResponse();
}

/** SSE event shapes */
interface TextChunkEvent {
  type: 'text_chunk';
  text: string;
}

interface ElementRefEvent {
  type: 'element_ref';
  selector: string;
  label: string;
  action: 'highlight' | 'point' | 'pulse';
}

interface CitationEvent {
  type: 'citation';
  sourceId: string;
  title: string;
  recordingUrl?: string;
}

interface DoneEvent {
  type: 'done';
}

type SseEvent = TextChunkEvent | ElementRefEvent | CitationEvent | DoneEvent;

/** Encode a single SSE event to bytes. */
function encodeEvent(encoder: TextEncoder, data: SseEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Split content into chunks of ~chunkSize characters, respecting word
 * boundaries so the extension TTS doesn't cut mid-word.
 */
function chunkText(text: string, chunkSize = 120): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > chunkSize && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current = current.length > 0 ? `${current} ${word}` : word;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/** PageContext passed by the extension */
interface PageContext {
  url: string;
  appSignature: string;
  elements?: Array<{ selector: string; label: string }>;
}

/** Lazy Gemini client — no import-time env var reads (Fluid Compute safe). */
let _genaiClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI {
  if (!_genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    _genaiClient = new GoogleGenAI({ apiKey });
  }
  return _genaiClient;
}

// -------------------- Fusion prompt --------------------

const ORG_SEPARATOR = '\n\n---\n\n';
const MAX_CONTENT_CHARS_PER_PAGE = 3000;

/**
 * Build the PRD Part 3 Component 3 fusion prompt. Sections are kept in the
 * order specified by product-architecture-v2.md line 435+:
 *   VENDOR KNOWLEDGE → ORG KNOWLEDGE → INTERACTIVE ELEMENTS → QUESTION.
 *
 * Rules block is inlined verbatim (paraphrased slightly for clarity) and
 * enforces: org precedence, `[ELEMENT:selector:label]` tagging,
 * `[SOURCE:id:title]` citations, org sources first.
 */
function buildFusionPrompt(args: {
  app: string;
  screen: string;
  question: string;
  vendorMarkdown: string | null;
  vendorTrainingPages: ResolvedOrgWikiPage[];
  orgPages: ResolvedOrgWikiPage[];
  elements: Array<{ selector: string; label: string }>;
  userMemoryTopics?: string[];
}): string {
  const {
    app,
    screen,
    question,
    vendorMarkdown,
    vendorTrainingPages,
    orgPages,
    elements,
    userMemoryTopics,
  } = args;

  const vendorSection = vendorMarkdown
    ? vendorMarkdown.slice(0, MAX_CONTENT_CHARS_PER_PAGE)
    : '(no vendor documentation available for this screen)';

  // TRIB-54: Vendor training layer — wiki pages from the vendor org
  const vendorTrainingSection =
    vendorTrainingPages.length > 0
      ? vendorTrainingPages
          .map((page) => {
            const header = `### ${page.topic} [SOURCE:${page.id}:${page.topic}]`;
            const body = (page.content ?? '').slice(0, MAX_CONTENT_CHARS_PER_PAGE);
            return `${header}\n${body}`;
          })
          .join(ORG_SEPARATOR)
      : '(no vendor training knowledge available)';

  const orgSection =
    orgPages.length > 0
      ? orgPages
          .map((page) => {
            const header = `### ${page.topic} [SOURCE:${page.id}:${page.topic}]`;
            const body = (page.content ?? '').slice(0, MAX_CONTENT_CHARS_PER_PAGE);
            return `${header}\n${body}`;
          })
          .join(ORG_SEPARATOR)
      : '(no team-specific knowledge available)';

  const elementsSection =
    elements.length > 0
      ? elements.map((el) => `- ${el.label}: ${el.selector}`).join('\n')
      : '(no interactive elements provided)';

  // TRIB-50: If user has prior interactions with some of these pages,
  // inject a USER CONTEXT section so the LLM can skip basic explanations.
  const userContextSection =
    userMemoryTopics && userMemoryTopics.length > 0
      ? `\nUSER CONTEXT:
The user has previously been shown information about: ${userMemoryTopics.join(', ')}. Skip basic explanations they've already seen and focus on their specific question. If they ask about a topic they've seen before, go deeper rather than repeating fundamentals.\n`
      : '';

  return `You are a context-aware assistant helping someone use ${app}'s ${screen} page.

VENDOR KNOWLEDGE (generic software documentation):
${vendorSection}

VENDOR TRAINING (how the vendor recommends using it):
${vendorTrainingSection}

YOUR TEAM'S KNOWLEDGE (how your team specifically uses it):
${orgSection}

INTERACTIVE ELEMENTS VISIBLE ON SCREEN:
${elementsSection}
${userContextSection}
QUESTION: ${question}

Rules:
- YOUR TEAM'S KNOWLEDGE takes highest precedence, followed by VENDOR TRAINING, then VENDOR KNOWLEDGE. Explicitly mention when you're following the team's specific way versus vendor recommendations.
- When referring to a clickable element that exists in INTERACTIVE ELEMENTS, tag it like [ELEMENT:selector:label] so the extension can highlight/point at it. Use the selector exactly as provided above.
- When citing a source, tag it [SOURCE:id:title]. Use the page id for team/vendor-training citations and the vendor page id for vendor citations. Team sources should come first in the citation list, followed by vendor training sources.
- Keep the answer concise and conversational. Prioritize actionable steps a user can follow right now.
- If you don't know the answer from any layer, say so clearly instead of guessing.`;
}

// -------------------- Tag-parsing state machine --------------------

/**
 * Parses a streamed LLM response containing inline `[ELEMENT:selector:label]`
 * and `[SOURCE:id:title]` tags. Designed to handle:
 *
 *   (a) Tags at the start, middle, or end of a chunk.
 *   (b) Tags split across multiple chunks
 *       (e.g. "[ELEM" arrives in chunk 1, "ENT:a.btn:Click]" in chunk 2).
 *   (c) Malformed tags ("[ELEMENT: no closing]" or "[FOO:bar:baz]")
 *       are flushed as plain text after we confirm they can't be a tag.
 *   (d) Plain text interleaved with tags.
 *
 * Strategy:
 *   - Hold a running `buffer` of unflushed text.
 *   - On each `push(chunk)`, append the chunk and scan:
 *       1. Find the earliest `[` in the buffer.
 *       2. If no `[`: everything is plain text → flush and return.
 *       3. Flush everything BEFORE the `[` as plain text.
 *       4. Starting at `[`, check for a complete tag regex match.
 *          - If match: emit the typed event, advance past the match, loop.
 *       5. Otherwise, check if the remaining buffer starts with a prefix of
 *          either "[ELEMENT:" or "[SOURCE:". If so, hold the buffer (it
 *          might be a tag in progress) and return.
 *       6. Otherwise, this `[` is not the start of a tag. Flush it as plain
 *          text and keep scanning.
 *   - On `flush()`, emit whatever's left in the buffer as plain text.
 *
 * Text emission is word-chunked via `chunkText(~120 chars)` so the extension
 * TTS doesn't cut mid-word.
 *
 * Test scenarios (conceptual — see PR body for fuller notes):
 *
 *   Scenario 1: plain text
 *     push("Click the button.") → text_chunk "Click the button."
 *
 *   Scenario 2: tag at end of chunk
 *     push("Open the menu ") → text_chunk "Open the menu"
 *     push("[ELEMENT:.menu:Menu]") → element_ref {.menu, Menu, highlight}
 *
 *   Scenario 3: tag split across chunks
 *     push("Click [ELEM") → text_chunk "Click" (buffer holds "[ELEM")
 *     push("ENT:.btn:Save]") → element_ref {.btn, Save, highlight}
 *
 *   Scenario 4: malformed tag passes through
 *     push("[FOO:bar:baz] done") → text_chunk "[FOO:bar:baz] done"
 *
 *   Scenario 5: multiple tags in one chunk
 *     push("See [SOURCE:abc:Guide] and click [ELEMENT:.ok:OK]")
 *       → text_chunk "See", citation {abc, Guide}, text_chunk "and click",
 *         element_ref {.ok, OK, highlight}
 */
class TagStreamParser {
  private buffer = '';

  // Case-insensitive so the LLM lowercasing a tag doesn't break us.
  // Matches [ELEMENT:x:y] or [SOURCE:x:y] where:
  //   - arg1 (selector/id) has no `:` or `]`
  //   - arg2 (label/title) has no `]`
  // This handles typical UUIDs, class selectors, id selectors, and attribute
  // selectors. CSS pseudo-classes like `a:hover` are NOT supported in the
  // first argument — the fusion prompt tells the LLM to use the exact
  // selector from INTERACTIVE ELEMENTS which the extension's context engine
  // emits as attribute selectors.
  private static readonly TAG_REGEX =
    /\[(ELEMENT|SOURCE):([^:\]]+):([^\]]*)\]/i;

  // Valid prefixes of a tag opener. If the buffer ends with any of these,
  // we hold the buffer as a potential tag-in-progress instead of flushing.
  private static readonly TAG_OPENER_PREFIXES = [
    '[',
    '[E',
    '[EL',
    '[ELE',
    '[ELEM',
    '[ELEME',
    '[ELEMEN',
    '[ELEMENT',
    '[ELEMENT:',
    '[S',
    '[SO',
    '[SOU',
    '[SOUR',
    '[SOURC',
    '[SOURCE',
    '[SOURCE:',
  ];

  constructor(
    private readonly onText: (text: string) => void,
    private readonly onElement: (el: {
      selector: string;
      label: string;
    }) => void,
    private readonly onCitation: (cite: {
      sourceId: string;
      title: string;
    }) => void
  ) {}

  push(chunk: string): void {
    if (!chunk) return;
    this.buffer += chunk;
    this.drain();
  }

  /**
   * Drain as much of the buffer as possible into text/element/citation
   * events. On return, the buffer either is empty or holds a partial tag
   * prefix awaiting the next chunk.
   */
  private drain(): void {
    // Loop until we can't make progress (either buffer is empty or holds
    // only a potential tag prefix).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const bracketIdx = this.buffer.indexOf('[');

      // No bracket — all of buffer is safe plain text.
      if (bracketIdx === -1) {
        if (this.buffer.length > 0) {
          this.emitText(this.buffer);
          this.buffer = '';
        }
        return;
      }

      // Flush any plain text BEFORE the bracket first.
      if (bracketIdx > 0) {
        this.emitText(this.buffer.slice(0, bracketIdx));
        this.buffer = this.buffer.slice(bracketIdx);
      }

      // Buffer now starts with `[`. Try to match a complete tag.
      const match = this.buffer.match(TagStreamParser.TAG_REGEX);
      if (match && match.index === 0) {
        // Complete tag at buffer start — emit the typed event.
        const tagKind = match[1].toUpperCase();
        const arg1 = match[2];
        const arg2 = match[3];

        if (tagKind === 'ELEMENT') {
          this.onElement({ selector: arg1, label: arg2 });
        } else if (tagKind === 'SOURCE') {
          this.onCitation({ sourceId: arg1, title: arg2 });
        }

        this.buffer = this.buffer.slice(match[0].length);
        continue;
      }

      // No complete tag at buffer start. Decide: is this a potential
      // tag in progress (hold), or just a literal `[` (pass through)?
      if (this.looksLikePendingTag()) {
        return; // hold buffer, wait for more
      }

      // Not a pending tag — this `[` is literal. Emit it as text and
      // advance past it so we can keep scanning for the next `[`.
      this.emitText('[');
      this.buffer = this.buffer.slice(1);
    }
  }

  /**
   * Returns true if the current buffer could plausibly become a valid
   * `[ELEMENT:...]` or `[SOURCE:...]` tag once more chunks arrive.
   *
   * Two cases count as "pending":
   *   1. The entire buffer is a valid tag-opener prefix
   *      (e.g. "[ELEM", "[SOURCE:").
   *   2. The buffer starts with `[ELEMENT:` or `[SOURCE:` but the closing
   *      `]` hasn't arrived yet (so the tag is in progress).
   */
  private looksLikePendingTag(): boolean {
    // Case 1: full buffer IS a tag-opener prefix. Cap the check at 9 chars
    // so "[ELEMENT:" is the longest we match — anything longer falls into
    // case 2 (already committed to being a tag).
    const shortBuffer = this.buffer.slice(0, 9);
    if (TagStreamParser.TAG_OPENER_PREFIXES.includes(shortBuffer.toUpperCase())) {
      return true;
    }

    // Case 2: buffer has the full tag prefix but no closing `]` yet.
    const upper = this.buffer.toUpperCase();
    if (upper.startsWith('[ELEMENT:') || upper.startsWith('[SOURCE:')) {
      // If there's no `]` anywhere in the buffer, we're still waiting.
      // If there IS a `]` but the regex didn't match, the tag is malformed
      // (e.g. missing the second `:`) — fall through to literal-text mode.
      if (!this.buffer.includes(']')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Flush any remaining buffered text as plain text chunks. Called once
   * when the LLM stream completes to make sure partial-tag buffers and
   * trailing prose don't get dropped.
   */
  flush(): void {
    if (this.buffer.length > 0) {
      this.emitText(this.buffer);
      this.buffer = '';
    }
  }

  private emitText(text: string): void {
    if (!text) return;
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      this.onText(chunk);
    }
  }
}

// -------------------- Citation enrichment --------------------

/**
 * Given a set of org page ids that were cited, look up their first
 * contributing recording source so the extension can deep-link the user
 * to the recording on the hub. Best-effort: failures are swallowed and
 * the citation is emitted without a recordingUrl.
 *
 * NOTE: This is an in-memory cache keyed by page id. We resolve lazily,
 * only when the LLM actually cites a page, so we don't do DB work for
 * unused pages.
 */
async function resolveRecordingUrlForPage(
  pageId: string
): Promise<string | undefined> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('wiki_page_sources')
      .select('source_id, source_type')
      .eq('page_id', pageId)
      .eq('source_type', 'recording')
      .order('contributed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const row = data as { source_id: string; source_type: string } | null;
    if (!row?.source_id) return undefined;

    return `/dashboard/recordings/${row.source_id}`;
  } catch {
    return undefined;
  }
}

// -------------------- Route handler --------------------

export async function POST(request: NextRequest) {
  // Auth check before touching the stream so unauthorized clients
  // get a plain 401 rather than a half-opened SSE connection.
  // TRIB-56: Accept API key auth (Bearer sk_live_...) alongside session auth.
  let orgId: string;
  let userId: string;
  let authCtx: Awaited<ReturnType<typeof requireApiKeyOrSession>>;
  try {
    authCtx = await requireApiKeyOrSession(request, 'query');
    orgId = authCtx.orgId;
    // API key auth has no userId — use the keyId as a stable identifier
    // for user-memory features (which gracefully degrade for SDK callers).
    userId = authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId;
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (error.message === 'Rate limit exceeded') {
      return errors.rateLimitExceeded();
    }
    if (error.message === 'Insufficient scope') {
      return errors.forbidden();
    }
    return errors.forbidden();
  }

  // Parse request body
  let question: string;
  let context: PageContext;
  let screenshot: string | undefined;

  try {
    const body = await request.json();
    question = body.question;
    context = body.context;
    screenshot = body.screenshot; // base64 JPEG from extension
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  console.log(`[extension/query] Question: "${question}" | App: ${context?.appSignature} | URL: ${context?.url?.slice(0, 80)}`);

  if (!question || typeof question !== 'string') {
    return errors.badRequest('question is required');
  }
  if (!context?.url || !context?.appSignature) {
    return errors.badRequest('context.url and context.appSignature are required');
  }

  // TRIB-40: parse optional `?as_of=<ISO>` for point-in-time retrieval.
  // Only accept valid ISO 8601 timestamps. Invalid values -> 400 instead
  // of silently falling back to "now", which would confuse callers who
  // think they're querying a snapshot.
  const asOfParam = request.nextUrl.searchParams.get('as_of');
  let asOf: string | null = null;
  if (asOfParam !== null) {
    const parsed = new Date(asOfParam);
    if (Number.isNaN(parsed.getTime())) {
      return errors.badRequest(
        'as_of query parameter must be a valid ISO 8601 timestamp'
      );
    }
    asOf = parsed.toISOString();
  }

  // Resolve app + screen from appSignature
  const colonIdx = context.appSignature.indexOf(':');
  const app =
    colonIdx !== -1
      ? context.appSignature.slice(0, colonIdx).toLowerCase()
      : context.appSignature.toLowerCase();
  const screen =
    colonIdx !== -1
      ? context.appSignature.slice(colonIdx + 1).toLowerCase()
      : 'unknown';

  const encoder = new TextEncoder();

  // TRIB-57: Track request start time for latency measurement
  const requestStartTime = Date.now();

  // TRIB-57: Mutable flags for knowledge layer presence (set inside the stream)
  let hadOrgKnowledge = false;
  let hadVendorKnowledge = false;

  // TRIB-50: Collect org page IDs that were included in the fusion prompt
  // so after() can record interactions without blocking the SSE stream.
  const resolvedOrgPageIds: string[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * Helper: enqueue a single SSE event. Wrapped so the tag parser and
       * fusion flow all go through one code path.
       */
      const emit = (event: SseEvent) => {
        controller.enqueue(encodeEvent(encoder, event));
      };

      /**
       * Terminal helper: emit `done` and close the stream exactly once.
       * Guards against double-close if an error path races the happy path.
       */
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          emit({ type: 'done' });
        } catch {
          /* controller may already be closed */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        // ---- Step 1: resolve vendor page (Layer 1) ---------------------
        const vendorPage = await resolveVendorWikiPage({ app, screen });

        // ---- Step 2: embed the question (RETRIEVAL_QUERY task) ---------
        // Reuse the project's fallback-aware embedding helper so we get
        // identical dimensions and retry behavior as TRIB-36 writes.
        let questionEmbedding: number[] = [];
        try {
          const result = await generateEmbeddingWithFallback(
            question,
            'RETRIEVAL_QUERY'
          );
          questionEmbedding = result.embedding;
        } catch (embedError) {
          // If embedding fails, continue with an empty vector — the org
          // resolver will short-circuit to an empty result and we'll
          // fall through to vendor-only fusion.
          console.error(
            '[extension/query] embedding failed, continuing without org layer:',
            embedError
          );
        }

        // ---- Step 3: TRIB-54 resolve vendor training pages (Layer 2) ----
        // If the requesting org has a vendor_org_id, pull the vendor
        // org's wiki pages as "vendor training" — how the vendor
        // recommends using the software. knowledge_scope filtering
        // limits which apps are included.
        let vendorTrainingPages: ResolvedOrgWikiPage[] = [];
        if (questionEmbedding.length > 0) {
          try {
            const vendorInfo = await getVendorForOrg(orgId);
            if (vendorInfo) {
              // Respect knowledge_scope: only include vendor training
              // pages for apps in the configured scope (if any).
              const inScope =
                !vendorInfo.whiteLabelConfig.knowledge_scope ||
                vendorInfo.whiteLabelConfig.knowledge_scope.length === 0 ||
                vendorInfo.whiteLabelConfig.knowledge_scope.some(
                  (s) => s.toLowerCase() === app
                );

              if (inScope) {
                vendorTrainingPages = await resolveOrgWikiPagesByVector({
                  orgId: vendorInfo.vendorOrgId,
                  questionEmbedding,
                  limit: 3,
                  asOf,
                });
              }
            }
          } catch (vendorTrainingError) {
            // Non-fatal: proceed without vendor training layer
            console.error(
              '[extension/query] vendor training page resolution failed:',
              vendorTrainingError
            );
          }
        }

        // ---- Step 4: resolve top-N customer org pages (Layer 3) -------
        // TRIB-40: when `as_of` was supplied, the resolver uses the
        // temporal variant RPC under the hood.
        let orgPages: ResolvedOrgWikiPage[] = [];
        if (questionEmbedding.length > 0) {
          try {
            orgPages = await resolveOrgWikiPagesByVector({
              orgId,
              questionEmbedding,
              limit: 3,
              asOf,
            });
          } catch (orgError) {
            console.error(
              '[extension/query] org page resolution failed:',
              orgError
            );
          }
        }

        // ---- Step 4b: widen context via same-cluster pages (TRIB-44) --
        // After the top-N pages are ranked by vector distance, pull up
        // to 2 extra active pages from the SAME cluster as each match.
        // This gives the LLM nearby knowledge that didn't happen to
        // clear the cosine-similarity bar, which is especially useful
        // for compound questions ("how does X interact with Y?").
        //
        // Gated by org_agent_settings.wiki_cluster_context_enabled so
        // orgs can opt out without a code change. Defaults to true.
        //
        // Point-in-time queries (as_of) skip cluster expansion — the
        // clusters table only stores the latest run's snapshot, so
        // mixing it with temporal retrieval would produce incoherent
        // context. Direct vector matches only for historical queries.
        if (orgPages.length > 0 && asOf == null) {
          try {
            const supabase = createAdminClient();
            const { data: settingsRaw } = await supabase
              .from('org_agent_settings')
              .select('wiki_cluster_context_enabled')
              .eq('org_id', orgId)
              .maybeSingle();

            const settings = settingsRaw as
              | { wiki_cluster_context_enabled: boolean | null }
              | null;

            // Default is ON — only skip when the org explicitly disabled it.
            const enabled = settings?.wiki_cluster_context_enabled !== false;

            if (enabled) {
              const basePageIds = orgPages.map((p) => p.id);
              const clusterPages = await resolveClusterContext({
                orgId,
                basePageIds,
                perCluster: 2,
                excludePageIds: basePageIds,
              });

              // Mix cluster-context pages in AFTER the vector-ranked
              // pages so the LLM still sees the strongest matches
              // first (prompt order matters for model attention).
              if (clusterPages.length > 0) {
                orgPages = [...orgPages, ...clusterPages];
              }
            }
          } catch (clusterError) {
            // Non-fatal: fall back to vector-matches-only if cluster
            // expansion errors out. Logging lets us spot chronic issues.
            console.error(
              '[extension/query] cluster context expansion failed:',
              clusterError
            );
          }
        }

        // ---- Step 5: early exit if all layers are empty -----------------
        console.log(`[extension/query] Vendor page: ${vendorPage ? 'found' : 'none'} | Org pages: ${orgPages.length}`);
        if (!vendorPage && vendorTrainingPages.length === 0 && orgPages.length === 0) {
          // No wiki knowledge — fall back to screenshot-based vision if available
          if (screenshot) {
            console.log(`[extension/query] No wiki knowledge — using screenshot vision fallback`);
            try {
              const genai = getGenAIClient();
              const visionPrompt = `You are a helpful assistant looking at someone's screen. They are on ${context.url} and asked: "${question}"

Look at the screenshot and provide a concise, actionable answer. If you can identify specific UI elements they should click or interact with, describe them clearly. Keep your response conversational and under 3 sentences.`;

              const visionStream = await genai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: visionPrompt },
                      { inlineData: { mimeType: 'image/jpeg', data: screenshot } },
                    ],
                  },
                ],
                config: {
                  temperature: 0.4,
                  maxOutputTokens: 1024,
                },
              });

              for await (const chunk of visionStream) {
                const text = chunk.text;
                if (typeof text === 'string' && text.length > 0) {
                  const textChunks = chunkText(text);
                  for (const tc of textChunks) {
                    emit({ type: 'text_chunk', text: tc });
                  }
                }
              }

              finish();
              return;
            } catch (visionError) {
              console.error('[extension/query] Vision fallback failed:', visionError);
              // Fall through to generic message
            }
          }

          console.log(`[extension/query] No knowledge for ${app}:${screen} — returning fallback`);
          emit({
            type: 'text_chunk',
            text: `I can see you're on ${app !== 'unknown' ? app : 'this page'}, but I don't have specific documentation for it yet. Try asking me a specific question about what you see on screen.`,
          });
          finish();
          return;
        }

        // ---- Step 5b: TRIB-50 user memory lookup ----------------------
        // Query prior interactions so the LLM can skip basic explanations
        // the user has already seen. Lightweight: single indexed query.
        let userMemoryTopics: string[] = [];
        if (orgPages.length > 0) {
          try {
            const supabase = createAdminClient();
            const orgPageIds = orgPages.map((p) => p.id);
            const { data: priorInteractions } = await supabase
              .from('user_wiki_interactions')
              .select('wiki_page_id')
              .eq('user_id', userId)
              .eq('org_id', orgId)
              .in('wiki_page_id', orgPageIds);

            if (priorInteractions && priorInteractions.length > 0) {
              const priorPageIds = new Set(
                (priorInteractions as { wiki_page_id: string }[]).map(
                  (r) => r.wiki_page_id
                )
              );
              userMemoryTopics = orgPages
                .filter((p) => priorPageIds.has(p.id))
                .map((p) => p.topic);
            }
          } catch (memoryError) {
            // Non-fatal: proceed without user memory context
            console.error(
              '[extension/query] user memory lookup failed:',
              memoryError
            );
          }
        }

        // ---- Step 6: build the three-layer fusion prompt ----------------
        const fusionPrompt = buildFusionPrompt({
          app,
          screen,
          question,
          vendorMarkdown: vendorPage?.content ?? null,
          vendorTrainingPages,
          orgPages,
          elements: context.elements ?? [],
          userMemoryTopics:
            userMemoryTopics.length > 0 ? userMemoryTopics : undefined,
        });

        // TRIB-50: capture page IDs for after() interaction recording
        resolvedOrgPageIds.push(...orgPages.map((p) => p.id));

        // TRIB-57: set knowledge flags for usage analytics
        hadOrgKnowledge = orgPages.length > 0;
        hadVendorKnowledge =
          vendorTrainingPages.length > 0 || vendorPage != null;

        // ---- Step 7: stream the LLM response through the tag parser ---
        // Track which page ids we've already cited so we only enrich the
        // recording URL lookup once per source.
        const citedPageIds = new Set<string>();
        const orgPageIds = new Set(orgPages.map((p) => p.id));
        const vendorTrainingPageIds = new Set(vendorTrainingPages.map((p) => p.id));
        const vendorPageId = vendorPage?.id;
        const vendorPageTitle = vendorPage
          ? `${vendorPage.app} — ${vendorPage.screen}`
          : null;
        const vendorSourceUrl = vendorPage?.source_url ?? undefined;

        const parser = new TagStreamParser(
          // onText
          (text) => emit({ type: 'text_chunk', text }),
          // onElement
          ({ selector, label }) => {
            emit({
              type: 'element_ref',
              selector,
              label: label || selector,
              action: 'highlight',
            });
          },
          // onCitation — fire-and-forget async enrichment; the synchronous
          // citation event is emitted immediately so the extension's UI
          // doesn't wait on a DB round-trip. Recording URL enrichment
          // happens in the background and we re-emit if we find one.
          ({ sourceId, title }) => {
            if (citedPageIds.has(sourceId)) return;
            citedPageIds.add(sourceId);

            // Vendor citation — use the source_url directly.
            if (sourceId === vendorPageId) {
              emit({
                type: 'citation',
                sourceId,
                title: title || vendorPageTitle || 'Vendor documentation',
                recordingUrl: vendorSourceUrl,
              });
              return;
            }

            // Vendor training citation — emit without recording URL
            // (vendor training pages belong to the vendor org, not the
            // customer, so we don't try to resolve customer recordings).
            if (vendorTrainingPageIds.has(sourceId)) {
              emit({
                type: 'citation',
                sourceId,
                title: title || 'Vendor training',
              });
              return;
            }

            // Org citation — try to resolve a recording URL in the
            // background so we don't block the text stream.
            if (orgPageIds.has(sourceId)) {
              emit({
                type: 'citation',
                sourceId,
                title: title || 'Team knowledge',
              });
              resolveRecordingUrlForPage(sourceId)
                .then((recordingUrl) => {
                  if (recordingUrl) {
                    emit({
                      type: 'citation',
                      sourceId,
                      title: title || 'Team knowledge',
                      recordingUrl,
                    });
                  }
                })
                .catch(() => {
                  /* best-effort enrichment */
                });
              return;
            }

            // Unknown id — emit raw anyway so the extension still sees it.
            emit({
              type: 'citation',
              sourceId,
              title: title || 'Source',
            });
          }
        );

        try {
          const genai = getGenAIClient();

          // If we have a screenshot, use vision (multimodal) for richer context
          const contents = screenshot
            ? [
                {
                  role: 'user' as const,
                  parts: [
                    { text: fusionPrompt },
                    { inlineData: { mimeType: 'image/jpeg' as const, data: screenshot } },
                  ],
                },
              ]
            : fusionPrompt;

          const stream = await genai.models.generateContentStream({
            model: 'gemini-flash-lite-latest',
            contents,
            config: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          });

          for await (const chunk of stream) {
            const text = chunk.text;
            if (typeof text === 'string' && text.length > 0) {
              parser.push(text);
            }
          }

          // Flush any trailing text / partial-tag buffer as plain text.
          parser.flush();
        } catch (llmError) {
          console.error('[extension/query] LLM stream error:', llmError);
          // Make sure any buffered text still makes it to the client.
          parser.flush();
          emit({
            type: 'text_chunk',
            text: 'I had trouble generating a response. Please try again.',
          });
        }

        finish();
      } catch (error) {
        console.error('[extension/query] stream error:', error);
        try {
          emit({
            type: 'text_chunk',
            text: 'An error occurred while retrieving knowledge. Please try again.',
          });
        } catch {
          /* controller may already be closed */
        }
        finish();
      }
    },
  });

  // TRIB-50: Record user-wiki interactions fire-and-forget AFTER the
  // response completes. Uses next/server after() so it doesn't block
  // the SSE stream. Deduplicates: skips if same (user, page, type)
  // tuple already exists within the last hour.
  after(async () => {
    if (resolvedOrgPageIds.length === 0) return;

    try {
      const supabase = createAdminClient();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Find existing interactions within the last hour for dedup
      const { data: existing } = await supabase
        .from('user_wiki_interactions')
        .select('wiki_page_id, interaction_type')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .in('wiki_page_id', resolvedOrgPageIds)
        .gte('created_at', oneHourAgo);

      const existingSet = new Set(
        (
          (existing as
            | { wiki_page_id: string; interaction_type: string }[]
            | null) ?? []
        ).map((r) => `${r.wiki_page_id}:${r.interaction_type}`)
      );

      // Build rows: 'taught' for all org pages included in the prompt
      const rows = resolvedOrgPageIds
        .filter((pageId) => !existingSet.has(`${pageId}:taught`))
        .map((pageId) => ({
          user_id: userId,
          org_id: orgId,
          wiki_page_id: pageId,
          interaction_type: 'taught' as const,
        }));

      if (rows.length > 0) {
        await supabase.from('user_wiki_interactions').insert(rows);
      }
    } catch (err) {
      // Best-effort — don't let interaction tracking crash anything
      console.error(
        '[extension/query] failed to record user wiki interactions:',
        err
      );
    }
  });

  // TRIB-57: Record vendor usage event fire-and-forget AFTER the response.
  // Only for API-key-authenticated requests (vendor SDK callers).
  // Session-auth requests are internal users, not vendor customers.
  if (authCtx.authMethod === 'api_key') {
    after(async () => {
      try {
        const supabase = createAdminClient();
        await supabase.from('vendor_usage_events').insert({
          vendor_org_id: authCtx.orgId,
          customer_org_id: orgId !== authCtx.orgId ? orgId : null,
          api_key_id: authCtx.keyId,
          event_type: 'query',
          question,
          app,
          screen,
          response_latency_ms: Date.now() - requestStartTime,
          had_org_knowledge: hadOrgKnowledge,
          had_vendor_knowledge: hadVendorKnowledge,
        });
      } catch (err) {
        // Best-effort — don't let analytics recording crash anything
        console.error(
          '[extension/query] failed to record vendor usage event:',
          err
        );
      }
    });
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...CORS_HEADERS,
    },
  });
}
