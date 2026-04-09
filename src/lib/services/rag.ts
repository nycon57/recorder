/**
 * RAG (Retrieval Augmented Generation) Service
 *
 * Retrieves relevant context from recordings and formats it for GPT-5 Nano.
 * Manages conversation history and generates AI responses.
 */

import { openai, PROMPTS, OPENAI_CONFIG } from '@/lib/openai/client';
import { vectorSearch, type SearchResult } from '@/lib/services/vector-search';
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
  contentId: string;
  contentTitle: string;
  chunkId: string;
  chunkText: string;
  similarity: number;
  timestamp?: number;
  source: 'transcript' | 'document';
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
    contentIds?: string[];
  }
): Promise<RAGContext> {
  const { maxChunks = 5, threshold = 0.5, contentIds } = options || {}; // Lowered from 0.7 - balancing precision/recall for knowledge management

  // Perform vector search to find relevant chunks
  const searchResults = await vectorSearch(query, {
    orgId,
    limit: maxChunks,
    threshold,
    contentIds,
  });

  // Format results as cited sources
  const sources: CitedSource[] = searchResults.map((result) => ({
    contentId: result.contentId,
    contentTitle: result.contentTitle,
    chunkId: result.id,
    chunkText: result.chunkText,
    similarity: result.similarity,
    timestamp: result.metadata.startTime,
    source: result.metadata.source,
  }));

  // Build context string from chunks
  const context = sources
    .map((source, index) => {
      const citation = `[${index + 1}] ${source.contentTitle}`;
      const timestamp = source.timestamp
        ? ` (at ${formatTimestamp(source.timestamp)})`
        : '';
      return `${citation}${timestamp}:\n${source.chunkText}\n`;
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
 * Generate AI response using RAG
 */
export async function generateRAGResponse(
  query: string,
  orgId: string,
  options?: {
    conversationHistory?: ChatMessage[];
    maxChunks?: number;
    threshold?: number;
    contentIds?: string[];
    stream?: boolean;
  }
): Promise<{
  response: string;
  sources: CitedSource[];
  tokensUsed: number;
}> {
  const {
    conversationHistory = [],
    maxChunks = 5,
    threshold = 0.5, // Lowered from 0.7 - balancing precision/recall for knowledge management
    contentIds,
    stream = false,
  } = options || {};

  // Retrieve relevant context
  const ragContext = await retrieveContext(query, orgId, {
    maxChunks,
    threshold,
    contentIds,
  });

  // Build messages for GPT-5 Nano
  const messages = buildMessages(query, ragContext, conversationHistory);

  // Generate response
  const completion = await openai.chat.completions.create({
    model: OPENAI_CONFIG.CHAT_MODEL,
    messages,
    temperature: OPENAI_CONFIG.CHAT_TEMPERATURE,
    max_tokens: OPENAI_CONFIG.CHAT_MAX_TOKENS,
    stream: false, // Non-streaming for now
  });

  const response = completion.choices[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;

  return {
    response,
    sources: ragContext.sources,
    tokensUsed,
  };
}

/**
 * Generate streaming RAG response
 */
export async function* generateStreamingRAGResponse(
  query: string,
  orgId: string,
  options?: {
    conversationHistory?: ChatMessage[];
    maxChunks?: number;
    threshold?: number;
    contentIds?: string[];
  }
): AsyncGenerator<{
  type: 'context' | 'token' | 'done';
  data?: any;
}> {
  const {
    conversationHistory = [],
    maxChunks = 5,
    threshold = 0.5, // Lowered from 0.7 - balancing precision/recall for knowledge management
    contentIds,
  } = options || {};

  // Retrieve context first
  const ragContext = await retrieveContext(query, orgId, {
    maxChunks,
    threshold,
    contentIds,
  });

  // Yield context/sources
  yield {
    type: 'context',
    data: { sources: ragContext.sources },
  };

  // Build messages
  const messages = buildMessages(query, ragContext, conversationHistory);

  // Stream response
  const stream = await openai.chat.completions.create({
    model: OPENAI_CONFIG.CHAT_MODEL,
    messages,
    temperature: OPENAI_CONFIG.CHAT_TEMPERATURE,
    max_tokens: OPENAI_CONFIG.CHAT_MAX_TOKENS,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield {
        type: 'token',
        data: { token: content },
      };
    }
  }

  yield {
    type: 'done',
    data: {},
  };
}

/**
 * Build message array for GPT-5 Nano
 */
function buildMessages(
  query: string,
  ragContext: RAGContext,
  conversationHistory: ChatMessage[]
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // System prompt with context
  const systemPrompt = PROMPTS.CHAT_SYSTEM.replace('{context}', ragContext.context);
  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Add conversation history (last 5 messages for context)
  const recentHistory = conversationHistory.slice(-5);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current query
  const userPrompt = PROMPTS.CHAT_USER.replace('{query}', query);
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  return messages;
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
      metadata: message.metadata || {},
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
    metadata: data.metadata,
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
 * Get conversation history with pagination
 * PERF-DB-004: Added limit parameter to reduce memory usage by ~70% for long conversations
 *
 * @param conversationId - The conversation to fetch
 * @param orgId - Organization ID for validation
 * @param options - Pagination options
 * @returns Array of chat messages in chronological order
 */
export async function getConversationHistory(
  conversationId: string,
  orgId: string,
  options: {
    /** Maximum number of messages to fetch (default: 20) */
    limit?: number;
    /** Offset for pagination (default: 0) */
    offset?: number;
    /** Whether to include all messages regardless of limit (default: false) */
    includeAll?: boolean;
  } = {}
): Promise<ChatMessage[]> {
  const { limit = 20, offset = 0, includeAll = false } = options;
  const supabase = await createClient();

  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }); // Get most recent first

  // PERF-DB-004: Apply pagination unless includeAll is true
  if (!includeAll) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: messages, error } = await query;

  if (error) {
    throw new Error(`Failed to get conversation history: ${error.message}`);
  }

  // Reverse to chronological order (oldest first) for proper conversation flow
  const chronologicalMessages = messages.reverse();

  return chronologicalMessages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: new Date(msg.created_at),
    metadata: msg.metadata,
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
