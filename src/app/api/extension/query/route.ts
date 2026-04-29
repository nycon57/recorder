/**
 * POST /api/extension/query
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Accepts:
 *   {
 *     question: string;
 *     context: PageContext;       // { url, appSignature, elements? | interactiveElements? }
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

import {
  sanitizePageContextForNetwork,
  type PageContext,
} from '@tribora/shared';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import type { Json } from '@/lib/types/database';
import type { CompiledMemoryCitationLayer } from '@/lib/services/compiled-memory-context';
import {
  buildExtensionCompiledMemoryPrompt,
  resolveCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability,
  type CompiledMemoryAnswerCitation,
} from '@/lib/services/compiled-memory-answer-context';
import {
  buildKnowledgeExtensionQueryTelemetry,
  recordKnowledgeTelemetryEvent,
  type KnowledgeTelemetryFailureClass,
  type KnowledgeExtensionQueryTelemetryPayload,
} from '@/lib/services/knowledge-telemetry';
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
  layer?: CompiledMemoryCitationLayer;
  freshness?: CompiledMemoryAnswerCitation['freshness'];
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

function normalizePromptElements(
  context: PageContext,
): Array<{ selector: string; label: string }> {
  return (context.interactiveElements ?? []).map((element) => ({
    selector: element.selector,
    label: element.label,
  }));
}

function hasDomOnlyGuidanceContext(context: PageContext): boolean {
  return (
    (context.interactiveElements?.length ?? 0) > 0 ||
    (context.regions?.length ?? 0) > 0 ||
    (context.snippets?.length ?? 0) > 0 ||
    (context.forms?.length ?? 0) > 0 ||
    (context.tables?.length ?? 0) > 0 ||
    (context.dialogs?.length ?? 0) > 0 ||
    Boolean(context.pageSummary)
  );
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
    }) => void,
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
    if (
      TagStreamParser.TAG_OPENER_PREFIXES.includes(shortBuffer.toUpperCase())
    ) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (message === 'Rate limit exceeded') {
      return errors.rateLimitExceeded();
    }
    if (message === 'Insufficient scope') {
      return errors.forbidden();
    }
    return errors.forbidden();
  }

  // Parse request body
  let question: string;
  let context: PageContext;

  try {
    const body = await request.json();
    question = body.question;
    context = body.context
      ? sanitizePageContextForNetwork(body.context)
      : body.context;
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  if (!question || typeof question !== 'string') {
    return errors.badRequest('question is required');
  }
  if (!context?.url || !context?.appSignature) {
    return errors.badRequest(
      'context.url and context.appSignature are required',
    );
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
        'as_of query parameter must be a valid ISO 8601 timestamp',
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
  let telemetryPayload: KnowledgeExtensionQueryTelemetryPayload | null = null;
  let sharedVendorTelemetry =
    summarizeCompiledMemoryAnswerObservability(undefined);
  let telemetryFailureClass: KnowledgeTelemetryFailureClass = 'none';

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

      const captureTelemetry = () => {
        telemetryPayload = buildKnowledgeExtensionQueryTelemetry({
          orgId,
          userId,
          app,
          screen,
          hadOrgKnowledge,
          hadVendorKnowledge,
          knowledgeMode: hadOrgKnowledge
            ? 'org_backed'
            : hadVendorKnowledge
              ? 'vendor_backed'
              : 'dom_only',
          responseLatencyMs: Date.now() - requestStartTime,
          asOf,
          failureClass: telemetryFailureClass,
          ...sharedVendorTelemetry,
        });
      };

      /**
       * Terminal helper: emit `done` and close the stream exactly once.
       * Guards against double-close if an error path races the happy path.
       */
      let closed = false;
      const finish = () => {
        if (closed) return;
        closed = true;
        captureTelemetry();
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
        // ---- Step 1: resolve compiled-memory answer context ------------
        // Shared service owns three-layer retrieval plus normalized
        // source/citation metadata so routes stop rebuilding it inline.
        const answerContext = await resolveCompiledMemoryAnswerContext({
          orgId,
          userId,
          question,
          app,
          screen,
          asOf,
        });
        sharedVendorTelemetry =
          summarizeCompiledMemoryAnswerObservability(answerContext);

        // ---- Step 3: fall back only when both knowledge and DOM context are empty.
        if (
          answerContext.sources.length === 0 &&
          !hasDomOnlyGuidanceContext(context)
        ) {
          emit({
            type: 'text_chunk',
            text: `I don't have specific documentation for ${app} ${screen} yet. Please check the vendor's help center for guidance.`,
          });
          finish();
          return;
        }

        // ---- Step 4: build the three-layer fusion prompt ----------------
        const fusionPrompt = buildExtensionCompiledMemoryPrompt({
          app,
          screen,
          question,
          elements: normalizePromptElements(context),
          answerContext,
          pageContext: context,
        });

        // TRIB-50: capture page IDs for after() interaction recording
        resolvedOrgPageIds.push(
          ...answerContext.sources
            .filter((source) => source.layer === 'org')
            .map((source) => source.provenance.pageId),
        );

        // TRIB-57: set knowledge flags for usage analytics
        hadOrgKnowledge = answerContext.sources.some(
          (source) => source.layer === 'org',
        );
        hadVendorKnowledge = answerContext.sources.some(
          (source) => source.layer !== 'org',
        );

        // ---- Step 5: stream the LLM response through the tag parser ----
        const citedPageIds = new Set<string>();

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

            const citation = answerContext.citationsBySourceId[sourceId];
            emit({
              type: 'citation',
              sourceId,
              title: title || citation?.title || 'Source',
              recordingUrl: citation?.url,
              layer: citation?.layer,
              freshness: citation?.freshness,
            });
          },
        );

        try {
          const genai = getGenAIClient();
          const stream = await genai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: fusionPrompt,
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
          telemetryFailureClass = 'route_error';
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
        telemetryFailureClass = 'route_error';
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
        ).map((r) => `${r.wiki_page_id}:${r.interaction_type}`),
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
        err,
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
          err,
        );
      }
    });
  }

  after(async () => {
    if (!telemetryPayload) return;

    await recordKnowledgeTelemetryEvent({
      type: 'knowledge.extension.query.outcome',
      payload: telemetryPayload as unknown as Json,
    });
  });

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
