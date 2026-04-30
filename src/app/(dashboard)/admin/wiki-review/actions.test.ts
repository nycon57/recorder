import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fromMock = jest.fn();
const requireAdminMock = jest.fn();
const generateOrgWikiPageEmbeddingBestEffortMock = jest.fn();
const revalidatePathMock = jest.fn();
const updateTagMock = jest.fn();
const recordKnowledgeTelemetryEventMock = jest.fn();
const reviewApprovalMock = jest.fn();
const determineRoutingReviewDecisionActionMock = jest.fn();
const enqueueRoutingCompileWikiJobMock = jest.fn();
const normalizeRoutingAppMock = jest.fn();
const normalizeRoutingSlugMock = jest.fn();
const parseRoutingReviewStateMock = jest.fn();
const parseRoutingReviewProposedActionMock = jest.fn();
const writeRoutingReviewStateMock = jest.fn();

jest.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

jest.mock('@/lib/utils/api', () => ({
  requireAdmin: requireAdminMock,
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/services/org-wiki-embedding', () => ({
  generateOrgWikiPageEmbeddingBestEffort: generateOrgWikiPageEmbeddingBestEffortMock,
}));

jest.mock('@/lib/services/agent-permissions', () => ({
  reviewApproval: (...args: unknown[]) => reviewApprovalMock(...args),
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeReviewTelemetry: jest.fn((payload: unknown) => payload),
  recordKnowledgeTelemetryEvent: recordKnowledgeTelemetryEventMock,
}));

jest.mock('@/lib/services/routing-review', () => ({
  determineRoutingReviewDecisionAction: (...args: unknown[]) =>
    determineRoutingReviewDecisionActionMock(...args),
  ROUTING_REVIEW_ACTION_TYPE: 'routing_review',
  enqueueRoutingCompileWikiJob: (...args: unknown[]) =>
    enqueueRoutingCompileWikiJobMock(...args),
  normalizeRoutingApp: (...args: unknown[]) => normalizeRoutingAppMock(...args),
  normalizeRoutingSlug: (...args: unknown[]) => normalizeRoutingSlugMock(...args),
  parseRoutingReviewState: (...args: unknown[]) =>
    parseRoutingReviewStateMock(...args),
  parseRoutingReviewProposedAction: (...args: unknown[]) =>
    parseRoutingReviewProposedActionMock(...args),
  writeRoutingReviewState: (...args: unknown[]) =>
    writeRoutingReviewStateMock(...args),
}));

let approveContradiction: typeof import('./actions').approveContradiction;
let editAndApproveContradiction: typeof import('./actions').editAndApproveContradiction;
let approveRoutingReview: typeof import('./actions').approveRoutingReview;
let rejectRoutingReview: typeof import('./actions').rejectRoutingReview;

function loadPageResponse(page: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data: page, error: null })),
  };
  return query;
}

function updatePageResponse() {
  return {
    update: jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    })),
  };
}

function insertPageResponse(newPageId: string) {
  return {
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(async () => ({ data: { id: newPageId }, error: null })),
      })),
    })),
  };
}

function auditInsertResponse() {
  return {
    insert: jest.fn(async () => ({ error: null })),
  };
}

function routingApprovalRow() {
  return {
    id: 'approval-1',
    org_id: 'org-1',
    action_type: 'routing_review',
    content_id: 'content-1',
    status: 'pending',
    created_at: '2026-04-29T00:00:00.000Z',
    proposed_action: {
      kind: 'routing_review',
      routeConfidence: 0.8,
      routeReason: 'Ambiguous route',
      proposedRoute: {
        topic: 'renewals',
        app: 'salesforce',
        screen: 'opportunities',
      },
    },
  };
}

function routingContentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'content-1',
    org_id: 'org-1',
    metadata: { existing: true },
    title: 'Demo recording',
    updated_at: '2026-04-29T00:00:01.000Z',
    ...overrides,
  };
}

function routingSelectSingleResponse(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function routingUpdateResponse(data: unknown = { id: 'content-1' }) {
  const query = {
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    select: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function basePage() {
  return {
    id: 'page-old',
    org_id: 'org-1',
    app: 'salesforce',
    screen: 'opportunities',
    topic: 'renewal-workflow',
    content: 'Old content says renewal reminders are optional.',
    confidence: 0.7,
    valid_from: '2026-04-01T00:00:00.000Z',
    valid_until: null,
    supersedes_id: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    compilation_log: [
      {
        action: 'flagged',
        source_recording_id: 'rec-1',
        detected_at: '2026-04-20T00:00:00.000Z',
        contradictions: [
          {
            old: 'renewal reminders are optional',
            new: 'renewal reminders are required',
          },
        ],
        merged_content: 'New approved content with required renewal reminders.',
        confidence_delta: 0.1,
        resolved_at: null,
        resolved_by: null,
      },
    ],
  };
}

describe('wiki review actions embedding freshness', () => {
  beforeAll(async () => {
    ({
      approveContradiction,
      editAndApproveContradiction,
      approveRoutingReview,
      rejectRoutingReview,
    } = await import('./actions'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReset();
    requireAdminMock.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
    generateOrgWikiPageEmbeddingBestEffortMock.mockResolvedValue(true as never);
    recordKnowledgeTelemetryEventMock.mockResolvedValue(undefined as never);
    reviewApprovalMock.mockResolvedValue({ id: 'approval-1', status: 'approved' } as never);
    determineRoutingReviewDecisionActionMock.mockReturnValue('approve');
    enqueueRoutingCompileWikiJobMock.mockResolvedValue(undefined as never);
    normalizeRoutingAppMock.mockImplementation((value: unknown) => value);
    normalizeRoutingSlugMock.mockImplementation((value: unknown) => value);
    parseRoutingReviewStateMock.mockReturnValue(null);
    parseRoutingReviewProposedActionMock.mockImplementation((value: unknown) => value);
    writeRoutingReviewStateMock.mockReturnValue({ reviewed: true });
  });

  it('generates an embedding for the superseding page when approving a contradiction', async () => {
    fromMock
      .mockReturnValueOnce(loadPageResponse(basePage()))
      .mockReturnValueOnce(updatePageResponse())
      .mockReturnValueOnce(insertPageResponse('page-new'))
      .mockReturnValueOnce(auditInsertResponse());

    await expect(
      approveContradiction({ pageId: 'page-old', logEntryIndex: 0 })
    ).resolves.toEqual({ ok: true });

    expect(generateOrgWikiPageEmbeddingBestEffortMock).toHaveBeenCalledWith(
      'page-new',
      expect.objectContaining({
        source: 'admin-wiki-review.approve-contradiction',
        orgId: 'org-1',
        userId: 'user-1',
        supersededPageId: 'page-old',
        logEntryIndex: 0,
      })
    );
  });

  it('generates an embedding for the superseding page when editing and approving', async () => {
    fromMock
      .mockReturnValueOnce(loadPageResponse(basePage()))
      .mockReturnValueOnce(updatePageResponse())
      .mockReturnValueOnce(insertPageResponse('page-edited'))
      .mockReturnValueOnce(auditInsertResponse());

    await expect(
      editAndApproveContradiction({
        pageId: 'page-old',
        logEntryIndex: 0,
        editedContent: 'Admin edited approved content.',
      })
    ).resolves.toEqual({ ok: true });

    expect(generateOrgWikiPageEmbeddingBestEffortMock).toHaveBeenCalledWith(
      'page-edited',
      expect.objectContaining({
        source: 'admin-wiki-review.edit-and-approve-contradiction',
        orgId: 'org-1',
        userId: 'user-1',
        supersededPageId: 'page-old',
        logEntryIndex: 0,
        contentLength: 'Admin edited approved content.'.length,
      })
    );
  });
});

describe('wiki routing review actions', () => {
  beforeAll(async () => {
    ({
      approveRoutingReview,
      rejectRoutingReview,
    } = await import('./actions'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReset();
    requireAdminMock.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
    reviewApprovalMock.mockResolvedValue({ id: 'approval-1', status: 'approved' } as never);
    determineRoutingReviewDecisionActionMock.mockReturnValue('approve');
    enqueueRoutingCompileWikiJobMock.mockResolvedValue(undefined as never);
    normalizeRoutingAppMock.mockImplementation((value: unknown) => value);
    normalizeRoutingSlugMock.mockImplementation((value: unknown) => value);
    parseRoutingReviewStateMock.mockReturnValue(null);
    parseRoutingReviewProposedActionMock.mockImplementation((value: unknown) => value);
    writeRoutingReviewStateMock.mockReturnValue({ reviewed: true });
  });

  it('claims routing approvals before persisting metadata and enqueueing compile_wiki', async () => {
    const contentUpdate = routingUpdateResponse();
    fromMock
      .mockReturnValueOnce(routingSelectSingleResponse(routingApprovalRow()))
      .mockReturnValueOnce(routingSelectSingleResponse(routingContentRow()))
      .mockReturnValueOnce(contentUpdate)
      .mockReturnValueOnce(auditInsertResponse());

    await expect(
      approveRoutingReview({
        approvalId: 'approval-1',
        contentId: 'content-1',
        topic: 'renewals',
        app: 'salesforce',
        screen: 'opportunities',
      }),
    ).resolves.toEqual({ ok: true });

    expect(reviewApprovalMock).toHaveBeenCalledWith(
      'approval-1',
      'org-1',
      'user-1',
      'approved',
    );
    expect(reviewApprovalMock.mock.invocationCallOrder[0]).toBeLessThan(
      contentUpdate.update.mock.invocationCallOrder[0],
    );
    expect(contentUpdate.eq).toHaveBeenCalledWith(
      'updated_at',
      '2026-04-29T00:00:01.000Z',
    );
    expect(contentUpdate.update.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueRoutingCompileWikiJobMock.mock.invocationCallOrder[0],
    );
  });

  it('does not persist metadata when admin approval claim fails', async () => {
    reviewApprovalMock.mockResolvedValue(null as never);
    const contentUpdate = routingUpdateResponse();
    fromMock
      .mockReturnValueOnce(routingSelectSingleResponse(routingApprovalRow()))
      .mockReturnValueOnce(routingSelectSingleResponse(routingContentRow()))
      .mockReturnValueOnce(contentUpdate);

    const result = await approveRoutingReview({
      approvalId: 'approval-1',
      contentId: 'content-1',
      topic: 'renewals',
      app: null,
      screen: null,
    });

    expect(result.ok).toBe(false);
    expect(contentUpdate.update).not.toHaveBeenCalled();
    expect(enqueueRoutingCompileWikiJobMock).not.toHaveBeenCalled();
  });

  it('resets claimed admin approvals when compile enqueue fails', async () => {
    enqueueRoutingCompileWikiJobMock.mockRejectedValue(new Error('queue unavailable') as never);
    const contentUpdate = routingUpdateResponse();
    const resetUpdate = {
      update: jest.fn(() => resetUpdate),
      eq: jest.fn(() => resetUpdate),
    };
    fromMock
      .mockReturnValueOnce(routingSelectSingleResponse(routingApprovalRow()))
      .mockReturnValueOnce(routingSelectSingleResponse(routingContentRow()))
      .mockReturnValueOnce(contentUpdate)
      .mockReturnValueOnce(resetUpdate);

    const result = await approveRoutingReview({
      approvalId: 'approval-1',
      contentId: 'content-1',
      topic: 'renewals',
      app: null,
      screen: null,
    });

    expect(result.ok).toBe(false);
    expect(enqueueRoutingCompileWikiJobMock).toHaveBeenCalledWith({
      recordingId: 'content-1',
      orgId: 'org-1',
      approvalId: 'approval-1',
    });
    expect(resetUpdate.update).toHaveBeenCalledWith({
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    });
    expect(resetUpdate.eq).toHaveBeenCalledWith('id', 'approval-1');
    expect(resetUpdate.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(resetUpdate.eq).toHaveBeenCalledWith('status', 'approved');
    expect(resetUpdate.eq).toHaveBeenCalledWith('reviewed_by', 'user-1');
  });

  it('claims routing rejections before persisting rejected metadata', async () => {
    reviewApprovalMock.mockResolvedValue({ id: 'approval-1', status: 'rejected' } as never);
    determineRoutingReviewDecisionActionMock.mockReturnValue('reject');
    const contentUpdate = routingUpdateResponse();
    fromMock
      .mockReturnValueOnce(routingSelectSingleResponse(routingApprovalRow()))
      .mockReturnValueOnce(routingSelectSingleResponse(routingContentRow()))
      .mockReturnValueOnce(contentUpdate)
      .mockReturnValueOnce(auditInsertResponse());

    await expect(
      rejectRoutingReview({
        approvalId: 'approval-1',
        contentId: 'content-1',
        rejectionReason: 'Wrong route',
      }),
    ).resolves.toEqual({ ok: true });

    expect(reviewApprovalMock).toHaveBeenCalledWith(
      'approval-1',
      'org-1',
      'user-1',
      'rejected',
      'Wrong route',
    );
    expect(reviewApprovalMock.mock.invocationCallOrder[0]).toBeLessThan(
      contentUpdate.update.mock.invocationCallOrder[0],
    );
    expect(enqueueRoutingCompileWikiJobMock).not.toHaveBeenCalled();
  });
});
