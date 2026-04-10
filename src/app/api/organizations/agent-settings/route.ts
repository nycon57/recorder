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
  getAgentSettings,
  checkAgentPlanAccess,
  upgradePlanError,
} from '@/lib/services/agent-config';

const BOOLEAN_FIELDS = [
  'curator_enabled',
  'gap_intelligence_enabled',
  'onboarding_enabled',
  'digest_enabled',
  'workflow_extraction_enabled',
  'global_agent_enabled',
] as const;

/** Reverse map: settings column -> agent type (excludes global_agent_enabled) */
const COLUMN_TO_AGENT: Partial<Record<(typeof BOOLEAN_FIELDS)[number], string>> = {
  curator_enabled: 'curator',
  gap_intelligence_enabled: 'gap_intelligence',
  onboarding_enabled: 'onboarding',
  digest_enabled: 'digest',
  workflow_extraction_enabled: 'workflow_extraction',
};

/**
 * GET /api/organizations/agent-settings
 * Returns current agent settings for the authenticated user's org.
 * If no row exists, returns defaults (all disabled except global_agent_enabled).
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const settings = await getAgentSettings(orgId);
  return successResponse(settings);
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

  const updates: Record<string, boolean> = {};
  for (const field of BOOLEAN_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== 'boolean') {
        return errors.badRequest(`Field "${field}" must be a boolean`);
      }
      updates[field] = body[field] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return errors.badRequest('No valid fields to update');
  }

  // Reject if enabling an agent the plan does not allow (disabling is always permitted)
  const agentsBeingEnabled = Object.entries(updates)
    .filter(([, value]) => value)
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
