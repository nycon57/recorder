/**
 * RAG (Retrieval Augmented Generation) Service (Google Gemini)
 *
 * Retrieves relevant context from recordings and formats it for Google Gemini.
 * Manages conversation history and generates AI responses.
 */

import { googleAI, PROMPTS, GOOGLE_CONFIG } from '@/lib/google/client';
import { vectorSearch, type SearchResult } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import { agenticSearch } from '@/lib/services/agentic-retrieval';
import { preprocessQuery } from '@/lib/services/query-preprocessor';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  metadata?: {
    sources?: CitedSource[];
    tokensUsed?: number;
  };
}

export interface CitedSource {
  recordingId: string;
  recordingTitle: string;
  chunkId: string;
  chunkText: string;
  similarity: number;
  timestamp?: number;
  timestampRange?: string;
  source: 'transcript' | 'document';
  hasVisualContext?: boolean;
  visualDescription?: string;
  contentType?: 'audio' | 'visual' | 'combined' | 'document';
  url?: string; // URL to the recording detail page for clickable citations
}

export interface RAGContext {
  query: string;
  context: string;
  sources: CitedSource[];
  totalChunks: number;
  agenticMetadata?: {
    intent: string;
    complexity: number;
    iterations: number;
    confidence: number;
  };
}

/**
 * Retrieve relevant context for a query using vector search or agentic search
 */
export async function retrieveContext(
  query: string,
  orgId: string,
  options?: {
    maxChunks?: number;
    threshold?: number;
    recordingIds?: string[];
    rerank?: boolean;
    useAgentic?: boolean;
    maxIterations?: number;
    enableSelfReflection?: boolean;
  }
): Promise<RAGContext> {
  console.log('[RAG] retrieveContext called:', { query: query.substring(0, 100), orgId, options });

  const {
    maxChunks = 5,
    threshold = 0.7,
    recordingIds,
    rerank = false,
    useAgentic = false,
    maxIterations = 3,
    enableSelfReflection = true,
  } = options || {};

  // Preprocess query to extract topic from meta-questions
  const preprocessed = preprocessQuery(query);
  const searchQuery = preprocessed.processedQuery;

  if (preprocessed.wasTransformed) {
    console.log('[RAG] Query preprocessed:', {
      original: preprocessed.originalQuery,
      processed: preprocessed.processedQuery,
      method: preprocessed.transformation,
    });
  }

  let searchResults: SearchResult[];
  let agenticMetadata: RAGContext['agenticMetadata'];

  // Use agentic search if enabled
  if (useAgentic) {
    const agenticResult = await agenticSearch(searchQuery, {
      orgId,
      maxIterations,
      enableSelfReflection,
      enableReranking: rerank,
      chunksPerQuery: Math.ceil(maxChunks * 1.5),
      recordingIds,
      logResults: false, // Don't log for chat context retrieval
    });
    searchResults = agenticResult.finalResults.slice(0, maxChunks);
    agenticMetadata = {
      intent: agenticResult.intent,
      complexity: agenticResult.decomposition.complexity,
      iterations: agenticResult.iterations.length,
      confidence: agenticResult.confidence,
    };
  } else {
    // Standard vector search
    // Fetch more results if reranking is enabled
    const initialLimit = rerank ? maxChunks * 3 : maxChunks;

    console.log('[RAG] Performing vector search:', { initialLimit, threshold });

    // Perform vector search to find relevant chunks
    searchResults = await vectorSearch(searchQuery, {
      orgId,
      limit: initialLimit,
      threshold,
      recordingIds,
    });

    console.log('[RAG] Vector search results:', searchResults.length);

    // Apply reranking if requested and configured
    // Use original query for reranking to maintain full context
    if (rerank && isCohereConfigured() && searchResults.length > 0) {
      const rerankResult = await rerankResults(query, searchResults, {
        topN: maxChunks,
        timeoutMs: 500,
      });
      searchResults = rerankResult.results;
    }
  }

  // Format results as cited sources with visual context
  const sources: CitedSource[] = searchResults.map((result) => ({
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
    // Add URL for clickable citations
    url: `/library/${result.recordingId}`,
  }));

  // Build context string from chunks with visual descriptions
  const context = sources
    .map((source, index) => {
      const citation = `[${index + 1}] ${source.recordingTitle}`;
      const timeInfo = source.timestampRange
        ? ` (${source.timestampRange})`
        : source.timestamp
        ? ` (at ${formatTimestamp(source.timestamp)})`
        : '';

      // Add visual context indicator
      const visualIndicator = source.hasVisualContext ? ' [Video with screen context]' : '';

      // Format the chunk text
      let text = `${citation}${timeInfo}${visualIndicator}:\n${source.chunkText}`;

      // Add visual description if available and not already in chunk text
      if (source.visualDescription && !source.chunkText.includes(source.visualDescription)) {
        text += `\nVisual context: ${source.visualDescription}`;
      }

      return text + '\n';
    })
    .join('\n');

  console.log('[RAG] Context built:', {
    sourcesCount: sources.length,
    contextLength: context.length,
    hasContext: context.length > 0
  });

  return {
    query,
    context,
    sources,
    totalChunks: sources.length,
    ...(agenticMetadata && { agenticMetadata }),
  };
}

/**
 * Generate AI response using RAG with Google Gemini
 */
export async function generateRAGResponse(
  query: string,
  orgId: string,
  options?: {
    conversationHistory?: ChatMessage[];
    maxChunks?: number;
    threshold?: number;
    recordingIds?: string[];
    stream?: boolean;
    rerank?: boolean;
    useAgentic?: boolean;
    maxIterations?: number;
    enableSelfReflection?: boolean;
  }
): Promise<{
  response: string;
  sources: CitedSource[];
  tokensUsed: number;
  rerankMetadata?: {
    originalCount: number;
    rerankedCount: number;
    tokensUsed?: number;
    costEstimate?: number;
  };
  agenticMetadata?: {
    intent: string;
    complexity: number;
    iterations: number;
    confidence: number;
  };
}> {
  const {
    conversationHistory = [],
    maxChunks = 5,
    threshold = 0.7,
    recordingIds,
    rerank = false,
    useAgentic = false,
    maxIterations = 3,
    enableSelfReflection = true,
  } = options || {};

  // Retrieve relevant context with optional agentic search
  const ragContext = await retrieveContext(query, orgId, {
    maxChunks,
    threshold,
    recordingIds,
    rerank,
    useAgentic,
    maxIterations,
    enableSelfReflection,
  });

  // Build prompt with context
  const systemPrompt = PROMPTS.CHAT_SYSTEM.replace('{context}', ragContext.context);
  const userPrompt = PROMPTS.CHAT_USER.replace('{query}', query);

  // Build conversation history for Gemini
  const historyParts = conversationHistory.slice(-5).flatMap(msg => [
    {
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    },
  ]);

  // Get Gemini model
  const model = googleAI.getGenerativeModel({
    model: GOOGLE_CONFIG.CHAT_MODEL,
    systemInstruction: systemPrompt,
  });

  // Generate response
  const chat = model.startChat({
    history: historyParts,
    generationConfig: {
      temperature: GOOGLE_CONFIG.CHAT_TEMPERATURE,
      maxOutputTokens: GOOGLE_CONFIG.CHAT_MAX_TOKENS,
    },
  });

  const result = await chat.sendMessage(userPrompt);
  const responseText = result.response.text();

  // Estimate tokens (Gemini doesn't provide exact token counts in free API)
  const tokensUsed = Math.ceil((systemPrompt.length + userPrompt.length + responseText.length) / 4);

  return {
    response: responseText,
    sources: ragContext.sources,
    tokensUsed,
    ...(ragContext.agenticMetadata && { agenticMetadata: ragContext.agenticMetadata }),
  };
}

/**
 * Generate streaming RAG response with Google Gemini
 */
export async function* generateStreamingRAGResponse(
  query: string,
  orgId: string,
  options?: {
    conversationHistory?: ChatMessage[];
    maxChunks?: number;
    threshold?: number;
    recordingIds?: string[];
    rerank?: boolean;
  }
): AsyncGenerator<{
  type: 'context' | 'token' | 'done';
  data?: any;
}> {
  const {
    conversationHistory = [],
    maxChunks = 5,
    threshold = 0.7,
    recordingIds,
    rerank = false,
  } = options || {};

  // Retrieve context first with optional reranking
  const ragContext = await retrieveContext(query, orgId, {
    maxChunks,
    threshold,
    recordingIds,
    rerank,
  });

  // Yield context/sources
  yield {
    type: 'context',
    data: { sources: ragContext.sources },
  };

  // Build prompt
  const systemPrompt = PROMPTS.CHAT_SYSTEM.replace('{context}', ragContext.context);
  const userPrompt = PROMPTS.CHAT_USER.replace('{query}', query);

  // Build history
  const historyParts = conversationHistory.slice(-5).flatMap(msg => [
    {
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    },
  ]);

  // Get Gemini model
  const model = googleAI.getGenerativeModel({
    model: GOOGLE_CONFIG.CHAT_MODEL,
    systemInstruction: systemPrompt,
  });

  // Stream response
  const chat = model.startChat({
    history: historyParts,
    generationConfig: {
      temperature: GOOGLE_CONFIG.CHAT_TEMPERATURE,
      maxOutputTokens: GOOGLE_CONFIG.CHAT_MAX_TOKENS,
    },
  });

  const result = await chat.sendMessageStream(userPrompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield {
        type: 'token',
        data: { token: text },
      };
    }
  }

  yield {
    type: 'done',
    data: {},
  };
}

/**
 * Save chat message to database
 */
export async function saveChatMessage(
  conversationId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<ChatMessage> {
  // Use admin client to bypass RLS since API route already validates auth
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content, // For legacy: plain string
      sources: message.metadata?.sources || null,
      metadata: {
        tokensUsed: message.metadata?.tokensUsed || null,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  return {
    id: data.id,
    role: data.role,
    content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
    createdAt: new Date(data.created_at),
    metadata: {
      sources: data.sources,
      tokensUsed: data.metadata?.tokensUsed || null,
    },
  };
}

/**
 * Create new conversation
 */
export async function createConversation(
  orgId: string,
  userId: string,
  title?: string
): Promise<string> {
  // Use admin client to bypass RLS since API route already validates auth
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      org_id: orgId,
      user_id: userId,
      title: title || 'New Conversation',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data.id;
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: string,
  orgId: string
): Promise<ChatMessage[]> {
  // Use admin client to bypass RLS since API route already validates auth
  const { data: messages, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true});

  if (error) {
    throw new Error(`Failed to get conversation history: ${error.message}`);
  }

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    createdAt: new Date(msg.created_at),
    metadata: {
      sources: msg.sources,
      tokensUsed: msg.metadata?.tokensUsed || null,
    },
  }));
}

/**
 * List user's conversations
 */
export async function listConversations(
  orgId: string,
  userId: string
): Promise<Array<{
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
}>> {
  // Use admin client to bypass RLS since API route already validates auth
  const { data: conversations, error } = await supabaseAdmin
    .from('conversations')
    .select(
      `
      id,
      title,
      updated_at,
      chat_messages (count)
    `
    )
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list conversations: ${error.message}`);
  }

  return conversations.map((conv: any) => ({
    id: conv.id,
    title: conv.title,
    lastMessageAt: new Date(conv.updated_at),
    messageCount: conv.chat_messages?.[0]?.count || 0,
  }));
}

/**
 * Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract question intent for better retrieval
 */
export function extractQuestionIntent(query: string): {
  isQuestion: boolean;
  questionType: 'what' | 'how' | 'why' | 'when' | 'where' | 'who' | 'general';
  keywords: string[];
} {
  const lowerQuery = query.toLowerCase();

  const questionWords = ['what', 'how', 'why', 'when', 'where', 'who'];
  const questionType = questionWords.find((word) => lowerQuery.startsWith(word)) as any;

  const isQuestion =
    lowerQuery.includes('?') ||
    questionWords.some((word) => lowerQuery.startsWith(word));

  // Extract keywords (simple approach - remove stop words)
  const stopWords = new Set([
    'the',
    'is',
    'at',
    'which',
    'on',
    'a',
    'an',
    'and',
    'or',
    'but',
  ]);
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => !stopWords.has(word) && word.length > 2);

  return {
    isQuestion,
    questionType: questionType || 'general',
    keywords,
  };
}
