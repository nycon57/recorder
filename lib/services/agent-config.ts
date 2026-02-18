/**
 * Agent Configuration Service
 *
 * Per-org agent toggle settings and plan-tier gates. Each org has at most one
 * row in org_agent_settings; missing rows resolve to defaults.
 *
 * Plan tier rules (read from org_quotas.plan_tier):
 *   free         → no agents
 *   starter      → basic agents: onboarding, digest
 *   professional → starter agents + curator
 *   enterprise   → all agents
 */

import type { Database } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type OrgAgentSettings = Database['public']['Tables']['org_agent_settings']['Row'];

/** Plan tiers as stored in org_quotas.plan_tier */
export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

/** Column names that map to agent type strings */
const AGENT_COLUMN_MAP: Record<string, keyof OrgAgentSettings> = {
  curator: 'curator_enabled',
  gap_intelligence: 'gap_intelligence_enabled',
  onboarding: 'onboarding_enabled',
  digest: 'digest_enabled',
  workflow_extraction: 'workflow_extraction_enabled',
};

const DEFAULT_SETTINGS: Omit<OrgAgentSettings, 'id' | 'org_id' | 'created_at' | 'updated_at'> = {
  curator_enabled: false,
  gap_intelligence_enabled: false,
  onboarding_enabled: false,
  digest_enabled: false,
  workflow_extraction_enabled: false,
  global_agent_enabled: true,
  metadata: {},
};

/**
 * Agents allowed per plan tier.
 * Enterprise unlocks all agents; lower tiers have progressive subsets.
 */
const TIER_ALLOWED_AGENTS: Record<PlanTier, ReadonlySet<string>> = {
  free: new Set([]),
  starter: new Set(['onboarding', 'digest']),
  professional: new Set(['onboarding', 'digest', 'curator']),
  enterprise: new Set(['curator', 'gap_intelligence', 'onboarding', 'digest', 'workflow_extraction']),
};

/** Minimum plan tier required for each agent */
const AGENT_REQUIRED_TIER: Record<string, PlanTier> = {
  onboarding: 'starter',
  digest: 'starter',
  curator: 'professional',
  gap_intelligence: 'enterprise',
  workflow_extraction: 'enterprise',
};

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

/** Returns true when `actual` meets or exceeds `required`. */
function tierMeetsRequirement(actual: PlanTier, required: PlanTier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[required];
}

/**
 * Determine which plan tier an agent requires.
 * Returns 'starter' for unknown agents (safe default).
 */
export function getRequiredTierForAgent(agentType: string): PlanTier {
  return AGENT_REQUIRED_TIER[agentType] ?? 'starter';
}

/**
 * Get the plan tier for an org from org_quotas.
 * Returns 'free' when no quota row exists (safe default).
 */
export async function getOrgPlanTier(orgId: string): Promise<PlanTier> {
  const { data, error } = await supabaseAdmin
    .from('org_quotas')
    .select('plan_tier')
    .eq('org_id', orgId)
    .single();

  if (error || !data?.plan_tier) {
    return 'free';
  }

  const tier = data.plan_tier as PlanTier;
  return tier in TIER_ORDER ? tier : 'free';
}

/**
 * Check whether a plan tier allows an agent type.
 * Used by API routes to generate specific 403 messages.
 */
export function planTierAllowsAgent(planTier: PlanTier, agentType: string): boolean {
  return TIER_ALLOWED_AGENTS[planTier]?.has(agentType) ?? false;
}

/**
 * Get agent settings for an org.
 * Returns the stored row or synthesized defaults if no row exists.
 */
export async function getAgentSettings(orgId: string): Promise<OrgAgentSettings> {
  const { data, error } = await supabaseAdmin
    .from('org_agent_settings')
    .select()
    .eq('org_id', orgId)
    .single();

  if (error) {
    // No row found — return defaults with a synthetic shape
    if (error.code === 'PGRST116') {
      return {
        id: '',
        org_id: orgId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...DEFAULT_SETTINGS,
      } as OrgAgentSettings;
    }
    throw new Error(`Failed to get agent settings: ${error.message}`);
  }

  return data as OrgAgentSettings;
}

/**
 * Check whether a specific agent type is enabled for an org.
 *
 * Returns false when any of the following are true:
 * - The org's plan tier does not include the agent
 * - The global kill switch (global_agent_enabled) is off
 * - The individual agent toggle is off
 */
export async function isAgentEnabled(orgId: string, agentType: string): Promise<boolean> {
  // Fetch plan tier and settings in parallel for efficiency
  const [planTier, settings] = await Promise.all([
    getOrgPlanTier(orgId),
    getAgentSettings(orgId),
  ]);

  // Plan tier gate — checked before individual toggles
  if (!planTierAllowsAgent(planTier, agentType)) {
    return false;
  }

  // Global kill switch overrides individual toggles
  if (!settings.global_agent_enabled) {
    return false;
  }

  const column = AGENT_COLUMN_MAP[agentType];
  if (!column) {
    return false;
  }

  return settings[column] === true;
}

/**
 * Upgrade-required error payload for API routes that gate on plan tier.
 * Return this as the body with HTTP 403 when plan tier blocks access.
 */
export function upgradePlanError() {
  return {
    error: 'Agent features require Pro or Enterprise plan',
    upgradeUrl: '/settings/billing',
  } as const;
}

/**
 * Check whether an org's plan tier satisfies the requirement for a given agent.
 * Intended for API routes that must return 403 with upgrade details.
 */
export async function checkAgentPlanAccess(
  orgId: string,
  agentType: string
): Promise<{ allowed: boolean; planTier: PlanTier; requiredTier: PlanTier }> {
  const planTier = await getOrgPlanTier(orgId);
  const requiredTier = getRequiredTierForAgent(agentType);
  const allowed = tierMeetsRequirement(planTier, requiredTier);
  return { allowed, planTier, requiredTier };
}
