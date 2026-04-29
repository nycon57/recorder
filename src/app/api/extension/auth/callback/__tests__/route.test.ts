/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const getSession = jest.fn();
const select = jest.fn();
const eq = jest.fn();
const single = jest.fn();

jest.mock('@/lib/auth/auth', () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({ select })),
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

describe('POST /api/extension/auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ single });
    getSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        image: null,
      },
      session: {
        token: 'validated-token',
        expiresAt: '2026-04-29T05:00:00.000Z',
      },
      activeOrganization: {
        id: 'org-1',
        name: 'Org One',
        slug: 'org-one',
      },
    });
    single.mockResolvedValue({
      data: {
        id: 'user-1',
        org_id: 'org-1',
        email: 'user@example.com',
        name: 'User One',
        avatar_url: null,
      },
      error: null,
    });
  });

  it('validates the bearer token and returns only sanitized session state', async () => {
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: 'callback-token' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    const headers = getSession.mock.calls[0][0].headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer callback-token');
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
      expiresAt: new Date('2026-04-29T05:00:00.000Z').getTime(),
    });
  });

  it('rejects missing tokens before session lookup', async () => {
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: '' }));

    expect(response.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects invalid backend sessions before persistence can occur', async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import('../route');

    const response = await POST(buildRequest({ token: 'bad-token' }));

    expect(response.status).toBe(401);
    expect(single).not.toHaveBeenCalled();
  });
});
