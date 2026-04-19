import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
  '@/lib/services/compiled-memory-answer-context',
) as {
  resolveCompiledMemoryAnswerContext: jest.Mock;
};
const { handleAnswerQuestion } = require('../handlers') as {
  handleAnswerQuestion: (
    args: { question: string; app?: string; screen?: string; limit?: number },
    context: { orgId: string; userId?: string }
  ) => Promise<unknown>;
};

describe('handleAnswerQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns compiled-memory answer context and citations for MCP callers', async () => {
    (resolveCompiledMemoryAnswerContext as jest.Mock).mockResolvedValue({
      context:
        "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Approval workflow\nManagers approve discounts above 20%.",
      sources: [
        {
          sourceId: 'org-2',
          title: 'Approval workflow',
          layer: 'org',
          content: 'Managers approve discounts above 20%.',
          excerpt: 'Managers approve discounts above 20%.',
          confidence: 0.88,
          url: '/dashboard/recordings/recording-2',
        },
      ],
      priorTopics: [],
    });

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
    expect(result).toEqual({
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
    });
  });
});
