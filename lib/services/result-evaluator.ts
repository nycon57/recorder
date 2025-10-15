/**
 * Result Evaluation Service
 *
 * Self-reflection: LLM evaluates retrieved chunks for relevance.
 */

import { googleAI } from '@/lib/google/client';
import type { SearchResult } from '@/lib/services/vector-search-google';
import type { RelevanceEvaluation, EvaluationResult } from '@/lib/types/agentic-rag';

interface ChunkEvaluation {
  chunkIndex: number;
  isRelevant: boolean;
  confidence: number;
  reasoning: string;
}

interface EvaluationResponse {
  evaluations: ChunkEvaluation[];
  gapsIdentified: string[];
  needsRefinement: boolean;
}

/**
 * Evaluate retrieval results for relevance
 */
export async function evaluateResults(
  query: string,
  results: SearchResult[]
): Promise<EvaluationResult> {
  if (results.length === 0) {
    return {
      relevant: [],
      irrelevant: [],
      evaluations: [],
      avgConfidence: 0,
      gapsIdentified: ['No results retrieved'],
      needsRefinement: true,
    };
  }

  const model = googleAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  // Prepare chunks for evaluation
  const chunksText = results
    .map((r, i) => `[Chunk ${i + 1}]\n${r.chunkText.slice(0, 500)}...`)
    .join('\n\n');

  const prompt = `You are a retrieval quality evaluator. Assess if the following chunks are relevant to answering the query.

Query: "${query}"

Retrieved Chunks:
${chunksText}

For each chunk, determine:
1. Is it relevant to the query? (yes/no)
2. Confidence (0.0-1.0)
3. Brief reasoning

Also identify:
- Information gaps: What's missing to fully answer the query?
- Need refinement: Should we retrieve more/different results?

Respond in JSON format:
{
  "evaluations": [
    {
      "chunkIndex": 0,
      "isRelevant": true,
      "confidence": 0.9,
      "reasoning": "explanation"
    }
  ],
  "gapsIdentified": ["gap 1", "gap 2"],
  "needsRefinement": false
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as EvaluationResponse;

    // Map evaluations back to results
    const evaluations: RelevanceEvaluation[] = parsed.evaluations.map(
      (evaluation: ChunkEvaluation) => ({
        chunkId: results[evaluation.chunkIndex]?.id || '',
        isRelevant: evaluation.isRelevant,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
      })
    );

    const relevant = results.filter((_, i) =>
      parsed.evaluations[i]?.isRelevant
    );

    const irrelevant = results.filter((_, i) =>
      !parsed.evaluations[i]?.isRelevant
    );

    const avgConfidence =
      evaluations.reduce((sum, e) => sum + e.confidence, 0) /
      Math.max(evaluations.length, 1);

    const threshold = parseFloat(
      process.env.AGENTIC_CONFIDENCE_THRESHOLD || '0.75'
    );

    return {
      relevant,
      irrelevant,
      evaluations,
      avgConfidence,
      gapsIdentified: parsed.gapsIdentified || [],
      needsRefinement: parsed.needsRefinement || avgConfidence < threshold,
    };
  } catch (error) {
    console.error('[Result Evaluation] Error:', error);

    // Fallback: accept all results
    return {
      relevant: results,
      irrelevant: [],
      evaluations: results.map((r) => ({
        chunkId: r.id,
        isRelevant: true,
        confidence: 0.7,
        reasoning: 'Fallback evaluation',
      })),
      avgConfidence: 0.7,
      gapsIdentified: [],
      needsRefinement: false,
    };
  }
}