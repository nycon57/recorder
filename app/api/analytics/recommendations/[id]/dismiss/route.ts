/**
 * Dismiss Recommendation API
 *
 * POST /api/analytics/recommendations/[id]/dismiss
 * - Dismiss a recommendation
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transformRecommendation } from '@/lib/utils/recommendations';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/analytics/recommendations/[id]/dismiss
 *
 * Dismiss recommendation
 *
 * @example
 * POST /api/analytics/recommendations/abc-123/dismiss
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  await requireAuth();

  const { id: recommendationId } = await context.params;

  // Update recommendation to dismissed
  const { data: recommendation, error } = await supabaseAdmin
    .from('recommendations')
    .update({
      status: 'dismissed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId)
    .in('status', ['pending', 'in-progress']) // Can only dismiss if not completed
    .select()
    .single();

  if (error) {
    console.error('[Dismiss Recommendation] Error:', error);

    if (error.code === 'PGRST116') {
      throw errors.notFound('Recommendation', undefined);
    }

    throw new Error('Failed to dismiss recommendation');
  }

  return successResponse({
    recommendation: transformRecommendation(recommendation),
    message: 'Recommendation dismissed',
  });
});
