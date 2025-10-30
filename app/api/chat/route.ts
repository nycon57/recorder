/**
 * Chat API with AI Elements (UI Message Streaming)
 *
 * Handles chat requests with:
 * - Real-time streaming via streamText()
 * - RAG (Retrieval Augmented Generation) with sources
 * - Reasoning display for complex queries
 * - Message persistence to Supabase
 */

import { streamText, UIMessage, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';

import { requireOrg } from '@/lib/utils/api';
import { retrieveContext } from '@/lib/services/rag-google';
import { preprocessQuery } from '@/lib/services/query-preprocessor';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { routeQuery, getRetrievalConfig, explainRoute, type QueryRoute } from '@/lib/services/query-router';
import { isCohereConfigured } from '@/lib/services/reranking';
import {
  executeSearchRecordings,
  executeGetDocument,
  executeGetTranscript,
  executeGetRecordingMetadata,
  executeListRecordings,
  toolDescriptions,
} from '@/lib/services/chat-tools';
import {
  searchRecordingsInputSchema,
  getDocumentInputSchema,
  getTranscriptInputSchema,
  getRecordingMetadataInputSchema,
  listRecordingsInputSchema,
} from '@/lib/validations/chat';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Configuration flags (can be overridden via env vars)
const ENABLE_AGENTIC_RAG = process.env.ENABLE_AGENTIC_RAG !== 'false';
const ENABLE_RERANKING = process.env.ENABLE_RERANKING !== 'false';
const ENABLE_CHAT_TOOLS = process.env.ENABLE_CHAT_TOOLS !== 'false';

// Store sources temporarily (keyed by timestamp for retrieval)
// This is a workaround since AI SDK v5 doesn't support custom data in streaming responses
const sourcesCache = new Map<string, any[]>();

/**
 * GET /api/chat - Retrieve sources by cache key
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cacheKey = url.searchParams.get('sourcesKey');

  if (!cacheKey) {
    return new Response(JSON.stringify({ sources: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sources = sourcesCache.get(cacheKey) || [];
  // Delete after retrieval to free memory
  sourcesCache.delete(cacheKey);

  return new Response(JSON.stringify({ sources }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await requireOrg();
    console.log('[Chat API] Request from user:', { orgId, userId });

    const body = await req.json();
    const {
      messages,
      recordingIds,
    }: {
      messages: UIMessage[];
      recordingIds?: string[];
    } = body;

    // Get the last user message for RAG
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    let userQuery = '';

    console.log('[Chat API] Last user message:', JSON.stringify(lastUserMessage, null, 2));

    if (lastUserMessage) {
      // UIMessage v2 format: message has 'parts' array
      if (Array.isArray((lastUserMessage as any).parts)) {
        userQuery = (lastUserMessage as any).parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      }
      // UIMessage v2 format: message has 'text' property directly
      else if (typeof (lastUserMessage as any).text === 'string') {
        userQuery = (lastUserMessage as any).text;
      }
      // Legacy format: message.content as string
      else if (typeof (lastUserMessage as any).content === 'string') {
        userQuery = (lastUserMessage as any).content;
      }
      // Message parts format (old API)
      else if (Array.isArray((lastUserMessage as any).content)) {
        userQuery = (lastUserMessage as any).content
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      }
    }

    console.log('[Chat API] Parsed user query:', userQuery);

    // Preprocess query to extract topics from meta-questions
    const preprocessed = preprocessQuery(userQuery);
    const searchableQuery = preprocessed.processedQuery;

    if (preprocessed.wasTransformed) {
      console.log('[Chat API] Query preprocessed:', {
        original: preprocessed.originalQuery,
        processed: preprocessed.processedQuery,
        method: preprocessed.transformation,
      });
    }

    // Retrieve RAG context if there's a query
    let ragContext;
    let route: QueryRoute | undefined;

    if (userQuery) {
      console.log('[Chat API] Retrieving RAG context for org:', orgId);

      // Get recording count and summaries status for routing
      const { count: recordingsCount } = await supabaseAdmin
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'completed');

      const { count: summariesCount } = await supabaseAdmin
        .from('recording_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);

      const actualRecordingsCount = recordingsCount || 0;
      const hasSummaries = (summariesCount || 0) > 0;
      const hasReranking = ENABLE_RERANKING && isCohereConfigured();

      console.log('[Chat API] Context:', {
        recordingsCount: actualRecordingsCount,
        hasSummaries,
        hasReranking,
        agenticEnabled: ENABLE_AGENTIC_RAG,
      });

      // Route query using the SEARCHABLE query (preprocessed if needed)
      // This ensures meta-questions like "Do I have recordings about X?" are treated as content searches
      route = await routeQuery(searchableQuery, {
        recordingsCount: actualRecordingsCount,
        hasSummaries,
        hasReranking,
      });

      console.log('[Chat API] Query routing:');
      console.log(explainRoute(route));

      // IMPORTANT: If query was preprocessed from a meta-question, force standard_search
      // Meta-questions like "Do I have recordings about X?" should always search content, not list recordings
      if (preprocessed.wasTransformed && (route.strategy === 'direct_listing' || route.strategy === 'topic_overview')) {
        console.log('[Chat API] Overriding route: Meta-question preprocessed, forcing standard_search');
        route = {
          strategy: 'standard_search',
          intent: route.intent,
          reasoning: 'Meta-question preprocessed to content query. Using standard vector search.',
          config: {
            useAgentic: false,
            useHierarchical: false,
            useReranking: hasReranking,
            maxChunks: 10,
            threshold: 0.7,
          },
        };
      }

      // For direct_listing or topic_overview strategies, let tools handle it
      if (route.strategy === 'direct_listing' || route.strategy === 'topic_overview') {
        console.log('[Chat API] Using tool-based discovery strategy');
        // Don't retrieve RAG context for these - let the LLM use tools instead
      } else {
        // Get retrieval configuration from route
        const retrievalConfig = getRetrievalConfig(route);

        // Use searchable query for RAG context retrieval
        ragContext = await retrieveContext(searchableQuery, orgId, {
          ...retrievalConfig,
          recordingIds,
          // Force disable agentic if globally disabled
          useAgentic: ENABLE_AGENTIC_RAG && retrievalConfig.useAgentic,
          rerank: ENABLE_RERANKING && retrievalConfig.rerank,
        });

        console.log('[Chat API] RAG context retrieved:', {
          sourcesFound: ragContext?.sources?.length || 0,
          totalChunks: ragContext?.totalChunks || 0,
          strategy: route.strategy,
          agenticUsed: ragContext?.agenticMetadata !== undefined,
        });
      }
    }

    // Build system prompt based on strategy
    let systemPrompt: string;

    if (route?.strategy === 'direct_listing' || route?.strategy === 'topic_overview') {
      // For exploratory queries, instruct LLM to use tools
      systemPrompt = `You are a helpful AI assistant that helps users explore and discover content in their recordings library.

**Your Role:**
When users ask exploratory questions like "what can you help me with?" or "what topics do you know about?", you should:

1. **Use the listRecordings tool** to browse their available recordings
2. **Organize findings by topic or category** when presenting results
3. **Be conversational and helpful** in explaining what's available

**Guidelines:**
- Call listRecordings to see what recordings are available
- Group related recordings by topic (e.g., "Cloud Infrastructure", "Real Estate", "Authentication")
- Present information in an organized, easy-to-scan format
- Use emojis (📚, 🏠, 💼, etc.) to make topics more visually distinctive
- Offer to search for specific topics if the user wants more details

**Format Example:**
\`\`\`
Based on your recordings, I can help you with:

📚 **Topic 1** (X recordings, Y minutes)
- Key point 1
- Key point 2

🏠 **Topic 2** (X recordings, Y minutes)
- Key point 1
- Key point 2

What would you like to know more about?
\`\`\`

Remember: You're helping users discover what knowledge is available in their library!`;
    } else if (ragContext) {
      // For standard queries with RAG context
      systemPrompt = `You are a helpful AI assistant. You MUST answer questions using ONLY the information provided in the Context section below. Do NOT use any external knowledge or make assumptions.

**CRITICAL RULES:**
1. ONLY use information explicitly stated in the Context below
2. If the answer is not in the Context, respond with: "I don't have information about that in your recordings."
3. NEVER mention products, platforms, or concepts not present in the Context
4. Cite the specific recording title when answering
5. If you're uncertain, say "The context doesn't provide enough information to answer this."

**SPECIAL RULE FOR META-QUESTIONS:**
When the user asks whether you have recordings about a topic (e.g., "Do I have recordings about X?", "Do you know about Y?", "What do you have on Z?"):
- If Context is provided below about that topic, respond with: "Yes, I have recordings about [topic]:" followed by a summary of what's in the recordings
- If no Context is provided, respond with: "I don't have any recordings about that topic."
- The presence of Context means recordings exist - don't say you "don't have information" when Context is clearly provided

**CITATION FORMAT:**
When referencing sources from the Context, use ONLY the citation numbers in brackets, like [1], [2], [3].
DO NOT include the recording title before the citation number.
Example: "The login process involves navigating to the URL [1] and entering credentials [2]."
NOT: "The login process involves navigating to the URL (Recording Title [1]) and entering credentials (Recording Title [2])."

**Context from User's Recordings:**
${ragContext.context}

**Your Task:**
Answer the user's question using ONLY the above Context. Do not invent or assume anything. Remember: if Context exists about the topic they're asking about, that means recordings exist - confirm this and summarize them. Use citation numbers [1], [2], etc. to reference sources.`;
    } else {
      // No recordings or no route determined
      systemPrompt = 'You are a helpful AI assistant. The user has no recordings yet. Let them know they need to create recordings first before you can answer questions about them.';
    }

    // Log the actual context being sent to the LLM (for debugging)
    if (ragContext && ragContext.sources && Array.isArray(ragContext.sources)) {
      console.log('[Chat API] ===== RAG CONTEXT DEBUG =====');
      console.log('[Chat API] Sources:');
      ragContext.sources.forEach((source, idx) => {
        console.log(`  [${idx + 1}] ${source.recordingTitle}`);
        console.log(`      Recording ID: ${source.recordingId}`);
        console.log(`      Chunk: ${source.chunkText.substring(0, 100)}...`);
        console.log(`      Similarity: ${source.similarity}`);
      });
      console.log('[Chat API] Full context length:', ragContext.context.length);
      console.log('[Chat API] Context preview:', ragContext.context.substring(0, 500));
      console.log('[Chat API] ===========================');
    } else if (ragContext) {
      console.log('[Chat API] RAG context exists but sources is not an array:', typeof ragContext.sources);
    }

    // Create tools with bound context
    // Pass Zod schemas directly - AI SDK v5 handles conversion for Gemini
    const toolsWithContext = ENABLE_CHAT_TOOLS ? {
      searchRecordings: tool({
        description: toolDescriptions.searchRecordings,
        inputSchema: searchRecordingsInputSchema,
        execute: async (args: any) => {
          return await executeSearchRecordings(args, { orgId, userId });
        },
      }),
      getDocument: tool({
        description: toolDescriptions.getDocument,
        inputSchema: getDocumentInputSchema,
        execute: async (args: any) => {
          return await executeGetDocument(args, { orgId, userId });
        },
      }),
      getTranscript: tool({
        description: toolDescriptions.getTranscript,
        inputSchema: getTranscriptInputSchema,
        execute: async (args: any) => {
          return await executeGetTranscript(args, { orgId, userId });
        },
      }),
      getRecordingMetadata: tool({
        description: toolDescriptions.getRecordingMetadata,
        inputSchema: getRecordingMetadataInputSchema,
        execute: async (args: any) => {
          return await executeGetRecordingMetadata(args, { orgId, userId });
        },
      }),
      listRecordings: tool({
        description: toolDescriptions.listRecordings,
        inputSchema: listRecordingsInputSchema,
        execute: async (args: any) => {
          return await executeListRecordings(args, { orgId, userId });
        },
      }),
    } : undefined;

    // Determine if this is an exploratory query that should use tools
    const isExploratoryQuery = route?.strategy === 'direct_listing' || route?.strategy === 'topic_overview';

    console.log('[Chat API] Streaming configuration:', {
      strategy: route?.strategy,
      isExploratoryQuery,
      toolsEnabled: !!toolsWithContext,
      toolChoice: isExploratoryQuery ? 'auto (exploratory)' : 'auto',
    });

    // Convert messages to model format manually
    // Handle different message formats from the client
    const modelMessages = messages.map((msg: any) => {
      let content = '';

      // Extract text content from various formats
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (typeof msg.text === 'string') {
        content = msg.text;
      } else if (Array.isArray(msg.parts)) {
        content = msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join(' ');
      }

      return {
        role: msg.role,
        content,
      };
    });

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: modelMessages,
      temperature: 0.7,
      maxOutputTokens: 4096,
      // Enable tools with bound context
      tools: toolsWithContext,
      // CRITICAL: Use 'auto' instead of 'required' to allow continuation after tool calls
      // When set to 'required', Gemini stops after the tool call with finishReason: 'tool-calls'
      // and doesn't continue to step 2 to generate a response with the tool results.
      // With 'auto', the model can call tools when needed AND continue to generate the final response.
      toolChoice: 'auto',
      // AI SDK v5: Use stopWhen instead of deprecated maxSteps
      // Allow up to 5 steps for multi-turn tool calling
      // Step 1: Model calls tool (if needed)
      // Step 2: Tool executes and result is passed back
      // Step 3+: Model generates response using tool results (or makes additional tool calls)
      stopWhen: stepCountIs(5),
      // Note: experimental_toolCallStreaming is removed in v5, tool call streaming is now default
      onStepFinish: async (step) => {
        console.log('[Chat API] Step finished:', {
          finishReason: step.finishReason,
          toolCallsCount: step.toolCalls?.length || 0,
          toolResultsCount: step.toolResults?.length || 0,
          hasText: !!step.text,
          textLength: step.text?.length || 0,
          usage: step.usage,
        });

        // Log tool calls for debugging
        if (step.toolCalls && step.toolCalls.length > 0) {
          console.log('[Chat API] Tool calls in this step:');
          step.toolCalls.forEach((toolCall, idx) => {
            console.log(`  [${idx + 1}] ${toolCall.toolName}:`,
              'args' in toolCall ? JSON.stringify(toolCall.args, null, 2) : '(streaming)'
            );
          });
        }

        // Log tool results for debugging
        if (step.toolResults && step.toolResults.length > 0) {
          console.log('[Chat API] Tool results in this step:');
          step.toolResults.forEach((result, idx) => {
            const resultData = 'result' in result ? result.result : '(no result)';
            console.log(`  [${idx + 1}] ${result.toolName}:`,
              typeof resultData === 'string'
                ? resultData.substring(0, 200)
                : JSON.stringify(resultData, null, 2).substring(0, 200)
            );
          });
        }
      },
      onFinish: async (completion) => {
        const totalSteps = completion.steps?.length || 0;
        console.log('[Chat API] ===== STREAM COMPLETE =====');
        console.log('[Chat API] Final summary:', {
          finishReason: completion.finishReason,
          totalSteps,
          totalTokens: completion.usage?.totalTokens || 0,
          inputTokens: completion.usage?.inputTokens || 0,
          outputTokens: completion.usage?.outputTokens || 0,
          hasText: !!completion.text,
          textLength: completion.text?.length || 0,
        });

        // Log each step summary
        if (completion.steps) {
          console.log('[Chat API] Step-by-step summary:');
          completion.steps.forEach((step, idx) => {
            console.log(`  Step ${idx + 1}:`, {
              finishReason: step.finishReason,
              toolCalls: step.toolCalls?.length || 0,
              toolResults: step.toolResults?.length || 0,
              hasText: !!step.text,
            });
          });
        }
        console.log('[Chat API] ===========================');
      },
    });

    // Return streaming response (AI SDK v5) with sources metadata
    // Convert sources to SourceCitation format for frontend
    const sourceCitations = ragContext?.sources?.map((source, index) => ({
      id: `source-${index + 1}`,
      recordingId: source.recordingId,
      title: source.recordingTitle,
      url: source.url || `/library/${source.recordingId}`,
      snippet: source.chunkText.substring(0, 200),
      relevanceScore: source.similarity,
      timestamp: source.timestampRange || (source.timestamp ? `${Math.floor(source.timestamp / 60)}:${String(Math.floor(source.timestamp % 60)).padStart(2, '0')}` : undefined),
      metadata: {
        chunkId: source.chunkId,
        hasVisualContext: source.hasVisualContext,
        contentType: source.contentType,
      },
    })) || [];

    console.log('[Chat API] Attaching sources to response:', {
      sourcesCount: sourceCitations.length,
      firstSourceUrl: sourceCitations[0]?.url,
    });

    // Store sources in cache using user message ID as key
    // This allows the frontend to fetch sources after the assistant response completes
    const cacheKey = lastUserMessage?.id || Date.now().toString();
    sourcesCache.set(cacheKey, sourceCitations);
    console.log('[Chat API] Stored sources with cache key:', cacheKey);

    // Clean up old entries (keep last 10)
    if (sourcesCache.size > 10) {
      const firstKey = sourcesCache.keys().next().value;
      sourcesCache.delete(firstKey);
    }

    // Return streaming response with cache key in header
    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Sources-Cache-Key', cacheKey);

    return response;
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Failed to generate response',
          code: 'GENERATION_ERROR',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Build system prompt with RAG context
 */
function buildSystemPrompt(ragContext: string): string {
  return `You are an AI assistant helping users understand their recorded content.

## Your Role

You help users:
- Search through their recordings and transcripts
- Find specific information quickly
- Understand complex topics from their recordings
- Get summaries and insights
- Navigate timestamps and content

## Context from Recordings

The following context has been retrieved from the user's recordings based on their query:

${ragContext}

## Guidelines

1. **Use the provided context**: Base your answers on the context above
2. **Cite sources**: Reference specific recordings by title when answering
3. **Be precise**: Include timestamps when available
4. **Use tools**: Call tools to get more information when needed:
   - \`searchRecordings\`: Find relevant content across all recordings
   - \`getDocument\`: Retrieve full document content
   - \`getTranscript\`: Get detailed transcript with timestamps
   - \`getRecordingMetadata\`: Get recording details
   - \`listRecordings\`: Browse available recordings
5. **Multi-step reasoning**: Break complex questions into steps, calling tools as needed
6. **Be helpful**: If the context doesn't contain the answer, explain what you found and suggest alternative searches

## Output Format

- Use markdown for formatting
- Include timestamp links: [00:32](recording-url#t=32)
- Quote relevant excerpts when useful
- Provide clear, concise answers
- Suggest follow-up questions when appropriate

Remember: You're helping users get maximum value from their recorded content!`;
}

/**
 * Create new conversation
 */
async function createConversation(
  orgId: string,
  userId: string
): Promise<string> {
  // Use admin client to bypass RLS since API route already validates auth
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      org_id: orgId,
      user_id: userId,
      title: 'New Conversation',
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'web',
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Chat API] Failed to create conversation:', error);
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data.id;
}

/**
 * Save user message to database
 */
async function saveUserMessage(
  conversationId: string,
  content: string
): Promise<void> {
  // Use admin client to bypass RLS since API route already validates auth
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: { type: 'text', text: content }, // AI SDK format
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

  if (error) {
    throw new Error(`Failed to save user message: ${error.message}`);
  }
}

/**
 * Save assistant message to database
 */
async function saveAssistantMessage(
  conversationId: string,
  content: string,
  metadata: {
    sources: any[];
    tokensUsed: number;
    latencyMs: number;
    finishReason: string;
    toolCallCount: number;
  }
): Promise<void> {
  // Use admin client to bypass RLS since API route already validates auth
  const { error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: { type: 'text', text: content }, // AI SDK format
      sources: metadata.sources,
      metadata: {
        tokensUsed: metadata.tokensUsed,
        latencyMs: metadata.latencyMs,
        finishReason: metadata.finishReason,
        toolCallCount: metadata.toolCallCount,
        timestamp: new Date().toISOString(),
      },
    });

  if (error) {
    throw new Error(`Failed to save assistant message: ${error.message}`);
  }
}
