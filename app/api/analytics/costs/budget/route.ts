/**
 * Budget Tracking API Endpoint
 *
 * GET /api/analytics/costs/budget
 * Returns budget tracking and progress for current month.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentPeriod } from '@/lib/analytics/cost-calculations';

/**
 * GET /api/analytics/costs/budget
 *
 * Returns budget tracking and alerts for current month
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const supabase = supabaseAdmin;

  const { year, month, dayOfMonth, daysInMonth } = getCurrentPeriod();

  // Get or create budget for current month
  let { data: budgetData } = await supabase
    .from('budget_tracking')
    .select('*')
    .eq('organization_id', orgId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  // If no budget exists, create default
  if (!budgetData) {
    const { data: newBudget } = await supabase
      .from('budget_tracking')
      .insert({
        organization_id: orgId,
        year,
        month,
        monthly_budget: 5000, // Default budget
        current_spend: 0,
        projected_spend: 0,
      })
      .select()
      .single();

    budgetData = newBudget;
  }

  // Calculate current spend from storage_metrics
  const { data: metricsData } = await supabase
    .from('storage_metrics')
    .select('total_cost')
    .eq('organization_id', orgId)
    .gte('recorded_at', new Date(year, month - 1, 1).toISOString())
    .lt('recorded_at', new Date(year, month, 1).toISOString());

  const currentSpend = metricsData?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  // Calculate projection
  const dailyRate = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0;
  const projectedSpend = dailyRate * daysInMonth;

  // Update budget tracking with latest spend
  await supabase
    .from('budget_tracking')
    .update({
      current_spend: currentSpend,
      projected_spend: projectedSpend,
    })
    .eq('organization_id', orgId)
    .eq('year', year)
    .eq('month', month);

  const monthlyBudget = budgetData?.monthly_budget || 5000;
  const percentUsed = (currentSpend / monthlyBudget) * 100;
  const remaining = monthlyBudget - currentSpend;
  const projectedOverage = Math.max(0, projectedSpend - monthlyBudget);

  // Determine status
  let status: 'on-track' | 'warning' | 'over-budget' = 'on-track';
  if (percentUsed >= 100) {
    status = 'over-budget';
  } else if (percentUsed >= 85) {
    status = 'warning';
  }

  // Generate alerts
  const alerts: Array<{
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }> = [];

  // Calculate pace variance
  const expectedSpendByNow = (monthlyBudget / daysInMonth) * dayOfMonth;
  const paceVariance = expectedSpendByNow > 0
    ? ((currentSpend - expectedSpendByNow) / expectedSpendByNow) * 100
    : 0;

  if (percentUsed >= 100) {
    alerts.push({
      id: 'budget-exceeded',
      message: `Budget exceeded by ${formatCurrency(currentSpend - monthlyBudget)}`,
      severity: 'critical',
    });
  } else if (percentUsed >= 90) {
    alerts.push({
      id: 'budget-warning',
      message: `Budget is ${percentUsed.toFixed(1)}% consumed with ${daysInMonth - dayOfMonth} days remaining`,
      severity: 'warning',
    });
  }

  if (paceVariance > 15) {
    alerts.push({
      id: 'pace-warning',
      message: `Spending is ${paceVariance.toFixed(1)}% above expected pace for this point in the month`,
      severity: 'warning',
    });
  }

  if (projectedOverage > 0) {
    alerts.push({
      id: 'projected-overage',
      message: `Projected to exceed budget by ${formatCurrency(projectedOverage)} at current pace`,
      severity: 'warning',
    });
  }

  // Calculate daily run rates
  const dailyRunRate = dailyRate;
  const targetDailyRate = monthlyBudget / daysInMonth;

  return successResponse({
    budget: parseFloat(monthlyBudget.toFixed(2)),
    spent: parseFloat(currentSpend.toFixed(2)),
    remaining: parseFloat(remaining.toFixed(2)),
    percentUsed: parseFloat(percentUsed.toFixed(2)),
    status,
    projectedSpend: parseFloat(projectedSpend.toFixed(2)),
    projectedOverage: parseFloat(projectedOverage.toFixed(2)),
    alerts,
    dailyRunRate: parseFloat(dailyRunRate.toFixed(2)),
    targetDailyRate: parseFloat(targetDailyRate.toFixed(2)),
  });
});

/**
 * Helper to format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
