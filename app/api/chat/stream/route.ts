/**
 * Streaming Chat API
 *
 * Streams AI responses token-by-token for real-time chat experience.
 * Uses Server-Sent Events (SSE) for streaming.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  generateStreamingRAGResponse,
  saveChatMessage,
  createConversation,
  getConversationHistory,
} from '@/lib/services/rag-google';
import { rateLimiters } from '@/lib/rate-limit/limiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/stream
 * Stream AI response with RAG
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limit check
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

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await createConversation(orgId, userId, 'New Chat');
    }

    // Get conversation history
    const history = await getConversationHistory(convId, orgId);

    // Save user message
    await saveChatMessage(convId, {
      role: 'user',
      content: message,
    });

    // Create readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          let sources: any[] = [];

          // Generate streaming response
          const generator = generateStreamingRAGResponse(message, orgId, {
            conversationHistory: history,
            maxChunks,
            threshold,
            recordingIds,
            rerank,
          });

          for await (const chunk of generator) {
            if (chunk.type === 'context') {
              // Send sources first
              sources = chunk.data.sources;
              const sourcesData = `data: ${JSON.stringify({
                type: 'sources',
                sources,
              })}\n\n`;
              controller.enqueue(encoder.encode(sourcesData));
            } else if (chunk.type === 'token') {
              // Send token
              fullResponse += chunk.data.token;
              const tokenData = `data: ${JSON.stringify({
                type: 'token',
                token: chunk.data.token,
              })}\n\n`;
              controller.enqueue(encoder.encode(tokenData));
            } else if (chunk.type === 'done') {
              // Save assistant message
              await saveChatMessage(convId, {
                role: 'assistant',
                content: fullResponse,
                metadata: { sources },
              });

              // Send done signal
              const doneData = `data: ${JSON.stringify({
                type: 'done',
                conversationId: convId,
              })}\n\n`;
              controller.enqueue(encoder.encode(doneData));
            }
          }

          controller.close();
        } catch (error) {
          console.error('[Chat Stream] Error:', error);
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
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
    return new Response('Internal server error', { status: 500 });
  }
}
