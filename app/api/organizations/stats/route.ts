import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/organizations/stats
 * Get organization statistics and metrics (admin+ only)
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const includeQuotas = searchParams.get('include_quotas') !== 'false';
  const includeUsage = searchParams.get('include_usage') !== 'false';

  try {
    // Fetch organization details for quotas
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('plan, max_users, max_storage_gb, features')
      .eq('id', orgId)
      .is('deleted_at', null)
      .single();

    if (orgError || !organization) {
      console.error('[GET /api/organizations/stats] Error fetching organization:', orgError);
      return errors.notFound('Organization');
    }

    // Count total members (active only)
    const { count: totalMembers, error: membersError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (membersError) {
      console.error('[GET /api/organizations/stats] Error counting members:', membersError);
      return errors.internalError();
    }

    // OPTIMIZED: Use database aggregation for recordings count and storage calculation
    // This replaces the N+1 query pattern that was fetching all recordings
    const { data: recordingStats, error: recordingsError } = await supabaseAdmin
      .rpc('get_org_recording_stats', { p_org_id: orgId });

    let totalCount = 0;
    let storageUsedBytes = 0;
    let storageUsedGb = 0;

    if (recordingsError) {
      console.error('[GET /api/organizations/stats] Error fetching recording stats:', recordingsError);
      // Fallback to basic count if RPC doesn't exist yet
      const { count: totalRecordings } = await supabaseAdmin
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null);

      totalCount = totalRecordings || 0;
      storageUsedBytes = 0;
      storageUsedGb = 0;
    } else {
      totalCount = recordingStats?.recording_count || 0;
      storageUsedBytes = recordingStats?.total_storage_bytes || 0;
      storageUsedGb = parseFloat((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
    }

    // Count active sessions (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeSessions, error: sessionsError } = await supabaseAdmin
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('last_active_at', twentyFourHoursAgo)
      .is('revoked_at', null);

    if (sessionsError) {
      console.error('[GET /api/organizations/stats] Error counting sessions:', sessionsError);
      // Don't fail if sessions table doesn't exist - it's optional
    }

    // Count departments
    const { count: departmentCount, error: departmentsError } = await supabaseAdmin
      .from('departments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);

    if (departmentsError) {
      console.error('[GET /api/organizations/stats] Error counting departments:', departmentsError);
      // Don't fail if departments table doesn't exist - it's optional
    }

    // Build response
    const stats: any = {
      members: {
        total: totalMembers || 0,
        quota: includeQuotas ? organization.max_users : undefined,
        percentage: includeQuotas
          ? Math.round(((totalMembers || 0) / organization.max_users) * 100)
          : undefined,
      },
      recordings: {
        total: totalCount || 0,
      },
      storage: {
        used_gb: storageUsedGb,
        quota_gb: includeQuotas ? organization.max_storage_gb : undefined,
        percentage: includeQuotas
          ? Math.round((storageUsedGb / organization.max_storage_gb) * 100)
          : undefined,
      },
      departments: {
        total: departmentCount || 0,
      },
      activity: {
        active_sessions_24h: activeSessions || 0,
      },
    };

    // Include usage data if requested
    if (includeUsage) {
      // Get current period usage counters
      // Format as YYYY-MM-01 for proper date type compatibility
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: usageData, error: usageError } = await supabaseAdmin
        .from('usage_counters')
        .select('*')
        .eq('org_id', orgId)
        .eq('period', currentPeriod)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('[GET /api/organizations/stats] Error fetching usage:', usageError);
      }

      stats.usage = {
        period: currentPeriod,
        minutes_transcribed: usageData?.minutes_transcribed || 0,
        tokens_in: usageData?.tokens_in || 0,
        tokens_out: usageData?.tokens_out || 0,
        queries_count: usageData?.queries_count || 0,
        recordings_count: usageData?.recordings_count || 0,
      };
    }

    // Include quota information
    if (includeQuotas) {
      stats.quotas = {
        plan: organization.plan,
        max_users: organization.max_users,
        max_storage_gb: organization.max_storage_gb,
        features: organization.features,
      };
    }

    return successResponse(stats);
  } catch (error) {
    console.error('[GET /api/organizations/stats] Unexpected error:', error);
    return errors.internalError();
  }
});
