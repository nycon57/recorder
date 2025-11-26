/**
 * Google Drive OAuth Auth Route
 *
 * Initiates OAuth flow with Google for Drive access.
 * Supports both read-only and full (read+write) scopes for publishing.
 *
 * Query params:
 * - publish=true: Request write permissions for publishing
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { requireOrg } from '@/lib/utils/api';
import { GoogleDriveConnector } from '@/lib/connectors/google-drive';

/**
 * Generate secure state parameter for CSRF protection
 */
function generateState(orgId: string, requestPublish: boolean): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const stateData = JSON.stringify({
    random: randomBytes,
    orgId,
    requestPublish,
    timestamp: Date.now(),
  });
  return Buffer.from(stateData).toString('base64url');
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user and get internal org ID
    const { orgId } = await requireOrg();

    // Check if publish permissions requested
    const searchParams = req.nextUrl.searchParams;
    const requestPublish = searchParams.get('publish') === 'true';

    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      console.error('[Google Drive Auth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return new NextResponse('Server configuration error', { status: 500 });
    }

    if (!redirectUri) {
      console.error('[Google Drive Auth] Missing GOOGLE_REDIRECT_URI');
      return new NextResponse('Server configuration error', { status: 500 });
    }

    // Generate state for CSRF protection
    const state = generateState(orgId, requestPublish);

    // Store state in secure HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Create connector instance to generate auth URL
    const connector = new GoogleDriveConnector({});

    // Generate OAuth URL with appropriate scopes
    const authUrl = requestPublish
      ? connector.generatePublishAuthUrl()
      : connector.generateAuthUrl();

    // Add state to the auth URL
    const urlWithState = new URL(authUrl);
    urlWithState.searchParams.set('state', state);

    console.log('[Google Drive Auth] Redirecting to Google OAuth', {
      requestPublish,
      hasState: !!state,
    });

    return NextResponse.redirect(urlWithState.toString());
  } catch (error) {
    console.error('[Google Drive Auth] Error:', error);
    return new NextResponse(
      error instanceof Error ? error.message : 'Authentication failed',
      { status: 500 }
    );
  }
}
