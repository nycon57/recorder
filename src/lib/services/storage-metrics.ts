/**
 * Storage Metrics Aggregation Service
 *
 * Provides comprehensive storage analytics including:
 * - Real-time storage usage by tier
 * - Deduplication and compression metrics
 * - Cost analysis and projections
 * - Optimization opportunities
 * - Usage trends and anomaly detection
 */

import { createClient } from '@/lib/supabase/admin';
import type { StorageTier, StorageProvider } from '@/lib/types/database';

/**
 * Storage metrics for a single organization
 */
export interface StorageMetrics {
  orgId: string;
  orgName: string;
  timestamp: string;

  // Total storage metrics
  totalFiles: number;
  totalStorageBytes: number;
  totalStorageGB: number;

  // Tier breakdown
  tierBreakdown: {
    tier: StorageTier;
    fileCount: number;
    storageBytes: number;
    storageGB: number;
    percentage: number;
  }[];

  // Provider breakdown
  providerBreakdown: {
    provider: StorageProvider;
    fileCount: number;
    storageBytes: number;
    storageGB: number;
    percentage: number;
  }[];

  // Optimization metrics
  optimization: {
    deduplicationRatio: number; // Percentage of duplicates eliminated
    compressionRatio: number; // Average compression ratio
    spaceSavedByDeduplication: number; // Bytes
    spaceSavedByCompression: number; // Bytes
    totalSpaceSaved: number; // Bytes
    totalSpaceSavedGB: number;
    optimizationPercentage: number; // Overall optimization percentage
  };

  // File type breakdown
  fileTypeBreakdown: {
    type: string;
    count: number;
    storageBytes: number;
    storageGB: number;
    percentage: number;
  }[];

  // Processing status
  processingStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };

  // Similarity detection metrics
  similarity: {
    processedFiles: number;
    totalMatches: number;
    nearIdenticalCount: number;
    highSimilarityCount: number;
    mediumSimilarityCount: number;
    potentialSavingsGB: number;
  };
}

/**
 * Historical storage trends
 */
export interface StorageTrend {
  date: string;
  totalStorageGB: number;
  tierBreakdown: Record<StorageTier, number>;
  costEstimate: number;
  filesAdded: number;
  filesDeleted: number;
  netGrowthGB: number;
}

/**
 * Anomaly detection result
 */
export interface StorageAnomaly {
  type: 'spike' | 'drop' | 'unusual_growth' | 'unusual_shrinkage' | 'cost_spike';
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number; // Percentage
  description: string;
  recommendation?: string;
}

/**
 * Storage health score
 */
export interface StorageHealth {
  overallScore: number; // 0-100
  components: {
    optimization: { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' };
    cost: { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' };
    distribution: { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' };
    processing: { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' };
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Get comprehensive storage metrics for an organization
 */
export async function getStorageMetrics(orgId: string): Promise<StorageMetrics> {
  const supabase = createClient();

  // Get organization name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  // Get all recordings for the organization
  const { data: recordings, error } = await supabase
    .from('content')
    .select('*')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch recordings: ${error.message}`);
  }

  if (!recordings || recordings.length === 0) {
    return getEmptyMetrics(orgId, org?.name || 'Unknown');
  }

  // Calculate total storage
  const totalFiles = recordings.length;
  const totalStorageBytes = recordings.reduce((sum, r) => sum + (r.file_size || 0), 0);
  const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

  // Tier breakdown
  const tierMap = new Map<StorageTier, { count: number; bytes: number }>();
  recordings.forEach((r) => {
    const tier = (r.storage_tier || 'hot') as StorageTier;
    const existing = tierMap.get(tier) || { count: 0, bytes: 0 };
    tierMap.set(tier, {
      count: existing.count + 1,
      bytes: existing.bytes + (r.file_size || 0),
    });
  });

  const tierBreakdown = Array.from(tierMap.entries()).map(([tier, stats]) => ({
    tier,
    fileCount: stats.count,
    storageBytes: stats.bytes,
    storageGB: stats.bytes / (1024 * 1024 * 1024),
    percentage: (stats.bytes / totalStorageBytes) * 100,
  }));

  // Provider breakdown
  const providerMap = new Map<StorageProvider, { count: number; bytes: number }>();
  recordings.forEach((r) => {
    const provider = (r.storage_provider || 'supabase') as StorageProvider;
    const existing = providerMap.get(provider) || { count: 0, bytes: 0 };
    providerMap.set(provider, {
      count: existing.count + 1,
      bytes: existing.bytes + (r.file_size || 0),
    });
  });

  const providerBreakdown = Array.from(providerMap.entries()).map(([provider, stats]) => ({
    provider,
    fileCount: stats.count,
    storageBytes: stats.bytes,
    storageGB: stats.bytes / (1024 * 1024 * 1024),
    percentage: (stats.bytes / totalStorageBytes) * 100,
  }));

  // Deduplication metrics
  const deduplicatedFiles = recordings.filter((r) => r.is_deduplicated === true);
  const originalSize = recordings.reduce((sum, r) => {
    if (r.is_deduplicated && r.file_size) {
      return sum + r.file_size;
    }
    return sum;
  }, 0);

  const deduplicationRatio =
    totalFiles > 0 ? (deduplicatedFiles.length / totalFiles) * 100 : 0;
  const spaceSavedByDeduplication = originalSize;

  // Compression metrics
  const compressedFiles = recordings.filter(
    (r) => r.compression_status === 'completed' && r.original_size && r.file_size
  );
  const totalOriginalSize = compressedFiles.reduce((sum, r) => sum + (r.original_size || 0), 0);
  const totalCompressedSize = compressedFiles.reduce((sum, r) => sum + (r.file_size || 0), 0);

  const compressionRatio =
    totalOriginalSize > 0 ? (1 - totalCompressedSize / totalOriginalSize) * 100 : 0;
  const spaceSavedByCompression = totalOriginalSize - totalCompressedSize;

  const totalSpaceSaved = spaceSavedByDeduplication + spaceSavedByCompression;
  const totalSpaceSavedGB = totalSpaceSaved / (1024 * 1024 * 1024);
  const optimizationPercentage =
    totalStorageBytes + totalSpaceSaved > 0
      ? (totalSpaceSaved / (totalStorageBytes + totalSpaceSaved)) * 100
      : 0;

  // File type breakdown
  const typeMap = new Map<string, { count: number; bytes: number }>();
  recordings.forEach((r) => {
    const type = r.mime_type || 'unknown';
    const existing = typeMap.get(type) || { count: 0, bytes: 0 };
    typeMap.set(type, {
      count: existing.count + 1,
      bytes: existing.bytes + (r.file_size || 0),
    });
  });

  const fileTypeBreakdown = Array.from(typeMap.entries()).map(([type, stats]) => ({
    type,
    count: stats.count,
    storageBytes: stats.bytes,
    storageGB: stats.bytes / (1024 * 1024 * 1024),
    percentage: (stats.bytes / totalStorageBytes) * 100,
  }));

  // Processing status
  const processingStatus = {
    pending: recordings.filter((r) => r.status === 'pending' || r.status === 'uploading').length,
    processing: recordings.filter((r) => r.status === 'processing' || r.status === 'transcribing')
      .length,
    completed: recordings.filter((r) => r.status === 'completed').length,
    failed: recordings.filter((r) => r.status === 'failed').length,
  };

  // Similarity detection metrics
  const processedForSimilarity = recordings.filter((r) => r.similarity_processed_at !== null).length;

  // Get all recording IDs for this organization
  const contentIds = recordings.map((r) => r.id);

  // Fetch similarity matches for all recordings in this organization
  const { data: similarityMatches } = contentIds.length > 0
    ? await supabase
        .from('similarity_matches')
        .select('*')
        .in('content_id', contentIds)
    : { data: [] };

  const totalMatches = similarityMatches?.length || 0;
  const nearIdenticalCount =
    similarityMatches?.filter((m) => m.overall_similarity >= 95).length || 0;
  const highSimilarityCount =
    similarityMatches?.filter((m) => m.overall_similarity >= 85 && m.overall_similarity < 95)
      .length || 0;
  const mediumSimilarityCount =
    similarityMatches?.filter((m) => m.overall_similarity >= 70 && m.overall_similarity < 85)
      .length || 0;

  // Estimate potential savings from near-identical matches
  const avgFileSize = totalFiles > 0 ? totalStorageBytes / totalFiles : 0;
  const potentialSavingsGB = (nearIdenticalCount * avgFileSize) / (1024 * 1024 * 1024);

  return {
    orgId,
    orgName: org?.name || 'Unknown',
    timestamp: new Date().toISOString(),
    totalFiles,
    totalStorageBytes,
    totalStorageGB,
    tierBreakdown,
    providerBreakdown,
    optimization: {
      deduplicationRatio,
      compressionRatio,
      spaceSavedByDeduplication,
      spaceSavedByCompression,
      totalSpaceSaved,
      totalSpaceSavedGB,
      optimizationPercentage,
    },
    fileTypeBreakdown,
    processingStatus,
    similarity: {
      processedFiles: processedForSimilarity,
      totalMatches,
      nearIdenticalCount,
      highSimilarityCount,
      mediumSimilarityCount,
      potentialSavingsGB,
    },
  };
}

/**
 * Get storage trends over time
 */
export async function getStorageTrends(
  orgId: string,
  days: number = 30
): Promise<StorageTrend[]> {
  const supabase = createClient();

  // Query storage history from the database
  // Note: This requires a storage_history table to be created
  const { data: history, error } = await supabase
    .from('storage_history')
    .select('*')
    .eq('org_id', orgId)
    .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('date', { ascending: true });

  if (error) {
    console.error('Failed to fetch storage history:', error);
    return [];
  }

  return (history || []).map((h) => ({
    date: h.date,
    totalStorageGB: h.total_storage_bytes / (1024 * 1024 * 1024),
    tierBreakdown: h.tier_breakdown || {},
    costEstimate: h.cost_estimate || 0,
    filesAdded: h.files_added || 0,
    filesDeleted: h.files_deleted || 0,
    netGrowthGB: h.net_growth_bytes / (1024 * 1024 * 1024),
  }));
}

/**
 * Detect storage anomalies
 */
export async function detectAnomalies(orgId: string): Promise<StorageAnomaly[]> {
  const anomalies: StorageAnomaly[] = [];

  const supabase = createClient();

  // Get recent trends
  const trends = await getStorageTrends(orgId, 30);

  if (trends.length < 7) {
    // Not enough data for anomaly detection
    return anomalies;
  }

  // Calculate average growth rate
  const growthRates = trends
    .slice(1)
    .map((t, i) => t.totalStorageGB - trends[i].totalStorageGB);
  const avgGrowth = growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length;
  const stdDevGrowth = Math.sqrt(
    growthRates.reduce((sum, g) => sum + Math.pow(g - avgGrowth, 2), 0) / growthRates.length
  );

  // Check for unusual growth
  const recentGrowth = trends[trends.length - 1].netGrowthGB;
  if (Math.abs(recentGrowth - avgGrowth) > 2 * stdDevGrowth) {
    // Safe deviation calculation
    const epsilon = 1e-6;
    let deviation: number;
    if (Math.abs(avgGrowth) < epsilon) {
      // If avgGrowth is near zero, use absolute difference in GB
      deviation = Math.abs(recentGrowth);
    } else {
      deviation = ((recentGrowth - avgGrowth) / avgGrowth) * 100;
    }

    anomalies.push({
      type: recentGrowth > avgGrowth ? 'unusual_growth' : 'unusual_shrinkage',
      severity: Math.abs(recentGrowth - avgGrowth) > 3 * stdDevGrowth ? 'high' : 'medium',
      detectedAt: new Date().toISOString(),
      metric: 'storage_growth',
      currentValue: recentGrowth,
      expectedValue: avgGrowth,
      deviation,
      description: `Unusual storage ${recentGrowth > avgGrowth ? 'growth' : 'shrinkage'} detected: ${recentGrowth.toFixed(2)} GB vs expected ${avgGrowth.toFixed(2)} GB`,
      recommendation:
        recentGrowth > avgGrowth
          ? 'Review recent uploads for potential duplicates or unnecessarily large files'
          : 'Verify that file deletions were intentional',
    });
  }

  // Check for cost spikes
  const avgCost = trends.reduce((sum, t) => sum + t.costEstimate, 0) / trends.length;
  const recentCost = trends[trends.length - 1].costEstimate;
  if (recentCost > avgCost * 1.5) {
    anomalies.push({
      type: 'cost_spike',
      severity: recentCost > avgCost * 2 ? 'high' : 'medium',
      detectedAt: new Date().toISOString(),
      metric: 'storage_cost',
      currentValue: recentCost,
      expectedValue: avgCost,
      deviation: ((recentCost - avgCost) / avgCost) * 100,
      description: `Storage cost spike detected: $${recentCost.toFixed(2)} vs expected $${avgCost.toFixed(2)}`,
      recommendation: 'Review storage tier distribution and consider migrating older files to cheaper tiers',
    });
  }

  return anomalies;
}

/**
 * Calculate storage health score
 */
export async function calculateStorageHealth(orgId: string): Promise<StorageHealth> {
  const metrics = await getStorageMetrics(orgId);

  // Optimization score (0-100)
  const optimizationScore = Math.min(100, metrics.optimization.optimizationPercentage * 2);
  const optimizationStatus =
    optimizationScore >= 80
      ? 'excellent'
      : optimizationScore >= 60
        ? 'good'
        : optimizationScore >= 40
          ? 'fair'
          : 'poor';

  // Cost score based on tier distribution (prefer cheaper tiers for older files)
  const hotPercentage = metrics.tierBreakdown.find((t) => t.tier === 'hot')?.percentage || 0;
  const costScore = Math.max(0, 100 - hotPercentage); // Lower hot tier percentage = better score
  const costStatus =
    costScore >= 80 ? 'excellent' : costScore >= 60 ? 'good' : costScore >= 40 ? 'fair' : 'poor';

  // Distribution score (prefer balanced tier distribution)
  const tierCount = metrics.tierBreakdown.length;
  const distributionScore = Math.min(100, tierCount * 25); // More tiers = better distribution
  const distributionStatus =
    distributionScore >= 80
      ? 'excellent'
      : distributionScore >= 60
        ? 'good'
        : distributionScore >= 40
          ? 'fair'
          : 'poor';

  // Processing score (fewer pending/failed = better)
  const processingScore = Math.max(
    0,
    100 -
      ((metrics.processingStatus.pending + metrics.processingStatus.failed * 2) /
        metrics.totalFiles) *
        100
  );
  const processingStatus =
    processingScore >= 80
      ? 'excellent'
      : processingScore >= 60
        ? 'good'
        : processingScore >= 40
          ? 'fair'
          : 'poor';

  // Overall score (weighted average)
  const overallScore =
    optimizationScore * 0.4 +
    costScore * 0.3 +
    distributionScore * 0.2 +
    processingScore * 0.1;

  // Identify issues
  const issues: string[] = [];
  if (optimizationScore < 60) {
    issues.push(`Low optimization rate: ${metrics.optimization.optimizationPercentage.toFixed(1)}%`);
  }
  if (hotPercentage > 70) {
    issues.push(`Too many files in hot tier: ${hotPercentage.toFixed(1)}%`);
  }
  if (metrics.processingStatus.failed > 0) {
    issues.push(`${metrics.processingStatus.failed} failed recordings`);
  }
  if (metrics.processingStatus.pending > 10) {
    issues.push(`${metrics.processingStatus.pending} pending recordings`);
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (metrics.optimization.deduplicationRatio < 20) {
    recommendations.push('Run batch deduplication to identify duplicate files');
  }
  if (metrics.similarity.processedFiles < metrics.totalFiles) {
    recommendations.push('Run similarity detection to find near-duplicate content');
  }
  if (hotPercentage > 70) {
    recommendations.push('Migrate older recordings to warm or cold tiers to reduce costs');
  }
  if (metrics.processingStatus.failed > 0) {
    recommendations.push('Review and retry failed recordings');
  }

  return {
    overallScore,
    components: {
      optimization: { score: optimizationScore, status: optimizationStatus },
      cost: { score: costScore, status: costStatus },
      distribution: { score: distributionScore, status: distributionStatus },
      processing: { score: processingScore, status: processingStatus },
    },
    issues,
    recommendations,
  };
}

/**
 * Get empty metrics object for organizations with no recordings
 */
function getEmptyMetrics(orgId: string, orgName: string): StorageMetrics {
  return {
    orgId,
    orgName,
    timestamp: new Date().toISOString(),
    totalFiles: 0,
    totalStorageBytes: 0,
    totalStorageGB: 0,
    tierBreakdown: [],
    providerBreakdown: [],
    optimization: {
      deduplicationRatio: 0,
      compressionRatio: 0,
      spaceSavedByDeduplication: 0,
      spaceSavedByCompression: 0,
      totalSpaceSaved: 0,
      totalSpaceSavedGB: 0,
      optimizationPercentage: 0,
    },
    fileTypeBreakdown: [],
    processingStatus: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    },
    similarity: {
      processedFiles: 0,
      totalMatches: 0,
      nearIdenticalCount: 0,
      highSimilarityCount: 0,
      mediumSimilarityCount: 0,
      potentialSavingsGB: 0,
    },
  };
}

/**
 * Aggregate metrics across all organizations
 */
export async function getGlobalMetrics(): Promise<{
  totalOrganizations: number;
  totalFiles: number;
  totalStorageGB: number;
  totalSpaceSavedGB: number;
  avgOptimizationPercentage: number;
  organizationMetrics: StorageMetrics[];
}> {
  const supabase = createClient();

  // Get all active organizations
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch organizations: ${error.message}`);
  }

  if (!organizations || organizations.length === 0) {
    return {
      totalOrganizations: 0,
      totalFiles: 0,
      totalStorageGB: 0,
      totalSpaceSavedGB: 0,
      avgOptimizationPercentage: 0,
      organizationMetrics: [],
    };
  }

  // Fetch metrics for each organization with bounded concurrency
  const BATCH_SIZE = 10;
  const organizationMetrics: StorageMetrics[] = [];

  for (let i = 0; i < organizations.length; i += BATCH_SIZE) {
    const batch = organizations.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((org) => getStorageMetrics(org.id))
    );
    organizationMetrics.push(...batchResults);
  }

  const totalFiles = organizationMetrics.reduce((sum, m) => sum + m.totalFiles, 0);
  const totalStorageGB = organizationMetrics.reduce((sum, m) => sum + m.totalStorageGB, 0);
  const totalSpaceSavedGB = organizationMetrics.reduce(
    (sum, m) => sum + m.optimization.totalSpaceSavedGB,
    0
  );
  const avgOptimizationPercentage =
    organizationMetrics.reduce((sum, m) => sum + m.optimization.optimizationPercentage, 0) /
    organizations.length;

  return {
    totalOrganizations: organizations.length,
    totalFiles,
    totalStorageGB,
    totalSpaceSavedGB,
    avgOptimizationPercentage,
    organizationMetrics,
  };
}
