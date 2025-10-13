/**
 * Query Intent Classification Service
 *
 * Determines the type of query to choose appropriate retrieval strategy.
 */

import { googleAI } from '@/lib/google/client';
import { withTimeout } from '@/lib/utils/timeout';
import type { QueryIntent, IntentClassification } from '@/lib/types/agentic-rag';

/**
 * Classify query intent using LLM
 */
export async function classifyQueryIntent(
  query: string
): Promise<IntentClassification> {
  const model = googleAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  const prompt = `You are a query analysis assistant. Classify the following user query.

Query: "${query}"

Determine:
1. Intent Type:
   - single_fact: Simple question with direct answer ("What is X?")
   - multi_part: Multiple questions combined ("Explain X and Y")
   - comparison: Comparing things ("What's the difference between X and Y?")
   - exploration: Open-ended research ("Tell me about X")
   - how_to: Procedural instructions ("How do I X?")

2. Complexity (1-5):
   - 1: Single fact lookup
   - 2: Simple explanation
   - 3: Multiple related concepts
   - 4: Comparison or analysis
   - 5: Complex research or synthesis

3. Reasoning: Brief explanation of your classification

Respond in JSON format:
{
  "intent": "single_fact|multi_part|comparison|exploration|how_to",
  "confidence": 0.0-1.0,
  "complexity": 1-5,
  "reasoning": "explanation"
}`;

  const result = await withTimeout(
    model.generateContent(prompt),
    5000, // 5 second timeout
    'Query intent classification timed out'
  );
  const responseText = result.response.text();

  try {
    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      intent: parsed.intent as QueryIntent,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      complexity: parsed.complexity,
    };
  } catch (error) {
    console.error('[Query Intent] Parsing error:', error);

    // Fallback: simple heuristic classification
    return fallbackClassification(query);
  }
}

/**
 * Fallback classification using heuristics
 */
function fallbackClassification(query: string): IntentClassification {
  const lowerQuery = query.toLowerCase();

  // Comparison indicators
  if (
    lowerQuery.includes('difference') ||
    lowerQuery.includes('compare') ||
    lowerQuery.includes('vs') ||
    lowerQuery.includes('versus') ||
    lowerQuery.includes('better')
  ) {
    return {
      intent: 'comparison',
      confidence: 0.7,
      reasoning: 'Query contains comparison keywords',
      complexity: 4,
    };
  }

  // How-to indicators
  if (
    lowerQuery.startsWith('how to') ||
    lowerQuery.startsWith('how do') ||
    lowerQuery.includes('steps to')
  ) {
    return {
      intent: 'how_to',
      confidence: 0.8,
      reasoning: 'Query asks for procedural instructions',
      complexity: 3,
    };
  }

  // Multi-part indicators
  if (
    lowerQuery.includes(' and ') ||
    lowerQuery.includes(', ') ||
    (lowerQuery.includes('?') && query.split('?').length > 2)
  ) {
    return {
      intent: 'multi_part',
      confidence: 0.7,
      reasoning: 'Query contains multiple parts',
      complexity: 3,
    };
  }

  // Exploration indicators
  if (
    lowerQuery.startsWith('tell me about') ||
    lowerQuery.startsWith('explain') ||
    lowerQuery.startsWith('what is')
  ) {
    return {
      intent: 'exploration',
      confidence: 0.6,
      reasoning: 'Query requests broad explanation',
      complexity: 2,
    };
  }

  // Default: single fact
  return {
    intent: 'single_fact',
    confidence: 0.5,
    reasoning: 'Simple question format',
    complexity: 1,
  };
}
