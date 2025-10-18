/**
 * Cost Analysis and Projection Service
 *
 * Provides detailed cost analysis, forecasting, and optimization recommendations
 * for storage costs across Supabase and Cloudflare R2.
 */

import { createClient } from '@/lib/supabase/admin';
import { getStorageMetrics, getStorageTrends, type StorageMetrics } from './storage-metrics';
import type { StorageTier, StorageProvider } from '@/lib/types/database';

/**
 * Storage cost rates (per GB per month)
 */
export const COST_RATES = {
  supabase: 0.021, // $0.021/GB/month
  r2: {
    hot: 0.015, // $0.015/GB/month
    warm: 0.01, // $0.01/GB/month
    cold: 0.004, // $0.004/GB/month
    glacier: 0.001, // $0.001/GB/month
  },
} as const;

/**
 * Retrieval cost rates (per GB)
 */
export const RETRIEVAL_RATES = {
  supabase: 0.09, // $0.09/GB egress
  r2: {
    hot: 0, // Free
    warm: 0.01, // $0.01/GB
    cold: 0.02, // $0.02/GB
    glacier: 0.05, // $0.05/GB
  },
} as const;

/**
 * Detailed cost breakdown
 */
export interface CostBreakdown {
  orgId: string;
  orgName: string;
  timestamp: string;

  // Current monthly costs
  currentMonthly: {
    total: number;
    supabase: number;
    r2: {
      hot: number;
      warm: number;
      cold: number;
      glacier: number;
      total: number;
    };
    breakdown: {
      storage: number;
      estimatedRetrieval: number; // Based on typical access patterns
    };
  };

  // Annual projection
  annualProjection: {
    total: number;
    withCurrentGrowth: number;
    withOptimization: number;
    potentialSavings: number;
  };

  // Cost per file/GB metrics
  metrics: {
    costPerFile: number;
    costPerGB: number;
    effectiveRate: number; // Actual cost per GB considering all tiers
  };

  // Optimization opportunities
  optimization: {
    potentialMonthlySavings: number;
    potentialAnnualSavings: number;
    recommendations: CostOptimizationRecommendation[];
  };
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimizationRecommendation {
  type:
    | 'tier_migration'
    | 'deduplication'
    | 'compression'
    | 'provider_switch'
    | 'lifecycle_policy';
  priority: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSavings: number; // Monthly savings in dollars
  estimatedAnnualSavings: number;
  complexity: 'easy' | 'moderate' | 'complex';
  effort: string; // Time estimate
  steps: string[];
}

/**
 * Cost forecast for future periods
 */
export interface CostForecast {
  orgId: string;
  period: '30d' | '90d' | '180d' | '365d';
  forecasts: {
    date: string;
    estimatedCost: number;
    estimatedStorageGB: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  summary: {
    currentCost: number;
    projectedCost: number;
    growthRate: number; // Percentage
    totalIncrease: number;
  };
}

/**
 * What-if scenario analysis
 */
export interface WhatIfScenario {
  name: string;
  description: string;
  assumptions: {
    monthlyGrowthRate?: number; // Percentage
    deduplicationRate?: number; // Percentage
    compressionRatio?: number; // Percentage
    tierDistribution?: Partial<Record<StorageTier, number>>; // Percentage per tier
  };
  results: {
    currentMonthly: number;
    projectedMonthly: number;
    projectedAnnual: number;
    savings: number;
    savingsPercentage: number;
  };
}

/**
 * Calculate detailed cost breakdown for an organization
 */
export async function calculateCostBreakdown(orgId: string): Promise<CostBreakdown> {
  const metrics = await getStorageMetrics(orgId);

  // Calculate current monthly costs
  const supabaseCost = calculateProviderCost(metrics, 'supabase');
  const r2Costs = {
    hot: calculateTierCost(metrics, 'r2', 'hot'),
    warm: calculateTierCost(metrics, 'r2', 'warm'),
    cold: calculateTierCost(metrics, 'r2', 'cold'),
    glacier: calculateTierCost(metrics, 'r2', 'glacier'),
    total: 0,
  };
  r2Costs.total = r2Costs.hot + r2Costs.warm + r2Costs.cold + r2Costs.glacier;

  const totalStorage = supabaseCost + r2Costs.total;

  // Estimate retrieval costs (assume 10% of hot tier data accessed monthly)
  const estimatedRetrieval =
    (metrics.tierBreakdown.find((t) => t.tier === 'hot')?.storageGB || 0) *
    0.1 *
    RETRIEVAL_RATES.supabase;

  const currentMonthlyTotal = totalStorage + estimatedRetrieval;

  // Annual projection
  const trends = await getStorageTrends(orgId, 90);
  const growthRate = calculateGrowthRate(trends);
  const annualWithGrowth = currentMonthlyTotal * 12 * (1 + growthRate / 100);

  // Calculate potential savings from optimization
  const optimizationRecommendations = await generateOptimizationRecommendations(metrics);
  const potentialMonthlySavings = optimizationRecommendations.reduce(
    (sum, rec) => sum + rec.estimatedSavings,
    0
  );
  const annualWithOptimization = (currentMonthlyTotal - potentialMonthlySavings) * 12;

  // Cost per file/GB metrics
  const costPerFile = metrics.totalFiles > 0 ? currentMonthlyTotal / metrics.totalFiles : 0;
  const costPerGB = metrics.totalStorageGB > 0 ? currentMonthlyTotal / metrics.totalStorageGB : 0;
  const effectiveRate =
    metrics.totalStorageGB > 0 ? totalStorage / metrics.totalStorageGB : COST_RATES.supabase;

  return {
    orgId: metrics.orgId,
    orgName: metrics.orgName,
    timestamp: new Date().toISOString(),
    currentMonthly: {
      total: currentMonthlyTotal,
      supabase: supabaseCost,
      r2: r2Costs,
      breakdown: {
        storage: totalStorage,
        estimatedRetrieval,
      },
    },
    annualProjection: {
      total: currentMonthlyTotal * 12,
      withCurrentGrowth: annualWithGrowth,
      withOptimization: annualWithOptimization,
      potentialSavings: annualWithGrowth - annualWithOptimization,
    },
    metrics: {
      costPerFile,
      costPerGB,
      effectiveRate,
    },
    optimization: {
      potentialMonthlySavings,
      potentialAnnualSavings: potentialMonthlySavings * 12,
      recommendations: optimizationRecommendations,
    },
  };
}

/**
 * Generate cost forecast for specified period
 */
export async function generateCostForecast(
  orgId: string,
  period: '30d' | '90d' | '180d' | '365d' = '90d'
): Promise<CostForecast> {
  const metrics = await getStorageMetrics(orgId);
  const trends = await getStorageTrends(orgId, 90);

  const currentCost =
    calculateProviderCost(metrics, 'supabase') +
    calculateTierCost(metrics, 'r2', 'hot') +
    calculateTierCost(metrics, 'r2', 'warm') +
    calculateTierCost(metrics, 'r2', 'cold') +
    calculateTierCost(metrics, 'r2', 'glacier');

  // Calculate average growth rate
  const growthRate = calculateGrowthRate(trends);

  // Generate forecasts
  const days = period === '30d' ? 30 : period === '90d' ? 90 : period === '180d' ? 180 : 365;
  const forecasts = [];

  for (let i = 1; i <= Math.min(days / 30, 12); i++) {
    const monthsAhead = i;
    const projectedGrowth = Math.pow(1 + growthRate / 100, monthsAhead);
    const estimatedStorageGB = metrics.totalStorageGB * projectedGrowth;
    const estimatedCost = currentCost * projectedGrowth;

    // Confidence decreases over time
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (monthsAhead > 3) confidence = 'medium';
    if (monthsAhead > 6) confidence = 'low';

    forecasts.push({
      date: new Date(Date.now() + monthsAhead * 30 * 24 * 60 * 60 * 1000).toISOString(),
      estimatedCost,
      estimatedStorageGB,
      confidence,
    });
  }

  const projectedCost = forecasts[forecasts.length - 1]?.estimatedCost || currentCost;

  return {
    orgId,
    period,
    forecasts,
    summary: {
      currentCost,
      projectedCost,
      growthRate,
      totalIncrease: projectedCost - currentCost,
    },
  };
}

/**
 * Run what-if scenario analysis
 */
export async function runWhatIfScenario(
  orgId: string,
  scenario: WhatIfScenario['assumptions']
): Promise<WhatIfScenario> {
  const metrics = await getStorageMetrics(orgId);
  const currentCost =
    calculateProviderCost(metrics, 'supabase') +
    calculateTierCost(metrics, 'r2', 'hot') +
    calculateTierCost(metrics, 'r2', 'warm') +
    calculateTierCost(metrics, 'r2', 'cold') +
    calculateTierCost(metrics, 'r2', 'glacier');

  let projectedStorage = metrics.totalStorageGB;

  // Apply growth rate
  if (scenario.monthlyGrowthRate) {
    projectedStorage *= 1 + scenario.monthlyGrowthRate / 100;
  }

  // Apply deduplication
  if (scenario.deduplicationRate) {
    projectedStorage *= 1 - scenario.deduplicationRate / 100;
  }

  // Apply compression
  if (scenario.compressionRatio) {
    projectedStorage *= 1 - scenario.compressionRatio / 100;
  }

  // Calculate projected cost based on tier distribution
  let projectedCost = 0;
  if (scenario.tierDistribution) {
    const distribution = scenario.tierDistribution;
    projectedCost +=
      (projectedStorage * (distribution.hot || 0)) / 100 * (COST_RATES.r2.hot || 0);
    projectedCost +=
      (projectedStorage * (distribution.warm || 0)) / 100 * (COST_RATES.r2.warm || 0);
    projectedCost +=
      (projectedStorage * (distribution.cold || 0)) / 100 * (COST_RATES.r2.cold || 0);
    projectedCost +=
      (projectedStorage * (distribution.glacier || 0)) / 100 * (COST_RATES.r2.glacier || 0);
  } else {
    // Use current rate
    projectedCost = projectedStorage * (currentCost / metrics.totalStorageGB);
  }

  const savings = currentCost - projectedCost;
  const savingsPercentage = currentCost > 0 ? (savings / currentCost) * 100 : 0;

  return {
    name: 'Custom Scenario',
    description: generateScenarioDescription(scenario),
    assumptions: scenario,
    results: {
      currentMonthly: currentCost,
      projectedMonthly: projectedCost,
      projectedAnnual: projectedCost * 12,
      savings,
      savingsPercentage,
    },
  };
}

/**
 * Generate optimization recommendations
 */
async function generateOptimizationRecommendations(
  metrics: StorageMetrics
): Promise<CostOptimizationRecommendation[]> {
  const recommendations: CostOptimizationRecommendation[] = [];

  // Check for tier migration opportunities
  const hotTierPercentage =
    metrics.tierBreakdown.find((t) => t.tier === 'hot')?.percentage || 0;
  if (hotTierPercentage > 50) {
    const hotTierGB = metrics.tierBreakdown.find((t) => t.tier === 'hot')?.storageGB || 0;
    const potentialMigrationGB = hotTierGB * 0.5; // Migrate 50% to warm
    const currentCost = potentialMigrationGB * COST_RATES.r2.hot;
    const newCost = potentialMigrationGB * COST_RATES.r2.warm;
    const savings = currentCost - newCost;

    recommendations.push({
      type: 'tier_migration',
      priority: 'high',
      impact: 'high',
      title: 'Migrate older files to warm tier',
      description: `${hotTierPercentage.toFixed(1)}% of your storage is in the hot tier. Consider migrating files older than 30 days to warm tier.`,
      estimatedSavings: savings,
      estimatedAnnualSavings: savings * 12,
      complexity: 'easy',
      effort: '1-2 hours',
      steps: [
        'Review files in hot tier older than 30 days',
        'Create lifecycle policy to auto-migrate to warm tier',
        'Monitor access patterns after migration',
        'Adjust policy based on usage data',
      ],
    });
  }

  // Check for deduplication opportunities
  if (metrics.optimization.deduplicationRatio < 20) {
    const potentialDuplicates = metrics.totalStorageGB * 0.15; // Assume 15% duplicates
    const savings = potentialDuplicates * COST_RATES.r2.hot;

    recommendations.push({
      type: 'deduplication',
      priority: 'high',
      impact: 'medium',
      title: 'Run deduplication analysis',
      description: `Only ${metrics.optimization.deduplicationRatio.toFixed(1)}% of files have been checked for duplicates. Running deduplication could save significant storage.`,
      estimatedSavings: savings,
      estimatedAnnualSavings: savings * 12,
      complexity: 'easy',
      effort: '30 minutes',
      steps: [
        'Run batch deduplication job',
        'Review duplicate files found',
        'Enable automatic deduplication for new uploads',
        'Schedule monthly deduplication scans',
      ],
    });
  }

  // Check for compression opportunities
  if (metrics.optimization.compressionRatio < 30) {
    const uncompressedGB = metrics.totalStorageGB * 0.7; // Assume 70% can be compressed
    const potentialSavingsGB = uncompressedGB * 0.3; // 30% compression
    const savings = potentialSavingsGB * COST_RATES.r2.hot;

    recommendations.push({
      type: 'compression',
      priority: 'medium',
      impact: 'medium',
      title: 'Enable video compression',
      description: `Compression ratio is only ${metrics.optimization.compressionRatio.toFixed(1)}%. Enable progressive compression to reduce storage costs.`,
      estimatedSavings: savings,
      estimatedAnnualSavings: savings * 12,
      complexity: 'moderate',
      effort: '2-3 hours',
      steps: [
        'Enable compression for new uploads',
        'Run batch compression on existing files',
        'Monitor quality vs size tradeoffs',
        'Adjust compression settings as needed',
      ],
    });
  }

  // Check for provider switch opportunities
  const supabasePercentage =
    metrics.providerBreakdown.find((p) => p.provider === 'supabase')?.percentage || 0;
  if (supabasePercentage > 50) {
    const supabaseGB =
      metrics.providerBreakdown.find((p) => p.provider === 'supabase')?.storageGB || 0;
    const currentCost = supabaseGB * COST_RATES.supabase;
    const r2Cost = supabaseGB * COST_RATES.r2.warm;
    const savings = currentCost - r2Cost;

    if (savings > 10) {
      // Only recommend if savings > $10/month
      recommendations.push({
        type: 'provider_switch',
        priority: 'medium',
        impact: 'high',
        title: 'Migrate storage to Cloudflare R2',
        description: `${supabasePercentage.toFixed(1)}% of storage is on Supabase. Migrating to R2 could reduce storage costs by ${((savings / currentCost) * 100).toFixed(1)}%.`,
        estimatedSavings: savings,
        estimatedAnnualSavings: savings * 12,
        complexity: 'complex',
        effort: '1-2 weeks',
        steps: [
          'Set up Cloudflare R2 bucket and credentials',
          'Create migration script to copy files',
          'Run migration in batches to avoid downtime',
          'Update application to use R2 for new uploads',
          'Verify all files accessible after migration',
          'Delete Supabase storage after verification period',
        ],
      });
    }
  }

  // Sort by estimated annual savings (descending)
  return recommendations.sort((a, b) => b.estimatedAnnualSavings - a.estimatedAnnualSavings);
}

/**
 * Helper: Calculate provider-specific costs
 */
function calculateProviderCost(metrics: StorageMetrics, provider: StorageProvider): number {
  const providerData = metrics.providerBreakdown.find((p) => p.provider === provider);
  if (!providerData) return 0;

  if (provider === 'supabase') {
    return providerData.storageGB * COST_RATES.supabase;
  }

  return 0; // R2 costs calculated per-tier
}

/**
 * Helper: Calculate tier-specific costs
 */
function calculateTierCost(
  metrics: StorageMetrics,
  provider: StorageProvider,
  tier: StorageTier
): number {
  const tierData = metrics.tierBreakdown.find((t) => t.tier === tier);
  if (!tierData) return 0;

  // Only R2 has tiered pricing
  if (provider !== 'r2') return 0;

  const rate = COST_RATES.r2[tier];
  return tierData.storageGB * rate;
}

/**
 * Helper: Calculate growth rate from trends
 */
function calculateGrowthRate(
  trends: { date: string; totalStorageGB: number; netGrowthGB: number }[]
): number {
  if (trends.length < 2) return 0;

  // Calculate average monthly growth
  const growthRates = trends.slice(1).map((t, i) => {
    const previous = trends[i].totalStorageGB;
    if (previous === 0) return 0;
    return ((t.totalStorageGB - previous) / previous) * 100;
  });

  const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
  return avgGrowth;
}

/**
 * Helper: Generate scenario description
 */
function generateScenarioDescription(scenario: WhatIfScenario['assumptions']): string {
  const parts: string[] = [];

  if (scenario.monthlyGrowthRate) {
    parts.push(`${scenario.monthlyGrowthRate}% monthly growth`);
  }
  if (scenario.deduplicationRate) {
    parts.push(`${scenario.deduplicationRate}% deduplication`);
  }
  if (scenario.compressionRatio) {
    parts.push(`${scenario.compressionRatio}% compression`);
  }
  if (scenario.tierDistribution) {
    parts.push('custom tier distribution');
  }

  return parts.length > 0 ? parts.join(', ') : 'Baseline scenario';
}

/**
 * Generate comparison report between current state and optimized state
 */
export async function generateComparisonReport(orgId: string): Promise<{
  current: CostBreakdown;
  optimized: WhatIfScenario;
  savingsBreakdown: {
    tierMigration: number;
    deduplication: number;
    compression: number;
    total: number;
  };
  implementationPlan: {
    phase: string;
    actions: string[];
    estimatedSavings: number;
    timeframe: string;
  }[];
}> {
  const current = await calculateCostBreakdown(orgId);

  // Calculate optimized scenario
  const optimized = await runWhatIfScenario(orgId, {
    deduplicationRate: 30,
    compressionRatio: 25,
    tierDistribution: {
      hot: 20,
      warm: 50,
      cold: 25,
      glacier: 5,
    },
  });

  // Break down savings by optimization type
  const tierMigrationSavings =
    current.optimization.recommendations.find((r) => r.type === 'tier_migration')
      ?.estimatedSavings || 0;
  const deduplicationSavings =
    current.optimization.recommendations.find((r) => r.type === 'deduplication')
      ?.estimatedSavings || 0;
  const compressionSavings =
    current.optimization.recommendations.find((r) => r.type === 'compression')
      ?.estimatedSavings || 0;

  return {
    current,
    optimized,
    savingsBreakdown: {
      tierMigration: tierMigrationSavings,
      deduplication: deduplicationSavings,
      compression: compressionSavings,
      total: tierMigrationSavings + deduplicationSavings + compressionSavings,
    },
    implementationPlan: [
      {
        phase: 'Phase 1: Quick Wins (Week 1)',
        actions: [
          'Enable deduplication for new uploads',
          'Run batch deduplication on existing files',
          'Configure lifecycle policies for tier migration',
        ],
        estimatedSavings: deduplicationSavings,
        timeframe: '1 week',
      },
      {
        phase: 'Phase 2: Compression (Week 2-3)',
        actions: [
          'Enable progressive compression',
          'Compress existing uncompressed files',
          'Monitor quality metrics',
        ],
        estimatedSavings: compressionSavings,
        timeframe: '2 weeks',
      },
      {
        phase: 'Phase 3: Tier Optimization (Week 4-6)',
        actions: [
          'Analyze access patterns by file age',
          'Migrate eligible files to cheaper tiers',
          'Set up automated tier transitions',
        ],
        estimatedSavings: tierMigrationSavings,
        timeframe: '3 weeks',
      },
    ],
  };
}
