import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import {
  getUsageSummary,
  getUsageByAgent,
  getUsageByDay,
  getTopContentByUsage,
  type DailyUsage,
} from '@/lib/services/agent-metering';
import { getOrgPlanTier } from '@/lib/services/agent-config';
import type { PlanTier } from '@/lib/services/agent-config';

/** Credit limits per plan tier (monthly). */
const PLAN_CREDIT_LIMITS: Record<PlanTier, number> = {
  free: 0,
  starter: 1_000,
  professional: 10_000,
  enterprise: 100_000,
};

/**
 * Project monthly credit usage from daily activity so far this month.
 * Accounts for varying month lengths and weekday/weekend variance.
 *
 * Strategy:
 * 1. Compute per-day averages for weekdays and weekends separately.
 * 2. Count remaining weekdays/weekend days in the calendar month.
 * 3. Project total = credits so far + (avg_weekday × remaining_weekdays)
 *                                    + (avg_weekend × remaining_weekends)
 * Falls back to simple linear extrapolation when fewer than 3 days of data exist.
 */
function projectMonthlyUsage(dailyData: DailyUsage[], now: Date): number {
  if (dailyData.length === 0) return 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const remainingDays = daysInMonth - currentDay;

  if (dailyData.length < 3 || remainingDays <= 0) {
    // Simple linear extrapolation for sparse data or end of month
    const totalSoFar = dailyData.reduce((sum, d) => sum + d.totalCredits, 0);
    const daysElapsed = currentDay;
    const dailyAvg = totalSoFar / daysElapsed;
    return Math.round(totalSoFar + dailyAvg * remainingDays);
  }

  // Separate weekday vs weekend averages to handle usage patterns
  let weekdayTotal = 0;
  let weekdayCount = 0;
  let weekendTotal = 0;
  let weekendCount = 0;

  for (const d of dailyData) {
    const date = new Date(d.day);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendTotal += d.totalCredits;
      weekendCount++;
    } else {
      weekdayTotal += d.totalCredits;
      weekdayCount++;
    }
  }

  const avgWeekday = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const avgWeekend = weekendCount > 0 ? weekendTotal / weekendCount : avgWeekday;

  // Count remaining weekdays and weekend days in the month
  let remainingWeekdays = 0;
  let remainingWeekends = 0;
  for (let day = currentDay + 1; day <= daysInMonth; day++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    if (dow === 0 || dow === 6) {
      remainingWeekends++;
    } else {
      remainingWeekdays++;
    }
  }

  const creditsToDate = dailyData.reduce((sum, d) => sum + d.totalCredits, 0);
  const projected = creditsToDate
    + avgWeekday * remainingWeekdays
    + avgWeekend * remainingWeekends;

  return Math.round(projected);
}

/**
 * GET /api/organizations/usage
 * Returns AI credit usage data for the current month: summary, per-agent
 * breakdown, daily trend, top content items, and projected monthly total.
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const now = new Date();

  // Fetch all data in parallel
  const [summary, byAgent, byDay, topContent, planTier] = await Promise.all([
    getUsageSummary(orgId, 'month'),
    getUsageByAgent(orgId, 'month'),
    getUsageByDay(orgId),
    getTopContentByUsage(orgId, 10),
    getOrgPlanTier(orgId),
  ]);

  const creditLimit = PLAN_CREDIT_LIMITS[planTier];
  const projectedCredits = projectMonthlyUsage(byDay, now);

  return successResponse({
    planTier,
    creditLimit,
    summary,
    byAgent,
    byDay,
    topContent,
    projectedCredits,
    projectedCostUsd: projectedCredits * 0.01, // $0.01 per credit
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  });
});
