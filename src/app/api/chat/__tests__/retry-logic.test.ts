/** @jest-environment node */

/**
 * Integration tests for the current Chat API retrieval routing.
 *
 * Legacy chunk-RAG threshold retries were removed when chat moved to compiled
 * memory as the canonical answer layer. These tests cover the active contract:
 * standard questions resolve compiled memory, discovery questions route to
 * tools, and retrieval failures are surfaced with monitoring metadata.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type ChatRoute = typeof import('../route');
type OrgContext = { orgId: string; userId: string };
type BotCheckResult = { isBot: boolean };
type PreprocessResult = {
  originalQuery: string;
  processedQuery: string;
  wasTransformed: boolean;
  transformation?: string;
};
type CompiledMemoryTestContext = {
  context: string;
  priorTopics: string[];
  sources: Array<Record<string, unknown>>;
};
type StreamTextOptions = {
  system?: string;
  tools?: Record<string, unknown>;
};
type StreamTextResult = {
  toUIMessageStreamResponse: () => Response;
};
type SearchMonitorMock = jest.Mocked<
  typeof import('@/lib/services/search-monitoring').searchMonitor
>;

const mockRequireOrg = jest.fn<() => Promise<OrgContext>>();
const mockCheckBotId = jest.fn<() => Promise<BotCheckResult>>();
const mockResolveCompiledMemoryAnswerContext = jest.fn<
  (input: unknown) => Promise<CompiledMemoryTestContext>
>();
const mockSummarizeCompiledMemoryAnswerObservability = jest.fn<
  (context: unknown) => Record<string, unknown>
>();
const mockPreprocessQuery = jest.fn<(query: string) => Promise<PreprocessResult>>();
const mockSupabaseFrom = jest.fn<(...args: unknown[]) => unknown>();
const mockStreamText = jest.fn<(options: StreamTextOptions) => StreamTextResult>();
const mockAfter = jest.fn<(callback: () => unknown) => unknown>();

jest.mock('@/lib/utils/api', () => ({
  requireOrg: () => mockRequireOrg(),
}));

jest.mock('botid/server', () => ({
  checkBotId: () => mockCheckBotId(),
}));

jest.mock('next/server', () => ({
  after: (callback: () => unknown) => mockAfter(callback),
}));

jest.mock('@/lib/services/compiled-memory-answer-context', () => ({
  resolveCompiledMemoryAnswerContext: (input: unknown) =>
    mockResolveCompiledMemoryAnswerContext(input),
  summarizeCompiledMemoryAnswerObservability: (context: unknown) =>
    mockSummarizeCompiledMemoryAnswerObservability(context),
}));

jest.mock('@/lib/services/query-preprocessor', () => ({
  preprocessQuery: (query: string) => mockPreprocessQuery(query),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

jest.mock('ai', () => ({
  streamText: (options: StreamTextOptions) => mockStreamText(options),
  tool: jest.fn((config) => config),
  stepCountIs: jest.fn((count) => count),
}));

jest.mock('@ai-sdk/google', () => ({
  google: jest.fn(() => 'mock-google-model'),
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
  toolDescriptions: {
    searchRecordings: 'Search recordings',
    getDocument: 'Get document',
    getTranscript: 'Get transcript',
    getRecordingMetadata: 'Get recording metadata',
    listRecordings: 'List recordings',
    searchConcepts: 'Search concepts',
    getConceptDetails: 'Get concept details',
    exploreKnowledgeGraph: 'Explore knowledge graph',
  },
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
    updateConfig: jest.fn(),
    endSearch: jest.fn(),
    recordRetry: jest.fn(),
  },
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeChatTelemetry: jest.fn((payload) => payload),
  recordKnowledgeTelemetryEvent: jest.fn(),
}));

function completedContentCount(count: number) {
  const query = {
    count,
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
  };

  return query;
}

function requestFor(content: string, extraBody: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content }],
      ...extraBody,
    }),
  });
}

function streamResponse() {
  return new Response('mock-stream');
}

describe('Chat API - Retrieval Routing', () => {
  let chatRoute: ChatRoute;
  let searchMonitor: typeof import('@/lib/services/search-monitoring').searchMonitor;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.ENABLE_CHAT_TOOLS = 'true';
    process.env.ENABLE_SEARCH_MONITORING = 'true';

    mockRequireOrg.mockResolvedValue({ orgId: 'test-org-id', userId: 'test-user-id' });
    mockCheckBotId.mockResolvedValue({ isBot: false });
    mockPreprocessQuery.mockImplementation(async (query: string) => ({
      originalQuery: query,
      processedQuery: query,
      wasTransformed: false,
    }));
    mockSupabaseFrom.mockReturnValue(completedContentCount(5));
    mockSummarizeCompiledMemoryAnswerObservability.mockReturnValue({});
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: jest.fn(streamResponse),
    });
    mockResolveCompiledMemoryAnswerContext.mockResolvedValue({
      context: '[1] Accelerate Login Guide: The login process involves SSO.',
      priorTopics: [],
      sources: [
        {
          sourceId: 'wiki-page-1',
          title: 'Accelerate Login Guide',
          url: '/dashboard/knowledge/wiki-page-1',
          excerpt: 'The login process involves SSO.',
          confidence: 0.88,
          citationNumber: 1,
          layer: 'team',
          freshness: 'current',
          provenance: {
            source: 'wiki',
          },
        },
      ],
    });

    chatRoute = await import('../route');
    searchMonitor = (
      jest.requireMock('@/lib/services/search-monitoring') as {
        searchMonitor: SearchMonitorMock;
      }
    ).searchMonitor;
  });

  afterEach(() => {
    delete process.env.ENABLE_CHAT_TOOLS;
    delete process.env.ENABLE_SEARCH_MONITORING;
  });

  it('resolves compiled memory for standard questions', async () => {
    const response = await chatRoute.POST(
      requestFor('What is the accelerate login process?'),
    );

    expect(response.status).toBe(200);
    expect(mockResolveCompiledMemoryAnswerContext).toHaveBeenCalledWith({
      orgId: 'test-org-id',
      userId: 'test-user-id',
      question: 'What is the accelerate login process?',
    });
    expect(response.headers.get('X-Answer-Mode')).toBe('compiled-memory');
    expect(response.headers.get('X-Search-Strategy')).toBe('compiled_memory');
    expect(response.headers.get('X-Sources-Count')).toBe('1');
    expect(response.headers.get('X-Retrieval-Attempts')).toBe('1');
    expect(response.headers.get('X-Threshold-Used')).toBe('N/A');
    expect(response.headers.get('X-Similarity-Avg')).toBe('N/A');

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('**COMPILED MEMORY:**'),
        tools: undefined,
      }),
    );
    expect(searchMonitor.updateConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        strategy: 'compiled_memory',
        useAgentic: false,
      }),
    );
    expect(searchMonitor.endSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        success: true,
        usedToolFallback: false,
      }),
    );
  });

  it('routes meta-discovery questions to tool discovery instead of compiled memory', async () => {
    mockPreprocessQuery.mockResolvedValueOnce({
      originalQuery: 'What can you help me with?',
      processedQuery: 'available topics recordings knowledge base',
      wasTransformed: true,
      transformation: 'meta-question-extraction-and-expansion',
    });

    const response = await chatRoute.POST(requestFor('What can you help me with?'));
    const streamCall = mockStreamText.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(mockResolveCompiledMemoryAnswerContext).not.toHaveBeenCalled();
    expect(response.headers.get('X-Answer-Mode')).toBe('tool-discovery');
    expect(response.headers.get('X-Search-Strategy')).toBe('tool_discovery_meta');
    expect(response.headers.get('X-Sources-Count')).toBe('0');
    expect(response.headers.get('X-Retrieval-Attempts')).toBe('0');
    expect(Object.keys(streamCall.tools ?? {})).toEqual(
      expect.arrayContaining([
        'searchRecordings',
        'listRecordings',
        'exploreKnowledgeGraph',
      ]),
    );
    expect(searchMonitor.updateConfig).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        strategy: 'tool_discovery_meta',
        useAgentic: false,
      }),
    );
  });

  it('scopes discovery tools when the caller selects recording ids', async () => {
    const response = await chatRoute.POST(
      requestFor('Search this recording for onboarding', {
        recordingIds: ['content-1'],
      }),
    );
    const streamCall = mockStreamText.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(mockResolveCompiledMemoryAnswerContext).not.toHaveBeenCalled();
    expect(response.headers.get('X-Answer-Mode')).toBe('tool-discovery');
    expect(response.headers.get('X-Search-Strategy')).toBe('tool_discovery_scoped');
    expect(Object.keys(streamCall.tools ?? {})).toEqual(['searchRecordings']);
  });

  it('returns a generation error and closes monitoring when compiled-memory retrieval fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockResolveCompiledMemoryAnswerContext.mockRejectedValueOnce(
      new Error('Compiled memory unavailable'),
    );

    const response = await chatRoute.POST(requestFor('test query'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Compiled memory unavailable',
        code: 'GENERATION_ERROR',
      },
    });
    expect(searchMonitor.endSearch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        success: false,
        sourcesFound: 0,
      }),
    );

    consoleErrorSpy.mockRestore();
  });
});
