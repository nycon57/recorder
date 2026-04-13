/**
 * POST /api/extension/agent-session
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Generates a signed URL for starting an ElevenLabs Conversational Agent
 * session. The signed URL allows the Chrome extension's content script to
 * connect directly to ElevenLabs without exposing the API key.
 *
 * Returns: { signedUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOrg, errors } from '@/lib/utils/api';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(_request: NextRequest) {
  try {
    await requireOrg();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Unauthorized') return errors.unauthorized();
    return errors.forbidden();
  }

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

  // Request a signed URL from ElevenLabs
  let elevenLabsResponse: Response;
  try {
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/get_signed_url');
    url.searchParams.set('agent_id', agentId);
    elevenLabsResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });
  } catch (networkErr) {
    console.error('[extension/agent-session] ElevenLabs network error:', networkErr);
    return errors.internalError();
  }

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text().catch(() => '');
    console.error(
      `[extension/agent-session] ElevenLabs returned ${elevenLabsResponse.status}:`,
      errorText,
    );
    return errors.internalError();
  }

  let result: { signed_url?: string; conversation_id?: string };
  try {
    result = await elevenLabsResponse.json();
  } catch {
    console.error('[extension/agent-session] Failed to parse ElevenLabs response');
    return errors.internalError();
  }

  if (!result.signed_url) {
    console.error('[extension/agent-session] No signed_url in response');
    return errors.internalError();
  }

  console.log(`[extension/agent-session] Signed URL generated for agent ${agentId}`);

  return NextResponse.json(
    {
      signedUrl: result.signed_url,
      conversationId: result.conversation_id,
    },
    { headers: CORS_HEADERS },
  );
}
