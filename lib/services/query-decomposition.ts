/**
 * Query Decomposition Service
 *
 * Breaks complex queries into multiple sub-queries for better retrieval.
 */

import { googleAI } from '@/lib/google/client';
import type { QueryDecomposition, SubQuery, QueryIntent } from '@/lib/types/agentic-rag';
import { classifyQueryIntent } from './query-intent';

interface SubQueryResponse {
  id: string;
  text: string;
  intent: string;
  dependency: string | null;
  priority: number;
}

interface DecompositionResponse {
  reasoning: string;
  subQueries: SubQueryResponse[];
}

/**
 * Decompose query into sub-queries
 */
export async function decomposeQuery(
  query: string
): Promise<QueryDecomposition> {
  // First, classify intent
  const classification = await classifyQueryIntent(query);

  console.log('[Query Decomposition] Intent classified:', classification);

  // Simple queries don't need decomposition
  if (
    classification.complexity <= 2 &&
    classification.intent === 'single_fact'
  ) {
    return {
      originalQuery: query,
      intent: classification.intent,
      complexity: classification.complexity,
      subQueries: [
        {
          id: 'q1',
          text: query,
          intent: classification.intent,
          dependency: null,
          priority: 5,
        },
      ],
      reasoning: 'Simple query - no decomposition needed',
    };
  }

  // Use LLM to decompose complex queries
  const model = googleAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const prompt = `You are a query decomposition assistant. Break down the following complex query into 2-5 simpler sub-queries.

Original Query: "${query}"
Query Intent: ${classification.intent}
Complexity: ${classification.complexity}/5

Guidelines:
1. Create sub-queries that are atomic and focused
2. Identify dependencies between sub-queries (some may need others to be answered first)
3. Assign priority (1-5, higher = more important to main query)
4. Keep sub-queries independent where possible for parallel execution
5. Rephrase sub-queries for clarity

Respond in JSON format:
{
  "reasoning": "Why this decomposition approach",
  "subQueries": [
    {
      "id": "q1",
      "text": "sub-query text",
      "intent": "single_fact|multi_part|comparison|exploration|how_to",
      "dependency": null,
      "priority": 5
    },
    {
      "id": "q2",
      "text": "sub-query text",
      "intent": "single_fact",
      "dependency": "q1",
      "priority": 4
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as DecompositionResponse;

    // Validate and sanitize
    const subQueries: SubQuery[] = parsed.subQueries
      .map((sq: SubQueryResponse, index: number) => ({
        id: sq.id || `q${index + 1}`,
        text: sq.text,
        intent: (sq.intent as QueryIntent) || 'single_fact',
        dependency: sq.dependency || null,
        priority: sq.priority || 3,
      }))
      .slice(0, parseInt(process.env.MAX_SUBQUERIES || '5'));

    return {
      originalQuery: query,
      intent: classification.intent,
      complexity: classification.complexity,
      subQueries,
      reasoning: parsed.reasoning || 'LLM decomposition',
    };
  } catch (error) {
    console.error('[Query Decomposition] Error:', error);

    // Fallback: single query
    return {
      originalQuery: query,
      intent: classification.intent,
      complexity: classification.complexity,
      subQueries: [
        {
          id: 'q1',
          text: query,
          intent: classification.intent,
          dependency: null,
          priority: 5,
        },
      ],
      reasoning: 'Fallback - decomposition failed',
    };
  }
}

/**
 * Determine execution order based on dependencies
 */
export function planExecutionOrder(subQueries: SubQuery[]): SubQuery[][] {
  const batches: SubQuery[][] = [];
  const processed = new Set<string>();

  while (processed.size < subQueries.length) {
    const batch = subQueries.filter((sq) => {
      // Already processed
      if (processed.has(sq.id)) return false;

      // No dependency - can execute now
      if (!sq.dependency) return true;

      // Dependency already processed
      return processed.has(sq.dependency);
    });

    if (batch.length === 0) {
      // Circular dependency or invalid - take remaining queries
      const remaining = subQueries.filter((sq) => !processed.has(sq.id));
      batches.push(remaining);
      break;
    }

    batches.push(batch);
    batch.forEach((sq) => processed.add(sq.id));
  }

  return batches;
}