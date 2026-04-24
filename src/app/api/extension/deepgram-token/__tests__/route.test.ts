/** @jest-environment node */

import type { NextRequest } from 'next/server';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

jest.mock('@/lib/utils/api', () => ({
  requireOrg: jest.fn(),
  errors: {
    unauthorized: () =>
      Response.json(
        { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
    forbidden: () =>
      Response.json(
        {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
        { status: 403 },
      ),
    internalError: () =>
      Response.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'An internal server error occurred',
        },
        { status: 500 },
      ),
  },
}));

const { requireOrg } = jest.requireMock('@/lib/utils/api') as {
  requireOrg: jest.Mock;
};

let POST: typeof import('../route').POST;

describe('POST /api/extension/deepgram-token', () => {
  const originalApiKey = process.env.DEEPGRAM_API_KEY;
  const originalFetch = global.fetch;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T03:00:00.000Z'));

    process.env.DEEPGRAM_API_KEY = 'dg_server_key';
    global.fetch = jest.fn() as typeof fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (requireOrg as jest.Mock).mockResolvedValue({
      orgId: 'org_test',
      userId: 'user_test',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.DEEPGRAM_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it('mints a temporary token instead of returning the raw API key', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'dg_temp_token',
        expires_in: 60,
      }),
    });

    const response = await POST(
      new Request('http://localhost:3000/api/extension/deepgram-token', {
        method: 'POST',
      }) as unknown as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.deepgram.com/v1/auth/grant',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Token dg_server_key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl_seconds: 60 }),
      }),
    );

    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(payload).toEqual({
      token: 'dg_temp_token',
      expiresAt: '2026-04-20T03:01:00.000Z',
    });
    expect(payload.token).not.toBe(process.env.DEEPGRAM_API_KEY);
    expect(serializedPayload).not.toContain('dg_server_key');
  });

  it('returns unauthorized when the caller is not signed in', async () => {
    (requireOrg as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

    const response = await POST(
      new Request('http://localhost:3000/api/extension/deepgram-token', {
        method: 'POST',
      }) as unknown as NextRequest,
    );

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns internal error when Deepgram token minting fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('upstream failure'),
    });

    const response = await POST(
      new Request('http://localhost:3000/api/extension/deepgram-token', {
        method: 'POST',
      }) as unknown as NextRequest,
    );

    expect(response.status).toBe(500);
  });

  it('refuses to serialize the raw account API key if Deepgram echoes it', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'dg_server_key',
        expires_in: 60,
      }),
    });

    const response = await POST(
      new Request('http://localhost:3000/api/extension/deepgram-token', {
        method: 'POST',
      }) as unknown as NextRequest,
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(payload)).not.toContain('dg_server_key');
  });
});
