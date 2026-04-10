/**
 * POST /api/extension/deepgram-token
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Returns a short-lived Deepgram token for the Chrome extension's
 * real-time STT (TRIB-25).
 *
 * The Deepgram SDK v5 does not expose a grantToken / temporary credential
 * API (the Auth module only provides HeaderAuthProvider helpers). Until
 * Deepgram adds a token issuance endpoint to the SDK, we return the
 * server-side API key directly with a 15-minute logical expiry and a
 * _warning field so callers know this is not a scoped credential.
 *
 * SECURITY NOTE: This endpoint is auth-gated so only authenticated
 * extension users can retrieve the key. Rotate DEEPGRAM_API_KEY
 * server-side if it is ever compromised.
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireOrg, errors } from '@/lib/utils/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** TTL in seconds for the logical expiry timestamp (15 minutes). */
const TOKEN_TTL_SECONDS = 15 * 60;

export async function POST(_request: NextRequest) {
  try {
    await requireOrg();

    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      console.error('[extension/deepgram-token] DEEPGRAM_API_KEY is not set');
      return errors.internalError();
    }

    const expiresAt = new Date(
      Date.now() + TOKEN_TTL_SECONDS * 1000
    ).toISOString();

    return NextResponse.json({
      token: apiKey,
      expiresAt,
      _warning:
        'This is a server-side API key, not a scoped short-lived token. ' +
        'The Deepgram SDK v5 does not yet expose a token-grant API. ' +
        'Upgrade to scoped credentials when the SDK adds support.',
    });
  } catch (error: any) {
    console.error('[extension/deepgram-token] error:', error);

    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (
      error.message === 'Organization context required' ||
      error.message === 'User organization not found' ||
      error.message?.includes('not found in database')
    ) {
      return errors.forbidden();
    }

    return errors.internalError();
  }
}
