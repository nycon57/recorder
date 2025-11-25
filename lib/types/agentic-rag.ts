/**
 * Types for Agentic RAG System
 *
 * Multi-step retrieval with query decomposition, self-reflection, and citation tracking.
 */

import type { SearchResult } from '@/lib/services/vector-search-google';

export type QueryIntent =
  | 'single_fact' // Simple question with direct answer
  | 'multi_part' // Multiple questions in one
  | 'comparison' // Compare two or more things
  | 'exploration' // Open-ended research query
  | 'how_to'; // Procedural instructions

export interface SubQuery {
  id: string;
  text: string;
  intent: QueryIntent;
  dependency: string | null; // ID of sub-query this depends on
  priority: number; // 1-5, higher = more important
}

export interface QueryDecomposition {
  originalQuery: string;
  intent: QueryIntent;
  complexity: number; // 1-5
  subQueries: SubQuery[];
  reasoning: string; // Why this decomposition
}

export interface IterationResult {
  iterationNumber: number;
  subQuery: SubQuery;
  chunks: SearchResult[];
  confidence: number;
  gapsIdentified: string[];
  refinementNeeded: boolean;
  durationMs: number;
}

export interface AgenticSearchResult {
  query: string;
  intent: QueryIntent;
  decomposition: QueryDecomposition;
  iterations: IterationResult[];
  finalResults: SearchResult[];
  citationMap: Map<string, string[]>; // chunkId -> subQuery IDs
  reasoning: string;
  confidence: number;
  totalDurationMs: number;
  rerankingApplied?: boolean; // Whether reranking was applied to final results
  metadata: {
    iterationCount: number;
    chunksRetrieved: number;
    refinements: number;
    subQueriesExecuted: number;
  };
}

export interface RelevanceEvaluation {
  chunkId: string;
  isRelevant: boolean;
  confidence: number;
  reasoning: string;
}

export interface IntentClassification {
  intent: QueryIntent;
  confidence: number;
  reasoning: string;
  complexity: number; // 1-5 scale
}

export interface EvaluationResult {
  relevant: SearchResult[];
  irrelevant: SearchResult[];
  evaluations: RelevanceEvaluation[];
  avgConfidence: number;
  gapsIdentified: string[];
  needsRefinement: boolean;
}
