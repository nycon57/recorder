import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/plan
 * Fetch the active onboarding plan for the current user.
 * Returns null data (not 404) when no plan exists.
 */
export const GET = apiHandler(async () => {
  const { userId, orgId } = await requireOrg();

  const { data: plan, error } = await supabaseAdmin
    .from('agent_onboarding_plans')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('plan_status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[onboarding/plan] Error fetching plan:', error);
    return errors.internalError();
  }

  return successResponse(plan);
});

/**
 * POST /api/onboarding/plan
 * Admin-only: trigger onboarding plan generation for a specific user.
 *
 * Body: { targetUserId: string, userName?: string, userRole?: string }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const body = await request.json();
  const { targetUserId, userName, userRole } = body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return errors.badRequest('targetUserId is required');
  }

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      type: 'generate_onboarding_plan',
      status: 'pending',
      payload: {
        orgId,
        userId: targetUserId,
        userName: userName ?? null,
        userRole: userRole ?? null,
      },
      run_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[onboarding/plan] Error creating job:', error);
    return errors.internalError();
  }

  return successResponse({ jobId: job.id, status: 'queued' }, undefined, 201);
});
