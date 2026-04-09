/**
 * Tests for A/B Testing Framework
 *
 * Tests variant assignment, distribution fairness, config correctness, and sample size calculations.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  assignVariant,
  getExperimentConfig,
  getAllVariants,
  getVariantDistribution,
  isVariantEnabled,
  logExperimentResult,
  calculateSampleSize,
  type SearchVariant,
} from '../ab-testing';

describe('A/B Testing Framework', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set default environment
    delete process.env.ENABLED_SEARCH_VARIANTS;
  });

  afterEach(() => {
    delete process.env.ENABLED_SEARCH_VARIANTS;
  });

  describe('Variant Assignment', () => {
    it('should assign variants consistently based on org ID', () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const orgId = 'org-123';

      // Same org = same variant, regardless of user
      const variant1 = assignVariant(userId1, orgId);
      const variant2 = assignVariant(userId2, orgId);

      expect(variant1).toBe(variant2);
    });

    it('should assign same variant for repeat calls with same org', () => {
      const userId = 'user-1';
      const orgId = 'org-123';

      const variant1 = assignVariant(userId, orgId);
      const variant2 = assignVariant(userId, orgId);
      const variant3 = assignVariant(userId, orgId);

      expect(variant1).toBe(variant2);
      expect(variant2).toBe(variant3);
    });

    it('should distribute variants evenly across orgs', () => {
      const variants: Record<string, number> = {
        control: 0,
        adaptive_threshold: 0,
        hybrid_first: 0,
        aggressive_recall: 0,
      };

      // Test with 1000 different orgs
      for (let i = 0; i < 1000; i++) {
        const orgId = `org-${i}`;
        const variant = assignVariant('user-1', orgId);
        variants[variant]++;
      }

      // Verify roughly equal distribution (25% each with 10% tolerance)
      // Expected: 250 per variant, tolerance: ±25
      expect(variants.control).toBeGreaterThan(225);
      expect(variants.control).toBeLessThan(275);

      expect(variants.adaptive_threshold).toBeGreaterThan(225);
      expect(variants.adaptive_threshold).toBeLessThan(275);

      expect(variants.hybrid_first).toBeGreaterThan(225);
      expect(variants.hybrid_first).toBeLessThan(275);

      expect(variants.aggressive_recall).toBeGreaterThan(225);
      expect(variants.aggressive_recall).toBeLessThan(275);
    });

    it('should return one of the four valid variants', () => {
      const validVariants: SearchVariant[] = [
        'control',
        'adaptive_threshold',
        'hybrid_first',
        'aggressive_recall',
      ];

      // Test with multiple orgs
      for (let i = 0; i < 100; i++) {
        const variant = assignVariant('user-1', `org-${i}`);
        expect(validVariants).toContain(variant);
      }
    });

    it('should handle edge case org IDs', () => {
      const edgeCases = [
        '',
        'a',
        '123',
        'org-with-very-long-name-that-has-many-characters',
        'org with spaces',
        'org-with-special-chars-!@#$%',
      ];

      edgeCases.forEach(orgId => {
        expect(() => assignVariant('user-1', orgId)).not.toThrow();
        const variant = assignVariant('user-1', orgId);
        expect(variant).toBeDefined();
      });
    });
  });

  describe('Experiment Configuration', () => {
    it('should return correct config for control variant', () => {
      const config = getExperimentConfig('control');

      expect(config).toEqual({
        variant: 'control',
        threshold: 0.7,
        useHybrid: false,
        useAgentic: false,
        maxChunks: 10,
        description: expect.stringContaining('Control group'),
      });
    });

    it('should return correct config for adaptive_threshold variant', () => {
      const config = getExperimentConfig('adaptive_threshold');

      expect(config).toEqual({
        variant: 'adaptive_threshold',
        threshold: 0.5,
        useHybrid: false,
        useAgentic: false,
        maxChunks: 12,
        description: expect.stringContaining('Adaptive thresholds'),
      });
    });

    it('should return correct config for hybrid_first variant', () => {
      const config = getExperimentConfig('hybrid_first');

      expect(config).toEqual({
        variant: 'hybrid_first',
        threshold: 0.5,
        useHybrid: true, // Key difference
        useAgentic: false,
        maxChunks: 12,
        description: expect.stringContaining('Hybrid search first'),
      });
    });

    it('should return correct config for aggressive_recall variant', () => {
      const config = getExperimentConfig('aggressive_recall');

      expect(config).toEqual({
        variant: 'aggressive_recall',
        threshold: 0.4, // Lowest threshold
        useHybrid: true,
        useAgentic: false,
        maxChunks: 15, // Most chunks
        description: expect.stringContaining('Aggressive recall'),
      });
    });

    it('should have different thresholds for each variant', () => {
      const control = getExperimentConfig('control');
      const adaptive = getExperimentConfig('adaptive_threshold');
      const hybrid = getExperimentConfig('hybrid_first');
      const aggressive = getExperimentConfig('aggressive_recall');

      // Verify threshold progression: control (0.7) > adaptive/hybrid (0.5) > aggressive (0.4)
      expect(control.threshold).toBeGreaterThan(adaptive.threshold);
      expect(adaptive.threshold).toBeGreaterThan(aggressive.threshold);
      expect(hybrid.threshold).toBe(adaptive.threshold); // Same as adaptive
    });

    it('should enable hybrid search only for hybrid_first and aggressive_recall', () => {
      const control = getExperimentConfig('control');
      const adaptive = getExperimentConfig('adaptive_threshold');
      const hybrid = getExperimentConfig('hybrid_first');
      const aggressive = getExperimentConfig('aggressive_recall');

      expect(control.useHybrid).toBe(false);
      expect(adaptive.useHybrid).toBe(false);
      expect(hybrid.useHybrid).toBe(true);
      expect(aggressive.useHybrid).toBe(true);
    });

    it('should increase maxChunks for aggressive_recall', () => {
      const control = getExperimentConfig('control');
      const aggressive = getExperimentConfig('aggressive_recall');

      expect(aggressive.maxChunks).toBeGreaterThan(control.maxChunks);
    });
  });

  describe('Experiment Logging', () => {
    it('should log experiment results with all required fields', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await logExperimentResult(
        'adaptive_threshold',
        'test query',
        'org-123',
        'user-456',
        {
          sourcesFound: 5,
          retrievalAttempts: 2,
          avgSimilarity: 0.75,
          timeMs: 250,
        }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[A/B Test] Experiment result:',
        expect.objectContaining({
          variant: 'adaptive_threshold',
          query: 'test query',
          orgId: expect.stringContaining('org'),
          userId: expect.stringContaining('user'),
          sourcesFound: 5,
          retrievalAttempts: 2,
          avgSimilarity: '0.750',
          timeMs: 250,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should truncate long queries in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const longQuery = 'a'.repeat(100);

      await logExperimentResult(
        'control',
        longQuery,
        'org-123',
        'user-456',
        {
          sourcesFound: 3,
          retrievalAttempts: 1,
          avgSimilarity: 0.8,
          timeMs: 150,
        }
      );

      // Verify query was truncated to 50 chars
      expect(consoleSpy).toHaveBeenCalledWith(
        '[A/B Test] Experiment result:',
        expect.objectContaining({
          query: expect.stringMatching(/^a{50}$/),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should redact sensitive org/user IDs in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const fullOrgId = 'org-123-456-789-abc-def';
      const fullUserId = 'user-987-654-321-xyz-uvw';

      await logExperimentResult(
        'control',
        'test query',
        fullOrgId,
        fullUserId,
        {
          sourcesFound: 2,
          retrievalAttempts: 1,
          avgSimilarity: 0.7,
          timeMs: 200,
        }
      );

      // Verify IDs were truncated to first 8 chars
      expect(consoleSpy).toHaveBeenCalledWith(
        '[A/B Test] Experiment result:',
        expect.objectContaining({
          orgId: fullOrgId.substring(0, 8),
          userId: fullUserId.substring(0, 8),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Variant Management', () => {
    it('should return all variant names', () => {
      const variants = getAllVariants();

      expect(variants).toEqual([
        'control',
        'adaptive_threshold',
        'hybrid_first',
        'aggressive_recall',
      ]);
    });

    it('should return correct variant distribution', () => {
      const distribution = getVariantDistribution();

      expect(distribution).toEqual({
        control: 0.25,
        adaptive_threshold: 0.25,
        hybrid_first: 0.25,
        aggressive_recall: 0.25,
      });
    });

    it('should enable all variants by default', () => {
      expect(isVariantEnabled('control')).toBe(true);
      expect(isVariantEnabled('adaptive_threshold')).toBe(true);
      expect(isVariantEnabled('hybrid_first')).toBe(true);
      expect(isVariantEnabled('aggressive_recall')).toBe(true);
    });

    it('should respect ENABLED_SEARCH_VARIANTS environment variable', () => {
      // Enable only control and adaptive_threshold
      process.env.ENABLED_SEARCH_VARIANTS = 'control,adaptive_threshold';

      expect(isVariantEnabled('control')).toBe(true);
      expect(isVariantEnabled('adaptive_threshold')).toBe(true);
      expect(isVariantEnabled('hybrid_first')).toBe(false);
      expect(isVariantEnabled('aggressive_recall')).toBe(false);
    });

    it('should handle single variant in environment', () => {
      process.env.ENABLED_SEARCH_VARIANTS = 'control';

      expect(isVariantEnabled('control')).toBe(true);
      expect(isVariantEnabled('adaptive_threshold')).toBe(false);
      expect(isVariantEnabled('hybrid_first')).toBe(false);
      expect(isVariantEnabled('aggressive_recall')).toBe(false);
    });

    it('should handle empty ENABLED_SEARCH_VARIANTS gracefully', () => {
      process.env.ENABLED_SEARCH_VARIANTS = '';

      // Should default to all enabled
      expect(isVariantEnabled('control')).toBe(true);
      expect(isVariantEnabled('adaptive_threshold')).toBe(true);
    });
  });

  describe('Sample Size Calculation', () => {
    it('should calculate correct sample size for common scenarios', () => {
      // Scenario: Detect 10% improvement from 70% baseline
      const n = calculateSampleSize(0.7, 0.1);

      // Expected: ~194 per variant
      expect(n).toBeGreaterThan(150);
      expect(n).toBeLessThan(250);
    });

    it('should calculate correct sample size for small improvements', () => {
      // Scenario: Detect 5% improvement from 70% baseline
      const n = calculateSampleSize(0.7, 0.05);

      // Expected: ~783 per variant (larger sample needed for smaller effect)
      expect(n).toBeGreaterThan(700);
      expect(n).toBeLessThan(900);
    });

    it('should require fewer samples for large effect sizes', () => {
      const smallEffect = calculateSampleSize(0.7, 0.05);
      const largeEffect = calculateSampleSize(0.7, 0.15);

      expect(largeEffect).toBeLessThan(smallEffect);
    });

    it('should handle custom confidence and power levels', () => {
      // Standard (95% confidence, 80% power)
      const standard = calculateSampleSize(0.7, 0.1);

      // Higher power (95% confidence, 90% power) - needs more samples
      const higherPower = calculateSampleSize(0.7, 0.1, 0.05, 0.9);

      expect(higherPower).toBeGreaterThan(standard);
    });

    it('should return integer sample sizes', () => {
      const n = calculateSampleSize(0.7, 0.1);

      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    });

    it('should handle edge case baselines', () => {
      // Very low baseline (10%)
      const lowBaseline = calculateSampleSize(0.1, 0.05);
      expect(lowBaseline).toBeGreaterThan(0);

      // High baseline (90%)
      const highBaseline = calculateSampleSize(0.9, 0.05);
      expect(highBaseline).toBeGreaterThan(0);

      // Medium baseline (50%)
      const mediumBaseline = calculateSampleSize(0.5, 0.05);
      expect(mediumBaseline).toBeGreaterThan(0);
    });

    it('should calculate realistic sample size for current experiment', () => {
      // Real scenario: baseline 70%, want to detect 10% improvement
      const n = calculateSampleSize(0.7, 0.1, 0.05, 0.8);

      // This tells us how many searches per variant we need
      console.log(`Sample size needed per variant: ${n}`);

      // With 4 variants, total needed: n * 4
      const totalNeeded = n * 4;
      console.log(`Total searches needed for experiment: ${totalNeeded}`);

      // Verify it's reasonable (not too small, not too large)
      expect(n).toBeGreaterThan(100); // At least 100 per variant
      expect(n).toBeLessThan(1000); // But not more than 1000
    });
  });

  describe('Hash Function Consistency', () => {
    it('should produce consistent hash for same input', () => {
      // Test hash consistency by checking variant assignment
      const orgId = 'test-org-123';

      const hash1 = assignVariant('user-1', orgId);
      const hash2 = assignVariant('user-2', orgId);
      const hash3 = assignVariant('user-3', orgId);

      // Same org should always get same variant
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce different distributions for different org IDs', () => {
      const org1Variant = assignVariant('user', 'org-1');
      const org2Variant = assignVariant('user', 'org-2');
      const org3Variant = assignVariant('user', 'org-3');

      // Not all should be the same (with high probability)
      const uniqueVariants = new Set([org1Variant, org2Variant, org3Variant]);
      // Expect at least 2 different variants out of 3 orgs
      expect(uniqueVariants.size).toBeGreaterThanOrEqual(2);
    });

    it('should handle Unicode characters in org IDs', () => {
      const unicodeOrgIds = [
        'org-测试',
        'org-тест',
        'org-🎉',
        'org-café',
      ];

      unicodeOrgIds.forEach(orgId => {
        expect(() => assignVariant('user-1', orgId)).not.toThrow();
        const variant = assignVariant('user-1', orgId);
        expect(variant).toBeDefined();
      });
    });
  });

  describe('Integration with Search Config', () => {
    it('should provide different search behaviors for each variant', () => {
      const variants = getAllVariants();
      const configs = variants.map(v => getExperimentConfig(v));

      // Verify each variant has a unique configuration
      const configStrings = configs.map(c => JSON.stringify({
        threshold: c.threshold,
        useHybrid: c.useHybrid,
        maxChunks: c.maxChunks,
      }));

      const uniqueConfigs = new Set(configStrings);
      expect(uniqueConfigs.size).toBe(variants.length);
    });

    it('should enable progressively more aggressive recall strategies', () => {
      const control = getExperimentConfig('control');
      const adaptive = getExperimentConfig('adaptive_threshold');
      const hybrid = getExperimentConfig('hybrid_first');
      const aggressive = getExperimentConfig('aggressive_recall');

      // Control is most conservative
      expect(control.threshold).toBeGreaterThan(adaptive.threshold);
      expect(control.useHybrid).toBe(false);
      expect(control.maxChunks).toBeLessThan(aggressive.maxChunks);

      // Aggressive is most liberal
      expect(aggressive.threshold).toBeLessThan(control.threshold);
      expect(aggressive.useHybrid).toBe(true);
      expect(aggressive.maxChunks).toBeGreaterThan(control.maxChunks);
    });

    it('should provide clear descriptions for each variant', () => {
      const variants = getAllVariants();

      variants.forEach(variant => {
        const config = getExperimentConfig(variant);
        expect(config.description).toBeDefined();
        expect(config.description.length).toBeGreaterThan(20);
        expect(config.description).toContain(variant === 'control' ? 'Control' : variant.replace('_', ' '));
      });
    });
  });

  describe('Statistical Validity', () => {
    it('should ensure minimum detectable effect is reasonable', () => {
      // MDE of 5% is common in A/B testing
      const n = calculateSampleSize(0.7, 0.05);

      // Verify we can detect improvements with reasonable sample sizes
      expect(n).toBeLessThan(2000); // Not prohibitively large
      expect(n).toBeGreaterThan(100); // Not too small to be meaningful
    });

    it('should account for multiple comparisons (4 variants)', () => {
      // With 4 variants, we're doing 3 comparisons vs control
      // Bonferroni correction: alpha / 3 ≈ 0.0167

      const standardN = calculateSampleSize(0.7, 0.1, 0.05, 0.8);
      const correctedN = calculateSampleSize(0.7, 0.1, 0.0167, 0.8);

      // Corrected version needs more samples
      expect(correctedN).toBeGreaterThan(standardN);

      console.log(`Standard sample size: ${standardN}`);
      console.log(`Bonferroni-corrected sample size: ${correctedN}`);
    });

    it('should handle imbalanced baseline rates', () => {
      // If control has 70% success but adaptive has 80%, that's a 10% improvement
      const n70to80 = calculateSampleSize(0.7, 0.1);

      // If control has 50% success but adaptive has 60%, that's also a 10% improvement
      const n50to60 = calculateSampleSize(0.5, 0.1);

      // Sample sizes should be similar (both detecting 10% absolute improvement)
      expect(Math.abs(n70to80 - n50to60) / n70to80).toBeLessThan(0.5); // Within 50%
    });
  });
});
