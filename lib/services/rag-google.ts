/**
 * RAG (Retrieval Augmented Generation) Service (Google Gemini)
 *
 * Retrieves relevant context from recordings and formats it for Google Gemini.
 * Manages conversation history and generates AI responses.
 */

import { googleAI, PROMPTS, GOOGLE_CONFIG } from '@/lib/google/client';
import { vectorSearch, type SearchResult } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import { createClient } from '@/lib/supabase/server';

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
}

export interface RAGContext {
  query: string;
  context: string;
  sources: CitedSource[];
  totalChunks: number;
}

/**
 * Retrieve relevant context for a query using vector search
 */
export async function retrieveContext(
  query: string,
  orgId: string,
  options?: {
    maxChunks?: number;
    threshold?: number;
    recordingIds?: string[];
    rerank?: boolean;
  }
): Promise<RAGContext> {
  const { maxChunks = 5, threshold = 0.7, recordingIds, rerank = false } = options || {};

  // Fetch more results if reranking is enabled
  const initialLimit = rerank ? maxChunks * 3 : maxChunks;

  // Perform vector search to find relevant chunks
  let searchResults = await vectorSearch(query, {
    orgId,
    limit: initialLimit,
    threshold,
    recordingIds,
  });

  // Apply reranking if requested and configured
  if (rerank && isCohereConfigured() && searchResults.length > 0) {
    const rerankResult = await rerankResults(query, searchResults, {
      topN: maxChunks,
      timeoutMs: 500,
    });
    searchResults = rerankResult.results;
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

  return {
    query,
    context,
    sources,
    totalChunks: sources.length,
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
}> {
  const {
    conversationHistory = [],
    maxChunks = 5,
    threshold = 0.7,
    recordingIds,
    rerank = false,
  } = options || {};

  // Retrieve relevant context with optional reranking
  const ragContext = await retrieveContext(query, orgId, {
    maxChunks,
    threshold,
    recordingIds,
    rerank,
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      sources: message.metadata?.sources || null,
      tokens: message.metadata?.tokensUsed || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  return {
    id: data.id,
    role: data.role,
    content: data.content,
    createdAt: new Date(data.created_at),
    metadata: {
      sources: data.sources,
      tokensUsed: data.tokens,
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_conversations')
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
  const supabase = await createClient();

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get conversation history: ${error.message}`);
  }

  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: new Date(msg.created_at),
    metadata: {
      sources: msg.sources,
      tokensUsed: msg.tokens,
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
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from('chat_conversations')
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
