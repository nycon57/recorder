import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CompiledMemoryAnswerContext } from '@/lib/services/compiled-memory-answer-context';

let handleAnswerQuestion: typeof import('../handlers').handleAnswerQuestion;
let handleSearchKnowledge: typeof import('../handlers').handleSearchKnowledge;
let handleGetWikiPage: typeof import('../handlers').handleGetWikiPage;
let resolveCompiledMemoryAnswerContext: jest.MockedFunction<
  typeof import('@/lib/services/compiled-memory-answer-context').resolveCompiledMemoryAnswerContext
>;
let generateCompiledMemoryGroundedAnswer: jest.MockedFunction<
  typeof import('@/lib/services/compiled-memory-answer').generateCompiledMemoryGroundedAnswer
>;
let injectRAGContext: jest.MockedFunction<
  typeof import('@/lib/services/chat-rag-integration').injectRAGContext
>;
let searchCompiledOrgWikiPages: jest.MockedFunction<
  typeof import('@/lib/services/wiki-search').searchCompiledOrgWikiPages
>;
let searchVendorWikiPages: jest.MockedFunction<
  typeof import('@/lib/services/wiki-search').searchVendorWikiPages
>;
let getOrgWikiPage: jest.MockedFunction<
  typeof import('@/lib/services/wiki-search').getOrgWikiPage
>;
let getVendorWikiPage: jest.MockedFunction<
  typeof import('@/lib/services/wiki-search').getVendorWikiPage
>;

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/services/chat-rag-integration', () => ({
  injectRAGContext: jest.fn(),
}));

jest.mock('@/lib/services/compiled-memory-answer-context', () => ({
  resolveCompiledMemoryAnswerContext: jest.fn(),
  buildCompiledMemoryCitations: jest.fn((sources: Array<{
    sourceId: string;
    title: string;
    layer: string;
    excerpt: string;
    confidence: number;
    url?: string;
  }>) =>
    sources.map((source, index) => ({
      citationNumber: index + 1,
      sourceId: source.sourceId,
      title: source.title,
      layer: source.layer,
      excerpt: source.excerpt,
      confidence: source.confidence,
      url: source.url,
    })),
  ),
  summarizeCompiledMemoryAnswerObservability: jest.fn(() => ({
    sourceLayers: ['org'],
    orgSourcesCount: 1,
    vendorTrainingSourcesCount: 0,
    vendorSourcesCount: 0,
    citationsCount: 1,
    citationsWithFreshnessCount: 1,
    staleCitationsCount: 0,
    staleVendorCitationsCount: 0,
    vendorSourceIds: [],
    vendorRetrievalMode: 'none',
    hasStaleVendorContent: false,
  })),
}));

jest.mock('@/lib/services/compiled-memory-answer', () => ({
  generateCompiledMemoryGroundedAnswer: jest.fn(),
}));

jest.mock('@/lib/services/wiki-search', () => ({
  searchCompiledOrgWikiPages: jest.fn(),
  searchVendorWikiPages: jest.fn(),
  getOrgWikiPage: jest.fn(),
  getVendorWikiPage: jest.fn(),
}));

describe('handleAnswerQuestion', () => {
  beforeAll(async () => {
    ({ handleAnswerQuestion, handleSearchKnowledge, handleGetWikiPage } =
      await import('../handlers'));
    resolveCompiledMemoryAnswerContext = jest.mocked(
      (
        await import('@/lib/services/compiled-memory-answer-context')
      ).resolveCompiledMemoryAnswerContext,
    );
    generateCompiledMemoryGroundedAnswer = jest.mocked(
      (await import('@/lib/services/compiled-memory-answer'))
        .generateCompiledMemoryGroundedAnswer,
    );
    injectRAGContext = jest.mocked(
      (await import('@/lib/services/chat-rag-integration')).injectRAGContext,
    );
    const wikiSearch = await import('@/lib/services/wiki-search');
    searchCompiledOrgWikiPages = jest.mocked(wikiSearch.searchCompiledOrgWikiPages);
    searchVendorWikiPages = jest.mocked(wikiSearch.searchVendorWikiPages);
    getOrgWikiPage = jest.mocked(wikiSearch.getOrgWikiPage);
    getVendorWikiPage = jest.mocked(wikiSearch.getVendorWikiPage);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns compiled-memory answer context and citations for MCP callers', async () => {
    const compiledMemory: CompiledMemoryAnswerContext = {
      context:
        "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Approval workflow\nManagers approve discounts above 20%.",
      citations: [],
      citationsBySourceId: {},
      sources: [
        {
          citationNumber: 1,
          sourceId: 'org-2',
          title: 'Approval workflow',
          layer: 'org',
          content: 'Managers approve discounts above 20%.',
          excerpt: 'Managers approve discounts above 20%.',
          confidence: 0.88,
          url: '/dashboard/recordings/recording-2',
          freshness: {
            updatedAt: '2026-04-20T12:00:00.000Z',
            lastSuccessfulSyncAt: null,
            freshnessTarget: null,
            isStale: null,
          },
          provenance: {
            pageId: 'org-2',
            vendorPageId: null,
            vendorSourceId: null,
            sourceKind: null,
            sourceUrl: null,
          },
          matchType: null,
        },
      ],
      priorTopics: [],
    };
    resolveCompiledMemoryAnswerContext.mockResolvedValue(compiledMemory);
    generateCompiledMemoryGroundedAnswer.mockResolvedValue(
      'Managers approve discounts above 20%. [1]',
    );

    const result = await handleAnswerQuestion(
      { question: 'Who approves large discounts?', limit: 2 },
      { orgId: 'org-123' },
    );

    expect(resolveCompiledMemoryAnswerContext).toHaveBeenCalledWith({
      orgId: 'org-123',
      userId: undefined,
      question: 'Who approves large discounts?',
      app: undefined,
      screen: undefined,
      limit: 2,
    });
    expect(generateCompiledMemoryGroundedAnswer).toHaveBeenCalledWith({
      question: 'Who approves large discounts?',
      answerContext: expect.objectContaining({
        context:
          "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Approval workflow\nManagers approve discounts above 20%.",
      }),
    });
    expect(result).toEqual({
      answer: 'Managers approve discounts above 20%. [1]',
      answerContext:
        "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Approval workflow\nManagers approve discounts above 20%.",
      citations: [
        {
          citationNumber: 1,
          sourceId: 'org-2',
          title: 'Approval workflow',
          layer: 'org',
          excerpt: 'Managers approve discounts above 20%.',
          confidence: 0.88,
          url: '/dashboard/recordings/recording-2',
        },
      ],
      priorTopics: [],
      observability: {
        sourceLayers: ['org'],
        orgSourcesCount: 1,
        vendorTrainingSourcesCount: 0,
        vendorSourcesCount: 0,
        citationsCount: 1,
        citationsWithFreshnessCount: 1,
        staleCitationsCount: 0,
        staleVendorCitationsCount: 0,
        vendorSourceIds: [],
        vendorRetrievalMode: 'none',
        hasStaleVendorContent: false,
      },
    });
  });
});

describe('handleSearchKnowledge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unified org wiki and vendor wiki results ranked by similarity', async () => {
    injectRAGContext.mockResolvedValue({ sources: [] } as never);
    searchCompiledOrgWikiPages.mockResolvedValue([
      {
        id: 'org-page-1',
        source: 'org_wiki',
        title: 'Renewal workflow',
        app: 'hubspot',
        screen: 'deals',
        snippet: 'Renewals over 20 seats need approval.',
        content: 'Renewals over 20 seats need approval.',
        confidence: 0.9,
        similarity: 0.82,
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    ]);
    searchVendorWikiPages.mockResolvedValue([
      {
        id: 'vendor-page-1',
        source: 'vendor_wiki',
        title: 'hubspot / deals',
        app: 'hubspot',
        screen: 'deals',
        snippet: 'HubSpot deals track renewal stages.',
        content: 'HubSpot deals track renewal stages.',
        sourceUrl: 'https://docs.example.com/hubspot',
        similarity: 0.91,
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]);

    const results = await handleSearchKnowledge(
      {
        query: 'hubspot renewal approval',
        limit: 5,
        app: 'hubspot',
        screen: 'deals',
      },
      { orgId: 'org-123' },
    );

    expect(searchCompiledOrgWikiPages).toHaveBeenCalledWith({
      orgId: 'org-123',
      query: 'hubspot renewal approval',
      limit: 5,
    });
    expect(searchVendorWikiPages).toHaveBeenCalledWith({
      query: 'hubspot renewal approval',
      limit: 5,
      app: 'hubspot',
      screen: 'deals',
    });
    expect(results.map((result) => result.id)).toEqual([
      'vendor-page-1',
      'org-page-1',
    ]);
  });
});

describe('handleGetWikiPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces org scope for org wiki page retrieval', async () => {
    getOrgWikiPage.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      source: 'org_wiki',
      title: 'Renewal workflow',
      app: null,
      screen: null,
      content: 'Renewals over 20 seats need approval.',
      confidence: 0.9,
      updatedAt: '2026-04-20T00:00:00.000Z',
    });

    await expect(
      handleGetWikiPage(
        {
          source: 'org_wiki',
          pageId: '11111111-1111-4111-8111-111111111111',
        },
        { orgId: 'org-123' },
      ),
    ).resolves.toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      source: 'org_wiki',
    });

    expect(getOrgWikiPage).toHaveBeenCalledWith({
      orgId: 'org-123',
      pageId: '11111111-1111-4111-8111-111111111111',
    });
    expect(getVendorWikiPage).not.toHaveBeenCalled();
  });

  it('returns not_found when the requested wiki page is inaccessible', async () => {
    getOrgWikiPage.mockResolvedValue(null);

    await expect(
      handleGetWikiPage(
        {
          source: 'org_wiki',
          pageId: '11111111-1111-4111-8111-111111111111',
        },
        { orgId: 'org-123' },
      ),
    ).rejects.toMatchObject({
      code: 'not_found',
      message: 'Wiki page not found or not accessible',
    });
  });
});
