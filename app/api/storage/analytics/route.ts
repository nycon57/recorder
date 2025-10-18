/**
 * Storage Analytics API
 *
 * Provides storage usage, cost analysis, and tier distribution for organizations.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { getMigrationStats } from '@/lib/workers/handlers/migrate-storage-tier';

/**
 * GET /api/storage/analytics
 *
 * Get storage analytics for the current organization.
 * Includes tier distribution, cost breakdown, and migration statistics.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = createClient();

  try {
    // 1. Get storage costs by tier using database function
    const { data: costsByTier, error: costsError } = await supabase.rpc(
      'calculate_storage_costs_by_tier',
      {
        p_org_id: orgId,
      }
    );

    if (costsError) {
      console.error('[storage-analytics] Error fetching costs by tier:', costsError);
    }

    // 2. Get migration savings estimate using database function
    const { data: savingsEstimate, error: savingsError } = await supabase.rpc(
      'estimate_tier_migration_savings',
      {
        p_org_id: orgId,
      }
    );

    if (savingsError) {
      console.error('[storage-analytics] Error fetching savings estimate:', savingsError);
    }

    // 3. Get migration statistics
    const migrationStats = await getMigrationStats(orgId);

    // 4. Get recent migration history
    const { data: recentMigrations, error: migrationsError } = await supabase
      .from('storage_migrations')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (migrationsError) {
      console.error('[storage-analytics] Error fetching recent migrations:', migrationsError);
    }

    // 5. Get storage tier analytics view
    const { data: tierAnalytics, error: tierError } = await supabase
      .from('storage_tier_analytics')
      .select('*')
      .eq('org_id', orgId);

    if (tierError) {
      console.error('[storage-analytics] Error fetching tier analytics:', tierError);
    }

    return successResponse({
      costsByTier: costsByTier || [],
      savingsEstimate: savingsEstimate?.[0] || null,
      migrationStats,
      recentMigrations: recentMigrations || [],
      tierAnalytics: tierAnalytics || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[storage-analytics] Failed to fetch analytics:', error);
    throw error;
  }
});
