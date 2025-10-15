/**
 * Reranking Service (Cohere)
 *
 * Uses Cohere's rerank API to improve search result quality by re-ordering results
 * based on semantic relevance to the query. This is an opt-in feature that provides
 * better ranking than cosine similarity alone.
 *
 * Cost Considerations:
 * - Cohere's rerank-english-v3.0 model charges per search unit
 * - 1 search unit = 1 query + 1 document
 * - Example: reranking 20 results = 20 search units
 * - Current pricing: ~$1 per 1000 search units (check Cohere pricing for latest)
 *
 * Performance:
 * - Target latency: 300-500ms for 20-50 documents
 * - Timeout set at 500ms to ensure fast responses
 * - Falls back to original results on timeout or error
 */

import { CohereClient } from 'cohere-ai';

import type { SearchResult } from '@/lib/services/vector-search-google';

/**
 * Options for reranking
 */
export interface RerankOptions {
  /** Number of top results to return after reranking (default: all) */
  topN?: number;
  /** Model to use for reranking (default: rerank-english-v3.0) */
  model?: string;
  /** Timeout in milliseconds (default: 500ms) */
  timeoutMs?: number;
}

/**
 * Reranking result with additional metadata
 */
export interface RerankResult {
  results: SearchResult[];
  rerankingTime: number;
  originalCount: number;
  rerankedCount: number;
  costEstimate?: number;
}

/**
 * Initialize Cohere client
 * Requires COHERE_API_KEY environment variable
 */
function getCohereClient(): CohereClient {
  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey) {
    throw new Error('COHERE_API_KEY environment variable is not set');
  }

  return new CohereClient({ token: apiKey });
}

/**
 * Rerank search results using Cohere's rerank API
 *
 * This function takes search results from vector similarity search and reranks them
 * using Cohere's neural reranking model, which typically provides better relevance
 * than cosine similarity alone.
 *
 * @param query - The search query
 * @param results - Array of search results from vector search
 * @param options - Reranking options
 * @returns Reranked results with metadata
 *
 * @example
 * ```typescript
 * const searchResults = await vectorSearch(query, options);
 * const reranked = await rerankResults(query, searchResults, { topN: 10 });
 * ```
 */
export async function rerankResults(
  query: string,
  results: SearchResult[],
  options?: RerankOptions
): Promise<RerankResult> {
  const startTime = Date.now();
  const {
    topN = results.length,
    model = 'rerank-english-v3.0',
    timeoutMs = 500,
  } = options || {};

  // Validate input parameters
  if (!query || query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }

  if (topN !== undefined && topN < 1) {
    throw new Error('topN must be at least 1');
  }

  if (timeoutMs < 100) {
    throw new Error('timeoutMs must be at least 100ms');
  }

  if (timeoutMs > 5000) {
    throw new Error('timeoutMs must be at most 5000ms');
  }

  // If no results or only one result, return immediately
  if (results.length <= 1) {
    return {
      results,
      rerankingTime: 0,
      originalCount: results.length,
      rerankedCount: results.length,
    };
  }

  try {
    // Initialize Cohere client
    const cohere = getCohereClient();

    // Prepare documents for reranking
    // Use chunk text as the document content
    const documents = results.map((result) => result.chunkText);

    // Create timeout promise
    // Note: The Cohere SDK doesn't support AbortSignal yet, so we use Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Reranking timeout')), timeoutMs);
    });

    // Call Cohere rerank API
    const rerankPromise = cohere.rerank({
      query,
      documents,
      topN: Math.min(topN, results.length),
      model,
    });

    // Race between rerank and timeout
    const response = await Promise.race([rerankPromise, timeoutPromise]);

    // Map Cohere results back to original SearchResult format
    const rerankedResults = response.results.map((result: { index: number; relevanceScore: number }) => {
      const originalResult = results[result.index];

      if (!originalResult) {
        throw new Error(`Invalid result index: ${result.index}`);
      }

      // Update similarity score with Cohere's relevance score
      // Cohere scores are typically 0-1, similar to cosine similarity
      return {
        ...originalResult,
        similarity: result.relevanceScore,
      };
    });

    const endTime = Date.now();
    const rerankingTime = endTime - startTime;

    // Calculate cost estimate (approximate)
    // Cost is based on number of search units (query + documents)
    const searchUnits = documents.length;
    const estimatedCostPerUnit = 0.001; // $1 per 1000 units
    const costEstimate = searchUnits * estimatedCostPerUnit;

    // Log reranking metrics for monitoring
    console.log('[Reranking] Completed:', {
      query: query.substring(0, 50),
      originalCount: results.length,
      rerankedCount: rerankedResults.length,
      rerankingTime,
      model,
      costEstimate: `$${costEstimate.toFixed(4)}`,
    });

    return {
      results: rerankedResults,
      rerankingTime,
      originalCount: results.length,
      rerankedCount: rerankedResults.length,
      costEstimate,
    };
  } catch (error: unknown) {
    // Log error but don't throw - fallback to original results
    console.error('[Reranking] Error:', {
      message: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 50),
      resultCount: results.length,
    });

    // If reranking fails, return original results
    const endTime = Date.now();
    return {
      results: results.slice(0, topN),
      rerankingTime: endTime - startTime,
      originalCount: results.length,
      rerankedCount: Math.min(topN, results.length),
    };
  }
}

/**
 * Check if Cohere API is configured
 * Useful for graceful degradation
 */
export function isCohereConfigured(): boolean {
  return !!process.env.COHERE_API_KEY;
}
