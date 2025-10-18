/**
 * Processing Cost Analytics API
 *
 * Provides detailed cost analytics and insights for organization processing.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import {
  getOrganizationBudget,
  getProcessingCostAnalytics,
  optimizeProcessingQueue,
} from '@/lib/services/processing-decision-engine';

/**
 * GET /api/analytics/processing-costs
 *
 * Get processing cost analytics for the current organization.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const url = new URL(request.url);
  const includeQueue = url.searchParams.get('includeQueue') === 'true';

  try {
    // Get budget status
    const budget = await getOrganizationBudget(orgId);

    // Get cost analytics
    const analytics = await getProcessingCostAnalytics(orgId);

    // Optionally get queue optimization
    let queueOptimization;
    if (includeQueue) {
      queueOptimization = await optimizeProcessingQueue(orgId);
    }

    // Calculate projections
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysRemaining = Math.max(0, daysInMonth - todayDate);

    const avgCostPerDay = (analytics.costByMonth[0]?.cost || 0) / daysInMonth;
    const projectedMonthlySpend = budget.creditsUsed + avgCostPerDay * daysRemaining;
    const budgetUtilization = (budget.creditsUsed / budget.monthlyBudget) * 100;

    return successResponse({
      budget: {
        plan: budget.plan,
        monthlyLimit: budget.monthlyBudget,
        used: budget.creditsUsed,
        remaining: budget.creditsRemaining,
        utilization: Math.round(budgetUtilization),
        projectedMonthlySpend: Math.round(projectedMonthlySpend),
      },
      analytics: {
        totalCost: analytics.totalCost,
        avgCostPerRecording: analytics.avgCostPerRecording,
        costByJobType: analytics.costByJobType,
        costByMonth: analytics.costByMonth,
        topCostCategories: analytics.topCostCategories,
      },
      queueOptimization,
      recommendations: generateRecommendations(budget, analytics, budgetUtilization),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[processing-costs] Failed to fetch analytics:', error);
    throw error;
  }
});

/**
 * Generate cost optimization recommendations
 */
function generateRecommendations(
  budget: Awaited<ReturnType<typeof getOrganizationBudget>>,
  analytics: Awaited<ReturnType<typeof getProcessingCostAnalytics>>,
  budgetUtilization: number
): Array<{
  priority: 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  potentialSavings?: number;
}> {
  const recommendations: ReturnType<typeof generateRecommendations> = [];

  // Budget warnings
  if (budgetUtilization > 90) {
    recommendations.push({
      priority: 'high',
      category: 'budget',
      recommendation: 'Budget utilization is >90%. Consider upgrading to a higher tier or reducing processing quality settings.',
      potentialSavings: undefined,
    });
  } else if (budgetUtilization > 75) {
    recommendations.push({
      priority: 'medium',
      category: 'budget',
      recommendation: 'Budget utilization is >75%. Monitor usage closely or consider adjusting processing settings.',
      potentialSavings: undefined,
    });
  }

  // Cost optimization opportunities
  if (analytics.costByJobType.transcribe > analytics.totalCost * 0.6) {
    recommendations.push({
      priority: 'medium',
      category: 'transcription',
      recommendation: 'Transcription costs are high (>60% of total). Consider using lower-cost providers for non-critical content.',
      potentialSavings: Math.round(analytics.costByJobType.transcribe * 0.3),
    });
  }

  if (analytics.costByJobType.compress_video > analytics.totalCost * 0.3) {
    recommendations.push({
      priority: 'low',
      category: 'compression',
      recommendation: 'Compression costs are significant. Ensure optimal compression profiles are being used.',
      potentialSavings: Math.round(analytics.costByJobType.compress_video * 0.2),
    });
  }

  // Free tier specific
  if (budget.plan === 'free' && analytics.avgCostPerRecording > 1) {
    recommendations.push({
      priority: 'medium',
      category: 'plan',
      recommendation: `Average cost per recording ($${(analytics.avgCostPerRecording / 100).toFixed(2)}) is high for free tier. Consider upgrading to Pro for better value.`,
      potentialSavings: undefined,
    });
  }

  // Low utilization
  if (budgetUtilization < 25 && budget.plan === 'pro') {
    recommendations.push({
      priority: 'low',
      category: 'plan',
      recommendation: 'Budget utilization is low (<25%). You may be able to optimize costs with a different plan.',
      potentialSavings: undefined,
    });
  }

  return recommendations;
}
