import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { getPermissions, setPermission } from '@/lib/services/agent-permissions';
import type { PermissionTier } from '@/lib/types/database';

const VALID_TIERS: PermissionTier[] = ['auto', 'notify', 'approve'];

/**
 * GET /api/organizations/agent-permissions
 * Returns all agent permission rows for the authenticated user's org.
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireOrg();
  const permissions = await getPermissions(orgId);
  return successResponse(permissions);
});

/**
 * PATCH /api/organizations/agent-permissions
 * Upsert a single permission tier (admin only).
 * Body: { agent_type: string, action_type: string, permission_tier: 'auto' | 'notify' | 'approve' }
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const body = await request.json();
  const { agent_type, action_type, permission_tier } = body;

  if (!agent_type || typeof agent_type !== 'string') {
    return errors.badRequest('agent_type is required');
  }
  if (!action_type || typeof action_type !== 'string') {
    return errors.badRequest('action_type is required');
  }
  if (!permission_tier || !VALID_TIERS.includes(permission_tier)) {
    return errors.badRequest('permission_tier must be one of: auto, notify, approve');
  }

  await setPermission(orgId, agent_type, action_type, permission_tier);

  return successResponse({ agent_type, action_type, permission_tier });
});
