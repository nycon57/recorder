import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fromMock = jest.fn();
const requireAdminMock = jest.fn();
const generateOrgWikiPageEmbeddingBestEffortMock = jest.fn();
const revalidatePathMock = jest.fn();
const updateTagMock = jest.fn();
const recordKnowledgeTelemetryEventMock = jest.fn();

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
  reviewApproval: jest.fn(),
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeReviewTelemetry: jest.fn((payload: unknown) => payload),
  recordKnowledgeTelemetryEvent: recordKnowledgeTelemetryEventMock,
}));

jest.mock('@/lib/services/routing-review', () => ({
  determineRoutingReviewDecisionAction: jest.fn(),
  ROUTING_REVIEW_ACTION_TYPE: 'routing_review',
  enqueueRoutingCompileWikiJob: jest.fn(),
  normalizeRoutingApp: jest.fn(),
  normalizeRoutingSlug: jest.fn(),
  parseRoutingReviewState: jest.fn(),
  parseRoutingReviewProposedAction: jest.fn(),
  writeRoutingReviewState: jest.fn(),
}));

let approveContradiction: typeof import('./actions').approveContradiction;
let editAndApproveContradiction: typeof import('./actions').editAndApproveContradiction;

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
    } = await import('./actions'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    requireAdminMock.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' } as never);
    generateOrgWikiPageEmbeddingBestEffortMock.mockResolvedValue(true as never);
    recordKnowledgeTelemetryEventMock.mockResolvedValue(undefined as never);
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
