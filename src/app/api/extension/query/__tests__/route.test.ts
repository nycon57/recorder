/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type StreamChunk = { text: string };
type PromptArgs = {
  elements: Array<{ selector: string; label: string; type?: string }>;
};

const generateContentStream = jest.fn<() => Promise<AsyncGenerator<StreamChunk>>>();
const buildExtensionCompiledMemoryPrompt = jest.fn<(args: PromptArgs) => string>();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContentStream,
    },
  })),
}));

jest.mock('next/server', () => ({
  NextRequest: class {},
  after: jest.fn(),
}));

jest.mock('@/lib/utils/api-key-auth', () => ({
  requireApiKeyOrSession: async () => ({
    orgId: 'org_test',
    userId: 'user_test',
    role: 'admin',
    authMethod: 'session',
  }),
}));

jest.mock('@/lib/utils/api', () => ({
  errors: {
    badRequest: (message: string) =>
      Response.json({ code: 'BAD_REQUEST', message }, { status: 400 }),
    forbidden: () =>
      Response.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 }),
    rateLimitExceeded: () =>
      Response.json(
        { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' },
        { status: 429 },
      ),
    unauthorized: () =>
      Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 }),
  },
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  buildKnowledgeExtensionQueryTelemetry: jest.fn().mockReturnValue({}),
  recordKnowledgeTelemetryEvent: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/utils/cors', () => ({
  CORS_HEADERS: {},
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));

jest.mock('@/lib/services/compiled-memory-answer-context', () => ({
  buildExtensionCompiledMemoryPrompt,
  resolveCompiledMemoryAnswerContext: async () => ({
    context: 'compiled memory context',
    sources: [
      {
        layer: 'org',
        provenance: { pageId: 'page-1' },
      },
    ],
    citations: [],
    citationsBySourceId: {},
    priorTopics: [],
  }),
  summarizeCompiledMemoryAnswerObservability: jest.fn().mockReturnValue({
    sourceLayers: ['org'],
    orgSourcesCount: 1,
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

async function* streamText(text: string) {
  yield { text };
}

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
    nextUrl: new URL('http://localhost:3000/api/extension/query'),
  } as unknown as NextRequest;
}

describe('POST /api/extension/query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildExtensionCompiledMemoryPrompt.mockReturnValue('fusion prompt');
    generateContentStream.mockResolvedValue(streamText('Use [ELEMENT:#save:Save deal] now.'));
  });

  it('passes SDK interactiveElements selector and label refs into the prompt and stream path', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'How do I save this?',
        context: {
          url: 'https://example.com/deals/123',
          appSignature: 'salesforce:opportunity-detail',
          interactiveElements: [
            {
              selector: '#save',
              label: 'Save deal',
              type: 'button',
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
    const streamBody = await response.text();

    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [{ selector: '#save', label: 'Save deal', type: 'button' }],
      }),
    );
    expect(streamBody).toContain('"type":"element_ref"');
    expect(streamBody).toContain('"selector":"#save"');
    expect(streamBody).toContain('"label":"Save deal"');
  });
});
