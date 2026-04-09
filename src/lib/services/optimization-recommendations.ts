/**
 * Optimization Recommendations Engine
 *
 * Provides intelligent, context-aware recommendations for storage optimization
 * based on usage patterns, historical data, and best practices.
 */

import { createClient } from '@/lib/supabase/admin';
import { getStorageMetrics, type StorageMetrics } from './storage-metrics';
import { calculateCostBreakdown, type CostOptimizationRecommendation, type CostBreakdown } from './cost-analysis';
import type { StorageTier } from '@/lib/types/database';

/**
 * Recommendation score and priority
 */
export interface RecommendationScore {
  overall: number; // 0-100
  impact: number; // 0-100
  effort: number; // 0-100 (lower is easier)
  urgency: number; // 0-100
  feasibility: number; // 0-100
}

/**
 * Enhanced recommendation with ML-based scoring
 */
export interface SmartRecommendation extends CostOptimizationRecommendation {
  score: RecommendationScore;
  confidence: number; // 0-100
  prerequisites: string[];
  risks: string[];
  kpis: {
    metric: string;
    current: number;
    target: number;
    unit: string;
  }[];
  timeline: {
    preparation: string;
    implementation: string;
    validation: string;
    total: string;
  };
  resources: {
    type: 'documentation' | 'tool' | 'guide';
    title: string;
    url?: string;
  }[];
}

/**
 * Recommendation category
 */
export type RecommendationCategory =
  | 'cost_optimization'
  | 'performance'
  | 'reliability'
  | 'security'
  | 'compliance';

/**
 * Usage pattern analysis
 */
interface UsagePattern {
  orgId: string;
  patterns: {
    uploadFrequency: 'high' | 'medium' | 'low';
    accessFrequency: 'high' | 'medium' | 'low';
    retentionNeeds: 'short' | 'medium' | 'long';
    growthTrend: 'increasing' | 'stable' | 'decreasing';
    seasonality: boolean;
    peakUsageDays: number[]; // Day of week (0-6)
  };
  recommendations: {
    idealTierDistribution: Record<StorageTier, number>; // Percentages
    compressionStrategy: 'aggressive' | 'balanced' | 'conservative';
    deduplicationPriority: 'high' | 'medium' | 'low';
  };
}

/**
 * Generate smart recommendations for an organization
 */
export async function generateSmartRecommendations(
  orgId: string,
  category?: RecommendationCategory
): Promise<SmartRecommendation[]> {
  const [metrics, costBreakdown, usagePattern] = await Promise.all([
    getStorageMetrics(orgId),
    calculateCostBreakdown(orgId),
    analyzeUsagePatterns(orgId),
  ]);

  const recommendations: SmartRecommendation[] = [];

  // Generate category-specific recommendations
  if (!category || category === 'cost_optimization') {
    recommendations.push(...(await generateCostOptimizations(metrics, costBreakdown, usagePattern)));
  }

  if (!category || category === 'performance') {
    recommendations.push(...(await generatePerformanceOptimizations(metrics, usagePattern)));
  }

  if (!category || category === 'reliability') {
    recommendations.push(...(await generateReliabilityOptimizations(metrics)));
  }

  // Score and sort recommendations
  const scoredRecommendations = recommendations.map((rec) => ({
    ...rec,
    score: calculateRecommendationScore(rec, metrics),
  }));

  // Sort by overall score (descending)
  return scoredRecommendations.sort((a, b) => b.score.overall - a.score.overall);
}

/**
 * Analyze usage patterns for an organization
 */
async function analyzeUsagePatterns(orgId: string): Promise<UsagePattern> {
  const supabase = createClient();

  // Get upload frequency from last 30 days
  const { data: recentUploads } = await supabase
    .from('content')
    .select('created_at')
    .eq('org_id', orgId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .is('deleted_at', null);

  const uploadsPerDay = (recentUploads?.length || 0) / 30;
  const uploadFrequency: 'high' | 'medium' | 'low' =
    uploadsPerDay > 10 ? 'high' : uploadsPerDay > 3 ? 'medium' : 'low';

  // Analyze access patterns (would need access logs in production)
  // For now, use tier distribution as proxy
  const { data: recordings } = await supabase
    .from('content')
    .select('storage_tier, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  const hotTierCount = recordings?.filter((r) => r.storage_tier === 'hot').length || 0;
  const totalRecordings = recordings?.length || 1;
  const hotPercentage = (hotTierCount / totalRecordings) * 100;

  const accessFrequency: 'high' | 'medium' | 'low' =
    hotPercentage > 70 ? 'high' : hotPercentage > 30 ? 'medium' : 'low';

  // Analyze retention needs based on oldest files
  const oldestFile = recordings?.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
  const ageInDays = oldestFile
    ? (Date.now() - new Date(oldestFile.created_at).getTime()) / (24 * 60 * 60 * 1000)
    : 0;

  const retentionNeeds: 'short' | 'medium' | 'long' =
    ageInDays > 365 ? 'long' : ageInDays > 90 ? 'medium' : 'short';

  // Analyze growth trend
  const last30Days = recordings?.filter(
    (r) => new Date(r.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length || 0;
  const previous30Days = recordings?.filter(
    (r) =>
      new Date(r.created_at) > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) &&
      new Date(r.created_at) <= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length || 0;

  const growthTrend: 'increasing' | 'stable' | 'decreasing' =
    last30Days > previous30Days * 1.1
      ? 'increasing'
      : last30Days < previous30Days * 0.9
        ? 'decreasing'
        : 'stable';

  // Determine ideal tier distribution based on patterns
  let idealTierDistribution: Record<StorageTier, number>;

  if (accessFrequency === 'high' && uploadFrequency === 'high') {
    // High activity: keep more in hot
    idealTierDistribution = { hot: 60, warm: 30, cold: 8, glacier: 2 };
  } else if (accessFrequency === 'low' && retentionNeeds === 'long') {
    // Archive-heavy: move to cold
    idealTierDistribution = { hot: 15, warm: 25, cold: 40, glacier: 20 };
  } else {
    // Balanced approach
    idealTierDistribution = { hot: 30, warm: 40, cold: 25, glacier: 5 };
  }

  return {
    orgId,
    patterns: {
      uploadFrequency,
      accessFrequency,
      retentionNeeds,
      growthTrend,
      seasonality: false, // Would need more data to determine
      peakUsageDays: [1, 2, 3, 4, 5], // Weekdays (placeholder)
    },
    recommendations: {
      idealTierDistribution,
      compressionStrategy:
        accessFrequency === 'high' ? 'conservative' : 'balanced',
      deduplicationPriority:
        uploadFrequency === 'high' ? 'high' : 'medium',
    },
  };
}

/**
 * Generate cost optimization recommendations
 */
async function generateCostOptimizations(
  metrics: StorageMetrics,
  costBreakdown: CostBreakdown,
  usagePattern: UsagePattern
): Promise<SmartRecommendation[]> {
  const recommendations: SmartRecommendation[] = [];

  // Tier optimization based on usage patterns
  const currentDistribution = calculateCurrentDistribution(metrics);
  const idealDistribution = usagePattern.recommendations.idealTierDistribution;

  if (Math.abs(currentDistribution.hot - idealDistribution.hot) > 20) {
    const savingsEstimate = calculateTierMigrationSavings(metrics, idealDistribution);

    recommendations.push({
      type: 'tier_migration',
      priority: 'high',
      impact: 'high',
      title: 'Optimize storage tier distribution',
      description: `Your current tier distribution doesn't match your usage patterns. Migrating files to appropriate tiers could save $${savingsEstimate.toFixed(2)}/month.`,
      estimatedSavings: savingsEstimate,
      estimatedAnnualSavings: savingsEstimate * 12,
      complexity: 'moderate',
      effort: '4-6 hours',
      steps: [
        'Analyze file access patterns by age',
        'Identify files eligible for tier migration',
        'Create automated lifecycle policies',
        'Migrate files in batches',
        'Monitor access patterns after migration',
      ],
      score: {
        overall: 0,
        impact: 85,
        effort: 60,
        urgency: 70,
        feasibility: 90,
      },
      confidence: 85,
      prerequisites: [
        'Access pattern data available',
        'Lifecycle policies configured',
      ],
      risks: [
        'Increased retrieval costs for frequently accessed files',
        'Potential latency impact on cold/glacier tier access',
      ],
      kpis: [
        { metric: 'Hot tier percentage', current: currentDistribution.hot, target: idealDistribution.hot, unit: '%' },
        { metric: 'Monthly storage cost', current: costBreakdown.currentMonthly.total, target: costBreakdown.currentMonthly.total - savingsEstimate, unit: '$' },
      ],
      timeline: {
        preparation: '1-2 days',
        implementation: '3-4 days',
        validation: '1 week',
        total: '2 weeks',
      },
      resources: [
        { type: 'documentation', title: 'Storage Tier Best Practices' },
        { type: 'guide', title: 'Lifecycle Policy Configuration Guide' },
      ],
    });
  }

  return recommendations;
}

/**
 * Generate performance optimization recommendations
 */
async function generatePerformanceOptimizations(
  metrics: StorageMetrics,
  usagePattern: UsagePattern
): Promise<SmartRecommendation[]> {
  const recommendations: SmartRecommendation[] = [];

  // CDN/caching recommendation for high-access patterns
  if (usagePattern.patterns.accessFrequency === 'high') {
    // Derive baseline metrics from current usage
    const currentCacheHitRate = 0; // No CDN currently
    const targetCacheHitRate = 80; // Target 80% cache hit rate

    // Estimate latency based on tier distribution (hot tier = faster, cold = slower)
    const hotTierPercentage = metrics.tierBreakdown.find(t => t.tier === 'hot')?.percentage || 0;
    const estimatedCurrentLatency = hotTierPercentage > 70 ? 150 : hotTierPercentage > 40 ? 300 : 500;
    const targetLatency = 100; // Target 100ms with CDN

    // Estimate savings based on potential egress cost reduction
    const estimatedMonthlySavings = Math.max(50, metrics.totalStorageGB * 0.5);

    recommendations.push({
      type: 'provider_switch', // CDN is a form of provider optimization
      priority: 'medium',
      impact: 'medium',
      title: 'Implement CDN caching for frequently accessed files',
      description: 'High access frequency detected. Implementing CDN caching can improve performance and reduce egress costs.',
      estimatedSavings: estimatedMonthlySavings,
      estimatedAnnualSavings: estimatedMonthlySavings * 12,
      complexity: 'moderate',
      effort: '1-2 days',
      steps: [
        'Set up Cloudflare CDN configuration',
        'Configure cache TTL policies',
        'Implement cache invalidation strategy',
        'Monitor cache hit rates',
      ],
      score: {
        overall: 0,
        impact: 70,
        effort: 50,
        urgency: 50,
        feasibility: 85,
      },
      confidence: 75,
      prerequisites: ['Cloudflare account configured', 'Domain setup complete'],
      risks: ['Stale content if cache invalidation not configured properly'],
      kpis: [
        {
          metric: 'Cache hit rate',
          current: currentCacheHitRate,
          target: targetCacheHitRate,
          unit: '%'
        },
        {
          metric: 'Average latency (estimated)',
          current: estimatedCurrentLatency,
          target: targetLatency,
          unit: 'ms'
        },
      ],
      timeline: {
        preparation: '4 hours',
        implementation: '1 day',
        validation: '1 week',
        total: '2 weeks',
      },
      resources: [
        { type: 'documentation', title: 'Cloudflare CDN Setup Guide' },
        { type: 'tool', title: 'Cache Performance Analyzer' },
      ],
    });
  }

  return recommendations;
}

/**
 * Generate reliability optimization recommendations
 */
async function generateReliabilityOptimizations(
  metrics: StorageMetrics
): Promise<SmartRecommendation[]> {
  const recommendations: SmartRecommendation[] = [];

  // Backup recommendation if deduplication is high
  if (metrics.optimization.deduplicationRatio > 50) {
    recommendations.push({
      type: 'lifecycle_policy',
      priority: 'medium',
      impact: 'low',
      title: 'Implement backup strategy for deduplicated files',
      description: 'High deduplication rate detected. Consider implementing backup strategy to protect against data loss.',
      estimatedSavings: 0, // This is a reliability measure, not cost savings
      estimatedAnnualSavings: 0,
      complexity: 'moderate',
      effort: '1-2 days',
      steps: [
        'Identify critical deduplicated files',
        'Set up automated backup schedule',
        'Test backup restoration process',
        'Document backup procedures',
      ],
      score: {
        overall: 0,
        impact: 60,
        effort: 40,
        urgency: 30,
        feasibility: 95,
      },
      confidence: 90,
      prerequisites: ['Backup storage configured'],
      risks: ['Increased storage costs for backups'],
      kpis: [
        { metric: 'Backup coverage', current: 0, target: 100, unit: '%' },
        { metric: 'Recovery time', current: 0, target: 4, unit: 'hours' },
      ],
      timeline: {
        preparation: '1 day',
        implementation: '1 day',
        validation: '1 week',
        total: '2 weeks',
      },
      resources: [
        { type: 'documentation', title: 'Backup Best Practices' },
        { type: 'guide', title: 'Disaster Recovery Planning' },
      ],
    });
  }

  return recommendations;
}

/**
 * Calculate recommendation score
 */
function calculateRecommendationScore(
  rec: Partial<SmartRecommendation>,
  metrics: StorageMetrics
): RecommendationScore {
  const impact = rec.score?.impact || 50;
  const effort = rec.score?.effort || 50;
  const urgency = rec.score?.urgency || 50;
  const feasibility = rec.score?.feasibility || 50;

  // Overall score is weighted average
  const overall = impact * 0.4 + (100 - effort) * 0.2 + urgency * 0.2 + feasibility * 0.2;

  return {
    overall: Math.round(overall),
    impact,
    effort,
    urgency,
    feasibility,
  };
}

/**
 * Calculate current tier distribution
 */
function calculateCurrentDistribution(metrics: StorageMetrics): Record<StorageTier, number> {
  const total = metrics.totalStorageBytes || 1;
  const distribution: Record<StorageTier, number> = { hot: 0, warm: 0, cold: 0, glacier: 0 };

  metrics.tierBreakdown.forEach((tier) => {
    distribution[tier.tier] = (tier.storageBytes / total) * 100;
  });

  return distribution;
}

/**
 * Calculate tier migration savings
 */
function calculateTierMigrationSavings(
  metrics: StorageMetrics,
  targetDistribution: Record<StorageTier, number>
): number {
  const RATES = { hot: 0.015, warm: 0.01, cold: 0.004, glacier: 0.001 };

  const currentCost = metrics.tierBreakdown.reduce((sum, tier) => {
    return sum + tier.storageGB * RATES[tier.tier];
  }, 0);

  const targetCost = Object.entries(targetDistribution).reduce((sum, [tier, percentage]) => {
    return sum + (metrics.totalStorageGB * (percentage / 100) * RATES[tier as StorageTier]);
  }, 0);

  return Math.max(0, currentCost - targetCost);
}

/**
 * Get prioritized action plan
 */
export async function getActionPlan(orgId: string): Promise<{
  immediate: SmartRecommendation[];
  shortTerm: SmartRecommendation[];
  longTerm: SmartRecommendation[];
  estimatedTotalSavings: number;
}> {
  const recommendations = await generateSmartRecommendations(orgId);

  const immediate = recommendations.filter((r) => r.score.urgency >= 70);
  const shortTerm = recommendations.filter(
    (r) => r.score.urgency >= 40 && r.score.urgency < 70
  );
  const longTerm = recommendations.filter((r) => r.score.urgency < 40);

  const estimatedTotalSavings = recommendations.reduce(
    (sum, r) => sum + r.estimatedAnnualSavings,
    0
  );

  return {
    immediate,
    shortTerm,
    longTerm,
    estimatedTotalSavings,
  };
}
