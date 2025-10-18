/**
 * Optimization Recommendations API
 *
 * GET /api/analytics/recommendations
 * - Get smart optimization recommendations for the organization
 *
 * GET /api/analytics/recommendations/action-plan
 * - Get prioritized action plan with immediate, short-term, and long-term recommendations
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import {
  generateSmartRecommendations,
  getActionPlan,
  type RecommendationCategory,
} from '@/lib/services/optimization-recommendations';

/**
 * GET /api/analytics/recommendations
 *
 * Get smart optimization recommendations
 *
 * Query parameters:
 * - category?: 'cost_optimization' | 'performance' | 'reliability' | 'security' | 'compliance'
 * - limit?: number (default: 10)
 *
 * @example
 * GET /api/analytics/recommendations?category=cost_optimization&limit=5
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as RecommendationCategory | null;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // Validate limit
  if (limit < 1 || limit > 50) {
    throw errors.badRequest('limit must be between 1 and 50');
  }

  // Validate category
  const validCategories: RecommendationCategory[] = [
    'cost_optimization',
    'performance',
    'reliability',
    'security',
    'compliance',
  ];

  if (category && !validCategories.includes(category)) {
    throw errors.badRequest(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  try {
    const recommendations = await generateSmartRecommendations(
      orgId,
      category || undefined
    );

    // Apply limit
    const limitedRecommendations = recommendations.slice(0, limit);

    // Calculate total potential savings
    const totalPotentialSavings = recommendations.reduce(
      (sum, rec) => sum + rec.estimatedAnnualSavings,
      0
    );

    return successResponse({
      recommendations: limitedRecommendations,
      total: recommendations.length,
      totalPotentialSavings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Analytics Recommendations] Error:', error);
    throw errors.serverError(
      `Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
