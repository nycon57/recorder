/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

type MockHandler = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

const requireAdminMock = jest.fn();
const reviewApprovalMock = jest.fn();
const logAgentActionMock = jest.fn();
const fromMock = jest.fn();
const enqueueRoutingCompileWikiJobMock = jest.fn();
const writeRoutingReviewStateMock = jest.fn();
const parseRoutingReviewStateMock = jest.fn();
const determineRoutingReviewDecisionActionMock = jest.fn();

jest.mock('@/lib/utils/api', () => ({
  apiHandler: <THandler extends MockHandler>(fn: THandler) => fn,
  requireAdmin: () => requireAdminMock(),
  successResponse: (data: unknown) =>
    Response.json({ data }, { status: 200 }),
  errors: {
    badRequest: (message: string) =>
      Response.json({ code: 'BAD_REQUEST', message }, { status: 400 }),
    notFound: (resource: string) =>
      Response.json({ code: 'NOT_FOUND', message: `${resource} not found` }, { status: 404 }),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

jest.mock('@/lib/services/agent-permissions', () => ({
  reviewApproval: (...args: unknown[]) => reviewApprovalMock(...args),
}));

jest.mock('@/lib/services/agent-logger', () => ({
  logAgentAction: (...args: unknown[]) => logAgentActionMock(...args),
}));

jest.mock('@/lib/services/routing-review', () => ({
  ROUTING_REVIEW_ACTION_TYPE: 'reroute_content',
  determineRoutingReviewDecisionAction: (...args: unknown[]) =>
    determineRoutingReviewDecisionActionMock(...args),
  enqueueRoutingCompileWikiJob: (...args: unknown[]) =>
    enqueueRoutingCompileWikiJobMock(...args),
  normalizeRoutingApp: (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null,
  normalizeRoutingSlug: (value: unknown) =>
    typeof value === 'string' && value.trim()
      ? value.trim().toLowerCase().replace(/\s+/g, '-')
      : null,
  parseRoutingReviewProposedAction: (value: unknown) => value,
  parseRoutingReviewState: (...args: unknown[]) =>
    parseRoutingReviewStateMock(...args),
  writeRoutingReviewState: (...args: unknown[]) =>
    writeRoutingReviewStateMock(...args),
}));

let PATCH: typeof import('../route').PATCH;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/organizations/agent-approvals/approval_1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function approvalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval_1',
    org_id: 'org_1',
    action_type: 'reroute_content',
    agent_type: 'wiki_compiler',
    content_id: 'content_1',
    status: 'pending',
    created_at: '2026-04-29T00:00:00.000Z',
    proposed_action: {
      kind: 'routing_review',
      contentId: 'content_1',
      contentTitle: 'Demo recording',
      routeConfidence: 0.42,
      routeReason: 'Ambiguous route',
      proposedRoute: {
        topic: 'renewals',
        app: 'salesforce',
        screen: 'opportunities',
      },
    },
    ...overrides,
  };
}

function contentRow() {
  return {
    id: 'content_1',
    org_id: 'org_1',
    title: 'Demo recording',
    metadata: { existing: true },
  };
}

function mockSelectMaybeSingle(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function mockSelectSingle(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function mockUpdate() {
  const query = {
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    then: (resolve: (value: { error: null }) => unknown) => resolve({ error: null }),
  };
  return query;
}

function setupRoutingQueries(approval = approvalRow()) {
  const contentUpdate = mockUpdate();
  const resetUpdate = mockUpdate();

  fromMock
    .mockReturnValueOnce(mockSelectMaybeSingle(approval))
    .mockReturnValueOnce(mockSelectSingle(contentRow()))
    .mockReturnValueOnce(contentUpdate)
    .mockReturnValueOnce(resetUpdate);

  return { contentUpdate, resetUpdate };
}

describe('PATCH /api/organizations/agent-approvals/[id]', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    fromMock.mockReset();
    requireAdminMock.mockReset();
    reviewApprovalMock.mockReset();
    logAgentActionMock.mockReset();
    enqueueRoutingCompileWikiJobMock.mockReset();
    writeRoutingReviewStateMock.mockReset();
    parseRoutingReviewStateMock.mockReset();
    determineRoutingReviewDecisionActionMock.mockReset();
    jest.resetModules();
    requireAdminMock.mockResolvedValue({ orgId: 'org_1', userId: 'user_1' } as never);
    reviewApprovalMock.mockResolvedValue({ id: 'approval_1', status: 'approved' } as never);
    logAgentActionMock.mockResolvedValue(undefined as never);
    enqueueRoutingCompileWikiJobMock.mockResolvedValue(undefined as never);
    parseRoutingReviewStateMock.mockReturnValue(null);
    determineRoutingReviewDecisionActionMock.mockReturnValue('approve');
    writeRoutingReviewStateMock.mockReturnValue({ reviewed: true });
    ({ PATCH } = await import('../route'));
  });

  it('claims approved routing before persisting side effects and enqueuing compile_wiki', async () => {
    setupRoutingQueries();

    const response = await PATCH(makeRequest({ action: 'approved' }), {
      params: Promise.resolve({ id: 'approval_1' }),
    });

    expect(response.status).toBe(200);
    expect(writeRoutingReviewStateMock).toHaveBeenCalledWith(
      { existing: true },
      expect.objectContaining({
        status: 'approved',
        approvalId: 'approval_1',
        approvedRoute: {
          topic: 'renewals',
          app: 'salesforce',
          screen: 'opportunities',
        },
      }),
    );
    expect(enqueueRoutingCompileWikiJobMock).toHaveBeenCalledWith({
      recordingId: 'content_1',
      orgId: 'org_1',
      approvalId: 'approval_1',
    });
    expect(reviewApprovalMock).toHaveBeenCalledWith(
      'approval_1',
      'org_1',
      'user_1',
      'approved',
      undefined,
    );
    expect(reviewApprovalMock.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueRoutingCompileWikiJobMock.mock.invocationCallOrder[0],
    );
  });

  it('allows approved routing to keep nullable app and screen values', async () => {
    setupRoutingQueries(
      approvalRow({
        proposed_action: {
          kind: 'routing_review',
          contentId: 'content_1',
          contentTitle: 'Demo recording',
          routeConfidence: 0.42,
          routeReason: 'Ambiguous route',
          proposedRoute: {
            topic: 'renewals',
            app: null,
            screen: null,
          },
        },
      }),
    );

    const response = await PATCH(makeRequest({ action: 'approved' }), {
      params: Promise.resolve({ id: 'approval_1' }),
    });

    expect(response.status).toBe(200);
    expect(writeRoutingReviewStateMock).toHaveBeenCalledWith(
      { existing: true },
      expect.objectContaining({
        approvedRoute: {
          topic: 'renewals',
          app: null,
          screen: null,
        },
      }),
    );
  });

  it('persists rejected routing without enqueuing compile_wiki', async () => {
    reviewApprovalMock.mockResolvedValue({ id: 'approval_1', status: 'rejected' } as never);
    determineRoutingReviewDecisionActionMock.mockReturnValue('reject');
    setupRoutingQueries();

    const response = await PATCH(
      makeRequest({ action: 'rejected', rejection_reason: 'Wrong app' }),
      { params: Promise.resolve({ id: 'approval_1' }) },
    );

    expect(response.status).toBe(200);
    expect(writeRoutingReviewStateMock).toHaveBeenCalledWith(
      { existing: true },
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Wrong app',
        approvedRoute: null,
      }),
    );
    expect(enqueueRoutingCompileWikiJobMock).not.toHaveBeenCalled();
    expect(reviewApprovalMock).toHaveBeenCalledWith(
      'approval_1',
      'org_1',
      'user_1',
      'rejected',
      'Wrong app',
    );
    expect(logAgentActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_1',
        outcome: 'skipped',
        metadata: { approvalId: 'approval_1', reviewedBy: 'user_1' },
      }),
    );
  });

  it('does not apply routing side effects when the approval claim fails', async () => {
    reviewApprovalMock.mockResolvedValue(null as never);
    setupRoutingQueries();

    const response = await PATCH(makeRequest({ action: 'approved' }), {
      params: Promise.resolve({ id: 'approval_1' }),
    });

    expect(response.status).toBe(404);
    expect(writeRoutingReviewStateMock).not.toHaveBeenCalled();
    expect(enqueueRoutingCompileWikiJobMock).not.toHaveBeenCalled();
  });

  it('resets the approval claim when routing side effects fail', async () => {
    enqueueRoutingCompileWikiJobMock.mockRejectedValue(new Error('queue unavailable') as never);
    const { resetUpdate } = setupRoutingQueries();

    const response = await PATCH(makeRequest({ action: 'approved' }), {
      params: Promise.resolve({ id: 'approval_1' }),
    });

    expect(response.status).toBe(400);
    expect(reviewApprovalMock).toHaveBeenCalledWith(
      'approval_1',
      'org_1',
      'user_1',
      'approved',
      undefined,
    );
    expect(resetUpdate.update).toHaveBeenCalledWith({
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    });
    expect(resetUpdate.eq).toHaveBeenCalledWith('id', 'approval_1');
    expect(resetUpdate.eq).toHaveBeenCalledWith('org_id', 'org_1');
    expect(resetUpdate.eq).toHaveBeenCalledWith('status', 'approved');
    expect(resetUpdate.eq).toHaveBeenCalledWith('reviewed_by', 'user_1');
  });
});
