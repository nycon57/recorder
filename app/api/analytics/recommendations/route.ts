/**
 * Optimization Recommendations API
 *
 * GET /api/analytics/recommendations
 * - List optimization recommendations with filtering and statistics
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, parseSearchParams } from '@/lib/utils/api';
import { recommendationsQuerySchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/recommendations
 *
 * Get optimization recommendations with filtering
 *
 * Query parameters:
 * - status?: 'pending' | 'in-progress' | 'completed' | 'dismissed'
 * - impact?: 'high' | 'medium' | 'low'
 * - timeframe?: 'immediate' | 'short-term' | 'long-term'
 * - limit?: number (default: 50, max: 100)
 *
 * @example
 * GET /api/analytics/recommendations?status=pending&impact=high&limit=10
 */
export const GET = apiHandler(async (request: NextRequest) => {
  await requireAuth();

  const params = parseSearchParams(request, recommendationsQuerySchema);
  const { status, impact, timeframe, limit } = params;

  // Build query with filters
  let query = supabaseAdmin
    .from('recommendations')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply status filter
  if (status) {
    query = query.eq('status', status);
  } else {
    // By default, exclude dismissed recommendations
    query = query.neq('status', 'dismissed');
  }

  // Apply impact filter
  if (impact) {
    query = query.eq('impact', impact);
  }

  // Apply timeframe filter
  if (timeframe) {
    query = query.eq('timeframe', timeframe);
  }

  // Apply limit
  query = query.limit(limit);

  const { data: recommendations, error: recommendationsError } = await query;

  if (recommendationsError) {
    console.error('[Recommendations API] Error fetching recommendations:', recommendationsError);
    throw new Error('Failed to fetch recommendations');
  }

  // Fetch statistics using targeted aggregate queries
  // Run all count queries in parallel
  const [
    totalResult,
    pendingResult,
    inProgressResult,
    completedResult,
    dismissedResult,
    highImpactResult,
    mediumImpactResult,
    lowImpactResult,
  ] = await Promise.all([
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('status', 'in-progress'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('status', 'dismissed'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('impact', 'high'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('impact', 'medium'),
    supabaseAdmin.from('recommendations').select('id', { count: 'exact', head: true }).eq('impact', 'low'),
  ]);

  // Fetch only savings fields for pending/in-progress and completed recommendations
  const [potentialSavingsData, actualSavingsData] = await Promise.all([
    supabaseAdmin
      .from('recommendations')
      .select('savings')
      .in('status', ['pending', 'in-progress']),
    supabaseAdmin
      .from('recommendations')
      .select('actual_savings')
      .eq('status', 'completed'),
  ]);

  if (potentialSavingsData.error || actualSavingsData.error) {
    console.error('[Recommendations API] Error fetching savings data:',
      potentialSavingsData.error || actualSavingsData.error);
    throw new Error('Failed to fetch recommendation statistics');
  }

  // Calculate savings totals
  const potentialSavings = (potentialSavingsData.data || []).reduce((sum, r) => {
    const parsed = parseFloat(String(r.savings));
    return sum + (isFinite(parsed) ? parsed : 0);
  }, 0);

  const actualSavings = (actualSavingsData.data || []).reduce((sum, r) => {
    const parsed = parseFloat(String(r.actual_savings));
    return sum + (isFinite(parsed) ? parsed : 0);
  }, 0);

  // Calculate statistics
  const stats = {
    total: totalResult.count || 0,
    pending: pendingResult.count || 0,
    inProgress: inProgressResult.count || 0,
    completed: completedResult.count || 0,
    dismissed: dismissedResult.count || 0,
    potentialSavings,
    actualSavings,
    highImpact: highImpactResult.count || 0,
    mediumImpact: mediumImpactResult.count || 0,
    lowImpact: lowImpactResult.count || 0,
  };

  // Sort recommendations by impact (high first) then effort (low first)
  const sortedRecommendations = (recommendations || []).sort((a, b) => {
    // Impact priority: high > medium > low
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const impactDiff = impactOrder[a.impact as keyof typeof impactOrder] - impactOrder[b.impact as keyof typeof impactOrder];

    if (impactDiff !== 0) return impactDiff;

    // Effort priority: low > medium > high (easier tasks first)
    const effortOrder = { low: 0, medium: 1, high: 2 };
    return effortOrder[a.effort as keyof typeof effortOrder] - effortOrder[b.effort as keyof typeof effortOrder];
  });

  // Transform response to camelCase
  const transformedRecommendations = sortedRecommendations.map(rec => ({
    id: rec.id,
    organizationId: rec.organization_id,
    title: rec.title,
    description: rec.description,
    implementation: rec.implementation,
    impact: rec.impact,
    effort: rec.effort,
    savings: Number(rec.savings),
    timeframe: rec.timeframe,
    status: rec.status,
    startedAt: rec.started_at,
    completedAt: rec.completed_at,
    estimatedCompletion: rec.estimated_completion,
    progress: rec.progress,
    actualSavings: rec.actual_savings ? Number(rec.actual_savings) : null,
    implementationDays: rec.implementation_days,
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
  }));

  return successResponse({
    recommendations: transformedRecommendations,
    statistics: stats,
  });
});
