/**
 * Chat API (Non-Streaming)
 *
 * Handles chat requests with RAG (Retrieval Augmented Generation).
 * Returns complete responses with sources.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import {
  generateRAGResponse,
  saveChatMessage,
  createConversation,
  getConversationHistory,
} from '@/lib/services/rag-google';
import { z } from 'zod';

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().uuid().optional(),
  recordingIds: z.array(z.string().uuid()).optional(),
  maxChunks: z.number().int().min(1).max(10).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  rerank: z.boolean().optional().default(false),
});

type ChatBody = z.infer<typeof chatSchema>;

/**
 * POST /api/chat
 * Send a chat message and get AI response
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody(request, chatSchema);

  const { message, conversationId, recordingIds, maxChunks, threshold, rerank } =
    body as ChatBody;

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    convId = await createConversation(orgId, userId, 'New Chat');
  }

  // Get conversation history
  const history = await getConversationHistory(convId, orgId);

  // Save user message
  const userMessage = await saveChatMessage(convId, {
    role: 'user',
    content: message,
  });

  // Generate AI response with RAG
  const { response, sources, tokensUsed, rerankMetadata } = await generateRAGResponse(
    message,
    orgId,
    {
      conversationHistory: history,
      maxChunks,
      threshold,
      recordingIds,
      rerank,
    }
  );

  // Save assistant message
  const assistantMessage = await saveChatMessage(convId, {
    role: 'assistant',
    content: response,
    metadata: {
      sources,
      tokensUsed,
      ...(rerankMetadata && { rerankMetadata }),
    },
  });

  return successResponse({
    conversationId: convId,
    message: {
      id: assistantMessage.id,
      content: response,
      sources,
      tokensUsed,
      ...(rerankMetadata && { rerankMetadata }),
    },
  });
});
