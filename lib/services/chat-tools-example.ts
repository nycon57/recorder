/**
 * Chat Tools Integration Examples
 *
 * Example implementations showing how to integrate chat-tools.ts
 * with different chat API patterns.
 *
 * Choose the pattern that fits your needs:
 * 1. Streaming with Vercel AI SDK (recommended)
 * 2. Non-streaming with tool support
 * 3. Hybrid approach with manual tool execution
 */

import { NextRequest } from 'next/server';
import { streamText, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { apiHandler, requireOrg, parseBody, successResponse, errors } from '@/lib/utils/api';
import { chatTools } from './chat-tools';
import { z } from 'zod';
import { QuotaManager } from './quotas/quota-manager';
import { RateLimiter } from './quotas/rate-limiter';

/**
 * EXAMPLE 1: Streaming Chat with Automatic Tool Calling
 *
 * Best for: Real-time chat UIs with automatic tool usage
 * Uses: Vercel AI SDK streamText + tools
 */
export const streamingChatWithTools = async (request: NextRequest) => {
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
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 5,
    temperature: 0.7,
    system: `You are a helpful AI assistant that can search recordings,
             retrieve documents, and access transcripts. Use tools when
             the user asks about their recordings.`,
  });

  return result.toDataStreamResponse();
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
  const { text, toolCalls, toolResults, usage } = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: message }],
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 5,
  });

  return successResponse({
    conversationId: conversationId || 'new-conversation',
    response: text,
    toolCalls: toolCalls?.map((call) => ({
      toolName: call.toolName,
      args: call.args,
    })),
    toolResults: toolResults?.map((result) => ({
      toolName: result.toolName,
      result: result.result,
    })),
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
 */
export const manualToolExecution = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { query, toolName, toolArgs } = await request.json();

  // Example: User explicitly requests a tool
  if (toolName && chatTools[toolName as keyof typeof chatTools]) {
    const tool = chatTools[toolName as keyof typeof chatTools];

    // Execute tool manually
    const result = await tool.execute(toolArgs, { orgId, userId });

    return successResponse({
      toolName,
      result,
    });
  }

  // Or use AI to decide which tool to use
  const result = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content: query }],
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 1, // Single step - just pick a tool
  });

  return successResponse({
    response: result.text,
    toolsUsed: result.toolCalls?.map((call) => call.toolName),
  });
});

/**
 * EXAMPLE 4: Streaming with Source Citations
 *
 * Best for: Chat UIs that need to display sources in real-time
 * Uses: streamText with onStepFinish callback
 */
export const streamingWithCitations = async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  const sources: any[] = [];

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 5,
    onStepFinish: async ({ stepType, toolCalls, toolResults }) => {
      // Collect sources from searchRecordings tool
      if (toolResults) {
        toolResults.forEach((result) => {
          if (result.toolName === 'searchRecordings' && result.result.sources) {
            sources.push(...result.result.sources);
          }
        });
      }
    },
    onFinish: async ({ text, usage }) => {
      console.log('[Chat] Response completed:', {
        orgId,
        sources: sources.length,
        tokens: usage.totalTokens,
      });
      // TODO: Save to database with sources
    },
  });

  return result.toDataStreamResponse({
    headers: {
      'X-Sources': JSON.stringify(sources),
    },
  });
};

/**
 * EXAMPLE 5: Multi-Step Reasoning with Progress Updates
 *
 * Best for: Complex queries that require multiple tool invocations
 * Uses: streamText with extended maxSteps and step tracking
 */
export const multiStepReasoning = async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const { messages } = await request.json();

  let stepCount = 0;

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
    maxSteps: 10, // Allow complex multi-step reasoning
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'chat-tools-multi-step',
    },
    onStepFinish: async ({ stepType, toolCalls, toolResults, text }) => {
      stepCount++;
      console.log(`[Chat] Step ${stepCount} completed:`, {
        stepType,
        toolsUsed: toolCalls?.map((call) => call.toolName),
        hasText: !!text,
      });
    },
  });

  return result.toDataStreamResponse();
};

/**
 * EXAMPLE 6: Hybrid Approach with RAG Fallback
 *
 * Best for: Combining Vercel AI SDK tools with existing RAG implementation
 * Uses: Both chatTools and legacy RAG functions
 */
import { injectRAGContext } from './chat-rag-integration';

export const hybridRAGWithTools = async (request: NextRequest) => {
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
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
    system: systemPrompt,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
};

/**
 * EXAMPLE 7: Conversation History with Tool Results
 *
 * Best for: Multi-turn conversations that preserve tool context
 * Uses: Proper message history with tool results
 */
import { createClient } from '@/lib/supabase/server';

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
    messages,
    tools: chatTools,
    toolContext: { orgId, userId },
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
        tool_invocations: result.toolCalls,
      },
    ]);
  }

  return successResponse({
    conversationId,
    response: result.text,
    toolCalls: result.toolCalls,
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
