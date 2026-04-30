'use server';

/**
 * Admin wiki review server actions — TRIB-34
 *
 * Three mutations against `org_wiki_pages.compilation_log` flagged entries:
 *
 *   - approveContradiction: supersede the page with either the flagged
 *     entry's `merged_content` (if TRIB-32 ever stashes one) or a naive
 *     application of the contradictions list.
 *   - rejectContradiction: mark the flagged entry rejected in place and
 *     leave page content untouched.
 *   - editAndApproveContradiction: supersede the page with admin-provided
 *     content.
 *
 * All three:
 *   1. Call `requireAdmin()` — owner/admin role in the page's org.
 *   2. Verify the target page belongs to the caller's org.
 *   3. Patch the flagged log entry with `resolved_at` + `resolved_by`.
 *   4. Use the supersede pattern (valid_until + new row with supersedes_id)
 *      for approve paths, matching TRIB-32's auto-publish branch.
 *   5. `revalidatePath('/admin/wiki-review')` so the page re-renders empty
 *      when the last pending entry is resolved.
 *   6. `updateTag('wiki-review-count:<orgId>')` so the nav badge updates
 *      with read-your-own-writes semantics on the next render.
 */

import { revalidatePath, updateTag } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/utils/api';
import { logger } from '@/lib/utils/logger';
import type { Database, Json } from '@/lib/types/database';
import { reviewApproval } from '@/lib/services/agent-permissions';
import { generateOrgWikiPageEmbeddingBestEffort } from '@/lib/services/org-wiki-embedding';
import {
  buildKnowledgeReviewTelemetry,
  recordKnowledgeTelemetryEvent,
} from '@/lib/services/knowledge-telemetry';
import {
  determineRoutingReviewDecisionAction,
  ROUTING_REVIEW_ACTION_TYPE,
  enqueueRoutingCompileWikiJob,
  normalizeRoutingApp,
  normalizeRoutingSlug,
  parseRoutingReviewState,
  parseRoutingReviewProposedAction,
  type RoutingReviewDecisionAction,
  type RoutingReviewState,
  writeRoutingReviewState,
} from '@/lib/services/routing-review';
import {
  applyContradictionsToContent,
  readCompilationLog,
  type CompilationLogEntry,
  type OrgWikiPageRow,
} from '@/lib/services/wiki-review';

type OrgWikiPageInsert = Database['public']['Tables']['org_wiki_pages']['Insert'];
type AgentApprovalRow = Database['public']['Tables']['agent_approval_queue']['Row'];
type ContentRow = Database['public']['Tables']['content']['Row'];

const WIKI_REVIEW_PATH = '/admin/wiki-review';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface LoadedTarget {
  page: OrgWikiPageRow;
  log: CompilationLogEntry[];
  entry: CompilationLogEntry;
}

interface LoadedRoutingApprovalTarget {
  approval: Pick<
    AgentApprovalRow,
    'id' | 'org_id' | 'action_type' | 'content_id' | 'proposed_action' | 'status' | 'created_at'
  >;
  content: Pick<ContentRow, 'id' | 'org_id' | 'metadata' | 'title' | 'updated_at'>;
}

interface ReviewAuditLogInput {
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  oldValues?: Json | null;
  newValues?: Json | null;
  metadata?: Record<string, Json>;
}

interface RoutingDecisionStateResult {
  state: RoutingReviewState;
  decisionAction: RoutingReviewDecisionAction;
}

/**
 * Load the page + validate the flagged entry at `logEntryIndex`. Throws with
 * human-readable messages so the calling action can surface them via
 * `ActionResult.error`.
 */
async function loadAndValidateTarget(input: {
  pageId: string;
  logEntryIndex: number;
  orgId: string;
}): Promise<LoadedTarget> {
  const { pageId, logEntryIndex, orgId } = input;

  const { data, error } = await supabaseAdmin
    .from('org_wiki_pages')
    .select(
      'id, org_id, app, screen, topic, content, confidence, valid_from, valid_until, supersedes_id, compilation_log, created_at, updated_at'
    )
    .eq('id', pageId)
    .single();

  if (error || !data) {
    throw new Error('Page not found');
  }

  const page = data as OrgWikiPageRow;

  if (page.org_id !== orgId) {
    throw new Error('Page does not belong to your organization');
  }

  if (page.valid_until !== null) {
    throw new Error('Page has already been superseded');
  }

  const log = readCompilationLog(page.compilation_log);
  const entry = log[logEntryIndex];

  if (!entry) {
    throw new Error('Log entry not found');
  }

  if (entry.action !== 'flagged') {
    throw new Error(`Log entry is already ${entry.action}`);
  }

  if ((entry.resolved_at ?? null) !== null) {
    throw new Error('Log entry has already been resolved');
  }

  return { page, log, entry };
}

async function loadAndValidateRoutingApproval(input: {
  approvalId: string;
  contentId: string;
  orgId: string;
}): Promise<LoadedRoutingApprovalTarget> {
  const { approvalId, contentId, orgId } = input;

  const { data: approvalData, error: approvalError } = await supabaseAdmin
    .from('agent_approval_queue')
    .select('id, org_id, action_type, content_id, proposed_action, status, created_at')
    .eq('id', approvalId)
    .single();

  if (approvalError || !approvalData) {
    throw new Error('Routing review item not found');
  }

  const approval = approvalData as LoadedRoutingApprovalTarget['approval'];
  if (approval.org_id !== orgId) {
    throw new Error('Routing review item does not belong to your organization');
  }
  if (approval.action_type !== ROUTING_REVIEW_ACTION_TYPE) {
    throw new Error('Review item is not a routing request');
  }
  if (approval.status !== 'pending') {
    throw new Error(`Review item is already ${approval.status}`);
  }
  if (approval.content_id !== contentId) {
    throw new Error('Review item does not match the selected source');
  }

  const { data: contentData, error: contentError } = await supabaseAdmin
    .from('content')
    .select('id, org_id, metadata, title, updated_at')
    .eq('id', contentId)
    .eq('org_id', orgId)
    .single();

  if (contentError || !contentData) {
    throw new Error('Source content not found');
  }

  return {
    approval,
    content: contentData as LoadedRoutingApprovalTarget['content'],
  };
}

/**
 * Clamp a confidence value into [0, 1]. Mirrors the helper in compile-wiki.
 */
function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

async function writeReviewAuditLog(input: ReviewAuditLogInput): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    org_id: input.orgId,
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    metadata: (input.metadata ?? {}) as Json,
  });

  if (error) {
    logger.error('Failed to write review audit log', {
      context: {
        orgId: input.orgId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
      error,
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

function buildRoutingDecisionState(input: {
  existingMetadata: Json | null;
  approvalId: string;
  requestedAt: string | null;
  reviewedAt: string;
  reviewedBy: string;
  status: 'approved' | 'rejected';
  rejectionReason: string | null;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: {
    topic: string;
    app: string | null;
    screen: string | null;
  };
  approvedRoute: {
    topic: string;
    app: string | null;
    screen: string | null;
  } | null;
  decisionHint?: RoutingReviewDecisionAction | null;
}): RoutingDecisionStateResult {
  const previousState = parseRoutingReviewState(input.existingMetadata);
  const decisionVersion = (previousState?.decisionVersion ?? 0) + 1;
  const decisionAction = determineRoutingReviewDecisionAction({
    status: input.status,
    proposedRoute: input.proposedRoute,
    approvedRoute: input.approvedRoute,
    decisionHint: input.decisionHint,
  });

  const history = [
    ...(previousState?.history ?? []),
    {
      version: decisionVersion,
      action: decisionAction,
      decidedAt: input.reviewedAt,
      decidedBy: input.reviewedBy,
      approvalId: input.approvalId,
      rejectionReason: input.rejectionReason,
      routeConfidence: input.routeConfidence,
      routeReason: input.routeReason,
      proposedRoute: input.proposedRoute,
      approvedRoute: input.approvedRoute,
    },
  ].slice(-50);

  return {
    decisionAction,
    state: {
      status: input.status,
      approvalId: input.approvalId,
      requestedAt: input.requestedAt,
      reviewedAt: input.reviewedAt,
      reviewedBy: input.reviewedBy,
      rejectionReason: input.rejectionReason,
      routeConfidence: input.routeConfidence,
      routeReason: input.routeReason,
      proposedRoute: input.proposedRoute,
      approvedRoute: input.approvedRoute,
      decisionVersion,
      lastAction: decisionAction,
      history,
    },
  };
}

async function persistRoutingDecisionState(input: {
  content: LoadedRoutingApprovalTarget['content'];
  orgId: string;
  userId: string;
  status: 'approved' | 'rejected';
  approvalId: string;
  requestedAt: string | null;
  rejectionReason: string | null;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: {
    topic: string;
    app: string | null;
    screen: string | null;
  };
  approvedRoute: {
    topic: string;
    app: string | null;
    screen: string | null;
  } | null;
  decisionHint?: RoutingReviewDecisionAction | null;
}): Promise<{
  content: LoadedRoutingApprovalTarget['content'];
  previousRoutingState: RoutingReviewState | null;
  routingState: RoutingReviewState;
  decisionAction: RoutingReviewDecisionAction;
}> {
  let content = input.content;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nowIso = new Date().toISOString();
    const previousRoutingState = parseRoutingReviewState(content.metadata);
    const { state: routingState, decisionAction } = buildRoutingDecisionState({
      existingMetadata: content.metadata,
      status: input.status,
      approvalId: input.approvalId,
      requestedAt: input.requestedAt,
      reviewedAt: nowIso,
      reviewedBy: input.userId,
      rejectionReason: input.rejectionReason,
      routeConfidence: input.routeConfidence,
      routeReason: input.routeReason,
      proposedRoute: input.proposedRoute,
      approvedRoute: input.approvedRoute,
      decisionHint: input.decisionHint ?? null,
    });
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
      throw new Error(
        `Failed to persist routing ${input.status === 'approved' ? 'approval' : 'rejection'}: ${contentUpdateError.message}`,
      );
    }

    if (updatedContent) {
      return {
        content,
        previousRoutingState,
        routingState,
        decisionAction,
      };
    }

    if (attempt === 1) {
      throw new Error('Failed to persist routing decision: content changed during review');
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

    content = latestContent as LoadedRoutingApprovalTarget['content'];
  }

  throw new Error('Failed to persist routing decision');
}

/**
 * Supersede the current page and insert a new row with the given content.
 * Writes an `applied` log entry on the new row that carries `resolved_at`
 * and `resolved_by`, matching TRIB-32's `applyContradictionWithSupersede`.
 */
async function supersedeWithContent(input: {
  existingPage: OrgWikiPageRow;
  existingLog: CompilationLogEntry[];
  entryIndex: number;
  newContent: string;
  userId: string;
  nowIso: string;
}): Promise<{ newPageId: string }> {
  const { existingPage, existingLog, entryIndex, newContent, userId, nowIso } = input;
  const originalEntry = existingLog[entryIndex];

  const { error: supersedeError } = await supabaseAdmin
    .from('org_wiki_pages')
    .update({ valid_until: nowIso } as never)
    .eq('id', existingPage.id);

  if (supersedeError) {
    throw new Error(`Failed to supersede page ${existingPage.id}: ${supersedeError.message}`);
  }

  // Preserve the full prior history, but swap the flagged entry for its
  // resolved counterpart so the new page keeps an auditable trail.
  const resolvedEntry: CompilationLogEntry = {
    ...originalEntry,
    action: 'applied',
    resolved_at: nowIso,
    resolved_by: userId,
  };

  const carriedLog = [...existingLog];
  carriedLog[entryIndex] = resolvedEntry;

  const newConfidence = clampConfidence(
    (existingPage.confidence ?? 0.5) + (originalEntry.confidence_delta ?? 0)
  );

  const newPageInsert: OrgWikiPageInsert = {
    org_id: existingPage.org_id,
    app: existingPage.app,
    screen: existingPage.screen,
    topic: existingPage.topic,
    content: newContent,
    confidence: newConfidence,
    supersedes_id: existingPage.id,
    compilation_log: carriedLog as unknown as Json,
  };

  const { data: insertedPage, error: insertError } = await supabaseAdmin
    .from('org_wiki_pages')
    .insert(newPageInsert as never)
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert superseding page for ${existingPage.id}: ${insertError.message}`);
  }

  return { newPageId: (insertedPage as { id: string }).id };
}

/**
 * Patch a single flagged entry in place on the given page (no supersede,
 * no content change). Used by `rejectContradiction`.
 */
async function patchLogEntryInPlace(input: {
  pageId: string;
  existingLog: CompilationLogEntry[];
  entryIndex: number;
  patch: Partial<CompilationLogEntry>;
}): Promise<void> {
  const { pageId, existingLog, entryIndex, patch } = input;
  const nextLog = [...existingLog];
  nextLog[entryIndex] = { ...existingLog[entryIndex], ...patch };

  const { error } = await supabaseAdmin
    .from('org_wiki_pages')
    .update({ compilation_log: nextLog as unknown as Json } as never)
    .eq('id', pageId);

  if (error) {
    throw new Error(`Failed to patch compilation_log on page ${pageId}: ${error.message}`);
  }
}

function invalidate(orgId: string): void {
  revalidatePath(WIKI_REVIEW_PATH);
  // updateTag gives read-your-own-writes semantics in server actions, so the
  // admin nav badge reflects the fresh count on the very next render.
  updateTag(`wiki-review-count:${orgId}`);
  updateTag(`review-queue-count:${orgId}`);
}

async function recordReviewOutcome(input: {
  orgId: string;
  userId: string;
  pageId: string;
  logEntryIndex: number;
  action: 'approveContradiction' | 'rejectContradiction' | 'editAndApproveContradiction';
  outcome: 'approved' | 'rejected' | 'edited_and_approved' | 'auto_rejected_noop' | 'error';
  contentLength?: number;
  errorMessage?: string | null;
}): Promise<void> {
  await recordKnowledgeTelemetryEvent({
    type: 'knowledge.review.outcome',
    payload: buildKnowledgeReviewTelemetry({
      orgId: input.orgId,
      userId: input.userId,
      pageId: input.pageId,
      logEntryIndex: input.logEntryIndex,
      action: input.action,
      outcome: input.outcome,
      contentLength: input.contentLength ?? null,
      errorMessage: input.errorMessage ?? null,
    }) as unknown as Json,
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Approve a flagged contradiction. Supersedes the existing page with new
 * content — either the flagged entry's stored `merged_content` (when
 * present) or a conservative string-replacement fallback that applies each
 * `{ old, new }` pair from the contradictions list to the page body.
 */
export async function approveContradiction(input: {
  pageId: string;
  logEntryIndex: number;
}): Promise<ActionResult> {
  let authContext: { orgId: string; userId: string } | null = null;
  try {
    const { userId, orgId } = await requireAdmin();
    authContext = { orgId, userId };
    const { page, log, entry } = await loadAndValidateTarget({ ...input, orgId });

    const mergedContent = entry.merged_content?.trim();
    const nextContent = mergedContent && mergedContent.length > 0
      ? mergedContent
      : applyContradictionsToContent(page.content, entry.contradictions);

    if (nextContent === page.content) {
      // Nothing would actually change — treat as a no-op and reject the
      // entry so it stops re-appearing in the review queue.
      const resolvedAt = new Date().toISOString();
      await patchLogEntryInPlace({
        pageId: page.id,
        existingLog: log,
        entryIndex: input.logEntryIndex,
        patch: { action: 'rejected', resolved_at: resolvedAt, resolved_by: userId },
      });
      logger.warn('Approve resulted in no content change; auto-rejected', {
        context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
      });
      await writeReviewAuditLog({
        orgId,
        userId,
        action: 'wiki_review.auto_reject_noop',
        resourceType: 'org_wiki_page',
        resourceId: page.id,
        oldValues: entry as unknown as Json,
        newValues: {
          action: 'rejected',
          resolved_at: resolvedAt,
          resolved_by: userId,
        } as unknown as Json,
        metadata: {
          logEntryIndex: input.logEntryIndex,
          sourceRecordingId: entry.source_recording_id,
        },
      });
      await recordReviewOutcome({
        orgId,
        userId,
        pageId: page.id,
        logEntryIndex: input.logEntryIndex,
        action: 'approveContradiction',
        outcome: 'auto_rejected_noop',
      });
      invalidate(orgId);
      return { ok: true };
    }

    const { newPageId } = await supersedeWithContent({
      existingPage: page,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      newContent: nextContent,
      userId,
      nowIso: new Date().toISOString(),
    });
    await generateOrgWikiPageEmbeddingBestEffort(newPageId, {
      source: 'admin-wiki-review.approve-contradiction',
      orgId,
      userId,
      supersededPageId: page.id,
      logEntryIndex: input.logEntryIndex,
    });

    logger.info('Wiki contradiction approved', {
      context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
    });
    await writeReviewAuditLog({
      orgId,
      userId,
      action: 'wiki_review.approve',
      resourceType: 'org_wiki_page',
      resourceId: page.id,
      oldValues: entry as unknown as Json,
      newValues: {
        action: 'applied',
        resolved_by: userId,
        superseded_page_id: page.id,
        new_page_id: newPageId,
      } as unknown as Json,
      metadata: {
        logEntryIndex: input.logEntryIndex,
        sourceRecordingId: entry.source_recording_id,
      },
    });

    await recordReviewOutcome({
      orgId,
      userId,
      pageId: page.id,
      logEntryIndex: input.logEntryIndex,
      action: 'approveContradiction',
      outcome: 'approved',
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('approveContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    if (authContext) {
      await recordReviewOutcome({
        orgId: authContext.orgId,
        userId: authContext.userId,
        pageId: input.pageId,
        logEntryIndex: input.logEntryIndex,
        action: 'approveContradiction',
        outcome: 'error',
        errorMessage: message,
      });
    }
    return { ok: false, error: message };
  }
}

export async function approveRoutingReview(input: {
  approvalId: string;
  contentId: string;
  topic: string;
  app: string | null;
  screen: string | null;
  decisionAction?: 'approve' | 'edit_and_approve' | 'reroute';
}): Promise<ActionResult> {
  try {
    const { orgId, userId } = await requireAdmin();
    const { approval, content } = await loadAndValidateRoutingApproval({
      approvalId: input.approvalId,
      contentId: input.contentId,
      orgId,
    });

    const proposedAction = parseRoutingReviewProposedAction(approval.proposed_action);
    if (!proposedAction) {
      return { ok: false, error: 'Routing review payload is invalid' };
    }

    const topic = normalizeRoutingSlug(input.topic);
    const app = normalizeRoutingApp(input.app);
    const screen = normalizeRoutingSlug(input.screen);

    if (!topic) {
      return { ok: false, error: 'Topic is required' };
    }
    const reviewed = await reviewApproval(
      approval.id,
      orgId,
      userId,
      'approved'
    );

    if (!reviewed) {
      throw new Error('Routing review item is no longer pending');
    }

    let persisted: Awaited<ReturnType<typeof persistRoutingDecisionState>>;
    try {
      persisted = await persistRoutingDecisionState({
        content,
        orgId,
        userId,
        status: 'approved',
        approvalId: approval.id,
        requestedAt: approval.created_at,
        rejectionReason: null,
        routeConfidence: proposedAction.routeConfidence,
        routeReason: proposedAction.routeReason,
        proposedRoute: proposedAction.proposedRoute,
        approvedRoute: {
          topic,
          app,
          screen,
        },
        decisionHint: input.decisionAction ?? null,
      });
    } catch (error) {
      try {
        await resetClaimedRoutingApproval({
          approvalId: approval.id,
          orgId,
          userId,
          action: 'approved',
        });
      } catch (resetError) {
        logger.error('Failed to reset routing approval after admin approve failure', {
          error: resetError instanceof Error ? resetError : undefined,
          context: { approvalId: approval.id, orgId, userId },
        });
      }
      throw error;
    }

    await enqueueRoutingCompileWikiJob({
      recordingId: persisted.content.id,
      orgId,
      approvalId: approval.id,
    });

    await writeReviewAuditLog({
      orgId,
      userId,
      action: `routing_review.${persisted.decisionAction}`,
      resourceType: 'content',
      resourceId: persisted.content.id,
      oldValues: (persisted.previousRoutingState as unknown as Json) ?? null,
      newValues: persisted.routingState as unknown as Json,
      metadata: {
        approvalId: approval.id,
        contentTitle: persisted.content.title ?? null,
      },
    });

    logger.info('Routing review approved', {
      context: {
        orgId,
        userId,
        approvalId: approval.id,
        contentId: persisted.content.id,
        decisionAction: persisted.decisionAction,
        topic,
        app,
        screen,
      },
    });

    revalidatePath(`/library/${persisted.content.id}`);
    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('approveRoutingReview failed', {
      error: error instanceof Error ? error : undefined,
      context: { approvalId: input.approvalId, contentId: input.contentId },
    });
    return { ok: false, error: message };
  }
}

export async function rejectRoutingReview(input: {
  approvalId: string;
  contentId: string;
  rejectionReason?: string | null;
}): Promise<ActionResult> {
  try {
    const { orgId, userId } = await requireAdmin();
    const { approval, content } = await loadAndValidateRoutingApproval({
      approvalId: input.approvalId,
      contentId: input.contentId,
      orgId,
    });

    const proposedAction = parseRoutingReviewProposedAction(approval.proposed_action);
    if (!proposedAction) {
      return { ok: false, error: 'Routing review payload is invalid' };
    }

    const rejectionReason =
      input.rejectionReason?.trim() || 'Reviewer rejected the proposed route.';

    const reviewed = await reviewApproval(
      approval.id,
      orgId,
      userId,
      'rejected',
      rejectionReason
    );

    if (!reviewed) {
      throw new Error('Routing review item is no longer pending');
    }

    let persisted: Awaited<ReturnType<typeof persistRoutingDecisionState>>;
    try {
      persisted = await persistRoutingDecisionState({
        content,
        orgId,
        userId,
        status: 'rejected',
        approvalId: approval.id,
        requestedAt: approval.created_at,
        rejectionReason,
        routeConfidence: proposedAction.routeConfidence,
        routeReason: proposedAction.routeReason,
        proposedRoute: proposedAction.proposedRoute,
        approvedRoute: null,
        decisionHint: 'reject',
      });
    } catch (error) {
      try {
        await resetClaimedRoutingApproval({
          approvalId: approval.id,
          orgId,
          userId,
          action: 'rejected',
        });
      } catch (resetError) {
        logger.error('Failed to reset routing rejection after admin reject failure', {
          error: resetError instanceof Error ? resetError : undefined,
          context: { approvalId: approval.id, orgId, userId },
        });
      }
      throw error;
    }

    await writeReviewAuditLog({
      orgId,
      userId,
      action: `routing_review.${persisted.decisionAction}`,
      resourceType: 'content',
      resourceId: persisted.content.id,
      oldValues: (persisted.previousRoutingState as unknown as Json) ?? null,
      newValues: persisted.routingState as unknown as Json,
      metadata: {
        approvalId: approval.id,
        contentTitle: persisted.content.title ?? null,
      },
    });

    logger.info('Routing review rejected', {
      context: {
        orgId,
        userId,
        approvalId: approval.id,
        contentId: persisted.content.id,
        decisionAction: persisted.decisionAction,
      },
    });

    revalidatePath(`/library/${persisted.content.id}`);
    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('rejectRoutingReview failed', {
      error: error instanceof Error ? error : undefined,
      context: { approvalId: input.approvalId, contentId: input.contentId },
    });
    return { ok: false, error: message };
  }
}

/**
 * Reject a flagged contradiction. Leaves the page content untouched and
 * marks the log entry as `rejected` with `resolved_at` / `resolved_by`.
 */
export async function rejectContradiction(input: {
  pageId: string;
  logEntryIndex: number;
}): Promise<ActionResult> {
  let authContext: { orgId: string; userId: string } | null = null;
  try {
    const { userId, orgId } = await requireAdmin();
    authContext = { orgId, userId };
    const { page, log, entry } = await loadAndValidateTarget({ ...input, orgId });
    const resolvedAt = new Date().toISOString();

    await patchLogEntryInPlace({
      pageId: page.id,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      patch: {
        action: 'rejected',
        resolved_at: resolvedAt,
        resolved_by: userId,
      },
    });

    logger.info('Wiki contradiction rejected', {
      context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
    });
    await writeReviewAuditLog({
      orgId,
      userId,
      action: 'wiki_review.reject',
      resourceType: 'org_wiki_page',
      resourceId: page.id,
      oldValues: entry as unknown as Json,
      newValues: {
        action: 'rejected',
        resolved_at: resolvedAt,
        resolved_by: userId,
      } as unknown as Json,
      metadata: {
        logEntryIndex: input.logEntryIndex,
        sourceRecordingId: entry.source_recording_id,
      },
    });

    await recordReviewOutcome({
      orgId,
      userId,
      pageId: page.id,
      logEntryIndex: input.logEntryIndex,
      action: 'rejectContradiction',
      outcome: 'rejected',
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('rejectContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    if (authContext) {
      await recordReviewOutcome({
        orgId: authContext.orgId,
        userId: authContext.userId,
        pageId: input.pageId,
        logEntryIndex: input.logEntryIndex,
        action: 'rejectContradiction',
        outcome: 'error',
        errorMessage: message,
      });
    }
    return { ok: false, error: message };
  }
}

/**
 * Approve a flagged contradiction with admin-edited content. Same supersede
 * mechanics as `approveContradiction` but uses the admin's rewritten body
 * instead of the LLM's `merged_content` or the fallback replacement.
 */
export async function editAndApproveContradiction(input: {
  pageId: string;
  logEntryIndex: number;
  editedContent: string;
}): Promise<ActionResult> {
  let authContext: { orgId: string; userId: string } | null = null;
  try {
    const { userId, orgId } = await requireAdmin();
    authContext = { orgId, userId };
    const { page, log, entry } = await loadAndValidateTarget({
      pageId: input.pageId,
      logEntryIndex: input.logEntryIndex,
      orgId,
    });

    const editedContent = input.editedContent?.trim() ?? '';
    if (editedContent.length === 0) {
      return { ok: false, error: 'Edited content cannot be empty' };
    }

    const { newPageId } = await supersedeWithContent({
      existingPage: page,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      newContent: editedContent,
      userId,
      nowIso: new Date().toISOString(),
    });
    await generateOrgWikiPageEmbeddingBestEffort(newPageId, {
      source: 'admin-wiki-review.edit-and-approve-contradiction',
      orgId,
      userId,
      supersededPageId: page.id,
      logEntryIndex: input.logEntryIndex,
      contentLength: editedContent.length,
    });

    logger.info('Wiki contradiction edited and approved', {
      context: {
        orgId,
        userId,
        pageId: page.id,
        logEntryIndex: input.logEntryIndex,
        contentLength: editedContent.length,
      },
    });
    await writeReviewAuditLog({
      orgId,
      userId,
      action: 'wiki_review.edit_and_approve',
      resourceType: 'org_wiki_page',
      resourceId: page.id,
      oldValues: entry as unknown as Json,
      newValues: {
        action: 'applied',
        resolved_by: userId,
        superseded_page_id: page.id,
        new_page_id: newPageId,
        editedContentLength: editedContent.length,
      } as unknown as Json,
      metadata: {
        logEntryIndex: input.logEntryIndex,
        sourceRecordingId: entry.source_recording_id,
      },
    });

    await recordReviewOutcome({
      orgId,
      userId,
      pageId: page.id,
      logEntryIndex: input.logEntryIndex,
      action: 'editAndApproveContradiction',
      outcome: 'edited_and_approved',
      contentLength: editedContent.length,
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('editAndApproveContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    if (authContext) {
      await recordReviewOutcome({
        orgId: authContext.orgId,
        userId: authContext.userId,
        pageId: input.pageId,
        logEntryIndex: input.logEntryIndex,
        action: 'editAndApproveContradiction',
        outcome: 'error',
        contentLength: input.editedContent?.trim().length || undefined,
        errorMessage: message,
      });
    }
    return { ok: false, error: message };
  }
}
