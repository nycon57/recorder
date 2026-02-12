/**
 * Agent Permissions Service
 *
 * Three-tier permission system (auto/notify/approve) controlling
 * what agents can do autonomously per org.
 */

import type { Database, PermissionTier, Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AgentPermission =
  Database['public']['Tables']['agent_permissions']['Row'];

export type AgentApproval =
  Database['public']['Tables']['agent_approval_queue']['Row'];

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

// ---------------------------------------------------------------------------
// Approval Queue
// ---------------------------------------------------------------------------

/**
 * Request approval for a Tier 3 action. If a pending approval already
 * exists for the same org/agent/action/content combo, returns the
 * existing ID instead of creating a duplicate.
 */
export async function requestApproval(params: {
  orgId: string;
  agentType: string;
  actionType: string;
  contentId?: string;
  description: string;
  proposedAction: Json;
}): Promise<string> {
  // Check for existing pending approval (dedup)
  let existingQuery = supabaseAdmin
    .from('agent_approval_queue')
    .select('id')
    .eq('org_id', params.orgId)
    .eq('agent_type', params.agentType)
    .eq('action_type', params.actionType)
    .eq('status', 'pending');

  if (params.contentId) {
    existingQuery = existingQuery.eq('content_id', params.contentId);
  } else {
    existingQuery = existingQuery.is('content_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from('agent_approval_queue')
    .insert({
      org_id: params.orgId,
      agent_type: params.agentType,
      action_type: params.actionType,
      content_id: params.contentId ?? null,
      description: params.description,
      proposed_action: params.proposedAction,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to request approval: ${error.message}`);
  }

  return data.id;
}

/**
 * Get pending approvals for an org, ordered newest first.
 * Automatically expires stale entries before returning results.
 */
export async function getPendingApprovals(
  orgId: string,
): Promise<AgentApproval[]> {
  await expireStaleApprovals(orgId);

  const { data, error } = await supabaseAdmin
    .from('agent_approval_queue')
    .select()
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get approvals: ${error.message}`);
  }

  return (data ?? []) as AgentApproval[];
}

/**
 * Approve or reject a pending approval.
 * Returns the updated row or null if not found / not pending.
 */
export async function reviewApproval(
  approvalId: string,
  orgId: string,
  reviewedBy: string,
  action: 'approved' | 'rejected',
  rejectionReason?: string,
): Promise<AgentApproval | null> {
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    status: action,
    reviewed_by: reviewedBy,
    reviewed_at: now,
  };

  if (action === 'rejected' && rejectionReason) {
    updatePayload.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabaseAdmin
    .from('agent_approval_queue')
    .update(updatePayload)
    .eq('id', approvalId)
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to review approval: ${error.message}`);
  }

  return (data as AgentApproval) ?? null;
}

/**
 * Transition pending approvals past their expiry to 'expired'.
 * Called automatically before fetching the queue.
 */
export async function expireStaleApprovals(orgId: string): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('agent_approval_queue')
    .update({ status: 'expired' as const })
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .lt('expires_at', now)
    .select('id');

  if (error) {
    console.error('[AgentPermissions] Failed to expire stale approvals:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}
