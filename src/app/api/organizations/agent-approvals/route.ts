import {
  apiHandler,
  requireAdmin,
  successResponse,
} from '@/lib/utils/api';
import { getPendingApprovals } from '@/lib/services/agent-permissions';

/**
 * GET /api/organizations/agent-approvals
 * List all approvals for the org (pending first, then recent).
 * Automatically expires stale entries before returning.
 */
export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();
  const approvals = await getPendingApprovals(orgId);
  return successResponse(approvals);
});
