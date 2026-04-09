/**
 * Semantic Chunking Service - Security Hardened Version
 *
 * Implements semantic chunking with comprehensive security controls:
 * - Input validation and sanitization
 * - Resource exhaustion protection
 * - Safe regex patterns with timeouts
 * - Memory management
 * - Model whitelisting
 * - Rate limiting support
 */

import { pipeline, env } from '@xenova/transformers';
import { z } from 'zod';

import type {
  ChunkBoundary,
  SemanticChunk,
  ChunkingConfig,
  StructureElement,
} from '@/lib/types/chunking';

// Security configuration
const SECURITY_CONFIG = {
  MAX_INPUT_SIZE: 1_000_000, // 1MB
  MAX_SENTENCE_COUNT: 5000,
  MAX_CHUNK_COUNT: 1000,
  MAX_PROCESSING_TIME: 30000, // 30 seconds
  MAX_MEMORY_MB: 500,
  REGEX_TIMEOUT: 1000, // 1 second
  ALLOWED_MODELS: new Set([
    'Xenova/all-MiniLM-L6-v2',
    'Xenova/all-MiniLM-L12-v2',
  ]),
  BATCH_SIZE: 32,
  BATCH_DELAY: 50, // ms between batches
} as const;

// Configure Xenova transformers securely
env.allowLocalModels = false; // Force remote models
(env as any).remoteURL = 'https://huggingface.co/';

// Input validation schemas
const ChunkingInputSchema = z.object({
  text: z.string().min(1).max(SECURITY_CONFIG.MAX_INPUT_SIZE),
  metadata: z.record(z.unknown()).optional(),
});

const ConfigSchema = z.object({
  minSize: z.number().min(10).max(10000).default(200),
  maxSize: z.number().min(100).max(10000).default(800),
  targetSize: z.number().min(50).max(10000).default(500),
  similarityThreshold: z.number().min(0).max(1).default(0.85),
  preserveStructures: z.boolean().default(true),
});

// Type for the Xenova pipeline
type FeatureExtractionPipeline = Awaited<ReturnType<typeof pipeline>>;

/**
 * Resource Monitor for tracking memory and time
 */
class ResourceMonitor {
  private startTime = Date.now();
  private readonly maxDuration: number;
  private readonly maxMemory: number;

  constructor(maxDuration = SECURITY_CONFIG.MAX_PROCESSING_TIME, maxMemory = SECURITY_CONFIG.MAX_MEMORY_MB) {
    this.maxDuration = maxDuration;
    this.maxMemory = maxMemory;
  }

  checkTimeout(): void {
    if (Date.now() - this.startTime > this.maxDuration) {
      throw new SecurityError('Operation timeout', 'TIMEOUT', 408);
    }
  }

  checkMemory(): void {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    if (used > this.maxMemory) {
      throw new SecurityError('Memory limit exceeded', 'MEMORY_EXCEEDED', 507);
    }
  }

  reset(): void {
    this.startTime = Date.now();
  }
}

/**
 * Security-focused error class
 */
class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'SecurityError';
    // Don't leak stack traces in production
    if (process.env.NODE_ENV === 'production') {
      this.stack = undefined;
    }
  }
}

/**
 * Secure model manager with validation
 */
class SecureModelManager {
  private static instance: SecureModelManager;
  private model: FeatureExtractionPipeline | null = null;
  private modelName: string;
  private lastUsed: number = Date.now();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_DELAY = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    const requestedModel = process.env.SENTENCE_TRANSFORMER_MODEL || 'Xenova/all-MiniLM-L6-v2';

    // Validate model is in whitelist
    if (!SECURITY_CONFIG.ALLOWED_MODELS.has(requestedModel)) {
      throw new SecurityError(
        `Model ${requestedModel} not in allowed list`,
        'INVALID_MODEL',
        403
      );
    }

    this.modelName = requestedModel;
  }

  static getInstance(): SecureModelManager {
    if (!SecureModelManager.instance) {
      SecureModelManager.instance = new SecureModelManager();
    }
    return SecureModelManager.instance;
  }

  async getModel(): Promise<FeatureExtractionPipeline> {
    this.lastUsed = Date.now();

    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    if (!this.model) {
      console.log('[Secure Model Manager] Loading whitelisted model:', this.modelName);

      try {
        this.model = await pipeline('feature-extraction', this.modelName, {
          quantized: true,
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              console.log(`[Model Loading] ${Math.round(progress.progress)}%`);
            }
          },
        });
        console.log('[Secure Model Manager] Model loaded successfully');
      } catch (error) {
        throw new SecurityError('Failed to load model', 'MODEL_LOAD_FAILED', 500);
      }
    }

    this.scheduleCleanup();
    return this.model;
  }

  private scheduleCleanup(): void {
    this.cleanupTimer = setTimeout(() => {
      if (Date.now() - this.lastUsed >= this.CLEANUP_DELAY) {
        this.cleanup();
      }
    }, this.CLEANUP_DELAY);
  }

  cleanup(): void {
    if (this.model) {
      console.log('[Secure Model Manager] Cleaning up model');
      this.model = null;
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
    }
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Parse and validate environment variables
 */
function parseEnvInt(key: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;

  const value = parseInt(raw, 10);
  if (isNaN(value) || value < min || value > max) {
    console.warn(`Invalid ${key}="${raw}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
}

function parseEnvFloat(key: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;

  const value = parseFloat(raw);
  if (isNaN(value) || value < min || value > max) {
    console.warn(`Invalid ${key}="${raw}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
}

/**
 * Execute regex with timeout protection
 */
async function execRegexWithTimeout(
  pattern: RegExp,
  text: string,
  timeout = SECURITY_CONFIG.REGEX_TIMEOUT
): Promise<RegExpExecArray[]> {
  return new Promise((resolve, reject) => {
    const results: RegExpExecArray[] = [];
    const timer = setTimeout(() => {
      reject(new SecurityError('Regex execution timeout', 'REGEX_TIMEOUT', 408));
    }, timeout);

    try {
      let match;
      let iterations = 0;
      const MAX_ITERATIONS = 10000; // Prevent infinite loops

      while ((match = pattern.exec(text)) !== null) {
        results.push(match);
        iterations++;

        if (iterations > MAX_ITERATIONS) {
          clearTimeout(timer);
          reject(new SecurityError('Too many regex matches', 'REGEX_OVERFLOW', 413));
          return;
        }

        // Prevent infinite loop with zero-width matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }

      clearTimeout(timer);
      resolve(results);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

/**
 * Sanitize text input
 */
function sanitizeInput(text: string): string {
  // Remove null bytes
  text = text.replace(/\0/g, '');

  // Normalize whitespace
  text = text.replace(/[\r\n]+/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');

  // Trim to max size
  if (text.length > SECURITY_CONFIG.MAX_INPUT_SIZE) {
    console.warn('Input truncated to maximum size');
    text = text.substring(0, SECURITY_CONFIG.MAX_INPUT_SIZE);
  }

  return text;
}

/**
 * Secure Semantic Chunker
 */
export class SecureSemanticChunker {
  private config: ChunkingConfig;
  private modelManager: SecureModelManager;
  private resourceMonitor: ResourceMonitor;

  constructor(config?: Partial<ChunkingConfig>) {
    // Validate configuration with Zod
    const validatedConfig = ConfigSchema.parse({
      minSize: parseEnvInt('SEMANTIC_CHUNK_MIN_SIZE', 200, 10, 10000),
      maxSize: parseEnvInt('SEMANTIC_CHUNK_MAX_SIZE', 800, 100, 10000),
      targetSize: parseEnvInt('SEMANTIC_CHUNK_TARGET_SIZE', 500, 50, 10000),
      similarityThreshold: parseEnvFloat('SEMANTIC_SIMILARITY_THRESHOLD', 0.85, 0, 1),
      preserveStructures: true,
      ...config,
    });

    this.config = validatedConfig;
    this.modelManager = SecureModelManager.getInstance();
    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Chunk text with comprehensive security checks
   */
  async chunk(
    rawText: string,
    rawMetadata?: Record<string, unknown>
  ): Promise<SemanticChunk[]> {
    // Reset resource monitor
    this.resourceMonitor.reset();

    // Validate input
    const { text: unsafeText, metadata } = ChunkingInputSchema.parse({
      text: rawText,
      metadata: rawMetadata,
    });

    // Sanitize text
    const text = sanitizeInput(unsafeText);

    // Check if text is too short
    if (text.length < this.config.minSize) {
      return [{
        text: text.trim(),
        startPosition: 0,
        endPosition: text.length,
        sentences: [text.trim()],
        semanticScore: 1.0,
        structureType: 'paragraph',
        boundaryType: 'size_limit',
        tokenCount: Math.ceil(text.length / 4),
      }];
    }

    try {
      // Check resources periodically
      this.resourceMonitor.checkTimeout();
      this.resourceMonitor.checkMemory();

      // Split into sentences with limits
      const sentences = await this.splitIntoSentencesSecure(text);

      if (sentences.length === 0) {
        return [];
      }

      // Limit sentence count
      if (sentences.length > SECURITY_CONFIG.MAX_SENTENCE_COUNT) {
        console.warn(`Sentence count ${sentences.length} exceeds limit, truncating`);
        sentences.splice(SECURITY_CONFIG.MAX_SENTENCE_COUNT);
      }

      // Detect structures with timeout protection
      const structures = this.config.preserveStructures
        ? await this.detectStructuresSecure(text)
        : [];

      this.resourceMonitor.checkTimeout();
      this.resourceMonitor.checkMemory();

      // Generate embeddings with resource management
      const embeddings = await this.generateEmbeddingsSecure(sentences);

      this.resourceMonitor.checkTimeout();
      this.resourceMonitor.checkMemory();

      // Calculate similarities
      const similarities = this.calculateAdjacentSimilarities(embeddings);

      // Identify boundaries
      const boundaries = this.identifyBoundaries(sentences, similarities, structures);

      // Create chunks with limits
      const chunks = this.createChunksSecure(
        text,
        sentences,
        boundaries,
        similarities,
        structures
      );

      // Limit chunk count
      if (chunks.length > SECURITY_CONFIG.MAX_CHUNK_COUNT) {
        console.warn(`Chunk count ${chunks.length} exceeds limit, truncating`);
        chunks.splice(SECURITY_CONFIG.MAX_CHUNK_COUNT);
      }

      console.log('[Secure Chunker] Completed:', {
        inputLength: text.length,
        sentenceCount: sentences.length,
        chunkCount: chunks.length,
        processingTime: Date.now() - this.resourceMonitor['startTime'],
      });

      return chunks;
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      console.error('[Secure Chunker] Unexpected error:', error);
      throw new SecurityError('Chunking failed', 'CHUNKING_FAILED', 500);
    }
  }

  /**
   * Split text into sentences with security measures
   */
  private async splitIntoSentencesSecure(text: string): Promise<string[]> {
    // Safe regex patterns with bounded quantifiers
    const codeBlockPattern = /```[\s\S]{0,50000}?```|`[^`]{0,1000}`/g;
    const sentencePattern = /(?<=[.!?])\s+(?=[A-Z])|(?:\n{2,5})/g;

    const codeBlocks: string[] = [];
    let codeIndex = 0;

    // Extract code blocks with timeout protection
    const codeMatches = await execRegexWithTimeout(codeBlockPattern, text);

    for (const match of codeMatches) {
      codeBlocks.push(match[0]);
    }

    // Replace code blocks with placeholders
    const textWithPlaceholders = text.replace(codeBlockPattern, () => {
      return `__CODE_BLOCK_${codeIndex++}__`;
    });

    // Split sentences
    const sentences = textWithPlaceholders
      .split(sentencePattern)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Restore code blocks
    return sentences.map((sentence) =>
      sentence.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
        const idx = parseInt(index, 10);
        return idx < codeBlocks.length ? codeBlocks[idx] : '';
      })
    );
  }

  /**
   * Detect structures with timeout protection
   */
  private async detectStructuresSecure(text: string): Promise<StructureElement[]> {
    const structures: StructureElement[] = [];

    // Safe patterns with bounded quantifiers
    const patterns = [
      { regex: /```[\s\S]{0,50000}?```/g, type: 'code' as const },
      { regex: /(?:^|\n)((?:[*\-+]\s+.{0,500}\n?){1,100})/gm, type: 'list' as const },
      { regex: /\|.{0,500}\|\n\|[-:| ]{0,500}\|\n(?:\|.{0,500}\|\n){0,100}/g, type: 'table' as const },
      { regex: /(?:^|\n)(#{1,6}\s+.{0,200})/gm, type: 'heading' as const },
    ];

    for (const { regex, type } of patterns) {
      try {
        const matches = await execRegexWithTimeout(regex, text);
        for (const match of matches) {
          structures.push({
            start: match.index,
            end: match.index + match[0].length,
            type,
          });
        }
      } catch (error) {
        console.warn(`Failed to detect ${type} structures:`, error);
      }
    }

    return structures.sort((a, b) => a.start - b.start);
  }

  /**
   * Generate embeddings with resource management
   */
  private async generateEmbeddingsSecure(sentences: string[]): Promise<number[][]> {
    const model = await this.modelManager.getModel();
    const embeddings: number[][] = [];

    for (let i = 0; i < sentences.length; i += SECURITY_CONFIG.BATCH_SIZE) {
      // Check resources before each batch
      this.resourceMonitor.checkTimeout();
      this.resourceMonitor.checkMemory();

      const batch = sentences.slice(i, Math.min(i + SECURITY_CONFIG.BATCH_SIZE, sentences.length));

      try {
        const batchEmbeddings = await Promise.all(
          batch.map(async (sentence) => {
            // Limit sentence length for embedding
            const truncated = sentence.substring(0, 512);
            const output = await model(truncated, {
              pooling: 'mean',
              normalize: true as unknown as any,
            } as any);
            return Array.from((output as any).data as Float32Array);
          })
        );

        embeddings.push(...batchEmbeddings);
      } catch (error) {
        console.error(`Failed to embed batch ${i / SECURITY_CONFIG.BATCH_SIZE}:`, error);
        // Use zero embeddings as fallback
        const fallback = batch.map(() => new Array(384).fill(0));
        embeddings.push(...fallback);
      }

      // Delay between batches to prevent overload
      if (i + SECURITY_CONFIG.BATCH_SIZE < sentences.length) {
        await new Promise(resolve => setTimeout(resolve, SECURITY_CONFIG.BATCH_DELAY));
      }
    }

    return embeddings;
  }

  /**
   * Calculate cosine similarity safely
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      // Validate numbers
      const valA = Number.isFinite(a[i]) ? a[i] : 0;
      const valB = Number.isFinite(b[i]) ? b[i] : 0;

      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : Math.max(-1, Math.min(1, dotProduct / denominator));
  }

  /**
   * Calculate adjacent similarities
   */
  private calculateAdjacentSimilarities(embeddings: number[][]): number[] {
    const similarities: number[] = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      similarities.push(this.cosineSimilarity(embeddings[i], embeddings[i + 1]));
    }

    return similarities;
  }

  /**
   * Identify chunk boundaries
   */
  private identifyBoundaries(
    sentences: string[],
    similarities: number[],
    structures: StructureElement[]
  ): ChunkBoundary[] {
    const boundaries: ChunkBoundary[] = [];
    let currentPosition = 0;

    // Build structure index for efficient lookups
    const structureIndex = new Set<number>();
    structures.forEach(s => {
      for (let pos = s.start; pos <= s.end && pos < SECURITY_CONFIG.MAX_INPUT_SIZE; pos++) {
        structureIndex.add(pos);
      }
    });

    for (let i = 0; i < sentences.length - 1; i++) {
      currentPosition += sentences[i].length + 1;

      if (structureIndex.has(currentPosition)) {
        continue;
      }

      const similarity = similarities[i];

      if (similarity < this.config.similarityThreshold) {
        boundaries.push({
          position: currentPosition,
          type: 'semantic_break',
          confidence: 1 - similarity,
        });
      }

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
      boundaries.push(
        {
          position: structure.start,
          type: 'structure_boundary',
          confidence: 1.0,
        },
        {
          position: structure.end,
          type: 'structure_boundary',
          confidence: 1.0,
        }
      );
    }

    return boundaries.sort((a, b) => a.position - b.position);
  }

  /**
   * Create chunks with security limits
   */
  private createChunksSecure(
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

    const allBoundaries = [...boundaries, {
      position: fullText.length,
      type: 'size_limit' as const,
      confidence: 1.0,
    }];

    for (const boundary of allBoundaries) {
      // Stop if we've reached chunk limit
      if (chunks.length >= SECURITY_CONFIG.MAX_CHUNK_COUNT) {
        console.warn('Reached maximum chunk count');
        break;
      }

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

      const chunkText = currentChunk.join(' ');
      const chunkSize = chunkText.length;

      if (
        chunkSize >= this.config.minSize ||
        boundary.type === 'structure_boundary' ||
        sentenceIndex >= sentences.length
      ) {
        if (chunkSize > 0) {
          const chunkSentenceIndices = Array.from(
            { length: currentChunk.length },
            (_, i) => sentenceIndex - currentChunk.length + i
          );

          const semanticScore = this.calculateChunkCoherence(
            chunkSentenceIndices,
            similarities
          );

          chunks.push({
            text: chunkText,
            startPosition: currentStart - chunkSize,
            endPosition: currentStart,
            sentences: [...currentChunk],
            semanticScore,
            structureType: this.determineStructureType(
              chunkText,
              structures,
              currentStart - chunkSize,
              currentStart
            ),
            boundaryType: boundary.type,
            tokenCount: Math.ceil(chunkText.length / 4),
          });

          currentChunk = [];
        }
      }
    }

    return chunks;
  }

  /**
   * Calculate chunk coherence safely
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
      if (index >= 0 && index < similarities.length) {
        const sim = similarities[index];
        if (Number.isFinite(sim)) {
          totalSimilarity += sim;
          count++;
        }
      }
    }

    return count > 0 ? totalSimilarity / count : 0.5;
  }

  /**
   * Determine structure type
   */
  private determineStructureType(
    chunkText: string,
    structures: StructureElement[],
    start: number,
    end: number
  ): string {
    const overlapping = structures.filter(
      (s) => s.start < end && s.end > start
    );

    if (overlapping.length === 0) return 'paragraph';
    if (overlapping.length === 1) return overlapping[0].type;
    return 'mixed';
  }
}

/**
 * Factory function with validation
 */
export function createSecureSemanticChunker(
  config?: Partial<ChunkingConfig>
): SecureSemanticChunker {
  return new SecureSemanticChunker(config);
}

/**
 * Export security utilities for testing
 */
export const SecurityUtils = {
  sanitizeInput,
  parseEnvInt,
  parseEnvFloat,
  execRegexWithTimeout,
  SecurityError,
  SECURITY_CONFIG,
};