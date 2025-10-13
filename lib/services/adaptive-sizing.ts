/**
 * Adaptive Chunk Sizing
 *
 * Adjusts chunk size based on content type and density to optimize
 * retrieval quality and semantic coherence.
 */

import type { ContentType, ChunkingConfig } from '@/lib/types/chunking';

/**
 * Get optimal chunk config for content type
 *
 * Different content types benefit from different chunk sizes:
 * - Technical: Smaller chunks to preserve code context
 * - Narrative: Larger chunks to maintain story flow
 * - Reference: Medium chunks to keep lists/tables together
 * - Mixed: Balanced approach
 *
 * @param contentType - Type of content being chunked
 * @returns Optimal chunking configuration
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
        similarityThreshold: 0.8, // Lower threshold for technical content
        preserveStructures: true,
      };

    case 'narrative':
      return {
        minSize: 400,
        maxSize: 1000,
        targetSize: 700,
        similarityThreshold: 0.85,
        preserveStructures: true,
      };

    case 'reference':
      return {
        minSize: 150,
        maxSize: 500,
        targetSize: 300,
        similarityThreshold: 0.9, // Higher threshold to keep lists together
        preserveStructures: true,
      };

    case 'mixed':
      return {
        minSize: 250,
        maxSize: 700,
        targetSize: 500,
        similarityThreshold: 0.82,
        preserveStructures: true,
      };

    default:
      return {
        minSize: 300,
        maxSize: 800,
        targetSize: 500,
        similarityThreshold: 0.85,
        preserveStructures: true,
      };
  }
}

/**
 * Calculate optimal chunk size for a given text segment
 *
 * @param text - Text segment to analyze
 * @param contentType - Content type classification
 * @returns Recommended chunk size
 */
export function calculateOptimalChunkSize(
  text: string,
  contentType: ContentType
): number {
  const config = getAdaptiveChunkConfig(contentType);
  const textLength = text.length;

  // If text is shorter than target, use actual length
  if (textLength < config.targetSize!) {
    return Math.max(textLength, config.minSize!);
  }

  // If text is longer, use target size
  return config.targetSize!;
}

/**
 * Determine if a chunk should be split based on size constraints
 *
 * @param chunkSize - Current chunk size
 * @param config - Chunking configuration
 * @returns True if chunk should be split
 */
export function shouldSplitChunk(
  chunkSize: number,
  config: ChunkingConfig
): boolean {
  return chunkSize > config.maxSize;
}

/**
 * Determine if chunks should be merged based on size constraints
 *
 * @param chunk1Size - First chunk size
 * @param chunk2Size - Second chunk size
 * @param config - Chunking configuration
 * @returns True if chunks should be merged
 */
export function shouldMergeChunks(
  chunk1Size: number,
  chunk2Size: number,
  config: ChunkingConfig
): boolean {
  const combinedSize = chunk1Size + chunk2Size;

  // Merge if both are small and combined doesn't exceed target
  return (
    chunk1Size < config.minSize &&
    chunk2Size < config.minSize &&
    combinedSize <= config.targetSize
  );
}
