/**
 * Action Plan API
 *
 * GET /api/analytics/recommendations/action-plan
 * - Get prioritized action plan grouped by timeframe
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/recommendations/action-plan
 *
 * Get prioritized action plan grouped by timeframe
 *
 * @example
 * GET /api/analytics/recommendations/action-plan
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Fetch all active recommendations (pending or in-progress) for this user's organization
  const { data: recommendations, error } = await supabaseAdmin
    .from('recommendations')
    .select('*')
    .eq('organization_id', orgId)
    .in('status', ['pending', 'in-progress'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Action Plan API] Error fetching recommendations:', error);
    throw new Error('Failed to fetch action plan');
  }

  // Group by timeframe
  const immediate = (recommendations || []).filter(r => r.timeframe === 'immediate');
  const shortTerm = (recommendations || []).filter(r => r.timeframe === 'short-term');
  const longTerm = (recommendations || []).filter(r => r.timeframe === 'long-term');

  // Define types for recommendation fields
  type Impact = 'high' | 'medium' | 'low';
  type Effort = 'low' | 'medium' | 'high';
  type Timeframe = 'immediate' | 'short-term' | 'long-term';

  interface Recommendation {
    impact: Impact | string;
    effort: Effort | string;
    timeframe: Timeframe | string;
    [key: string]: any;
  }

  // Sort each group by impact (high first) then effort (low first)
  const sortByPriority = (items: Recommendation[]): Recommendation[] => {
    // Create a copy to avoid mutating the input
    return [...items].sort((a, b) => {
      const impactOrder: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
      const defaultImpact = 2; // Treat unknown impact as lowest priority

      const aImpact = impactOrder[a.impact as Impact] ?? defaultImpact;
      const bImpact = impactOrder[b.impact as Impact] ?? defaultImpact;
      const impactDiff = aImpact - bImpact;

      if (impactDiff !== 0) return impactDiff;

      const effortOrder: Record<Effort, number> = { low: 0, medium: 1, high: 2 };
      const defaultEffort = 2; // Treat unknown effort as highest cost

      const aEffort = effortOrder[a.effort as Effort] ?? defaultEffort;
      const bEffort = effortOrder[b.effort as Effort] ?? defaultEffort;
      return aEffort - bEffort;
    });
  };

  const sortedImmediate = sortByPriority([...immediate]);
  const sortedShortTerm = sortByPriority([...shortTerm]);
  const sortedLongTerm = sortByPriority([...longTerm]);

  // Transform items with safe number parsing
  const transformItems = (items: Recommendation[], limit?: number) => {
    const itemsToTransform = limit ? items.slice(0, limit) : items;
    return itemsToTransform.map(item => {
      // Safely parse savings - check if finite, default to 0 if NaN/Infinite
      const parsedSavings = parseFloat(String(item.savings));
      const safeSavings = isFinite(parsedSavings) ? parsedSavings : 0;

      return {
        id: item.id,
        title: item.title,
        impact: item.impact,
        effort: item.effort,
        savings: safeSavings,
        status: item.status,
        description: item.description,
      };
    });
  };

  // Helper to safely sum savings
  const safeSumSavings = (items: Recommendation[]) => {
    return items.reduce((sum, r) => {
      const parsed = parseFloat(String(r.savings));
      const safe = isFinite(parsed) ? parsed : 0;
      return sum + safe;
    }, 0);
  };

  // Build action plan
  const actionPlan = {
    immediate: {
      count: sortedImmediate.length,
      highImpactCount: sortedImmediate.filter(r => r.impact === 'high').length,
      totalSavings: safeSumSavings(sortedImmediate),
      items: transformItems(sortedImmediate, 3), // Top 3
    },
    shortTerm: {
      count: sortedShortTerm.length,
      highImpactCount: sortedShortTerm.filter(r => r.impact === 'high').length,
      totalSavings: safeSumSavings(sortedShortTerm),
      items: transformItems(sortedShortTerm, 3), // Top 3
    },
    longTerm: {
      count: sortedLongTerm.length,
      highImpactCount: sortedLongTerm.filter(r => r.impact === 'high').length,
      totalSavings: safeSumSavings(sortedLongTerm),
      items: transformItems(sortedLongTerm, 3), // Top 3
    },
  };

  // Calculate total potential savings across all timeframes
  const totalPotentialSavings =
    actionPlan.immediate.totalSavings +
    actionPlan.shortTerm.totalSavings +
    actionPlan.longTerm.totalSavings;

  // Get top 5 high-impact items across all timeframes for priority actions
  const allHighImpact = (recommendations || [])
    .filter(r => r.impact === 'high')
    .sort((a, b) => {
      // Sort by timeframe priority first (immediate > short-term > long-term)
      const timeframeOrder = { immediate: 0, 'short-term': 1, 'long-term': 2 };
      const timeframeDiff = timeframeOrder[a.timeframe as keyof typeof timeframeOrder] - timeframeOrder[b.timeframe as keyof typeof timeframeOrder];

      if (timeframeDiff !== 0) return timeframeDiff;

      // Then by effort (low first)
      const effortOrder = { low: 0, medium: 1, high: 2 };
      return effortOrder[a.effort as keyof typeof effortOrder] - effortOrder[b.effort as keyof typeof effortOrder];
    })
    .slice(0, 5);

  const priorityActions = transformItems(allHighImpact);

  return successResponse({
    immediate: actionPlan.immediate,
    shortTerm: actionPlan.shortTerm,
    longTerm: actionPlan.longTerm,
    totalPotentialSavings,
    priorityActions,
  });
});
