/**
 * Adaptive Sizing Tests
 *
 * Tests adaptive chunk sizing based on content type to optimize
 * retrieval quality and semantic coherence.
 */

import {
  getAdaptiveChunkConfig,
  calculateOptimalChunkSize,
  shouldSplitChunk,
  shouldMergeChunks,
} from '@/lib/services/adaptive-sizing';
import type { ContentType, ChunkingConfig } from '@/lib/types/chunking';

describe('Adaptive Sizing', () => {
  describe('getAdaptiveChunkConfig', () => {
    it('should return config for technical content', () => {
      const config = getAdaptiveChunkConfig('technical');

      expect(config.minSize).toBe(200);
      expect(config.maxSize).toBe(600);
      expect(config.targetSize).toBe(400);
      expect(config.similarityThreshold).toBe(0.8);
      expect(config.preserveStructures).toBe(true);
    });

    it('should return config for narrative content', () => {
      const config = getAdaptiveChunkConfig('narrative');

      expect(config.minSize).toBe(400);
      expect(config.maxSize).toBe(1000);
      expect(config.targetSize).toBe(700);
      expect(config.similarityThreshold).toBe(0.85);
      expect(config.preserveStructures).toBe(true);
    });

    it('should return config for reference content', () => {
      const config = getAdaptiveChunkConfig('reference');

      expect(config.minSize).toBe(150);
      expect(config.maxSize).toBe(500);
      expect(config.targetSize).toBe(300);
      expect(config.similarityThreshold).toBe(0.9);
      expect(config.preserveStructures).toBe(true);
    });

    it('should return config for mixed content', () => {
      const config = getAdaptiveChunkConfig('mixed');

      expect(config.minSize).toBe(250);
      expect(config.maxSize).toBe(700);
      expect(config.targetSize).toBe(500);
      expect(config.similarityThreshold).toBe(0.82);
      expect(config.preserveStructures).toBe(true);
    });

    it('should return default config for unknown content type', () => {
      const config = getAdaptiveChunkConfig('unknown' as ContentType);

      expect(config.minSize).toBe(300);
      expect(config.maxSize).toBe(800);
      expect(config.targetSize).toBe(500);
      expect(config.similarityThreshold).toBe(0.85);
      expect(config.preserveStructures).toBe(true);
    });

    it('should have appropriate size ordering (min < target < max)', () => {
      const contentTypes: ContentType[] = ['technical', 'narrative', 'reference', 'mixed'];

      contentTypes.forEach((type) => {
        const config = getAdaptiveChunkConfig(type);

        expect(config.minSize).toBeLessThan(config.targetSize!);
        expect(config.targetSize).toBeLessThan(config.maxSize!);
      });
    });

    it('should have similarity thresholds in valid range', () => {
      const contentTypes: ContentType[] = ['technical', 'narrative', 'reference', 'mixed'];

      contentTypes.forEach((type) => {
        const config = getAdaptiveChunkConfig(type);

        expect(config.similarityThreshold).toBeGreaterThanOrEqual(0);
        expect(config.similarityThreshold).toBeLessThanOrEqual(1);
      });
    });

    it('should use lower threshold for technical content (easier to split)', () => {
      const technicalConfig = getAdaptiveChunkConfig('technical');
      const narrativeConfig = getAdaptiveChunkConfig('narrative');

      // Technical content should split more easily (lower threshold)
      expect(technicalConfig.similarityThreshold).toBeLessThan(
        narrativeConfig.similarityThreshold!
      );
    });

    it('should use higher threshold for reference content (keep lists together)', () => {
      const referenceConfig = getAdaptiveChunkConfig('reference');
      const technicalConfig = getAdaptiveChunkConfig('technical');

      // Reference content should stay together more (higher threshold)
      expect(referenceConfig.similarityThreshold).toBeGreaterThan(
        technicalConfig.similarityThreshold!
      );
    });
  });

  describe('calculateOptimalChunkSize', () => {
    it('should return minSize for short text', () => {
      const text = 'Short text';
      const size = calculateOptimalChunkSize(text, 'technical');

      expect(size).toBeGreaterThanOrEqual(200); // Technical minSize
    });

    it('should return actual length for text shorter than minSize', () => {
      const text = 'x'.repeat(100);
      const size = calculateOptimalChunkSize(text, 'technical');

      // Should return minSize (200) since text is shorter
      expect(size).toBe(200);
    });

    it('should return targetSize for text longer than target', () => {
      const text = 'x'.repeat(1000);
      const size = calculateOptimalChunkSize(text, 'technical');

      expect(size).toBe(400); // Technical targetSize
    });

    it('should adapt size based on content type', () => {
      const text = 'x'.repeat(1000);

      const technicalSize = calculateOptimalChunkSize(text, 'technical');
      const narrativeSize = calculateOptimalChunkSize(text, 'narrative');
      const referenceSize = calculateOptimalChunkSize(text, 'reference');

      // Technical: 400, Narrative: 700, Reference: 300
      expect(technicalSize).toBe(400);
      expect(narrativeSize).toBe(700);
      expect(referenceSize).toBe(300);
    });

    it('should handle medium-length text appropriately', () => {
      const text = 'x'.repeat(350);
      const size = calculateOptimalChunkSize(text, 'technical');

      // Text is 350, which is less than target (400), so returns actual length
      // capped at minSize (200) as the minimum
      expect(size).toBe(350);
    });

    it('should return target size for all content types with long text', () => {
      const longText = 'x'.repeat(2000);

      const technicalSize = calculateOptimalChunkSize(longText, 'technical');
      const narrativeSize = calculateOptimalChunkSize(longText, 'narrative');
      const referenceSize = calculateOptimalChunkSize(longText, 'reference');
      const mixedSize = calculateOptimalChunkSize(longText, 'mixed');

      expect(technicalSize).toBe(400);
      expect(narrativeSize).toBe(700);
      expect(referenceSize).toBe(300);
      expect(mixedSize).toBe(500);
    });
  });

  describe('shouldSplitChunk', () => {
    const config: ChunkingConfig = {
      minSize: 200,
      maxSize: 600,
      targetSize: 400,
      similarityThreshold: 0.8,
      preserveStructures: true,
    };

    it('should return false for chunk within size limits', () => {
      expect(shouldSplitChunk(300, config)).toBe(false);
      expect(shouldSplitChunk(400, config)).toBe(false);
      expect(shouldSplitChunk(500, config)).toBe(false);
    });

    it('should return false for chunk at max size', () => {
      expect(shouldSplitChunk(600, config)).toBe(false);
    });

    it('should return true for chunk exceeding max size', () => {
      expect(shouldSplitChunk(601, config)).toBe(true);
      expect(shouldSplitChunk(700, config)).toBe(true);
      expect(shouldSplitChunk(1000, config)).toBe(true);
    });

    it('should return false for chunk at minimum size', () => {
      expect(shouldSplitChunk(200, config)).toBe(false);
    });

    it('should return false for very small chunks', () => {
      expect(shouldSplitChunk(50, config)).toBe(false);
      expect(shouldSplitChunk(100, config)).toBe(false);
    });

    it('should work with different config values', () => {
      const smallMaxConfig: ChunkingConfig = {
        ...config,
        maxSize: 300,
      };

      expect(shouldSplitChunk(250, smallMaxConfig)).toBe(false);
      expect(shouldSplitChunk(301, smallMaxConfig)).toBe(true);
    });
  });

  describe('shouldMergeChunks', () => {
    const config: ChunkingConfig = {
      minSize: 200,
      maxSize: 600,
      targetSize: 400,
      similarityThreshold: 0.8,
      preserveStructures: true,
    };

    it('should return true for two small chunks that fit in target', () => {
      expect(shouldMergeChunks(100, 150, config)).toBe(true);
      expect(shouldMergeChunks(150, 150, config)).toBe(true);
    });

    it('should return false when first chunk is above minSize', () => {
      expect(shouldMergeChunks(250, 100, config)).toBe(false);
      expect(shouldMergeChunks(300, 50, config)).toBe(false);
    });

    it('should return false when second chunk is above minSize', () => {
      expect(shouldMergeChunks(100, 250, config)).toBe(false);
      expect(shouldMergeChunks(50, 300, config)).toBe(false);
    });

    it('should return false when combined size exceeds target', () => {
      expect(shouldMergeChunks(150, 300, config)).toBe(false);
      expect(shouldMergeChunks(200, 250, config)).toBe(false);
    });

    it('should return true when both chunks are at minSize boundary', () => {
      expect(shouldMergeChunks(199, 199, config)).toBe(true);
    });

    it('should return false when combined size equals target + 1', () => {
      expect(shouldMergeChunks(199, 202, config)).toBe(false);
    });

    it('should work with edge case: very small chunks', () => {
      expect(shouldMergeChunks(10, 10, config)).toBe(true);
      expect(shouldMergeChunks(50, 50, config)).toBe(true);
    });

    it('should work with different config values', () => {
      const smallTargetConfig: ChunkingConfig = {
        minSize: 100,
        maxSize: 300,
        targetSize: 200,
        similarityThreshold: 0.8,
        preserveStructures: true,
      };

      expect(shouldMergeChunks(80, 80, smallTargetConfig)).toBe(true);
      expect(shouldMergeChunks(80, 130, smallTargetConfig)).toBe(false);
    });
  });

  describe('Integration: Content Type Scenarios', () => {
    it('should provide appropriate config for code documentation', () => {
      const config = getAdaptiveChunkConfig('technical');

      // Technical content needs smaller chunks to preserve code context
      expect(config.targetSize).toBeLessThan(500);
      expect(config.similarityThreshold).toBeLessThan(0.85);
    });

    it('should provide appropriate config for tutorial narratives', () => {
      const config = getAdaptiveChunkConfig('narrative');

      // Narrative content benefits from larger chunks to maintain flow
      expect(config.targetSize).toBeGreaterThan(600);
      expect(config.minSize).toBeGreaterThan(300);
    });

    it('should provide appropriate config for API reference lists', () => {
      const config = getAdaptiveChunkConfig('reference');

      // Reference content needs to keep lists/tables together
      expect(config.similarityThreshold).toBeGreaterThan(0.85);
      expect(config.maxSize).toBeLessThan(600);
    });

    it('should balance config for mixed content', () => {
      const config = getAdaptiveChunkConfig('mixed');
      const technicalConfig = getAdaptiveChunkConfig('technical');
      const narrativeConfig = getAdaptiveChunkConfig('narrative');

      // Mixed config should be between technical and narrative
      expect(config.targetSize).toBeGreaterThan(technicalConfig.targetSize!);
      expect(config.targetSize).toBeLessThan(narrativeConfig.targetSize!);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-length text', () => {
      const size = calculateOptimalChunkSize('', 'technical');
      expect(size).toBeGreaterThan(0);
    });

    it('should handle exact target size text', () => {
      const text = 'x'.repeat(400);
      const size = calculateOptimalChunkSize(text, 'technical');
      expect(size).toBe(400);
    });

    it('should handle chunks at boundary conditions', () => {
      const config: ChunkingConfig = {
        minSize: 200,
        maxSize: 600,
        targetSize: 400,
        similarityThreshold: 0.8,
        preserveStructures: true,
      };

      // At maxSize boundary
      expect(shouldSplitChunk(600, config)).toBe(false);
      expect(shouldSplitChunk(601, config)).toBe(true);

      // At target boundary for merging
      // Both chunks must be < minSize (200) to merge
      expect(shouldMergeChunks(199, 199, config)).toBe(true);
      expect(shouldMergeChunks(199, 200, config)).toBe(false); // Second chunk at minSize
      expect(shouldMergeChunks(199, 201, config)).toBe(false); // Second chunk above minSize
    });
  });
});
