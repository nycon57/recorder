/**
 * Cost Breakdown API Endpoint
 *
 * GET /api/analytics/costs/breakdown
 * Returns cost breakdown by organization, tier, and provider.
 */

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TIER_PRICING, calculateTrend } from '@/lib/analytics/cost-calculations';
import type { Database } from '@/lib/types/database';

type StorageTier = Database['public']['Enums']['storage_tier'];
type StorageProvider = Database['public']['Enums']['storage_provider'];

const STORAGE_TIERS = ['hot', 'warm', 'cold', 'glacier'] as const satisfies readonly StorageTier[];
const STORAGE_PROVIDERS = ['supabase', 'r2', 'cloudflare'] as const satisfies readonly StorageProvider[];

const isStorageTier = (value: string | null): value is StorageTier =>
  value !== null && STORAGE_TIERS.includes(value as StorageTier);

const isStorageProvider = (value: string | null): value is StorageProvider =>
  value !== null && STORAGE_PROVIDERS.includes(value as StorageProvider);

const normalizeStorageTier = (value: string | null): StorageTier =>
  isStorageTier(value) ? value : 'hot';

const normalizeStorageProvider = (value: string | null): StorageProvider =>
  isStorageProvider(value) ? value : 'supabase';

/**
 * GET /api/analytics/costs/breakdown
 *
 * Returns cost breakdown by organization, storage tier, and provider
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  // Get recordings for this organization only
  const { data: recordings, error: recordingsError } = await supabase
    .from('content')
    .select('storage_tier, storage_provider, file_size, org_id')
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
    const recordingOrgId = r.org_id;
    const tier = normalizeStorageTier(r.storage_tier);
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier];

    if (!acc[recordingOrgId]) {
      acc[recordingOrgId] = {
        name: recordingOrgId === orgId ? 'Current organization' : 'Unknown',
        cost: 0,
      };
    }
    acc[recordingOrgId].cost += cost;
    return acc;
  }, {} as Record<string, { name: string; cost: number }>);

  const totalCostAllOrgs = Object.values(orgCosts).reduce((sum, org) => sum + org.cost, 0);

  // Calculate costs by tier
  const tierCosts = recordings.reduce((acc, r) => {
    const tier = normalizeStorageTier(r.storage_tier);
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier];

    acc[tier] = (acc[tier] || 0) + cost;
    return acc;
  }, {} as Record<string, number>);

  // Calculate costs by provider
  const providerCosts = recordings.reduce((acc, r) => {
    const provider = normalizeStorageProvider(r.storage_provider);
    const tier = normalizeStorageTier(r.storage_tier);
    const sizeGB = (r.file_size || 0) / 1e9;
    const cost = sizeGB * TIER_PRICING[tier];

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
      const trend = await calculateTierTrend(normalizeStorageTier(tier));
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
      const normalizedProvider = normalizeStorageProvider(provider);
      const trend = await calculateProviderTrend(normalizedProvider);
      return {
        name: providerNames[normalizedProvider] || normalizedProvider,
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
async function calculateTierTrend(tier: StorageTier): Promise<number> {
  const supabase = supabaseAdmin;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get recordings in current period
  const { data: currentData } = await supabase
    .from('content')
    .select('file_size, storage_tier')
    .eq('storage_tier', tier)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  // Get recordings in previous period
  const { data: previousData } = await supabase
    .from('content')
    .select('file_size, storage_tier')
    .eq('storage_tier', tier)
    .gte('created_at', sixtyDaysAgo.toISOString())
    .lt('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  const currentCost = (currentData || []).reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier];
  }, 0);

  const previousCost = (previousData || []).reduce((sum, r) => {
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier];
  }, 0);

  if (previousCost === 0) return 0;

  return ((currentCost - previousCost) / previousCost) * 100;
}

/**
 * Calculate trend for specific provider
 */
async function calculateProviderTrend(provider: StorageProvider): Promise<number> {
  const supabase = supabaseAdmin;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get recordings in current period
  const { data: currentData } = await supabase
    .from('content')
    .select('file_size, storage_tier, storage_provider')
    .eq('storage_provider', provider)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  // Get recordings in previous period
  const { data: previousData } = await supabase
    .from('content')
    .select('file_size, storage_tier, storage_provider')
    .eq('storage_provider', provider)
    .gte('created_at', sixtyDaysAgo.toISOString())
    .lt('created_at', thirtyDaysAgo.toISOString())
    .is('deleted_at', null);

  const currentCost = (currentData || []).reduce((sum, r) => {
    const tier = normalizeStorageTier(r.storage_tier);
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier];
  }, 0);

  const previousCost = (previousData || []).reduce((sum, r) => {
    const tier = normalizeStorageTier(r.storage_tier);
    const sizeGB = (r.file_size || 0) / 1e9;
    return sum + sizeGB * TIER_PRICING[tier];
  }, 0);

  if (previousCost === 0) return 0;

  return ((currentCost - previousCost) / previousCost) * 100;
}
