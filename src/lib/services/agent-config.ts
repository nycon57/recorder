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

import type { Database, Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type OrgAgentSettings = Database['public']['Tables']['org_agent_settings']['Row'];

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export const AGENT_COLUMN_MAP: Record<string, keyof OrgAgentSettings> = {
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
  wiki_auto_publish: false,
  wiki_stale_threshold_days: 90,
  metadata: {},
};

/**
 * Compilation-engine settings consumed by TRIB-32 (compile_wiki) and the
 * future wiki lint scheduled job.
 *
 * - wikiAutoPublish: when true, the compile handler auto-supersedes contradictory
 *   wiki content. When false, contradictions are flagged for admin review (TRIB-34).
 * - wikiStaleThresholdDays: age threshold (days) after which a wiki page is marked
 *   stale by the wiki lint scheduled job (future ticket).
 */
export interface WikiCompilationSettings {
  wikiAutoPublish: boolean;
  wikiStaleThresholdDays: number;
  contradictionReviewMode: 'manual' | 'auto' | 'hybrid';
  hybridAutoPublish: {
    enabled: boolean;
    maxContradictionsForAutoPublish: number;
    minConfidenceDeltaForAutoPublish: number;
  };
}

const DEFAULT_WIKI_COMPILATION_SETTINGS: WikiCompilationSettings = {
  wikiAutoPublish: false,
  wikiStaleThresholdDays: 90,
  contradictionReviewMode: 'manual',
  hybridAutoPublish: {
    enabled: false,
    maxContradictionsForAutoPublish: 1,
    minConfidenceDeltaForAutoPublish: 0,
  },
};

const WIKI_COMPILATION_POLICY_METADATA_KEY = 'wiki_compilation_review_policy';
const HYBRID_MAX_CONTRADICTIONS_MIN = 1;
const HYBRID_MAX_CONTRADICTIONS_MAX = 10;
const HYBRID_MIN_CONFIDENCE_DELTA_MIN = -0.2;
const HYBRID_MIN_CONFIDENCE_DELTA_MAX = 0.2;

interface WikiCompilationPolicyMetadata {
  hybrid_auto_publish_enabled?: boolean;
  hybrid_max_contradictions_for_auto_publish?: number;
  hybrid_min_confidence_delta_for_auto_publish?: number;
}

function asObject(value: Json | null | undefined): Record<string, Json | undefined> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, Json | undefined>;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readWikiCompilationPolicyMetadata(
  metadata: Json | null | undefined
): WikiCompilationPolicyMetadata {
  const root = asObject(metadata);
  const raw = root[WIKI_COMPILATION_POLICY_METADATA_KEY];
  const policy = asObject(raw);

  const hybridEnabled =
    typeof policy.hybrid_auto_publish_enabled === 'boolean'
      ? policy.hybrid_auto_publish_enabled
      : DEFAULT_WIKI_COMPILATION_SETTINGS.hybridAutoPublish.enabled;

  const maxContradictionsRaw = policy.hybrid_max_contradictions_for_auto_publish;
  const maxContradictions =
    typeof maxContradictionsRaw === 'number' && Number.isFinite(maxContradictionsRaw)
      ? Math.round(
          clampNumber(
            maxContradictionsRaw,
            HYBRID_MAX_CONTRADICTIONS_MIN,
            HYBRID_MAX_CONTRADICTIONS_MAX
          )
        )
      : DEFAULT_WIKI_COMPILATION_SETTINGS.hybridAutoPublish.maxContradictionsForAutoPublish;

  const minConfidenceRaw = policy.hybrid_min_confidence_delta_for_auto_publish;
  const minConfidenceDelta =
    typeof minConfidenceRaw === 'number' && Number.isFinite(minConfidenceRaw)
      ? clampNumber(
          minConfidenceRaw,
          HYBRID_MIN_CONFIDENCE_DELTA_MIN,
          HYBRID_MIN_CONFIDENCE_DELTA_MAX
        )
      : DEFAULT_WIKI_COMPILATION_SETTINGS.hybridAutoPublish.minConfidenceDeltaForAutoPublish;

  return {
    hybrid_auto_publish_enabled: hybridEnabled,
    hybrid_max_contradictions_for_auto_publish: maxContradictions,
    hybrid_min_confidence_delta_for_auto_publish: minConfidenceDelta,
  };
}

type WikiCompilationSettingsSource = Pick<
  OrgAgentSettings,
  'wiki_auto_publish' | 'wiki_stale_threshold_days' | 'metadata'
>;

export function resolveWikiCompilationSettings(
  row: WikiCompilationSettingsSource | null | undefined
): WikiCompilationSettings {
  const metadataPolicy = readWikiCompilationPolicyMetadata(row?.metadata);
  const wikiAutoPublish =
    row?.wiki_auto_publish ?? DEFAULT_WIKI_COMPILATION_SETTINGS.wikiAutoPublish;
  const hybridEnabled = wikiAutoPublish && (metadataPolicy.hybrid_auto_publish_enabled ?? false);
  const contradictionReviewMode: WikiCompilationSettings['contradictionReviewMode'] =
    hybridEnabled ? 'hybrid' : wikiAutoPublish ? 'auto' : 'manual';

  return {
    wikiAutoPublish,
    wikiStaleThresholdDays:
      row?.wiki_stale_threshold_days ?? DEFAULT_WIKI_COMPILATION_SETTINGS.wikiStaleThresholdDays,
    contradictionReviewMode,
    hybridAutoPublish: {
      enabled: hybridEnabled,
      maxContradictionsForAutoPublish:
        metadataPolicy.hybrid_max_contradictions_for_auto_publish ??
        DEFAULT_WIKI_COMPILATION_SETTINGS.hybridAutoPublish.maxContradictionsForAutoPublish,
      minConfidenceDeltaForAutoPublish:
        metadataPolicy.hybrid_min_confidence_delta_for_auto_publish ??
        DEFAULT_WIKI_COMPILATION_SETTINGS.hybridAutoPublish.minConfidenceDeltaForAutoPublish,
    },
  };
}

/** Agents unlocked per plan tier -- single source of truth for plan gating */
const TIER_ALLOWED_AGENTS: Record<PlanTier, ReadonlySet<string>> = {
  free: new Set<string>(),
  starter: new Set(['onboarding', 'digest']),
  professional: new Set(['onboarding', 'digest', 'curator']),
  enterprise: new Set(['curator', 'gap_intelligence', 'onboarding', 'digest', 'workflow_extraction']),
};

const TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

/** Tiers sorted lowest to highest, derived from TIER_ORDER */
const TIERS_ASCENDING = (Object.keys(TIER_ORDER) as PlanTier[]).sort(
  (a, b) => TIER_ORDER[a] - TIER_ORDER[b]
);

function tierMeetsRequirement(actual: PlanTier, required: PlanTier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[required];
}

/**
 * Determine the minimum plan tier an agent requires.
 * Returns 'enterprise' for unknown agents (safest default).
 */
export function getRequiredTierForAgent(agentType: string): PlanTier {
  for (const tier of TIERS_ASCENDING) {
    if (TIER_ALLOWED_AGENTS[tier].has(agentType)) return tier;
  }
  return 'enterprise';
}

/** Returns 'free' when no quota row exists (safe default). */
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

/** Used by API routes to gate access and generate specific 403 messages. */
export function planTierAllowsAgent(planTier: PlanTier, agentType: string): boolean {
  return TIER_ALLOWED_AGENTS[planTier]?.has(agentType) ?? false;
}

/** Returns the stored row or synthesized defaults when no row exists. */
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
 * Returns false when the org's plan tier excludes the agent,
 * the global kill switch is off, or the individual toggle is off.
 */
export async function isAgentEnabled(orgId: string, agentType: string): Promise<boolean> {
  const [planTier, settings] = await Promise.all([
    getOrgPlanTier(orgId),
    getAgentSettings(orgId),
  ]);

  if (!planTierAllowsAgent(planTier, agentType)) {
    return false;
  }

  if (!settings.global_agent_enabled) {
    return false;
  }

  const column = AGENT_COLUMN_MAP[agentType];
  if (!column) {
    return false;
  }

  return settings[column] === true;
}

/** HTTP 403 body when an org's plan tier blocks agent access. */
export function upgradePlanError() {
  return {
    error: 'Agent features require Pro or Enterprise plan',
    upgradeUrl: '/settings/billing',
  } as const;
}

/** Check whether an org's plan tier satisfies the requirement for a given agent. */
export async function checkAgentPlanAccess(
  orgId: string,
  agentType: string
): Promise<{ allowed: boolean; planTier: PlanTier; requiredTier: PlanTier }> {
  const planTier = await getOrgPlanTier(orgId);
  const requiredTier = getRequiredTierForAgent(agentType);
  const allowed = tierMeetsRequirement(planTier, requiredTier);
  return { allowed, planTier, requiredTier };
}

/**
 * Return the org's compilation-engine settings consumed by TRIB-32's compile_wiki
 * handler and the future wiki lint scheduled job. Falls back to safe defaults
 * ({ wikiAutoPublish: false, wikiStaleThresholdDays: 90 }) when the row is missing
 * or on any database error, so callers never need to branch on the error path.
 *
 * Reuses getAgentSettings() so it automatically synthesizes defaults on missing
 * rows and keeps a single read path against org_agent_settings.
 */
export async function getWikiCompilationSettings(
  orgId: string
): Promise<WikiCompilationSettings> {
  try {
    const row = await getAgentSettings(orgId);
    return resolveWikiCompilationSettings(row);
  } catch {
    return resolveWikiCompilationSettings(null);
  }
}

/**
 * Decide whether a contradiction should be auto-applied or routed to review
 * using the org's configured compilation settings.
 */
export function shouldAutoApplyWikiContradiction(
  settings: WikiCompilationSettings,
  input: { contradictionCount: number; confidenceDelta: number }
): boolean {
  if (settings.contradictionReviewMode === 'manual') {
    return false;
  }
  if (settings.contradictionReviewMode === 'auto') {
    return true;
  }

  return (
    input.contradictionCount <= settings.hybridAutoPublish.maxContradictionsForAutoPublish &&
    input.confidenceDelta >= settings.hybridAutoPublish.minConfidenceDeltaForAutoPublish
  );
}
