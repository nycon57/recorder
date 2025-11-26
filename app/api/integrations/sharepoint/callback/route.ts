import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';

/**
 * Verify state parameter matches stored value and contains valid orgId
 * @param state - State from OAuth callback
 * @param storedState - State from secure cookie
 * @param orgId - Current user's organization ID
 * @returns Boolean indicating if state is valid
 */
function verifyState(
  state: string,
  storedState: string,
  orgId: string
): boolean {
  try {
    // States must match exactly
    if (state !== storedState) {
      console.error('[SharePoint Callback] State mismatch');
      return false;
    }

    // Decode and validate state structure
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());

    // Verify orgId matches
    if (decoded.orgId !== orgId) {
      console.error('[SharePoint Callback] OrgId mismatch in state');
      return false;
    }

    // Verify timestamp is recent (within 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (decoded.timestamp < tenMinutesAgo) {
      console.error('[SharePoint Callback] State expired');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SharePoint Callback] Error verifying state:', error);
    return false;
  }
}

/**
 * Handles OAuth callback from Microsoft
 *
 * Flow:
 * 1. Validate state (CSRF protection)
 * 2. Exchange authorization code for access/refresh tokens
 * 3. Fetch user profile from Microsoft Graph
 * 4. Store credentials in connector_configs table
 * 5. Redirect to settings page with success message
 *
 * Required env vars:
 * - MICROSOFT_CLIENT_ID
 * - MICROSOFT_CLIENT_SECRET
 * - NEXT_PUBLIC_APP_URL
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    // Step 1: Authenticate user and get internal org ID
    const { orgId } = await requireOrg();

    // Step 2: Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Microsoft
    if (error) {
      console.error('[SharePoint Callback] OAuth error:', {
        error,
        errorDescription,
      });
      return redirectWithError(
        'sharepoint_auth_denied',
        errorDescription || 'Authorization denied'
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[SharePoint Callback] Missing code or state');
      return redirectWithError('invalid_callback', 'Missing authorization code');
    }

    // Step 3: Retrieve and verify state from cookies (CSRF protection)
    const cookieStore = await cookies();
    const storedState = cookieStore.get('sharepoint_oauth_state')?.value;
    const codeVerifier = cookieStore.get('sharepoint_code_verifier')?.value;

    if (!storedState || !codeVerifier) {
      console.error('[SharePoint Callback] Missing state or verifier cookies');
      return redirectWithError('session_expired', 'OAuth session expired');
    }

    if (!verifyState(state, storedState, orgId)) {
      console.error('[SharePoint Callback] State verification failed');
      return redirectWithError('invalid_state', 'Security validation failed');
    }

    // Step 4: Validate environment variables
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret) {
      console.error('[SharePoint Callback] Missing Microsoft credentials');
      return redirectWithError('server_error', 'Server configuration error');
    }

    if (!appUrl) {
      console.error('[SharePoint Callback] Missing NEXT_PUBLIC_APP_URL');
      return redirectWithError('server_error', 'Server configuration error');
    }

    // Step 5: Exchange authorization code for tokens
    const redirectUri = `${appUrl}/api/integrations/sharepoint/callback`;

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('[SharePoint Callback] Token exchange failed:', errorData);
      return redirectWithError(
        'token_exchange_failed',
        'Failed to obtain access token'
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error('[SharePoint Callback] Missing tokens in response');
      return redirectWithError('incomplete_tokens', 'Incomplete token response');
    }

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Step 6: Fetch user profile from Microsoft Graph API
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error(
        '[SharePoint Callback] Failed to fetch user profile:',
        profileResponse.status
      );
      return redirectWithError('profile_fetch_failed', 'Failed to fetch profile');
    }

    const profile = await profileResponse.json();
    const { id: externalUserId, displayName, userPrincipalName } = profile;

    console.log('[SharePoint Callback] User profile fetched:', {
      externalUserId,
      displayName,
      userPrincipalName,
    });

    // Step 7: Get internal user ID from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !user) {
      console.error('[SharePoint Callback] User not found:', userError);
      return redirectWithError('user_not_found', 'User account not found');
    }

    // Step 8: Store credentials in connector_configs table
    const { error: insertError } = await supabase
      .from('connector_configs')
      .upsert(
        {
          org_id: orgId,
          user_id: user.id,
          type: 'sharepoint', // Can be 'sharepoint' or 'onedrive' based on usage
          credentials: {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: expiresAt.toISOString(),
          },
          status: 'connected',
          external_user_id: externalUserId,
          external_user_name: displayName || userPrincipalName,
          metadata: {
            userPrincipalName,
            connectedAt: new Date().toISOString(),
          },
        },
        {
          onConflict: 'org_id,type',
        }
      );

    if (insertError) {
      console.error(
        '[SharePoint Callback] Failed to store credentials:',
        insertError
      );
      return redirectWithError('storage_failed', 'Failed to save connection');
    }

    console.log('[SharePoint Callback] Successfully connected SharePoint', {
      orgId,
      userId: user.id,
      externalUserId,
    });

    // Step 9: Clear OAuth cookies
    cookieStore.delete('sharepoint_oauth_state');
    cookieStore.delete('sharepoint_code_verifier');

    // Step 10: Redirect to settings with success message
    const successUrl = new URL(
      '/settings/organization/integrations',
      appUrl
    );
    successUrl.searchParams.set('success', 'sharepoint_connected');

    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error('[SharePoint Callback] Unexpected error:', error);
    return redirectWithError(
      'unexpected_error',
      'An unexpected error occurred'
    );
  }
}

/**
 * Helper function to redirect to settings page with error message
 */
function redirectWithError(
  errorCode: string,
  errorMessage: string
): NextResponse {
  const errorUrl = new URL(
    '/settings/organization/integrations',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  );
  errorUrl.searchParams.set('error', errorCode);
  errorUrl.searchParams.set('message', errorMessage);

  return NextResponse.redirect(errorUrl.toString());
}
