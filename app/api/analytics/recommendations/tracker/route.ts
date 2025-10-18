/**
 * Implementation Progress Tracker API
 *
 * GET /api/analytics/recommendations/tracker
 * - Track implementation progress of recommendations
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/recommendations/tracker
 *
 * Get implementation progress tracking data
 *
 * @example
 * GET /api/analytics/recommendations/tracker
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Fetch all recommendations for stats
  const { data: allRecommendations, error: allError } = await supabaseAdmin
    .from('recommendations')
    .select('*')
    .eq('organization_id', orgId);

  if (allError) {
    console.error('[Tracker API] Error fetching recommendations:', allError);
    throw new Error('Failed to fetch recommendations');
  }

  // Fetch in-progress recommendations
  const { data: inProgressItems, error: inProgressError } = await supabaseAdmin
    .from('recommendations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'in-progress')
    .order('started_at', { ascending: false });

  if (inProgressError) {
    console.error('[Tracker API] Error fetching in-progress items:', inProgressError);
    throw new Error('Failed to fetch in-progress recommendations');
  }

  // Fetch recent completions (last 10)
  const { data: completedItems, error: completedError } = await supabaseAdmin
    .from('recommendations')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10);

  if (completedError) {
    console.error('[Tracker API] Error fetching completed items:', completedError);
    throw new Error('Failed to fetch completed recommendations');
  }

  // Calculate stats
  const total = (allRecommendations || []).length;
  const completed = (allRecommendations || []).filter(r => r.status === 'completed').length;
  const inProgressCount = (allRecommendations || []).filter(r => r.status === 'in-progress').length;
  const pending = (allRecommendations || []).filter(r => r.status === 'pending').length;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  const totalSavingsRealized = (completedItems || [])
    .reduce((sum, item) => sum + (Number(item.actual_savings) || 0), 0);

  // Transform in-progress items
  const inProgress = (inProgressItems || []).map(item => ({
    id: item.id,
    title: item.title,
    startedAt: item.started_at,
    estimatedCompletion: item.estimated_completion,
    progress: item.progress || 0,
    estimatedSavings: Number(item.savings) || 0,
  }));

  // Transform recent completions
  const recentHistory = (completedItems || []).map(item => {
    // Calculate implementation time in days
    const startedAt = item.started_at ? new Date(item.started_at) : null;
    const completedAt = item.completed_at ? new Date(item.completed_at) : null;
    const implementationTime = startedAt && completedAt
      ? Math.round((completedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
      : item.implementation_days || 0;

    return {
      id: item.id,
      title: item.title,
      completedAt: item.completed_at,
      actualSavings: Number(item.actual_savings) || 0,
      implementationTime,
    };
  });

  return successResponse({
    stats: {
      total,
      completed,
      inProgress: inProgressCount,
      pending,
      totalSavingsRealized: Math.round(totalSavingsRealized * 100) / 100,
      completionRate: Math.round(completionRate * 10) / 10,
    },
    inProgress,
    recentHistory,
  });
});
