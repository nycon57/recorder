/**
 * Agent Usage Metering Service
 *
 * Tracks AI credit consumption per agent action for usage-based pricing
 * and budget management. Credits are calculated from token counts using
 * a configurable rate (default: 1 credit per 1000 tokens).
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

/** Credits per 1000 tokens, configurable via CREDITS_PER_1K_TOKENS env var */
function getCreditsPerKTokens(): number {
  const envVal = process.env.CREDITS_PER_1K_TOKENS;
  if (!envVal) return 1.0;
  const parsed = parseFloat(envVal);
  return Number.isFinite(parsed) ? parsed : 1.0;
}

/** Calculate credits from token counts */
export function calculateCredits(tokensInput: number, tokensOutput: number): number {
  const totalTokens = tokensInput + tokensOutput;
  return (totalTokens / 1000) * getCreditsPerKTokens();
}

/** Summary of usage over a time period */
export interface UsageSummary {
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

/** Per-agent usage breakdown */
export interface AgentUsageBreakdown {
  agentType: string;
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

/** Record a single agent action's usage */
export async function recordUsage(params: {
  orgId: string;
  agentType: string;
  actionType: string;
  creditsConsumed: number;
  tokensInput?: number;
  tokensOutput?: number;
  modelUsed?: string;
  contentId?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_usage')
    .insert({
      org_id: params.orgId,
      agent_type: params.agentType,
      action_type: params.actionType,
      credits_consumed: params.creditsConsumed,
      tokens_input: params.tokensInput ?? 0,
      tokens_output: params.tokensOutput ?? 0,
      model_used: params.modelUsed ?? null,
      content_id: params.contentId ?? null,
    });

  if (error) {
    // Log but don't throw — metering should never block agent operations
    console.error('[AgentMetering] Failed to record usage:', {
      orgId: params.orgId,
      agentType: params.agentType,
      error: error.message,
    });
  }
}

const ZERO_SUMMARY: UsageSummary = { totalCredits: 0, totalTokens: 0, actionCount: 0 };

/**
 * Get aggregated usage summary for an org over a time period.
 * Uses database-side aggregation to avoid fetching unbounded rows.
 * Returns zeroed summary on error or when no usage exists.
 */
export async function getUsageSummary(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<UsageSummary> {
  const since = getPeriodStart(period);

  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_summary', {
    p_org_id: orgId,
    p_since: since,
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage summary:', {
      orgId,
      period,
      error: error.message,
    });
    return ZERO_SUMMARY;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return ZERO_SUMMARY;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalCredits: row.total_credits ?? 0,
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  };
}

/**
 * Get usage broken down by agent type for an org over a time period.
 * Uses database-side aggregation with GROUP BY to avoid fetching unbounded rows.
 * Returns an empty array on error or when no usage exists.
 */
export async function getUsageByAgent(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<AgentUsageBreakdown[]> {
  const since = getPeriodStart(period);

  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_by_agent', {
    p_org_id: orgId,
    p_since: since,
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage by agent:', {
      orgId,
      period,
      error: error.message,
    });
    return [];
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return [];
  }

  const rows = Array.isArray(data) ? data : [data];
  return rows.map((row: Record<string, unknown>) => ({
    agentType: String(row.agent_type ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

/** Daily credit usage for a single day */
export interface DailyUsage {
  /** ISO date string, e.g. "2026-02-17" */
  day: string;
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

/** Usage attributed to a specific content item */
export interface TopContentUsage {
  contentId: string;
  totalCredits: number;
  actionCount: number;
}

/**
 * Get daily credit usage for the current calendar month.
 * Returns one row per day with activity, sorted ascending by date.
 * Returns an empty array on error or when no usage exists.
 */
export async function getUsageByDay(orgId: string): Promise<DailyUsage[]> {
  const since = getMonthStart();

  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_by_day', {
    p_org_id: orgId,
    p_since: since,
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage by day:', {
      orgId,
      error: error.message,
    });
    return [];
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return [];
  }

  const rows = Array.isArray(data) ? data : [data];
  return rows.map((row: Record<string, unknown>) => ({
    day: String(row.day ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

/**
 * Get top content items by credit consumption for the current month.
 * Returns up to `limit` items sorted by total credits descending.
 * Returns an empty array on error or when no usage exists.
 */
export async function getTopContentByUsage(
  orgId: string,
  limit = 10
): Promise<TopContentUsage[]> {
  const since = getMonthStart();

  const { data, error } = await supabaseAdmin.rpc('get_top_content_by_usage', {
    p_org_id: orgId,
    p_since: since,
    p_limit: limit,
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get top content by usage:', {
      orgId,
      error: error.message,
    });
    return [];
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return [];
  }

  const rows = Array.isArray(data) ? data : [data];
  return rows.map((row: Record<string, unknown>) => ({
    contentId: String(row.content_id ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

/** ISO timestamp for the first moment of the current calendar month */
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/** Compute the ISO timestamp for the start of a period relative to now */
function getPeriodStart(period: 'day' | 'week' | 'month'): string {
  const now = new Date();
  switch (period) {
    case 'day':
      now.setDate(now.getDate() - 1);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() - 1);
      break;
  }
  return now.toISOString();
}
