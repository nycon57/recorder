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
