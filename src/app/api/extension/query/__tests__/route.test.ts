/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type StreamChunk = { text: string };
type PromptArgs = {
  elements: Array<{ selector: string; label: string }>;
  pageContext?: unknown;
};

const generateContentStream =
  jest.fn<() => Promise<AsyncGenerator<StreamChunk>>>();
const buildExtensionCompiledMemoryPrompt =
  jest.fn<(args: PromptArgs) => string>();
const resolveCompiledMemoryAnswerContext = jest.fn<() => Promise<unknown>>();
const mockRequireApiKeyOrSession = jest.fn();

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
  requireApiKeyOrSession: (...args: unknown[]) =>
    mockRequireApiKeyOrSession(...args),
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
  resolveCompiledMemoryAnswerContext,
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
    resolveCompiledMemoryAnswerContext.mockResolvedValue({
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
    });
    buildExtensionCompiledMemoryPrompt.mockReturnValue('fusion prompt');
    generateContentStream.mockResolvedValue(
      streamText('Use [ELEMENT:#save:Save deal] now.'),
    );
    mockRequireApiKeyOrSession.mockResolvedValue({
      orgId: 'org_test',
      userId: 'user_test',
      role: 'admin',
      authMethod: 'session',
    });
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
        elements: [{ selector: '#save', label: 'Save deal' }],
        pageContext: expect.objectContaining({
          interactiveElements: [
            {
              selector: '#save',
              label: 'Save deal',
              type: 'button',
            },
          ],
        }),
      }),
    );
    expect(streamBody).toContain('"type":"element_ref"');
    expect(streamBody).toContain('"selector":"#save"');
    expect(streamBody).toContain('"label":"Save deal"');
  });

  it('accepts API-key auth for SDK queries without a browser session', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      userId: 'api_key_user',
      role: 'admin',
      authMethod: 'api_key',
      keyId: 'key_1',
      customerOrgId: 'customer_org',
    });
    const { POST } = await import('../route');

    const request = buildRequest({
      question: 'What should I do on this account page?',
      context: {
        url: 'https://example.com/accounts/123',
        appSignature: 'salesforce:account-detail',
        interactiveElements: [
          {
            selector: '#next-step',
            label: 'Next step',
            type: 'button',
          },
        ],
      },
    });
    request.headers.set('authorization', 'Bearer sk_live_test_key');

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockRequireApiKeyOrSession).toHaveBeenCalledWith(
      request,
      'query',
    );
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [{ selector: '#next-step', label: 'Next step' }],
      }),
    );
    expect(await response.text()).toContain('"type":"element_ref"');
  });

  it('uses DOM-grounded generation when compiled memory has no sources but page context exists', async () => {
    resolveCompiledMemoryAnswerContext.mockResolvedValue({
      context: '',
      sources: [],
      citations: [],
      citationsBySourceId: {},
      priorTopics: [],
    });
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'Where can I change billing?',
        context: {
          url: 'https://example.com/settings',
          appSignature: 'unknown:settings',
          interactiveElements: [
            {
              selector: '#billing',
              label: 'Billing',
              type: 'link',
            },
          ],
          regions: [
            {
              id: 'region-1',
              selector: 'main',
              kind: 'main',
              label: 'Settings',
              interactiveCount: 1,
              snippetCount: 1,
            },
          ],
          snippets: [
            {
              id: 'snippet-1',
              selector: 'h1',
              regionId: 'region-1',
              kind: 'heading',
              text: 'Settings',
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        pageContext: expect.objectContaining({
          regions: expect.arrayContaining([
            expect.objectContaining({ label: 'Settings' }),
          ]),
        }),
      }),
    );
    expect(await response.text()).not.toContain('help center');
  });

  it('sanitizes posted page context before building the model prompt', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'What is on this page?',
        context: {
          url: 'https://user:pass@example.com/deals/123?token=secret#notes',
          appSignature: 'salesforce:opportunity-detail',
          pageSummary:
            'Contact jane@example.com token api_key=super-secret-token visible in page',
          visibleText: 'Raw body with card 4242 4242 4242 4242',
          interactiveElements: [
            {
              selector: '#email',
              label: 'Email jane@example.com',
              type: 'input',
              placeholder: 'jane@example.com',
            },
            {
              selector: 'button[aria-label="Email jane@example.com"]',
              label: 'Email jane@example.com',
              type: 'button',
            },
          ],
          snippets: [
            {
              id: 'snippet-1',
              selector: 'p',
              kind: 'text',
              text: 'Call +1 (415) 555-2671',
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
    const promptArgs = buildExtensionCompiledMemoryPrompt.mock.calls[0]?.[0];
    expect(promptArgs).toMatchObject({
      elements: [{ selector: '#email', label: 'Email [REDACTED]' }],
      pageContext: expect.objectContaining({
        url: 'https://example.com/deals/123',
        pageSummary:
          'Contact [REDACTED] token api_key=[REDACTED] visible in page',
        interactiveElements: [
          expect.objectContaining({
            selector: '#email',
            label: 'Email [REDACTED]',
            placeholder: '[REDACTED]',
          }),
        ],
        snippets: [
          expect.objectContaining({
            text: 'Call [REDACTED]',
          }),
        ],
      }),
    });
    expect(promptArgs?.pageContext).not.toHaveProperty('visibleText');
    expect(
      (promptArgs?.pageContext as { interactiveElements?: unknown[] })
        .interactiveElements,
    ).toHaveLength(1);
    expect(JSON.stringify(promptArgs)).not.toContain('super-secret-token');
    expect(JSON.stringify(promptArgs)).not.toContain('4242');
    expect(JSON.stringify(promptArgs)).not.toContain('user:pass');
    expect(JSON.stringify(promptArgs)).not.toContain(
      'button[aria-label="[REDACTED]"]',
    );
  });
});
