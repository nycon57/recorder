/**
 * Query Router Service
 *
 * Intelligently routes queries to the appropriate retrieval strategy based on:
 * - Query intent (exploration, specific fact, multi-topic, comparison)
 * - Query complexity (1-5 scale)
 * - Available resources (recordings count, summaries availability)
 *
 * This ensures optimal performance and result quality for different query types.
 */

import { classifyQueryIntent, type IntentClassification } from './query-intent';
import type { SearchResult } from './vector-search-google';

export type RetrievalStrategy =
  | 'direct_listing'    // List recordings directly (e.g., "what can you help me with?")
  | 'topic_overview'    // Aggregate by topics (e.g., "what topics do you know about?")
  | 'standard_search'   // Simple vector search (e.g., "how do I configure X?")
  | 'hierarchical_search' // Two-tier search for document diversity
  | 'agentic_search'    // Multi-step reasoning for complex queries
  | 'comparison_search'; // Dual retrieval for comparisons

export interface QueryRoute {
  strategy: RetrievalStrategy;
  intent: IntentClassification;
  reasoning: string;
  config: {
    useAgentic?: boolean;
    useHierarchical?: boolean;
    useReranking?: boolean;
    maxChunks?: number;
    threshold?: number;
    enableSelfReflection?: boolean;
    maxIterations?: number;
  };
}

/**
 * Heuristics for detecting exploratory/overview queries
 */
const EXPLORATORY_PATTERNS = [
  /^what (can|do) you (help|teach|instruct|tell|show)/i,
  /^what (do you|topics|subjects|things)/i,
  /^(tell|show) me (about )?(what|everything|all)/i,
  /^what('s| is) (available|here|in)/i,
  /^give me (an )?overview/i,
  /^list (all|everything|topics)/i,
  /^browse (recordings|content|topics)/i,
];

/**
 * Heuristics for detecting topic overview queries
 */
const TOPIC_OVERVIEW_PATTERNS = [
  /what topics/i,
  /what subjects/i,
  /what categories/i,
  /what areas/i,
  /what kinds of/i,
  /what types of/i,
];

/**
 * Determine if query is exploratory (wants overview of all content)
 */
function isExploratoryQuery(query: string): boolean {
  return EXPLORATORY_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Determine if query wants topic overview
 */
function isTopicOverviewQuery(query: string): boolean {
  return TOPIC_OVERVIEW_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Route query to appropriate retrieval strategy
 */
export async function routeQuery(
  query: string,
  context?: {
    recordingsCount?: number;
    hasSummaries?: boolean;
    hasReranking?: boolean;
  }
): Promise<QueryRoute> {
  const { recordingsCount = 0, hasSummaries = false, hasReranking = false } = context || {};

  // Quick check: If no recordings, don't bother with complex routing
  if (recordingsCount === 0) {
    return {
      strategy: 'direct_listing',
      intent: {
        intent: 'exploration',
        confidence: 1.0,
        complexity: 1,
        reasoning: 'No recordings available',
      },
      reasoning: 'User has no recordings yet. Return empty state message.',
      config: {},
    };
  }

  // Check for exploratory queries first (fast heuristic check)
  if (isExploratoryQuery(query)) {
    if (isTopicOverviewQuery(query)) {
      return {
        strategy: 'topic_overview',
        intent: {
          intent: 'exploration',
          confidence: 0.9,
          complexity: 2,
          reasoning: 'User wants overview of available topics',
        },
        reasoning: 'Query requests topic overview. Aggregate recordings by topic/category.',
        config: {
          useHierarchical: hasSummaries,
          maxChunks: 20,
          threshold: 0.5, // Lower threshold for broader coverage
        },
      };
    } else {
      return {
        strategy: 'direct_listing',
        intent: {
          intent: 'exploration',
          confidence: 0.9,
          complexity: 1,
          reasoning: 'User wants to see available recordings',
        },
        reasoning: 'Query requests general overview. List recordings directly.',
        config: {},
      };
    }
  }

  // For non-exploratory queries, classify intent using LLM
  const intent = await classifyQueryIntent(query);

  console.log('[Query Router] Intent classification:', intent);

  // Route based on complexity and intent
  if (intent.complexity >= 4) {
    // Complex queries: Use agentic search
    return {
      strategy: 'agentic_search',
      intent,
      reasoning: `Complex ${intent.intent} query requires multi-step reasoning and decomposition.`,
      config: {
        useAgentic: true,
        useReranking: hasReranking,
        useHierarchical: hasSummaries,
        maxChunks: 15,
        threshold: 0.7,
        enableSelfReflection: true,
        maxIterations: intent.complexity >= 5 ? 4 : 3,
      },
    };
  } else if (intent.intent === 'comparison') {
    // Comparison queries: Use comparison search strategy
    return {
      strategy: 'comparison_search',
      intent,
      reasoning: 'Comparison query requires retrieving information about multiple entities.',
      config: {
        useAgentic: true,
        useReranking: hasReranking,
        maxChunks: 20, // Need more chunks to cover both sides
        threshold: 0.65,
        enableSelfReflection: true,
        maxIterations: 2,
      },
    };
  } else if (intent.intent === 'multi_part' || intent.complexity === 3) {
    // Multi-part queries: Use hierarchical search for document diversity
    return {
      strategy: hasSummaries ? 'hierarchical_search' : 'agentic_search',
      intent,
      reasoning: hasSummaries
        ? 'Multi-part query benefits from hierarchical search for document diversity.'
        : 'Hierarchical search unavailable (no summaries). Falling back to agentic search.',
      config: {
        useAgentic: !hasSummaries,
        useHierarchical: hasSummaries,
        useReranking: hasReranking,
        maxChunks: 12,
        threshold: 0.7,
        enableSelfReflection: !hasSummaries,
        maxIterations: 2,
      },
    };
  } else {
    // Simple queries: Use standard vector search (fastest)
    return {
      strategy: 'standard_search',
      intent,
      reasoning: `Simple ${intent.intent} query. Standard vector search is sufficient.`,
      config: {
        useAgentic: false,
        useHierarchical: false,
        useReranking: hasReranking && intent.complexity >= 2,
        maxChunks: 5,
        threshold: 0.7,
      },
    };
  }
}

/**
 * Get retrieval configuration from query route
 * Converts QueryRoute into format expected by retrieveContext()
 */
export function getRetrievalConfig(route: QueryRoute) {
  return {
    maxChunks: route.config.maxChunks || 5,
    threshold: route.config.threshold || 0.7,
    useAgentic: route.config.useAgentic || false,
    rerank: route.config.useReranking || false,
    maxIterations: route.config.maxIterations || 3,
    enableSelfReflection: route.config.enableSelfReflection !== false,
  };
}

/**
 * Explain the routing decision in human-readable format
 * Useful for debugging and user transparency
 */
export function explainRoute(route: QueryRoute): string {
  const lines: string[] = [];

  lines.push(`Query Intent: ${route.intent.intent} (complexity: ${route.intent.complexity}/5)`);
  lines.push(`Confidence: ${Math.round(route.intent.confidence * 100)}%`);
  lines.push(`Strategy: ${route.strategy}`);
  lines.push(`Reasoning: ${route.reasoning}`);

  if (Object.keys(route.config).length > 0) {
    lines.push('Configuration:');
    Object.entries(route.config).forEach(([key, value]) => {
      lines.push(`  - ${key}: ${value}`);
    });
  }

  return lines.join('\n');
}
