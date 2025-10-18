/**
 * Action Plan API
 *
 * GET /api/analytics/recommendations/action-plan
 * - Get prioritized action plan with immediate, short-term, and long-term recommendations
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { getActionPlan } from '@/lib/services/optimization-recommendations';

/**
 * GET /api/analytics/recommendations/action-plan
 *
 * Get prioritized action plan
 *
 * @example
 * GET /api/analytics/recommendations/action-plan
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  try {
    const actionPlan = await getActionPlan(orgId);

    return successResponse({
      actionPlan,
      summary: {
        immediate: actionPlan.immediate.length,
        shortTerm: actionPlan.shortTerm.length,
        longTerm: actionPlan.longTerm.length,
        estimatedTotalSavings: actionPlan.estimatedTotalSavings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics Action Plan] Error:', error);
    throw errors.serverError(
      `Failed to generate action plan: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
