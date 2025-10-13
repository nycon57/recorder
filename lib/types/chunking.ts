/**
 * Chunking Type Definitions
 *
 * Type definitions for semantic chunking system including boundaries,
 * chunk metadata, content classification, and configuration.
 */

/**
 * Chunk boundary decision
 */
export interface ChunkBoundary {
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
 * Content type classification
 */
export type ContentType = 'technical' | 'narrative' | 'reference' | 'mixed';

/**
 * Content classification result
 */
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
 * Structure element detected in text
 */
export interface StructureElement {
  start: number;
  end: number;
  type: 'code' | 'list' | 'table' | 'heading' | 'blockquote';
}

/**
 * Chunking strategy type
 */
export type ChunkingStrategy = 'fixed' | 'semantic' | 'adaptive' | 'hybrid';

/**
 * Chunk metadata for database storage
 */
export interface ChunkMetadata {
  chunkingStrategy: ChunkingStrategy;
  semanticScore?: number;
  structureType?: string;
  boundaryType?: string;
  tokenCount?: number;
  sentenceCount?: number;
  contentType?: ContentType;
}
