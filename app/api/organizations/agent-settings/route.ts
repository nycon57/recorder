import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getAgentSettings } from '@/lib/services/agent-config';

/** Boolean setting columns that PATCH may update */
const BOOLEAN_FIELDS = [
  'curator_enabled',
  'gap_intelligence_enabled',
  'onboarding_enabled',
  'digest_enabled',
  'workflow_extraction_enabled',
  'global_agent_enabled',
] as const;

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
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const body = await request.json();

  // Validate: only allow known boolean fields
  const updates: Record<string, boolean> = {};
  for (const field of BOOLEAN_FIELDS) {
    if (field in body) {
      if (typeof body[field] !== 'boolean') {
        return errors.badRequest(`Field "${field}" must be a boolean`);
      }
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return errors.badRequest('No valid fields to update');
  }

  // Upsert: create row with defaults if missing, then apply updates
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
