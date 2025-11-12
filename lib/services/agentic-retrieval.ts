/**
 * Agentic Retrieval Engine
 *
 * Orchestrates multi-step retrieval with query decomposition,
 * iterative refinement, and self-reflection.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  AgenticSearchResult,
  IterationResult,
  SubQuery,
  QueryDecomposition,
} from '@/lib/types/agentic-rag';

import { decomposeQuery, planExecutionOrder } from './query-decomposition';
import { evaluateResults } from './result-evaluator';
import { vectorSearch } from './vector-search-google';
import { rerankResults, isCohereConfigured } from './reranking';
import { CitationTracker } from './citation-tracker';
import type { SearchResult } from './vector-search-google';

export interface AgenticSearchOptions {
  orgId: string;
  userId?: string;
  maxIterations?: number;
  enableSelfReflection?: boolean;
  enableReranking?: boolean;
  chunksPerQuery?: number;
  recordingIds?: string[];
  contentTypes?: ('recording' | 'video' | 'audio' | 'document' | 'text')[];
  tagIds?: string[];
  tagFilterMode?: 'AND' | 'OR';
  collectionId?: string;
  favoritesOnly?: boolean;
  logResults?: boolean;
}

/**
 * Perform agentic search with multi-step reasoning
 */
export async function agenticSearch(
  query: string,
  options: AgenticSearchOptions
): Promise<AgenticSearchResult> {
  const startTime = Date.now();

  const {
    orgId,
    userId,
    maxIterations = parseInt(process.env.AGENTIC_MAX_ITERATIONS || '3'),
    enableSelfReflection = process.env.ENABLE_SELF_REFLECTION !== 'false',
    enableReranking = isCohereConfigured(),
    chunksPerQuery = 15,
    recordingIds,
    contentTypes,
    tagIds,
    tagFilterMode,
    collectionId,
    favoritesOnly,
    logResults = true,
  } = options;

  console.log('[Agentic Search] Starting:', {
    query: query.substring(0, 50),
    maxIterations,
    enableSelfReflection,
    enableReranking,
  });

  // Step 1: Decompose query
  const decomposition = await decomposeQuery(query);

  console.log('[Agentic Search] Decomposition:', {
    intent: decomposition.intent,
    complexity: decomposition.complexity,
    subQueryCount: decomposition.subQueries.length,
  });

  // Step 2: Plan execution order
  const executionBatches = planExecutionOrder(decomposition.subQueries);

  console.log('[Agentic Search] Execution plan:', {
    batchCount: executionBatches.length,
    parallelQueries: executionBatches[0]?.length || 0,
  });

  // Step 3: Initialize citation tracker
  const citationTracker = new CitationTracker();
  for (const subQuery of decomposition.subQueries) {
    citationTracker.registerSubQuery(subQuery);
  }

  // Step 4: Execute sub-queries iteratively
  const iterations: IterationResult[] = [];
  const allResults = new Map<string, SearchResult>();

  for (const [batchIndex, batch] of executionBatches.entries()) {
    console.log(
      `[Agentic Search] Executing batch ${batchIndex + 1}/${executionBatches.length}...`
    );

    // Execute queries in parallel within batch
    const batchResults = await Promise.all(
      batch.map(async (subQuery) => {
        const iterationStart = Date.now();

        // Retrieve results
        let results = await vectorSearch(subQuery.text, {
          orgId,
          limit: chunksPerQuery,
          threshold: 0.55, // Lowered from 0.70 - agentic search needs high recall for reasoning
          searchMode: 'standard',
          recordingIds,
          contentTypes,
          tagIds,
          tagFilterMode,
          collectionId,
          favoritesOnly,
        });

        // Re-rank if enabled
        if (enableReranking && results.length > 0) {
          const reranked = await rerankResults(subQuery.text, results, {
            topN: Math.ceil(chunksPerQuery / 2),
          });
          results = reranked.results;
        }

        // Evaluate if enabled
        let evaluation;
        let relevantResults = results;

        if (enableSelfReflection) {
          evaluation = await evaluateResults(subQuery.text, results);
          relevantResults = evaluation.relevant;
        }

        const iterationDuration = Date.now() - iterationStart;

        // Store results with citations
        for (const result of relevantResults) {
          allResults.set(result.id, result);
          citationTracker.addChunk(result, subQuery.id);
        }

        const iteration: IterationResult = {
          iterationNumber: batchIndex + 1,
          subQuery,
          chunks: relevantResults,
          confidence: evaluation?.avgConfidence || 0.8,
          gapsIdentified: evaluation?.gapsIdentified || [],
          refinementNeeded: evaluation?.needsRefinement || false,
          durationMs: iterationDuration,
        };

        iterations.push(iteration);

        return iteration;
      })
    );

    // Check if we should continue to next iteration
    const avgConfidence =
      batchResults.reduce((sum, r) => sum + r.confidence, 0) /
      batchResults.length;

    const hasGaps = batchResults.some((r) => r.gapsIdentified.length > 0);

    console.log(`[Agentic Search] Batch ${batchIndex + 1} complete:`, {
      resultsFound: Array.from(allResults.values()).length,
      avgConfidence,
      hasGaps,
    });

    // Stop if confidence is high and no gaps
    if (
      avgConfidence > 0.85 &&
      !hasGaps &&
      batchIndex < executionBatches.length - 1
    ) {
      console.log('[Agentic Search] High confidence - stopping early');
      break;
    }

    // Respect max iterations
    if (batchIndex >= maxIterations - 1) {
      console.log('[Agentic Search] Max iterations reached');
      break;
    }
  }

  // Step 5: Compile final results
  const finalResults = Array.from(allResults.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20); // Top 20 chunks

  const totalDuration = Date.now() - startTime;

  // Step 6: Generate reasoning path
  const reasoning = generateReasoningPath(decomposition, iterations);

  const avgConfidence =
    iterations.reduce((sum, i) => sum + i.confidence, 0) /
    Math.max(iterations.length, 1);

  console.log('[Agentic Search] Complete:', {
    finalResultCount: finalResults.length,
    iterations: iterations.length,
    avgConfidence,
    totalDurationMs: totalDuration,
  });

  const result: AgenticSearchResult = {
    query,
    intent: decomposition.intent,
    decomposition,
    iterations,
    finalResults,
    citationMap: citationTracker.getCitationMap(),
    reasoning,
    confidence: avgConfidence,
    totalDurationMs: totalDuration,
    metadata: {
      iterationCount: iterations.length,
      chunksRetrieved: allResults.size,
      refinements: iterations.filter((i) => i.refinementNeeded).length,
      subQueriesExecuted: decomposition.subQueries.length,
    },
  };

  // Step 7: Log results to database
  if (logResults) {
    await logAgenticSearch(result, orgId, userId);
  }

  return result;
}

/**
 * Generate human-readable reasoning path
 */
function generateReasoningPath(
  decomposition: QueryDecomposition,
  iterations: IterationResult[]
): string {
  const lines: string[] = [];

  lines.push(`Query Analysis: ${decomposition.reasoning}`);
  lines.push('');
  lines.push('Search Strategy:');

  for (const iteration of iterations) {
    lines.push(
      `${iteration.iterationNumber}. ${iteration.subQuery.text} → ${iteration.chunks.length} relevant chunks (confidence: ${(iteration.confidence * 100).toFixed(0)}%)`
    );

    if (iteration.gapsIdentified.length > 0) {
      lines.push(`   Gaps: ${iteration.gapsIdentified.join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Log agentic search execution to database
 */
async function logAgenticSearch(
  result: AgenticSearchResult,
  orgId: string,
  userId?: string
): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from('agentic_search_logs').insert({
      org_id: orgId,
      user_id: userId || null,
      original_query: result.query,
      query_intent: result.intent,
      subqueries: result.decomposition.subQueries,
      iterations: result.iterations.map((iter) => ({
        iteration: iter.iterationNumber,
        subQuery: iter.subQuery.text,
        chunksFound: iter.chunks.length,
        confidence: iter.confidence,
        gaps: iter.gapsIdentified,
        durationMs: iter.durationMs,
      })),
      final_results: result.finalResults.map((r) => r.id),
      total_duration_ms: result.totalDurationMs,
      chunks_retrieved: result.metadata.chunksRetrieved,
      confidence_score: result.confidence,
      reasoning_path: result.reasoning,
    });

    console.log('[Agentic Search] Logged to database');
  } catch (error) {
    console.error('[Agentic Search] Failed to log:', error);
    // Don't throw - logging failure shouldn't break the search
  }
}