/**
 * Admin Quota Management API
 *
 * Manage organization quotas:
 * - List all organizations with quota usage
 * - Update quota limits for organizations
 * - Filter organizations near quota limits
 * - View quota usage trends
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { adminUpdateQuotaSchema } from '@/lib/validations/api';

/**
 * GET /api/admin/quotas
 * List organizations with quota usage
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const planTier = searchParams.get('planTier') || null;
  const nearLimit = searchParams.get('nearLimit') === 'true';
  const limitThreshold = parseFloat(
    searchParams.get('limitThreshold') || '0.9'
  );
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Build query
  let query = supabaseAdmin
    .from('org_quotas')
    .select(
      `
      *,
      organizations (
        id,
        name,
        plan,
        created_at
      )
    `,
      { count: 'exact' }
    );

  // Filter by plan tier
  if (planTier) {
    query = query.eq('plan_tier', planTier);
  }

  // Execute query
  const { data: quotas, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[AdminQuotas] Query error:', error);
    throw new Error('Failed to fetch quotas');
  }

  // Process results
  let results = (quotas || []).map((q: any) => {
    const searchUsage =
      q.searches_per_month > 0 ? q.searches_used / q.searches_per_month : 0;
    const storageUsage = q.storage_gb > 0 ? q.storage_used_gb / q.storage_gb : 0;
    const recordingUsage =
      q.recordings_per_month > 0
        ? q.recordings_used / q.recordings_per_month
        : 0;
    const aiUsage =
      q.ai_requests_per_month > 0
        ? q.ai_requests_used / q.ai_requests_per_month
        : 0;

    return {
      orgId: q.org_id,
      orgName: q.organizations?.name || 'Unknown',
      orgPlan: q.organizations?.plan || q.plan_tier,
      planTier: q.plan_tier,
      quotas: {
        searches: {
          used: q.searches_used,
          limit: q.searches_per_month,
          usage: Math.round(searchUsage * 100),
        },
        storage: {
          used: Number(q.storage_used_gb).toFixed(2),
          limit: q.storage_gb,
          usage: Math.round(storageUsage * 100),
        },
        recordings: {
          used: q.recordings_used,
          limit: q.recordings_per_month,
          usage: Math.round(recordingUsage * 100),
        },
        aiRequests: {
          used: q.ai_requests_used,
          limit: q.ai_requests_per_month,
          usage: Math.round(aiUsage * 100),
        },
        connectors: {
          used: q.connectors_used,
          limit: q.connectors_allowed,
          usage:
            q.connectors_allowed > 0
              ? Math.round((q.connectors_used / q.connectors_allowed) * 100)
              : 0,
        },
      },
      rateLimits: {
        api: q.api_rate_limit,
        search: q.search_rate_limit,
      },
      quotaResetAt: q.quota_reset_at,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    };
  });

  // Filter for organizations near limit
  if (nearLimit) {
    results = results.filter((r) => {
      return (
        r.quotas.searches.usage >= limitThreshold * 100 ||
        r.quotas.storage.usage >= limitThreshold * 100 ||
        r.quotas.recordings.usage >= limitThreshold * 100 ||
        r.quotas.aiRequests.usage >= limitThreshold * 100
      );
    });
  }

  return successResponse({
    organizations: results,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: offset + limit < (count || 0),
    },
  });
});

/**
 * POST /api/admin/quotas
 * Update organization quota limits
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const body = await parseBody(request, adminUpdateQuotaSchema);

  const {
    orgId,
    planTier,
    searchesPerMonth,
    storageGb,
    recordingsPerMonth,
    aiRequestsPerMonth,
    connectorsAllowed,
    apiRateLimit,
    searchRateLimit,
  } = body;

  // Build update object
  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (planTier !== undefined) updates.plan_tier = planTier;
  if (searchesPerMonth !== undefined)
    updates.searches_per_month = searchesPerMonth;
  if (storageGb !== undefined) updates.storage_gb = storageGb;
  if (recordingsPerMonth !== undefined)
    updates.recordings_per_month = recordingsPerMonth;
  if (aiRequestsPerMonth !== undefined)
    updates.ai_requests_per_month = aiRequestsPerMonth;
  if (connectorsAllowed !== undefined)
    updates.connectors_allowed = connectorsAllowed;
  if (apiRateLimit !== undefined) updates.api_rate_limit = apiRateLimit;
  if (searchRateLimit !== undefined)
    updates.search_rate_limit = searchRateLimit;

  // Update quota
  const { data, error } = await supabaseAdmin
    .from('org_quotas')
    .update(updates)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) {
    console.error('[AdminQuotas] Update error:', error);
    throw new Error('Failed to update quota');
  }

  return successResponse({
    message: 'Quota updated successfully',
    quota: data,
  });
});

/**
 * PUT /api/admin/quotas/reset
 * Reset usage counters for an organization
 */
export const PUT = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  await requireAdmin();

  const { orgId, quotaType } = await request.json();

  if (!orgId) {
    throw new Error('Organization ID is required');
  }

  // Build reset object based on quota type
  const resets: any = {
    updated_at: new Date().toISOString(),
  };

  if (!quotaType || quotaType === 'all') {
    resets.searches_used = 0;
    resets.recordings_used = 0;
    resets.ai_requests_used = 0;
  } else if (quotaType === 'search') {
    resets.searches_used = 0;
  } else if (quotaType === 'recording') {
    resets.recordings_used = 0;
  } else if (quotaType === 'ai') {
    resets.ai_requests_used = 0;
  } else {
    throw new Error('Invalid quota type');
  }

  // Reset usage
  const { data, error } = await supabaseAdmin
    .from('org_quotas')
    .update(resets)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) {
    console.error('[AdminQuotas] Reset error:', error);
    throw new Error('Failed to reset quota');
  }

  return successResponse({
    message: `Quota reset successfully for ${quotaType || 'all'} types`,
    quota: data,
  });
});
