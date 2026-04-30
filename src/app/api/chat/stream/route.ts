/**
 * Streaming Chat API
 *
 * Streams AI responses token-by-token for real-time chat experience.
 * Uses Server-Sent Events (SSE) for streaming.
 */

import { NextRequest } from 'next/server';

import {
  buildCompiledMemoryCitations,
  resolveCompiledMemoryAnswerContext,
} from '@/lib/services/compiled-memory-answer-context';
import { generateCompiledMemoryGroundedAnswer } from '@/lib/services/compiled-memory-answer';
import { rateLimiters } from '@/lib/rate-limit/limiter';
import { requireOrg } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Encode an SSE event as bytes for streaming. */
function encodeEvent(encoder: TextEncoder, data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

type StreamSource = ReturnType<typeof buildCompiledMemoryCitations>[number];

async function createConversation(
  orgId: string,
  userId: string,
  title = 'New Chat',
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .insert({
      org_id: orgId,
      user_id: userId,
      title,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create conversation: ${error?.message ?? 'missing row'}`);
  }

  return data.id;
}

async function saveChatMessage(
  conversationId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    metadata?: { sources?: StreamSource[] };
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from('chat_messages').insert({
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    sources: (message.metadata?.sources ?? null) as Json,
    metadata: (message.metadata ?? {}) as Json,
  });

  if (error) {
    throw new Error(`Failed to save chat message: ${error.message}`);
  }
}

/**
 * POST /api/chat/stream
 *
 * Streams AI responses token-by-token using Server-Sent Events.
 *
 * Request body:
 * - message: string (required) — the user's chat message
 * - conversationId?: string — existing conversation to continue
 * - app?: string — optional app hint for compiled memory.
 * - screen?: string — optional screen hint for compiled memory.
 * - limit?: number — max compiled Wiki sources (default: 5)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await requireOrg();

    // Skip rate limiting if Redis is not configured
    const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL &&
      !process.env.UPSTASH_REDIS_REST_URL.includes('your-redis');

    if (isRedisConfigured) {
      const rateLimitResult = await rateLimiters.chat(userId);
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
      app,
      screen,
      limit = 5,
    } = body;

    if (!message || typeof message !== 'string') {
      return new Response('Message is required', { status: 400 });
    }

    let convId: string;
    if (conversationId) {
      // Validate conversation belongs to org
      const { data: conv, error: convError } = await supabaseAdmin
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (convError) {
        return new Response('Internal server error', { status: 500 });
      }
      if (!conv) {
        return new Response('Conversation not found', { status: 404 });
      }
      convId = conversationId;
    } else {
      convId = await createConversation(orgId, userId, 'New Chat');
    }
    await saveChatMessage(convId, {
      role: 'user',
      content: message,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const answerContext = await resolveCompiledMemoryAnswerContext({
            orgId,
            userId,
            question: message,
            app,
            screen,
            limit,
          });
          const sources = buildCompiledMemoryCitations(answerContext.sources);
          controller.enqueue(encodeEvent(encoder, { type: 'sources', sources }));

          const answer = await generateCompiledMemoryGroundedAnswer({
            question: message,
            answerContext,
          });

          controller.enqueue(encodeEvent(encoder, { type: 'token', token: answer }));
          await saveChatMessage(convId, {
            role: 'assistant',
            content: answer,
            metadata: { sources },
          });
          controller.enqueue(encodeEvent(encoder, { type: 'done', conversationId: convId }));

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
