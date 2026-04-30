/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { buildKnowledgeResolvedFor, type PageContext } from '@tribora/shared';

const resolveExtensionContextMatches = jest.fn<() => Promise<unknown>>();
const buildLiveContextPack =
  jest.fn<
    (input: { context: PageContext; [key: string]: unknown }) => unknown
  >();
const mockCreateAdminClient = jest.fn();
const mockRequireApiKeyOrSession =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const resolveCustomerOrgForVendor =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@/lib/utils/api-key-auth', () => ({
  requireApiKeyOrSession: (...args: unknown[]) =>
    mockRequireApiKeyOrSession(...args),
}));

jest.mock('@/lib/services/vendor-customers', () => ({
  resolveCustomerOrgForVendor: (...args: unknown[]) =>
    resolveCustomerOrgForVendor(...args),
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
    internalError: () =>
      Response.json(
        { code: 'INTERNAL_ERROR', message: 'Internal error' },
        { status: 500 },
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

jest.mock('@/lib/supabase/admin', () => ({
  createClient: mockCreateAdminClient,
}));

jest.mock('@/lib/services/extension-context', () => ({
  resolveExtensionContextMatches,
}));

jest.mock('@/lib/services/extension-live-context', () => ({
  buildLiveContextPack,
}));

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function baseContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    app: 'hubspot',
    screen: 'contact-record',
    appSignature: 'hubspot:contact-record',
    url: 'https://app.hubspot.com/contacts/123?token=secret#notes',
    title: 'Contact record',
    interactiveElements: [],
    ...overrides,
  };
}

function getFirstPackContext(): PageContext {
  expect(buildLiveContextPack).toHaveBeenCalledTimes(1);
  const firstArg = buildLiveContextPack.mock.calls[0]?.[0];
  expect(firstArg).toBeDefined();
  return (firstArg as { context: PageContext }).context;
}

function createSupabaseMock(args: {
  vendorRows?: Array<{
    id: string;
    screen: string;
    content: string;
    vendor_source_id?: string | null;
  }>;
  orgRows?: Array<{ id: string; topic: string; content: string }>;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'vendor_wiki_pages') {
        const query = {
          select: jest.fn(() => query),
          in: jest.fn(() => query),
          is: jest.fn(async () => ({
            data: args.vendorRows ?? [],
            error: null,
          })),
        };
        return {
          ...query,
        };
      }

      if (table === 'vendor_doc_sources') {
        const query = {
          select: jest.fn(() => query),
          in: jest.fn(async () => ({
            data: [],
            error: null,
          })),
        };
        return query;
      }

      if (table === 'org_wiki_pages') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                in: jest.fn(async () => ({
                  data: args.orgRows ?? [],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('POST /api/extension/live-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveExtensionContextMatches.mockResolvedValue({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: [],
      },
      orgKnowledgeMatch: null,
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: false,
        mode: 'vendor_backed',
        message: 'Vendor docs are available.',
      },
      relevantWikiPages: [],
    });
    buildLiveContextPack.mockReturnValue({
      hash: 'pack-hash',
      text: 'Live context',
      knowledgeMode: 'vendor_backed',
      sources: [],
    });
    mockCreateAdminClient.mockReturnValue(
      createSupabaseMock({
        vendorRows: [],
        orgRows: [],
      }),
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

  it('re-resolves matches when supplied knowledge has no provenance', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      visibleText: 'Customer email jane@example.com',
      pageSummary:
        'Contact jane@example.com has phone +1 (415) 555-2671 on file.',
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'old-screen',
        pageIds: ['stale-vendor-page'],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: false,
        mode: 'vendor_backed',
        message: 'Stale vendor docs are available.',
      },
    });

    const response = await POST(buildRequest({ context }));

    expect(response.status).toBe(200);
    expect(resolveExtensionContextMatches).toHaveBeenCalledWith({
      orgId: 'org_test',
      app: 'hubspot',
      screen: 'contact-record',
      url: 'https://app.hubspot.com/contacts/123',
    });
    expect(buildLiveContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          url: 'https://app.hubspot.com/contacts/123',
          pageSummary: 'Contact [REDACTED] has phone [REDACTED] on file.',
          vendorKnowledgeMatch: expect.objectContaining({
            screen: 'contact-record',
            pageIds: [],
          }),
          knowledgeResolvedFor: {
            app: 'hubspot',
            screen: 'contact-record',
            appSignature: 'hubspot:contact-record',
            host: 'app.hubspot.com',
            path: '/contacts/123',
          },
        }),
      }),
    );
    expect(getFirstPackContext()).not.toHaveProperty('visibleText');
  });

  it('accepts supplied matches when provenance matches the current context', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: [],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: false,
        mode: 'vendor_backed',
        message: 'Vendor docs are available.',
      },
    });
    context.knowledgeResolvedFor = buildKnowledgeResolvedFor(context);

    const response = await POST(buildRequest({ context }));

    expect(response.status).toBe(200);
    expect(resolveExtensionContextMatches).not.toHaveBeenCalled();
    expect(buildLiveContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          vendorKnowledgeMatch: context.vendorKnowledgeMatch,
          knowledgeAvailability: context.knowledgeAvailability,
          knowledgeResolvedFor: context.knowledgeResolvedFor,
        }),
      }),
    );
  });

  it('uses the URL screen fallback when sanitized screen is unknown', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      screen: undefined,
      appSignature: undefined,
      url: 'https://app.hubspot.com/settings/users?token=secret',
    });

    const response = await POST(buildRequest({ context }));

    expect(response.status).toBe(200);
    expect(resolveExtensionContextMatches).toHaveBeenCalledWith({
      orgId: 'org_test',
      app: 'hubspot',
      screen: 'users',
      url: 'https://app.hubspot.com/settings/users',
    });
    expect(getFirstPackContext()).toMatchObject({
      screen: 'users',
      appSignature: 'hubspot:users',
    });
  });

  it('sanitizes posted context before building the live model pack', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      pageSummary:
        'Contact jane@example.com token api_key=super-secret-token visible in page',
      selectedEntity: {
        title: 'Jane jane@example.com',
      },
      visibleText: 'Raw body text with card 4242 4242 4242 4242',
      forms: [
        {
          label: 'Login',
          fields: [
            {
              label: 'Email jane@example.com',
              selector: '#email',
              type: 'email',
              required: true,
              valuePresent: true,
              placeholder: 'jane@example.com',
            },
          ],
        },
      ],
    });

    const response = await POST(buildRequest({ context }));

    expect(response.status).toBe(200);
    const packContext = getFirstPackContext();
    expect(packContext).toMatchObject({
      url: 'https://app.hubspot.com/contacts/123',
      pageSummary:
        'Contact [REDACTED] token api_key=[REDACTED] visible in page',
      selectedEntity: {
        title: 'Jane [REDACTED]',
      },
      forms: [
        {
          label: 'Login',
          selector: undefined,
          fields: [
            {
              label: 'Email [REDACTED]',
              selector: '#email',
              type: 'email',
              required: true,
            },
          ],
        },
      ],
    });
    expect(packContext).not.toHaveProperty('visibleText');
    expect(JSON.stringify(packContext)).not.toContain('super-secret-token');
    expect(JSON.stringify(packContext)).not.toContain('4242');
  });

  it('preserves ranked page-id order when loading live context source pages', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'app_only',
        confidence: 0.58,
        app: 'hubspot',
        screen: null,
        pageIds: ['vendor-billing', 'vendor-generic'],
      },
      orgKnowledgeMatch: {
        matched: true,
        basis: 'app_only',
        confidence: 0.63,
        app: 'hubspot',
        screen: null,
        pageIds: ['org-billing', 'org-generic'],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: true,
        mode: 'org_backed',
        message: 'Guidance is available.',
      },
    });
    context.knowledgeResolvedFor = buildKnowledgeResolvedFor(context);
    mockCreateAdminClient.mockReturnValue(
      createSupabaseMock({
        vendorRows: [
          {
            id: 'vendor-generic',
            screen: 'Overview',
            content: 'Generic vendor content',
          },
          {
            id: 'vendor-billing',
            screen: 'Billing settings',
            content: 'Billing vendor content',
          },
        ],
        orgRows: [
          {
            id: 'org-generic',
            topic: 'Overview',
            content: 'Generic org content',
          },
          {
            id: 'org-billing',
            topic: 'Billing settings',
            content: 'Billing org content',
          },
        ],
      }),
    );

    const response = await POST(buildRequest({ context }));

    expect(response.status).toBe(200);
    const firstArg = buildLiveContextPack.mock.calls[0]?.[0] as unknown as {
      orgPages: Array<{ id: string; kind: string }>;
      vendorPages: Array<{ id: string; kind: string }>;
    };
    expect(firstArg.orgPages.map((page) => page.id)).toEqual([
      'org-billing',
      'org-generic',
    ]);
    expect(firstArg.vendorPages.map((page) => page.id)).toEqual([
      'vendor-billing',
      'vendor-generic',
    ]);
    expect(firstArg.orgPages.map((page) => page.kind)).toEqual(['org', 'org']);
    expect(firstArg.vendorPages.map((page) => page.kind)).toEqual([
      'vendor_generic',
      'vendor_generic',
    ]);
  });

  it('uses verified customer org scope for API-key live context', async () => {
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
        customerOrgId: 'customer_org',
        context: baseContext(),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveCustomerOrgForVendor).toHaveBeenCalledWith(
      'vendor_org',
      'customer_org',
    );
    expect(resolveExtensionContextMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'customer_org',
      }),
    );
  });

  it('rejects API-key live context without a customer org target', async () => {
    mockRequireApiKeyOrSession.mockResolvedValueOnce({
      orgId: 'vendor_org',
      authMethod: 'api_key',
      keyId: 'key_1',
      configId: 'config_1',
      scopes: ['query'],
    });
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ context: baseContext() }));

    expect(response.status).toBe(400);
    expect(resolveCustomerOrgForVendor).not.toHaveBeenCalled();
    expect(resolveExtensionContextMatches).not.toHaveBeenCalled();
  });
});
