/**
 * Chat RAG Integration Service
 *
 * Provides comprehensive RAG (Retrieval-Augmented Generation) context injection
 * for the AI assistant chat feature. Integrates with existing vector search,
 * hierarchical search, and reranking services to provide optimal context retrieval.
 *
 * Features:
 * - Multi-strategy search (vector, hierarchical, agentic)
 * - Redis caching for performance optimization
 * - Source citation formatting
 * - Token-aware context management
 * - Comprehensive error handling
 */

import { createHash } from 'crypto';

import { Redis } from '@upstash/redis';

import { hierarchicalSearch, type HierarchicalSearchResult } from '@/lib/services/hierarchical-search';
import { vectorSearch, type SearchResult } from '@/lib/services/vector-search-google';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';
import { agenticSearch } from '@/lib/services/agentic-retrieval';
import { createClient } from '@/lib/supabase/server';

/**
 * Configuration options for RAG context retrieval
 */
export interface RAGOptions {
  /** Maximum number of results to include (default: 5) */
  limit?: number;
  /** Minimum relevance score (0-1, default: 0.7) */
  minRelevance?: number;
  /** Include transcript chunks (default: true) */
  includeTranscripts?: boolean;
  /** Include document chunks (default: true) */
  includeDocuments?: boolean;
  /** Use hierarchical search for better diversity (default: true) */
  useHierarchical?: boolean;
  /** Enable Cohere reranking if available (default: false) */
  enableReranking?: boolean;
  /** Use agentic search for complex queries (default: false) */
  useAgentic?: boolean;
  /** Specific recording IDs to search within */
  recordingIds?: string[];
  /** Maximum iterations for agentic search (default: 3) */
  maxIterations?: number;
  /** Enable caching (default: true) */
  enableCache?: boolean;
}

/**
 * RAG context with formatted content and sources
 */
export interface RAGContext {
  /** Formatted context string for system prompt */
  context: string;
  /** Structured source citations */
  sources: SourceCitation[];
  /** Estimated token count of context */
  tokenCount: number;
  /** Search metadata */
  metadata?: {
    searchMode: 'vector' | 'hierarchical' | 'agentic';
    searchTimeMs: number;
    cacheHit: boolean;
    rerankingApplied?: boolean;
    agenticIterations?: number;
  };
}

/**
 * Structured source citation for UI display
 */
export interface SourceCitation {
  /** Unique identifier for the source */
  id: string;
  /** Type of content */
  type: 'transcript' | 'document';
  /** Display title */
  title: string;
  /** Relevant excerpt from the source */
  excerpt: string;
  /** Relevance score (0-1) */
  relevanceScore: number;
  /** Associated recording ID */
  recordingId?: string;
  /** Timestamp in seconds (for transcripts) */
  timestamp?: number;
  /** URL to view the source */
  url: string;
  /** Additional metadata */
  metadata?: {
    chunkIndex?: number;
    startTime?: number;
    endTime?: number;
    hasVisualContext?: boolean;
    visualDescription?: string;
  };
}

/**
 * Redis client instance (singleton)
 */
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (!redisClient) {
    // Only initialize if credentials are available
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      console.warn('[ChatRAG] Redis not configured, caching disabled');
    }
  }
  return redisClient;
}

/**
 * Generate cache key from query and options
 */
function generateCacheKey(query: string, orgId: string, options?: RAGOptions): string {
  const normalizedOptions = {
    limit: options?.limit || 5,
    minRelevance: options?.minRelevance || 0.7,
    includeTranscripts: options?.includeTranscripts !== false,
    includeDocuments: options?.includeDocuments !== false,
    useHierarchical: options?.useHierarchical !== false,
    recordingIds: options?.recordingIds?.sort() || [],
  };

  const keyData = JSON.stringify({
    query: query.toLowerCase().trim(),
    orgId,
    ...normalizedOptions,
  });

  const hash = createHash('sha256').update(keyData).digest('hex');
  return `rag:context:${orgId}:${hash}`;
}

/**
 * Inject RAG context for a query with intelligent retrieval strategies
 *
 * @param query - The user's query
 * @param orgId - Organization ID for data isolation
 * @param options - Configuration options
 * @returns RAG context with sources and formatted prompt
 *
 * @example
 * ```typescript
 * const context = await injectRAGContext(
 *   "What was discussed about pricing?",
 *   orgId,
 *   { limit: 5, enableReranking: true }
 * );
 * ```
 */
export async function injectRAGContext(
  query: string,
  orgId: string,
  options?: RAGOptions
): Promise<RAGContext> {
  const startTime = Date.now();
  const {
    limit = 5,
    minRelevance = 0.7,
    includeTranscripts = true,
    includeDocuments = true,
    useHierarchical = true,
    enableReranking = false,
    useAgentic = false,
    recordingIds,
    maxIterations = 3,
    enableCache = true,
  } = options || {};

  // Input validation
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  if (!orgId) {
    throw new Error('Organization ID is required for data isolation');
  }

  // Check cache if enabled
  const cacheHit = false;
  if (enableCache) {
    const cached = await getCachedSearchResults(query, orgId, options);
    if (cached) {
      const searchTimeMs = Date.now() - startTime;
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          searchTimeMs,
          cacheHit: true,
        },
      };
    }
  }

  try {
    let searchResults: SearchResult[] = [];
    let searchMode: 'vector' | 'hierarchical' | 'agentic' = 'vector';
    let agenticIterations: number | undefined;
    let rerankingApplied = false;

    // Choose search strategy based on options and query characteristics
    if (useAgentic) {
      // Use agentic search for complex queries
      searchMode = 'agentic';
      const agenticResult = await agenticSearch(query, {
        orgId,
        maxIterations,
        enableSelfReflection: true,
        enableReranking,
        chunksPerQuery: Math.ceil(limit * 1.5),
        recordingIds,
        logResults: false,
      });

      searchResults = agenticResult.finalResults.slice(0, limit);
      agenticIterations = agenticResult.iterations.length;
      rerankingApplied = agenticResult.rerankingApplied || false;

    } else if (useHierarchical) {
      // Use hierarchical search for better document diversity
      searchMode = 'hierarchical';
      const hierarchicalResults = await hierarchicalSearch(query, {
        orgId,
        topDocuments: Math.ceil(limit / 2) + 1,
        chunksPerDocument: 3,
        threshold: minRelevance,
      });

      // Convert hierarchical results to standard format
      // Add defensive check to ensure hierarchicalResults is an array
      if (!hierarchicalResults || !Array.isArray(hierarchicalResults)) {
        console.error('[ChatRAG] hierarchicalResults is not an array:', typeof hierarchicalResults);
        searchResults = [];
      } else {
        searchResults = hierarchicalResults.map((r) => ({
          id: r.id,
          recordingId: r.recordingId,
          recordingTitle: r.recordingTitle,
          chunkText: r.chunkText,
          similarity: r.similarity,
          metadata: r.metadata,
          createdAt: r.createdAt,
        }));

        // Apply filters
        if (recordingIds && recordingIds.length > 0) {
          searchResults = searchResults.filter((r) =>
            recordingIds.includes(r.recordingId)
          );
        }
      }

    } else {
      // Standard vector search
      searchMode = 'vector';
      const searchLimit = enableReranking ? limit * 3 : limit;

      searchResults = await vectorSearch(query, {
        orgId,
        limit: searchLimit,
        threshold: minRelevance,
        recordingIds,
        source: getSourceFilter(includeTranscripts, includeDocuments),
      });
    }

    // Apply reranking if requested and not already done
    if (enableReranking && !rerankingApplied && isCohereConfigured() && searchResults.length > 0) {
      const rerankResult = await rerankResults(query, searchResults, {
        topN: limit,
        timeoutMs: 500,
      });
      searchResults = rerankResult.results;
      rerankingApplied = true;
    }

    // Filter by relevance threshold
    // Add defensive check to ensure searchResults is an array
    if (!searchResults || !Array.isArray(searchResults)) {
      console.error('[ChatRAG] searchResults is not an array before filter:', typeof searchResults);
      searchResults = [];
    } else {
      searchResults = searchResults.filter((r) => r.similarity >= minRelevance);
      // Limit results
      searchResults = searchResults.slice(0, limit);
    }

    // Format sources for citations
    const sources = extractSourceCitations(searchResults);

    // Format context for prompt
    const context = formatSourcesForPrompt(searchResults);

    // Estimate token count
    const tokenCount = estimateTokenCount(context);

    const searchTimeMs = Date.now() - startTime;

    const ragContext: RAGContext = {
      context,
      sources,
      tokenCount,
      metadata: {
        searchMode,
        searchTimeMs,
        cacheHit,
        rerankingApplied,
        ...(agenticIterations !== undefined && { agenticIterations }),
      },
    };

    // Cache the results if enabled
    if (enableCache && searchResults.length > 0) {
      await cacheSearchResults(query, orgId, ragContext, options);
    }

    return ragContext;

  } catch (error) {
    console.error('[ChatRAG] Error injecting context:', error);

    // Return empty context on error (graceful degradation)
    return {
      context: '',
      sources: [],
      tokenCount: 0,
      metadata: {
        searchMode: 'vector',
        searchTimeMs: Date.now() - startTime,
        cacheHit: false,
      },
    };
  }
}

/**
 * Format search results into a prompt-friendly context string
 *
 * @param sources - Search results to format
 * @returns Formatted context string with citations
 */
export function formatSourcesForPrompt(sources: SearchResult[]): string {
  // Add defensive check
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return 'No relevant context found for this query.';
  }

  const MAX_TOKENS = 2000;
  const CHARS_PER_TOKEN = 4; // Approximate
  const maxChars = MAX_TOKENS * CHARS_PER_TOKEN;

  let context = '';
  let currentChars = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const citation = `[${i + 1}]`;

    // Build source header
    let header = `${citation} ${source.recordingTitle}`;

    // Add timestamp if available
    if (source.metadata.startTime) {
      const timestamp = formatTimestamp(source.metadata.startTime);
      header += ` (at ${timestamp})`;
    }

    // Add source type indicator
    const sourceType = source.metadata.source === 'transcript' ? '📝' : '📄';
    header += ` ${sourceType}`;

    // Add relevance indicator
    const relevance = Math.round(source.similarity * 100);
    header += ` [${relevance}% relevant]`;

    // Truncate chunk text if needed
    let chunkText = source.chunkText;
    const entryLength = header.length + chunkText.length + 10; // Buffer for formatting

    if (currentChars + entryLength > maxChars) {
      // Truncate to fit within limit
      const remainingChars = maxChars - currentChars - header.length - 50;
      if (remainingChars <= 0) break;

      chunkText = chunkText.substring(0, remainingChars) + '...';
    }

    // Add visual context if available
    if (source.metadata.visualDescription) {
      chunkText += `\n[Visual: ${source.metadata.visualDescription}]`;
    }

    const entry = `${header}\n${chunkText}\n\n`;
    context += entry;
    currentChars += entry.length;

    if (currentChars >= maxChars) break;
  }

  return context.trim();
}

/**
 * Extract and format source citations for UI display
 *
 * @param sources - Search results to extract citations from
 * @returns Array of formatted source citations
 */
export function extractSourceCitations(sources: SearchResult[]): SourceCitation[] {
  // Add defensive check
  if (!sources || !Array.isArray(sources)) {
    console.error('[ChatRAG] extractSourceCitations received non-array:', typeof sources);
    return [];
  }

  return sources.map((source) => {
    // Generate URL based on source type
    const url = source.metadata.source === 'transcript'
      ? `/recordings/${source.recordingId}?t=${source.metadata.startTime || 0}`
      : `/recordings/${source.recordingId}/document`;

    // Create excerpt (truncate if too long)
    const maxExcerptLength = 200;
    const excerpt = source.chunkText.length > maxExcerptLength
      ? source.chunkText.substring(0, maxExcerptLength) + '...'
      : source.chunkText;

    return {
      id: source.id,
      type: source.metadata.source,
      title: source.recordingTitle,
      excerpt,
      relevanceScore: source.similarity,
      recordingId: source.recordingId,
      timestamp: source.metadata.startTime,
      url,
      metadata: {
        chunkIndex: source.metadata.chunkIndex,
        startTime: source.metadata.startTime,
        endTime: source.metadata.endTime,
        hasVisualContext: source.metadata.hasVisualContext || false,
        visualDescription: source.metadata.visualDescription,
      },
    };
  });
}

/**
 * Cache search results in Redis
 *
 * @param query - Original query
 * @param orgId - Organization ID
 * @param context - RAG context to cache
 * @param options - Original search options
 */
export async function cacheSearchResults(
  query: string,
  orgId: string,
  context: RAGContext,
  options?: RAGOptions
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const cacheKey = generateCacheKey(query, orgId, options);
    const ttl = 3600; // 1 hour TTL

    // Store serialized context
    await redis.setex(
      cacheKey,
      ttl,
      JSON.stringify({
        ...context,
        cachedAt: new Date().toISOString(),
      })
    );

    // Also store in a query hash index for analytics
    const queryHash = createHash('sha256')
      .update(query.toLowerCase().trim())
      .digest('hex');

    await redis.zadd(
      `rag:queries:${orgId}`,
      Date.now(),
      queryHash
    );

    console.log('[ChatRAG] Cached search results:', {
      query: query.substring(0, 50),
      orgId,
      cacheKey,
      ttl,
    });

  } catch (error) {
    console.error('[ChatRAG] Failed to cache results:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Retrieve cached search results from Redis
 *
 * @param query - Original query
 * @param orgId - Organization ID
 * @param options - Original search options
 * @returns Cached RAG context or null if not found
 */
export async function getCachedSearchResults(
  query: string,
  orgId: string,
  options?: RAGOptions
): Promise<RAGContext | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cacheKey = generateCacheKey(query, orgId, options);
    const cached = await redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached as string);

      // Check if cache is still fresh (optional additional check)
      const cachedAt = new Date(parsed.cachedAt);
      const ageMs = Date.now() - cachedAt.getTime();
      const maxAgeMs = 3600000; // 1 hour

      if (ageMs > maxAgeMs) {
        // Cache is stale, delete it
        await redis.del(cacheKey);
        return null;
      }

      console.log('[ChatRAG] Cache hit:', {
        query: query.substring(0, 50),
        orgId,
        ageMs: Math.round(ageMs / 1000) + 's',
      });

      return parsed as RAGContext;
    }

    return null;

  } catch (error) {
    console.error('[ChatRAG] Failed to get cached results:', error);
    return null;
  }
}

/**
 * Clear cached results for an organization
 *
 * @param orgId - Organization ID
 * @returns Number of cleared entries
 */
export async function clearCacheForOrg(orgId: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    // Note: Upstash doesn't support pattern-based deletion
    // In production, consider tracking keys in a set
    const pattern = `rag:context:${orgId}:*`;

    // For now, just clear the query index
    const cleared = await redis.del(`rag:queries:${orgId}`);

    console.log('[ChatRAG] Cleared cache for org:', { orgId, cleared });
    return cleared;

  } catch (error) {
    console.error('[ChatRAG] Failed to clear cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics for monitoring
 *
 * @param orgId - Organization ID
 * @returns Cache statistics
 */
export async function getCacheStats(orgId: string): Promise<{
  totalQueries: number;
  recentQueries: number;
  oldestQuery?: Date;
  newestQuery?: Date;
}> {
  const redis = getRedisClient();
  if (!redis) {
    return {
      totalQueries: 0,
      recentQueries: 0,
    };
  }

  try {
    const key = `rag:queries:${orgId}`;

    // Get total count
    const totalQueries = await redis.zcard(key);

    // Get recent queries (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentQueries = await redis.zcount(key, oneHourAgo, '+inf');

    // Get oldest and newest
    const oldest = await redis.zrange(key, 0, 0, { withScores: true });
    const newest = await redis.zrange(key, -1, -1, { withScores: true });

    return {
      totalQueries,
      recentQueries,
      oldestQuery: oldest?.[0]?.score ? new Date(oldest[0].score) : undefined,
      newestQuery: newest?.[0]?.score ? new Date(newest[0].score) : undefined,
    };

  } catch (error) {
    console.error('[ChatRAG] Failed to get cache stats:', error);
    return {
      totalQueries: 0,
      recentQueries: 0,
    };
  }
}

/**
 * Helper: Get source filter based on options
 */
function getSourceFilter(
  includeTranscripts: boolean,
  includeDocuments: boolean
): 'transcript' | 'document' | undefined {
  if (includeTranscripts && !includeDocuments) return 'transcript';
  if (!includeTranscripts && includeDocuments) return 'document';
  return undefined; // Include both
}

/**
 * Helper: Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper: Estimate token count for a text
 * Uses a simple character-based approximation
 */
function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Pre-warm cache with common queries
 * Useful for improving response time for frequent queries
 *
 * @param orgId - Organization ID
 * @param commonQueries - List of common queries to pre-cache
 */
export async function prewarmCache(
  orgId: string,
  commonQueries: string[]
): Promise<void> {
  console.log('[ChatRAG] Pre-warming cache for', commonQueries.length, 'queries');

  for (const query of commonQueries) {
    try {
      // Check if already cached
      const cached = await getCachedSearchResults(query, orgId);
      if (!cached) {
        // Generate and cache
        await injectRAGContext(query, orgId, {
          enableCache: true,
          useHierarchical: true,
        });
      }
    } catch (error) {
      console.error('[ChatRAG] Failed to pre-warm query:', query, error);
    }
  }

  console.log('[ChatRAG] Cache pre-warming complete');
}