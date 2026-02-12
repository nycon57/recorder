/**
 * Agent Configuration Service
 *
 * Per-org agent toggle settings. Each org has at most one row
 * in org_agent_settings; missing rows resolve to defaults.
 */

import type { Database } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type OrgAgentSettings = Database['public']['Tables']['org_agent_settings']['Row'];

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
 * Returns false if global_agent_enabled is off (kill switch),
 * even when the individual toggle is on.
 */
export async function isAgentEnabled(orgId: string, agentType: string): Promise<boolean> {
  const settings = await getAgentSettings(orgId);

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
