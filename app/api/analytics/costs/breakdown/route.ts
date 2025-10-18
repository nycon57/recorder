/**
 * Cost Breakdown API Endpoint
 *
 * GET /api/analytics/costs/breakdown
 * Returns cost breakdown by organization, tier, and provider.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TIER_PRICING, calculateTrend } from '@/lib/analytics/cost-calculations';

/**
 * GET /api/analytics/costs/breakdown
 *
 * Returns cost breakdown by organization, storage tier, and provider
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  // Get recordings for this organization only
  const { data: recordings, error: recordingsError } = await supabase
    .from('recordings')
    .select('storage_tier, storage_provider, file_size, org_id, organizations!inner(name)')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (recordingsError) {
    console.error('[GET /api/analytics/costs/breakdown] Error fetching recordings:', recordingsError);
    throw new Error(`Failed to fetch recordings: ${recordingsError.message}`);
  }

  if (!recordings) {
    return successResponse({
      byOrganization: [],
      byTier: [],
      byProvider: [],
    });
  }

  // Calculate costs by organization
  const orgCosts = recordings.reduce((acc, r) => {
    const orgId = r.org_id;
    const orgName = (r.organizations as any)?.name || 'Unknown';
    const tier = r.storage_tier || 'hot';
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];

    if (!acc[orgId]) {
      acc[orgId] = {
        name: orgName,
        cost: 0,
      };
    }
    acc[orgId].cost += cost;
    return acc;
  }, {} as Record<string, { name: string; cost: number }>);

  const totalCostAllOrgs = Object.values(orgCosts).reduce((sum, org) => sum + org.cost, 0);

  // Calculate costs by tier
  const tierCosts = recordings.reduce((acc, r) => {
    const tier = r.storage_tier || 'hot';
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];

    acc[tier] = (acc[tier] || 0) + cost;
    return acc;
  }, {} as Record<string, number>);

  // Calculate costs by provider
  const providerCosts = recordings.reduce((acc, r) => {
    const provider = r.storage_provider || 'supabase';
    const tier = r.storage_tier || 'hot';
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];

    acc[provider] = (acc[provider] || 0) + cost;
    return acc;
  }, {} as Record<string, number>);

  // Get trends for each organization (30-day comparison)
  const orgBreakdown = await Promise.all(
    Object.entries(orgCosts).map(async ([id, data]) => {
      const trend = await calculateTrend(id, 30);
      return {
        name: data.name,
        cost: parseFloat(data.cost.toFixed(2)),
        percentage: totalCostAllOrgs > 0 ? parseFloat(((data.cost / totalCostAllOrgs) * 100).toFixed(2)) : 0,
        trend: parseFloat(trend.toFixed(2)),
      };
    })
  );

  // Format tier breakdown
  const tierNames: Record<string, string> = {
    hot: 'Hot Storage',
    warm: 'Warm Storage',
    cold: 'Cold Storage',
    glacier: 'Glacier Storage',
  };

  const totalTierCost = Object.values(tierCosts).reduce((sum, cost) => sum + cost, 0);

  const tierBreakdown = await Promise.all(
    Object.entries(tierCosts).map(async ([tier, cost]) => {
      // Calculate tier-specific trend
      const trend = await calculateTierTrend(tier as keyof typeof TIER_PRICING);
      return {
        name: tierNames[tier] || tier,
        cost: parseFloat(cost.toFixed(2)),
        percentage: totalTierCost > 0 ? parseFloat(((cost / totalTierCost) * 100).toFixed(2)) : 0,
        trend: parseFloat(trend.toFixed(2)),
      };
    })
  );

  // Format provider breakdown
  const providerNames: Record<string, string> = {
    supabase: 'Supabase Storage',
    r2: 'Cloudflare R2',
    cloudflare: 'Cloudflare R2',
  };

  const totalProviderCost = Object.values(providerCosts).reduce((sum, cost) => sum + cost, 0);

  const providerBreakdown = await Promise.all(
    Object.entries(providerCosts).map(async ([provider, cost]) => {
      const trend = await calculateProviderTrend(provider);
      return {
        name: providerNames[provider] || provider,
        cost: parseFloat(cost.toFixed(2)),
        percentage: totalProviderCost > 0 ? parseFloat(((cost / totalProviderCost) * 100).toFixed(2)) : 0,
        trend: parseFloat(trend.toFixed(2)),
      };
    })
  );

  // Sort by cost (descending)
  orgBreakdown.sort((a, b) => b.cost - a.cost);
  tierBreakdown.sort((a, b) => b.cost - a.cost);
  providerBreakdown.sort((a, b) => b.cost - a.cost);

  return successResponse({
    byOrganization: orgBreakdown,
    byTier: tierBreakdown,
    byProvider: providerBreakdown,
  });
});

/**
 * Calculate trend for specific tier
 */
async function calculateTierTrend(tier: string): Promise<number> {
  const supabase = supabaseAdmin;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get recordings in current period
  const { data: currentData } = await supabase
    .from('recordings')
    .select('file_size, storage_tier')
    .eq('storage_tier', tier)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  // Get recordings in previous period
  const { data: previousData } = await supabase
    .from('recordings')
    .select('file_size, storage_tier')
    .eq('storage_tier', tier)
    .gte('created_at', sixtyDaysAgo.toISOString())
    .lt('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  const currentCost = (currentData || []).reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];
  }, 0);

  const previousCost = (previousData || []).reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];
  }, 0);

  if (previousCost === 0) return 0;

  return ((currentCost - previousCost) / previousCost) * 100;
}

/**
 * Calculate trend for specific provider
 */
async function calculateProviderTrend(provider: string): Promise<number> {
  const supabase = supabaseAdmin;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get recordings in current period
  const { data: currentData } = await supabase
    .from('recordings')
    .select('file_size, storage_tier, storage_provider')
    .eq('storage_provider', provider)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  // Get recordings in previous period
  const { data: previousData } = await supabase
    .from('recordings')
    .select('file_size, storage_tier, storage_provider')
    .eq('storage_provider', provider)
    .gte('created_at', sixtyDaysAgo.toISOString())
    .lt('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  const currentCost = (currentData || []).reduce((sum, r) => {
    const tier = r.storage_tier || 'hot';
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];
  }, 0);

  const previousCost = (previousData || []).reduce((sum, r) => {
    const tier = r.storage_tier || 'hot';
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier as keyof typeof TIER_PRICING];
  }, 0);

  if (previousCost === 0) return 0;

  return ((currentCost - previousCost) / previousCost) * 100;
}
