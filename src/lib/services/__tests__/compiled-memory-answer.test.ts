import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CompiledMemoryAnswerContext } from '@/lib/services/compiled-memory-answer-context';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  WritableStream,
});

let generateCompiledMemoryGroundedAnswer: typeof import('../compiled-memory-answer').generateCompiledMemoryGroundedAnswer;
let NO_COMPILED_MEMORY_ANSWER: typeof import('../compiled-memory-answer').NO_COMPILED_MEMORY_ANSWER;

const mockGenerateText = jest.fn<typeof import('ai').generateText>();
const mockGoogle = jest.fn<typeof import('@ai-sdk/google').google>();

jest.mock('ai', () => ({
  generateText: (...args: Parameters<typeof mockGenerateText>) =>
    mockGenerateText(...args),
}));

jest.mock('@ai-sdk/google', () => ({
  google: (...args: Parameters<typeof mockGoogle>) => mockGoogle(...args),
}));

function buildAnswerContext(
  overrides: Partial<CompiledMemoryAnswerContext> = {},
): CompiledMemoryAnswerContext {
  return {
    context:
      "SOURCE PRECEDENCE:\n- Prefer YOUR TEAM'S KNOWLEDGE.\n\nYOUR TEAM'S KNOWLEDGE:\n[1] Approval workflow\nManagers approve discounts above 20%.",
    sources: [
      {
        citationNumber: 1,
        sourceId: 'org-1',
        title: 'Approval workflow',
        layer: 'org',
        content: 'Managers approve discounts above 20%.',
        excerpt: 'Managers approve discounts above 20%.',
        confidence: 0.88,
        url: '/dashboard/recordings/recording-1',
        freshness: {
          updatedAt: '2026-04-20T12:00:00.000Z',
          lastSuccessfulSyncAt: null,
          freshnessTarget: null,
          isStale: null,
        },
        provenance: {
          pageId: 'org-1',
          vendorPageId: null,
          vendorSourceId: null,
          sourceKind: null,
          sourceUrl: null,
        },
        matchType: null,
      },
    ],
    citations: [],
    citationsBySourceId: {},
    priorTopics: [],
    ...overrides,
  };
}

describe('generateCompiledMemoryGroundedAnswer', () => {
  beforeAll(async () => {
    ({
      generateCompiledMemoryGroundedAnswer,
      NO_COMPILED_MEMORY_ANSWER,
    } = await import('../compiled-memory-answer'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogle.mockReturnValue('mock-google-model' as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the compiled-memory fallback when there are no sources', async () => {
    const result = await generateCompiledMemoryGroundedAnswer({
      question: 'How do approvals work?',
      answerContext: buildAnswerContext({
        context: '',
        sources: [],
      }),
    });

    expect(result).toBe(NO_COMPILED_MEMORY_ANSWER);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('generates a grounded answer when compiled memory is available', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Managers approve discounts above 20%. [1]',
    } as Awaited<ReturnType<typeof import('ai').generateText>>);

    const result = await generateCompiledMemoryGroundedAnswer({
      question: 'How do approvals work?',
      answerContext: buildAnswerContext({
        priorTopics: ['Approval workflow'],
      }),
    });

    expect(mockGoogle).toHaveBeenCalledWith('gemini-2.5-flash');
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-google-model',
        prompt: 'How do approvals work?',
        temperature: 0.2,
        maxOutputTokens: 1024,
        system: expect.stringContaining('COMPILED MEMORY'),
      }),
    );
    expect(result).toBe('Managers approve discounts above 20%. [1]');
  });

  it('falls back cleanly when answer generation throws', async () => {
    mockGenerateText.mockRejectedValue(new Error('llm unavailable'));

    const result = await generateCompiledMemoryGroundedAnswer({
      question: 'How do approvals work?',
      answerContext: buildAnswerContext(),
    });

    expect(result).toBe(NO_COMPILED_MEMORY_ANSWER);
  });
});
