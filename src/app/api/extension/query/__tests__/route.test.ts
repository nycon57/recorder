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
const mockRequireApiKeyOrSession =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const resolveExtensionContextMatches =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const resolveCustomerOrgForVendor =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockCreateAdminClient = jest.fn<() => unknown>();
const afterCallbacks: Array<() => void | Promise<void>> = [];

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContentStream,
    },
  })),
}));

jest.mock('next/server', () => ({
  NextRequest: class {},
  after: (callback: () => void | Promise<void>) => {
    afterCallbacks.push(callback);
  },
}));

jest.mock('@/lib/utils/api-key-auth', () => ({
  requireApiKeyOrSession: (...args: unknown[]) =>
    mockRequireApiKeyOrSession(...args),
}));

jest.mock('@/lib/services/vendor-customers', () => ({
  resolveCustomerOrgForVendor: (...args: unknown[]) =>
    resolveCustomerOrgForVendor(...args),
}));

jest.mock('@/lib/services/extension-context', () => ({
  resolveExtensionContextMatches: (...args: unknown[]) =>
    resolveExtensionContextMatches(...args),
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
  createClient: mockCreateAdminClient,
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

async function runAfterCallbacks() {
  await Promise.all(
    Array.from(afterCallbacks).map(async (callback) => {
      await callback();
    }),
  );
}

function createSupabaseAnalyticsMock() {
  const userWikiInsert = jest.fn();
  const vendorUsageInsert = jest.fn();
  const productEventInsert = jest.fn();

  return {
    userWikiInsert,
    vendorUsageInsert,
    productEventInsert,
    client: {
      from: jest.fn((table: string) => {
        if (table === 'user_wiki_interactions') {
          const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            in: jest.fn(() => query),
            gte: jest.fn(async () => ({ data: [], error: null })),
            insert: userWikiInsert,
          };
          return query;
        }

        if (table === 'vendor_usage_events') {
          return { insert: vendorUsageInsert };
        }

        if (table === 'extension_product_events') {
          return { insert: productEventInsert };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}

describe('POST /api/extension/query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    mockCreateAdminClient.mockReset();
    resolveExtensionContextMatches.mockResolvedValue({
      vendorKnowledgeMatch: null,
      orgKnowledgeMatch: null,
      knowledgeAvailability: {
        hasVendorDocs: false,
        hasOrgKnowledge: false,
        mode: 'dom_only',
        message: 'No knowledge available.',
      },
      relevantWikiPages: [],
    });
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
    resolveCustomerOrgForVendor.mockResolvedValue({
      id: 'customer_org',
      name: 'Customer Org',
      slug: 'customer-org',
      plan: 'pro',
      created_at: '2026-04-29T00:00:00.000Z',
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

  it('uses verified customer org scope for API-key SDK queries', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      authMethod: 'api_key',
      keyId: 'key_1',
      configId: 'config_1',
      scopes: ['query'],
    });
    const { POST } = await import('../route');

    const request = buildRequest({
      question: 'What should I do on this account page?',
      customerOrgId: 'customer_org',
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
    const streamBody = await response.text();
    expect(mockRequireApiKeyOrSession).toHaveBeenCalledWith(request, 'query');
    expect(resolveCustomerOrgForVendor).toHaveBeenCalledWith(
      'vendor_org',
      'customer_org',
    );
    expect(resolveCompiledMemoryAnswerContext).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'customer_org',
        userId: 'key_1',
      }),
    );
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [{ selector: '#next-step', label: 'Next step' }],
      }),
    );
    expect(streamBody).toContain('"type":"element_ref"');
  });

  it('writes API-key usage analytics with vendor and customer org IDs', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      authMethod: 'api_key',
      keyId: 'key_1',
      configId: 'config_1',
      scopes: ['query'],
    });
    const analytics = createSupabaseAnalyticsMock();
    mockCreateAdminClient.mockReturnValue(analytics.client);
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'What should I do on this account page?',
        customerOrgId: 'customer_org',
        context: {
          url: 'https://example.com/accounts/123',
          appSignature: 'salesforce:account-detail',
          interactiveElements: [],
        },
      }),
    );

    expect(response.status).toBe(200);
    await response.text();
    await runAfterCallbacks();

    expect(analytics.userWikiInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'key_1',
        org_id: 'customer_org',
        wiki_page_id: 'page-1',
        interaction_type: 'taught',
      }),
    ]);
    expect(analytics.vendorUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_org_id: 'vendor_org',
        customer_org_id: 'customer_org',
        api_key_id: 'key_1',
        event_type: 'query',
        app: 'salesforce',
        screen: 'account-detail',
        had_org_knowledge: true,
        had_vendor_knowledge: false,
      }),
    );
  });

  it('rejects API-key SDK queries without a customer org target', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      authMethod: 'api_key',
      keyId: 'key_1',
      configId: 'config_1',
      scopes: ['query'],
    });
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'What should I do on this account page?',
        context: {
          url: 'https://example.com/accounts/123',
          appSignature: 'salesforce:account-detail',
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveCustomerOrgForVendor).not.toHaveBeenCalled();
    expect(resolveCompiledMemoryAnswerContext).not.toHaveBeenCalled();
  });

  it('rejects forged API-key customer org targets', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      authMethod: 'api_key',
      keyId: 'key_1',
      configId: 'config_1',
      scopes: ['query'],
    });
    resolveCustomerOrgForVendor.mockResolvedValueOnce(null);
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'What should I do on this account page?',
        customerOrgId: 'other_customer_org',
        context: {
          url: 'https://example.com/accounts/123',
          appSignature: 'salesforce:account-detail',
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(resolveCustomerOrgForVendor).toHaveBeenCalledWith(
      'vendor_org',
      'other_customer_org',
    );
    expect(resolveCompiledMemoryAnswerContext).not.toHaveBeenCalled();
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
    const streamBody = await response.text();
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        pageContext: expect.objectContaining({
          regions: expect.arrayContaining([
            expect.objectContaining({ label: 'Settings' }),
          ]),
        }),
      }),
    );
    expect(streamBody).not.toContain('help center');
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
    await response.text();
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

  it.each([
    {
      basis: 'exact',
      vendorPageId: 'vendor-exact-page',
      orgPageId: 'org-exact-page',
    },
    {
      basis: 'screen_alias',
      vendorPageId: 'vendor-alias-page',
      orgPageId: 'org-alias-page',
    },
    {
      basis: 'app_only',
      vendorPageId: 'vendor-app-page',
      orgPageId: 'org-app-page',
    },
    {
      basis: 'domain_alias',
      vendorPageId: 'vendor-domain-page',
      orgPageId: 'org-domain-page',
    },
  ] as const)(
    'passes $basis context match page IDs into compiled-memory recall',
    async ({ basis, vendorPageId, orgPageId }) => {
      resolveExtensionContextMatches.mockResolvedValueOnce({
        vendorKnowledgeMatch: {
          matched: true,
          basis,
          confidence: 0.8,
          pageIds: [vendorPageId],
        },
        orgKnowledgeMatch: {
          matched: true,
          basis,
          confidence: 0.9,
          pageIds: [orgPageId],
        },
        knowledgeAvailability: {
          hasVendorDocs: true,
          hasOrgKnowledge: true,
          mode: 'org_backed',
          message: 'Knowledge available.',
        },
        relevantWikiPages: [vendorPageId, orgPageId],
      });
      const { POST } = await import('../route');

      const response = await POST(
        buildRequest({
          question: 'What should I do here?',
          context: {
            url:
              basis === 'domain_alias'
                ? 'https://acme.salesforce.com/lightning/page/home'
                : 'https://example.com/accounts/123',
            appSignature:
              basis === 'domain_alias'
                ? 'unknown:home'
                : 'salesforce:account-detail',
            interactiveElements: [],
          },
        }),
      );

      expect(response.status).toBe(200);
      await response.text();
      expect(resolveExtensionContextMatches).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org_test',
          app: basis === 'domain_alias' ? 'unknown' : 'salesforce',
          screen: basis === 'domain_alias' ? 'home' : 'account-detail',
        }),
      );
      expect(resolveCompiledMemoryAnswerContext).toHaveBeenCalledWith(
        expect.objectContaining({
          contextMatches: {
            vendorPageIds: [vendorPageId],
            orgPageIds: [orgPageId],
          },
        }),
      );
    },
  );

  it('maps legacy context.elements into shared interactiveElements at the route boundary', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        question: 'How do I save this?',
        context: {
          url: 'https://example.com/deals/123',
          appSignature: 'salesforce:opportunity-detail',
          elements: [
            {
              selector: '#legacy-save',
              label: 'Legacy save',
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
    await response.text();
    expect(buildExtensionCompiledMemoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [{ selector: '#legacy-save', label: 'Legacy save' }],
        pageContext: expect.objectContaining({
          interactiveElements: [
            expect.objectContaining({
              selector: '#legacy-save',
              label: 'Legacy save',
              type: 'unknown',
            }),
          ],
        }),
      }),
    );
  });
});
