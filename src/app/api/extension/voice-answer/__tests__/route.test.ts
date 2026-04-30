/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type GenerateContentResult = { text?: string };
type PromptArgs = {
  app: string;
  screen: string;
  question: string;
  pageContext?: unknown;
};

const generateContent =
  jest.fn<() => Promise<GenerateContentResult>>();
const buildExtensionCompiledMemoryPrompt =
  jest.fn<(args: PromptArgs) => string>();
const resolveCompiledMemoryAnswerContext =
  jest.fn<() => Promise<unknown>>();
const mockRequireApiKeyOrSession =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
let previousGoogleAiApiKey: string | undefined;

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent,
    },
  })),
}));

jest.mock('next/server', () => ({
  NextRequest: class {},
  after: (callback: () => void | Promise<void>) => callback(),
}));

jest.mock('@/lib/utils/api-key-auth', () => ({
  requireApiKeyOrSession: (...args: unknown[]) =>
    mockRequireApiKeyOrSession(...args),
}));

jest.mock('@/lib/services/vendor-customers', () => ({
  resolveCustomerOrgForVendor: jest.fn(),
}));

jest.mock('@/lib/utils/api', () => ({
  errors: {
    badRequest: (message: string) =>
      Response.json({ code: 'BAD_REQUEST', message }, { status: 400 }),
    forbidden: () =>
      Response.json(
        { code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      ),
    rateLimitExceeded: () =>
      Response.json(
        { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
        { status: 429 },
      ),
    unauthorized: () =>
      Response.json(
        { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
  },
}));

jest.mock('@/lib/utils/cors', () => ({
  CORS_HEADERS: {},
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));

jest.mock('@/lib/services/compiled-memory-answer-context', () => ({
  buildExtensionCompiledMemoryPrompt,
  resolveCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability: jest.fn().mockReturnValue({
    sourceLayers: [],
    orgSourcesCount: 0,
    vendorTrainingSourcesCount: 0,
    vendorSourcesCount: 0,
    citationsCount: 0,
    citationsWithFreshnessCount: 0,
    staleCitationsCount: 0,
    staleVendorCitationsCount: 0,
    vendorSourceIds: [],
    vendorRetrievalMode: 'none',
    hasStaleVendorContent: false,
  }),
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeExtensionQueryTelemetry: jest.fn().mockReturnValue({}),
  recordKnowledgeTelemetryEvent: jest.fn(),
}));

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    nextUrl: new URL('http://localhost:3000/api/extension/voice-answer'),
  } as unknown as NextRequest;
}

describe('POST /api/extension/voice-answer', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    previousGoogleAiApiKey = process.env.GOOGLE_AI_API_KEY;
    process.env.GOOGLE_AI_API_KEY = 'test-key';

    mockRequireApiKeyOrSession.mockResolvedValue({
      orgId: 'org_test',
      userId: 'user_test',
      role: 'admin',
      authMethod: 'session',
    });
    resolveCompiledMemoryAnswerContext.mockResolvedValue({
      context: '',
      sources: [],
      citations: [],
      citationsBySourceId: {},
      priorTopics: [],
    });
    buildExtensionCompiledMemoryPrompt.mockReturnValue('fusion prompt');
    generateContent.mockResolvedValue({
      text: 'Use the visible page summary.',
    });
  });

  afterEach(() => {
    if (previousGoogleAiApiKey === undefined) {
      delete process.env.GOOGLE_AI_API_KEY;
      return;
    }

    process.env.GOOGLE_AI_API_KEY = previousGoogleAiApiKey;
  });

  it('accepts context.url without appSignature and falls back to app/screen', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'What should I do here?',
        context: {
          app: 'hubspot',
          screen: 'contact-record',
          url: 'https://app.hubspot.com/contacts/123',
          title: 'Contact record',
          pageSummary: 'A contact record is visible.',
          interactiveElements: [],
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        text: 'Use the visible page summary.',
        knowledgeMode: 'dom_only',
      }),
    );
    expect(resolveCompiledMemoryAnswerContext).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'hubspot',
        screen: 'contact-record',
        orgId: 'org_test',
        userId: 'user_test',
      }),
    );
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'hubspot',
        screen: 'contact-record',
      }),
    );
  });
});
