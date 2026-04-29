/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const upsert = jest.fn<
  (
    rows: unknown,
    options: unknown,
  ) => Promise<{ error: null | { message: string } }>
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
    from: (table: string) => {
      expect(table).toBe('extension_product_events');
      return { upsert };
    },
  }),
}));

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function buildInvalidJsonRequest(): NextRequest {
  return {
    json: async () => {
      throw new Error('invalid json');
    },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('POST /api/extension/telemetry/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsert.mockResolvedValue({ error: null });
  });

  it('writes safe telemetry with server-derived actor fields and idempotency', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        events: [
          {
            eventId: 'evt_1',
            eventType: 'context_lookup',
            occurredAt: '2026-04-29T12:00:00.000Z',
            sessionId: 'session_1',
            seq: 1,
            urlHost: 'app.example.com',
            urlPath: '/accounts/123?token=secret',
            app: 'salesforce',
            screen: 'account',
            latencyMs: 123,
            metadata: { sourceCount: 2 },
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          org_id: 'org_test',
          actor_id: 'user_test',
          auth_method: 'session',
          event_id: 'evt_1',
          event_type: 'context_lookup',
          url_path: '/accounts/123',
          latency_ms: 123,
          metadata: { sourceCount: 2 },
        }),
      ],
      { onConflict: 'event_id', ignoreDuplicates: true },
    );
  });

  it('rejects unsafe raw text payloads', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        events: [
          {
            eventId: 'evt_unsafe',
            eventType: 'query',
            occurredAt: '2026-04-29T12:00:00.000Z',
            question: 'raw user question',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and non-object bodies as validation errors', async () => {
    const { POST } = await import('../route');

    const malformedResponse = await POST(buildInvalidJsonRequest());
    expect(malformedResponse.status).toBe(400);

    const nullResponse = await POST(buildRequest(null));
    expect(nullResponse.status).toBe(400);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects oversized batches', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest({
        events: Array.from({ length: 101 }, (_, index) => ({
          eventId: `evt_${index}`,
          eventType: 'sdk_init',
          occurredAt: '2026-04-29T12:00:00.000Z',
        })),
      }),
    );

    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
