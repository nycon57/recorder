# Phase 2: Semantic Chunking

**Duration:** 1 week
**Effort:** 20 hours
**Priority:** Must-Have (Core Ragie Parity)
**Dependencies:** Phase 1

---

## 🎯 Goals

Implement intelligent, context-aware chunking that preserves semantic meaning and improves retrieval quality by:

1. **Semantic Boundary Detection** - Split content at natural semantic breaks
2. **Adaptive Chunk Sizing** - Adjust chunk size based on content density
3. **Structure Preservation** - Maintain code blocks, lists, tables intact

**Success Metrics:**
- 25% reduction in semantic boundary violations
- 90%+ preservation of complete code blocks/tables
- Improved chunk coherence (measured by internal similarity)
- Better retrieval precision for technical queries

---

## 📋 Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.2"
  }
}
```

### Environment Variables

```bash
# Optional: Configure chunking parameters
SEMANTIC_CHUNK_MIN_SIZE=200
SEMANTIC_CHUNK_MAX_SIZE=800
SEMANTIC_CHUNK_TARGET_SIZE=500
SEMANTIC_SIMILARITY_THRESHOLD=0.85

# Model for sentence embeddings (cached locally)
SENTENCE_TRANSFORMER_MODEL=Xenova/all-MiniLM-L6-v2
```

---

## 🗂️ Database Schema Changes

### Schema Update: `transcript_chunks` table

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_semantic_chunking_metadata.sql

-- Add semantic chunking metadata to existing chunks
ALTER TABLE transcript_chunks
ADD COLUMN IF NOT EXISTS chunking_strategy TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS semantic_score FLOAT,
ADD COLUMN IF NOT EXISTS structure_type TEXT,
ADD COLUMN IF NOT EXISTS boundary_type TEXT;

-- Index for chunking analytics
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_strategy
  ON transcript_chunks(chunking_strategy);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_structure
  ON transcript_chunks(structure_type);

COMMENT ON COLUMN transcript_chunks.chunking_strategy IS
  'Chunking method used: fixed, semantic, adaptive, hybrid';

COMMENT ON COLUMN transcript_chunks.semantic_score IS
  'Internal coherence score (0-1) for semantic chunking';

COMMENT ON COLUMN transcript_chunks.structure_type IS
  'Content structure: code, list, table, paragraph, heading, mixed';

COMMENT ON COLUMN transcript_chunks.boundary_type IS
  'Boundary decision: semantic_break, size_limit, structure_boundary, topic_shift';
```

---

## 📁 File Structure

### New Files to Create

```
lib/
├── services/
│   ├── semantic-chunker.ts          # NEW - Core semantic chunking
│   ├── content-classifier.ts        # NEW - Content type detection
│   ├── structure-parser.ts          # NEW - Code/list/table parsing
│   └── adaptive-sizing.ts           # NEW - Dynamic chunk sizing
├── workers/
│   └── handlers/
│       └── generate-embeddings.ts   # UPDATE - Use semantic chunking
└── types/
    └── chunking.ts                  # NEW - Chunking type definitions

__tests__/
└── services/
    ├── semantic-chunker.test.ts     # NEW - Unit tests
    └── content-classifier.test.ts   # NEW - Unit tests
```

---

## 🔨 Implementation Details

### 2.1 Semantic Chunker Core

**File:** `lib/services/semantic-chunker.ts`

```typescript
/**
 * Semantic Chunking Service
 *
 * Implements intelligent chunking that respects semantic boundaries,
 * preserves code structure, and adapts to content density.
 *
 * Key Features:
 * - Sentence-level semantic similarity analysis
 * - Structure-aware chunking (code, lists, tables)
 * - Adaptive chunk sizing based on content type
 * - Boundary detection with multiple signals
 */

import { pipeline, Pipeline } from '@xenova/transformers';

/**
 * Chunk boundary decision
 */
interface ChunkBoundary {
  position: number;
  type: 'semantic_break' | 'size_limit' | 'structure_boundary' | 'topic_shift';
  confidence: number;
}

/**
 * Semantic chunk with metadata
 */
export interface SemanticChunk {
  text: string;
  startPosition: number;
  endPosition: number;
  sentences: string[];
  semanticScore: number;
  structureType: string;
  boundaryType: string;
  tokenCount: number;
}

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  minSize: number;
  maxSize: number;
  targetSize: number;
  similarityThreshold: number;
  preserveStructures: boolean;
}

/**
 * Semantic Chunker class
 */
export class SemanticChunker {
  private embedder: Pipeline | null = null;
  private config: ChunkingConfig;

  constructor(config?: Partial<ChunkingConfig>) {
    this.config = {
      minSize: parseInt(process.env.SEMANTIC_CHUNK_MIN_SIZE || '200'),
      maxSize: parseInt(process.env.SEMANTIC_CHUNK_MAX_SIZE || '800'),
      targetSize: parseInt(process.env.SEMANTIC_CHUNK_TARGET_SIZE || '500'),
      similarityThreshold: parseFloat(
        process.env.SEMANTIC_SIMILARITY_THRESHOLD || '0.85'
      ),
      preserveStructures: true,
      ...config,
    };
  }

  /**
   * Initialize sentence transformer model
   */
  private async initEmbedder(): Promise<void> {
    if (this.embedder) return;

    const modelName =
      process.env.SENTENCE_TRANSFORMER_MODEL || 'Xenova/all-MiniLM-L6-v2';

    console.log('[Semantic Chunker] Loading model:', modelName);

    this.embedder = await pipeline('feature-extraction', modelName, {
      quantized: true, // Use quantized model for faster inference
    });

    console.log('[Semantic Chunker] Model loaded');
  }

  /**
   * Chunk text using semantic boundaries
   *
   * @param text - Text to chunk
   * @param metadata - Optional metadata (transcript/document info)
   */
  async chunk(
    text: string,
    metadata?: Record<string, any>
  ): Promise<SemanticChunk[]> {
    await this.initEmbedder();

    // Step 1: Split into sentences
    const sentences = this.splitIntoSentences(text);

    if (sentences.length === 0) {
      return [];
    }

    // Step 2: Detect structure elements (code, lists, tables)
    const structures = this.config.preserveStructures
      ? await this.detectStructures(text)
      : [];

    // Step 3: Generate sentence embeddings
    const embeddings = await this.generateSentenceEmbeddings(sentences);

    // Step 4: Calculate semantic similarities between adjacent sentences
    const similarities = this.calculateAdjacentSimilarities(embeddings);

    // Step 5: Identify chunk boundaries
    const boundaries = this.identifyBoundaries(
      sentences,
      similarities,
      structures
    );

    // Step 6: Create chunks from boundaries
    const chunks = this.createChunks(
      text,
      sentences,
      boundaries,
      similarities,
      structures
    );

    console.log('[Semantic Chunker] Created chunks:', {
      inputLength: text.length,
      sentenceCount: sentences.length,
      chunkCount: chunks.length,
      avgChunkSize: Math.round(
        chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length
      ),
    });

    return chunks;
  }

  /**
   * Split text into sentences using simple heuristics
   */
  private splitIntoSentences(text: string): string[] {
    // Handle code blocks - don't split them
    const codeBlockPattern = /```[\s\S]*?```|`[^`]+`/g;
    const codeBlocks: string[] = [];
    let codeIndex = 0;

    // Replace code blocks with placeholders
    const textWithPlaceholders = text.replace(codeBlockPattern, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeIndex++}__`;
    });

    // Split on sentence boundaries
    const sentencePattern = /[.!?]+\s+(?=[A-Z])|[\n]{2,}/g;
    const sentences = textWithPlaceholders
      .split(sentencePattern)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Restore code blocks
    return sentences.map((sentence) =>
      sentence.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[parseInt(index)])
    );
  }

  /**
   * Detect structural elements (code, lists, tables)
   */
  private async detectStructures(
    text: string
  ): Promise<{ start: number; end: number; type: string }[]> {
    const structures: { start: number; end: number; type: string }[] = [];

    // Detect code blocks
    const codeBlockPattern = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockPattern.exec(text)) !== null) {
      structures.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'code',
      });
    }

    // Detect lists (markdown format)
    const listPattern = /(?:^|\n)((?:[*\-+]\s+.+\n?)+)/g;

    while ((match = listPattern.exec(text)) !== null) {
      structures.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'list',
      });
    }

    // Detect tables (markdown format)
    const tablePattern = /\|.+\|\n\|[-:| ]+\|\n(?:\|.+\|\n)+/g;

    while ((match = tablePattern.exec(text)) !== null) {
      structures.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'table',
      });
    }

    return structures.sort((a, b) => a.start - b.start);
  }

  /**
   * Generate embeddings for sentences
   */
  private async generateSentenceEmbeddings(
    sentences: string[]
  ): Promise<number[][]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const embeddings: number[][] = [];

    // Process in batches for efficiency
    const batchSize = 32;

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (sentence) => {
          const output = await this.embedder!(sentence, {
            pooling: 'mean',
            normalize: true,
          });

          return Array.from(output.data as Float32Array);
        })
      );

      embeddings.push(...results);
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between adjacent sentences
   */
  private calculateAdjacentSimilarities(
    embeddings: number[][]
  ): number[] {
    const similarities: number[] = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      const similarity = this.cosineSimilarity(embeddings[i], embeddings[i + 1]);
      similarities.push(similarity);
    }

    return similarities;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Identify chunk boundaries based on similarities and structures
   */
  private identifyBoundaries(
    sentences: string[],
    similarities: number[],
    structures: { start: number; end: number; type: string }[]
  ): ChunkBoundary[] {
    const boundaries: ChunkBoundary[] = [];
    let currentPosition = 0;

    for (let i = 0; i < sentences.length - 1; i++) {
      currentPosition += sentences[i].length + 1; // +1 for space/newline

      const similarity = similarities[i];

      // Check if in structure boundary
      const inStructure = structures.some(
        (s) => currentPosition >= s.start && currentPosition <= s.end
      );

      // Don't break within structures
      if (inStructure) {
        continue;
      }

      // Semantic break: low similarity
      if (similarity < this.config.similarityThreshold) {
        boundaries.push({
          position: currentPosition,
          type: 'semantic_break',
          confidence: 1 - similarity,
        });
      }

      // Topic shift: very low similarity
      if (similarity < this.config.similarityThreshold - 0.15) {
        boundaries.push({
          position: currentPosition,
          type: 'topic_shift',
          confidence: 1 - similarity,
        });
      }
    }

    // Add structure boundaries
    for (const structure of structures) {
      boundaries.push({
        position: structure.start,
        type: 'structure_boundary',
        confidence: 1.0,
      });

      boundaries.push({
        position: structure.end,
        type: 'structure_boundary',
        confidence: 1.0,
      });
    }

    // Sort by position
    return boundaries.sort((a, b) => a.position - b.position);
  }

  /**
   * Create chunks from identified boundaries
   */
  private createChunks(
    fullText: string,
    sentences: string[],
    boundaries: ChunkBoundary[],
    similarities: number[],
    structures: { start: number; end: number; type: string }[]
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentChunk: string[] = [];
    let currentStart = 0;
    let sentenceIndex = 0;

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];

      // Collect sentences until boundary
      while (sentenceIndex < sentences.length) {
        const sentence = sentences[sentenceIndex];
        const sentenceEnd = currentStart + sentence.length;

        if (sentenceEnd > boundary.position) {
          break;
        }

        currentChunk.push(sentence);
        currentStart = sentenceEnd + 1;
        sentenceIndex++;
      }

      // Check if chunk meets size requirements
      const chunkText = currentChunk.join(' ');
      const chunkSize = chunkText.length;

      if (chunkSize >= this.config.minSize || boundary.type === 'structure_boundary') {
        // Calculate semantic coherence score
        const chunkSentenceIndices = Array.from(
          { length: currentChunk.length },
          (_, i) => sentenceIndex - currentChunk.length + i
        );

        const semanticScore = this.calculateChunkCoherence(
          chunkSentenceIndices,
          similarities
        );

        // Determine structure type
        const structureType = this.determineStructureType(
          chunkText,
          structures,
          currentStart - chunkSize,
          currentStart
        );

        chunks.push({
          text: chunkText,
          startPosition: currentStart - chunkSize,
          endPosition: currentStart,
          sentences: [...currentChunk],
          semanticScore,
          structureType,
          boundaryType: boundary.type,
          tokenCount: Math.ceil(chunkText.length / 4), // Rough estimate
        });

        currentChunk = [];
      }
    }

    // Add remaining sentences as final chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');

      chunks.push({
        text: chunkText,
        startPosition: currentStart - chunkText.length,
        endPosition: currentStart,
        sentences: currentChunk,
        semanticScore: 0.5, // Default for final chunk
        structureType: 'paragraph',
        boundaryType: 'size_limit',
        tokenCount: Math.ceil(chunkText.length / 4),
      });
    }

    return chunks;
  }

  /**
   * Calculate coherence score for a chunk
   */
  private calculateChunkCoherence(
    sentenceIndices: number[],
    similarities: number[]
  ): number {
    if (sentenceIndices.length <= 1) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < sentenceIndices.length - 1; i++) {
      const index = sentenceIndices[i];

      if (index < similarities.length) {
        totalSimilarity += similarities[index];
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 0.5;
  }

  /**
   * Determine structure type of chunk
   */
  private determineStructureType(
    chunkText: string,
    structures: { start: number; end: number; type: string }[],
    start: number,
    end: number
  ): string {
    // Check if chunk overlaps with any structure
    const overlappingStructures = structures.filter(
      (s) => s.start < end && s.end > start
    );

    if (overlappingStructures.length === 0) {
      return 'paragraph';
    }

    if (overlappingStructures.length === 1) {
      return overlappingStructures[0].type;
    }

    return 'mixed';
  }
}

/**
 * Create default semantic chunker instance
 */
export function createSemanticChunker(
  config?: Partial<ChunkingConfig>
): SemanticChunker {
  return new SemanticChunker(config);
}
```

---

### 2.2 Content Classifier

**File:** `lib/services/content-classifier.ts`

```typescript
/**
 * Content Classification Service
 *
 * Classifies content type to determine optimal chunking strategy:
 * - Technical: code, APIs, configurations
 * - Narrative: stories, explanations, tutorials
 * - Reference: lists, tables, documentation
 */

export type ContentType = 'technical' | 'narrative' | 'reference' | 'mixed';

export interface ContentClassification {
  type: ContentType;
  confidence: number;
  features: {
    hasCode: boolean;
    hasList: boolean;
    hasTable: boolean;
    technicalTermDensity: number;
    averageSentenceLength: number;
  };
}

/**
 * Technical terms for classification
 */
const TECHNICAL_TERMS = new Set([
  'function',
  'class',
  'interface',
  'component',
  'api',
  'endpoint',
  'database',
  'query',
  'server',
  'client',
  'authentication',
  'authorization',
  'async',
  'await',
  'promise',
  'error',
  'exception',
  'variable',
  'constant',
  'parameter',
  'return',
  'import',
  'export',
  'configuration',
  'deployment',
  'docker',
  'kubernetes',
  // Add more as needed
]);

/**
 * Classify content type
 */
export function classifyContent(text: string): ContentClassification {
  const hasCode = /```[\s\S]*?```|`[^`]+`/.test(text);
  const hasList = /(?:^|\n)(?:[*\-+]\s+.+|^\d+\.\s+.+)/m.test(text);
  const hasTable = /\|.+\|\n\|[-:| ]+\|/.test(text);

  // Calculate technical term density
  const words = text.toLowerCase().split(/\s+/);
  const technicalCount = words.filter((w) => TECHNICAL_TERMS.has(w)).length;
  const technicalTermDensity = technicalCount / Math.max(words.length, 1);

  // Calculate average sentence length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.length, 0) /
    Math.max(sentences.length, 1);

  // Classification logic
  let type: ContentType = 'narrative';
  let confidence = 0.5;

  if (hasCode || technicalTermDensity > 0.15) {
    type = 'technical';
    confidence = 0.7 + Math.min(technicalTermDensity, 0.3);
  } else if (hasList || hasTable) {
    type = 'reference';
    confidence = 0.8;
  } else if (avgSentenceLength > 100) {
    type = 'narrative';
    confidence = 0.7;
  }

  // Mixed content
  if (hasCode && (hasList || hasTable)) {
    type = 'mixed';
    confidence = 0.6;
  }

  return {
    type,
    confidence,
    features: {
      hasCode,
      hasList,
      hasTable,
      technicalTermDensity,
      averageSentenceLength,
    },
  };
}
```

---

### 2.3 Adaptive Chunk Sizing

**File:** `lib/services/adaptive-sizing.ts`

```typescript
/**
 * Adaptive Chunk Sizing
 *
 * Adjusts chunk size based on content type and density.
 */

import type { ContentType } from './content-classifier';
import type { ChunkingConfig } from './semantic-chunker';

/**
 * Get optimal chunk config for content type
 */
export function getAdaptiveChunkConfig(
  contentType: ContentType
): Partial<ChunkingConfig> {
  switch (contentType) {
    case 'technical':
      return {
        minSize: 200,
        maxSize: 600,
        targetSize: 400,
        similarityThreshold: 0.80, // Lower threshold for technical content
      };

    case 'narrative':
      return {
        minSize: 400,
        maxSize: 1000,
        targetSize: 700,
        similarityThreshold: 0.85,
      };

    case 'reference':
      return {
        minSize: 150,
        maxSize: 500,
        targetSize: 300,
        similarityThreshold: 0.90, // Higher threshold to keep lists together
      };

    case 'mixed':
      return {
        minSize: 250,
        maxSize: 700,
        targetSize: 500,
        similarityThreshold: 0.82,
      };

    default:
      return {
        minSize: 300,
        maxSize: 800,
        targetSize: 500,
        similarityThreshold: 0.85,
      };
  }
}
```

---

### 2.4 Update Embeddings Handler

**File:** `lib/workers/handlers/generate-embeddings.ts` (UPDATE)

```typescript
// Add imports
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';

// Update handleGenerateEmbeddings function to use semantic chunking
export async function handleGenerateEmbeddings(
  job: Job<GenerateEmbeddingsPayload>
): Promise<void> {
  const { recordingId, orgId } = job.payload;

  // ... existing code to fetch transcript/document

  // Classify content
  const classification = classifyContent(fullText);

  console.log('[Job: Generate Embeddings] Content classification:', {
    type: classification.type,
    confidence: classification.confidence,
  });

  // Get adaptive config
  const chunkConfig = getAdaptiveChunkConfig(classification.type);

  // Create semantic chunker
  const chunker = createSemanticChunker(chunkConfig);

  // Generate semantic chunks
  const semanticChunks = await chunker.chunk(fullText, {
    recordingId,
    contentType: classification.type,
  });

  console.log('[Job: Generate Embeddings] Semantic chunks created:', {
    count: semanticChunks.length,
    avgSize: Math.round(
      semanticChunks.reduce((sum, c) => sum + c.text.length, 0) /
        semanticChunks.length
    ),
  });

  // Generate embeddings and store
  for (const [index, chunk] of semanticChunks.entries()) {
    const embedding = await generateEmbedding(chunk.text);

    await supabase.from('transcript_chunks').insert({
      recording_id: recordingId,
      org_id: orgId,
      chunk_text: chunk.text,
      chunk_embedding: embedding,
      chunk_index: index,
      source_type: sourceType,
      chunking_strategy: 'semantic',
      semantic_score: chunk.semanticScore,
      structure_type: chunk.structureType,
      boundary_type: chunk.boundaryType,
      metadata: {
        tokenCount: chunk.tokenCount,
        sentenceCount: chunk.sentences.length,
        contentType: classification.type,
      },
    });
  }

  // ... rest of existing code
}
```

---

## 🧪 Testing Requirements

### Unit Tests

**File:** `__tests__/services/semantic-chunker.test.ts`

```typescript
import { SemanticChunker } from '@/lib/services/semantic-chunker';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeAll(() => {
    chunker = new SemanticChunker({
      minSize: 100,
      maxSize: 300,
      targetSize: 200,
    });
  });

  it('should split text at semantic boundaries', async () => {
    const text = `
      Authentication is a crucial security feature. It verifies user identity.

      On a different note, database optimization improves performance. Indexing is key.
    `;

    const chunks = await chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toContain('Authentication');
    expect(chunks[1].text).toContain('database');
  });

  it('should preserve code blocks', async () => {
    const text = `
      Here's an example function:

      \`\`\`typescript
      function hello() {
        console.log('Hello');
      }
      \`\`\`

      This function prints a greeting.
    `;

    const chunks = await chunker.chunk(text);

    // Code block should be in one chunk
    const codeChunk = chunks.find((c) => c.text.includes('```'));
    expect(codeChunk).toBeDefined();
    expect(codeChunk?.structureType).toBe('code');
  });

  it('should calculate semantic coherence', async () => {
    const text = `
      First sentence about topic A. Second sentence about topic A.
      Third sentence about topic A.
    `;

    const chunks = await chunker.chunk(text);

    expect(chunks[0].semanticScore).toBeGreaterThan(0.7);
  });
});
```

---

## 📊 Monitoring & Analytics

### Chunking Quality Metrics

```typescript
// Add to lib/monitoring/metrics.ts

export interface ChunkingMetrics {
  strategy: string;
  avgChunkSize: number;
  avgSemanticScore: number;
  structurePreservation: number; // % of structures intact
  boundaryViolations: number;
}

export async function trackChunkingMetrics(
  recordingId: string
): Promise<ChunkingMetrics> {
  const supabase = await createClient();

  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('chunk_text, semantic_score, structure_type, boundary_type')
    .eq('recording_id', recordingId);

  if (!chunks || chunks.length === 0) {
    return {
      strategy: 'none',
      avgChunkSize: 0,
      avgSemanticScore: 0,
      structurePreservation: 0,
      boundaryViolations: 0,
    };
  }

  const avgChunkSize =
    chunks.reduce((sum, c) => sum + c.chunk_text.length, 0) / chunks.length;

  const avgSemanticScore =
    chunks.reduce((sum, c) => sum + (c.semantic_score || 0), 0) / chunks.length;

  const structureChunks = chunks.filter(
    (c) => c.structure_type && c.structure_type !== 'paragraph'
  );

  const structurePreservation =
    chunks.length > 0 ? structureChunks.length / chunks.length : 0;

  return {
    strategy: chunks[0].chunking_strategy || 'unknown',
    avgChunkSize,
    avgSemanticScore,
    structurePreservation,
    boundaryViolations: 0, // TODO: Implement violation detection
  };
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Install `@xenova/transformers` package
- [ ] Run database migration for chunking metadata
- [ ] Test semantic chunker on sample documents
- [ ] Verify code block preservation
- [ ] Benchmark chunking performance

### Migration Strategy

1. **Test on sample recordings** first
2. **Enable semantic chunking** for new recordings
3. **Optionally re-chunk existing recordings**:
   ```sql
   -- Re-generate chunks for specific recordings
   UPDATE jobs
   SET status = 'pending',
       run_after = now(),
       attempt_count = 0
   WHERE type = 'generate_embeddings'
     AND payload->>'recordingId' IN ('rec-1', 'rec-2', ...);
   ```

### Post-Deployment

- [ ] Monitor chunking job success rate
- [ ] Compare semantic vs fixed chunking quality
- [ ] Track structure preservation rates
- [ ] Measure retrieval improvement

---

## 💡 Usage Examples

### Example 1: Basic Semantic Chunking

```typescript
import { createSemanticChunker } from '@/lib/services/semantic-chunker';

const chunker = createSemanticChunker();

const chunks = await chunker.chunk(documentText);

console.log(`Created ${chunks.length} semantic chunks`);
```

### Example 2: Adaptive Chunking

```typescript
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';

const classification = classifyContent(text);
const config = getAdaptiveChunkConfig(classification.type);
const chunker = createSemanticChunker(config);

const chunks = await chunker.chunk(text);
```

---

## 🎯 Success Criteria

Phase 2 is considered complete when:

1. ✅ Semantic chunking produces 25% fewer boundary violations
2. ✅ 90%+ of code blocks preserved intact
3. ✅ Adaptive sizing working for all content types
4. ✅ Chunking latency < 5 seconds for 10,000 word document
5. ✅ All tests passing
6. ✅ Deployed to production

---

**Next Phase:** [Phase 3: Agentic Retrieval](./PHASE_3_AGENTIC_RETRIEVAL.md)
