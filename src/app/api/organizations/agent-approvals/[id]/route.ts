import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { reviewApproval } from '@/lib/services/agent-permissions';
import { logAgentAction } from '@/lib/services/agent-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/organizations/agent-approvals/[id]
 * Approve or reject a pending approval.
 *
 * Body: { action: 'approved' | 'rejected', rejection_reason?: string }
 */
export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId, userId } = await requireAdmin();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }
  const { action, rejection_reason } = body;

  if (action !== 'approved' && action !== 'rejected') {
    return errors.badRequest('action must be "approved" or "rejected"');
  }

  const result = await reviewApproval(
    id,
    orgId,
    userId,
    action,
    typeof rejection_reason === 'string' ? rejection_reason : undefined,
  );

  if (!result) {
    return errors.notFound('Approval');
  }

  // On rejection, log to agent_activity_log so the agent knows
  if (action === 'rejected') {
    await logAgentAction({
      orgId,
      agentType: result.agent_type,
      actionType: result.action_type,
      contentId: result.content_id ?? undefined,
      outcome: 'skipped',
      outputSummary: `Approval rejected: ${rejection_reason ?? 'No reason provided'}`,
      metadata: { approvalId: id, reviewedBy: userId },
    });
  }

  return successResponse(result);
});
