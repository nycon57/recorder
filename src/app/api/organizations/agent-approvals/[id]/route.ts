import { NextRequest } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { reviewApproval } from '@/lib/services/agent-permissions';
import { logAgentAction } from '@/lib/services/agent-logger';
import {
  determineRoutingReviewDecisionAction,
  enqueueRoutingCompileWikiJob,
  normalizeRoutingApp,
  normalizeRoutingSlug,
  parseRoutingReviewProposedAction,
  parseRoutingReviewState,
  ROUTING_REVIEW_ACTION_TYPE,
  writeRoutingReviewState,
  type RoutingReviewDecisionAction,
} from '@/lib/services/routing-review';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type AgentApprovalRow = Database['public']['Tables']['agent_approval_queue']['Row'];
type ContentRow = Database['public']['Tables']['content']['Row'];

interface LoadedRoutingApproval {
  approval: Pick<
    AgentApprovalRow,
    'id' | 'org_id' | 'action_type' | 'agent_type' | 'content_id' | 'proposed_action' | 'status' | 'created_at'
  >;
  content: Pick<ContentRow, 'id' | 'org_id' | 'metadata' | 'title' | 'updated_at'>;
}

async function loadRoutingApproval(
  approvalId: string,
  orgId: string,
): Promise<LoadedRoutingApproval | null> {
  const { data: approvalData, error: approvalError } = await supabaseAdmin
    .from('agent_approval_queue')
    .select('id, org_id, action_type, agent_type, content_id, proposed_action, status, created_at')
    .eq('id', approvalId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (approvalError) {
    throw new Error(`Failed to load approval: ${approvalError.message}`);
  }
  if (!approvalData) {
    return null;
  }

  const approval = approvalData as LoadedRoutingApproval['approval'];
  if (approval.action_type !== ROUTING_REVIEW_ACTION_TYPE) {
    return null;
  }
  if (approval.status !== 'pending') {
    throw new Error(`Approval is already ${approval.status}`);
  }
  if (!approval.content_id) {
    throw new Error('Routing approval is missing content context');
  }

  const { data: contentData, error: contentError } = await supabaseAdmin
    .from('content')
    .select('id, org_id, metadata, title, updated_at')
    .eq('id', approval.content_id)
    .eq('org_id', orgId)
    .single();

  if (contentError || !contentData) {
    throw new Error('Source content not found for routing approval');
  }

  return {
    approval,
    content: contentData as LoadedRoutingApproval['content'],
  };
}

function clampConfidence(value: number | null): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function resolveApprovedRoute(body: Record<string, unknown>, proposedRoute: {
  topic: string;
  app: string | null;
  screen: string | null;
}) {
  const topic = normalizeRoutingSlug(body.topic) ?? proposedRoute.topic;
  const app =
    body.app === undefined ? proposedRoute.app : normalizeRoutingApp(body.app);
  const screen =
    body.screen === undefined ? proposedRoute.screen : normalizeRoutingSlug(body.screen);

  if (!topic) {
    throw new Error('Approved routing requires topic');
  }

  return { topic, app, screen };
}

function normalizeDecisionHint(value: unknown): RoutingReviewDecisionAction | null {
  if (value === 'approve' || value === 'edit_and_approve' || value === 'reroute') {
    return value;
  }
  return null;
}

async function applyRoutingReviewDecision(input: {
  approval: LoadedRoutingApproval['approval'];
  content: LoadedRoutingApproval['content'];
  orgId: string;
  userId: string;
  action: 'approved' | 'rejected';
  body: Record<string, unknown>;
  rejectionReason?: string;
}): Promise<void> {
  const proposedAction = parseRoutingReviewProposedAction(input.approval.proposed_action);
  if (!proposedAction) {
    throw new Error('Routing review payload is invalid');
  }

  let content = input.content;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nowIso = new Date().toISOString();
    const previousState = parseRoutingReviewState(content.metadata);
    const approvedRoute =
      input.action === 'approved'
        ? resolveApprovedRoute(input.body, proposedAction.proposedRoute)
        : null;
    const decisionAction = determineRoutingReviewDecisionAction({
      status: input.action,
      proposedRoute: proposedAction.proposedRoute,
      approvedRoute,
      decisionHint: normalizeDecisionHint(input.body.decisionAction),
    });
    const decisionVersion = (previousState?.decisionVersion ?? 0) + 1;
    const routingState = {
      status: input.action,
      approvalId: input.approval.id,
      requestedAt: input.approval.created_at,
      reviewedAt: nowIso,
      reviewedBy: input.userId,
      rejectionReason: input.action === 'rejected'
        ? input.rejectionReason ?? 'Reviewer rejected the proposed route.'
        : null,
      routeConfidence: clampConfidence(proposedAction.routeConfidence),
      routeReason: proposedAction.routeReason,
      proposedRoute: proposedAction.proposedRoute,
      approvedRoute,
      decisionVersion,
      lastAction: decisionAction,
      history: [
        ...(previousState?.history ?? []),
        {
          version: decisionVersion,
          action: decisionAction,
          decidedAt: nowIso,
          decidedBy: input.userId,
          approvalId: input.approval.id,
          rejectionReason: input.action === 'rejected'
            ? input.rejectionReason ?? 'Reviewer rejected the proposed route.'
            : null,
          routeConfidence: clampConfidence(proposedAction.routeConfidence),
          routeReason: proposedAction.routeReason,
          proposedRoute: proposedAction.proposedRoute,
          approvedRoute,
        },
      ].slice(-50),
    };
    const nextMetadata = writeRoutingReviewState(content.metadata, routingState);

    const { data: updatedContent, error: contentUpdateError } = await supabaseAdmin
      .from('content')
      .update({
        metadata: nextMetadata,
        updated_at: nowIso,
      } as never)
      .eq('id', content.id)
      .eq('org_id', input.orgId)
      .eq('updated_at', content.updated_at)
      .select('id')
      .maybeSingle();

    if (contentUpdateError) {
      throw new Error(`Failed to persist routing review state: ${contentUpdateError.message}`);
    }
    if (updatedContent) {
      break;
    }
    if (attempt === 1) {
      throw new Error('Failed to persist routing review state: content changed during review');
    }

    const { data: latestContent, error: latestContentError } = await supabaseAdmin
      .from('content')
      .select('id, org_id, metadata, title, updated_at')
      .eq('id', content.id)
      .eq('org_id', input.orgId)
      .single();

    if (latestContentError || !latestContent) {
      throw new Error('Failed to reload content after routing metadata conflict');
    }

    content = latestContent as LoadedRoutingApproval['content'];
  }

  if (input.action === 'approved') {
    await enqueueRoutingCompileWikiJob({
      recordingId: content.id,
      orgId: input.orgId,
      approvalId: input.approval.id,
    });
  }
}

async function resetClaimedRoutingApproval(input: {
  approvalId: string;
  orgId: string;
  userId: string;
  action: 'approved' | 'rejected';
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_approval_queue')
    .update({
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    } as never)
    .eq('id', input.approvalId)
    .eq('org_id', input.orgId)
    .eq('status', input.action)
    .eq('reviewed_by', input.userId);

  if (error) {
    throw new Error(`Failed to reset routing approval claim: ${error.message}`);
  }
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

  let routingApproval: LoadedRoutingApproval | null;
  try {
    routingApproval = await loadRoutingApproval(id, orgId);
  } catch (error) {
    return errors.badRequest(
      error instanceof Error ? error.message : 'Failed to load approval',
    );
  }
  if (routingApproval) {
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

    try {
      await applyRoutingReviewDecision({
        approval: routingApproval.approval,
        content: routingApproval.content,
        orgId,
        userId,
        action,
        body,
        rejectionReason: typeof rejection_reason === 'string' ? rejection_reason : undefined,
      });
    } catch (error) {
      try {
        await resetClaimedRoutingApproval({
          approvalId: id,
          orgId,
          userId,
          action,
        });
      } catch (resetError) {
        console.error('[AgentApprovals] Failed to reset routing approval after side-effect failure', {
          approvalId: id,
          orgId,
          userId,
          action,
          error,
          resetError,
        });
      }
      return errors.badRequest(
        error instanceof Error ? error.message : 'Failed to review routing approval',
      );
    }

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
