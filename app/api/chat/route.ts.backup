/**
 * Chat API (Non-Streaming)
 *
 * Handles chat requests with RAG (Retrieval Augmented Generation).
 * Returns complete responses with sources.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody, errors } from '@/lib/utils/api';
import {
  generateRAGResponse,
  saveChatMessage,
  createConversation,
  getConversationHistory,
} from '@/lib/services/rag-google';
import { z } from 'zod';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  conversationId: z.string().uuid().optional(),
  recordingIds: z.array(z.string().uuid()).optional(),
  maxChunks: z.number().int().min(1).max(10).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  rerank: z.boolean().optional().default(false),
  // Agentic mode options
  useAgentic: z.boolean().optional().default(false),
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
  enableSelfReflection: z.boolean().optional().default(true),
});

type ChatBody = z.infer<typeof chatSchema>;

/**
 * POST /api/chat
 * Send a chat message and get AI response
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody(request, chatSchema);
  const startTime = Date.now();

  // Phase 6: Rate limiting
  const rateLimit = await RateLimiter.checkLimit('ai', orgId);
  if (!rateLimit.success) {
    return errors.rateLimitExceeded({
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.reset * 1000).toISOString(),
    });
  }

  // Phase 6: Quota check
  const quotaCheck = await QuotaManager.checkQuota(orgId, 'ai');
  if (!quotaCheck.allowed) {
    return errors.quotaExceeded({
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      resetAt: quotaCheck.resetAt.toISOString(),
      message: quotaCheck.message,
    });
  }

  // Phase 6: Consume quota
  await QuotaManager.consumeQuota(orgId, 'ai');

  const {
    message,
    conversationId,
    recordingIds,
    maxChunks,
    threshold,
    rerank,
    useAgentic,
    maxIterations,
    enableSelfReflection,
  } = body as ChatBody;

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
  const { response, sources, tokensUsed, rerankMetadata, agenticMetadata } = await generateRAGResponse(
    message,
    orgId,
    {
      conversationHistory: history,
      maxChunks,
      threshold,
      recordingIds,
      rerank,
      useAgentic,
      maxIterations,
      enableSelfReflection,
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
      ...(agenticMetadata && { agenticMetadata }),
    },
  });

  const latencyMs = Date.now() - startTime;

  return successResponse({
    conversationId: convId,
    message: {
      id: assistantMessage.id,
      content: response,
      sources,
      tokensUsed,
      latencyMs,
      ...(rerankMetadata && { rerankMetadata }),
      ...(agenticMetadata && { agenticMetadata }),
    },
  });
});
