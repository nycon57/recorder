/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const requireOrgMock = jest.fn();

jest.mock('@/lib/utils/api', () => ({
  requireOrg: () => requireOrgMock(),
}));

jest.mock('ai', () => ({
  streamText: jest.fn(),
  tool: jest.fn((config) => config),
  stepCountIs: jest.fn((count) => count),
}));

jest.mock('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mock-google-model'),
}));

jest.mock('botid/server', () => ({
  checkBotId: jest.fn(async () => ({ isBot: false })),
}));

jest.mock('next/server', () => ({
  after: jest.fn(),
}));

jest.mock('@/lib/services/rag-google', () => ({
  retrieveContext: jest.fn(),
}));

jest.mock('@/lib/services/compiled-memory-answer-context', () => ({
  resolveCompiledMemoryAnswerContext: jest.fn(),
  summarizeCompiledMemoryAnswerObservability: jest.fn(),
}));

jest.mock('@/lib/services/query-preprocessor', () => ({
  preprocessQuery: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('@/lib/services/query-router', () => ({
  routeQuery: jest.fn(),
  getRetrievalConfig: jest.fn(),
  explainRoute: jest.fn(),
}));

jest.mock('@/lib/services/reranking', () => ({
  isCohereConfigured: jest.fn(),
}));

jest.mock('@/lib/services/chat-tools', () => ({
  executeSearchRecordings: jest.fn(),
  executeGetDocument: jest.fn(),
  executeGetTranscript: jest.fn(),
  executeGetRecordingMetadata: jest.fn(),
  executeListRecordings: jest.fn(),
  executeSearchConcepts: jest.fn(),
  executeGetConceptDetails: jest.fn(),
  executeExploreKnowledgeGraph: jest.fn(),
  toolDescriptions: {},
}));

jest.mock('@/lib/validations/chat', () => ({
  searchRecordingsInputSchema: {},
  getDocumentInputSchema: {},
  getTranscriptInputSchema: {},
  getRecordingMetadataInputSchema: {},
  listRecordingsInputSchema: {},
  searchConceptsInputSchema: {},
  getConceptDetailsInputSchema: {},
  exploreKnowledgeGraphInputSchema: {},
}));

jest.mock('@/lib/services/search-monitoring', () => ({
  searchMonitor: {
    startSearch: jest.fn(),
    endSearch: jest.fn(),
    recordRetry: jest.fn(),
  },
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeChatTelemetry: jest.fn((payload) => payload),
  recordKnowledgeTelemetryEvent: jest.fn(),
}));

describe('GET /api/chat sources cache', () => {
  let chatRoute: typeof import('../route');

  beforeEach(async () => {
    jest.resetModules();
    requireOrgMock.mockReset();
    chatRoute = await import('../route');
    chatRoute.__clearSourcesCacheForTest();
  });

  it('rejects unauthenticated source retrieval', async () => {
    requireOrgMock.mockRejectedValue(new Error('Unauthorized') as never);

    const response = await chatRoute.GET(
      new Request('http://localhost/api/chat?sourcesKey=source-key'),
    );

    expect(response.status).toBe(401);
  });

  it('returns sources for the matching org and user', async () => {
    requireOrgMock.mockResolvedValue({ orgId: 'org-1', userId: 'user-1' } as never);
    chatRoute.__setSourcesCacheEntryForTest('source-key', {
      orgId: 'org-1',
      userId: 'user-1',
      sources: [{
        id: 'source-1',
        title: 'Install guide',
        url: '/library/content-1',
        snippet: 'Install steps',
        metadata: {},
      }],
    });

    const response = await chatRoute.GET(
      new Request('http://localhost/api/chat?sourcesKey=source-key'),
    );

    await expect(response.json()).resolves.toEqual({
      sources: [{
        id: 'source-1',
        title: 'Install guide',
        url: '/library/content-1',
        snippet: 'Install steps',
        metadata: {},
      }],
    });
  });

  it('does not return sources across orgs or users', async () => {
    requireOrgMock.mockResolvedValue({ orgId: 'org-2', userId: 'user-1' } as never);
    chatRoute.__setSourcesCacheEntryForTest('source-key', {
      orgId: 'org-1',
      userId: 'user-1',
      sources: [{
        id: 'source-1',
        title: 'Install guide',
        url: '/library/content-1',
        snippet: 'Install steps',
        metadata: {},
      }],
    });

    const response = await chatRoute.GET(
      new Request('http://localhost/api/chat?sourcesKey=source-key'),
    );

    expect(response.status).toBe(404);
  });

  it('expires source keys', async () => {
    requireOrgMock.mockResolvedValue({ orgId: 'org-1', userId: 'user-1' } as never);
    chatRoute.__setSourcesCacheEntryForTest('source-key', {
      orgId: 'org-1',
      userId: 'user-1',
      sources: [{
        id: 'source-1',
        title: 'Install guide',
        url: '/library/content-1',
        snippet: 'Install steps',
        metadata: {},
      }],
      expiresAt: Date.now() - 1,
    });

    const response = await chatRoute.GET(
      new Request('http://localhost/api/chat?sourcesKey=source-key'),
    );

    expect(response.status).toBe(404);
  });
});
