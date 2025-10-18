/**
 * Implement Recommendation API
 *
 * POST /api/analytics/recommendations/[id]/implement
 * - Mark a recommendation as in-progress
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, parseBody, errors } from '@/lib/utils/api';
import { recommendationImplementSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transformRecommendation } from '@/lib/utils/recommendations';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/analytics/recommendations/[id]/implement
 *
 * Mark recommendation as in-progress
 *
 * Request body:
 * - estimatedCompletionDays?: number (optional, default: 30)
 *
 * @example
 * POST /api/analytics/recommendations/abc-123/implement
 * { "estimatedCompletionDays": 14 }
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  await requireAuth();

  const { id: recommendationId } = await context.params;
  const body = await parseBody(request, recommendationImplementSchema);
  const { estimatedCompletionDays = 30 } = body;

  // Calculate estimated completion date
  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + estimatedCompletionDays);

  // Update recommendation status to in-progress
  const { data: recommendation, error } = await supabaseAdmin
    .from('recommendations')
    .update({
      status: 'in-progress',
      started_at: new Date().toISOString(),
      estimated_completion: estimatedCompletion.toISOString(),
      progress: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId)
    .eq('status', 'pending') // Only allow if currently pending
    .select()
    .single();

  if (error) {
    console.error('[Implement Recommendation] Error:', error);

    if (error.code === 'PGRST116') {
      throw errors.notFound('Recommendation', undefined);
    }

    throw new Error('Failed to implement recommendation. It may already be in progress or completed.');
  }

  if (!recommendation) {
    throw errors.notFound('Recommendation', undefined);
  }

  return successResponse({
    recommendation: transformRecommendation(recommendation),
    message: 'Recommendation marked as in-progress',
  });
});
