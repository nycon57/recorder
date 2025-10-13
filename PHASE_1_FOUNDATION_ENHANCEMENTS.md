# Phase 1: Foundation Enhancements

**Duration:** 2 weeks
**Effort:** 40 hours
**Priority:** Must-Have (Core Ragie Parity)
**Dependencies:** None

---

## 🎯 Goals

Improve core retrieval quality to match Ragie's baseline by implementing:

1. **Multi-Layer Indexing** - Summary-based hierarchical search
2. **LLM Re-ranking** - Cohere-based result re-ordering
3. **Recency Bias** - Time-weighted scoring for relevance

**Success Metrics:**
- 20% improvement in retrieval relevance scores
- Sub-second query latency (p95 < 1000ms)
- 90%+ chunk diversity across different recordings
- Re-ranking improves top-3 relevance by 15%+

---

## 📋 Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "cohere-ai": "^7.19.0"
  }
}
```

### Environment Variables

```bash
# Required for re-ranking
COHERE_API_KEY=your_cohere_api_key_here

# Optional: Configure re-ranking model
COHERE_RERANK_MODEL=rerank-english-v3.0

# Optional: Configure summary generation
SUMMARY_MAX_TOKENS=500
SUMMARY_MODEL=gemini-2.0-flash-exp
```

---

## 🗂️ Database Schema Changes

### New Table: `recording_summaries`

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_recording_summaries.sql

-- Document summaries for hierarchical search
CREATE TABLE recording_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Summary content
  summary_text TEXT NOT NULL,
  summary_embedding vector(1536), -- OpenAI text-embedding-3-small

  -- Metadata
  token_count INTEGER,
  model TEXT DEFAULT 'gemini-2.0-flash-exp',
  generated_at TIMESTAMPTZ DEFAULT now(),

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_recording_summary UNIQUE (recording_id)
);

-- Indexes for fast lookup
CREATE INDEX idx_recording_summaries_recording_id ON recording_summaries(recording_id);
CREATE INDEX idx_recording_summaries_org_id ON recording_summaries(org_id);
CREATE INDEX idx_recording_summaries_generated_at ON recording_summaries(generated_at DESC);

-- Vector similarity search index
CREATE INDEX idx_recording_summaries_embedding ON recording_summaries
USING ivfflat (summary_embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE recording_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view summaries from their org"
  ON recording_summaries FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage all summaries"
  ON recording_summaries FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER set_recording_summaries_updated_at
  BEFORE UPDATE ON recording_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Schema Update: `jobs` table

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_summary_job_type.sql

-- Add new job type for summary generation
-- This is informational - the jobs table already supports any job type
-- Just documenting the new job type: 'generate_summary'

COMMENT ON COLUMN jobs.type IS 'Job type: transcribe, doc_generate, generate_embeddings, generate_summary, extract_frames';
```

---

## 📁 File Structure

### New Files to Create

```
lib/
├── services/
│   ├── reranking.ts                    # ✅ ALREADY EXISTS
│   ├── hierarchical-search.ts          # NEW - Summary-first search
│   └── summary-generation.ts           # NEW - Recording summarization
├── workers/
│   └── handlers/
│       └── generate-summary.ts         # NEW - Summary job handler
└── types/
    └── hierarchical-search.ts          # NEW - Type definitions

app/
└── api/
    └── search/
        └── route.ts                    # UPDATE - Add hierarchical mode
```

---

## 🔨 Implementation Details

### 1.1 Summary Generation Service

**File:** `lib/services/summary-generation.ts`

```typescript
/**
 * Summary Generation Service
 *
 * Generates concise summaries of recordings for hierarchical search.
 * Uses Gemini 2.0 Flash for fast, cost-effective summarization.
 */

import { createGoogleGenerativeAI } from '@/lib/google-ai';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';

type Recording = Database['public']['Tables']['recordings']['Row'];
type Transcript = Database['public']['Tables']['transcripts']['Row'];
type Document = Database['public']['Tables']['documents']['Row'];

/**
 * Summary generation options
 */
export interface SummaryOptions {
  /** Maximum tokens in summary (default: 500) */
  maxTokens?: number;
  /** Model to use (default: gemini-2.0-flash-exp) */
  model?: string;
  /** Focus areas for summary */
  focus?: 'technical' | 'general' | 'actions';
}

/**
 * Generated summary result
 */
export interface SummaryResult {
  summaryText: string;
  tokenCount: number;
  model: string;
  generatedAt: Date;
}

/**
 * Generate a summary for a recording
 *
 * Combines transcript and document content to create a comprehensive summary
 * that captures the key topics, concepts, and information.
 *
 * @param recordingId - Recording to summarize
 * @param orgId - Organization ID for access control
 * @param options - Summary generation options
 */
export async function generateRecordingSummary(
  recordingId: string,
  orgId: string,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const {
    maxTokens = parseInt(process.env.SUMMARY_MAX_TOKENS || '500'),
    model = process.env.SUMMARY_MODEL || 'gemini-2.0-flash-exp',
    focus = 'general',
  } = options;

  // Initialize Supabase client
  const supabase = await createClient();

  // Fetch recording metadata
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('id, title, created_at, metadata')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw new Error(`Recording not found: ${recordingId}`);
  }

  // Fetch transcript
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('text')
    .eq('recording_id', recordingId)
    .single();

  // Fetch document
  const { data: document } = await supabase
    .from('documents')
    .select('content')
    .eq('recording_id', recordingId)
    .single();

  // Combine content
  const contentParts: string[] = [];

  if (recording.title) {
    contentParts.push(`Title: ${recording.title}`);
  }

  if (transcript?.text) {
    contentParts.push(`\nTranscript:\n${transcript.text}`);
  }

  if (document?.content) {
    contentParts.push(`\nDocument:\n${document.content}`);
  }

  if (contentParts.length === 0) {
    throw new Error('No content available to summarize');
  }

  const fullContent = contentParts.join('\n\n');

  // Generate summary using Gemini
  const genAI = createGoogleGenerativeAI();
  const modelInstance = genAI.getGenerativeModel({ model });

  // Build prompt based on focus
  const focusInstructions = {
    technical: 'Focus on technical concepts, code, tools, and implementation details.',
    general: 'Provide a balanced overview of all topics covered.',
    actions: 'Focus on actions taken, steps followed, and processes demonstrated.',
  };

  const prompt = `You are a technical summarization assistant. Generate a concise, comprehensive summary of the following recording content.

${focusInstructions[focus]}

Requirements:
- Maximum ${maxTokens} tokens
- Capture key topics, concepts, and information
- Use clear, professional language
- Focus on facts, not opinions
- Include technical terms when relevant

Recording Title: ${recording.title || 'Untitled Recording'}
Created: ${new Date(recording.created_at).toLocaleDateString()}

Content to summarize:
${fullContent.slice(0, 50000)} ${fullContent.length > 50000 ? '...(truncated)' : ''}

Generate the summary now:`;

  const result = await modelInstance.generateContent(prompt);
  const response = result.response;
  const summaryText = response.text();

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const tokenCount = Math.ceil(summaryText.length / 4);

  console.log('[Summary Generation] Completed:', {
    recordingId,
    summaryLength: summaryText.length,
    tokenCount,
    model,
  });

  return {
    summaryText,
    tokenCount,
    model,
    generatedAt: new Date(),
  };
}

/**
 * Store summary in database with embedding
 *
 * @param recordingId - Recording ID
 * @param orgId - Organization ID
 * @param summary - Generated summary
 */
export async function storeSummary(
  recordingId: string,
  orgId: string,
  summary: SummaryResult
): Promise<string> {
  const supabase = await createClient();

  // Generate embedding for summary
  const { generateEmbedding } = await import('@/lib/services/embeddings');
  const embedding = await generateEmbedding(summary.summaryText);

  // Upsert summary
  const { data, error } = await supabase
    .from('recording_summaries')
    .upsert({
      recording_id: recordingId,
      org_id: orgId,
      summary_text: summary.summaryText,
      summary_embedding: embedding,
      token_count: summary.tokenCount,
      model: summary.model,
      generated_at: summary.generatedAt.toISOString(),
      metadata: {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store summary: ${error.message}`);
  }

  return data.id;
}

/**
 * Regenerate summary for a recording
 *
 * @param recordingId - Recording to regenerate summary for
 * @param orgId - Organization ID
 * @param options - Summary options
 */
export async function regenerateSummary(
  recordingId: string,
  orgId: string,
  options?: SummaryOptions
): Promise<void> {
  const summary = await generateRecordingSummary(recordingId, orgId, options);
  await storeSummary(recordingId, orgId, summary);

  console.log('[Summary] Regenerated for recording:', recordingId);
}
```

---

### 1.2 Hierarchical Search Service

**File:** `lib/services/hierarchical-search.ts`

```typescript
/**
 * Hierarchical Search Service
 *
 * Two-tier search strategy:
 * 1. Search recording summaries to find relevant recordings
 * 2. Search chunks within those recordings for specific details
 *
 * Benefits:
 * - Better result diversity (prevents all results from one recording)
 * - More relevant results (summary-level relevance first)
 * - Faster for large datasets (narrows search space)
 */

import { createClient } from '@/lib/supabase/server';
import type { SearchResult } from '@/lib/services/vector-search-google';
import { generateEmbedding } from '@/lib/services/embeddings';

/**
 * Hierarchical search options
 */
export interface HierarchicalSearchOptions {
  /** Number of recordings to retrieve in first tier */
  topRecordings?: number;
  /** Number of chunks per recording in second tier */
  chunksPerRecording?: number;
  /** Minimum similarity threshold for summaries */
  summaryThreshold?: number;
  /** Minimum similarity threshold for chunks */
  chunkThreshold?: number;
  /** Recording IDs to filter by */
  recordingIds?: string[];
  /** Source type filter */
  sourceType?: 'transcript' | 'document';
}

/**
 * Hierarchical search result with metadata
 */
export interface HierarchicalSearchResult {
  results: SearchResult[];
  metadata: {
    recordingsSearched: number;
    recordingsFound: number;
    chunksSearched: number;
    tier1Time: number;
    tier2Time: number;
    totalTime: number;
  };
}

/**
 * Perform hierarchical search
 *
 * @param query - Search query
 * @param orgId - Organization ID
 * @param options - Search options
 */
export async function hierarchicalSearch(
  query: string,
  orgId: string,
  options: HierarchicalSearchOptions = {}
): Promise<HierarchicalSearchResult> {
  const startTime = Date.now();

  const {
    topRecordings = 5,
    chunksPerRecording = 10,
    summaryThreshold = 0.7,
    chunkThreshold = 0.75,
    recordingIds,
    sourceType,
  } = options;

  const supabase = await createClient();

  // TIER 1: Search recording summaries
  console.log('[Hierarchical Search] Tier 1: Searching recording summaries...');
  const tier1Start = Date.now();

  const queryEmbedding = await generateEmbedding(query);

  let summaryQuery = supabase
    .from('recording_summaries')
    .select(`
      recording_id,
      summary_text,
      summary_embedding
    `)
    .eq('org_id', orgId);

  // Apply recording filter if provided
  if (recordingIds && recordingIds.length > 0) {
    summaryQuery = summaryQuery.in('recording_id', recordingIds);
  }

  const { data: summaries, error: summaryError } = await summaryQuery;

  if (summaryError) {
    throw new Error(`Summary search failed: ${summaryError.message}`);
  }

  // Calculate similarity scores
  interface SummaryMatch {
    recordingId: string;
    similarity: number;
  }

  const summaryMatches: SummaryMatch[] = (summaries || [])
    .map(summary => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        summary.summary_embedding
      );
      return {
        recordingId: summary.recording_id,
        similarity,
      };
    })
    .filter(match => match.similarity >= summaryThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topRecordings);

  const tier1Time = Date.now() - tier1Start;

  console.log('[Hierarchical Search] Tier 1 Results:', {
    recordingsFound: summaryMatches.length,
    topSimilarity: summaryMatches[0]?.similarity,
    time: `${tier1Time}ms`,
  });

  if (summaryMatches.length === 0) {
    return {
      results: [],
      metadata: {
        recordingsSearched: summaries?.length || 0,
        recordingsFound: 0,
        chunksSearched: 0,
        tier1Time,
        tier2Time: 0,
        totalTime: Date.now() - startTime,
      },
    };
  }

  // TIER 2: Search chunks within selected recordings
  console.log('[Hierarchical Search] Tier 2: Searching chunks...');
  const tier2Start = Date.now();

  const relevantRecordingIds = summaryMatches.map(m => m.recordingId);

  let chunkQuery = supabase
    .from('transcript_chunks')
    .select(`
      id,
      recording_id,
      chunk_text,
      chunk_embedding,
      chunk_index,
      start_time,
      end_time,
      source_type,
      metadata,
      recordings!inner (
        id,
        title,
        created_at
      )
    `)
    .in('recording_id', relevantRecordingIds)
    .eq('org_id', orgId);

  // Apply source type filter
  if (sourceType) {
    chunkQuery = chunkQuery.eq('source_type', sourceType);
  }

  const { data: chunks, error: chunkError } = await chunkQuery;

  if (chunkError) {
    throw new Error(`Chunk search failed: ${chunkError.message}`);
  }

  // Calculate chunk similarities
  const chunkMatches = (chunks || [])
    .map(chunk => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        chunk.chunk_embedding
      );

      return {
        id: chunk.id,
        recordingId: chunk.recording_id,
        recordingTitle: chunk.recordings.title,
        chunkText: chunk.chunk_text,
        similarity,
        metadata: {
          source: chunk.source_type,
          startTime: chunk.start_time,
          endTime: chunk.end_time,
          chunkIndex: chunk.chunk_index,
          recordingCreatedAt: chunk.recordings.created_at,
          ...chunk.metadata,
        },
      } as SearchResult;
    })
    .filter(match => match.similarity >= chunkThreshold);

  // Sort by similarity and limit per recording
  const resultsByRecording = new Map<string, SearchResult[]>();

  for (const result of chunkMatches) {
    if (!resultsByRecording.has(result.recordingId)) {
      resultsByRecording.set(result.recordingId, []);
    }
    resultsByRecording.get(result.recordingId)!.push(result);
  }

  // Take top N chunks from each recording
  const finalResults: SearchResult[] = [];
  for (const [recordingId, results] of resultsByRecording) {
    const topChunks = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, chunksPerRecording);
    finalResults.push(...topChunks);
  }

  // Sort final results by similarity
  finalResults.sort((a, b) => b.similarity - a.similarity);

  const tier2Time = Date.now() - tier2Start;
  const totalTime = Date.now() - startTime;

  console.log('[Hierarchical Search] Tier 2 Results:', {
    chunksFound: finalResults.length,
    topSimilarity: finalResults[0]?.similarity,
    time: `${tier2Time}ms`,
  });

  return {
    results: finalResults,
    metadata: {
      recordingsSearched: summaries?.length || 0,
      recordingsFound: summaryMatches.length,
      chunksSearched: chunks?.length || 0,
      tier1Time,
      tier2Time,
      totalTime,
    },
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Check if hierarchical search is available for org
 * (requires summaries to be generated)
 */
export async function isHierarchicalSearchAvailable(
  orgId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('recording_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  return (count || 0) > 0;
}
```

---

### 1.3 Summary Generation Job Handler

**File:** `lib/workers/handlers/generate-summary.ts`

```typescript
/**
 * Generate Summary Job Handler
 *
 * Background job that generates recording summaries after document generation.
 *
 * Job Flow:
 * transcribe -> doc_generate -> generate_summary -> generate_embeddings
 */

import type { Job } from '@/lib/types/jobs';
import {
  generateRecordingSummary,
  storeSummary,
} from '@/lib/services/summary-generation';
import { createClient } from '@/lib/supabase/admin';

export interface GenerateSummaryPayload {
  recordingId: string;
  orgId: string;
  options?: {
    maxTokens?: number;
    focus?: 'technical' | 'general' | 'actions';
  };
}

export async function handleGenerateSummary(
  job: Job<GenerateSummaryPayload>
): Promise<void> {
  const { recordingId, orgId, options } = job.payload;

  console.log('[Job: Generate Summary] Starting:', {
    jobId: job.id,
    recordingId,
    orgId,
  });

  try {
    // Generate summary
    const summary = await generateRecordingSummary(
      recordingId,
      orgId,
      options
    );

    // Store summary with embedding
    const summaryId = await storeSummary(recordingId, orgId, summary);

    console.log('[Job: Generate Summary] Completed:', {
      jobId: job.id,
      recordingId,
      summaryId,
      tokenCount: summary.tokenCount,
    });

    // Update recording status if this is the last step
    const supabase = createClient();

    // Check if embeddings job already exists
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('org_id', orgId)
      .eq('type', 'generate_embeddings')
      .eq('payload->recordingId', recordingId)
      .single();

    if (!existingJob) {
      // Create embeddings job (final step)
      await supabase.from('jobs').insert({
        org_id: orgId,
        type: 'generate_embeddings',
        payload: { recordingId, orgId },
        status: 'pending',
        attempt_count: 0,
        run_after: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[Job: Generate Summary] Error:', {
      jobId: job.id,
      recordingId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Re-throw to trigger retry logic
    throw error;
  }
}
```

---

### 1.4 Update Job Processor

**File:** `lib/workers/job-processor.ts` (UPDATE)

```typescript
// Add to existing imports
import { handleGenerateSummary } from './handlers/generate-summary';

// Update job handlers map
const jobHandlers: Record<JobType, JobHandler> = {
  transcribe: handleTranscribe,
  doc_generate: handleDocGenerate,
  generate_summary: handleGenerateSummary, // NEW
  generate_embeddings: handleGenerateEmbeddings,
  extract_frames: stubHandler,
};
```

---

### 1.5 Update Document Generation Handler

**File:** `lib/workers/handlers/doc-generate.ts` (UPDATE)

```typescript
// After successful document generation, create summary job
// Add this at the end of handleDocGenerate function:

// Create summary generation job
const { error: summaryJobError } = await supabase.from('jobs').insert({
  org_id: orgId,
  type: 'generate_summary',
  payload: { recordingId, orgId },
  status: 'pending',
  attempt_count: 0,
  run_after: new Date().toISOString(),
});

if (summaryJobError) {
  console.warn('[Job: Doc Generate] Failed to create summary job:', summaryJobError);
}
```

---

### 1.6 Update Search API

**File:** `app/api/search/route.ts` (UPDATE)

```typescript
// Add to imports
import {
  hierarchicalSearch,
  isHierarchicalSearchAvailable,
} from '@/lib/services/hierarchical-search';
import { rerankResults, isCohereConfigured } from '@/lib/services/reranking';

// Update search schema
const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().positive().default(10),
  threshold: z.number().min(0).max(1).default(0.75),
  recordingIds: z.array(z.string().uuid()).optional(),
  sourceType: z.enum(['transcript', 'document']).optional(),
  mode: z.enum(['standard', 'hybrid', 'hierarchical']).default('standard'), // NEW
  rerank: z.boolean().default(false),
});

// Update POST handler
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const body = await parseBody(request, searchSchema);

  const {
    query,
    limit,
    threshold,
    recordingIds,
    sourceType,
    mode,
    rerank,
  } = body;

  console.log('[Search API] Request:', {
    query: query.substring(0, 50),
    limit,
    mode,
    rerank,
    userId,
    orgId,
  });

  const startTime = Date.now();
  let results: SearchResult[];
  let metadata: any = {};

  // Choose search mode
  if (mode === 'hierarchical') {
    // Check if hierarchical search is available
    const available = await isHierarchicalSearchAvailable(orgId);

    if (!available) {
      return errorResponse(
        'Hierarchical search not available. Generate summaries first.',
        { code: 'HIERARCHICAL_NOT_AVAILABLE', status: 400 }
      );
    }

    const hierarchicalResult = await hierarchicalSearch(query, orgId, {
      topRecordings: 5,
      chunksPerRecording: Math.ceil(limit / 5),
      summaryThreshold: threshold - 0.05,
      chunkThreshold: threshold,
      recordingIds,
      sourceType,
    });

    results = hierarchicalResult.results;
    metadata = hierarchicalResult.metadata;
  } else {
    // Standard or hybrid search (existing logic)
    const searchResults = await vectorSearchGoogle(query, {
      orgId,
      limit: rerank ? limit * 3 : limit,
      threshold,
      mode: mode === 'hybrid' ? 'hybrid' : 'vector',
      recordingIds,
      sourceType,
    });

    results = searchResults;
  }

  // Apply re-ranking if requested
  let reranked = false;
  let rerankMetadata;

  if (rerank && results.length > 0) {
    if (!isCohereConfigured()) {
      console.warn('[Search API] Re-ranking requested but Cohere not configured');
    } else {
      const rerankResult = await rerankResults(query, results, {
        topN: limit,
      });

      results = rerankResult.results;
      reranked = true;
      rerankMetadata = {
        originalCount: rerankResult.originalCount,
        rerankedCount: rerankResult.rerankedCount,
        rerankingTime: rerankResult.rerankingTime,
        costEstimate: rerankResult.costEstimate,
      };
    }
  }

  const totalTime = Date.now() - startTime;

  return successResponse({
    query,
    results,
    count: results.length,
    mode,
    reranked,
    timings: {
      searchMs: metadata.totalTime || totalTime - (rerankMetadata?.rerankingTime || 0),
      rerankMs: rerankMetadata?.rerankingTime || 0,
      totalMs: totalTime,
    },
    metadata: {
      ...metadata,
      rerankMetadata,
    },
  });
});
```

---

### 1.7 Recency Bias Implementation

**File:** `lib/services/vector-search-google.ts` (UPDATE)

```typescript
// Add to SearchOptions interface
export interface SearchOptions {
  // ... existing options

  /** Apply recency bias to scoring */
  recencyBias?: boolean;
  /** Recency weight (0-1, default: 0.15) */
  recencyWeight?: number;
}

// Add recency scoring function
function applyRecencyBias(
  results: SearchResult[],
  recencyWeight: number = 0.15
): SearchResult[] {
  if (recencyWeight === 0) return results;

  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  return results.map(result => {
    const recordingDate = new Date(result.metadata.recordingCreatedAt);
    const ageMs = now - recordingDate.getTime();

    // Time decay: 1.0 for today, 0.0 for 1 year old
    const timeDecay = Math.max(0, 1 - (ageMs / oneYearMs));

    // Boost score: similarity * (1 + weight * decay)
    const boostedSimilarity = result.similarity * (1 + recencyWeight * timeDecay);

    return {
      ...result,
      similarity: boostedSimilarity,
      metadata: {
        ...result.metadata,
        originalSimilarity: result.similarity,
        recencyBoost: recencyWeight * timeDecay,
      },
    };
  }).sort((a, b) => b.similarity - a.similarity);
}

// Update vectorSearchGoogle function
export async function vectorSearchGoogle(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  // ... existing logic

  // Apply recency bias before returning
  if (options.recencyBias) {
    results = applyRecencyBias(results, options.recencyWeight);
  }

  return results;
}
```

---

## 🧪 Testing Requirements

### Unit Tests

Create: `lib/services/__tests__/summary-generation.test.ts`

```typescript
import { generateRecordingSummary } from '../summary-generation';

describe('Summary Generation', () => {
  it('should generate summary for recording', async () => {
    const summary = await generateRecordingSummary(
      'recording-id',
      'org-id'
    );

    expect(summary.summaryText).toBeDefined();
    expect(summary.summaryText.length).toBeGreaterThan(0);
    expect(summary.tokenCount).toBeGreaterThan(0);
  });

  it('should respect max token limit', async () => {
    const summary = await generateRecordingSummary(
      'recording-id',
      'org-id',
      { maxTokens: 200 }
    );

    expect(summary.tokenCount).toBeLessThanOrEqual(220); // Allow 10% margin
  });

  it('should throw error for missing recording', async () => {
    await expect(
      generateRecordingSummary('invalid-id', 'org-id')
    ).rejects.toThrow('Recording not found');
  });
});
```

### Integration Tests

Create: `app/api/search/__tests__/hierarchical.test.ts`

```typescript
describe('Hierarchical Search API', () => {
  it('should return results from multiple recordings', async () => {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'authentication',
        mode: 'hierarchical',
        limit: 10,
      }),
    });

    const data = await response.json();

    expect(data.results.length).toBeGreaterThan(0);

    // Check result diversity
    const uniqueRecordings = new Set(
      data.results.map((r: any) => r.recordingId)
    );
    expect(uniqueRecordings.size).toBeGreaterThan(1);
  });

  it('should fallback gracefully when summaries not available', async () => {
    const response = await fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        query: 'test',
        mode: 'hierarchical',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('HIERARCHICAL_NOT_AVAILABLE');
  });
});
```

---

## 📊 Monitoring & Logging

### Key Metrics to Track

```typescript
// Add to lib/monitoring/metrics.ts

export interface SearchMetrics {
  // Latency
  tier1LatencyMs: number;
  tier2LatencyMs: number;
  rerankLatencyMs: number;
  totalLatencyMs: number;

  // Quality
  averageSimilarity: number;
  resultDiversity: number; // unique recordings / total results
  rerankImprovement: number; // top-3 similarity improvement

  // Volume
  recordingsSearched: number;
  chunksSearched: number;
  resultsReturned: number;
}

export function trackSearchMetrics(metrics: SearchMetrics): void {
  console.log('[Search Metrics]', metrics);

  // TODO: Send to analytics service (DataDog, New Relic, etc.)
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Run database migrations
- [ ] Install `cohere-ai` package
- [ ] Set `COHERE_API_KEY` environment variable
- [ ] Test summary generation on sample recording
- [ ] Verify hierarchical search returns results
- [ ] Test re-ranking improves relevance

### Migration Strategy

1. **Run migrations** in staging environment
2. **Generate summaries** for existing recordings:
   ```sql
   -- Create summary jobs for all completed recordings
   INSERT INTO jobs (org_id, type, payload, status, attempt_count, run_after)
   SELECT
     org_id,
     'generate_summary',
     jsonb_build_object(
       'recordingId', id::text,
       'orgId', org_id::text
     ),
     'pending',
     0,
     now()
   FROM recordings
   WHERE status = 'completed'
     AND id NOT IN (SELECT recording_id FROM recording_summaries);
   ```
3. **Monitor job progress** in admin dashboard
4. **Test search** after summaries generated
5. **Deploy to production**

### Post-Deployment

- [ ] Monitor summary generation job success rate
- [ ] Track search latency (target: p95 < 1000ms)
- [ ] Compare hierarchical vs standard search quality
- [ ] Monitor Cohere API costs
- [ ] Gather user feedback on result relevance

---

## 💡 Usage Examples

### Example 1: Standard Search with Re-ranking

```bash
curl -X POST https://your-app.com/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how to implement authentication",
    "limit": 10,
    "mode": "standard",
    "rerank": true
  }'
```

### Example 2: Hierarchical Search

```bash
curl -X POST https://your-app.com/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database optimization techniques",
    "limit": 15,
    "mode": "hierarchical",
    "threshold": 0.7
  }'
```

### Example 3: Hierarchical + Re-ranking + Recency

```bash
curl -X POST https://your-app.com/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest Next.js features",
    "limit": 10,
    "mode": "hierarchical",
    "rerank": true,
    "recencyBias": true,
    "recencyWeight": 0.2
  }'
```

---

## 🎯 Success Criteria

Phase 1 is considered complete when:

1. ✅ Recording summaries generated for all recordings
2. ✅ Hierarchical search returns diverse results (3+ recordings)
3. ✅ Re-ranking improves top-3 relevance by 15%+
4. ✅ Search latency p95 < 1000ms
5. ✅ All tests passing
6. ✅ Deployed to production

---

## 📚 Additional Resources

- [Cohere Re-rank Documentation](https://docs.cohere.com/docs/reranking)
- [Google Gemini API](https://ai.google.dev/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [RAG Best Practices](https://www.anthropic.com/index/contextual-retrieval)

---

**Next Phase:** [Phase 2: Semantic Chunking](./PHASE_2_SEMANTIC_CHUNKING.md)
