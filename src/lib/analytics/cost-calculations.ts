/**
 * Cost Calculation Helper Functions
 *
 * Provides reusable calculation functions for cost management and analytics.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Storage cost rates per GB per month
 */
export const TIER_PRICING = {
  hot: 0.021, // $0.021/GB/month
  warm: 0.015, // $0.015/GB/month
  cold: 0.010, // $0.01/GB/month
  glacier: 0.004, // $0.004/GB/month
} as const;

/**
 * Calculate storage cost based on file size and tier
 *
 * Note: This function uses decimal gigabytes (1e9 bytes = 1 GB) for pricing calculations,
 * which is standard for cloud storage billing. This differs from binary gigabytes (1024^3).
 */
export function calculateStorageCost(sizeBytes: number, tier: 'hot' | 'warm' | 'cold' | 'glacier'): number {
  const GB = sizeBytes / 1e9;
  return GB * TIER_PRICING[tier];
}

/**
 * Calculate trend percentage between two periods
 */
export async function calculateTrend(
  orgId: string | null,
  days = 30
): Promise<number> {
  const supabase = supabaseAdmin;
  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousPeriodStart = new Date(currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000);

  // Build query
  let currentQuery = supabase
    .from('storage_metrics')
    .select('total_cost')
    .gte('recorded_at', currentPeriodStart.toISOString())
    .lt('recorded_at', now.toISOString());

  let previousQuery = supabase
    .from('storage_metrics')
    .select('total_cost')
    .gte('recorded_at', previousPeriodStart.toISOString())
    .lt('recorded_at', currentPeriodStart.toISOString());

  // Add organization filter if provided
  if (orgId) {
    currentQuery = currentQuery.eq('organization_id', orgId);
    previousQuery = previousQuery.eq('organization_id', orgId);
  }

  const [currentData, previousData] = await Promise.all([
    currentQuery,
    previousQuery,
  ]);

  const currentTotal = currentData.data?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;
  const previousTotal = previousData.data?.reduce((sum, m) => sum + (m.total_cost || 0), 0) || 0;

  if (previousTotal === 0) return 0;

  return ((currentTotal - previousTotal) / previousTotal) * 100;
}

/**
 * Linear regression calculation for trend analysis
 */
export function calculateLinearRegression(dataPoints: Array<{ x: number; y: number }>) {
  if (dataPoints.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  const n = dataPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  dataPoints.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  });

  // Guard against division by zero
  const denominator = n * sumXX - sumX * sumX;

  if (Math.abs(denominator) < Number.EPSILON) {
    // When denominator is effectively zero, all x values are the same
    // Return zero slope with average y as intercept
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate confidence level based on data variance and R² value
 */
export function calculateConfidence(data: any[]): 'high' | 'medium' | 'low' {
  if (!data || data.length < 3) return 'low';
  if (data.length < 6) return 'medium';

  // Calculate variance in the data
  const values = data.map((d) => d.total_cost || 0);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  // Low variance = high confidence
  if (coefficientOfVariation < 0.15) return 'high';
  if (coefficientOfVariation < 0.30) return 'medium';
  return 'low';
}

/**
 * Get current month and year
 */
export function getCurrentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // JavaScript months are 0-indexed
    dayOfMonth: now.getDate(),
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  };
}

/**
 * Get last month and year
 */
export function getLastPeriod() {
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  return {
    year: lastYear,
    month: lastMonth,
    daysInMonth: new Date(lastYear, lastMonth, 0).getDate(),
  };
}

/**
 * Format cost as currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  // Validate input
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`Invalid bytes value: ${bytes}. Must be a finite non-negative number.`);
  }

  if (bytes === 0) return '0 Bytes';

  // Handle fractional bytes (0 < bytes < 1)
  if (bytes < 1) {
    return `${bytes.toFixed(2)} Bytes`;
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Determine dominant storage tier for organization
 */
export async function determineDominantTier(orgId: string): Promise<'hot' | 'warm' | 'cold' | 'glacier'> {
  const supabase = supabaseAdmin;

  const { data: recordings } = await supabase
    .from('recordings')
    .select('storage_tier')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (!recordings || recordings.length === 0) return 'hot';

  // Count recordings per tier
  const tierCounts = recordings.reduce((acc, r) => {
    const tier = r.storage_tier || 'hot';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Find tier with most recordings
  let maxCount = 0;
  let dominantTier: 'hot' | 'warm' | 'cold' | 'glacier' = 'hot';

  Object.entries(tierCounts).forEach(([tier, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantTier = tier as 'hot' | 'warm' | 'cold' | 'glacier';
    }
  });

  return dominantTier;
}

/**
 * Calculate monthly growth rate from historical data
 */
export async function calculateMonthlyGrowthRate(orgId: string | null, months = 6): Promise<number> {
  const supabase = supabaseAdmin;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  // Build query
  let query = supabase
    .from('storage_metrics')
    .select('recorded_at, total_cost')
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (orgId) {
    query = query.eq('organization_id', orgId);
  }

  const { data } = await query;

  if (!data || data.length < 2) return 0;

  // Create data points for linear regression
  const dataPoints = data.map((d, index) => ({
    x: index,
    y: d.total_cost || 0,
  }));

  const { slope } = calculateLinearRegression(dataPoints);

  // Convert slope to percentage growth rate
  const avgCost = dataPoints.reduce((sum, d) => sum + d.y, 0) / dataPoints.length;
  if (avgCost === 0) return 0;

  return (slope / avgCost) * 100;
}
