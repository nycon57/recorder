/**
 * Agent Usage Metering Service
 *
 * Tracks AI credit consumption per agent action for usage-based pricing
 * and budget management. Credits are calculated from token counts using
 * a configurable rate (default: 1 credit per 1000 tokens).
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

function getCreditsPerKTokens(): number {
  const envVal = process.env.CREDITS_PER_1K_TOKENS;
  if (!envVal) return 1.0;
  const parsed = parseFloat(envVal);
  return Number.isFinite(parsed) ? parsed : 1.0;
}

export function calculateCredits(tokensInput: number, tokensOutput: number): number {
  const totalTokens = tokensInput + tokensOutput;
  return (totalTokens / 1000) * getCreditsPerKTokens();
}

export interface UsageSummary {
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

export interface AgentUsageBreakdown {
  agentType: string;
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

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
 * Normalize an RPC result into an array of rows.
 * Supabase RPCs may return a single object or an array depending on the
 * function definition. Returns null for empty/missing data so callers
 * can short-circuit to a default value.
 */
function normalizeRpcRows(data: unknown): Record<string, unknown>[] | null {
  if (!data) return null;
  const rows = Array.isArray(data) ? data : [data];
  return rows.length === 0 ? null : rows;
}

export async function getUsageSummary(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_summary', {
    p_org_id: orgId,
    p_since: getPeriodStart(period),
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage summary:', {
      orgId, period, error: error.message,
    });
    return ZERO_SUMMARY;
  }

  const rows = normalizeRpcRows(data);
  if (!rows) return ZERO_SUMMARY;

  const row = rows[0];
  return {
    totalCredits: Number(row.total_credits ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  };
}

/** Returns an empty array on error or when no usage exists. */
export async function getUsageByAgent(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<AgentUsageBreakdown[]> {
  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_by_agent', {
    p_org_id: orgId,
    p_since: getPeriodStart(period),
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage by agent:', {
      orgId, period, error: error.message,
    });
    return [];
  }

  const rows = normalizeRpcRows(data);
  if (!rows) return [];

  return rows.map((row) => ({
    agentType: String(row.agent_type ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

export interface DailyUsage {
  /** ISO date string, e.g. "2026-02-17" */
  day: string;
  totalCredits: number;
  totalTokens: number;
  actionCount: number;
}

export interface TopContentUsage {
  contentId: string;
  totalCredits: number;
  actionCount: number;
}

/** One row per day with activity for the current calendar month, ascending. */
export async function getUsageByDay(orgId: string): Promise<DailyUsage[]> {
  const { data, error } = await supabaseAdmin.rpc('get_agent_usage_by_day', {
    p_org_id: orgId,
    p_since: getMonthStart(),
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get usage by day:', {
      orgId, error: error.message,
    });
    return [];
  }

  const rows = normalizeRpcRows(data);
  if (!rows) return [];

  return rows.map((row) => ({
    day: String(row.day ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

/** Top content items by credit consumption for the current month (descending). */
export async function getTopContentByUsage(
  orgId: string,
  limit = 10
): Promise<TopContentUsage[]> {
  const { data, error } = await supabaseAdmin.rpc('get_top_content_by_usage', {
    p_org_id: orgId,
    p_since: getMonthStart(),
    p_limit: limit,
  } as Record<string, unknown>);

  if (error) {
    console.error('[AgentMetering] Failed to get top content by usage:', {
      orgId, error: error.message,
    });
    return [];
  }

  const rows = normalizeRpcRows(data);
  if (!rows) return [];

  return rows.map((row) => ({
    contentId: String(row.content_id ?? ''),
    totalCredits: Number(row.total_credits ?? 0),
    actionCount: Number(row.action_count ?? 0),
  }));
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

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
