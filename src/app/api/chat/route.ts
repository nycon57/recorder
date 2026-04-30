/**
 * Chat API with AI Elements (UI Message Streaming)
 *
 * Handles chat requests with:
 * - Real-time streaming via streamText()
 * - Compiled-memory answer context with sources
 * - Reasoning display for complex queries
 * - Message persistence to Supabase
 */

import { streamText, UIMessage, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { checkBotId } from 'botid/server';
import { after } from 'next/server';

import { requireOrg } from '@/lib/utils/api';
import {
  resolveCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability,
  type CompiledMemoryAnswerContext,
} from '@/lib/services/compiled-memory-answer-context';
import { preprocessQuery } from '@/lib/services/query-preprocessor';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  executeSearchRecordings,
  executeGetDocument,
  executeGetTranscript,
  executeGetRecordingMetadata,
  executeListRecordings,
  executeSearchConcepts,
  executeGetConceptDetails,
  executeExploreKnowledgeGraph,
  toolDescriptions,
} from '@/lib/services/chat-tools';
import {
  searchRecordingsInputSchema,
  getDocumentInputSchema,
  getTranscriptInputSchema,
  getRecordingMetadataInputSchema,
  listRecordingsInputSchema,
  searchConceptsInputSchema,
  getConceptDetailsInputSchema,
  exploreKnowledgeGraphInputSchema,
} from '@/lib/validations/chat';
import { searchMonitor } from '@/lib/services/search-monitoring';
import {
  buildKnowledgeChatTelemetry,
  recordKnowledgeTelemetryEvent,
  type KnowledgeTelemetryFailureClass,
  type KnowledgeChatTelemetryPayload,
} from '@/lib/services/knowledge-telemetry';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Force dynamic rendering to enable streaming
export const dynamic = 'force-dynamic';

// Configuration flags (can be overridden via env vars)
const ENABLE_CHAT_TOOLS = process.env.ENABLE_CHAT_TOOLS !== 'false';
const ENABLE_SEARCH_MONITORING = process.env.ENABLE_SEARCH_MONITORING === 'true';

type CachedSourcesEntry = {
  sources: unknown[];
  orgId: string;
  userId: string;
  timestamp: number;
  expiresAt: number;
};

// Store sources temporarily (keyed by opaque server-generated keys)
// This is a workaround since AI SDK v5 doesn't support custom data in streaming responses
const sourcesCache = new Map<string, CachedSourcesEntry>();

// Cache TTL: 5 minutes (enough time for navigation between chat and detail pages)
const SOURCES_CACHE_TTL = 5 * 60 * 1000;

function createQueryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSourcesCacheKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of sourcesCache.entries()) {
    if (entry.expiresAt <= now) {
      sourcesCache.delete(key);
    }
  }
}

export function __setSourcesCacheEntryForTest(
  key: string,
  entry: Omit<CachedSourcesEntry, 'timestamp' | 'expiresAt'> & {
    timestamp?: number;
    expiresAt?: number;
  },
) {
  sourcesCache.set(key, {
    ...entry,
    timestamp: entry.timestamp ?? Date.now(),
    expiresAt: entry.expiresAt ?? Date.now() + SOURCES_CACHE_TTL,
  });
}

export function __clearSourcesCacheForTest() {
  sourcesCache.clear();
}

/**
 * GET /api/chat - Retrieve sources by cache key
 */
export async function GET(req: Request) {
  try {
    const { orgId, userId } = await requireOrg();
    const url = new URL(req.url);
    const cacheKey = url.searchParams.get('sourcesKey');

    if (!cacheKey) {
      return new Response(JSON.stringify({ sources: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    cleanupExpiredCache();

    const cacheEntry = sourcesCache.get(cacheKey);

    if (!cacheEntry) {
      return new Response(JSON.stringify({ sources: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (cacheEntry.orgId !== orgId || cacheEntry.userId !== userId) {
      return new Response(JSON.stringify({ sources: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sources: cacheEntry.sources }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (error.message === 'Organization context required') {
        return new Response(JSON.stringify({ error: 'Organization context required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Failed to retrieve sources' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  // Declare variables in outer scope so they're accessible in error handler
  let queryId: string | undefined;
  let requestStartTime: number | undefined;
  let chatTelemetry: KnowledgeChatTelemetryPayload | null = null;

  try {
    const { orgId, userId } = await requireOrg();
    console.log('[Chat API] Request from user:', { orgId, userId });

    // Bot protection - verify request is from a legitimate browser
    const verification = await checkBotId();
    if (verification.isBot) {
      return new Response(
        JSON.stringify({ error: { message: 'Bot detected', code: 'BOT_DETECTED' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      messages,
      recordingIds,
    }: {
      messages: UIMessage[];
      recordingIds?: string[];
    } = body;

    // Initialize monitoring if enabled
    queryId = createQueryId();
    requestStartTime = Date.now();

    // Get the last user message for compiled-memory retrieval.
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

    // Start search monitoring if enabled
    if (ENABLE_SEARCH_MONITORING && userQuery) {
      searchMonitor.startSearch(queryId, userQuery, orgId, userId);
    }

    // Preprocess query to extract topics from meta-questions
    const preprocessed = await preprocessQuery(userQuery);
    const searchableQuery = preprocessed.processedQuery;

    if (preprocessed.wasTransformed) {
      console.log('[Chat API] Query preprocessed:', {
        original: preprocessed.originalQuery,
        processed: preprocessed.processedQuery,
        method: preprocessed.transformation,
      });
    }

    // Retrieve answer context if there's a query
    let compiledAnswerContext: CompiledMemoryAnswerContext | undefined;
    let retrievalAttempts = 0;
    let selectedStrategy = 'none';
    let actualRecordingsCount = 0;
    let answerMode: 'compiled-memory' | 'tool-discovery' | 'empty' = 'empty';
    let isMetaDiscoveryQuery = false;
    const isScopedDiscoveryMode = Array.isArray(recordingIds) && recordingIds.length > 0;
    let useToolDiscovery = false;
    let sharedVendorTelemetry = summarizeCompiledMemoryAnswerObservability(undefined);
    let telemetryFailureClass: KnowledgeTelemetryFailureClass = 'none';

    if (userQuery) {
      console.log('[Chat API] Retrieving answer context for org:', orgId);

      // Keep a lightweight count for empty-state messaging. Do not use this
      // count to implicitly route normal chat answers into raw-evidence mode.
      const { count: recordingsCount } = await supabaseAdmin
        .from('content')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'completed');

      actualRecordingsCount = recordingsCount || 0;

      isMetaDiscoveryQuery =
        preprocessed.wasTransformed &&
        preprocessed.transformation === 'meta-question-extraction-and-expansion';
      useToolDiscovery = isMetaDiscoveryQuery || isScopedDiscoveryMode;

      if (useToolDiscovery || isScopedDiscoveryMode) {
        answerMode = 'tool-discovery';
        selectedStrategy = isScopedDiscoveryMode
          ? 'tool_discovery_scoped'
          : isMetaDiscoveryQuery
            ? 'tool_discovery_meta'
            : 'tool_discovery';
        if (ENABLE_SEARCH_MONITORING && userQuery) {
          searchMonitor.updateConfig(queryId, {
            strategy: selectedStrategy,
            threshold: undefined,
            useAgentic: false,
          });
        }
        console.log('[Chat API] Using tool-based discovery strategy:', {
          selectedStrategy,
          scopedContentIds: isScopedDiscoveryMode ? recordingIds : undefined,
        });
      } else {
        retrievalAttempts = 1;
        answerMode = 'compiled-memory';
        selectedStrategy = 'compiled_memory';

        if (ENABLE_SEARCH_MONITORING && userQuery) {
          searchMonitor.updateConfig(queryId, {
            strategy: selectedStrategy,
            threshold: undefined,
            useAgentic: false,
          });
        }

        compiledAnswerContext = await resolveCompiledMemoryAnswerContext({
          orgId,
          userId,
          question: searchableQuery,
        });
        sharedVendorTelemetry =
          summarizeCompiledMemoryAnswerObservability(compiledAnswerContext);

        console.log('[Chat API] Compiled memory retrieval:', {
          sourcesFound: compiledAnswerContext.sources.length,
          priorTopics: compiledAnswerContext.priorTopics.length,
        });
      }
    }

    // Build system prompt based on strategy
    let systemPrompt: string;

    if (useToolDiscovery) {
      systemPrompt = `You are a helpful AI assistant that helps users explore and discover content in their recordings library.

**Important mode boundary:**
- The canonical answer layer is compiled memory.
- Raw transcript/document snippets are DISCOVERY evidence only.
- Use raw evidence tools only when the user is explicitly browsing, auditing, or asking whether recordings mention something.

**Your Role:**
When users ask exploratory questions like "what can you help me with?", "what topics do you know about?", or "do I have recordings about X?", you should:

1. **Use the listRecordings tool** to browse their available recordings
2. **Use the exploreKnowledgeGraph tool** to see concepts and topics across their content
3. **Use the searchRecordings tool** when the user explicitly wants raw evidence, transcript snippets, or confirmation that recordings mention a topic
4. **Organize findings by topic or category** when presenting results
5. **Be conversational and helpful** in explaining what's available

**Guidelines:**
- Call listRecordings to see what recordings are available
- Call exploreKnowledgeGraph to discover key concepts, tools, and topics mentioned across recordings
- Call searchRecordings when the user wants discovery evidence from transcripts/documents instead of compiled knowledge
- Group related recordings by topic (e.g., "Cloud Infrastructure", "Real Estate", "Authentication")
- Present information in an organized, easy-to-scan format
- Use emojis to make topics more visually distinctive
- Offer to search for specific topics if the user wants more details

**Knowledge Graph Tools:**
You have access to a knowledge graph that tracks concepts (tools, processes, people, organizations, technical terms) mentioned across content:

- Use **searchConcepts** when users ask about topics, technologies, or concepts ("What tools do we use?", "Tell me about React mentions")
- Use **getConceptDetails** to get more information about a specific concept after finding it
- Use **exploreKnowledgeGraph** when users want an overview of their knowledge base ("What's in my knowledge base?", "Show me the main topics")

When discussing concepts, you can reference related content and show how concepts connect across different recordings.

**Format Example:**
\`\`\`
Based on your recordings, I can help you with:

**Topic 1** (X recordings, Y minutes)
- Key point 1
- Key point 2

**Topic 2** (X recordings, Y minutes)
- Key point 1
- Key point 2

What would you like to know more about?
\`\`\`

Remember: You're helping users discover what knowledge is available in their library!`;
    } else if (answerMode === 'compiled-memory' && compiledAnswerContext && compiledAnswerContext.sources.length > 0) {
      const priorTopicInstruction =
        compiledAnswerContext.priorTopics.length > 0
          ? `\n**USER MEMORY:**\nThe user has previously been shown information about: ${compiledAnswerContext.priorTopics.join(', ')}. Avoid repeating basics when the answer already covers those topics.\n`
          : '';

      systemPrompt = `You are a helpful AI assistant. Answer the user's question using ONLY the compiled memory below.

**CRITICAL RULES:**
1. ONLY use information explicitly stated in the compiled memory below
2. Compiled memory is the canonical answer layer for this chat
3. If sources conflict, prioritize YOUR TEAM'S KNOWLEDGE over VENDOR TRAINING and VENDOR KNOWLEDGE
4. Do NOT fall back to raw transcript or document evidence unless the user explicitly asks to search the raw evidence
5. If the answer is not in the compiled memory, respond with: "I don't have compiled knowledge about that yet. I can search the raw recordings if you'd like."
6. Cite source numbers for every factual claim and keep citations tied to the exact supporting source
7. NEVER mention products, platforms, or concepts not present in the compiled memory
8. Answer questions directly and naturally based on what they asked

**CITATION FORMAT:**
When referencing sources from the Context, use ONLY the citation numbers in brackets, like [1], [2], [3].
DO NOT include the recording title before the citation number.

Example: "The login process involves navigating to the URL [1] and entering credentials [2]."
NOT: "The login process involves navigating to the URL (Recording Title [1]) and entering credentials (Recording Title [2])."

${priorTopicInstruction}
**COMPILED MEMORY:**
${compiledAnswerContext.context}

**Your Task:**
Answer the user's question using ONLY the compiled memory above. Do not invent or assume anything. Use citation numbers [1], [2], etc. to reference sources.`;
    } else if (actualRecordingsCount > 0) {
      systemPrompt = `You are a helpful AI assistant. The organization has recordings, but I could not find compiled knowledge for this question yet.

Tell the user that you don't have compiled knowledge about that yet and offer to search the raw recordings if they want discovery evidence, transcript snippets, or document excerpts. Do not guess.`;
    } else {
      systemPrompt = 'You are a helpful AI assistant. The user has no recordings yet. Let them know they need to create recordings first before you can answer questions about them.';
    }

    if (isScopedDiscoveryMode) {
      systemPrompt += `\n\nSCOPED RECORDING MODE:
- The user selected specific recording IDs. Stay within that selected content.
- Use searchRecordings only; it is constrained to compiled Wiki pages linked to the selected recording IDs.
- Do not browse, summarize, or infer from the broader organization library.`;
    }

    if (answerMode === 'compiled-memory' && compiledAnswerContext) {
      console.log('[Chat API] ===== COMPILED MEMORY DEBUG =====');
      compiledAnswerContext.sources.forEach((source, idx) => {
        console.log(`  [${idx + 1}] ${source.title}`);
        console.log(`      Layer: ${source.layer}`);
        console.log(`      Preview: ${source.excerpt.substring(0, 100)}...`);
      });
      console.log('[Chat API] Full context length:', compiledAnswerContext.context.length);
      console.log('[Chat API] Context preview:', compiledAnswerContext.context.substring(0, 500));
      console.log('[Chat API] ===============================');
    }

    // Create tools with bound context
    // Pass Zod schemas directly - AI SDK v5 handles conversion for Gemini
    const scopedSearchRecordingsTool = {
      searchRecordings: tool({
        description: toolDescriptions.searchRecordings,
        inputSchema: searchRecordingsInputSchema,
        execute: async (args: any) => {
          return await executeSearchRecordings(args, {
            orgId,
            userId,
            contentIds: isScopedDiscoveryMode ? recordingIds : undefined,
          });
        },
      }),
    };

    const unscopedDiscoveryTools = {
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
      // Knowledge Graph Tools
      searchConcepts: tool({
        description: toolDescriptions.searchConcepts,
        inputSchema: searchConceptsInputSchema,
        execute: async (args: any) => {
          return await executeSearchConcepts(args, { orgId, userId });
        },
      }),
      getConceptDetails: tool({
        description: toolDescriptions.getConceptDetails,
        inputSchema: getConceptDetailsInputSchema,
        execute: async (args: any) => {
          return await executeGetConceptDetails(args, { orgId, userId });
        },
      }),
      exploreKnowledgeGraph: tool({
        description: toolDescriptions.exploreKnowledgeGraph,
        inputSchema: exploreKnowledgeGraphInputSchema,
        execute: async (args: any) => {
          return await executeExploreKnowledgeGraph(args, { orgId, userId });
        },
      }),
    };

    const toolsWithContext =
      ENABLE_CHAT_TOOLS && useToolDiscovery
        ? {
            ...scopedSearchRecordingsTool,
            ...(isScopedDiscoveryMode ? {} : unscopedDiscoveryTools),
          }
        : undefined;

    const shouldPreferTools = useToolDiscovery;

    console.log('[Chat API] Streaming configuration:', {
      strategy: selectedStrategy,
      answerMode,
      shouldPreferTools,
      toolsEnabled: !!toolsWithContext,
      toolChoice: shouldPreferTools ? 'auto (explicit discovery)' : 'auto (compiled-memory default)',
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

    console.log('[Chat API] ===== STARTING STREAM =====');
    console.log('[Chat API] Stream configuration:', {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxOutputTokens: 4096,
      hasTools: !!toolsWithContext,
      messageCount: modelMessages.length,
      systemPromptLength: systemPrompt.length,
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
      onChunk: ({ chunk }) => {
        // Gate logging behind debug flag to avoid high-volume production logs
        if (process.env.DEBUG_CHAT_STREAM === 'true') {
          console.log('[Chat API] 🔥 CHUNK RECEIVED:', {
            type: chunk.type,
            deltaLength: chunk.type === 'text-delta' ? chunk.text?.length : 0,
            textPreview: chunk.type === 'text-delta' ? chunk.text?.substring(0, 50) : '',
          });
        }
      },
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
            if (!toolCall) return;
            console.log(`  [${idx + 1}] ${toolCall.toolName}:`,
              'args' in toolCall ? JSON.stringify(toolCall.args, null, 2) : '(streaming)'
            );
          });
        }

        // Log tool results for debugging
        if (step.toolResults && step.toolResults.length > 0) {
          console.log('[Chat API] Tool results in this step:');
          step.toolResults.forEach((result, idx) => {
            if (!result) return;
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

    const sourceCitations =
      answerMode === 'compiled-memory'
        ? compiledAnswerContext?.sources?.map((source, index) => ({
            id: `source-${index + 1}`,
            recordingId: source.sourceId,
            title: source.title,
            url: source.url || '/dashboard/knowledge',
            snippet: source.excerpt,
            relevanceScore: source.confidence,
            timestamp: undefined,
            metadata: {
              sourceId: source.sourceId,
              citationNumber: source.citationNumber,
              layer: source.layer,
              sourceType: 'compiled_memory',
              freshness: source.freshness,
              provenance: {
                ...source.provenance,
                layer: source.layer,
                pageId: source.sourceId,
                title: source.title,
                url: source.url || '/dashboard/knowledge',
              },
            },
          })) || []
        : [];

    const sourcesCount = sourceCitations.length;

    console.log('[Chat API] Attaching sources to response:', {
      sourcesCount,
      firstSourceUrl: sourceCitations[0]?.url,
    });

    // Store sources in cache using an opaque, org/user-scoped key.
    // This allows the frontend to fetch sources after the assistant response completes
    const cacheKey = createSourcesCacheKey();
    const compatibilityCacheKey = lastUserMessage?.id;
    const now = Date.now();
    const cacheEntry = {
      sources: sourceCitations,
      orgId,
      userId,
      timestamp: now,
      expiresAt: now + SOURCES_CACHE_TTL,
    };
    sourcesCache.set(cacheKey, cacheEntry);
    if (compatibilityCacheKey) {
      sourcesCache.set(compatibilityCacheKey, cacheEntry);
    }
    console.log('[Chat API] Stored sources with cache key:', {
      cacheKey,
      sourcesCount: sourceCitations.length,
      cacheSize: sourcesCache.size,
    });

    // Clean up expired entries
    cleanupExpiredCache();

    // Return streaming response with cache key in header
    console.log('[Chat API] Creating UIMessageStreamResponse...');
    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Sources-Cache-Key', cacheKey);

    // Add diagnostic headers for debugging and monitoring
    response.headers.set('X-Answer-Mode', answerMode);
    response.headers.set('X-Search-Strategy', selectedStrategy);
    response.headers.set('X-Sources-Count', String(sourcesCount));
    response.headers.set('X-Retrieval-Attempts', String(retrievalAttempts));
    response.headers.set('X-Threshold-Used', 'N/A');
    response.headers.set('X-Similarity-Avg', 'N/A');

    console.log('[Chat API] Response headers:', {
      contentType: response.headers.get('Content-Type'),
      cacheKey: response.headers.get('X-Sources-Cache-Key'),
      transferEncoding: response.headers.get('Transfer-Encoding'),
      answerMode: response.headers.get('X-Answer-Mode'),
      searchStrategy: response.headers.get('X-Search-Strategy'),
      sourcesCount: response.headers.get('X-Sources-Count'),
      retrievalAttempts: response.headers.get('X-Retrieval-Attempts'),
      thresholdUsed: response.headers.get('X-Threshold-Used'),
      similarityAvg: response.headers.get('X-Similarity-Avg'),
    });
    console.log('[Chat API] ===== RETURNING STREAM RESPONSE =====');

    // Complete monitoring if enabled (declare userQuery as needed for this scope)
    const userQueryForMonitoring = userQuery || '';
    if (ENABLE_SEARCH_MONITORING && userQueryForMonitoring) {
      const toolCallsUsed = useToolDiscovery;

      searchMonitor.endSearch(queryId, {
        success: sourcesCount > 0,
        usedToolFallback: toolCallsUsed,
        totalTimeMs: Date.now() - requestStartTime,
      });
    }

    chatTelemetry = buildKnowledgeChatTelemetry({
      orgId,
      userId,
      queryId: queryId ?? 'unknown',
      query: userQuery,
      queryLength: userQuery.length,
      queryWordCount: userQuery.trim() ? userQuery.trim().split(/\s+/).length : 0,
      answerMode,
      routeStrategy: selectedStrategy,
      selectedStrategy,
      recordingsCount: actualRecordingsCount,
      sourcesCount,
      retrievalAttempts,
      finalThreshold: null,
      averageSimilarity: 0,
      totalTimeMs: Date.now() - requestStartTime,
      routingFailed: false,
      routingFailureReason: null,
      failureClass: telemetryFailureClass,
      ...sharedVendorTelemetry,
    });

    after(async () => {
      if (!chatTelemetry) return;

      await recordKnowledgeTelemetryEvent({
        type: 'knowledge.chat.outcome',
        payload: chatTelemetry as any,
      });
    });

    return response;
  } catch (error: any) {
    console.error('[Chat API] Error:', error);

    // Complete monitoring on error if it was initialized
    // Guard against undefined values and monitoring failures
    if (ENABLE_SEARCH_MONITORING && queryId != null && requestStartTime != null) {
      try {
        searchMonitor.endSearch(queryId, {
          success: false,
          sourcesFound: 0,
          totalTimeMs: Date.now() - requestStartTime,
        });
      } catch (monitoringError) {
        // Log but don't throw - monitoring failures shouldn't affect error response
        console.error('[Chat API] Failed to complete monitoring:', monitoringError);
      }
    }

    if (chatTelemetry) {
      await recordKnowledgeTelemetryEvent({
        type: 'knowledge.chat.outcome',
        payload: buildKnowledgeChatTelemetry({
          ...chatTelemetry,
          routingFailed: true,
          routingFailureReason: chatTelemetry.routingFailureReason ?? 'route_error',
          failureClass: 'route_error',
        }) as any,
      });
    }
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
