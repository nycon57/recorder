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
import type {
  ChunkBoundary,
  SemanticChunk,
  ChunkingConfig,
  StructureElement,
} from '@/lib/types/chunking';
import {
  parseIntSafe,
  parseFloatSafe,
  validateSemanticChunkConfig,
  sanitizeMetadata,
} from '@/lib/utils/config-validation';

// Security constraints
const SECURITY_LIMITS = {
  MAX_INPUT_SIZE: 1_000_000, // 1MB
  MAX_SENTENCE_COUNT: 5000,
  MAX_CHUNK_COUNT: 1000,
  MAX_PROCESSING_TIME: 30000, // 30 seconds
  REGEX_TIMEOUT: 1000, // 1 second per regex operation
  ALLOWED_MODELS: new Set([
    'Xenova/all-MiniLM-L6-v2',
    'Xenova/all-MiniLM-L12-v2',
  ]),
} as const;

// Global model cache with lifecycle management
let globalModelCache: {
  embedder: any | null;
  modelName: string;
  lastUsed: number;
  cleanupTimer: NodeJS.Timeout | null;
} = {
  embedder: null,
  modelName: '',
  lastUsed: 0,
  cleanupTimer: null,
};

const MODEL_CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes

/**
 * Semantic Chunker class with security enhancements
 */
export class SemanticChunker {
  private config: ChunkingConfig;
  private processingStartTime: number = 0;

  constructor(config?: Partial<ChunkingConfig>) {
    // Parse environment variables safely with validation
    const minSize = parseIntSafe(process.env.SEMANTIC_CHUNK_MIN_SIZE, 200, {
      min: 50,
      max: 10000,
    });
    const maxSize = parseIntSafe(process.env.SEMANTIC_CHUNK_MAX_SIZE, 800, {
      min: 100,
      max: 10000,
    });
    const targetSize = parseIntSafe(process.env.SEMANTIC_CHUNK_TARGET_SIZE, 500, {
      min: 50,
      max: 10000,
    });
    const similarityThreshold = parseFloatSafe(
      process.env.SEMANTIC_SIMILARITY_THRESHOLD,
      0.85,
      { min: 0, max: 1 }
    );

    this.config = {
      minSize,
      maxSize,
      targetSize,
      similarityThreshold,
      preserveStructures: true,
      ...config,
    };

    // Validate configuration consistency
    validateSemanticChunkConfig(this.config);
  }

  /**
   * Initialize sentence transformer model with error handling and model whitelisting
   */
  private async initEmbedder(): Promise<void> {
    // Use global cache if available
    if (globalModelCache.embedder) {
      globalModelCache.lastUsed = Date.now();
      this.scheduleModelCleanup();
      return;
    }

    const modelName =
      process.env.SENTENCE_TRANSFORMER_MODEL || 'Xenova/all-MiniLM-L6-v2';

    // Validate model is whitelisted
    if (!SECURITY_LIMITS.ALLOWED_MODELS.has(modelName)) {
      throw new Error(
        `Model "${modelName}" is not in the allowed list. Allowed models: ${Array.from(
          SECURITY_LIMITS.ALLOWED_MODELS
        ).join(', ')}`
      );
    }

    console.log('[Semantic Chunker] Loading model:', modelName);

    try {
      globalModelCache.embedder = await pipeline('feature-extraction', modelName, {
        quantized: true, // Use quantized model for faster inference
        progress_callback: (progress: any) => {
          if (progress.status === 'progress' && progress.progress) {
            console.log(`[Model Loading] ${Math.round(progress.progress)}%`);
          }
        },
      });
      globalModelCache.modelName = modelName;
      globalModelCache.lastUsed = Date.now();

      console.log('[Semantic Chunker] Model loaded successfully');
      this.scheduleModelCleanup();
    } catch (error) {
      console.error('[Semantic Chunker] Failed to load model:', error);
      throw new Error(
        `Failed to initialize semantic chunker model: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Schedule model cleanup after period of inactivity
   */
  private scheduleModelCleanup(): void {
    if (globalModelCache.cleanupTimer) {
      clearTimeout(globalModelCache.cleanupTimer);
    }

    globalModelCache.cleanupTimer = setTimeout(() => {
      if (Date.now() - globalModelCache.lastUsed >= MODEL_CLEANUP_DELAY) {
        console.log('[Semantic Chunker] Cleaning up inactive model');
        globalModelCache.embedder = null;
        globalModelCache.modelName = '';
        if (typeof global !== 'undefined' && (global as any).gc) {
          (global as any).gc();
        }
      }
    }, MODEL_CLEANUP_DELAY);
  }

  /**
   * Chunk text using semantic boundaries with security protections
   *
   * @param text - Text to chunk
   * @param metadata - Optional metadata (transcript/document info)
   */
  async chunk(
    text: string,
    metadata?: Record<string, any>
  ): Promise<SemanticChunk[]> {
    this.processingStartTime = Date.now();

    // Input validation
    if (typeof text !== 'string') {
      throw new Error('Input text must be a string');
    }

    // Sanitize input - remove null bytes and normalize whitespace
    text = text.replace(/\0/g, '').replace(/[\r\n]+/g, '\n');

    // Size limit
    if (text.length > SECURITY_LIMITS.MAX_INPUT_SIZE) {
      console.warn(
        `[Semantic Chunker] Input size ${text.length} exceeds limit ${SECURITY_LIMITS.MAX_INPUT_SIZE}, truncating`
      );
      text = text.substring(0, SECURITY_LIMITS.MAX_INPUT_SIZE);
    }

    // Handle very short text
    if (text.trim().length < this.config.minSize) {
      return [
        {
          text: text.trim(),
          startPosition: 0,
          endPosition: text.length,
          sentences: [text.trim()],
          semanticScore: 1.0,
          structureType: 'paragraph',
          boundaryType: 'size_limit',
          tokenCount: Math.ceil(text.length / 4),
        },
      ];
    }

    try {
      // Initialize model with error handling
      await this.initEmbedder();
      this.checkTimeout();

      // Step 1: Split into sentences
      const sentences = this.splitIntoSentences(text);

      if (sentences.length === 0) {
        return [];
      }

      // Enforce sentence count limit
      if (sentences.length > SECURITY_LIMITS.MAX_SENTENCE_COUNT) {
        console.warn(
          `[Semantic Chunker] Sentence count ${sentences.length} exceeds limit ${SECURITY_LIMITS.MAX_SENTENCE_COUNT}, truncating`
        );
        sentences.splice(SECURITY_LIMITS.MAX_SENTENCE_COUNT);
      }

      this.checkTimeout();

      // Step 2: Detect structure elements (code, lists, tables)
      const structures = this.config.preserveStructures
        ? await this.detectStructures(text)
        : [];

      this.checkTimeout();

      // Step 3: Generate sentence embeddings
      const embeddings = await this.generateSentenceEmbeddings(sentences);

      this.checkTimeout();

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

      // Enforce chunk count limit
      if (chunks.length > SECURITY_LIMITS.MAX_CHUNK_COUNT) {
        console.warn(
          `[Semantic Chunker] Chunk count ${chunks.length} exceeds limit ${SECURITY_LIMITS.MAX_CHUNK_COUNT}, truncating`
        );
        chunks.splice(SECURITY_LIMITS.MAX_CHUNK_COUNT);
      }

      const processingTime = Date.now() - this.processingStartTime;

      console.log('[Semantic Chunker] Created chunks:', {
        inputLength: text.length,
        sentenceCount: sentences.length,
        chunkCount: chunks.length,
        avgChunkSize:
          chunks.length > 0
            ? Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)
            : 0,
        processingTimeMs: processingTime,
      });

      return chunks;
    } catch (error) {
      console.error('[Semantic Chunker] Chunking failed:', error);
      throw new Error(
        `Semantic chunking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if processing has exceeded timeout
   */
  private checkTimeout(): void {
    if (Date.now() - this.processingStartTime > SECURITY_LIMITS.MAX_PROCESSING_TIME) {
      throw new Error(
        `Processing timeout exceeded (${SECURITY_LIMITS.MAX_PROCESSING_TIME}ms)`
      );
    }
  }

  /**
   * Split text into sentences with safe regex patterns
   */
  private splitIntoSentences(text: string): string[] {
    // Safe regex patterns with bounded quantifiers to prevent ReDoS
    const codeBlockPattern = /```[\s\S]{0,50000}?```|`[^`]{0,1000}`/g;
    const codeBlocks: string[] = [];
    let codeIndex = 0;

    // Replace code blocks with placeholders
    // Use lookbehind-free approach for better compatibility
    const textWithPlaceholders = text.replace(codeBlockPattern, (match) => {
      // Limit code block collection to prevent memory exhaustion
      if (codeBlocks.length < 1000) {
        codeBlocks.push(match);
      } else {
        console.warn('[Semantic Chunker] Code block limit reached');
      }
      return `__CODE_BLOCK_${codeIndex++}__`;
    });

    // Split on sentence boundaries - safe pattern with bounded quantifiers
    const sentencePattern = /(?<=[.!?])\s+(?=[A-Z])|(?:\n{2,5})/g;
    const sentences = textWithPlaceholders
      .split(sentencePattern)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Restore code blocks safely
    return sentences.map((sentence) =>
      sentence.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
        const idx = parseInt(index, 10);
        return idx < codeBlocks.length ? codeBlocks[idx] : '';
      })
    );
  }

  /**
   * Detect structural elements with safe regex patterns
   */
  private async detectStructures(text: string): Promise<StructureElement[]> {
    const structures: StructureElement[] = [];

    // Safe patterns with bounded quantifiers to prevent ReDoS
    const patterns = [
      { regex: /```[\s\S]{0,50000}?```/g, type: 'code' as const },
      { regex: /(?:^|\n)((?:[*\-+]\s+.{0,500}\n?){1,100})/gm, type: 'list' as const },
      { regex: /\|.{0,500}\|\n\|[-:| ]{0,500}\|\n(?:\|.{0,500}\|\n){0,100}/g, type: 'table' as const },
      { regex: /(?:^|\n)(#{1,6}\s+.{0,200})/gm, type: 'heading' as const },
    ];

    let match;
    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Prevent infinite loops

    for (const { regex, type } of patterns) {
      // Reset regex state
      regex.lastIndex = 0;

      try {
        while ((match = regex.exec(text)) !== null) {
          iterations++;

          // Safety check for iteration count
          if (iterations > MAX_ITERATIONS) {
            console.warn('[Semantic Chunker] Max iterations reached in structure detection');
            break;
          }

          structures.push({
            start: match.index,
            end: match.index + match[0].length,
            type,
          });

          // Prevent infinite loop on zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          // Check timeout periodically
          if (iterations % 100 === 0) {
            this.checkTimeout();
          }
        }
      } catch (error) {
        console.warn(`[Semantic Chunker] Error detecting ${type} structures:`, error);
        // Continue with other patterns
      }
    }

    return structures.sort((a, b) => a.start - b.start);
  }

  /**
   * Generate embeddings for sentences with memory management
   */
  private async generateSentenceEmbeddings(
    sentences: string[]
  ): Promise<number[][]> {
    if (!globalModelCache.embedder) {
      throw new Error('Embedder not initialized');
    }

    const embeddings: number[][] = [];

    // Process in batches for efficiency and memory management
    const batchSize = 32;
    const batchDelay = 10; // ms delay between batches to prevent overload

    for (let i = 0; i < sentences.length; i += batchSize) {
      // Check timeout before processing batch
      this.checkTimeout();

      // Check memory periodically (every 5 batches)
      if (i > 0 && i % (batchSize * 5) === 0) {
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memoryUsed > 500) {
          // 500MB limit
          console.warn(`[Semantic Chunker] High memory usage: ${Math.round(memoryUsed)}MB`);
        }
      }

      const batch = sentences.slice(i, Math.min(i + batchSize, sentences.length));

      try {
        const results = await Promise.all(
          batch.map(async (sentence) => {
            // Truncate very long sentences to prevent memory issues
            const truncated = sentence.length > 512 ? sentence.substring(0, 512) : sentence;

            const output = await globalModelCache.embedder!(truncated, {
              pooling: 'mean',
              normalize: true,
            });

            return Array.from(output.data as Float32Array);
          })
        );

        embeddings.push(...results);
      } catch (error) {
        console.error(
          `[Semantic Chunker] Error generating embeddings for batch ${i / batchSize}:`,
          error
        );
        // Use zero embeddings as fallback to prevent complete failure
        const fallback = batch.map(() => new Array(384).fill(0));
        embeddings.push(...fallback);
      }

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < sentences.length) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
      }
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity between adjacent sentences
   */
  private calculateAdjacentSimilarities(embeddings: number[][]): number[] {
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
    structures: StructureElement[]
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
    structures: StructureElement[]
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

      if (
        chunkSize >= this.config.minSize ||
        boundary.type === 'structure_boundary'
      ) {
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
    structures: StructureElement[],
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
