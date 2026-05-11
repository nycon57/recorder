/**
 * POST /api/extension/deepgram-token
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Returns a short-lived Deepgram token for the Chrome extension's real-time
 * STT flow (TRIB-25) by minting a temporary JWT via Deepgram's
 * /v1/auth/grant endpoint. Only the temporary token is ever returned to the
 * browser; the long-lived API key remains server-side.
 */

import { NextResponse } from 'next/server';

import { requireOrg, errors } from '@/lib/utils/api';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS preflight handler
export function OPTIONS() {
  return corsPreflightResponse();
}

/**
 * The token only needs to survive the initial websocket handshake, so keep it
 * short while leaving a little room for slower client startup.
 */
const TOKEN_TTL_SECONDS = 60;

interface DeepgramGrantResponse {
  access_token?: string;
  expires_in?: number | null;
}

export async function POST() {
  try {
    await requireOrg();

    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      console.error('[extension/deepgram-token] DEEPGRAM_API_KEY is not set');
      return errors.internalError();
    }

    let deepgramResponse: Response;
    try {
      deepgramResponse = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
        cache: 'no-store',
      });
    } catch (networkError) {
      console.error('[extension/deepgram-token] Network error:', networkError);
      return errors.internalError();
    }

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text().catch(() => '');
      console.error(
        `[extension/deepgram-token] Deepgram ${deepgramResponse.status}:`,
        errorText,
      );
      return errors.internalError();
    }

    let grant: DeepgramGrantResponse;
    try {
      grant = (await deepgramResponse.json()) as DeepgramGrantResponse;
    } catch {
      console.error('[extension/deepgram-token] Failed to parse Deepgram response');
      return errors.internalError();
    }

    if (!grant.access_token) {
      console.error('[extension/deepgram-token] Missing access_token in response');
      return errors.internalError();
    }

    if (grant.access_token === apiKey) {
      console.error('[extension/deepgram-token] Refusing to return account API key');
      return errors.internalError();
    }

    const expiresIn =
      typeof grant.expires_in === 'number' && grant.expires_in > 0
        ? grant.expires_in
        : TOKEN_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return NextResponse.json(
      {
        token: grant.access_token,
        expiresAt,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: unknown) {
    console.error('[extension/deepgram-token] error:', error);

    const message = error instanceof Error ? error.message : '';

    if (message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (
      message === 'Organization context required' ||
      message === 'User organization not found' ||
      message.includes('not found in database')
    ) {
      return errors.forbidden();
    }

    return errors.internalError();
  }
}
