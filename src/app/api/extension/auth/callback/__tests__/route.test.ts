/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type QueryResult = { data: unknown; error: unknown };
type SingleFn = () => Promise<QueryResult>;
type EqResult = { single: jest.Mock<SingleFn> };
type EqFn = (column: string, value: unknown) => EqResult;
type SelectResult = { eq: jest.Mock<EqFn> };
type SelectFn = (columns: string) => SelectResult;
type MockTableResult = {
  select: jest.Mock<SelectFn>;
  eq: jest.Mock<EqFn>;
  single: jest.Mock<SingleFn>;
};

const from = jest.fn<(table: string) => MockTableResult>();
const ONE_HOUR_MS = 60 * 60 * 1000;
let validSessionExpiresAt: string;

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from,
  },
}));

jest.mock('@/lib/utils/cors', () => ({
  CORS_HEADERS: {},
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));

function buildRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function mockTableResult(data: unknown, error: unknown = null): MockTableResult {
  const single = jest.fn<SingleFn>().mockResolvedValue({ data, error });
  const eq = jest.fn<EqFn>(() => ({ single }));
  const select = jest.fn<SelectFn>(() => ({ eq }));
  return { select, eq, single };
}

describe('POST /api/extension/auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validSessionExpiresAt = new Date(Date.now() + ONE_HOUR_MS).toISOString();
    from.mockImplementation((table: string) => {
      if (table === 'session') {
        return mockTableResult({
          userId: 'user-1',
          token: 'validated-token',
          expiresAt: validSessionExpiresAt,
          activeOrganizationId: 'org-1',
        });
      }
      if (table === 'users') {
        return mockTableResult({
          id: 'user-1',
          org_id: 'org-1',
          email: 'user@example.com',
          name: 'User One',
          avatar_url: null,
        });
      }
      if (table === 'organizations') {
        return mockTableResult({
          id: 'org-1',
          name: 'Org One',
          slug: 'org-one',
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('validates the callback token against the Better Auth session table', async () => {
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: 'callback-token' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith('session');
    const sessionQuery = from.mock.results[0].value as MockTableResult;
    expect(sessionQuery.select).toHaveBeenCalledWith(
      'userId, token, expiresAt, activeOrganizationId',
    );
    expect(sessionQuery.eq).toHaveBeenCalledWith('token', 'callback-token');
    expect(payload.session).toEqual({
      status: 'authenticated',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        image: null,
      },
      activeOrg: {
        id: 'org-1',
        name: 'Org One',
        slug: 'org-one',
      },
      token: 'validated-token',
      expiresAt: new Date(validSessionExpiresAt).getTime(),
    });
  });

  it('rejects missing tokens before session lookup', async () => {
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: '' }));

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects invalid backend sessions before persistence can occur', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'session') {
        return mockTableResult(null, { code: 'PGRST116' });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: 'bad-token' }));

    expect(response.status).toBe(401);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('rejects expired callback sessions', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'session') {
        return mockTableResult({
          userId: 'user-1',
          token: 'expired-token',
          expiresAt: '2020-01-01T00:00:00.000Z',
          activeOrganizationId: 'org-1',
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: 'expired-token' }));

    expect(response.status).toBe(401);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
