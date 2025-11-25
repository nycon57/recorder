/**
 * Vector Search Service (Google Embeddings)
 *
 * Performs semantic search using pgvector similarity queries.
 * Uses Google text-embedding-004 for query embeddings.
 */

import { GoogleGenAI } from '@google/genai';

import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

import { EmbeddingCache } from './cache';
import { generateEmbeddingWithFallback } from './embedding-fallback';
import { expandShortQuery } from './query-preprocessor';

type TranscriptChunk = Database['public']['Tables']['transcript_chunks']['Row'];

// Embedding cache for common queries
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 100;

// Environment-based configuration
const DEFAULT_THRESHOLD = parseFloat(process.env.SEARCH_DEFAULT_THRESHOLD || '0.5');
const ENABLE_HYBRID = process.env.SEARCH_ENABLE_HYBRID !== 'false';
const ENABLE_QUERY_EXPANSION = process.env.SEARCH_ENABLE_QUERY_EXPANSION !== 'false';

export interface SearchResult {
  id: string;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  /** Similarity score 0-1. null when similarity calculation fails (indicates unknown relevance) */
  similarity: number | null;
  metadata: {
    source: 'transcript' | 'document';
    transcriptId?: string;
    documentId?: string;
    chunkIndex?: number;
    startTime?: number;
    endTime?: number;
    startChar?: number;
    endChar?: number;
  };
  createdAt: string;
}

/**
 * Calculate adaptive similarity threshold based on query characteristics
 *
 * Short, exploratory queries need lower thresholds for better recall.
 * Long, specific queries can use higher thresholds for precision.
 *
 * @param query - The user's search query
 * @returns Adjusted similarity threshold (based on DEFAULT_THRESHOLD)
 */
function getAdaptiveThreshold(query: string): number {
  const wordCount = query.trim().split(/\s+/).length;

  // Short queries (< 5 words) - exploratory, need high recall
  if (wordCount < 5) {
    return DEFAULT_THRESHOLD;
  }

  // Medium queries (5-10 words) - balanced approach
  if (wordCount <= 10) {
    return Math.min(DEFAULT_THRESHOLD + 0.05, 0.7);
  }

  // Long, specific queries - can be more precise
  return Math.min(DEFAULT_THRESHOLD + 0.15, 0.7);
}

export interface SearchOptions {
  /** Organization ID (required for scoping) */
  orgId: string;
  /** Number of results to return (default: 10) */
  limit?: number;
  /** Similarity threshold 0-1 (default: 0.7) */
  threshold?: number;
  /** Filter by recording IDs */
  recordingIds?: string[];
  /** Filter by source type */
  source?: 'transcript' | 'document';
  /** Filter by date range */
  dateFrom?: Date;
  dateTo?: Date;
  /** Search mode: standard (flat), hierarchical (summary→chunks) */
  searchMode?: 'standard' | 'hierarchical';
  /** Recency weight 0-1 (0 = no bias, 1 = max bias, default: 0) */
  recencyWeight?: number;
  /** Days until recency score decays to 0 (default: 30) */
  recencyDecayDays?: number;
  /** For hierarchical mode: number of documents to retrieve */
  topDocuments?: number;
  /** For hierarchical mode: chunks per document */
  chunksPerDocument?: number;
  /** Enable Cohere reranking for improved relevance (default: false) */
  rerank?: boolean;
  /** Filter by content types */
  contentTypes?: ('recording' | 'video' | 'audio' | 'document' | 'text')[];
  /** Filter by tag IDs */
  tagIds?: string[];
  /** Tag filter mode: 'AND' requires all tags, 'OR' requires any tag (default: 'OR') */
  tagFilterMode?: 'AND' | 'OR';
  /** Filter by collection ID */
  collectionId?: string;
  /** Filter to only show favorited recordings */
  favoritesOnly?: boolean;
}

/**
 * Perform semantic search using vector similarity
 *
 * Supports multiple search modes:
 * - standard: Flat vector search across all chunks
 * - hierarchical: Two-tier search (summaries → chunks) for better document diversity
 *
 * Also supports recency bias to prioritize recent recordings.
 */
export async function vectorSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    orgId,
    limit = 10,
    threshold,
    recordingIds,
    source,
    dateFrom,
    dateTo,
    searchMode = 'standard',
    recencyWeight = 0,
    recencyDecayDays = 30,
    topDocuments,
    chunksPerDocument,
    contentTypes,
    tagIds,
    tagFilterMode = 'OR',
    collectionId,
    favoritesOnly = false,
  } = options;

  // Calculate adaptive threshold if not provided
  const adaptiveThreshold = threshold ?? getAdaptiveThreshold(query);
  const wordCount = query.trim().split(/\s+/).length;

  // Expand short queries for better recall (if enabled)
  let processedQuery = query;
  if (ENABLE_QUERY_EXPANSION && wordCount <= 2) {
    processedQuery = await expandShortQuery(query, orgId);
    if (processedQuery !== query) {
      console.log('[Vector Search] Query expanded:', {
        original: query,
        expanded: processedQuery,
      });
    }
  }

  console.log('[Vector Search] Using adaptive threshold:', {
    query: processedQuery.substring(0, 50),
    wordCount: wordCount,
    threshold: adaptiveThreshold,
  });

  // For short queries, use hybrid search for better results (if enabled)
  // Skip if already in a hybrid context (prevent infinite recursion)
  const isHybridContext = (options as any).__isHybridContext === true;
  if (ENABLE_HYBRID && wordCount < 5 && searchMode === 'standard' && !isHybridContext) {
    console.log('[Vector Search] Using hybrid search for short query');
    return await hybridSearch(processedQuery, {
      ...options,
      threshold: adaptiveThreshold,
    });
  }

  // Route to hierarchical search if requested
  if (searchMode === 'hierarchical') {
    const { hierarchicalSearch } = await import('./hierarchical-search');
    const hierarchicalResults = await hierarchicalSearch(processedQuery, {
      orgId,
      topDocuments: topDocuments || 5,
      chunksPerDocument: chunksPerDocument || 3,
      threshold: adaptiveThreshold,
    });

    // Fallback to standard search if no hierarchical results found
    // This handles cases where summaries haven't been generated yet
    if (hierarchicalResults.length === 0) {
      console.log('[Vector Search] No hierarchical results found, falling back to standard search');
      // Recursively call with standard mode
      return vectorSearch(processedQuery, {
        ...options,
        searchMode: 'standard',
      });
    }

    // Convert hierarchical results to standard format
    const results: SearchResult[] = hierarchicalResults.map((r) => ({
      id: r.id,
      recordingId: r.recordingId,
      recordingTitle: r.recordingTitle,
      chunkText: r.chunkText,
      similarity: r.similarity,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));

    // Apply additional filters if specified
    let filteredResults = results;

    if (recordingIds && recordingIds.length > 0) {
      filteredResults = filteredResults.filter((r) =>
        recordingIds.includes(r.recordingId)
      );
    }

    if (source) {
      filteredResults = filteredResults.filter(
        (r) => r.metadata.source === source
      );
    }

    if (dateFrom) {
      filteredResults = filteredResults.filter(
        (r) => new Date(r.createdAt) >= dateFrom
      );
    }

    if (dateTo) {
      filteredResults = filteredResults.filter(
        (r) => new Date(r.createdAt) <= dateTo
      );
    }

    return filteredResults.slice(0, limit);
  }

  // Standard search mode with optional recency bias
  // Use admin client since API route already validates auth
  const supabase = supabaseAdmin;

  // Use recency-biased search if recencyWeight > 0
  if (recencyWeight > 0) {
    const embedding = await generateQueryEmbedding(processedQuery, orgId);
    const embeddingString = `[${embedding.join(',')}]`;

    const { data, error } = await supabase.rpc('search_chunks_with_recency', {
      query_embedding: embeddingString,
      match_org_id: orgId,
      match_count: limit * 2, // Get more for filtering
      match_threshold: adaptiveThreshold,
      recency_weight: recencyWeight,
      recency_decay_days: recencyDecayDays,
    });

    if (error) {
      console.error('[Vector Search] Recency search error:', error);
      throw new Error(`Vector search with recency failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert to SearchResult format
    let results: SearchResult[] = data.map((row: any) => ({
      id: row.id,
      recordingId: row.recording_id,
      recordingTitle: row.recording_title,
      chunkText: row.chunk_text,
      similarity: row.final_score, // Use final_score which includes recency
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    // Apply additional filters
    if (recordingIds && recordingIds.length > 0) {
      results = results.filter((r) => recordingIds.includes(r.recordingId));
    }

    if (source) {
      results = results.filter((r) => r.metadata.source === source);
    }

    if (dateFrom) {
      results = results.filter((r) => new Date(r.createdAt) >= dateFrom);
    }

    if (dateTo) {
      results = results.filter((r) => new Date(r.createdAt) <= dateTo);
    }

    return results.slice(0, limit);
  }

  // PERF-DB-003: Push all filters to database for 30-40% less data transfer
  // Standard flat search - now uses enhanced match_chunks with all filters
  const embedding = await generateQueryEmbedding(processedQuery, orgId);
  console.log('[Vector Search] Starting optimized search for org:', orgId);
  console.log('[Vector Search] Query:', processedQuery.substring(0, 100));

  // For complex filters (tags, collections, favorites), we need pre-filtering
  // to get eligible recording IDs first
  const needsPreFiltering = (tagIds && tagIds.length > 0) || collectionId || favoritesOnly;
  let eligibleRecordingIds: string[] | undefined = recordingIds;

  if (needsPreFiltering) {
    // Get eligible recording IDs based on complex filters (tags, collections, favorites)
    eligibleRecordingIds = await getEligibleRecordingIds(supabase, orgId, {
      recordingIds,
      tagIds,
      tagFilterMode,
      collectionId,
      favoritesOnly,
    });

    // Short-circuit if no eligible recordings found
    if (eligibleRecordingIds !== undefined && eligibleRecordingIds.length === 0) {
      console.log('[Vector Search] No recordings match complex filters');
      return [];
    }
  }

  // PERF-DB-003: Single database call with all filters pushed to match_chunks RPC
  // This eliminates the previous pattern of: fetch chunks → calculate similarities → JS filter
  const embeddingString = `[${embedding.join(',')}]`;

  console.log('[Vector Search] Calling enhanced match_chunks with filters:', {
    threshold: adaptiveThreshold,
    hasRecordingIds: !!eligibleRecordingIds,
    source,
    dateFrom: dateFrom?.toISOString(),
    dateTo: dateTo?.toISOString(),
    contentTypes,
  });

  const { data: results, error } = await supabase.rpc('match_chunks', {
    query_embedding: embeddingString,
    match_threshold: adaptiveThreshold,
    match_count: limit * 2, // Get extra for any edge case filtering
    filter_org_id: orgId,
    filter_recording_ids: eligibleRecordingIds || null,
    filter_source: source || null,
    filter_date_from: dateFrom?.toISOString() || null,
    filter_date_to: dateTo?.toISOString() || null,
    filter_content_types: contentTypes || null,
    exclude_deleted: true,
  });

  if (error) {
    console.error('[Vector Search] Database error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  console.log('[Vector Search] Results from database:', results?.length || 0);

  if (!results || results.length === 0) {
    console.log('[Vector Search] No matching chunks found');
    return [];
  }

  // Calculate statistics for monitoring
  const similarities = results.map((r: any) => r.similarity).filter((s: number) => s !== null);
  const avgSimilarity = similarities.length > 0
    ? similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length
    : 0;
  const minSimilarity = Math.min(...similarities);
  const maxSimilarity = Math.max(...similarities);

  console.log('[Vector Search] Search stats:', {
    resultsReturned: results.length,
    averageSimilarity: avgSimilarity.toFixed(3),
    minSimilarity: minSimilarity.toFixed(3),
    maxSimilarity: maxSimilarity.toFixed(3),
    threshold: adaptiveThreshold,
  });

  // Convert to SearchResult format and return top results
  const searchResults: SearchResult[] = results
    .slice(0, limit)
    .map((match: any) => ({
      id: match.id,
      recordingId: match.recording_id,
      recordingTitle: match.recording_title || 'Untitled',
      chunkText: match.chunk_text,
      similarity: match.similarity,
      metadata: match.metadata || {},
      createdAt: match.created_at,
    }));

  console.log('[Vector Search] Returning top results:', searchResults.length);
  return searchResults;
}

/**
 * Get eligible recording IDs based on complex filters (tags, collections, favorites)
 * Encapsulates tag (AND/OR), collection, and favorites filtering logic
 *
 * @returns Array of eligible recording IDs, or undefined if no filtering needed
 */
async function getEligibleRecordingIds(
  supabase: ReturnType<typeof supabaseAdmin>,
  orgId: string,
  filters: {
    recordingIds?: string[];
    tagIds?: string[];
    tagFilterMode?: 'AND' | 'OR';
    collectionId?: string;
    favoritesOnly?: boolean;
  }
): Promise<string[] | undefined> {
  const { recordingIds, tagIds, tagFilterMode = 'OR', collectionId, favoritesOnly } = filters;

  let eligibleRecordingIds = recordingIds ? [...recordingIds] : undefined;

  // Filter by tags
  if (tagIds && tagIds.length > 0) {
    const { data: taggedRecordings, error: tagError } = await supabase
      .from('recording_tags')
      .select('recording_id')
      .in('tag_id', tagIds)
      .eq('org_id', orgId);

    if (tagError) {
      console.error('[Vector Search] Tag filter error:', tagError);
      return [];
    }

    const taggedIds = taggedRecordings?.map(r => r.recording_id) || [];

    if (tagFilterMode === 'AND') {
      // For AND mode: count how many tags each recording has
      const recordingTagCounts = taggedIds.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Only keep recordings that have ALL the specified tags
      const fullyTaggedIds = Object.entries(recordingTagCounts)
        .filter(([_, count]) => count === tagIds.length)
        .map(([id]) => id);

      eligibleRecordingIds = eligibleRecordingIds
        ? eligibleRecordingIds.filter(id => fullyTaggedIds.includes(id))
        : fullyTaggedIds;
    } else {
      // For OR mode: recording must have ANY of the tags
      const uniqueTaggedIds = [...new Set(taggedIds)];
      eligibleRecordingIds = eligibleRecordingIds
        ? eligibleRecordingIds.filter(id => uniqueTaggedIds.includes(id))
        : uniqueTaggedIds;
    }

    if (eligibleRecordingIds && eligibleRecordingIds.length === 0) {
      return []; // No recordings match tag filter
    }
  }

  // Filter by collection
  if (collectionId) {
    const { data: collectionItems, error: collectionError } = await supabase
      .from('collection_items')
      .select('item_id')
      .eq('collection_id', collectionId)
      .eq('org_id', orgId);

    if (collectionError) {
      console.error('[Vector Search] Collection filter error:', collectionError);
      return [];
    }

    const collectionRecordingIds = collectionItems?.map(i => i.item_id) || [];

    eligibleRecordingIds = eligibleRecordingIds
      ? eligibleRecordingIds.filter(id => collectionRecordingIds.includes(id))
      : collectionRecordingIds;

    if (eligibleRecordingIds && eligibleRecordingIds.length === 0) {
      return []; // No recordings in collection
    }
  }

  // Filter by favorites
  if (favoritesOnly) {
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select('recording_id')
      .eq('org_id', orgId);

    if (favoritesError) {
      console.error('[Vector Search] Favorites filter error:', favoritesError);
      return [];
    }

    const favoriteRecordingIds = favorites?.map(f => f.recording_id) || [];

    eligibleRecordingIds = eligibleRecordingIds
      ? eligibleRecordingIds.filter(id => favoriteRecordingIds.includes(id))
      : favoriteRecordingIds;

    if (eligibleRecordingIds && eligibleRecordingIds.length === 0) {
      return []; // No favorite recordings
    }
  }

  return eligibleRecordingIds;
}

/**
 * Execute search with complex filters (tags, collections, favorites)
 * Fetches eligible recording IDs first, then performs vector search
 */
async function executeComplexFilteredSearch(
  queryEmbedding: number[],
  orgId: string,
  filters: {
    recordingIds?: string[];
    source?: 'transcript' | 'document';
    dateFrom?: Date;
    dateTo?: Date;
    contentTypes?: string[];
    tagIds?: string[];
    tagFilterMode?: 'AND' | 'OR';
    collectionId?: string;
    favoritesOnly?: boolean;
  },
  limit: number
): Promise<SearchResult[]> {
  const supabase = supabaseAdmin;
  const {
    recordingIds,
    source,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode = 'OR',
    collectionId,
    favoritesOnly,
  } = filters;

  // Step 1: Get eligible recording IDs based on complex filters
  const eligibleRecordingIds = await getEligibleRecordingIds(supabase, orgId, {
    recordingIds,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
  });

  // Short-circuit if no eligible recordings found
  if (eligibleRecordingIds !== undefined && eligibleRecordingIds.length === 0) {
    return [];
  }

  // Step 2: Query chunks for eligible recordings
  let dbQuery = supabase
    .from('transcript_chunks')
    .select(
      `
      id,
      recording_id,
      chunk_text,
      metadata,
      created_at,
      org_id,
      recordings!inner (
        title,
        created_at,
        org_id,
        content_type,
        deleted_at
      )
    `
    )
    .eq('org_id', orgId)
    .is('recordings.deleted_at', null); // Exclude trashed items

  // Apply recording ID filter if we have one
  if (eligibleRecordingIds && eligibleRecordingIds.length > 0) {
    dbQuery = dbQuery.in('recording_id', eligibleRecordingIds);
  }

  // Apply remaining simple filters
  if (source) {
    dbQuery = dbQuery.eq('metadata->>source', source);
  }

  if (dateFrom) {
    dbQuery = dbQuery.gte('created_at', dateFrom.toISOString());
  }

  if (dateTo) {
    dbQuery = dbQuery.lte('created_at', dateTo.toISOString());
  }

  if (contentTypes && contentTypes.length > 0) {
    dbQuery = dbQuery.in('recordings.content_type', contentTypes);
  }

  dbQuery = dbQuery.order('created_at', { ascending: false }).limit(limit);

  const { data: chunks, error } = await dbQuery;

  if (error) {
    console.error('[Vector Search] Complex filter query error:', error);
    return [];
  }

  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Create a Set of allowed chunk IDs from our filtered chunks
  // This ensures we only return chunks that passed our filters (including deleted_at)
  const allowedChunkIds = new Set(chunks.map((chunk: any) => chunk.id));

  // Step 3: Calculate similarities
  const embeddingString = `[${queryEmbedding.join(',')}]`;
  const { data: matches, error: matchError } = await supabase.rpc('match_chunks', {
    query_embedding: embeddingString,
    match_threshold: 0.5, // Using lower threshold for complex filtered searches
    match_count: chunks.length * 2, // Get more results for filtering
    filter_org_id: orgId,
  });

  if (matchError) {
    console.error('[Vector Search] Similarity calculation error:', matchError, matchError.stack);
    // Return chunks with null similarity to indicate calculation failure
    return chunks.map((chunk: any) => ({
      id: chunk.id,
      recordingId: chunk.recording_id,
      recordingTitle: chunk.recordings?.title || 'Untitled',
      chunkText: chunk.chunk_text,
      similarity: null, // null indicates unknown relevance (calculation failed)
      metadata: chunk.metadata || {},
      createdAt: chunk.created_at,
    }));
  }

  // Filter match_chunks results to only include chunks from our filtered set
  // This ensures trashed recordings are excluded
  return matches
    .filter((match: any) => allowedChunkIds.has(match.id))
    .map((match: any) => ({
      id: match.id,
      recordingId: match.recording_id,
      recordingTitle: match.recording_title,
      chunkText: match.chunk_text,
      similarity: match.similarity,
      metadata: match.metadata || {},
      createdAt: match.created_at,
    }))
    .sort((a, b) => {
      // Handle null similarities: push null values to the end
      if (a.similarity === null && b.similarity === null) return 0;
      if (a.similarity === null) return 1;
      if (b.similarity === null) return -1;
      return b.similarity - a.similarity;
    })
    .slice(0, limit);
}

/**
 * Generate embedding for search query using fallback strategy
 * Tries Google first, falls back to OpenAI if Google is overloaded
 *
 * Uses a two-tier caching strategy:
 * 1. Redis cache (24h TTL) - Persistent across server restarts, reduces API costs
 * 2. In-memory cache (100 items) - Fast access for hot queries within a server instance
 *
 * Expected savings: 20-35% reduction in embedding API calls for repeated queries
 */
async function generateQueryEmbedding(query: string, orgId: string): Promise<number[]> {
  // Normalize query for consistent caching
  const normalizedQuery = EmbeddingCache.normalizeQuery(query);

  // Tier 1: Check in-memory cache first (fastest)
  const memCacheKey = `${normalizedQuery}:${orgId}`;
  if (embeddingCache.has(memCacheKey)) {
    console.log('[Vector Search] Using in-memory cached embedding');
    return embeddingCache.get(memCacheKey)!;
  }

  // Tier 2: Check Redis cache (persistent, shared across instances)
  try {
    const redisCached = await EmbeddingCache.get(normalizedQuery, orgId);
    if (redisCached) {
      console.log('[Vector Search] Using Redis cached embedding');
      // Also populate in-memory cache for faster subsequent access
      if (embeddingCache.size >= CACHE_MAX_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
      }
      embeddingCache.set(memCacheKey, redisCached);
      return redisCached;
    }
  } catch (error) {
    console.warn('[Vector Search] Redis cache lookup failed, generating fresh embedding:', error);
    // Continue to generate embedding - caching is an optimization, not critical
  }

  // Cache miss - generate new embedding
  const { embedding, provider } = await generateEmbeddingWithFallback(
    normalizedQuery,
    'RETRIEVAL_QUERY'
  );

  console.log(`[Vector Search] Embedding generated using ${provider}`);

  // Cache in both tiers
  // Tier 1: In-memory cache (with LRU eviction)
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(memCacheKey, embedding);

  // Tier 2: Redis cache (async, non-blocking)
  EmbeddingCache.set(normalizedQuery, orgId, embedding).catch((error) => {
    console.warn('[Vector Search] Failed to cache embedding in Redis:', error);
  });

  return embedding;
}

/**
 * Calculate cosine similarity between query embedding and chunk embeddings
 */
async function calculateSimilarities(
  chunks: any[],
  queryEmbedding: number[],
  threshold: number,
  orgId: string
): Promise<SearchResult[]> {
  // Use admin client since API route already validates auth
  const supabase = supabaseAdmin;

  // Create a Set of allowed chunk IDs from our filtered chunks
  // This ensures we only return chunks that passed our filters (including deleted_at)
  const allowedChunkIds = new Set(chunks.map((chunk) => chunk.id));

  // Use pgvector's cosine similarity operator
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embeddingString,
    match_threshold: threshold,
    match_count: chunks.length * 2, // Get more results for filtering
    filter_org_id: orgId, // CRITICAL: Filter by org_id to ensure proper isolation
  });

  if (error) {
    console.error('Similarity calculation error:', error);
    // Fallback to client-side calculation if RPC fails
    return chunks
      .map((chunk) => ({
        id: chunk.id,
        recordingId: chunk.recording_id,
        recordingTitle: chunk.recordings?.title || 'Untitled',
        chunkText: chunk.chunk_text,
        similarity: 0.8, // Placeholder
        metadata: chunk.metadata || {},
        createdAt: chunk.created_at,
      }))
      .filter((r) => r.similarity >= threshold);
  }

  // Filter match_chunks results to only include chunks from our filtered set
  // This ensures trashed recordings are excluded
  return data
    .filter((match: any) => allowedChunkIds.has(match.id))
    .map((match: any) => ({
      id: match.id,
      recordingId: match.recording_id,
      recordingTitle: match.recording_title,
      chunkText: match.chunk_text,
      similarity: match.similarity,
      metadata: match.metadata || {},
      createdAt: match.created_at,
    }));
}

/**
 * Search within a specific recording
 */
export async function searchRecording(
  recordingId: string,
  query: string,
  orgId: string,
  options?: Partial<SearchOptions>
): Promise<SearchResult[]> {
  return vectorSearch(query, {
    ...options,
    orgId,
    recordingIds: [recordingId],
  });
}

/**
 * Get similar chunks to a given chunk (for "related content" features)
 */
export async function findSimilarChunks(
  chunkId: string,
  orgId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  // Use admin client since this is called from authenticated context
  const supabase = supabaseAdmin;

  // Get the original chunk
  const { data: chunk, error: chunkError } = await supabase
    .from('transcript_chunks')
    .select('chunk_text, embedding')
    .eq('id', chunkId)
    .single();

  if (chunkError || !chunk) {
    throw new Error('Chunk not found');
  }

  // Use the chunk's embedding to find similar content
  return vectorSearch(chunk.chunk_text, {
    orgId,
    limit: limit + 1, // +1 to exclude the original chunk
    threshold: 0.6, // Lower threshold for related content
  }).then((results) =>
    // Filter out the original chunk
    results.filter((r) => r.id !== chunkId).slice(0, limit)
  );
}

/**
 * Hybrid search: combines vector search with keyword matching
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { limit = 10 } = options;

  // Perform vector search
  // IMPORTANT: Set __isHybridContext flag to prevent infinite recursion
  const vectorResults = await vectorSearch(query, {
    ...options,
    searchMode: 'standard', // Explicitly set to prevent hybrid routing loop
    limit: limit * 2, // Get more results for reranking
    __isHybridContext: true, // Internal flag to prevent re-entry
  } as SearchOptions);

  // Perform keyword search
  const keywordResults = await keywordSearch(query, options);

  // Merge and rerank results
  const mergedResults = mergeSearchResults(vectorResults, keywordResults, query);

  return mergedResults.slice(0, limit);
}

/**
 * Simple keyword search using PostgreSQL full-text search
 * PERF-DB-003: Now uses optimized search_chunks_text RPC with all filters pushed to DB
 */
async function keywordSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    orgId,
    limit = 10,
    recordingIds,
    source,
    dateFrom,
    dateTo,
    contentTypes,
    tagIds,
    tagFilterMode = 'OR',
    collectionId,
    favoritesOnly = false,
  } = options;

  // Use admin client since API route already validates auth
  const supabase = supabaseAdmin;

  // Get eligible recording IDs based on complex filters (tags, collections, favorites)
  let eligibleRecordingIds: string[] | undefined = recordingIds;

  const needsPreFiltering = (tagIds && tagIds.length > 0) || collectionId || favoritesOnly;
  if (needsPreFiltering) {
    eligibleRecordingIds = await getEligibleRecordingIds(supabase, orgId, {
      recordingIds,
      tagIds,
      tagFilterMode,
      collectionId,
      favoritesOnly,
    });

    // Short-circuit if no eligible recordings found
    if (eligibleRecordingIds !== undefined && eligibleRecordingIds.length === 0) {
      return [];
    }
  }

  // PERF-DB-003: Use optimized RPC with all filters pushed to database
  const { data: results, error } = await supabase.rpc('search_chunks_text', {
    search_query: query,
    filter_org_id: orgId,
    match_count: limit,
    filter_recording_ids: eligibleRecordingIds || null,
    filter_source: source || null,
    filter_date_from: dateFrom?.toISOString() || null,
    filter_date_to: dateTo?.toISOString() || null,
    filter_content_types: contentTypes || null,
  });

  if (error || !results) {
    console.warn('[Keyword Search] Error:', error?.message);
    return [];
  }

  return results.map((match: any) => ({
    id: match.id,
    recordingId: match.recording_id,
    recordingTitle: match.recording_title || 'Untitled',
    chunkText: match.chunk_text,
    similarity: Math.min(0.95, 0.7 + match.rank * 0.3), // Convert rank to similarity score
    metadata: match.metadata || {},
    createdAt: match.created_at,
  }));
}

/**
 * Merge and deduplicate search results from multiple sources
 */
function mergeSearchResults(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  query: string
): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();
  const queryTerms = query.toLowerCase().split(/\s+/);

  // Add vector results
  vectorResults.forEach((result) => {
    resultMap.set(result.id, result);
  });

  // Add keyword results, boosting score if already present
  keywordResults.forEach((result) => {
    const existing = resultMap.get(result.id);
    if (existing) {
      // Boost similarity score for items found in both searches
      existing.similarity = Math.min(1.0, existing.similarity * 1.2);
    } else {
      resultMap.set(result.id, result);
    }
  });

  // Apply keyword boosting: if title/text contains query terms, boost score
  const boostedResults = Array.from(resultMap.values()).map((result) => {
    let boost = 1.0;
    const titleLower = result.recordingTitle.toLowerCase();
    const textLower = result.chunkText.toLowerCase();

    // Check if title or text contains any query terms
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        boost *= 1.3; // 30% boost for title match
      }
      if (textLower.includes(term)) {
        boost *= 1.1; // 10% boost for text match
      }
    }

    // Apply boost but cap at 1.0
    if (boost > 1.0) {
      result.similarity = Math.min(1.0, result.similarity * boost);
    }

    return result;
  });

  // Convert back to array and sort by similarity
  return boostedResults.sort(
    (a, b) => b.similarity - a.similarity
  );
}
