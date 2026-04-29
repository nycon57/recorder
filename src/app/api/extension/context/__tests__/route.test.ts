/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PageContext } from '@tribora/shared';

const resolveExtensionContextMatches = jest.fn<() => Promise<unknown>>();
const buildExtensionContextTelemetry = jest.fn<() => unknown>();
const recordKnowledgeTelemetryEvent = jest.fn<() => Promise<void>>();

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) => Response.json(body, init),
  },
  after: (callback: () => void | Promise<void>) => {
    void callback();
  },
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

jest.mock('@/lib/services/extension-context', () => ({
  resolveExtensionContextMatches,
}));

jest.mock('@/lib/services/extension-context-telemetry', () => ({
  buildExtensionContextTelemetry,
}));

jest.mock('@/lib/services/knowledge-telemetry', () => ({
  recordKnowledgeTelemetryEvent,
}));

jest.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
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
    url: 'https://user:pass@app.hubspot.com/contacts/123?token=secret#notes',
    title: 'Contact record',
    interactiveElements: [],
    ...overrides,
  };
}

describe('POST /api/extension/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    buildExtensionContextTelemetry.mockReturnValue({
      orgId: 'org_test',
      authMethod: 'session',
      app: 'hubspot',
      screen: 'contact-record',
      pageType: 'contact-record',
      knowledgeMode: 'dom_only',
      vendorMatchBasis: 'unknown',
      orgMatchBasis: 'unknown',
      latencyMs: 1,
      fingerprint: 'fingerprint',
    });
  });

  it('sanitizes incoming context before matching and telemetry', async () => {
    const { POST } = await import('../route');
    const context = baseContext({
      pageSummary:
        'Contact jane@example.com token api_key=super-secret-token visible in page',
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
    expect(resolveExtensionContextMatches).toHaveBeenCalledWith({
      orgId: 'org_test',
      app: 'hubspot',
      screen: 'contact-record',
      url: 'https://app.hubspot.com/contacts/123',
    });
    expect(buildExtensionContextTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          url: 'https://app.hubspot.com/contacts/123',
          pageSummary:
            'Contact [REDACTED] token api_key=[REDACTED] visible in page',
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
        }),
      }),
    );
    const telemetryInput = buildExtensionContextTelemetry.mock.calls[0]?.[0] as {
      context: PageContext;
    };
    expect(telemetryInput.context).not.toHaveProperty('visibleText');
    expect(
      JSON.stringify(telemetryInput),
    ).not.toContain('super-secret-token');
    expect(JSON.stringify(telemetryInput)).not.toContain('4242');
    expect(recordKnowledgeTelemetryEvent).toHaveBeenCalled();
  });
});
