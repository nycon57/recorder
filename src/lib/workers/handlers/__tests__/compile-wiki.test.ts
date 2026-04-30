import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fromMock = jest.fn();
const generateContentMock = jest.fn();
const runRelationshipExtractionMock = jest.fn();
const runCrossPageContradictionDetectionMock = jest.fn();
const generateOrgWikiPageEmbeddingBestEffortMock = jest.fn();
const getApprovedRoutingOverrideMock = jest.fn<
  () => { app: string | null; screen: string | null; topic: string } | null
>(() => null);

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: fromMock,
  })),
}));

jest.mock('@/lib/services/agent-config', () => ({
  getAgentSettings: jest.fn(async () => ({ global_agent_enabled: true })),
  getWikiCompilationSettings: jest.fn(async () => ({
    contradictionReviewMode: 'manual',
  })),
  shouldAutoApplyWikiContradiction: jest.fn(() => false),
}));

jest.mock('@/lib/services/agent-logger', () => ({
  withAgentLogging: jest.fn(async (_input: unknown, fn: () => Promise<void>) => fn()),
}));

jest.mock('@/lib/services/agent-permissions', () => ({
  requestApproval: jest.fn(),
}));

jest.mock('@/lib/services/routing-review', () => ({
  ROUTING_REVIEW_AGENT_TYPE: 'routing_review',
  ROUTING_REVIEW_ACTION_TYPE: 'compile_wiki_route_review',
  buildRoutingReviewDescription: jest.fn(),
  buildRoutingReviewProposedAction: jest.fn(),
  getApprovedRoutingOverride: getApprovedRoutingOverrideMock,
  requiresRoutingReview: jest.fn(() => false),
  writeRoutingReviewState: jest.fn((metadata: unknown) => metadata),
}));

jest.mock('../compile-wiki-relationships', () => ({
  runRelationshipExtraction: runRelationshipExtractionMock,
}));

jest.mock('../compile-wiki-cross-page', () => ({
  runCrossPageContradictionDetection: runCrossPageContradictionDetectionMock,
}));

jest.mock('@/lib/services/org-wiki-embedding', () => ({
  generateOrgWikiPageEmbeddingBestEffort: generateOrgWikiPageEmbeddingBestEffortMock,
}));

jest.mock('@/lib/utils/security', () => ({
  detectPII: jest.fn(() => ({ hasPII: false, types: [] })),
  logPIIDetection: jest.fn(),
  sanitizeVisualDescription: jest.fn((value: string) => value),
}));

let handleCompileWiki: typeof import('../compile-wiki').handleCompileWiki;

function queryResponse(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    neq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    single: jest.fn(async () => ({ data, error: null })),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

function updateResponse() {
  return {
    update: jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    })),
  };
}

function insertResponse() {
  return {
    insert: jest.fn(async () => ({ error: null })),
  };
}

function insertSelectSingleResponse(data: unknown) {
  const query = {
    insert: jest.fn(() => query),
    select: jest.fn(() => query),
    single: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

describe('compile-wiki embedding freshness', () => {
  beforeAll(async () => {
    ({ handleCompileWiki } = await import('../compile-wiki'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    runRelationshipExtractionMock.mockResolvedValue(false as never);
    runCrossPageContradictionDetectionMock.mockResolvedValue(undefined as never);
    generateOrgWikiPageEmbeddingBestEffortMock.mockResolvedValue(true as never);
    getApprovedRoutingOverrideMock.mockReturnValue(null);
  });

  it('refreshes the existing page embedding after an additive update is finalized', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: JSON.stringify({
          app: 'salesforce',
          screen: 'opportunities',
          topic: 'renewal-workflow',
          route_confidence: 0.95,
          route_reason: 'clear workflow',
        }),
      } as never)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          action: 'additive',
          additions: ['Add the renewal reminder step.'],
          contradictions: [],
          merged_content: 'Merged wiki content with renewal reminder.',
          confidence_delta: 0.1,
        }),
      } as never);

    const existingPage = {
      id: 'page-existing',
      org_id: 'org-1',
      app: 'salesforce',
      screen: 'opportunities',
      topic: 'renewal-workflow',
      content: 'Original wiki content.',
      confidence: 0.7,
      valid_until: null,
      compilation_log: [],
    };

    fromMock
      .mockReturnValueOnce(queryResponse({
        id: 'rec-1',
        title: 'Renewal walkthrough',
        description: null,
        content_type: 'recording',
        metadata: null,
      }))
      .mockReturnValueOnce(queryResponse({
        id: 'workflow-1',
        title: 'Renewal workflow',
        description: null,
        steps: [{ title: 'Send reminder', description: 'Notify the CSM' }],
        step_count: 1,
        confidence: 0.9,
        status: 'completed',
      }))
      .mockReturnValueOnce(queryResponse(null))
      .mockReturnValueOnce(queryResponse(null))
      .mockReturnValueOnce(queryResponse(existingPage))
      .mockReturnValueOnce(updateResponse())
      .mockReturnValueOnce(insertResponse());

    await handleCompileWiki({
      id: 'job-1',
      payload: { recordingId: 'rec-1', orgId: 'org-1' },
    } as never);

    expect(runRelationshipExtractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        pageId: 'page-existing',
        topic: 'renewal-workflow',
        content: 'Merged wiki content with renewal reminder.',
        recordingId: 'rec-1',
      })
    );
    expect(generateOrgWikiPageEmbeddingBestEffortMock).toHaveBeenCalledWith(
      'page-existing',
      expect.objectContaining({
        source: 'compile-wiki.additive',
        orgId: 'org-1',
        recordingId: 'rec-1',
        contentChanged: true,
        backlinksChanged: false,
      })
    );
    expect(
      runRelationshipExtractionMock.mock.invocationCallOrder[0]
    ).toBeLessThan(runCrossPageContradictionDetectionMock.mock.invocationCallOrder[0]);
    expect(
      runCrossPageContradictionDetectionMock.mock.invocationCallOrder[0]
    ).toBeLessThan(
      generateOrgWikiPageEmbeddingBestEffortMock.mock.invocationCallOrder[0]
    );
  });

  it('creates a new page from an approved routing override without reclassifying', async () => {
    getApprovedRoutingOverrideMock.mockReturnValue({
      app: 'salesforce',
      screen: 'opportunities',
      topic: 'renewal-workflow',
    });
    generateContentMock.mockResolvedValueOnce({
      text: [
        '---',
        'layer: org',
        'org_id: "org-1"',
        'app: "salesforce"',
        'screen: "opportunities"',
        'topic: "renewal-workflow"',
        'confidence: 0.9',
        'sources:',
        '  - type: recording',
        '    id: "rec-1"',
        '---',
        '# Renewal Workflow',
        '',
        '## Workflow Steps',
        '1. Send the renewal reminder.',
      ].join('\n'),
    } as never);

    const contentQuery = queryResponse({
      id: 'rec-1',
      title: 'Renewal walkthrough',
      description: null,
      content_type: 'recording',
      metadata: {
        knowledge_routing_review: {
          status: 'approved',
        },
      },
    });
    const existingPageQuery = queryResponse(null);
    const pageInsertQuery = insertSelectSingleResponse({ id: 'page-1' });
    const sourceInsertQuery = insertResponse();

    fromMock
      .mockReturnValueOnce(contentQuery)
      .mockReturnValueOnce(queryResponse({
        id: 'workflow-1',
        title: 'Renewal workflow',
        description: null,
        steps: [{ title: 'Send reminder', description: 'Notify the CSM' }],
        step_count: 1,
        confidence: 0.83,
        status: 'completed',
      }))
      .mockReturnValueOnce(queryResponse(null))
      .mockReturnValueOnce(queryResponse(null))
      .mockReturnValueOnce(existingPageQuery)
      .mockReturnValueOnce(pageInsertQuery)
      .mockReturnValueOnce(sourceInsertQuery);

    await handleCompileWiki({
      id: 'job-1',
      payload: { recordingId: 'rec-1', orgId: 'org-1' },
    } as never);

    expect(contentQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(existingPageQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(pageInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        app: 'salesforce',
        screen: 'opportunities',
        topic: 'renewal-workflow',
        content: expect.stringContaining('# Renewal Workflow'),
        confidence: 0.83,
        compilation_log: [
          expect.objectContaining({
            action: 'created',
            source_recording_id: 'rec-1',
            confidence: 0.83,
            classification: expect.objectContaining({
              app: 'salesforce',
              screen: 'opportunities',
              topic: 'renewal-workflow',
              routeConfidence: 1,
            }),
          }),
        ],
      })
    );
    expect(sourceInsertQuery.insert).toHaveBeenCalledWith({
      page_id: 'page-1',
      source_type: 'recording',
      source_id: 'rec-1',
      contribution_summary:
        'Initial wiki page creation from recording Renewal walkthrough',
    });
    expect(runRelationshipExtractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        pageId: 'page-1',
        topic: 'renewal-workflow',
        content: expect.stringContaining('# Renewal Workflow'),
        recordingId: 'rec-1',
      })
    );
    expect(runCrossPageContradictionDetectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        pageId: 'page-1',
        app: 'salesforce',
        screen: 'opportunities',
        topic: 'renewal-workflow',
        content: expect.stringContaining('# Renewal Workflow'),
        recordingId: 'rec-1',
      })
    );
    expect(generateOrgWikiPageEmbeddingBestEffortMock).toHaveBeenCalledWith(
      'page-1',
      expect.objectContaining({
        source: 'compile-wiki.new-page',
        orgId: 'org-1',
        recordingId: 'rec-1',
      })
    );
  });
});
