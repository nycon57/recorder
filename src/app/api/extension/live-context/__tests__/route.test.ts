/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { buildKnowledgeResolvedFor, type PageContext } from '@tribora/shared';

const resolveExtensionContextMatches = jest.fn();
const buildLiveContextPack = jest.fn();

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
  createClient: jest.fn(),
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
  });

  it('re-resolves matches when supplied knowledge has no provenance', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
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
      url: context.url,
    });
    expect(buildLiveContextPack).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
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
});
