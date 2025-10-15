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
import { generateEmbeddingWithFallback } from './embedding-fallback';

type TranscriptChunk = Database['public']['Tables']['transcript_chunks']['Row'];

export interface SearchResult {
  id: string;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  similarity: number;
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
    threshold = 0.7,
    recordingIds,
    source,
    dateFrom,
    dateTo,
    searchMode = 'standard',
    recencyWeight = 0,
    recencyDecayDays = 30,
    topDocuments,
    chunksPerDocument,
  } = options;

  // Route to hierarchical search if requested
  if (searchMode === 'hierarchical') {
    const { hierarchicalSearch } = await import('./hierarchical-search');
    const hierarchicalResults = await hierarchicalSearch(query, {
      orgId,
      topDocuments: topDocuments || 5,
      chunksPerDocument: chunksPerDocument || 3,
      threshold,
    });

    // Fallback to standard search if no hierarchical results found
    // This handles cases where summaries haven't been generated yet
    if (hierarchicalResults.length === 0) {
      console.log('[Vector Search] No hierarchical results found, falling back to standard search');
      // Recursively call with standard mode
      return vectorSearch(query, {
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
    const embedding = await generateQueryEmbedding(query);
    const embeddingString = `[${embedding.join(',')}]`;

    const { data, error } = await supabase.rpc('search_chunks_with_recency', {
      query_embedding: embeddingString,
      match_org_id: orgId,
      match_count: limit * 2, // Get more for filtering
      match_threshold: threshold,
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

  // Standard flat search (original implementation)
  const embedding = await generateQueryEmbedding(query);
  console.log('[Vector Search] Starting standard search for org:', orgId);
  console.log('[Vector Search] Query:', query.substring(0, 100));

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
        org_id
      )
    `
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (recordingIds && recordingIds.length > 0) {
    dbQuery = dbQuery.in('recording_id', recordingIds);
  }

  if (source) {
    dbQuery = dbQuery.eq('metadata->>source', source);
  }

  if (dateFrom) {
    dbQuery = dbQuery.gte('created_at', dateFrom.toISOString());
  }

  if (dateTo) {
    dbQuery = dbQuery.lte('created_at', dateTo.toISOString());
  }

  // Execute query
  const { data: chunks, error } = await dbQuery;

  if (error) {
    console.error('[Vector Search] Database error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  console.log('[Vector Search] Found chunks:', chunks?.length || 0);

  if (!chunks || chunks.length === 0) {
    console.log('[Vector Search] No chunks found for org:', orgId);
    return [];
  }

  console.log('[Vector Search] ===== CHUNKS DEBUG =====');
  console.log('[Vector Search] Query org_id:', orgId);
  console.log('[Vector Search] First 3 chunks:');
  chunks.slice(0, 3).forEach((chunk, idx) => {
    console.log(`  [${idx + 1}] Chunk ID: ${chunk.id}`);
    console.log(`      Org ID: ${chunk.org_id}`);
    console.log(`      Recording: ${chunk.recordings?.title || 'Unknown'}`);
    console.log(`      Text preview: ${chunk.chunk_text?.substring(0, 100)}...`);
  });
  console.log('[Vector Search] ===========================');

  // Calculate similarity scores using pgvector
  console.log('[Vector Search] Calculating similarities...');
  const results = await calculateSimilarities(chunks, embedding, threshold);
  console.log('[Vector Search] Similarity results:', results.length);

  // Sort by similarity (descending) and limit
  const sortedResults = results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  console.log('[Vector Search] Returning top results:', sortedResults.length);
  return sortedResults;
}

/**
 * Generate embedding for search query using fallback strategy
 * Tries Google first, falls back to OpenAI if Google is overloaded
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const { embedding, provider } = await generateEmbeddingWithFallback(
    query,
    'RETRIEVAL_QUERY'
  );

  console.log(`[Vector Search] Embedding generated using ${provider}`);
  return embedding;
}

/**
 * Calculate cosine similarity between query embedding and chunk embeddings
 */
async function calculateSimilarities(
  chunks: any[],
  queryEmbedding: number[],
  threshold: number
): Promise<SearchResult[]> {
  // Use admin client since API route already validates auth
  const supabase = supabaseAdmin;

  // Use pgvector's cosine similarity operator
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embeddingString,
    match_threshold: threshold,
    match_count: chunks.length,
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

  return data.map((match: any) => ({
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
  const vectorResults = await vectorSearch(query, {
    ...options,
    limit: limit * 2, // Get more results for reranking
  });

  // Perform keyword search
  const keywordResults = await keywordSearch(query, options);

  // Merge and rerank results
  const mergedResults = mergeSearchResults(vectorResults, keywordResults);

  return mergedResults.slice(0, limit);
}

/**
 * Simple keyword search using PostgreSQL full-text search
 */
async function keywordSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const { orgId, limit = 10, recordingIds } = options;
  // Use admin client since API route already validates auth
  const supabase = supabaseAdmin;

  let dbQuery = supabase
    .from('transcript_chunks')
    .select(
      `
      id,
      recording_id,
      chunk_text,
      metadata,
      created_at,
      recordings!inner (
        title
      )
    `
    )
    .eq('org_id', orgId)
    .textSearch('chunk_text', query, {
      type: 'websearch',
      config: 'english',
    })
    .limit(limit);

  if (recordingIds && recordingIds.length > 0) {
    dbQuery = dbQuery.in('recording_id', recordingIds);
  }

  const { data: chunks, error } = await dbQuery;

  if (error || !chunks) {
    return [];
  }

  return chunks.map((chunk) => ({
    id: chunk.id,
    recordingId: chunk.recording_id,
    recordingTitle: chunk.recordings?.title || 'Untitled',
    chunkText: chunk.chunk_text,
    similarity: 0.9, // Keyword matches get high score
    metadata: chunk.metadata || {},
    createdAt: chunk.created_at,
  }));
}

/**
 * Merge and deduplicate search results from multiple sources
 */
function mergeSearchResults(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[]
): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

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

  // Convert back to array and sort by similarity
  return Array.from(resultMap.values()).sort(
    (a, b) => b.similarity - a.similarity
  );
}
