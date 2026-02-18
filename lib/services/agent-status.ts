/**
 * Agent Status Service
 *
 * Fetches the data needed for the AgentStatusWidget on the main dashboard.
 * Uses two rounds of parallel queries: first to determine which agents are
 * enabled (including plan-tier gating), then to fetch per-agent activity.
 */

import type { OrgAgentSettings, PlanTier } from '@/lib/services/agent-config';
import { AGENT_COLUMN_MAP, planTierAllowsAgent } from '@/lib/services/agent-config';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface EnabledAgent {
  type: string;
  name: string;
  /** Most recent success/failure outcome, or null when no history exists. */
  lastOutcome: 'success' | 'failure' | null;
}

export interface AgentStatusSummary {
  enabledAgents: EnabledAgent[];
  actionsToday: number;
  /** Rounded percentage, or null when there are no success/failure actions today. */
  successRate: number | null;
  activeSessions: number;
}

/** All known agent types, derived from the canonical column map. */
const ALL_AGENT_TYPES = Object.keys(AGENT_COLUMN_MAP);

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  curator: 'Curator',
  gap_intelligence: 'Gap Intelligence',
  onboarding: 'Onboarding',
  digest: 'Digest',
  workflow_extraction: 'Workflow Extraction',
};

/** UTC midnight for the current day, as an ISO string. */
function todayUTCStart(): string {
  return new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

/** Determine which agent types are enabled for the org. */
function resolveEnabledAgents(
  settings: OrgAgentSettings | null,
  planTier: PlanTier,
): string[] {
  const globalEnabled = settings?.global_agent_enabled ?? true;
  if (!globalEnabled || !settings) return [];

  return ALL_AGENT_TYPES.filter((agentType) => {
    const column = AGENT_COLUMN_MAP[agentType];
    return settings[column] === true && planTierAllowsAgent(planTier, agentType);
  });
}

/** Compute today's action count and success rate from activity rows. */
function computeTodayStats(
  rows: Array<{ outcome: string }>,
): { actionsToday: number; successRate: number | null } {
  const actionsToday = rows.length;
  const successCount = rows.filter((r) => r.outcome === 'success').length;
  const failureCount = rows.filter((r) => r.outcome === 'failure').length;
  const rateBase = successCount + failureCount;

  return {
    actionsToday,
    successRate: rateBase > 0 ? Math.round((successCount / rateBase) * 100) : null,
  };
}

export async function fetchAgentStatusSummary(
  orgId: string,
): Promise<AgentStatusSummary> {
  const todayISO = todayUTCStart();

  // Round 1: settings, plan tier, today's stats, active sessions.
  const [settingsResult, quotaResult, todayResult, sessionsResult] =
    await Promise.all([
      supabaseAdmin
        .from('org_agent_settings')
        .select()
        .eq('org_id', orgId)
        .maybeSingle(),

      supabaseAdmin
        .from('org_quotas')
        .select('plan_tier')
        .eq('org_id', orgId)
        .maybeSingle(),

      supabaseAdmin
        .from('agent_activity_log')
        .select('outcome')
        .eq('org_id', orgId)
        .gte('created_at', todayISO),

      supabaseAdmin
        .from('agent_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('session_status', 'active'),
    ]);

  if (settingsResult.error) {
    console.error('[AgentStatus] Failed to fetch agent settings:', settingsResult.error.message);
  }
  if (todayResult.error) {
    console.error('[AgentStatus] Failed to fetch today activity:', todayResult.error.message);
  }
  if (sessionsResult.error) {
    console.error('[AgentStatus] Failed to fetch active sessions:', sessionsResult.error.message);
  }

  const settings = settingsResult.data as OrgAgentSettings | null;
  const planTier = (quotaResult.data?.plan_tier ?? 'free') as PlanTier;
  const enabledAgentTypes = resolveEnabledAgents(settings, planTier);
  const { actionsToday, successRate } = computeTodayStats(todayResult.data ?? []);
  const activeSessions = sessionsResult.count ?? 0;

  if (enabledAgentTypes.length === 0) {
    return { enabledAgents: [], actionsToday, successRate, activeSessions };
  }

  // Round 2: most recent success/failure outcome per enabled agent type.
  const lastOutcomeResults = await Promise.all(
    enabledAgentTypes.map((type) =>
      supabaseAdmin
        .from('agent_activity_log')
        .select('outcome')
        .eq('org_id', orgId)
        .eq('agent_type', type)
        .in('outcome', ['success', 'failure'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );

  const enabledAgents: EnabledAgent[] = enabledAgentTypes.map((type, i) => {
    const result = lastOutcomeResults[i];
    if (result.error) {
      console.error(`[AgentStatus] Failed to fetch last outcome for ${type}:`, result.error.message);
    }
    const outcome = result.data?.outcome;
    return {
      type,
      name: AGENT_DISPLAY_NAMES[type] ?? type,
      lastOutcome:
        outcome === 'success' || outcome === 'failure' ? outcome : null,
    };
  });

  return { enabledAgents, actionsToday, successRate, activeSessions };
}
