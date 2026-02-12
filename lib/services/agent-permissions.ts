/**
 * Agent Permissions Service
 *
 * Three-tier permission system (auto/notify/approve) controlling
 * what agents can do autonomously per org.
 */

import type { Database, PermissionTier } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AgentPermission =
  Database['public']['Tables']['agent_permissions']['Row'];

/**
 * Default tier mapping used when no row exists for a given
 * (agent_type, action_type) pair. Keeps the safe default ('notify')
 * without requiring a database round-trip for every unknown action.
 */
const DEFAULT_TIERS: Record<string, PermissionTier> = {
  // Tier 1 — auto
  extract_concepts: 'auto',
  generate_metadata: 'auto',
  detect_duplicate: 'auto',
  detect_stale: 'auto',
  // Tier 2 — notify
  suggest_tags: 'notify',
  suggest_merge: 'notify',
  detect_bus_factor: 'notify',
  gap_alert: 'notify',
  // Tier 3 — approve
  auto_apply_tags: 'approve',
  merge_content: 'approve',
  archive_content: 'approve',
  publish_external: 'approve',
};

/**
 * Look up the permission tier for a specific action.
 *
 * Resolution order:
 *  1. Org-specific row in agent_permissions
 *  2. Hardcoded DEFAULT_TIERS (matches seeded defaults)
 *  3. 'notify' as the safe fallback
 */
export async function checkPermission(
  orgId: string,
  agentType: string,
  actionType: string,
): Promise<PermissionTier> {
  const { data, error } = await supabaseAdmin
    .from('agent_permissions')
    .select('permission_tier')
    .eq('org_id', orgId)
    .eq('agent_type', agentType)
    .eq('action_type', actionType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check permission: ${error.message}`);
  }

  if (!data) {
    return DEFAULT_TIERS[actionType] ?? 'notify';
  }

  return data.permission_tier as PermissionTier;
}

/**
 * Get all permissions for an org, optionally filtered by agent type.
 */
export async function getPermissions(
  orgId: string,
  agentType?: string,
): Promise<AgentPermission[]> {
  let query = supabaseAdmin
    .from('agent_permissions')
    .select()
    .eq('org_id', orgId);

  if (agentType) {
    query = query.eq('agent_type', agentType);
  }

  const { data, error } = await query.order('action_type');

  if (error) {
    throw new Error(`Failed to get permissions: ${error.message}`);
  }

  return (data ?? []) as AgentPermission[];
}

/**
 * Set (upsert) the permission tier for a specific org/agent/action.
 * Creates the row if it doesn't exist; updates it otherwise.
 */
export async function setPermission(
  orgId: string,
  agentType: string,
  actionType: string,
  tier: PermissionTier,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_permissions')
    .upsert(
      {
        org_id: orgId,
        agent_type: agentType,
        action_type: actionType,
        permission_tier: tier,
      },
      { onConflict: 'org_id,agent_type,action_type' },
    );

  if (error) {
    throw new Error(`Failed to set permission: ${error.message}`);
  }
}
