import { NextRequest, NextResponse } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  asObject,
  checkAgentPlanAccess,
  getAgentSettings,
  HYBRID_MAX_CONTRADICTIONS_MAX,
  HYBRID_MAX_CONTRADICTIONS_MIN,
  HYBRID_MIN_CONFIDENCE_DELTA_MAX,
  HYBRID_MIN_CONFIDENCE_DELTA_MIN,
  resolveWikiCompilationSettings,
  type WikiCompilationPolicyMetadata,
  WIKI_COMPILATION_POLICY_METADATA_KEY,
  upgradePlanError,
} from '@/lib/services/agent-config';
import type { Json } from '@/lib/types/database';

const BOOLEAN_FIELDS = [
  'curator_enabled',
  'gap_intelligence_enabled',
  'onboarding_enabled',
  'digest_enabled',
  'workflow_extraction_enabled',
  'global_agent_enabled',
  'wiki_auto_publish',
] as const;

/** Reverse map: settings column -> agent type (excludes global_agent_enabled and wiki_auto_publish) */
const COLUMN_TO_AGENT: Partial<Record<(typeof BOOLEAN_FIELDS)[number], string>> = {
  curator_enabled: 'curator',
  gap_intelligence_enabled: 'gap_intelligence',
  onboarding_enabled: 'onboarding',
  digest_enabled: 'digest',
  workflow_extraction_enabled: 'workflow_extraction',
};

/** Bounds for the wiki stale threshold (days). Matches DB CHECK constraint. */
const WIKI_STALE_THRESHOLD_MIN = 1;
const WIKI_STALE_THRESHOLD_MAX = 365;
/**
 * GET /api/organizations/agent-settings
 * Returns current agent settings for the authenticated user's org.
 * If no row exists, returns defaults (all disabled except global_agent_enabled).
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const settings = await getAgentSettings(orgId);
  const wikiSettings = resolveWikiCompilationSettings(settings);

  return successResponse({
    ...settings,
    wiki_contradiction_routing_mode: wikiSettings.contradictionReviewMode,
    wiki_hybrid_auto_publish_enabled: wikiSettings.hybridAutoPublish.enabled,
    wiki_hybrid_max_contradictions:
      wikiSettings.hybridAutoPublish.maxContradictionsForAutoPublish,
    wiki_hybrid_min_confidence_delta:
      wikiSettings.hybridAutoPublish.minConfidenceDeltaForAutoPublish,
  });
});

/**
 * PATCH /api/organizations/agent-settings
 * Partial update of boolean agent toggles (admin only).
 *
 * Returns 403 when attempting to enable an agent that the org's plan tier
 * does not include: { error, upgradeUrl }.
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const updates: Record<string, boolean | number | Json> = {};
  for (const field of BOOLEAN_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== 'boolean') {
        return errors.badRequest(`Field "${field}" must be a boolean`);
      }
      updates[field] = body[field] as boolean;
    }
  }

  if ('wiki_stale_threshold_days' in body) {
    const value = body.wiki_stale_threshold_days;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < WIKI_STALE_THRESHOLD_MIN ||
      value > WIKI_STALE_THRESHOLD_MAX
    ) {
      return errors.badRequest(
        `Field "wiki_stale_threshold_days" must be an integer between ${WIKI_STALE_THRESHOLD_MIN} and ${WIKI_STALE_THRESHOLD_MAX}`
      );
    }
    updates.wiki_stale_threshold_days = value;
  }

  let policyPatch: WikiCompilationPolicyMetadata | null = null;
  if ('wiki_hybrid_auto_publish_enabled' in body) {
    const value = body.wiki_hybrid_auto_publish_enabled;
    if (typeof value !== 'boolean') {
      return errors.badRequest('Field "wiki_hybrid_auto_publish_enabled" must be a boolean');
    }
    policyPatch = {
      ...(policyPatch ?? {}),
      hybrid_auto_publish_enabled: value,
    };
  }

  if ('wiki_hybrid_max_contradictions' in body) {
    const value = body.wiki_hybrid_max_contradictions;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < HYBRID_MAX_CONTRADICTIONS_MIN ||
      value > HYBRID_MAX_CONTRADICTIONS_MAX
    ) {
      return errors.badRequest(
        `Field "wiki_hybrid_max_contradictions" must be an integer between ${HYBRID_MAX_CONTRADICTIONS_MIN} and ${HYBRID_MAX_CONTRADICTIONS_MAX}`
      );
    }
    policyPatch = {
      ...(policyPatch ?? {}),
      hybrid_max_contradictions_for_auto_publish: value,
    };
  }

  if ('wiki_hybrid_min_confidence_delta' in body) {
    const value = body.wiki_hybrid_min_confidence_delta;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < HYBRID_MIN_CONFIDENCE_DELTA_MIN ||
      value > HYBRID_MIN_CONFIDENCE_DELTA_MAX
    ) {
      return errors.badRequest(
        `Field "wiki_hybrid_min_confidence_delta" must be a number between ${HYBRID_MIN_CONFIDENCE_DELTA_MIN} and ${HYBRID_MIN_CONFIDENCE_DELTA_MAX}`
      );
    }
    policyPatch = {
      ...(policyPatch ?? {}),
      hybrid_min_confidence_delta_for_auto_publish: value,
    };
  }

  const requestedWikiAutoPublish =
    'wiki_auto_publish' in body ? (updates.wiki_auto_publish as boolean) : undefined;
  const requestedHybridEnabled =
    'wiki_hybrid_auto_publish_enabled' in body
      ? policyPatch?.hybrid_auto_publish_enabled
      : undefined;

  if (requestedWikiAutoPublish === false && requestedHybridEnabled === true) {
    return errors.badRequest(
      'Field "wiki_hybrid_auto_publish_enabled" cannot be true when "wiki_auto_publish" is false'
    );
  }

  if (requestedWikiAutoPublish === false) {
    policyPatch = {
      ...(policyPatch ?? {}),
      hybrid_auto_publish_enabled: false,
    };
  }

  if (requestedWikiAutoPublish === true && requestedHybridEnabled === undefined) {
    policyPatch = {
      ...(policyPatch ?? {}),
      hybrid_auto_publish_enabled: false,
    };
  }

  if (requestedHybridEnabled === true) {
    updates.wiki_auto_publish = true;
  }

  if (policyPatch) {
    const existingSettings = await getAgentSettings(orgId);
    const rootMetadata = asObject(existingSettings.metadata);
    const existingPolicy = asObject(rootMetadata[WIKI_COMPILATION_POLICY_METADATA_KEY]);

    updates.metadata = {
      ...rootMetadata,
      [WIKI_COMPILATION_POLICY_METADATA_KEY]: {
        ...existingPolicy,
        ...policyPatch,
      },
    } as unknown as Json;
  }

  if (Object.keys(updates).length === 0) {
    return errors.badRequest('No valid fields to update');
  }

  // Reject if enabling an agent the plan does not allow (disabling is always permitted)
  const agentsBeingEnabled = Object.entries(updates)
    .filter(([, value]) => value === true)
    .map(([field]) => COLUMN_TO_AGENT[field as (typeof BOOLEAN_FIELDS)[number]])
    .filter((agentType): agentType is string => !!agentType);

  const accessResults = await Promise.all(
    agentsBeingEnabled.map((agentType) => checkAgentPlanAccess(orgId, agentType))
  );
  if (accessResults.some((r) => !r.allowed)) {
    return NextResponse.json(upgradePlanError(), { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('org_agent_settings')
    .upsert(
      { org_id: orgId, ...updates },
      { onConflict: 'org_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[PATCH /api/organizations/agent-settings] Error:', error);
    return errors.internalError();
  }

  return successResponse(data);
});
