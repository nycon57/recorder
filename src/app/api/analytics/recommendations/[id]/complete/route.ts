/**
 * Complete Recommendation API
 *
 * POST /api/analytics/recommendations/[id]/complete
 * - Mark a recommendation as completed
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, parseBody, errors } from '@/lib/utils/api';
import { recommendationCompleteSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { transformRecommendation } from '@/lib/utils/recommendations';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/analytics/recommendations/[id]/complete
 *
 * Mark recommendation as completed
 *
 * Request body:
 * - actualSavings?: number (optional, defaults to estimated savings)
 *
 * @example
 * POST /api/analytics/recommendations/abc-123/complete
 * { "actualSavings": 250 }
 */
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  await requireAuth();

  const { id: recommendationId } = await context.params;
  const body = await parseBody(request, recommendationCompleteSchema);
  // Type assertion for parsed body
  const { actualSavings } = body as { actualSavings: number };

  // First, get the current recommendation to calculate implementation days
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('recommendations')
    .select('started_at, savings, status')
    .eq('id', recommendationId)
    .single();

  if (fetchError) {
    console.error('[Complete Recommendation] Error fetching current data:', fetchError);

    if (fetchError.code === 'PGRST116') {
      throw errors.notFound('Recommendation', undefined);
    }

    throw new Error('Failed to fetch recommendation');
  }

  if (!current) {
    throw errors.notFound('Recommendation', undefined);
  }

  if (current.status !== 'in-progress') {
    throw new Error('Recommendation must be in-progress to be completed');
  }

  // Calculate implementation days
  const implementationDays = current.started_at
    ? Math.round((Date.now() - new Date(current.started_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Update recommendation to completed
  const { data: recommendation, error: updateError } = await supabaseAdmin
    .from('recommendations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      implementation_days: implementationDays,
      actual_savings: actualSavings ?? Number(current.savings), // Use actual or estimated
      progress: 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendationId)
    .eq('status', 'in-progress') // Only allow if in progress
    .select()
    .single();

  if (updateError) {
    console.error('[Complete Recommendation] Error updating:', updateError);
    throw new Error('Failed to complete recommendation');
  }

  if (!recommendation) {
    throw new Error('Recommendation could not be completed. It may not be in progress.');
  }

  return successResponse({
    recommendation: transformRecommendation(recommendation),
    message: 'Recommendation marked as completed',
  });
});
