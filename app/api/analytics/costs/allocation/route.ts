/**
 * Cost Allocation API Endpoint
 *
 * GET /api/analytics/costs/allocation
 * Returns per-organization cost allocation report with detailed metrics.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireSystemAdmin, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  TIER_PRICING,
  determineDominantTier,
  calculateTrend,
} from '@/lib/analytics/cost-calculations';

/**
 * GET /api/analytics/costs/allocation
 *
 * Returns detailed cost allocation per organization
 * Requires system admin privileges
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // This is a system-wide endpoint, requires system admin
  await requireSystemAdmin();

  const supabase = supabaseAdmin;

  // Get all organizations with their recordings
  const { data: organizations, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  if (orgsError) {
    console.error('[GET /api/analytics/costs/allocation] Error fetching organizations:', orgsError);
    throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
  }

  if (!organizations || organizations.length === 0) {
    return successResponse({
      allocations: [],
      totals: {
        totalCost: 0,
        totalStorage: 0,
        totalUsers: 0,
        totalRecordings: 0,
      },
    });
  }

  // Get all recordings with organization info
  const { data: recordings, error: recordingsError } = await supabase
    .from('content')
    .select('org_id, file_size, storage_tier')
    .is('deleted_at', null);

  if (recordingsError) {
    console.error('[GET /api/analytics/costs/allocation] Error fetching recordings:', recordingsError);
    throw new Error(`Failed to fetch recordings: ${recordingsError.message}`);
  }

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('org_id')
    .is('deleted_at', null);

  if (usersError) {
    console.error('[GET /api/analytics/costs/allocation] Error fetching users:', usersError);
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  // Calculate metrics for each organization
  const allocations = await Promise.all(
    organizations.map(async (org) => {
      // Get organization recordings
      const orgRecordings = recordings?.filter((r) => r.org_id === org.id) || [];

      // Calculate total storage and cost
      let totalStorage = 0;
      let totalCost = 0;

      orgRecordings.forEach((r) => {
        const sizeBytes = r.file_size || 0;
        const tier = (r.storage_tier as 'hot' | 'warm' | 'cold' | 'glacier') || 'hot';
        const sizeGB = sizeBytes / 1e9;

        totalStorage += sizeBytes;
        totalCost += sizeGB * TIER_PRICING[tier];
      });

      // Count users in organization
      const userCount = users?.filter((u) => u.org_id === org.id).length || 0;

      // Get recording count
      const recordingCount = orgRecordings.length;

      // Calculate per-user and per-GB metrics
      const costPerUser = userCount > 0 ? totalCost / userCount : 0;
      const costPerGB = totalStorage > 0 ? totalCost / (totalStorage / 1e9) : 0;

      // Determine dominant tier
      const tier = await determineDominantTier(org.id);

      // Calculate trend (30-day)
      const trend = await calculateTrend(org.id, 30);

      return {
        organizationId: org.id,
        organizationName: org.name,
        totalCost: parseFloat(totalCost.toFixed(2)),
        storage: totalStorage,
        tier,
        userCount,
        recordingCount,
        costPerUser: parseFloat(costPerUser.toFixed(2)),
        costPerGB: parseFloat(costPerGB.toFixed(4)),
        trend: parseFloat(trend.toFixed(1)),
      };
    })
  );

  // Calculate totals
  const totals = {
    totalCost: parseFloat(allocations.reduce((sum, a) => sum + a.totalCost, 0).toFixed(2)),
    totalStorage: allocations.reduce((sum, a) => sum + a.storage, 0),
    totalUsers: allocations.reduce((sum, a) => sum + a.userCount, 0),
    totalRecordings: allocations.reduce((sum, a) => sum + a.recordingCount, 0),
  };

  // Sort by total cost (descending)
  allocations.sort((a, b) => b.totalCost - a.totalCost);

  return successResponse({
    allocations,
    totals,
  });
});
