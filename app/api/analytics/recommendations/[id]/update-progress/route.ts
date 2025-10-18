/**
 * Update Recommendation Progress API
 *
 * POST /api/analytics/recommendations/[id]/update-progress
 * - Update progress percentage for in-progress recommendation
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, parseBody, errors } from '@/lib/utils/api';
import { recommendationProgressSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transformRecommendation } from '@/lib/utils/recommendations';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/analytics/recommendations/[id]/update-progress
 *
 * Update recommendation progress percentage
 *
 * Request body:
 * - progress: number (0-100)
 *
 * @example
 * POST /api/analytics/recommendations/abc-123/update-progress
 * { "progress": 75 }
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  await requireAuth();

  const { id: recommendationId } = await context.params;
  const body = await parseBody(request, recommendationProgressSchema);
  const { progress } = body;

  // Update recommendation progress
  const { data: recommendation, error } = await supabaseAdmin
    .from('recommendations')
    .update({
      progress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId)
    .eq('status', 'in-progress') // Only allow if in progress
    .select()
    .single();

  if (error) {
    console.error('[Update Progress] Error:', error);

    if (error.code === 'PGRST116') {
      throw errors.notFound('Recommendation', undefined);
    }

    throw new Error('Failed to update progress');
  }

  if (!recommendation) {
    throw new Error('Recommendation not found or not in progress');
  }

  return successResponse({
    recommendation: transformRecommendation(recommendation),
    message: `Progress updated to ${progress}%`,
  });
});
