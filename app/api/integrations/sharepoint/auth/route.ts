import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { requireOrg } from '@/lib/utils/api';

/**
 * Generate PKCE code verifier and challenge
 * @returns Object containing verifier and challenge strings
 */
function generatePKCE(): { verifier: string; challenge: string } {
  // Generate random 128-character verifier
  const verifier = crypto.randomBytes(96).toString('base64url');

  // Generate SHA256 challenge from verifier
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * Generate secure state parameter for CSRF protection
 * @param orgId - Organization ID to embed in state
 * @returns Base64-encoded state string
 */
function generateState(orgId: string): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const stateData = JSON.stringify({
    random: randomBytes,
    orgId,
    timestamp: Date.now(),
  });
  return Buffer.from(stateData).toString('base64url');
}

/**
 * Initiates OAuth flow with Microsoft for SharePoint/OneDrive access
 *
 * Flow:
 * 1. Authenticate user via Clerk
 * 2. Generate PKCE challenge and state for security
 * 3. Store secrets in HTTP-only cookies
 * 4. Redirect to Microsoft OAuth consent page
 *
 * Required env vars:
 * - MICROSOFT_CLIENT_ID
 * - NEXT_PUBLIC_APP_URL
 */
export async function GET(req: NextRequest) {
  try {
    // Step 1: Authenticate user and get internal org ID
    const { orgId } = await requireOrg();

    // Step 2: Validate environment variables
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId) {
      console.error('[SharePoint Auth] Missing MICROSOFT_CLIENT_ID');
      return new NextResponse('Server configuration error', { status: 500 });
    }

    if (!appUrl) {
      console.error('[SharePoint Auth] Missing NEXT_PUBLIC_APP_URL');
      return new NextResponse('Server configuration error', { status: 500 });
    }

    // Step 3: Generate PKCE parameters for enhanced security
    const { verifier, challenge } = generatePKCE();

    // Step 4: Generate state for CSRF protection
    const state = generateState(orgId);

    // Step 5: Store secrets in secure HTTP-only cookies (7 days expiry)
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/api/integrations/sharepoint',
    };

    cookieStore.set('sharepoint_oauth_state', state, cookieOptions);
    cookieStore.set('sharepoint_code_verifier', verifier, cookieOptions);

    // Step 6: Build Microsoft OAuth authorization URL
    const redirectUri = `${appUrl}/api/integrations/sharepoint/callback`;

    const authUrl = new URL(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    );

    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Request comprehensive permissions for SharePoint and OneDrive
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access', // Refresh token
      'https://graph.microsoft.com/Files.ReadWrite.All', // OneDrive/SharePoint files
      'https://graph.microsoft.com/Sites.ReadWrite.All', // SharePoint sites
    ].join(' ');

    authUrl.searchParams.set('scope', scopes);

    // Optional: Prompt for consent every time (useful for debugging)
    // authUrl.searchParams.set('prompt', 'consent');

    console.log('[SharePoint Auth] Redirecting to Microsoft OAuth', {
      userId,
      orgId,
      redirectUri,
    });

    // Step 7: Redirect user to Microsoft login
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[SharePoint Auth] Error initiating OAuth flow:', error);

    // Redirect to settings with error message
    const errorUrl = new URL(
      '/settings/organization/integrations',
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    );
    errorUrl.searchParams.set('error', 'sharepoint_auth_failed');

    return NextResponse.redirect(errorUrl.toString());
  }
}
