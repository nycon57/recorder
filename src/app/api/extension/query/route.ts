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
 * Returns an SSE stream with event types:
 *   text_chunk  — { text: string }
 *   element_ref — { selector: string, label: string, action: "highlight" | "point" | "pulse" }
 *   citation    — { sourceId: string, title: string, recordingUrl?: string }
 *   done        — {}
 *
 * Phase 1 MVP: Uses vendor wiki pages only (no org wiki or LLM fusion).
 * The content is split into ~100-char chunks and streamed as text_chunk
 * events. Element selectors from the wiki page are emitted as element_ref
 * events. A citation event references the vendor page source URL.
 */

import { NextRequest } from 'next/server';

import { requireOrg, errors } from '@/lib/utils/api';
import { resolveVendorWikiPage } from '@/lib/services/vendor-wiki-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const words = text.split(/\s+/);
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

export async function POST(request: NextRequest) {
  // Auth check before touching the stream
  let orgId: string;
  try {
    const ctx = await requireOrg();
    orgId = ctx.orgId;
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    return errors.forbidden();
  }

  // Parse request body
  let question: string;
  let context: PageContext;
  let conversationId: string | undefined;

  try {
    const body = await request.json();
    question = body.question;
    context = body.context;
    conversationId = body.conversationId;
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  if (!question || typeof question !== 'string') {
    return errors.badRequest('question is required');
  }
  if (!context?.url || !context?.appSignature) {
    return errors.badRequest('context.url and context.appSignature are required');
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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: resolve vendor wiki page only
        const wikiPage = await resolveVendorWikiPage({ app, screen });

        if (!wikiPage) {
          // No knowledge found — emit a graceful fallback and done
          controller.enqueue(
            encodeEvent(encoder, {
              type: 'text_chunk',
              text: `I don't have specific documentation for ${app} ${screen} yet. Please check the vendor's help center for guidance.`,
            })
          );
          controller.enqueue(encodeEvent(encoder, { type: 'done' }));
          controller.close();
          return;
        }

        // Stream content in text chunks
        const chunks = chunkText(wikiPage.content);
        for (const chunk of chunks) {
          controller.enqueue(
            encodeEvent(encoder, { type: 'text_chunk', text: chunk })
          );
        }

        // Emit element refs from the wiki page's element_selectors
        const selectors = wikiPage.element_selectors as
          | Array<{ selector: string; label: string; action?: string }>
          | null;

        if (Array.isArray(selectors)) {
          for (const el of selectors) {
            if (el.selector && el.label) {
              controller.enqueue(
                encodeEvent(encoder, {
                  type: 'element_ref',
                  selector: el.selector,
                  label: el.label,
                  action: (el.action as ElementRefEvent['action']) ?? 'highlight',
                })
              );
            }
          }
        }

        // Emit citation for the vendor page
        controller.enqueue(
          encodeEvent(encoder, {
            type: 'citation',
            sourceId: wikiPage.id,
            title: `${wikiPage.app} — ${wikiPage.screen}`,
            recordingUrl: wikiPage.source_url ?? undefined,
          })
        );

        // Signal completion
        controller.enqueue(encodeEvent(encoder, { type: 'done' }));
        controller.close();
      } catch (error) {
        console.error('[extension/query] stream error:', error);
        controller.enqueue(
          encodeEvent(encoder, {
            type: 'text_chunk',
            text: 'An error occurred while retrieving knowledge. Please try again.',
          })
        );
        controller.enqueue(encodeEvent(encoder, { type: 'done' }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
