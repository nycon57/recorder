import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fromMock = jest.fn();
const generateContentMock = jest.fn();
const runRelationshipExtractionMock = jest.fn();
const runCrossPageContradictionDetectionMock = jest.fn();
const generateOrgWikiPageEmbeddingBestEffortMock = jest.fn();

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
  getApprovedRoutingOverride: jest.fn(() => null),
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
});
