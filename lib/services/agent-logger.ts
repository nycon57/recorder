/**
 * Agent Activity Logger Service
 *
 * Structured logging for all agent actions. Inserts into agent_activity_log
 * and provides paginated queries and aggregate stats.
 */

import type { Database, ActivityOutcome, Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Agent activity log record matching the agent_activity_log table columns */
export type AgentActivityLog = Database['public']['Tables']['agent_activity_log']['Row'];

/** Stats returned by getAgentActionStats */
export interface AgentActionStats {
  total: number;
  success: number;
  failure: number;
  skipped: number;
  avgDurationMs: number;
  totalTokens: number;
  totalCost: number;
}

const ZERO_STATS: AgentActionStats = {
  total: 0, success: 0, failure: 0, skipped: 0,
  avgDurationMs: 0, totalTokens: 0, totalCost: 0,
};

/**
 * Insert a single agent action into agent_activity_log.
 * Returns the new log entry's id.
 */
export async function logAgentAction(params: {
  orgId: string;
  agentType: string;
  actionType: string;
  contentId?: string;
  targetEntity?: string;
  targetId?: string;
  inputSummary?: string;
  outputSummary?: string;
  outcome: ActivityOutcome;
  confidence?: number;
  durationMs?: number;
  tokensUsed?: number;
  costEstimate?: number;
  errorMessage?: string;
  metadata?: Json;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('agent_activity_log')
    .insert({
      org_id: params.orgId,
      agent_type: params.agentType,
      action_type: params.actionType,
      content_id: params.contentId ?? null,
      target_entity: params.targetEntity ?? null,
      target_id: params.targetId ?? null,
      input_summary: params.inputSummary ?? null,
      output_summary: params.outputSummary ?? null,
      outcome: params.outcome,
      confidence: params.confidence ?? null,
      duration_ms: params.durationMs ?? null,
      tokens_used: params.tokensUsed ?? null,
      cost_estimate: params.costEstimate ?? null,
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to log agent action: ${error.message}`);
  }

  return (data as { id: string }).id;
}

/**
 * Higher-order wrapper that logs start time, executes fn, measures duration,
 * and records outcome as 'success' or 'failure'. On failure, stores the
 * error message in the error_message column and rethrows the original error.
 */
export async function withAgentLogging<T>(
  params: {
    orgId: string;
    agentType: string;
    actionType: string;
    contentId?: string;
    targetEntity?: string;
    targetId?: string;
    inputSummary?: string;
  },
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    await logAgentAction({
      ...params,
      outcome: 'success',
      durationMs,
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Best-effort logging; do not mask the original error
    try {
      await logAgentAction({
        ...params,
        outcome: 'failure',
        durationMs,
        errorMessage,
      });
    } catch (logError) {
      console.error('[AgentLogger] Failed to log action failure:', logError);
    }

    throw error;
  }
}

/**
 * Paginated query for agent activity with optional filters.
 * Ordered by created_at DESC.
 */
export async function getAgentActivity(params: {
  orgId: string;
  agentType?: string;
  actionType?: string;
  outcome?: ActivityOutcome;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}): Promise<AgentActivityLog[]> {
  const { orgId, agentType, actionType, outcome, limit = 50, offset = 0, startDate, endDate } = params;

  let query = supabaseAdmin
    .from('agent_activity_log')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentType) query = query.eq('agent_type', agentType);
  if (actionType) query = query.eq('action_type', actionType);
  if (outcome) query = query.eq('outcome', outcome);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get agent activity: ${error.message}`);
  }

  return (data as AgentActivityLog[]) ?? [];
}

/**
 * Aggregate stats for agent actions within an org.
 * Uses get_agent_action_stats RPC for parameterized aggregation.
 * Returns all-zero stats when no matching actions exist.
 */
export async function getAgentActionStats(params: {
  orgId: string;
  agentType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AgentActionStats> {
  const { orgId, agentType, startDate, endDate } = params;

  // RPC not in generated types
  const { data, error } = await supabaseAdmin.rpc('get_agent_action_stats', {
    p_org_id: orgId,
    p_agent_type: agentType ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  } as any);

  if (error) {
    throw new Error(`Failed to get agent action stats: ${error.message}`);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return ZERO_STATS;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: row.total ?? 0,
    success: row.success ?? 0,
    failure: row.failure ?? 0,
    skipped: row.skipped ?? 0,
    avgDurationMs: Math.round(row.avg_duration_ms ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    totalCost: row.total_cost ?? 0,
  };
}
