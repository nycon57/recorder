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

/**
 * Record a single agent action's usage.
 * If creditsConsumed is not provided, it is calculated from token counts.
 */
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
    console.error('[AgentMetering] Failed to record usage:', error.message);
  }
}

/**
 * Get aggregated usage summary for an org over a time period.
 * Returns zeroed summary when no usage exists.
 */
export async function getUsageSummary(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<UsageSummary> {
  const since = getPeriodStart(period);

  const { data, error } = await supabaseAdmin
    .from('agent_usage')
    .select('credits_consumed, tokens_input, tokens_output')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to get usage summary: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { totalCredits: 0, totalTokens: 0, actionCount: 0 };
  }

  let totalCredits = 0;
  let totalTokens = 0;
  for (const row of data) {
    totalCredits += row.credits_consumed ?? 0;
    totalTokens += (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
  }

  return { totalCredits, totalTokens, actionCount: data.length };
}

/**
 * Get usage broken down by agent type for an org over a time period.
 * Returns an empty array when no usage exists.
 */
export async function getUsageByAgent(
  orgId: string,
  period: 'day' | 'week' | 'month'
): Promise<AgentUsageBreakdown[]> {
  const since = getPeriodStart(period);

  const { data, error } = await supabaseAdmin
    .from('agent_usage')
    .select('agent_type, credits_consumed, tokens_input, tokens_output')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) {
    throw new Error(`Failed to get usage by agent: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const byAgent = new Map<string, AgentUsageBreakdown>();

  for (const row of data) {
    const existing = byAgent.get(row.agent_type);
    const tokens = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
    const credits = row.credits_consumed ?? 0;

    if (existing) {
      existing.totalCredits += credits;
      existing.totalTokens += tokens;
      existing.actionCount += 1;
    } else {
      byAgent.set(row.agent_type, {
        agentType: row.agent_type,
        totalCredits: credits,
        totalTokens: tokens,
        actionCount: 1,
      });
    }
  }

  return Array.from(byAgent.values());
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
