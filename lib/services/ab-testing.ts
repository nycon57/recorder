/**
 * A/B Testing Framework for RAG Search
 *
 * Enables controlled experiments to compare search configurations.
 * Uses consistent hashing for stable variant assignment.
 */

export type SearchVariant =
  | 'control'
  | 'lower_threshold'
  | 'hybrid_first'
  | 'aggressive_recall';

export interface ExperimentConfig {
  variant: SearchVariant;
  threshold: number;
  useHybrid: boolean;
  useAgentic: boolean;
  maxChunks: number;
  description: string;
}

export interface ExperimentResult {
  variant: SearchVariant;
  query: string;
  orgId: string;
  userId: string;
  sourcesFound: number;
  retrievalAttempts: number;
  avgSimilarity: number;
  timeMs: number;
  timestamp: Date;
}

/**
 * Assign user/org to an experiment variant
 * Uses consistent hashing to ensure same user always gets same variant
 *
 * @param userId - User identifier
 * @param orgId - Organization identifier
 * @returns Assigned variant
 */
export function assignVariant(userId: string, orgId: string): SearchVariant {
  // Use org-level assignment for consistency across team
  const hash = hashString(`${orgId}:search_experiment_v1`);
  const bucket = hash % 100;

  // Distribution:
  // - 25% control (old behavior)
  // - 25% lower_threshold (relaxed 0.5 threshold)
  // - 25% hybrid_first (aggressive hybrid)
  // - 25% aggressive_recall (very low threshold)
  if (bucket < 25) return 'control';
  if (bucket < 50) return 'lower_threshold';
  if (bucket < 75) return 'hybrid_first';
  return 'aggressive_recall';
}

/**
 * Get experiment configuration for a variant
 *
 * @param variant - Experiment variant name
 * @returns Configuration object for the variant
 */
export function getExperimentConfig(variant: SearchVariant): ExperimentConfig {
  switch (variant) {
    case 'control':
      // Old behavior: fixed 0.7 threshold, no adaptive logic
      return {
        variant: 'control',
        threshold: 0.7,
        useHybrid: false,
        useAgentic: false,
        maxChunks: 10,
        description:
          'Control group: Fixed 0.7 threshold, vector search only, no retry logic',
      };

    case 'lower_threshold':
      // Lower fixed threshold for better recall
      return {
        variant: 'lower_threshold',
        threshold: 0.5, // Fixed lower threshold (not adaptive)
        useHybrid: false,
        useAgentic: false,
        maxChunks: 12,
        description:
          'Lower threshold: Fixed 0.5 threshold for improved recall',
      };

    case 'hybrid_first':
      // Always use hybrid search (vector + keyword)
      return {
        variant: 'hybrid_first',
        threshold: 0.5,
        useHybrid: true,
        useAgentic: false,
        maxChunks: 12,
        description:
          'Hybrid search first: Combines vector and keyword search from the start',
      };

    case 'aggressive_recall':
      // Very low threshold, maximize recall at cost of precision
      return {
        variant: 'aggressive_recall',
        threshold: 0.4,
        useHybrid: true,
        useAgentic: false,
        maxChunks: 15,
        description:
          'Aggressive recall: 0.4 threshold, hybrid search, more results',
      };
  }
}

/**
 * Log experiment assignment and results
 * In production, send to analytics service (DataDog, Mixpanel, etc.)
 *
 * @param variant - Experiment variant
 * @param query - User's search query
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param results - Search results metrics
 */
export async function logExperimentResult(
  variant: SearchVariant,
  query: string,
  orgId: string,
  userId: string,
  results: {
    sourcesFound: number;
    retrievalAttempts: number;
    avgSimilarity: number;
    timeMs: number;
  }
): Promise<void> {
  const experimentResult: ExperimentResult = {
    variant,
    query,
    orgId,
    userId,
    timestamp: new Date(),
    ...results,
  };

  console.log('[A/B Test] Experiment result:', {
    variant,
    query: query.substring(0, 50),
    orgId: orgId.substring(0, 8),
    userId: userId.substring(0, 8),
    sourcesFound: results.sourcesFound,
    retrievalAttempts: results.retrievalAttempts,
    avgSimilarity: results.avgSimilarity.toFixed(3),
    timeMs: results.timeMs,
  });

  // In production, send to analytics service
  // Example integrations:
  //
  // DataDog:
  // await datadogClient.track('search_experiment_result', experimentResult);
  //
  // Mixpanel:
  // await mixpanel.track('Search Experiment', experimentResult);
  //
  // Custom analytics:
  // await supabase.from('experiment_results').insert(experimentResult);
  //
  // For now, just log to console
}

/**
 * Get all available variants
 */
export function getAllVariants(): SearchVariant[] {
  return ['control', 'lower_threshold', 'hybrid_first', 'aggressive_recall'];
}

/**
 * Get variant distribution (for analysis)
 */
export function getVariantDistribution(): Record<SearchVariant, number> {
  return {
    control: 0.25,
    lower_threshold: 0.25,
    hybrid_first: 0.25,
    aggressive_recall: 0.25,
  };
}

/**
 * Check if variant is enabled
 * Allows feature flagging to turn off variants
 */
export function isVariantEnabled(variant: SearchVariant): boolean {
  // Check environment variables for feature flags
  const enabledVariants = process.env.ENABLED_SEARCH_VARIANTS?.split(',') || [
    'control',
    'lower_threshold',
    'hybrid_first',
    'aggressive_recall',
  ];

  return enabledVariants.includes(variant);
}

/**
 * Simple string hash function (DJB2 algorithm)
 * Produces consistent hash for same input string
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) + hash + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate experiment sample size needed for statistical significance
 *
 * @param baseline - Baseline conversion rate (e.g., 0.7 for 70% success)
 * @param mde - Minimum detectable effect (e.g., 0.05 for 5% improvement)
 * @param alpha - Significance level (default: 0.05 for 95% confidence)
 * @param power - Statistical power (default: 0.8 for 80% power)
 * @returns Required sample size per variant
 */
export function calculateSampleSize(
  baseline: number,
  mde: number,
  alpha: number = 0.05,
  power: number = 0.8
): number {
  // Simplified sample size calculation for proportion test
  // z_alpha = 1.96 for 95% confidence
  // z_beta = 0.84 for 80% power
  const z_alpha = 1.96;
  const z_beta = 0.84;

  const p1 = baseline;
  const p2 = baseline + mde;
  const p_avg = (p1 + p2) / 2;

  const numerator =
    Math.pow(z_alpha + z_beta, 2) * 2 * p_avg * (1 - p_avg);
  const denominator = Math.pow(p2 - p1, 2);

  return Math.ceil(numerator / denominator);
}

/**
 * Example usage and guidelines
 */
export const EXPERIMENT_GUIDELINES = {
  /**
   * How to run an A/B test:
   *
   * 1. Define your hypothesis:
   *    "Lower thresholds will increase search success rate by 10%"
   *
   * 2. Calculate sample size:
   *    const n = calculateSampleSize(0.7, 0.1); // ~250 per variant
   *
   * 3. Enable variants:
   *    Set ENABLED_SEARCH_VARIANTS="control,lower_threshold" in .env
   *
   * 4. Assign users to variants:
   *    const variant = assignVariant(userId, orgId);
   *    const config = getExperimentConfig(variant);
   *
   * 5. Log results:
   *    await logExperimentResult(variant, query, orgId, userId, results);
   *
   * 6. Analyze results:
   *    npm run analyze:search
   *
   * 7. Make decision:
   *    If significant improvement, roll out to 100%
   */
  exampleUsage: `
    // In your search handler:
    const variant = assignVariant(userId, orgId);
    const config = getExperimentConfig(variant);

    const results = await vectorSearch(query, {
      orgId,
      threshold: config.threshold,
      limit: config.maxChunks,
    });

    await logExperimentResult(variant, query, orgId, userId, {
      sourcesFound: results.length,
      retrievalAttempts: 1,
      avgSimilarity: calculateAvg(results),
      timeMs: Date.now() - startTime,
    });
  `,
};
