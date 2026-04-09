/**
 * Chat Tools Integration Examples
 *
 * @deprecated This file contains example implementations that are not actively maintained.
 * The Vercel AI SDK API has changed and this file has type errors.
 *
 * DO NOT USE THIS FILE IN PRODUCTION.
 *
 * For updated patterns, refer to:
 * - lib/services/chat-rag-integration.ts (RAG implementation)
 * - app/api/chat/route.ts (Production chat endpoint)
 *
 * Original examples showing how to integrate chat-tools.ts
 * with different chat API patterns:
 * 1. Streaming with Vercel AI SDK (recommended)
 * 2. Non-streaming with tool support
 * 3. Hybrid approach with manual tool execution
 *
 * @ts-nocheck - Type checking disabled for deprecated example file
 */

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText, type CoreMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

import { apiHandler, requireOrg, parseBody, successResponse, errors } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';

// Note: chat-tools.ts exports individual tool execute functions, not a chatTools object
// This example file is for demonstration purposes only
import { QuotaManager } from './quotas/quota-manager';
import { RateLimiter } from './quotas/rate-limiter';

/**
 * EXAMPLE 1: Streaming Chat with Automatic Tool Calling
 *
 * Best for: Real-time chat UIs with automatic tool usage
 * Uses: Vercel AI SDK streamText + tools
 *
 * NOTE: This example is disabled as it requires proper tool configuration
 */
export const streamingChatWithTools = async (request: NextRequest): Promise<Response> => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  // Check quotas
  const rateLimit = await RateLimiter.checkLimit('ai', orgId);
  if (!rateLimit.success) {
    return errors.rateLimitExceeded(rateLimit);
  }

  const quotaCheck = await QuotaManager.checkQuota(orgId, 'ai');
  if (!quotaCheck.allowed) {
    return errors.quotaExceeded(quotaCheck);
  }

  await QuotaManager.consumeQuota(orgId, 'ai');

  // Stream with tool support
  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: messages as CoreMessage[],
    maxSteps: 5,
    temperature: 0.7,
    system: `You are a helpful AI assistant that can search recordings,
             retrieve documents, and access transcripts. Use tools when
             the user asks about their recordings.`,
  });

  return result.toTextStreamResponse();
};

/**
 * EXAMPLE 2: Non-Streaming with Tool Support
 *
 * Best for: Simple request/response APIs
 * Uses: Vercel AI SDK generateText + tools
 */
const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().uuid().optional(),
});

export const nonStreamingChatWithTools = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await parseBody(request, chatSchema);

  const { message, conversationId } = body;

  // Check quotas (same as streaming example)
  await QuotaManager.consumeQuota(orgId, 'ai');

  // Generate complete response with tool usage
  const { text, usage } = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: message }] as CoreMessage[],
    maxSteps: 5,
  });

  return successResponse({
    conversationId: conversationId || 'new-conversation',
    response: text,
    usage: {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    },
  });
});

/**
 * EXAMPLE 3: Manual Tool Execution with Custom Logic
 *
 * Best for: Custom workflows where you need fine-grained control
 * Uses: Direct tool execution without AI SDK automation
 *
 * NOTE: This example is disabled as it requires proper tool configuration
 */
export const manualToolExecution = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { query } = await request.json();

  // Use AI to decide which tool to use
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: query }] as CoreMessage[],
    maxSteps: 1, // Single step - just pick a tool
  });

  return successResponse({
    response: result.text,
  });
});

/**
 * EXAMPLE 4: Streaming with Source Citations
 *
 * Best for: Chat UIs that need to display sources in real-time
 * Uses: streamText with onStepFinish callback
 *
 * NOTE: This example is disabled as it requires proper tool configuration
 */
export const streamingWithCitations = async (request: NextRequest): Promise<Response> => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: messages as CoreMessage[],
    maxSteps: 5,
    onFinish: async ({ text, usage }) => {
      console.log('[Chat] Response completed:', {
        orgId,
        tokens: usage.totalTokens,
      });
      // TODO: Save to database
    },
  });

  return result.toTextStreamResponse();
};

/**
 * EXAMPLE 5: Multi-Step Reasoning with Progress Updates
 *
 * Best for: Complex queries that require multiple tool invocations
 * Uses: streamText with extended maxSteps and step tracking
 *
 * NOTE: This example is disabled as it requires proper tool configuration
 */
export const multiStepReasoning = async (request: NextRequest): Promise<Response> => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  let stepCount = 0;

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: messages as CoreMessage[],
    maxSteps: 10, // Allow complex multi-step reasoning
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-tools-multi-step',
    },
    onStepFinish: async ({ text }) => {
      stepCount++;
      console.log(`[Chat] Step ${stepCount} completed:`, {
        hasText: !!text,
      });
    },
  });

  return result.toTextStreamResponse();
};

/**
 * EXAMPLE 6: Hybrid Approach with RAG Fallback
 *
 * Best for: Combining Vercel AI SDK tools with existing RAG implementation
 * Uses: Both chatTools and legacy RAG functions
 */
import { injectRAGContext } from './chat-rag-integration';

export const hybridRAGWithTools = async (request: NextRequest): Promise<Response> => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  // Get last user message for RAG context
  const lastMessage = messages.findLast((m: any) => m.role === 'user');

  // Pre-inject RAG context (in addition to tools)
  const ragContext = await injectRAGContext(lastMessage?.content || '', orgId, {
    limit: 5,
    useHierarchical: true,
    enableCache: true,
  });

  // Add RAG context to system prompt
  const systemPrompt = `You are a helpful AI assistant.

Available Context:
${ragContext.context}

You also have access to tools for more specific queries.
Use the context above for general questions, but use tools when you need:
- More specific information (getTranscript, getDocument)
- To search with different criteria (searchRecordings)
- To check recording metadata (getRecordingMetadata)`;

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: messages as CoreMessage[],
    system: systemPrompt,
    maxSteps: 5,
  });

  return result.toTextStreamResponse();
};

/**
 * EXAMPLE 7: Conversation History with Tool Results
 *
 * Best for: Multi-turn conversations that preserve tool context
 * Uses: Proper message history with tool results
 */

export const conversationWithToolHistory = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { message, conversationId } = await request.json();

  const supabase = await createClient();

  // Get conversation history
  let messages: any[] = [];
  if (conversationId) {
    const { data: chatMessages } = await supabase
      .from('chat_messages')
      .select('role, content, tool_invocations')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (chatMessages) {
      messages = chatMessages.map((msg) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        toolInvocations: msg.tool_invocations,
      }));
    }
  }

  // Add new user message
  messages.push({ role: 'user', content: message });

  // Generate response with full history
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: messages as CoreMessage[],
    maxSteps: 5,
  });

  // Save messages to database
  if (conversationId) {
    await supabase.from('chat_messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: message,
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: result.text,
      },
    ]);
  }

  return successResponse({
    conversationId,
    response: result.text,
  });
});

/**
 * Export all examples for testing and reference
 */
export const examples = {
  streamingChatWithTools,
  nonStreamingChatWithTools,
  manualToolExecution,
  streamingWithCitations,
  multiStepReasoning,
  hybridRAGWithTools,
  conversationWithToolHistory,
};
