import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../chat-rag-integration', () => ({
  injectRAGContext: jest.fn(),
}));

jest.mock('../compiled-memory-answer-context', () => ({
  resolveCompiledMemoryAnswerContext: jest.fn(),
  buildCompiledMemoryCitations: jest.fn((sources) =>
    sources.map((source: any, index: number) => ({
      citationNumber: index + 1,
      sourceId: source.sourceId,
      title: source.title,
      layer: source.layer,
      excerpt: source.excerpt,
      confidence: source.confidence,
      url: source.url,
    })),
  ),
}));

const { resolveCompiledMemoryAnswerContext } = require(
  '../compiled-memory-answer-context',
) as {
  resolveCompiledMemoryAnswerContext: jest.Mock;
};
const { executeAnswerQuestion } = require('../chat-tools') as {
  executeAnswerQuestion: (
    args: {
      question: string;
      app?: string;
      screen?: string;
      limit?: number;
    },
    context: { orgId: string; userId: string }
  ) => Promise<unknown>;
};

describe('executeAnswerQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns compiled-memory answer context with ordered citations', async () => {
    (resolveCompiledMemoryAnswerContext as jest.Mock).mockResolvedValue({
      context:
        "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Deal routing\nEnterprise leads skip the SDR queue.",
      sources: [
        {
          sourceId: 'org-1',
          title: 'Deal routing',
          layer: 'org',
          content: 'Enterprise leads skip the SDR queue.',
          excerpt: 'Enterprise leads skip the SDR queue.',
          confidence: 0.94,
          url: '/dashboard/recordings/recording-1',
        },
      ],
      priorTopics: ['Deal routing'],
    });

    const result = await executeAnswerQuestion(
      { question: 'How do enterprise leads route?' },
      { orgId: 'org-123', userId: 'user-123' },
    );

    expect(resolveCompiledMemoryAnswerContext).toHaveBeenCalledWith({
      orgId: 'org-123',
      userId: 'user-123',
      question: 'How do enterprise leads route?',
      app: undefined,
      screen: undefined,
      limit: undefined,
    });
    expect(result).toEqual({
      success: true,
      data: {
        message: 'Compiled-memory answer context ready for grounded Q&A.',
        answerContext:
          "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Deal routing\nEnterprise leads skip the SDR queue.",
        citations: [
          {
            citationNumber: 1,
            sourceId: 'org-1',
            title: 'Deal routing',
            layer: 'org',
            excerpt: 'Enterprise leads skip the SDR queue.',
            confidence: 0.94,
            url: '/dashboard/recordings/recording-1',
          },
        ],
        priorTopics: ['Deal routing'],
      },
    });
  });
});
