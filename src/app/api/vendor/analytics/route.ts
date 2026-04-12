/**
 * GET /api/vendor/analytics?period=7d|30d|90d
 *
 * Returns aggregated usage analytics for a vendor org:
 *   - totalQueries, uniqueUsers (distinct customer_org_ids), avgLatencyMs
 *   - queriesByDay: [{ date, count }]
 *   - topQuestions: [{ question, count }] top 10
 *   - topApps: [{ app, count }]
 *   - knowledgeGaps: questions where neither org nor vendor knowledge matched
 *
 * Auth: session-only, requireAdmin, must have white_label_config.
 *
 * TRIB-57
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { getWhiteLabelConfig } from '@/lib/services/white-label';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Period parsing
// ---------------------------------------------------------------------------

const VALID_PERIODS = ['7d', '30d', '90d'] as const;
type Period = (typeof VALID_PERIODS)[number];

function periodToDays(period: Period): number {
  switch (period) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
  }
}

// ---------------------------------------------------------------------------
// GET /api/vendor/analytics
// ---------------------------------------------------------------------------

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  // Verify this org is a vendor with an active white-label config
  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.forbidden(
      'No active white-label config. Vendor analytics requires a white-label configuration.'
    );
  }

  // Parse period
  const periodParam = request.nextUrl.searchParams.get('period') ?? '30d';
  if (!VALID_PERIODS.includes(periodParam as Period)) {
    return errors.badRequest(
      `Invalid period "${periodParam}". Must be one of: ${VALID_PERIODS.join(', ')}`
    );
  }
  const period = periodParam as Period;
  const days = periodToDays(period);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createAdminClient();

  // Run all analytics queries in parallel
  const [
    totalResult,
    uniqueUsersResult,
    avgLatencyResult,
    byDayResult,
    topQuestionsResult,
    topAppsResult,
    knowledgeGapsResult,
  ] = await Promise.all([
    // Total queries
    supabase
      .from('vendor_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_org_id', orgId)
      .gte('created_at', since),

    // Unique customer orgs (distinct)
    supabase.rpc('vendor_analytics_unique_customers' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
    }),

    // Avg latency
    supabase.rpc('vendor_analytics_avg_latency' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
    }),

    // Queries by day
    supabase.rpc('vendor_analytics_by_day' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
    }),

    // Top questions
    supabase.rpc('vendor_analytics_top_questions' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
      p_limit: 10,
    }),

    // Top apps
    supabase.rpc('vendor_analytics_top_apps' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
      p_limit: 10,
    }),

    // Knowledge gaps
    supabase.rpc('vendor_analytics_knowledge_gaps' as never, {
      p_vendor_org_id: orgId,
      p_since: since,
      p_limit: 20,
    }),
  ]);

  return successResponse({
    period,
    totalQueries: totalResult.count ?? 0,
    uniqueUsers: ((uniqueUsersResult.data as unknown) as { count: number }[] | null)?.[0]?.count ?? 0,
    avgLatencyMs: Math.round(
      ((avgLatencyResult.data as unknown) as { avg: number }[] | null)?.[0]?.avg ?? 0
    ),
    queriesByDay: ((byDayResult.data as unknown) as { date: string; count: number }[]) ?? [],
    topQuestions: ((topQuestionsResult.data as unknown) as { question: string; count: number }[]) ?? [],
    topApps: ((topAppsResult.data as unknown) as { app: string; count: number }[]) ?? [],
    knowledgeGaps: ((knowledgeGapsResult.data as unknown) as { question: string; count: number }[]) ?? [],
  });
});
