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
  requireOrg: jest.MockedFunction<
    () => Promise<{ orgId: string; userId: string; role: string }>
  >;
};

let POST: typeof import('../route').POST;

function buildRequest(body: unknown = {}): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe('POST /api/extension/agent-session', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.TRIBORA_EXTENSION_VOICE_RUNTIME;
    delete process.env.TRIBORA_EXTENSION_ALLOW_CLIENT_VOICE_RUNTIME_OVERRIDE;
    delete process.env.TRIBORA_OPENAI_REALTIME_MODEL;
    delete process.env.TRIBORA_OPENAI_REALTIME_VOICE;
    delete process.env.TRIBORA_OPENAI_REALTIME_REASONING_EFFORT;
    process.env.ELEVENLABS_API_KEY = 'el_server_key';
    process.env.ELEVENLABS_AGENT_ID = 'agent_123';
    process.env.OPENAI_API_KEY = 'openai_server_key';
    global.fetch = jest.fn() as typeof fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    requireOrg.mockResolvedValue({
      orgId: 'org_test',
      userId: 'user_test',
      role: 'admin',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it('defaults to the existing ElevenLabs signed URL payload', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      Response.json({
        signed_url: 'wss://elevenlabs.example/session',
        conversation_id: 'conv_123',
      }),
    );

    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=agent_123',
      {
        method: 'GET',
        headers: { 'xi-api-key': 'el_server_key' },
      },
    );
    await expect(response.json()).resolves.toEqual({
      runtime: 'elevenlabs',
      signedUrl: 'wss://elevenlabs.example/session',
      conversationId: 'conv_123',
    });
  });

  it('mints an OpenAI Realtime 2 client secret when the internal runtime flag is enabled', async () => {
    process.env.TRIBORA_EXTENSION_VOICE_RUNTIME = 'openai-realtime';
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(
      Response.json({
        value: 'rt_client_secret',
        expires_at: 1770000000,
      }),
    );

    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/client_secrets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openai_server_key',
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': expect.any(String),
        }),
      }),
    );

    const requestBody = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(requestBody).toMatchObject({
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2',
        reasoning: { effort: 'low' },
        audio: { output: { voice: 'marin' } },
      },
    });
    expect(requestBody.session.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'answer_with_knowledge' }),
      ]),
    );

    await expect(response.json()).resolves.toEqual({
      runtime: 'openai-realtime',
      clientSecret: 'rt_client_secret',
      model: 'gpt-realtime-2',
      voice: 'marin',
      reasoningEffort: 'low',
      expiresAt: '2026-02-02T02:40:00.000Z',
    });
  });

  it('honors the build-time runtime request in local/dev when client overrides are allowed', async () => {
    process.env.TRIBORA_EXTENSION_ALLOW_CLIENT_VOICE_RUNTIME_OVERRIDE = 'true';
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(Response.json({ value: 'rt_client_secret' }));

    const response = await POST(
      buildRequest({ voiceRuntime: 'openai-realtime' }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/realtime/client_secrets',
      expect.any(Object),
    );
  });

  it('returns unauthorized before creating a provider session', async () => {
    requireOrg.mockRejectedValue(new Error('Unauthorized'));

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
