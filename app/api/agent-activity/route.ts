import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ActivityOutcome } from '@/lib/types/database';

const PAGE_SIZE = 50;
const STATS_CAP = 5000;

/** GET /api/agent-activity - Paginated agent activity feed with stats and filters. */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const { searchParams } = new URL(request.url);

  const agentType = searchParams.get('agentType') || undefined;
  const actionType = searchParams.get('actionType') || undefined;
  const outcome = (searchParams.get('outcome') as ActivityOutcome) || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Apply shared filters to any query builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters<T extends Record<string, any>>(query: T): T {
    if (agentType) query = query.eq('agent_type', agentType);
    if (actionType) query = query.eq('action_type', actionType);
    if (outcome) query = query.eq('outcome', outcome);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    return query;
  }

  // Run queries in parallel: entries, stats, and filter options
  const [entriesResult, statsResult, agentTypesResult, actionTypesResult] = await Promise.all([
    // Paginated entries (fetch PAGE_SIZE + 1 to detect hasMore)
    applyFilters(
      supabaseAdmin
        .from('agent_activity_log')
        .select('*')
        .eq('org_id', orgId)
    )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE),

    // Stats aggregation data (capped for performance)
    applyFilters(
      supabaseAdmin
        .from('agent_activity_log')
        .select('outcome, tokens_used, agent_type, cost_estimate', { count: 'exact' })
        .eq('org_id', orgId)
    )
      .limit(STATS_CAP),

    // Distinct agent types for filter dropdown (capped to avoid full table scan)
    supabaseAdmin
      .from('agent_activity_log')
      .select('agent_type')
      .eq('org_id', orgId)
      .limit(1000)
      .order('agent_type'),

    // Distinct action types for filter dropdown (capped to avoid full table scan)
    supabaseAdmin
      .from('agent_activity_log')
      .select('action_type')
      .eq('org_id', orgId)
      .limit(1000)
      .order('action_type'),
  ]);

  if (entriesResult.error) {
    throw new Error(`Failed to fetch entries: ${entriesResult.error.message}`);
  }
  if (statsResult.error) {
    throw new Error(`Failed to fetch stats: ${statsResult.error.message}`);
  }
  if (agentTypesResult.error) {
    console.error('[Agent Activity] Failed to fetch agent types:', agentTypesResult.error.message);
  }
  if (actionTypesResult.error) {
    console.error('[Agent Activity] Failed to fetch action types:', actionTypesResult.error.message);
  }

  const entries = entriesResult.data ?? [];
  const hasMore = entries.length > PAGE_SIZE;
  const pageEntries = hasMore ? entries.slice(0, PAGE_SIZE) : entries;

  // Batch-fetch content titles for entries with content_ids
  const contentIds = [...new Set(
    pageEntries.filter(e => e.content_id).map(e => e.content_id as string)
  )];
  let contentTitles: Record<string, string> = {};

  if (contentIds.length > 0) {
    const { data: contentData } = await supabaseAdmin
      .from('content')
      .select('id, title')
      .in('id', contentIds);

    if (contentData) {
      contentTitles = Object.fromEntries(
        contentData.map(c => [c.id, c.title || 'Untitled'])
      );
    }
  }

  // Compute stats from aggregation data
  const statsData = statsResult.data ?? [];
  const totalCount = statsResult.count ?? statsData.length;
  const cappedCount = statsData.length;
  const successCount = statsData.filter(r => r.outcome === 'success').length;
  const totalTokens = statsData.reduce((sum: number, r: { tokens_used: number | null }) => sum + (r.tokens_used || 0), 0);

  // Most active agent by frequency in filtered set
  const agentCounts: Record<string, number> = {};
  for (const row of statsData) {
    agentCounts[row.agent_type] = (agentCounts[row.agent_type] || 0) + 1;
  }
  const mostActiveAgent = Object.entries(agentCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Deduplicate filter options
  const agentTypes = [...new Set((agentTypesResult.data ?? []).map(r => r.agent_type))];
  const actionTypes = [...new Set((actionTypesResult.data ?? []).map(r => r.action_type))];

  return successResponse({
    entries: pageEntries.map(entry => ({
      ...entry,
      content_title: entry.content_id ? (contentTitles[entry.content_id] || null) : null,
    })),
    stats: {
      totalActions: totalCount,
      successRate: cappedCount > 0
        ? Math.round((successCount / cappedCount) * 100)
        : 0,
      mostActiveAgent,
      totalTokens,
    },
    hasMore,
    filters: {
      agentTypes,
      actionTypes,
    },
  });
});
