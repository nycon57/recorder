/**
 * Organization Deep Dive - Metrics API
 *
 * GET /api/analytics/organizations/[id]/metrics
 * - Returns comprehensive metrics for a specific organization
 * - Includes storage, cost, and optimization metrics
 * - Requires system admin privileges
 */

import { NextRequest } from 'next/server';
import { subMonths } from 'date-fns';
import { apiHandler, requireSystemAdmin, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/analytics/organizations/[id]/metrics
 *
 * Get comprehensive metrics for a specific organization
 *
 * @example
 * GET /api/analytics/organizations/123e4567-e89b-12d3-a456-426614174000/metrics
 */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  // Require system admin privileges for organization deep dive
  await requireSystemAdmin();

  const { id: orgId } = await context.params;

  // Get organization
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  // Get current metrics from recordings
  const { data: recordings } = await supabaseAdmin
    .from('recordings')
    .select('file_size, storage_tier, storage_provider, compression_stats, mime_type')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Calculate totals
  const totalStorage = recordings?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;
  const totalRecordings = recordings?.length || 0;

  // Tier distribution
  const tierDistribution = {
    hot: recordings?.filter((r) => r.storage_tier === 'hot').length || 0,
    warm: recordings?.filter((r) => r.storage_tier === 'warm').length || 0,
    cold: recordings?.filter((r) => r.storage_tier === 'cold').length || 0,
    glacier: 0, // Not implemented yet
  };

  // Provider distribution
  const providerDistribution = {
    supabase: recordings?.filter((r) => r.storage_provider === 'supabase').length || 0,
    cloudflare_r2: recordings?.filter((r) => r.storage_provider === 'r2').length || 0,
  };

  // Dominant tier (most recordings)
  const dominantTier = (
    Object.entries(tierDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 'hot'
  ) as 'hot' | 'warm' | 'cold' | 'glacier';

  // User count
  const { count: userCount } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Calculate costs (monthly)
  const tierPricing = { hot: 0.021, warm: 0.015, cold: 0.01, glacier: 0.004 };
  const totalCost = recordings?.reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    const tier = (r.storage_tier || 'hot') as keyof typeof tierPricing;
    return sum + sizeGB * tierPricing[tier];
  }, 0) || 0;

  // Growth rate (compare to last month)
  // Use date-fns to safely subtract a month
  const oneMonthAgo = subMonths(new Date(), 1);

  const { data: historicalMetrics } = await supabaseAdmin
    .from('recordings')
    .select('file_size, created_at')
    .eq('org_id', orgId)
    .lt('created_at', oneMonthAgo.toISOString())
    .is('deleted_at', null);

  const previousStorage =
    historicalMetrics?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0;

  const storageGrowthRate =
    previousStorage > 0 ? ((totalStorage - previousStorage) / previousStorage) * 100 : 0;

  // Estimate previous cost
  // Note: Historical cost assumes hot tier as tier migration history is not tracked
  const previousCost = historicalMetrics?.reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * tierPricing.hot; // Assume hot tier for historical
  }, 0) || 0;

  const costGrowthRate = previousCost > 0 ? ((totalCost - previousCost) / previousCost) * 100 : 0;

  // Compression metrics
  const compressedFiles = recordings?.filter((r) => r.compression_stats != null) || [];
  const avgCompressionRate = compressedFiles.length
    ? compressedFiles.reduce((sum, r) => {
        const stats = r.compression_stats as any;
        return sum + (stats?.compression_ratio || 1);
      }, 0) / compressedFiles.length
    : 0;

  // Average file size
  const avgFileSize = totalRecordings > 0 ? totalStorage / totalRecordings : 0;

  // Metrics
  const metrics = {
    totalStorage,
    totalStorageGB: totalStorage / 1e9,
    totalRecordings,
    totalUsers: userCount || 0,
    totalCost,
    costPerUser: userCount ? totalCost / userCount : 0,
    costPerGB: totalStorage > 0 ? totalCost / (totalStorage / 1e9) : 0,
    avgFileSize,
    dominantTier,
    compressionRate: avgCompressionRate,
    storageGrowthRate,
    costGrowthRate,
  };

  return successResponse({
    organization: {
      id: org.id,
      name: org.name,
    },
    metrics,
    tierDistribution,
    providerDistribution,
    metadata: {
      historical_cost_assumption: 'hot',
      note: 'Historical cost calculations assume all recordings were in hot tier as tier migration history is not tracked',
    },
  });
});
