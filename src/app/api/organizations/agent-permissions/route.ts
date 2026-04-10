import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { getPermissions, setPermission } from '@/lib/services/agent-permissions';
import type { PermissionTier } from '@/lib/types/database';

const VALID_TIERS = new Set<PermissionTier>(['auto', 'notify', 'approve']);

export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();
  const permissions = await getPermissions(orgId);
  return successResponse(permissions);
});

export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }
  const { agent_type, action_type, permission_tier } = body;

  if (!agent_type || typeof agent_type !== 'string') {
    return errors.badRequest('agent_type is required');
  }
  if (!action_type || typeof action_type !== 'string') {
    return errors.badRequest('action_type is required');
  }
  if (!VALID_TIERS.has(permission_tier)) {
    return errors.badRequest('permission_tier must be one of: auto, notify, approve');
  }

  await setPermission(orgId, agent_type, action_type, permission_tier);

  return successResponse({ agent_type, action_type, permission_tier });
});
