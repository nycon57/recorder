/**
 * Cost Projections API Endpoint
 *
 * GET /api/analytics/costs/projections
 * Returns cost projections with confidence levels and contributing factors.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  calculateLinearRegression,
  calculateConfidence,
  getCurrentPeriod,
} from '@/lib/analytics/cost-calculations';

/**
 * GET /api/analytics/costs/projections
 *
 * Returns cost projections for 1, 3, 6, and 12 months with confidence levels
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  const { year, month, dayOfMonth } = getCurrentPeriod();

  // Get historical cost data (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: historicalData, error: historicalError } = await supabase
    .from('storage_metrics')
    .select('recorded_at, total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', sixMonthsAgo.toISOString())
    .order('recorded_at', { ascending: true });

  if (historicalError) {
    console.error('[GET /api/analytics/costs/projections] Error fetching historical data (orgId: %s):', orgId, historicalError);
    throw new Error(`Failed to fetch historical cost data: ${historicalError.message}`);
  }

  // Get current month cost
  const { data: currentMonthData, error: currentMonthError } = await supabase
    .from('storage_metrics')
    .select('total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', new Date(year, month - 1, 1).toISOString())
    .lt('recorded_at', new Date(year, month, 1).toISOString());

  if (currentMonthError) {
    console.error('[GET /api/analytics/costs/projections] Error fetching current month data (orgId: %s):', orgId, currentMonthError);
    throw new Error(`Failed to fetch current month cost data: ${currentMonthError.message}`);
  }

  const currentMonth = currentMonthData?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  // If no historical data, return simple projections based on current month
  if (!historicalData || historicalData.length < 2) {
    return successResponse({
      currentMonth: parseFloat(currentMonth.toFixed(2)),
      nextMonth: parseFloat(currentMonth.toFixed(2)),
      next3Months: parseFloat((currentMonth * 3).toFixed(2)),
      next6Months: parseFloat((currentMonth * 6).toFixed(2)),
      nextYear: parseFloat((currentMonth * 12).toFixed(2)),
      growthRate: 0,
      confidence: 'low' as const,
      factors: [
        {
          factor: 'Insufficient Historical Data',
          impact: 'Projections based on current month only',
          trend: 'stable',
        },
      ],
    });
  }

  // Group by month to get monthly totals
  const monthlyData = historicalData.reduce((acc, d) => {
    const monthKey = new Date(d.recorded_at).toISOString().slice(0, 7); // YYYY-MM
    acc[monthKey] = (acc[monthKey] || 0) + (d.total_cost || 0);
    return acc;
  }, {} as Record<string, number>);

  // Create data points for linear regression
  const dataPoints = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, cost], index) => ({
      x: index,
      y: cost,
    }));

  // Calculate linear regression for growth trend
  const { slope, intercept } = calculateLinearRegression(dataPoints);

  // Calculate average cost and growth rate
  const avgCost = dataPoints.reduce((sum, d) => sum + d.y, 0) / dataPoints.length;
  const growthRate = avgCost > 0 ? (slope / avgCost) * 100 : 0;

  // Project future costs
  const lastIndex = dataPoints.length - 1;

  const nextMonth = slope * (lastIndex + 1) + intercept;
  const next3Months = Array.from({ length: 3 }, (_, i) => slope * (lastIndex + 1 + i) + intercept).reduce((sum, v) => sum + v, 0);
  const next6Months = Array.from({ length: 6 }, (_, i) => slope * (lastIndex + 1 + i) + intercept).reduce((sum, v) => sum + v, 0);
  const nextYear = Array.from({ length: 12 }, (_, i) => slope * (lastIndex + 1 + i) + intercept).reduce((sum, v) => sum + v, 0);

  // Calculate confidence based on data consistency
  const confidence = calculateConfidence(historicalData);

  // Identify contributing factors
  const factors: Array<{
    factor: string;
    impact: string;
    trend: string;
  }> = [];

  // Analyze growth rate
  if (growthRate > 10) {
    factors.push({
      factor: 'High Growth Rate',
      impact: `Storage costs increasing at ${growthRate.toFixed(1)}% per month`,
      trend: 'increasing',
    });
  } else if (growthRate < -5) {
    factors.push({
      factor: 'Cost Reduction',
      impact: `Storage costs decreasing at ${Math.abs(growthRate).toFixed(1)}% per month`,
      trend: 'decreasing',
    });
  } else {
    factors.push({
      factor: 'Stable Growth',
      impact: `Storage costs growing at moderate ${growthRate.toFixed(1)}% per month`,
      trend: 'stable',
    });
  }

  // Check for recent spikes
  if (dataPoints.length >= 2) {
    const prev = dataPoints[dataPoints.length - 2].y;
    const curr = dataPoints[dataPoints.length - 1].y;

    if (prev !== 0) {
      const recentGrowth = ((curr - prev) / prev) * 100;
      if (Math.abs(recentGrowth) > 20) {
        factors.push({
          factor: 'Recent Usage Spike',
          impact: `Significant ${recentGrowth > 0 ? 'increase' : 'decrease'} of ${Math.abs(recentGrowth).toFixed(1)}% in recent month`,
          trend: recentGrowth > 0 ? 'increasing' : 'decreasing',
        });
      }
    } else if (curr !== 0) {
      // Handle jump from zero
      factors.push({
        factor: 'Recent Usage Spike',
        impact: `Significant increase from $0 to $${curr.toFixed(2)} in recent month`,
        trend: 'increasing',
      });
    }
  }

  // Check storage tier distribution using server-side aggregation
  const { data: tierStats, error: tierError } = await supabase
    .from('recordings')
    .select('storage_tier')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (tierError) {
    console.error('[GET /api/analytics/costs/projections] Error fetching tier stats (orgId: %s):', orgId, tierError);
    // Don't throw - tier stats are supplementary to projections
  } else if (tierStats && tierStats.length > 0) {
    const tierCounts = tierStats.reduce((acc, r) => {
      const tier = r.storage_tier || 'hot';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const hotPercentage = ((tierCounts.hot || 0) / tierStats.length) * 100;
    if (hotPercentage > 70) {
      factors.push({
        factor: 'High Hot Storage Usage',
        impact: `${hotPercentage.toFixed(1)}% of files in expensive hot tier`,
        trend: 'increasing',
      });
    }
  }

  // Add seasonality note if enough data
  if (dataPoints.length >= 12) {
    factors.push({
      factor: 'Seasonal Patterns',
      impact: 'Year-over-year patterns may affect projections',
      trend: 'cyclical',
    });
  }

  return successResponse({
    currentMonth: parseFloat(currentMonth.toFixed(2)),
    nextMonth: parseFloat(Math.max(0, nextMonth).toFixed(2)),
    next3Months: parseFloat(Math.max(0, next3Months).toFixed(2)),
    next6Months: parseFloat(Math.max(0, next6Months).toFixed(2)),
    nextYear: parseFloat(Math.max(0, nextYear).toFixed(2)),
    growthRate: parseFloat(growthRate.toFixed(2)),
    confidence,
    factors,
  });
});
