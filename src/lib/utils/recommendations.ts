/**
 * Recommendation Transformation Utilities
 *
 * Shared utilities for transforming recommendation records from database format to API response format.
 */

/**
 * Transform a recommendation record from snake_case database format to camelCase API format
 * @param recommendation - Raw recommendation record from database
 * @returns Transformed recommendation object with camelCase properties
 */
export function transformRecommendation(recommendation: any) {
  return {
    id: recommendation.id,
    organizationId: recommendation.organization_id,
    title: recommendation.title,
    description: recommendation.description,
    implementation: recommendation.implementation,
    impact: recommendation.impact,
    effort: recommendation.effort,
    savings: Number(recommendation.savings) || 0,
    timeframe: recommendation.timeframe,
    status: recommendation.status,
    startedAt: recommendation.started_at,
    completedAt: recommendation.completed_at,
    estimatedCompletion: recommendation.estimated_completion,
    progress: recommendation.progress,
    actualSavings: recommendation.actual_savings ? Number(recommendation.actual_savings) || 0 : null,
    implementationDays: recommendation.implementation_days,
    createdAt: recommendation.created_at,
    updatedAt: recommendation.updated_at,
  };
}
