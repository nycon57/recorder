/**
 * Cost Overview API Endpoint
 *
 * GET /api/analytics/costs/overview
 * Returns cost overview metrics including current month, projected, YTD, and savings.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentPeriod, getLastPeriod, calculateTrend } from '@/lib/analytics/cost-calculations';

/**
 * GET /api/analytics/costs/overview
 *
 * Returns cost overview with current month, projections, and trends
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  const { year, month, dayOfMonth, daysInMonth } = getCurrentPeriod();
  const lastPeriod = getLastPeriod();

  // Get current month costs
  const { data: currentMonthData, error: currentMonthError } = await supabase
    .from('storage_metrics')
    .select('total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', new Date(year, month - 1, 1).toISOString())
    .lt('recorded_at', new Date(year, month, 1).toISOString());

  if (currentMonthError) {
    console.error('[GET /api/analytics/costs/overview] Error fetching current month data (orgId: %s, year: %s, month: %s):', orgId, year, month, currentMonthError);
    throw new Error(`Failed to fetch current month costs: ${currentMonthError.message}`);
  }

  const monthToDate = currentMonthData?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  // Get last month costs
  const { data: lastMonthData, error: lastMonthError } = await supabase
    .from('storage_metrics')
    .select('total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', new Date(lastPeriod.year, lastPeriod.month - 1, 1).toISOString())
    .lt('recorded_at', new Date(lastPeriod.year, lastPeriod.month, 1).toISOString());

  if (lastMonthError) {
    console.error('[GET /api/analytics/costs/overview] Error fetching last month data (orgId: %s, year: %s, month: %s):', orgId, lastPeriod.year, lastPeriod.month, lastMonthError);
    throw new Error(`Failed to fetch last month costs: ${lastMonthError.message}`);
  }

  const lastMonthTotal = lastMonthData?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  // Get YTD costs
  const { data: ytdData, error: ytdError } = await supabase
    .from('storage_metrics')
    .select('total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', new Date(year, 0, 1).toISOString());

  if (ytdError) {
    console.error('[GET /api/analytics/costs/overview] Error fetching YTD data (orgId: %s, year: %s):', orgId, year, ytdError);
    throw new Error(`Failed to fetch YTD costs: ${ytdError.message}`);
  }

  const ytd = ytdData?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  // Calculate projection based on daily run rate
  const dailyRate = dayOfMonth > 0 ? monthToDate / dayOfMonth : 0;
  const projectedMonth = dailyRate * daysInMonth;

  // Calculate month-over-month change
  const monthOverMonthChange = lastMonthTotal > 0
    ? ((monthToDate - lastMonthTotal) / lastMonthTotal) * 100
    : 0;

  // Calculate projected change vs last month
  const projectedChange = lastMonthTotal > 0
    ? ((projectedMonth - lastMonthTotal) / lastMonthTotal) * 100
    : 0;

  // Get savings opportunity from recommendations
  const { data: recommendations, error: recommendationsError } = await supabase
    .from('recommendations')
    .select('savings')
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  if (recommendationsError) {
    console.error('[GET /api/analytics/costs/overview] Error fetching recommendations (orgId: %s):', orgId, recommendationsError);
    throw new Error(`Failed to fetch recommendations: ${recommendationsError.message}`);
  }

  const savingsOpportunity = recommendations?.reduce((sum, r) => sum + (r.savings || 0), 0) || 0;

  return successResponse({
    currentMonth: parseFloat(monthToDate.toFixed(2)),
    lastMonth: parseFloat(lastMonthTotal.toFixed(2)),
    projected: parseFloat(projectedMonth.toFixed(2)),
    ytd: parseFloat(ytd.toFixed(2)),
    monthOverMonthChange: parseFloat(monthOverMonthChange.toFixed(2)),
    projectedChange: parseFloat(projectedChange.toFixed(2)),
    savingsOpportunity: parseFloat(savingsOpportunity.toFixed(2)),
  });
});
