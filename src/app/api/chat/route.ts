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
import { checkBotId } from 'botid/server';
import { after } from 'next/server';

import { requireOrg } from '@/lib/utils/api';
import { retrieveContext } from '@/lib/services/rag-google';
import {
  resolveCompiledMemoryAnswerContext,
  type CompiledMemoryAnswerContext,
} from '@/lib/services/compiled-memory-answer-context';
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
  type KnowledgeChatTelemetryPayload,
} from '@/lib/services/knowledge-telemetry';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Force dynamic rendering to enable streaming
export const dynamic = 'force-dynamic';

// Configuration flags (can be overridden via env vars)
const ENABLE_AGENTIC_RAG = process.env.ENABLE_AGENTIC_RAG !== 'false';
const ENABLE_RERANKING = process.env.ENABLE_RERANKING !== 'false';
const ENABLE_CHAT_TOOLS = process.env.ENABLE_CHAT_TOOLS !== 'false';
const ENABLE_SEARCH_MONITORING = process.env.ENABLE_SEARCH_MONITORING === 'true';

// Store sources temporarily (keyed by timestamp for retrieval)
// This is a workaround since AI SDK v5 doesn't support custom data in streaming responses
// Cache entries: { sources: any[], timestamp: number }
const sourcesCache = new Map<string, { sources: any[]; timestamp: number }>();

// Cache TTL: 5 minutes (enough time for navigation between chat and detail pages)
const SOURCES_CACHE_TTL = 5 * 60 * 1000;

function createQueryId() {
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
    if (now - entry.timestamp > SOURCES_CACHE_TTL) {
      sourcesCache.delete(key);
    }
  }
}

/**
 * Alert when search returns no results but user has content in their library
 */
async function alertSearchFailure(
  query: string,
  orgId: string,
  attempts: number,
  config: any,
  recordingsCount: number
) {
  if (recordingsCount > 0) {
    console.warn('[Chat API] ⚠️ SEARCH FAILURE ALERT:', {
      query: query.substring(0, 100),
      orgId,
      recordingsInLibrary: recordingsCount,
      retrievalAttempts: attempts,
      finalThreshold: config.threshold,
      useAgentic: config.useAgentic,
      rerank: config.rerank,
      recommendation: 'User has content but search returned 0 results. Consider further threshold tuning or query preprocessing.',
    });
  }
}

/**
 * GET /api/chat - Retrieve sources by cache key
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cacheKey = url.searchParams.get('sourcesKey');

  console.log('[Chat API GET] Retrieving sources:', {
    cacheKey,
    cacheSize: sourcesCache.size,
    cacheKeys: Array.from(sourcesCache.keys()),
  });

  if (!cacheKey) {
    return new Response(JSON.stringify({ sources: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Clean up expired entries
  cleanupExpiredCache();

  const cacheEntry = sourcesCache.get(cacheKey);

  if (!cacheEntry) {
    console.warn('[Chat API GET] Cache miss for key:', cacheKey);
    return new Response(JSON.stringify({ sources: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if entry is expired
  const now = Date.now();
  if (now - cacheEntry.timestamp > SOURCES_CACHE_TTL) {
    console.warn('[Chat API GET] Cache entry expired for key:', cacheKey);
    sourcesCache.delete(cacheKey);
    return new Response(JSON.stringify({ sources: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[Chat API GET] Cache hit:', {
    cacheKey,
    sourcesCount: cacheEntry.sources.length,
    age: Math.round((now - cacheEntry.timestamp) / 1000) + 's',
  });

  // Don't delete - allow multiple retrievals within TTL
  return new Response(JSON.stringify({ sources: cacheEntry.sources }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
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
    let ragContext;
    let compiledAnswerContext: CompiledMemoryAnswerContext | undefined;
    let route: QueryRoute | undefined;
    let retrievalAttempts = 0;
    let selectedStrategy = 'none';
    let finalThreshold: number | null = null;
    let averageSimilarity = 0;
    let actualRecordingsCount = 0;
    let answerMode: 'compiled-memory' | 'discovery' | 'tool-discovery' | 'empty' = 'empty';
    let isMetaDiscoveryQuery = false;
    const isScopedDiscoveryMode = Array.isArray(recordingIds) && recordingIds.length > 0;
    let useToolDiscovery = false;

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
      useToolDiscovery = isMetaDiscoveryQuery;

      if (useToolDiscovery) {
        answerMode = 'tool-discovery';
        selectedStrategy = isMetaDiscoveryQuery ? 'tool_discovery_meta' : 'tool_discovery';
        console.log('[Chat API] Using tool-based discovery strategy');
      } else if (isScopedDiscoveryMode) {
        const { count: summariesCount } = await supabaseAdmin
          .from('content_summaries')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId);

        const hasSummaries = (summariesCount || 0) > 0;
        const hasReranking = ENABLE_RERANKING && isCohereConfigured();

        console.log('[Chat API] Scoped discovery context:', {
          recordingsCount: actualRecordingsCount,
          hasSummaries,
          hasReranking,
          agenticEnabled: ENABLE_AGENTIC_RAG,
        });

        // Scoped retrieval is explicit discovery mode, so we still route for
        // retrieval strategy tuning here.
        route = await routeQuery(searchableQuery, {
          recordingsCount: actualRecordingsCount,
          hasSummaries,
          hasReranking,
        });

        console.log('[Chat API] Query routing:');
        console.log(explainRoute(route));

        // Get retrieval configuration from route
        const retrievalConfig = getRetrievalConfig(route);

        // Track retrieval attempts for logging
        retrievalAttempts = 1;
        answerMode = 'discovery';
        selectedStrategy = `${route.strategy}:discovery`;
        finalThreshold = retrievalConfig.threshold || 0.7;

        // Update monitoring with configuration
        if (ENABLE_SEARCH_MONITORING && userQuery) {
          searchMonitor.updateConfig(queryId, {
            strategy: selectedStrategy,
            threshold: finalThreshold,
            useAgentic: retrievalConfig.useAgentic || false,
          });
        }

        try {
          ragContext = await retrieveContext(searchableQuery, orgId, {
            ...retrievalConfig,
            contentIds: recordingIds,
            useAgentic: ENABLE_AGENTIC_RAG && retrievalConfig.useAgentic,
            rerank: ENABLE_RERANKING && retrievalConfig.rerank,
          });

          console.log('[Chat API] Initial discovery retrieval:', {
            sourcesFound: ragContext?.sources?.length || 0,
            totalChunks: ragContext?.totalChunks || 0,
            strategy: selectedStrategy,
            agenticUsed: ragContext?.agenticMetadata !== undefined,
          });

          if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
            console.log('[Chat API] No discovery results - attempting retry strategies');

            if (retrievalConfig.threshold && retrievalConfig.threshold > 0.5) {
              console.log('[Chat API] Retry attempt 1: Lowering threshold to 0.5');
              retrievalAttempts++;

              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'lowerThreshold');
              }

              try {
                ragContext = await retrieveContext(searchableQuery, orgId, {
                  ...retrievalConfig,
                  threshold: 0.5,
                  contentIds: recordingIds,
                  useAgentic: ENABLE_AGENTIC_RAG && retrievalConfig.useAgentic,
                  rerank: ENABLE_RERANKING && retrievalConfig.rerank,
                });

                console.log('[Chat API] Retry 1 results:', {
                  sourcesFound: ragContext?.sources?.length || 0,
                });
              } catch (error) {
                console.error('[Chat API] Discovery retry 1 failed:', error);
              }
            }

            if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
              console.log('[Chat API] Retry attempt 2: Forcing hybrid search');
              retrievalAttempts++;

              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'hybrid');
              }

              try {
                const { hybridSearch } = await import('@/lib/services/vector-search-google');
                const hybridResults = await hybridSearch(searchableQuery, {
                  orgId,
                  limit: retrievalConfig.maxChunks || 10,
                  threshold: 0.5,
                  contentIds: recordingIds,
                });

                if (hybridResults && hybridResults.length > 0) {
                  // Convert hybrid results to RAG context format
                  const sources = hybridResults.map((result) => ({
                    contentId: result.contentId,
                    contentTitle: result.contentTitle,
                    chunkId: result.id,
                    chunkText: result.chunkText,
                    similarity: result.similarity,
                    timestamp: result.metadata.startTime,
                    timestampRange: result.metadata.timestampRange,
                    source: result.metadata.source,
                    hasVisualContext: result.metadata.hasVisualContext || false,
                    visualDescription: result.metadata.visualDescription,
                    contentType: result.metadata.contentType || 'audio',
                    url: `/library/${result.contentId}`,
                  }));

                  const context = sources
                    .map((source, index) => {
                      const citation = `[${index + 1}] ${source.contentTitle}`;
                      const timeInfo = source.timestampRange
                        ? ` (${source.timestampRange})`
                        : source.timestamp
                        ? ` (at ${Math.floor(source.timestamp / 60)}:${String(Math.floor(source.timestamp % 60)).padStart(2, '0')})`
                        : '';
                      const visualIndicator = source.hasVisualContext ? ' [Video with screen context]' : '';
                      return `${citation}${timeInfo}${visualIndicator}:\n${source.chunkText}\n`;
                    })
                    .join('\n');

                  ragContext = {
                    query: searchableQuery,
                    context,
                    sources,
                    totalChunks: sources.length,
                  };

                  console.log('[Chat API] Retry 2 results (hybrid):', {
                    sourcesFound: ragContext?.sources?.length || 0,
                  });
                }
              } catch (error) {
                console.error('[Chat API] Retry 2 (hybrid search) failed:', error);
              }
            }

            if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
              console.log('[Chat API] Retry attempt 3: Trying keyword-only search');
              retrievalAttempts++;

              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'keyword');
              }

              try {
                const { hybridSearch } = await import('@/lib/services/vector-search-google');
                const keywordResults = await hybridSearch(searchableQuery, {
                  orgId,
                  limit: retrievalConfig.maxChunks || 10,
                  threshold: 0.3, // Even lower threshold for keyword fallback
                  contentIds: recordingIds,
                });

                if (keywordResults && keywordResults.length > 0) {
                  // Convert to RAG context format
                  const sources = keywordResults.map((result) => ({
                    contentId: result.contentId,
                    contentTitle: result.contentTitle,
                    chunkId: result.id,
                    chunkText: result.chunkText,
                    similarity: result.similarity,
                    timestamp: result.metadata.startTime,
                    timestampRange: result.metadata.timestampRange,
                    source: result.metadata.source,
                    hasVisualContext: result.metadata.hasVisualContext || false,
                    visualDescription: result.metadata.visualDescription,
                    contentType: result.metadata.contentType || 'audio',
                    url: `/library/${result.contentId}`,
                  }));

                  const context = sources
                    .map((source, index) => {
                      const citation = `[${index + 1}] ${source.contentTitle}`;
                      const timeInfo = source.timestampRange
                        ? ` (${source.timestampRange})`
                        : source.timestamp
                        ? ` (at ${Math.floor(source.timestamp / 60)}:${String(Math.floor(source.timestamp % 60)).padStart(2, '0')})`
                        : '';
                      const visualIndicator = source.hasVisualContext ? ' [Video with screen context]' : '';
                      return `${citation}${timeInfo}${visualIndicator}:\n${source.chunkText}\n`;
                    })
                    .join('\n');

                  ragContext = {
                    query: searchableQuery,
                    context,
                    sources,
                    totalChunks: sources.length,
                  };

                  console.log('[Chat API] Retry 3 results (keyword fallback):', {
                    sourcesFound: ragContext?.sources?.length || 0,
                  });
                }
              } catch (error) {
                console.error('[Chat API] Retry 3 (keyword search) failed:', error);
              }
            }
          }

          if (ragContext?.sources && ragContext.sources.length > 0) {
            const similarities = ragContext.sources
              .map(s => s.similarity)
              .filter((s): s is number => s != null && !isNaN(s));
            averageSimilarity = similarities.length > 0
              ? similarities.reduce((a, b) => a + b, 0) / similarities.length
              : 0;

            if (ENABLE_SEARCH_MONITORING && userQuery && similarities.length > 0) {
              const minSimilarity = Math.min(...similarities);
              const maxSimilarity = Math.max(...similarities);

              searchMonitor.updateConfig(queryId, {
                sourcesFound: ragContext.sources.length,
                avgSimilarity: averageSimilarity,
                minSimilarity: minSimilarity,
                maxSimilarity: maxSimilarity,
                retrievalAttempts: retrievalAttempts,
                searchTimeMs: Date.now() - requestStartTime,
              });
            }
          }

          console.log('[Chat API] Final discovery retrieval:', {
            attempts: retrievalAttempts,
            sourcesFound: ragContext?.sources?.length || 0,
            finalStrategy: selectedStrategy,
            threshold: retrievalConfig.threshold,
            averageSimilarity: averageSimilarity.toFixed(3),
          });

          if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
            await alertSearchFailure(searchableQuery, orgId, retrievalAttempts, retrievalConfig, actualRecordingsCount);
          }

          console.log('[Chat API] Search quality metrics:', {
            timestamp: new Date().toISOString(),
            orgId,
            userId,
            query: userQuery,
            queryLength: userQuery.length,
            queryWordCount: userQuery.split(/\s+/).length,
            retrievalAttempts,
            sourcesFound: ragContext?.sources?.length || 0,
            strategy: selectedStrategy,
            threshold: retrievalConfig.threshold,
            agenticUsed: retrievalConfig.useAgentic || false,
            rerankingUsed: retrievalConfig.rerank || false,
            retrievalTimeMs: Date.now() - requestStartTime,
          });
        } catch (error) {
          console.error('[Chat API] Discovery retrieval error:', error);

          console.error('[Chat API] Error details:', {
            query: searchableQuery,
            orgId,
            config: retrievalConfig,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
          });

          ragContext = {
            query: searchableQuery,
            context: '',
            sources: [],
            totalChunks: 0,
          };
        }
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
    } else if (answerMode === 'discovery' && ragContext) {
      systemPrompt = `You are a helpful AI assistant. The user explicitly asked to work against selected recordings, so you are in discovery mode.

**Mode boundary:**
- Discovery mode uses RAW evidence from transcripts/documents.
- Raw evidence is useful for audit, verification, and scoped investigation.
- Do not present discovery-mode findings as the canonical compiled-memory answer layer.

**CRITICAL RULES:**
1. ONLY use information explicitly stated in the raw evidence below
2. If the answer is not in the evidence, respond with: "I couldn't find that in the selected recordings."
3. Make it clear you are summarizing raw evidence from the selected recordings
4. Use citation numbers [1], [2], [3] for every factual claim

**RAW EVIDENCE FROM SELECTED RECORDINGS:**
${ragContext.context}

Answer using ONLY the evidence above.`;
    } else if (actualRecordingsCount > 0) {
      systemPrompt = `You are a helpful AI assistant. The organization has recordings, but I could not find compiled knowledge for this question yet.

Tell the user that you don't have compiled knowledge about that yet and offer to search the raw recordings if they want discovery evidence, transcript snippets, or document excerpts. Do not guess.`;
    } else {
      systemPrompt = 'You are a helpful AI assistant. The user has no recordings yet. Let them know they need to create recordings first before you can answer questions about them.';
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
    } else if (ragContext && ragContext.sources && Array.isArray(ragContext.sources)) {
      console.log('[Chat API] ===== DISCOVERY EVIDENCE DEBUG =====');
      ragContext.sources.forEach((source, idx) => {
        console.log(`  [${idx + 1}] ${source.contentTitle}`);
        console.log(`      Content ID: ${source.contentId}`);
        console.log(`      Chunk: ${source.chunkText.substring(0, 100)}...`);
        console.log(`      Similarity: ${source.similarity}`);
      });
      console.log('[Chat API] Full context length:', ragContext.context.length);
      console.log('[Chat API] Context preview:', ragContext.context.substring(0, 500));
      console.log('[Chat API] ===============================');
    }

    // Create tools with bound context
    // Pass Zod schemas directly - AI SDK v5 handles conversion for Gemini
    const toolsWithContext = ENABLE_CHAT_TOOLS && useToolDiscovery ? {
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
    } : undefined;

    const shouldPreferTools = useToolDiscovery;

    console.log('[Chat API] Streaming configuration:', {
      strategy: route?.strategy,
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
        : ragContext?.sources?.map((source, index) => ({
            id: `source-${index + 1}`,
            recordingId: source.contentId,
            title: source.contentTitle,
            url: source.url || `/library/${source.contentId}`,
            snippet: source.chunkText.substring(0, 200),
            relevanceScore: source.similarity,
            timestamp: source.timestampRange || (source.timestamp ? `${Math.floor(source.timestamp / 60)}:${String(Math.floor(source.timestamp % 60)).padStart(2, '0')}` : undefined),
            metadata: {
              chunkId: source.chunkId,
              hasVisualContext: source.hasVisualContext,
              contentType: source.contentType,
              sourceType: 'raw_evidence',
            },
          })) || [];

    const sourcesCount = sourceCitations.length;

    console.log('[Chat API] Attaching sources to response:', {
      sourcesCount,
      firstSourceUrl: sourceCitations[0]?.url,
    });

    // Store sources in cache using user message ID as key
    // This allows the frontend to fetch sources after the assistant response completes
    const cacheKey = lastUserMessage?.id || Date.now().toString();
    sourcesCache.set(cacheKey, {
      sources: sourceCitations,
      timestamp: Date.now(),
    });
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
    response.headers.set('X-Threshold-Used', finalThreshold != null ? String(finalThreshold) : 'N/A');
    response.headers.set(
      'X-Similarity-Avg',
      answerMode === 'discovery' && averageSimilarity > 0 ? averageSimilarity.toFixed(3) : 'N/A',
    );

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
      routeStrategy: route?.strategy ?? null,
      selectedStrategy,
      recordingsCount: actualRecordingsCount,
      sourcesCount,
      retrievalAttempts,
      finalThreshold,
      averageSimilarity,
      totalTimeMs: Date.now() - requestStartTime,
      routingFailed: false,
      routingFailureReason: null,
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
