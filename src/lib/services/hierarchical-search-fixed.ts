/**
 * Hierarchical Search Service
 *
 * Implements two-tier retrieval (summary → chunks) to ensure document diversity.
 * Uses dual embeddings: 1536-dim for chunks, 3072-dim for summaries.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export interface HierarchicalSearchResult {
  id: string;
  contentId: string;
  contentTitle: string;
  chunkText: string;
  similarity: number;
  summarySimilarity: number;
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

export interface HierarchicalSearchOptions {
  /** Organization ID (required for scoping) */
  orgId: string;
  /** Number of documents to retrieve (default: 5) */
  topDocuments?: number;
  /** Number of chunks per document (default: 3) */
  chunksPerDocument?: number;
  /** Similarity threshold 0-1 (default: 0.7) */
  threshold?: number;
}

export interface DualEmbeddings {
  embedding1536: number[];
  embedding3072: number[];
}

/**
 * Generate dual embeddings for hierarchical search
 * - 1536-dim for chunk-level search
 * - 3072-dim for summary-level search
 */
export async function generateDualEmbeddings(
  text: string
): Promise<DualEmbeddings> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
  }

  const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

  try {
    // Generate embeddings in parallel with timeout protection
    const timeoutMs = 5000;
    const embeddingPromises = [
      // 1536-dim embedding (for chunks)
      Promise.race([
        genai.getGenerativeModel({ model: 'models/text-embedding-004' })
          // @ts-expect-error - Google AI SDK typing incompatibility
          .embedContent({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 1536,
          }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Embedding 1536 timeout')), timeoutMs)
        ),
      ]),
      // 3072-dim embedding (for summaries)
      Promise.race([
        genai.getGenerativeModel({ model: 'models/text-embedding-004' })
          // @ts-expect-error - Google AI SDK typing incompatibility
          .embedContent({
            content: { parts: [{ text }] },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 3072,
          }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Embedding 3072 timeout')), timeoutMs)
        ),
      ]),
    ];

    const [result1536, result3072] = await Promise.all(embeddingPromises) as any[];

    if (!result1536?.embedding?.values || !result3072?.embedding?.values) {
      throw new Error('Invalid embedding response from Google API');
    }

    return {
      embedding1536: result1536.embedding.values,
      embedding3072: result3072.embedding.values,
    };
  } catch (error) {
    console.error('[Hierarchical Search] Error generating dual embeddings:', error);
    throw new Error(`Failed to generate dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform hierarchical search using two-tier retrieval
 *
 * Step 1: Search summaries (3072-dim) to find relevant documents
 * Step 2: Search chunks (1536-dim) within those documents
 *
 * This ensures better document diversity compared to flat search.
 */
export async function hierarchicalSearch(
  query: string,
  options: HierarchicalSearchOptions
): Promise<HierarchicalSearchResult[]> {
  const {
    orgId,
    topDocuments = 5,
    chunksPerDocument = 3,
    threshold = 0.7,
  } = options;

  console.log(
    `[Hierarchical Search] Query: "${query.substring(0, 50)}...", orgId: ${orgId}, topDocuments: ${topDocuments}, chunksPerDocument: ${chunksPerDocument}`
  );

  try {
    // Step 1: Generate dual embeddings with timeout protection
    const startEmbedding = Date.now();
    const { embedding1536, embedding3072 } = await generateDualEmbeddings(query);
    const embeddingTime = Date.now() - startEmbedding;
    console.log(`[Hierarchical Search] Generated dual embeddings in ${embeddingTime}ms`);

    // Step 2: Call database function for hierarchical search
    const supabase = await createClient();
    const startSearch = Date.now();

    // Convert embeddings to PostgreSQL vector format
    const embedding1536String = `[${embedding1536.join(',')}]`;
    const embedding3072String = `[${embedding3072.join(',')}]`;

    const { data, error } = await supabase.rpc('hierarchical_search', {
      query_embedding_1536: embedding1536String,
      query_embedding_3072: embedding3072String,
      match_org_id: orgId,
      top_documents: topDocuments,
      chunks_per_document: chunksPerDocument,
      match_threshold: threshold,
    });

    const searchTime = Date.now() - startSearch;
    console.log(`[Hierarchical Search] Database search completed in ${searchTime}ms`);

    if (error) {
      console.error('[Hierarchical Search] Database error:', error);
      throw new Error(`Hierarchical search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log('[Hierarchical Search] No results found');
      return [];
    }

    // Step 3: Transform and deduplicate results with proper typing
    const results: HierarchicalSearchResult[] = data.map((row: any) => ({
      id: row.id,
      contentId: row.content_id,
      contentTitle: row.content_title,
      chunkText: row.chunk_text,
      similarity: row.similarity,
      summarySimilarity: row.summary_similarity,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    // Deduplicate by chunk ID (shouldn't be necessary, but safety check)
    const uniqueResults = deduplicateResults(results);

    console.log(
      `[Hierarchical Search] Returning ${uniqueResults.length} results from ${new Set(uniqueResults.map(r => r.contentId)).size} documents`
    );

    // Log document distribution
    const documentDistribution = uniqueResults.reduce((acc, result) => {
      acc[result.contentId] = (acc[result.contentId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('[Hierarchical Search] Document distribution:', documentDistribution);

    return uniqueResults;
  } catch (error) {
    console.error('[Hierarchical Search] Error:', error);
    throw error;
  }
}

/**
 * Deduplicate search results by chunk ID
 * Keeps the first occurrence (highest similarity)
 */
function deduplicateResults(
  results: HierarchicalSearchResult[]
): HierarchicalSearchResult[] {
  const seen = new Set<string>();
  const deduplicated: HierarchicalSearchResult[] = [];

  for (const result of results) {
    if (!seen.has(result.id)) {
      seen.add(result.id);
      deduplicated.push(result);
    }
  }

  if (deduplicated.length < results.length) {
    console.log(
      `[Hierarchical Search] Deduplicated ${results.length - deduplicated.length} duplicate results`
    );
  }

  return deduplicated;
}

/**
 * Search within a specific recording using hierarchical search
 */
export async function hierarchicalSearchRecording(
  contentId: string,
  query: string,
  orgId: string,
  options?: Partial<HierarchicalSearchOptions>
): Promise<HierarchicalSearchResult[]> {
  // For single recording search, we can use a simpler approach
  // since document diversity is not a concern
  // But we still use hierarchical search for consistency

  const results = await hierarchicalSearch(query, {
    ...options,
    orgId,
    topDocuments: 1, // Only one document (the recording)
    chunksPerDocument: options?.chunksPerDocument || 10, // Get more chunks from single doc
  });

  // Filter to only the target recording
  return results.filter((r) => r.contentId === contentId);
}

/**
 * Get recording summaries for a given organization
 * Useful for debugging and testing
 */
export async function getRecordingSummaries(
  orgId: string,
  limit: number = 10
): Promise<Array<{ contentId: string; summaryText: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_summaries')
    .select('content_id, summary_text')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Hierarchical Search] Error fetching summaries:', error);
    throw new Error(`Failed to fetch summaries: ${error.message}`);
  }

  return (data || []).map((row) => ({
    contentId: row.content_id,
    summaryText: row.summary_text,
  }));
}