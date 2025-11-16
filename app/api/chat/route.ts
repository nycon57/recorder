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
import { searchMonitor } from '@/lib/services/search-monitoring';
import { assignVariant, getExperimentConfig, logExperimentResult } from '@/lib/services/ab-testing';
import { nanoid } from 'nanoid';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Force dynamic rendering to enable streaming
export const dynamic = 'force-dynamic';

// Configuration flags (can be overridden via env vars)
const ENABLE_AGENTIC_RAG = process.env.ENABLE_AGENTIC_RAG !== 'false';
const ENABLE_RERANKING = process.env.ENABLE_RERANKING !== 'false';
const ENABLE_CHAT_TOOLS = process.env.ENABLE_CHAT_TOOLS !== 'false';
const ENABLE_SEARCH_MONITORING = process.env.ENABLE_SEARCH_MONITORING === 'true';
const AB_TESTING_ENABLED = process.env.ENABLE_SEARCH_AB_TESTING === 'true';

// Store sources temporarily (keyed by timestamp for retrieval)
// This is a workaround since AI SDK v5 doesn't support custom data in streaming responses
// Cache entries: { sources: any[], timestamp: number }
const sourcesCache = new Map<string, { sources: any[]; timestamp: number }>();

// Cache TTL: 5 minutes (enough time for navigation between chat and detail pages)
const SOURCES_CACHE_TTL = 5 * 60 * 1000;

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

    // Initialize monitoring if enabled
    queryId = nanoid();
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

    // Retrieve RAG context if there's a query
    let ragContext;
    let route: QueryRoute | undefined;
    let retrievalAttempts = 0;
    let selectedStrategy = 'none';
    let finalThreshold = 0;
    let averageSimilarity = 0;

    if (userQuery) {
      console.log('[Chat API] Retrieving RAG context for org:', orgId);

      // Track request start time for telemetry
      const requestStartTime = Date.now();

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
        let retrievalConfig = getRetrievalConfig(route);

        // Track retrieval attempts for logging
        retrievalAttempts = 1;
        selectedStrategy = route.strategy;
        finalThreshold = retrievalConfig.threshold || 0.7;

        // Optional A/B testing override
        if (AB_TESTING_ENABLED && userQuery) {
          const variant = assignVariant(userId, orgId);
          const experimentConfig = getExperimentConfig(variant);

          console.log('[Chat API] A/B Test variant assigned:', {
            variant,
            userId: userId.substring(0, 8),
            orgId: orgId.substring(0, 8),
          });

          // Override config with experiment settings
          retrievalConfig = {
            ...retrievalConfig,
            threshold: experimentConfig.threshold,
            useHybrid: experimentConfig.useHybrid,
            useAgentic: ENABLE_AGENTIC_RAG && experimentConfig.useAgentic,
            maxChunks: experimentConfig.maxChunks,
          };

          finalThreshold = experimentConfig.threshold;
        }

        // Update monitoring with configuration
        if (ENABLE_SEARCH_MONITORING && userQuery) {
          searchMonitor.updateConfig(queryId, {
            strategy: selectedStrategy,
            threshold: finalThreshold,
            useHybrid: retrievalConfig.useHybrid || false,
            useAgentic: retrievalConfig.useAgentic || false,
          });
        }

        // Wrap retrieval in try-catch for error handling
        try {
          // Use searchable query for RAG context retrieval
          ragContext = await retrieveContext(searchableQuery, orgId, {
            ...retrievalConfig,
            recordingIds,
            // Force disable agentic if globally disabled
            useAgentic: ENABLE_AGENTIC_RAG && retrievalConfig.useAgentic,
            rerank: ENABLE_RERANKING && retrievalConfig.rerank,
          });

          console.log('[Chat API] Initial RAG retrieval:', {
            sourcesFound: ragContext?.sources?.length || 0,
            totalChunks: ragContext?.totalChunks || 0,
            strategy: route.strategy,
            agenticUsed: ragContext?.agenticMetadata !== undefined,
          });

          // Retry logic if no results found
          if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
            console.log('[Chat API] No RAG results - attempting retry strategies');

            // Strategy 1: Retry with lower threshold (0.5)
            if (retrievalConfig.threshold && retrievalConfig.threshold > 0.5) {
              console.log('[Chat API] Retry attempt 1: Lowering threshold to 0.5');
              retrievalAttempts++;

              // Record retry in monitoring
              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'lowerThreshold');
              }

              try {
                ragContext = await retrieveContext(searchableQuery, orgId, {
                  ...retrievalConfig,
                  threshold: 0.5,
                  recordingIds,
                  useAgentic: ENABLE_AGENTIC_RAG && retrievalConfig.useAgentic,
                  rerank: ENABLE_RERANKING && retrievalConfig.rerank,
                });

                console.log('[Chat API] Retry 1 results:', {
                  sourcesFound: ragContext?.sources?.length || 0,
                });
              } catch (error) {
                console.error('[Chat API] Retry 1 failed:', error);
              }
            }

            // Strategy 2: Force hybrid search if still no results
            if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
              console.log('[Chat API] Retry attempt 2: Forcing hybrid search');
              retrievalAttempts++;

              // Record retry in monitoring
              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'hybrid');
              }

              try {
                // Import hybrid search function
                const { hybridSearch } = await import('@/lib/services/vector-search-google');
                const hybridResults = await hybridSearch(searchableQuery, {
                  orgId,
                  limit: retrievalConfig.maxChunks || 10,
                  threshold: 0.5,
                  recordingIds,
                });

                if (hybridResults && hybridResults.length > 0) {
                  // Convert hybrid results to RAG context format
                  const sources = hybridResults.map((result) => ({
                    recordingId: result.recordingId,
                    recordingTitle: result.recordingTitle,
                    chunkId: result.id,
                    chunkText: result.chunkText,
                    similarity: result.similarity,
                    timestamp: result.metadata.startTime,
                    timestampRange: result.metadata.timestampRange,
                    source: result.metadata.source,
                    hasVisualContext: result.metadata.hasVisualContext || false,
                    visualDescription: result.metadata.visualDescription,
                    contentType: result.metadata.contentType || 'audio',
                    url: `/library/${result.recordingId}`,
                  }));

                  const context = sources
                    .map((source, index) => {
                      const citation = `[${index + 1}] ${source.recordingTitle}`;
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

            // Strategy 3: Try keyword-only search as last resort
            if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
              console.log('[Chat API] Retry attempt 3: Trying keyword-only search');
              retrievalAttempts++;

              // Record retry in monitoring
              if (ENABLE_SEARCH_MONITORING && userQuery) {
                searchMonitor.recordRetry(queryId, 'keyword');
              }

              try {
                // Import keyword search function (it's not exported, so we'll use hybridSearch which includes it)
                const { hybridSearch } = await import('@/lib/services/vector-search-google');
                const keywordResults = await hybridSearch(searchableQuery, {
                  orgId,
                  limit: retrievalConfig.maxChunks || 10,
                  threshold: 0.3, // Even lower threshold for keyword fallback
                  recordingIds,
                });

                if (keywordResults && keywordResults.length > 0) {
                  // Convert to RAG context format
                  const sources = keywordResults.map((result) => ({
                    recordingId: result.recordingId,
                    recordingTitle: result.recordingTitle,
                    chunkId: result.id,
                    chunkText: result.chunkText,
                    similarity: result.similarity,
                    timestamp: result.metadata.startTime,
                    timestampRange: result.metadata.timestampRange,
                    source: result.metadata.source,
                    hasVisualContext: result.metadata.hasVisualContext || false,
                    visualDescription: result.metadata.visualDescription,
                    contentType: result.metadata.contentType || 'audio',
                    url: `/library/${result.recordingId}`,
                  }));

                  const context = sources
                    .map((source, index) => {
                      const citation = `[${index + 1}] ${source.recordingTitle}`;
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

          // Calculate average similarity for diagnostics
          if (ragContext?.sources && ragContext.sources.length > 0) {
            const similarities = ragContext.sources
              .map(s => s.similarity)
              .filter(s => s != null && !isNaN(s));
            averageSimilarity = similarities.length > 0
              ? similarities.reduce((a, b) => a + b, 0) / similarities.length
              : 0;

            // Update monitoring with search results
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

            // Log experiment result if A/B testing is enabled
            if (AB_TESTING_ENABLED && userQuery) {
              const variant = assignVariant(userId, orgId);
              await logExperimentResult(variant, userQuery, orgId, userId, {
                sourcesFound: ragContext.sources.length,
                retrievalAttempts,
                avgSimilarity: averageSimilarity,
                timeMs: Date.now() - requestStartTime,
              });
            }
          }

          // Log final retrieval outcome
          console.log('[Chat API] Final RAG retrieval:', {
            attempts: retrievalAttempts,
            sourcesFound: ragContext?.sources?.length || 0,
            finalStrategy: selectedStrategy,
            threshold: retrievalConfig.threshold,
            averageSimilarity: averageSimilarity.toFixed(3),
          });

          // Alert on search failure if user has content
          if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
            await alertSearchFailure(searchableQuery, orgId, retrievalAttempts, retrievalConfig, actualRecordingsCount);
          }

          // Log search quality metrics
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
          console.error('[Chat API] RAG retrieval error:', error);

          // Log detailed error information
          console.error('[Chat API] Error details:', {
            query: searchableQuery,
            orgId,
            config: retrievalConfig,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
          });

          // Set empty context and continue (will use tool fallback)
          ragContext = {
            query: searchableQuery,
            context: '',
            sources: [],
            totalChunks: 0,
          };
        }
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
      // Build different prompts based on whether this was a meta-question
      const isMetaQuestion = preprocessed.wasTransformed &&
        preprocessed.transformation === 'meta-question-extraction-and-expansion';

      if (isMetaQuestion) {
        // User asked "Do I have recordings about X?" - confirm and summarize
        systemPrompt = `You are a helpful AI assistant. The user asked whether they have recordings about a specific topic.

**Your Task:**
Based on the Context below, confirm that recordings exist and provide a brief summary of what's covered.

**Response Format:**
"Yes, I have recordings about [topic]. Here's what they cover: [summary from context]"

**CITATION FORMAT:**
Use citation numbers [1], [2], [3] to reference sources.

**Context from User's Recordings:**
${ragContext.context}

Answer based ONLY on the Context above.`;
      } else {
        // Normal query - answer the question directly
        systemPrompt = `You are a helpful AI assistant. Answer the user's question using ONLY the information provided in the Context section below.

**CRITICAL RULES:**
1. ONLY use information explicitly stated in the Context below
2. If the answer is not in the Context, respond with: "I don't have information about that in your recordings."
3. NEVER mention products, platforms, or concepts not present in the Context
4. Answer questions directly and naturally based on what they asked
5. If you're uncertain, say "The context doesn't provide enough information to answer this."

**CITATION FORMAT:**
When referencing sources from the Context, use ONLY the citation numbers in brackets, like [1], [2], [3].
DO NOT include the recording title before the citation number.

Example: "The login process involves navigating to the URL [1] and entering credentials [2]."
NOT: "The login process involves navigating to the URL (Recording Title [1]) and entering credentials (Recording Title [2])."

**Context from User's Recordings:**
${ragContext.context}

**Your Task:**
Answer the user's question using ONLY the above Context. Do not invent or assume anything. Use citation numbers [1], [2], etc. to reference sources.`;
      }
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
            deltaLength: chunk.type === 'text-delta' ? chunk.textDelta?.length : 0,
            textPreview: chunk.type === 'text-delta' ? chunk.textDelta?.substring(0, 50) : '',
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
    response.headers.set('X-Search-Strategy', selectedStrategy);
    response.headers.set('X-Sources-Count', String(ragContext?.sources?.length || 0));
    response.headers.set('X-Retrieval-Attempts', String(retrievalAttempts));
    response.headers.set('X-Threshold-Used', String(finalThreshold));
    response.headers.set('X-Similarity-Avg', averageSimilarity > 0 ? averageSimilarity.toFixed(3) : 'N/A');

    console.log('[Chat API] Response headers:', {
      contentType: response.headers.get('Content-Type'),
      cacheKey: response.headers.get('X-Sources-Cache-Key'),
      transferEncoding: response.headers.get('Transfer-Encoding'),
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
      const toolCallsUsed = route?.strategy === 'direct_listing' || route?.strategy === 'topic_overview';

      searchMonitor.endSearch(queryId, {
        success: (ragContext?.sources?.length || 0) > 0,
        usedToolFallback: toolCallsUsed,
        totalTimeMs: Date.now() - requestStartTime,
      });
    }

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

