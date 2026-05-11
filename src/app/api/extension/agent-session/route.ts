/**
 * POST /api/extension/agent-session
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Generates a runtime-specific voice session payload. ElevenLabs remains the
 * default production runtime; OpenAI Realtime can be enabled for the internal
 * pilot without exposing provider API keys to the extension.
 */

import { createHash } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import {
  DEFAULT_EXTENSION_VOICE_RUNTIME,
  DEFAULT_OPENAI_REALTIME_MODEL,
  DEFAULT_OPENAI_REALTIME_REASONING_EFFORT,
  DEFAULT_OPENAI_REALTIME_VOICE,
  buildOpenAIRealtimeSessionConfig,
  normalizeOpenAIRealtimeReasoningEffort,
  parseExtensionVoiceRuntime,
  type ExtensionVoiceRuntime,
} from '@tribora/shared';
import { requireOrg, errors } from '@/lib/utils/api';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

function shouldAllowClientRuntimeOverride(): boolean {
  if (process.env.TRIBORA_EXTENSION_ALLOW_CLIENT_VOICE_RUNTIME_OVERRIDE) {
    return (
      process.env.TRIBORA_EXTENSION_ALLOW_CLIENT_VOICE_RUNTIME_OVERRIDE ===
      'true'
    );
  }

  return process.env.NODE_ENV !== 'production';
}

async function readRequestedRuntime(
  request: NextRequest,
): Promise<ExtensionVoiceRuntime | null> {
  if (!shouldAllowClientRuntimeOverride()) return null;

  try {
    const body = (await request.json()) as { voiceRuntime?: unknown };
    return parseExtensionVoiceRuntime(body.voiceRuntime);
  } catch {
    return null;
  }
}

async function resolveVoiceRuntime(
  request: NextRequest,
): Promise<ExtensionVoiceRuntime> {
  return (
    parseExtensionVoiceRuntime(process.env.TRIBORA_EXTENSION_VOICE_RUNTIME) ??
    (await readRequestedRuntime(request)) ??
    DEFAULT_EXTENSION_VOICE_RUNTIME
  );
}

function buildSafetyIdentifier(args: { orgId: string; userId: string }): string {
  return createHash('sha256')
    .update(`${args.orgId}:${args.userId}`)
    .digest('hex');
}

async function createElevenLabsSession() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    console.error('[extension/agent-session] ELEVENLABS_API_KEY is not set');
    return errors.internalError();
  }
  if (!agentId) {
    console.error('[extension/agent-session] ELEVENLABS_AGENT_ID is not set');
    return errors.internalError();
  }

  let elevenLabsResponse: Response;
  try {
    const url = new URL(
      'https://api.elevenlabs.io/v1/convai/conversation/get_signed_url',
    );
    url.searchParams.set('agent_id', agentId);
    elevenLabsResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });
  } catch (networkErr) {
    console.error('[extension/agent-session] Network error:', networkErr);
    return errors.internalError();
  }

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text().catch(() => '');
    console.error(
      `[extension/agent-session] ElevenLabs ${elevenLabsResponse.status}:`,
      errorText,
    );
    return errors.internalError();
  }

  let result: { signed_url?: string; conversation_id?: string };
  try {
    result = await elevenLabsResponse.json();
  } catch {
    console.error('[extension/agent-session] Failed to parse response');
    return errors.internalError();
  }

  if (!result.signed_url) {
    console.error('[extension/agent-session] No signed_url in response');
    return errors.internalError();
  }

  return NextResponse.json(
    {
      runtime: 'elevenlabs',
      signedUrl: result.signed_url,
      conversationId: result.conversation_id,
    },
    { headers: CORS_HEADERS },
  );
}

async function createOpenAIRealtimeSession(args: {
  orgId: string;
  userId: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[extension/agent-session] OPENAI_API_KEY is not set');
    return errors.internalError();
  }

  const model =
    process.env.TRIBORA_OPENAI_REALTIME_MODEL?.trim() ||
    DEFAULT_OPENAI_REALTIME_MODEL;
  const voice =
    process.env.TRIBORA_OPENAI_REALTIME_VOICE?.trim() ||
    DEFAULT_OPENAI_REALTIME_VOICE;
  const reasoningEffort = normalizeOpenAIRealtimeReasoningEffort(
    process.env.TRIBORA_OPENAI_REALTIME_REASONING_EFFORT ||
      DEFAULT_OPENAI_REALTIME_REASONING_EFFORT,
  );
  const sessionConfig = buildOpenAIRealtimeSessionConfig({
    model,
    voice,
    reasoningEffort,
  });
  const clientSecretRequestBody = { session: sessionConfig };

  let openAIResponse: Response;
  try {
    openAIResponse = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': buildSafetyIdentifier(args),
        },
        body: JSON.stringify(clientSecretRequestBody),
      },
    );
  } catch (networkErr) {
    console.error('[extension/agent-session] OpenAI network error:', networkErr);
    return errors.internalError();
  }

  if (!openAIResponse.ok) {
    const errorText = await openAIResponse.text().catch(() => '');
    console.error(
      `[extension/agent-session] OpenAI ${openAIResponse.status}:`,
      errorText,
    );
    return errors.internalError();
  }

  let result: {
    value?: string;
    expires_at?: number;
    client_secret?: { value?: string; expires_at?: number };
  };
  try {
    result = await openAIResponse.json();
  } catch {
    console.error('[extension/agent-session] Failed to parse OpenAI response');
    return errors.internalError();
  }

  const clientSecret = result.value ?? result.client_secret?.value;
  const expiresAtSeconds = result.expires_at ?? result.client_secret?.expires_at;
  if (!clientSecret) {
    console.error('[extension/agent-session] No OpenAI client secret in response');
    return errors.internalError();
  }

  return NextResponse.json(
    {
      runtime: 'openai-realtime',
      clientSecret,
      model,
      voice,
      reasoningEffort,
      expiresAt:
        typeof expiresAtSeconds === 'number'
          ? new Date(expiresAtSeconds * 1000).toISOString()
          : null,
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  let orgContext: { orgId: string; userId: string };
  try {
    orgContext = await requireOrg();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Unauthorized') return errors.unauthorized();
    return errors.forbidden();
  }

  const voiceRuntime = await resolveVoiceRuntime(request);
  return voiceRuntime === 'openai-realtime'
    ? createOpenAIRealtimeSession(orgContext)
    : createElevenLabsSession();
}
