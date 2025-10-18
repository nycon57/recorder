/**
 * Defer Recommendation API
 *
 * POST /api/analytics/recommendations/[id]/defer
 * - Defer a recommendation (revert to pending status)
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transformRecommendation } from '@/lib/utils/recommendations';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/analytics/recommendations/[id]/defer
 *
 * Defer recommendation (revert to pending)
 *
 * @example
 * POST /api/analytics/recommendations/abc-123/defer
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const orgContext = await requireOrg();

  const { id: recommendationId } = await context.params;

  // Update recommendation back to pending, with organization ownership check
  const { data: recommendation, error } = await supabaseAdmin
    .from('recommendations')
    .update({
      status: 'pending',
      started_at: null,
      estimated_completion: null,
      progress: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId)
    .eq('organization_id', orgContext.orgId) // Only update if belongs to user's org
    .eq('status', 'in-progress') // Only allow if in progress
    .select()
    .single();

  if (error) {
    console.error('[Defer Recommendation] Error:', error);

    if (error.code === 'PGRST116') {
      throw errors.notFound('Recommendation', undefined);
    }

    throw new Error('Failed to defer recommendation');
  }

  if (!recommendation) {
    throw errors.forbidden();
  }

  return successResponse({
    recommendation: transformRecommendation(recommendation),
    message: 'Recommendation deferred to pending status',
  });
});
