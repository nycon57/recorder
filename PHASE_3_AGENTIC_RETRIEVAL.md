# Phase 3: Agentic Retrieval

**Duration:** 2 weeks
**Effort:** 50 hours
**Priority:** Should-Have (Competitive Advantage)
**Dependencies:** Phase 1, Phase 2

---

## 🎯 Goals

Implement multi-step reasoning and intelligent query handling for complex information needs:

1. **Query Decomposition** - Break complex queries into sub-queries
2. **Multi-Step Retrieval** - Iterative refinement with gap analysis
3. **Self-Reflection** - LLM evaluates result quality and requests more
4. **Citation Tracking** - Track reasoning path and sources

**Success Metrics:**
- 40% improvement on multi-part question answering
- 90%+ accuracy on comparison queries
- Sub-5-second latency for 3-step retrieval
- User satisfaction > 4.5/5 for complex queries

---

## 📋 Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    // No new dependencies - uses existing Gemini/OpenAI
  }
}
```

### Environment Variables

```bash
# Agentic retrieval configuration
AGENTIC_MAX_ITERATIONS=3
AGENTIC_TIMEOUT_MS=8000
AGENTIC_CONFIDENCE_THRESHOLD=0.75

# Query decomposition
MAX_SUBQUERIES=5
SUBQUERY_PARALLEL_EXECUTION=true

# Self-reflection
ENABLE_SELF_REFLECTION=true
RELEVANCE_THRESHOLD=0.70
```

---

## 🗂️ Database Schema Changes

### New Table: `agentic_search_logs`

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_agentic_search_logs.sql

-- Log agentic search executions for analysis
CREATE TABLE agentic_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Query information
  original_query TEXT NOT NULL,
  query_intent TEXT, -- 'single_fact' | 'multi_part' | 'comparison' | 'exploration'
  subqueries JSONB DEFAULT '[]'::jsonb,

  -- Execution trace
  iterations JSONB DEFAULT '[]'::jsonb,
  final_results JSONB,

  -- Metadata
  total_duration_ms INTEGER,
  chunks_retrieved INTEGER,
  confidence_score FLOAT,
  reasoning_path TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Indexes
  INDEX idx_agentic_logs_org_id (org_id),
  INDEX idx_agentic_logs_user_id (user_id),
  INDEX idx_agentic_logs_created_at (created_at DESC),
  INDEX idx_agentic_logs_intent (query_intent)
);

-- Enable RLS
ALTER TABLE agentic_search_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org's search logs"
  ON agentic_search_logs FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage all logs"
  ON agentic_search_logs FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE agentic_search_logs IS
  'Logs for agentic retrieval executions, including query decomposition and iteration traces';
```

---

## 📁 File Structure

### New Files to Create

```
lib/
├── services/
│   ├── agentic-retrieval.ts         # NEW - Main agentic engine
│   ├── query-decomposition.ts       # NEW - Break down complex queries
│   ├── query-intent.ts              # NEW - Classify query intent
│   ├── result-evaluator.ts          # NEW - Self-reflection on results
│   └── citation-tracker.ts          # NEW - Track sources and reasoning
├── types/
│   └── agentic-rag.ts               # NEW - Type definitions
└── workers/
    └── handlers/
        └── agentic-search.ts        # NEW - Optional background processing

app/
└── api/
    ├── search/
    │   └── route.ts                 # UPDATE - Add agentic mode
    └── chat/
        └── route.ts                 # UPDATE - Add agentic mode

__tests__/
└── services/
    ├── agentic-retrieval.test.ts    # NEW
    └── query-decomposition.test.ts  # NEW
```

---

## 🔨 Implementation Details

### 3.1 Type Definitions

**File:** `lib/types/agentic-rag.ts`

```typescript
/**
 * Types for Agentic RAG System
 */

export type QueryIntent =
  | 'single_fact'      // Simple question with direct answer
  | 'multi_part'       // Multiple questions in one
  | 'comparison'       // Compare two or more things
  | 'exploration'      // Open-ended research query
  | 'how_to';          // Procedural instructions

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
```

---

### 3.2 Query Intent Classification

**File:** `lib/services/query-intent.ts`

```typescript
/**
 * Query Intent Classification Service
 *
 * Determines the type of query to choose appropriate retrieval strategy.
 */

import { createGoogleGenerativeAI } from '@/lib/google-ai';
import type { QueryIntent } from '@/lib/types/agentic-rag';

export interface IntentClassification {
  intent: QueryIntent;
  confidence: number;
  reasoning: string;
  complexity: number; // 1-5 scale
}

/**
 * Classify query intent using LLM
 */
export async function classifyQueryIntent(
  query: string
): Promise<IntentClassification> {
  const genAI = createGoogleGenerativeAI();
  const model = genAI.getGenerativeModel({
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

  const result = await model.generateContent(prompt);
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
    lowerQuery.includes('?') && query.split('?').length > 2
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
```

---

### 3.3 Query Decomposition Service

**File:** `lib/services/query-decomposition.ts`

```typescript
/**
 * Query Decomposition Service
 *
 * Breaks complex queries into multiple sub-queries for better retrieval.
 */

import { createGoogleGenerativeAI } from '@/lib/google-ai';
import type { QueryDecomposition, SubQuery } from '@/lib/types/agentic-rag';
import { classifyQueryIntent } from './query-intent';

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
  const genAI = createGoogleGenerativeAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
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

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and sanitize
    const subQueries: SubQuery[] = parsed.subQueries
      .map((sq: any, index: number) => ({
        id: sq.id || `q${index + 1}`,
        text: sq.text,
        intent: sq.intent || 'single_fact',
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
```

---

### 3.4 Result Evaluator (Self-Reflection)

**File:** `lib/services/result-evaluator.ts`

```typescript
/**
 * Result Evaluation Service
 *
 * Self-reflection: LLM evaluates retrieved chunks for relevance.
 */

import { createGoogleGenerativeAI } from '@/lib/google-ai';
import type { SearchResult } from '@/lib/services/vector-search-google';
import type { RelevanceEvaluation } from '@/lib/types/agentic-rag';

export interface EvaluationResult {
  relevant: SearchResult[];
  irrelevant: SearchResult[];
  evaluations: RelevanceEvaluation[];
  avgConfidence: number;
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

  const genAI = createGoogleGenerativeAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
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

    const parsed = JSON.parse(jsonMatch[0]);

    // Map evaluations back to results
    const evaluations: RelevanceEvaluation[] = parsed.evaluations.map(
      (eval: any) => ({
        chunkId: results[eval.chunkIndex]?.id || '',
        isRelevant: eval.isRelevant,
        confidence: eval.confidence,
        reasoning: eval.reasoning,
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
```

---

### 3.5 Main Agentic Retrieval Engine

**File:** `lib/services/agentic-retrieval.ts`

```typescript
/**
 * Agentic Retrieval Engine
 *
 * Orchestrates multi-step retrieval with query decomposition,
 * iterative refinement, and self-reflection.
 */

import { decomposeQuery, planExecutionOrder } from './query-decomposition';
import { evaluateResults } from './result-evaluator';
import { vectorSearchGoogle } from './vector-search-google';
import { rerankResults, isCohereConfigured } from './reranking';
import type {
  AgenticSearchResult,
  IterationResult,
  SubQuery,
} from '@/lib/types/agentic-rag';
import type { SearchResult } from './vector-search-google';

export interface AgenticSearchOptions {
  orgId: string;
  maxIterations?: number;
  enableSelfReflection?: boolean;
  enableReranking?: boolean;
  chunksPerQuery?: number;
  recordingIds?: string[];
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
    maxIterations = parseInt(process.env.AGENTIC_MAX_ITERATIONS || '3'),
    enableSelfReflection = process.env.ENABLE_SELF_REFLECTION !== 'false',
    enableReranking = isCohereConfigured(),
    chunksPerQuery = 15,
    recordingIds,
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

  // Step 3: Execute sub-queries iteratively
  const iterations: IterationResult[] = [];
  const allResults = new Map<string, SearchResult>();
  const citationMap = new Map<string, string[]>();

  for (const [batchIndex, batch] of executionBatches.entries()) {
    console.log(
      `[Agentic Search] Executing batch ${batchIndex + 1}/${executionBatches.length}...`
    );

    // Execute queries in parallel within batch
    const batchResults = await Promise.all(
      batch.map(async (subQuery) => {
        const iterationStart = Date.now();

        // Retrieve results
        let results = await vectorSearchGoogle(subQuery.text, {
          orgId,
          limit: chunksPerQuery,
          threshold: 0.70,
          mode: 'hybrid',
          recordingIds,
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

          if (!citationMap.has(result.id)) {
            citationMap.set(result.id, []);
          }
          citationMap.get(result.id)!.push(subQuery.id);
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

  // Step 4: Compile final results
  const finalResults = Array.from(allResults.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20); // Top 20 chunks

  const totalDuration = Date.now() - startTime;

  // Step 5: Generate reasoning path
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

  return {
    query,
    intent: decomposition.intent,
    decomposition,
    iterations,
    finalResults,
    citationMap,
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
}

/**
 * Generate human-readable reasoning path
 */
function generateReasoningPath(
  decomposition: any,
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
```

---

### 3.6 Update Search API

**File:** `app/api/search/route.ts` (UPDATE)

```typescript
// Add imports
import { agenticSearch } from '@/lib/services/agentic-retrieval';

// Update schema
const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  threshold: z.number().min(0).max(1).default(0.75),
  recordingIds: z.array(z.string().uuid()).optional(),
  sourceType: z.enum(['transcript', 'document']).optional(),
  mode: z
    .enum(['standard', 'hybrid', 'hierarchical', 'agentic'])
    .default('standard'),
  rerank: z.boolean().default(false),
  // Agentic options
  maxIterations: z.number().int().min(1).max(5).default(3),
  enableSelfReflection: z.boolean().default(true),
});

// Update POST handler
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const body = await parseBody(request, searchSchema);

  if (body.mode === 'agentic') {
    // Agentic search
    const agenticResult = await agenticSearch(body.query, {
      orgId,
      maxIterations: body.maxIterations,
      enableSelfReflection: body.enableSelfReflection,
      enableReranking: body.rerank,
      chunksPerQuery: Math.ceil(body.limit * 1.5),
      recordingIds: body.recordingIds,
    });

    return successResponse({
      query: body.query,
      results: agenticResult.finalResults,
      count: agenticResult.finalResults.length,
      mode: 'agentic',
      agentic: {
        intent: agenticResult.intent,
        subQueries: agenticResult.decomposition.subQueries,
        iterations: agenticResult.iterations.length,
        reasoning: agenticResult.reasoning,
        confidence: agenticResult.confidence,
        citationMap: Object.fromEntries(agenticResult.citationMap),
      },
      timings: {
        totalMs: agenticResult.totalDurationMs,
      },
      metadata: agenticResult.metadata,
    });
  }

  // ... existing standard/hybrid/hierarchical logic
});
```

---

## 🧪 Testing Requirements

### Unit Tests

**File:** `__tests__/services/agentic-retrieval.test.ts`

```typescript
import { agenticSearch } from '@/lib/services/agentic-retrieval';

describe('Agentic Retrieval', () => {
  it('should handle simple queries without decomposition', async () => {
    const result = await agenticSearch('What is authentication?', {
      orgId: 'test-org',
      maxIterations: 1,
    });

    expect(result.decomposition.subQueries.length).toBe(1);
    expect(result.iterations.length).toBe(1);
  });

  it('should decompose complex queries', async () => {
    const result = await agenticSearch(
      'Compare authentication and authorization and explain when to use each',
      {
        orgId: 'test-org',
        maxIterations: 3,
      }
    );

    expect(result.decomposition.subQueries.length).toBeGreaterThan(1);
    expect(result.decomposition.intent).toBe('comparison');
  });

  it('should track citations', async () => {
    const result = await agenticSearch(
      'How does the video recording system work?',
      {
        orgId: 'test-org',
      }
    );

    expect(result.citationMap.size).toBeGreaterThan(0);

    // Each chunk should have source sub-query
    for (const [chunkId, subQueryIds] of result.citationMap) {
      expect(subQueryIds.length).toBeGreaterThan(0);
    }
  });
});
```

---

## 📊 Monitoring & Analytics

### Agentic Search Metrics

```typescript
// Add to lib/monitoring/metrics.ts

export interface AgenticMetrics {
  queryIntent: string;
  decompositionTime: number;
  iterationCount: number;
  avgConfidence: number;
  totalDuration: number;
  refinementRate: number;
  successRate: number;
}

export async function trackAgenticMetrics(
  result: AgenticSearchResult
): Promise<void> {
  const metrics: AgenticMetrics = {
    queryIntent: result.intent,
    decompositionTime: result.iterations[0]?.durationMs || 0,
    iterationCount: result.iterations.length,
    avgConfidence: result.confidence,
    totalDuration: result.totalDurationMs,
    refinementRate:
      result.metadata.refinements / result.metadata.iterationCount,
    successRate: result.finalResults.length > 0 ? 1 : 0,
  };

  // Store in database
  const supabase = await createClient();

  await supabase.from('agentic_search_logs').insert({
    org_id: result.decomposition.orgId,
    original_query: result.query,
    query_intent: result.intent,
    subqueries: result.decomposition.subQueries,
    iterations: result.iterations,
    final_results: result.finalResults.map((r) => r.id),
    total_duration_ms: result.totalDurationMs,
    chunks_retrieved: result.metadata.chunksRetrieved,
    confidence_score: result.confidence,
    reasoning_path: result.reasoning,
  });

  console.log('[Agentic Metrics]', metrics);
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Run database migrations
- [ ] Test query decomposition
- [ ] Verify multi-step retrieval
- [ ] Test self-reflection
- [ ] Benchmark latency (target: < 5s for 3 steps)

### Post-Deployment

- [ ] Monitor agentic search usage
- [ ] Track confidence scores
- [ ] Analyze query intents
- [ ] Measure user satisfaction
- [ ] Review reasoning paths for quality

---

## 💡 Usage Examples

### Example 1: Comparison Query

```bash
curl -X POST /api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the differences between REST and GraphQL APIs?",
    "mode": "agentic",
    "maxIterations": 3
  }'
```

### Example 2: Multi-Part Query

```bash
curl -X POST /api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain authentication, show code examples, and list best practices",
    "mode": "agentic",
    "enableSelfReflection": true
  }'
```

---

## 🎯 Success Criteria

Phase 3 is considered complete when:

1. ✅ Query decomposition works for complex queries
2. ✅ Multi-step retrieval improves accuracy by 40%+
3. ✅ Latency < 5 seconds for 3-step retrieval
4. ✅ Self-reflection filters irrelevant results
5. ✅ Citation tracking implemented
6. ✅ All tests passing
7. ✅ Deployed to production

---

**Next Phase:** [Phase 4: Advanced Video Processing](./PHASE_4_ADVANCED_VIDEO.md)
