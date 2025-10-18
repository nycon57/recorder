/**
 * Cost Allocation Export API Endpoint
 *
 * POST /api/analytics/costs/allocation/export
 * Exports cost allocation report as CSV file.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireSystemAdmin } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  TIER_PRICING,
  determineDominantTier,
  calculateTrend,
  formatBytes,
} from '@/lib/analytics/cost-calculations';

/**
 * POST /api/analytics/costs/allocation/export
 *
 * Exports cost allocation data as CSV
 * Requires system admin privileges
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // This is a system-wide endpoint, requires system admin
  await requireSystemAdmin();

  const supabase = supabaseAdmin;

  // Get all organizations with their recordings (same logic as GET /allocation)
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  if (!organizations || organizations.length === 0) {
    // Return empty CSV
    const csv = 'Organization,Total Cost,Storage (GB),Tier,Users,Recordings,Cost/User,Cost/GB,Trend %\n';
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="cost-allocation-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // Get all recordings with organization info
  const { data: recordings } = await supabase
    .from('recordings')
    .select('org_id, file_size, storage_tier')
    .is('deleted_at', null);

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('org_id')
    .is('deleted_at', null);

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
        organizationName: org.name,
        totalCost: totalCost.toFixed(2),
        storage: (totalStorage / 1e9).toFixed(2), // Convert to GB
        tier,
        userCount,
        recordingCount,
        costPerUser: costPerUser.toFixed(2),
        costPerGB: costPerGB.toFixed(4),
        trend: trend.toFixed(1),
      };
    })
  );

  // Sort by total cost (descending)
  allocations.sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost));

  // Generate CSV
  const headers = [
    'Organization',
    'Total Cost',
    'Storage (GB)',
    'Tier',
    'Users',
    'Recordings',
    'Cost/User',
    'Cost/GB',
    'Trend %',
  ];

  const rows = allocations.map((a) => [
    escapeCSV(a.organizationName),
    a.totalCost,
    a.storage,
    a.tier,
    a.userCount,
    a.recordingCount,
    a.costPerUser,
    a.costPerGB,
    a.trend,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="cost-allocation-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
});

/**
 * Escape CSV values that contain commas, quotes, or newlines
 */
function escapeCSV(value: string | number): string {
  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
