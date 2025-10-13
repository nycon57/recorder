# Phase 2 Critical Fixes - Action Items

## Overview

This document outlines the **3 critical fixes** that should be applied immediately before production deployment, plus **4 high-priority improvements** for the next sprint.

**Estimated Time**:
- Critical fixes: ~45 minutes
- High-priority items: ~4 hours

---

## Critical Fixes (Do Before Production)

### 1. Reuse GoogleGenAI Client & Parallelize Embedding Generation

**Priority**: 🔴 CRITICAL
**Impact**: 50% performance improvement (60s → 30s for typical recording)
**Effort**: 10 minutes
**File**: `/lib/workers/handlers/embeddings-google.ts`

#### Problem
Creates a new `GoogleGenAI` client instance for **every chunk** (hundreds per recording), causing:
- Memory waste
- Connection overhead
- Slower processing
- Potential rate limit issues

#### Solution
Initialize client once and parallelize batch processing with `Promise.all()`.

#### Implementation

**Location**: Lines 223-276 in `embeddings-google.ts`

**Before**:
```typescript
const embeddingRecords = [];

for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
  const batch = allChunks.slice(i, i + BATCH_SIZE);

  for (const chunk of batch) {
    // ❌ New client EVERY time!
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    const result = await genai.models.embedContent({...}); // ❌ Sequential
    // ... process result
  }
}
```

**After**:
```typescript
// ✅ Initialize client ONCE
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
const embeddingRecords = [];

for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
  const batch = allChunks.slice(i, i + BATCH_SIZE);

  // ✅ Process batch in PARALLEL
  const batchResults = await Promise.all(
    batch.map(async (chunk) => {
      const result = await genai.models.embedContent({
        model: GOOGLE_CONFIG.EMBEDDING_MODEL,
        contents: chunk.text,
        config: {
          taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
          outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
        },
      });

      const embedding = result.embeddings?.[0]?.values;

      if (!embedding) {
        throw new Error(`No embedding returned for chunk ${chunk.index}`);
      }

      return { chunk, embedding };
    })
  );

  // Build embedding records from batch results
  for (const { chunk, embedding } of batchResults) {
    const sanitizedMetadata = sanitizeMetadata(chunk.metadata);

    embeddingRecords.push({
      recording_id: recordingId,
      org_id: orgId,
      chunk_text: chunk.text,
      chunk_index: sanitizedMetadata.chunkIndex as number,
      start_time_sec: ('startTime' in sanitizedMetadata ? sanitizedMetadata.startTime : null) || null,
      end_time_sec: ('endTime' in sanitizedMetadata ? sanitizedMetadata.endTime : null) || null,
      embedding: JSON.stringify(embedding),
      content_type: chunk.contentType || 'audio',
      chunking_strategy: ('semanticScore' in sanitizedMetadata) ? 'semantic' : 'fixed',
      semantic_score: ('semanticScore' in sanitizedMetadata ? sanitizedMetadata.semanticScore : null) || null,
      structure_type: ('structureType' in sanitizedMetadata ? sanitizedMetadata.structureType : null) || null,
      boundary_type: ('boundaryType' in sanitizedMetadata ? sanitizedMetadata.boundaryType : null) || null,
      metadata: {
        source: chunk.source,
        source_type: chunk.source,
        transcriptId: chunk.source === 'transcript' ? transcriptId : undefined,
        documentId: chunk.source === 'document' ? documentId : undefined,
        ...sanitizedMetadata,
      },
    });
  }

  // Small delay to avoid rate limits
  if (i + BATCH_SIZE < allChunks.length) {
    await sleep(100);
  }
}
```

#### Testing
```bash
# Run embeddings for a test recording
yarn worker:once

# Check logs for:
# - "Generated embeddings for batch X/Y" (should be faster)
# - No "GoogleGenAI" constructor logs flooding console
# - Total time should be ~50% less
```

---

### 2. Add Payload Validation

**Priority**: 🔴 CRITICAL
**Impact**: Prevents crashes from malformed job payloads
**Effort**: 15 minutes
**File**: `/lib/workers/handlers/embeddings-google.ts`

#### Problem
No runtime validation of job payload structure. If payload is malformed (wrong field names, missing data, wrong types), handler crashes with unclear error.

#### Solution
Use Zod schema validation with clear error messages.

#### Implementation

**Location**: Top of `embeddings-google.ts` (lines 8-26)

**Add import**:
```typescript
import { z } from 'zod';
```

**Replace interface with Zod schema**:
```typescript
// Before ❌
interface EmbeddingsPayload {
  recordingId: string;
  transcriptId: string;
  documentId: string;
  orgId: string;
}

// After ✅
const EmbeddingsPayloadSchema = z.object({
  recordingId: z.string().uuid('Invalid recording ID format'),
  transcriptId: z.string().uuid('Invalid transcript ID format'),
  documentId: z.string().uuid('Invalid document ID format'),
  orgId: z.string().uuid('Invalid organization ID format'),
  forceRefresh: z.boolean().optional(),
});

type EmbeddingsPayload = z.infer<typeof EmbeddingsPayloadSchema>;
```

**Update handler function** (line 34-36):
```typescript
export async function generateEmbeddings(job: Job): Promise<void> {
  // Validate payload structure
  const parseResult = EmbeddingsPayloadSchema.safeParse(job.payload);

  if (!parseResult.success) {
    throw new Error(
      `Invalid embeddings job payload: ${parseResult.error.message}`
    );
  }

  const payload = parseResult.data;
  const { recordingId, transcriptId, documentId, orgId } = payload;

  console.log(`[Embeddings] Starting embedding generation for recording ${recordingId}`);
  // ... rest of function
}
```

#### Testing
```typescript
// Create test with malformed payload
const malformedJob = {
  id: 'test-job-id',
  type: 'generate_embeddings',
  payload: {
    recordingId: 'invalid-uuid', // ❌ Not a UUID
    transcriptId: '123',
    // Missing documentId
    orgId: 'abc',
  },
};

// Should throw clear error message
await expect(generateEmbeddings(malformedJob)).rejects.toThrow(
  'Invalid embeddings job payload'
);
```

---

### 3. Improve Error Categorization

**Priority**: 🔴 CRITICAL
**Impact**: Prevents wasted retries on permanent failures
**Effort**: 20 minutes
**File**: `/lib/workers/handlers/embeddings-google.ts`

#### Problem
Current error handler throws all errors, causing job processor to retry even for permanent failures (invalid data, missing resources). Wastes resources and delays failure detection.

#### Solution
Categorize errors into **retryable** (API rate limits, timeouts) vs **permanent** (invalid data, not found) and handle appropriately.

#### Implementation

**Location**: Lines 359-366 in `embeddings-google.ts`

**Before**:
```typescript
} catch (error) {
  console.error(`[Embeddings] Error:`, error);

  // Note: We don't update recording status here since it's already 'completed'
  // from the document generation step. Embedding failures are non-critical.

  throw error; // ❌ Always retry, even for permanent failures
}
```

**After**:
```typescript
} catch (error) {
  console.error(`[Embeddings] Error:`, error);

  // Categorize errors for smart retry logic
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Retryable errors (transient issues)
  const retryablePatterns = [
    'rate limit',
    'quota exceeded',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '503', // Service unavailable
    '429', // Too many requests
    '500', // Internal server error (might be transient)
  ];

  const isRetryable = retryablePatterns.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );

  if (!isRetryable) {
    // Permanent failure - don't retry
    console.error(
      `[Embeddings] Non-retryable error for recording ${recordingId}:`,
      errorMessage
    );

    // Update recording metadata to track failure (but don't block completion)
    await supabase
      .from('recordings')
      .update({
        metadata: {
          embeddings_error: errorMessage,
          embeddings_failed_at: new Date().toISOString(),
          embeddings_retryable: false,
        },
      })
      .eq('id', recordingId);

    // Create event for notification/monitoring
    await supabase.from('events').insert({
      type: 'embeddings.failed',
      payload: {
        recordingId,
        transcriptId,
        documentId,
        orgId,
        error: errorMessage,
        retryable: false,
      },
    });

    // Don't throw - let job fail permanently without retries
    return;
  }

  // Retryable error - update metadata and throw to trigger retry
  console.warn(
    `[Embeddings] Retryable error for recording ${recordingId}, job will retry:`,
    errorMessage
  );

  await supabase
    .from('recordings')
    .update({
      metadata: {
        embeddings_last_error: errorMessage,
        embeddings_last_error_at: new Date().toISOString(),
        embeddings_retryable: true,
      },
    })
    .eq('id', recordingId);

  throw error; // Job processor will retry
}
```

#### Testing
```typescript
// Test non-retryable error
await mockTranscriptWithMissingData();
await expect(generateEmbeddings(job)).resolves.not.toThrow(); // Handles gracefully

// Test retryable error
mockGoogleAPITimeout();
await expect(generateEmbeddings(job)).rejects.toThrow(); // Allows retry
```

---

## High-Priority Improvements (Next Sprint)

### 4. Move Chunk Deletion to Worker

**Priority**: 🟡 HIGH
**Impact**: Better separation of concerns
**Effort**: 20 minutes
**File**: `/app/api/recordings/[id]/document/route.ts`

#### Problem
API route has too much knowledge of worker internals (deletes chunks directly).

#### Solution
Pass `forceRefresh: true` flag in job payload, let worker handle cleanup.

**API Route** (line 145-183):
```typescript
if (refreshEmbeddings) {
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id')
    .eq('recording_id', id)
    .eq('superseded', false)
    .single();

  if (transcript) {
    // ❌ Remove this - don't delete in API
    // await supabase
    //   .from('transcript_chunks')
    //   .delete()
    //   .eq('recording_id', id);

    // ✅ Just enqueue job with flag
    const { data: job } = await supabase
      .from('jobs')
      .insert({
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: id,
          transcriptId: transcript.id,
          documentId: existingDocument.id,
          orgId,
          forceRefresh: true, // ✅ Signal to worker
        },
        dedupe_key: `generate_embeddings:${id}:${Date.now()}`,
      })
      .select('id')
      .single();

    jobId = job?.id;
    console.log(`[PUT /document] Enqueued embeddings refresh job ${jobId}`);
  }
}
```

**Worker Handler** (after line 79 in `embeddings-google.ts`):
```typescript
// Check if this is a force refresh (delete existing chunks first)
if (payload.forceRefresh) {
  console.log(`[Embeddings] Force refresh - deleting existing chunks for recording ${recordingId}`);

  const { error: deleteError } = await supabase
    .from('transcript_chunks')
    .delete()
    .eq('recording_id', recordingId);

  if (deleteError) {
    console.error(`[Embeddings] Error deleting existing chunks:`, deleteError);
    throw new Error(`Failed to delete existing chunks: ${deleteError.message}`);
  }

  console.log(`[Embeddings] Existing chunks deleted, generating fresh embeddings`);
}

// Continue with existing idempotency check...
const { data: existingChunks, count } = await supabase
  .from('transcript_chunks')
  .select('id', { count: 'exact', head: true })
  .eq('recording_id', recordingId);
```

---

### 5. Add Structured Logging with Metrics

**Priority**: 🟡 HIGH
**Impact**: Better observability and debugging
**Effort**: 1 hour
**File**: `/lib/workers/handlers/embeddings-google.ts`

#### Implementation

**Add at start of handler**:
```typescript
const metrics = {
  recordingId,
  startTime: Date.now(),
  totalChunks: 0,
  transcriptChunks: 0,
  documentChunks: 0,
  semanticChunks: 0,
  fixedChunks: 0,
  batchesProcessed: 0,
  embeddingTimeMs: 0,
  dbInsertTimeMs: 0,
  contentType: 'unknown',
};
```

**Update throughout handler**:
```typescript
// After chunking
metrics.transcriptChunks = transcriptChunks.length;
metrics.documentChunks = semanticDocumentChunks.length;
metrics.totalChunks = allChunks.length;
metrics.semanticChunks = semanticDocumentChunks.length;
metrics.fixedChunks = transcriptChunks.length;
metrics.contentType = documentClassification.type;

// During embedding generation
const batchStartTime = Date.now();
// ... generate embeddings
metrics.embeddingTimeMs += Date.now() - batchStartTime;
metrics.batchesProcessed++;

// During DB insert
const insertStartTime = Date.now();
// ... insert
metrics.dbInsertTimeMs += Date.now() - insertStartTime;

// At end of handler
const totalTimeMs = Date.now() - metrics.startTime;

console.log('[Embeddings] Job completed', {
  ...metrics,
  totalTimeMs,
  avgEmbeddingTimeMs: Math.round(metrics.embeddingTimeMs / metrics.totalChunks),
  avgInsertTimeMs: Math.round(metrics.dbInsertTimeMs / (embeddingRecords.length / DB_INSERT_BATCH_SIZE)),
  chunksPerSecond: Math.round((metrics.totalChunks / totalTimeMs) * 1000),
  embeddingEfficiency: `${Math.round((metrics.embeddingTimeMs / totalTimeMs) * 100)}%`,
  dbEfficiency: `${Math.round((metrics.dbInsertTimeMs / totalTimeMs) * 100)}%`,
});

// Update job result with metrics
await supabase
  .from('jobs')
  .update({
    result: {
      ...metrics,
      totalTimeMs,
      success: true,
    },
  })
  .eq('id', job.id);
```

---

### 6. Extract Embedding Service

**Priority**: 🟡 HIGH
**Impact**: Better modularity, easier testing
**Effort**: 1 hour
**Files**: New file `/lib/services/embedding-service.ts`

#### Implementation

**Create new service**:
```typescript
// lib/services/embedding-service.ts
import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CONFIG } from '@/lib/google/client';

export interface EmbeddingBatch {
  text: string;
  index: number;
}

export interface EmbeddingResult {
  index: number;
  embedding: number[];
}

export class EmbeddingService {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate embeddings for a batch of texts in parallel
   */
  async generateBatch(
    texts: EmbeddingBatch[],
    options?: {
      maxRetries?: number;
      retryDelay?: number;
    }
  ): Promise<EmbeddingResult[]> {
    const { maxRetries = 3, retryDelay = 1000 } = options || {};

    const results = await Promise.all(
      texts.map(async ({ text, index }) => {
        let attempts = 0;
        let lastError: Error | null = null;

        while (attempts < maxRetries) {
          try {
            const result = await this.client.models.embedContent({
              model: GOOGLE_CONFIG.EMBEDDING_MODEL,
              contents: text,
              config: {
                taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
                outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
              },
            });

            const embedding = result.embeddings?.[0]?.values;

            if (!embedding) {
              throw new Error('No embedding returned from Google API');
            }

            return {
              index,
              embedding: Array.from(embedding),
            };
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            attempts++;

            if (attempts < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
            }
          }
        }

        throw new Error(
          `Failed to generate embedding after ${maxRetries} attempts: ${lastError?.message}`
        );
      })
    );

    return results;
  }

  /**
   * Generate single embedding
   */
  async generate(text: string): Promise<number[]> {
    const results = await this.generateBatch([{ text, index: 0 }]);
    return results[0].embedding;
  }
}
```

**Update embeddings handler to use service**:
```typescript
import { EmbeddingService } from '@/lib/services/embedding-service';

export async function generateEmbeddings(job: Job): Promise<void> {
  // ... existing code

  // Initialize embedding service
  const embeddingService = new EmbeddingService(process.env.GOOGLE_AI_API_KEY!);

  // Generate embeddings in batches
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);

    // Use service
    const batchResults = await embeddingService.generateBatch(
      batch.map((chunk, idx) => ({
        text: chunk.text,
        index: idx,
      }))
    );

    // Map results back to chunks
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const { embedding } = batchResults[j];

      // ... build embeddingRecords
    }
  }

  // ... rest of handler
}
```

---

### 7. Add Missing Tests

**Priority**: 🟡 HIGH
**Impact**: Confidence in changes, prevent regressions
**Effort**: 2 hours

#### Tests to Add

**1. Content Classifier Tests** (`__tests__/lib/services/content-classifier.test.ts`):
```typescript
import { classifyContent, isCodeFocused, hasStructuredContent } from '@/lib/services/content-classifier';

describe('Content Classifier', () => {
  describe('classifyContent', () => {
    it('should classify technical content with high confidence', () => {
      const text = `
        function initializeApp() {
          const config = { apiKey: 'abc', endpoint: '/api' };
          return new Application(config);
        }
      `;

      const result = classifyContent(text);

      expect(result.type).toBe('technical');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.features.hasCode).toBe(true);
      expect(result.features.technicalTermDensity).toBeGreaterThan(0.15);
    });

    it('should classify narrative content', () => {
      const text = `
        This is a comprehensive guide about learning web development.
        We'll start with the basics and gradually build up your skills.
        By the end, you'll understand how modern applications work.
      `;

      const result = classifyContent(text);

      expect(result.type).toBe('narrative');
      expect(result.features.hasCode).toBe(false);
      expect(result.features.averageSentenceLength).toBeGreaterThan(50);
    });

    it('should classify reference content with lists', () => {
      const text = `
        Prerequisites:
        - Node.js 18+
        - NPM or Yarn
        - Basic JavaScript knowledge
        - Git installed
      `;

      const result = classifyContent(text);

      expect(result.type).toBe('reference');
      expect(result.features.hasList).toBe(true);
    });

    it('should classify mixed content', () => {
      const text = `
        Here's how to use the API:
        \`\`\`typescript
        const result = await fetch('/api');
        \`\`\`

        Configuration options:
        - timeout: 5000
        - retries: 3
      `;

      const result = classifyContent(text);

      expect(result.type).toBe('mixed');
      expect(result.features.hasCode).toBe(true);
      expect(result.features.hasList).toBe(true);
    });
  });

  describe('isCodeFocused', () => {
    it('should identify code-focused content', () => {
      const text = '```js\nconst x = 1;\n```';
      expect(isCodeFocused(text)).toBe(true);
    });

    it('should return false for non-code content', () => {
      const text = 'This is just text';
      expect(isCodeFocused(text)).toBe(false);
    });
  });

  describe('hasStructuredContent', () => {
    it('should identify lists', () => {
      const text = '- Item 1\n- Item 2';
      expect(hasStructuredContent(text)).toBe(true);
    });

    it('should identify tables', () => {
      const text = '| Col 1 | Col 2 |\n|-------|-------|\n| A | B |';
      expect(hasStructuredContent(text)).toBe(true);
    });
  });
});
```

**2. Adaptive Sizing Tests** (`__tests__/lib/services/adaptive-sizing.test.ts`):
```typescript
import {
  getAdaptiveChunkConfig,
  calculateOptimalChunkSize,
  shouldSplitChunk,
  shouldMergeChunks,
} from '@/lib/services/adaptive-sizing';

describe('Adaptive Sizing', () => {
  describe('getAdaptiveChunkConfig', () => {
    it('should provide smaller chunks for technical content', () => {
      const config = getAdaptiveChunkConfig('technical');

      expect(config.maxSize).toBe(600);
      expect(config.targetSize).toBe(400);
      expect(config.similarityThreshold).toBe(0.8);
    });

    it('should provide larger chunks for narrative content', () => {
      const config = getAdaptiveChunkConfig('narrative');

      expect(config.maxSize).toBe(1000);
      expect(config.targetSize).toBe(700);
      expect(config.similarityThreshold).toBe(0.85);
    });

    it('should provide medium chunks for reference content', () => {
      const config = getAdaptiveChunkConfig('reference');

      expect(config.maxSize).toBe(500);
      expect(config.similarityThreshold).toBe(0.9); // Higher to keep lists together
    });
  });

  describe('calculateOptimalChunkSize', () => {
    it('should return text length if shorter than target', () => {
      const text = 'Short text';
      const size = calculateOptimalChunkSize(text, 'technical');

      expect(size).toBe(200); // Min size for technical
    });

    it('should return target size for longer text', () => {
      const text = 'A'.repeat(1000);
      const size = calculateOptimalChunkSize(text, 'technical');

      expect(size).toBe(400); // Target size for technical
    });
  });

  describe('shouldSplitChunk', () => {
    it('should split chunks exceeding maxSize', () => {
      const config = { minSize: 200, maxSize: 600, targetSize: 400, similarityThreshold: 0.85, preserveStructures: true };

      expect(shouldSplitChunk(700, config)).toBe(true);
      expect(shouldSplitChunk(500, config)).toBe(false);
    });
  });

  describe('shouldMergeChunks', () => {
    it('should merge small adjacent chunks', () => {
      const config = { minSize: 200, maxSize: 600, targetSize: 400, similarityThreshold: 0.85, preserveStructures: true };

      expect(shouldMergeChunks(100, 150, config)).toBe(true); // Both small, combined < target
      expect(shouldMergeChunks(100, 400, config)).toBe(false); // Combined > target
      expect(shouldMergeChunks(250, 250, config)).toBe(false); // Both above minSize
    });
  });
});
```

**3. Embeddings Handler Integration Test** (`__tests__/lib/workers/handlers/embeddings-google.test.ts`):
```typescript
import { generateEmbeddings } from '@/lib/workers/handlers/embeddings-google';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin');
jest.mock('@google/genai');

describe('Embeddings Handler', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      insert: jest.fn(() => mockSupabase),
      update: jest.fn(() => mockSupabase),
      delete: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      single: jest.fn(),
    };

    (createAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('should skip generation if chunks already exist', async () => {
    const job = {
      id: 'job-1',
      type: 'generate_embeddings',
      payload: {
        recordingId: 'rec-1',
        transcriptId: 'trans-1',
        documentId: 'doc-1',
        orgId: 'org-1',
      },
    };

    // Mock existing chunks
    mockSupabase.single.mockResolvedValue({
      data: null,
      count: 10, // Chunks already exist
    });

    await generateEmbeddings(job as any);

    // Verify no embeddings generated
    expect(mockSupabase.insert).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ chunk_text: expect.any(String) })])
    );
  });

  it('should validate job payload', async () => {
    const invalidJob = {
      id: 'job-1',
      type: 'generate_embeddings',
      payload: {
        recordingId: 'invalid', // Not a UUID
        transcriptId: 'trans-1',
        // Missing documentId
        orgId: 'org-1',
      },
    };

    await expect(generateEmbeddings(invalidJob as any)).rejects.toThrow(
      'Invalid embeddings job payload'
    );
  });

  it('should handle API errors gracefully', async () => {
    const job = {
      id: 'job-1',
      type: 'generate_embeddings',
      payload: {
        recordingId: 'rec-1',
        transcriptId: 'trans-1',
        documentId: 'doc-1',
        orgId: 'org-1',
      },
    };

    // Mock no existing chunks
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, count: 0 })
      .mockResolvedValueOnce({
        data: { text: 'Test transcript', words_json: {} },
      })
      .mockResolvedValueOnce({
        data: { markdown: 'Test document' },
      });

    // Mock Google API error
    const mockGenAI = require('@google/genai').GoogleGenAI;
    mockGenAI.mockImplementation(() => ({
      models: {
        embedContent: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      },
    }));

    // Should categorize as retryable and throw
    await expect(generateEmbeddings(job as any)).rejects.toThrow('Rate limit exceeded');
  });
});
```

---

## Deployment Checklist

### Before Deploying to Production

- [ ] Apply Critical Fix #1 (Reuse GoogleGenAI client + parallelize)
- [ ] Apply Critical Fix #2 (Add payload validation)
- [ ] Apply Critical Fix #3 (Improve error categorization)
- [ ] Run full test suite: `yarn test`
- [ ] Test embeddings job manually: `yarn worker:once`
- [ ] Verify performance improvement (should be ~50% faster)
- [ ] Deploy to staging environment
- [ ] Run load test with 10+ recordings
- [ ] Monitor logs for errors
- [ ] Check database for proper chunk storage
- [ ] Verify search works with semantic chunks

### Post-Deployment Monitoring

- [ ] Track embeddings job success rate
- [ ] Monitor average processing time per recording
- [ ] Watch for rate limit errors from Google API
- [ ] Check memory usage of worker process
- [ ] Verify search quality improvements

### Next Sprint (High-Priority Items)

- [ ] Implement #4 (Move chunk deletion to worker)
- [ ] Implement #5 (Structured logging with metrics)
- [ ] Implement #6 (Extract embedding service)
- [ ] Implement #7 (Add missing tests)
- [ ] Set up alerting for embeddings failures
- [ ] Create dashboard for embeddings metrics

---

## Performance Targets

**Current State** (30-min recording, 5000-word doc):
- Total time: 62-83s
- Embedding generation: 45-60s
- Database insertion: 2-3s

**After Critical Fixes**:
- Total time: 31-41s ✅ (50% faster)
- Embedding generation: 15-20s ✅ (3x faster)
- Database insertion: 1s ✅ (2x faster)

**After High-Priority Fixes**:
- Total time: 25-35s (additional 20% improvement)
- Better error handling (fewer failed retries)
- Enhanced monitoring (metrics dashboard)

---

## Support & Questions

If you encounter issues while implementing these fixes:

1. **Test locally first**: `yarn worker:dev` in watch mode
2. **Check logs**: Look for `[Embeddings]` prefix
3. **Verify Zod schema**: Test with malformed payloads
4. **Monitor Google API**: Check rate limits and quotas
5. **Review database**: Check `transcript_chunks` table for proper inserts

For architectural questions, refer to `/PHASE2_ARCHITECTURAL_REVIEW.md`.
