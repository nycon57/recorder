import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CompiledMemoryAnswerContext } from '@/lib/services/compiled-memory-answer-context';

let handleAnswerQuestion: typeof import('../handlers').handleAnswerQuestion;
let resolveCompiledMemoryAnswerContext: jest.MockedFunction<
  typeof import('@/lib/services/compiled-memory-answer-context').resolveCompiledMemoryAnswerContext
>;
let generateCompiledMemoryGroundedAnswer: jest.MockedFunction<
  typeof import('@/lib/services/compiled-memory-answer').generateCompiledMemoryGroundedAnswer
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

describe('handleAnswerQuestion', () => {
  beforeAll(async () => {
    ({ handleAnswerQuestion } = await import('../handlers'));
    resolveCompiledMemoryAnswerContext = jest.mocked(
      (
        await import('@/lib/services/compiled-memory-answer-context')
      ).resolveCompiledMemoryAnswerContext,
    );
    generateCompiledMemoryGroundedAnswer = jest.mocked(
      (await import('@/lib/services/compiled-memory-answer'))
        .generateCompiledMemoryGroundedAnswer,
    );
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
