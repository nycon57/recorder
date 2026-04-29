/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const insert = jest.fn<
  (row: unknown) => Promise<{ error: null | { message: string } }>
>();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) => Response.json(body, init),
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

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({
    from: () => ({
      insert,
    }),
  }),
}));

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('POST /api/extension/debug-events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
  });

  it('redacts debug event payloads before persistence', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        events: [
          {
            sessionId: 'session_1',
            seq: 1,
            eventType: 'tool_call_completed',
            occurredAt: '2026-04-29T12:00:00.000Z',
            urlHost: 'example.com',
            urlPath: '/contact?token=secret#notes',
            app: 'hubspot',
            screen: 'contact-record',
            messageText: 'My email is jane@example.com',
            inputTextPreview: 'api_key=super-secret-token',
            resultText: 'Card 4242 4242 4242 4242',
            pageSummary: 'Call +1 (415) 555-2671',
            selectedEntityTitle: 'Jane jane@example.com',
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const row = insert.mock.calls[0]?.[0] as unknown as {
      payload: Record<string, unknown>;
    };

    expect(row.payload).toMatchObject({
      orgId: 'org_test',
      actorId: 'user_test',
      authMethod: 'session',
      urlHost: 'example.com',
      urlPath: '/contact',
      messageText: 'My email is [REDACTED]',
      inputTextPreview: 'api_key=[REDACTED]',
      resultText: 'Card [REDACTED]',
      pageSummary: 'Call [REDACTED]',
      selectedEntityTitle: 'Jane [REDACTED]',
    });
    expect(JSON.stringify(row.payload)).not.toContain('super-secret-token');
    expect(JSON.stringify(row.payload)).not.toContain('4242');
    expect(JSON.stringify(row.payload)).not.toContain('jane@example.com');
  });
});
