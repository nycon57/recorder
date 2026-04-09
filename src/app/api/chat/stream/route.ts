/**
 * Streaming Chat API
 *
 * Streams AI responses token-by-token for real-time chat experience.
 * Uses Server-Sent Events (SSE) for streaming.
 */

import { NextRequest } from 'next/server';

import {
  generateStreamingRAGResponse,
  saveChatMessage,
  createConversation,
  getConversationHistory,
  type CitedSource,
} from '@/lib/services/rag-google';
import { rateLimiters } from '@/lib/rate-limit/limiter';
import { requireOrg } from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Encode an SSE event as bytes for streaming. */
function encodeEvent(encoder: TextEncoder, data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/chat/stream
 *
 * Streams AI responses token-by-token using Server-Sent Events.
 *
 * Request body:
 * - message: string (required) — the user's chat message
 * - conversationId?: string — existing conversation to continue
 * - recordingIds?: string[] — scope RAG retrieval to specific content IDs.
 *     When provided, only transcript chunks belonging to these content items
 *     are searched. Pass an empty array or omit to search all org content.
 * - maxChunks?: number — max context chunks (default: 5)
 * - threshold?: number — similarity threshold (default: 0.7)
 * - rerank?: boolean — enable Cohere reranking (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId, clerkUserId } = await requireOrg();

    // Skip rate limiting if Redis is not configured
    const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL &&
      !process.env.UPSTASH_REDIS_REST_URL.includes('your-redis');

    if (isRedisConfigured) {
      const rateLimitResult = await rateLimiters.chat(clerkUserId);
      if (!rateLimitResult.success) {
        const retryAfter = rateLimitResult.reset - Math.floor(Date.now() / 1000);
        return new Response(
          JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            },
          }
        );
      }
    }

    const body = await request.json();
    const {
      message,
      conversationId,
      recordingIds,
      maxChunks = 5,
      threshold = 0.7,
      rerank = false,
    } = body;

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 });
    }

    const convId = conversationId || await createConversation(orgId, userId, 'New Chat');
    const history = await getConversationHistory(convId, orgId);

    await saveChatMessage(convId, {
      role: 'user',
      content: message,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let sources: CitedSource[] = [];

          const generator = generateStreamingRAGResponse(message, orgId, {
            conversationHistory: history,
            maxChunks,
            threshold,
            contentIds: recordingIds?.length ? recordingIds : undefined,
            rerank,
          });

          for await (const chunk of generator) {
            if (chunk.type === 'context') {
              sources = chunk.data.sources;
              controller.enqueue(encodeEvent(encoder, { type: 'sources', sources }));
            } else if (chunk.type === 'token') {
              fullResponse += chunk.data.token;
              controller.enqueue(encodeEvent(encoder, { type: 'token', token: chunk.data.token }));
            } else if (chunk.type === 'done') {
              await saveChatMessage(convId, {
                role: 'assistant',
                content: fullResponse,
                metadata: { sources },
              });
              controller.enqueue(encodeEvent(encoder, { type: 'done', conversationId: convId }));
            }
          }

          controller.close();
        } catch (error) {
          console.error('[Chat Stream] Error:', error);
          controller.enqueue(encodeEvent(encoder, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat Stream] Request error:', error);

    // requireOrg() throws specific messages for auth/org failures
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return new Response('Unauthorized', { status: 401 });
      }
      if (error.message === 'Organization context required') {
        return new Response('Organization context required', { status: 403 });
      }
    }

    return new Response('Internal server error', { status: 500 });
  }
}
