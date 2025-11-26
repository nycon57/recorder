/**
 * Google Drive OAuth Callback Route
 *
 * Handles OAuth callback from Google:
 * 1. Validates state (CSRF protection)
 * 2. Exchanges authorization code for tokens
 * 3. Fetches user info from Google
 * 4. Stores credentials in connector_configs table
 * 5. Redirects to settings page with success/error message
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';
import { ConnectorType } from '@/lib/connectors/base';

const SETTINGS_URL = '/settings/organization/integrations';

/** OAuth scope for write operations (publishing) */
const WRITE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Redirect to settings page with error
 */
function redirectWithError(code: string, message: string): NextResponse {
  const url = new URL(SETTINGS_URL, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  url.searchParams.set('error', code);
  url.searchParams.set('error_description', message);
  return NextResponse.redirect(url.toString());
}

/**
 * Redirect to settings page with success
 */
function redirectWithSuccess(): NextResponse {
  const url = new URL(SETTINGS_URL, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  url.searchParams.set('success', 'google_drive_connected');
  return NextResponse.redirect(url.toString());
}

/**
 * Verify state parameter matches stored value and contains valid orgId
 */
function verifyState(
  state: string,
  storedState: string,
  orgId: string
): { valid: boolean; requestPublish: boolean } {
  try {
    if (state !== storedState) {
      console.error('[Google Drive Callback] State mismatch');
      return { valid: false, requestPublish: false };
    }

    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());

    if (decoded.orgId !== orgId) {
      console.error('[Google Drive Callback] OrgId mismatch in state');
      return { valid: false, requestPublish: false };
    }

    // Verify timestamp is recent (within 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (decoded.timestamp < tenMinutesAgo) {
      console.error('[Google Drive Callback] State expired');
      return { valid: false, requestPublish: false };
    }

    return { valid: true, requestPublish: decoded.requestPublish || false };
  } catch (error) {
    console.error('[Google Drive Callback] Error verifying state:', error);
    return { valid: false, requestPublish: false };
  }
}

export async function GET(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    // Authenticate user and get internal org ID
    const { orgId, userId } = await requireOrg();

    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from Google
    if (error) {
      console.error('[Google Drive Callback] OAuth error:', { error, errorDescription });
      return redirectWithError(
        'google_drive_auth_denied',
        errorDescription || 'Authorization denied'
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[Google Drive Callback] Missing code or state');
      return redirectWithError('invalid_callback', 'Missing authorization code');
    }

    // Retrieve and verify state from cookies
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_oauth_state')?.value;

    if (!storedState) {
      console.error('[Google Drive Callback] No stored state found');
      return redirectWithError('invalid_state', 'Session expired - please try again');
    }

    const { valid } = verifyState(state, storedState, orgId);
    if (!valid) {
      return redirectWithError('invalid_state', 'Invalid state parameter');
    }

    // Clear the state cookie
    cookieStore.delete('google_oauth_state');

    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[Google Drive Callback] Missing Google OAuth credentials');
      return redirectWithError('server_error', 'Server configuration error');
    }

    // Create OAuth2 client and exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
    } catch (tokenError) {
      console.error('[Google Drive Callback] Token exchange failed:', tokenError);
      return redirectWithError(
        'token_exchange_failed',
        'Failed to exchange authorization code'
      );
    }

    if (!tokens.access_token) {
      console.error('[Google Drive Callback] No access token received');
      return redirectWithError('incomplete_tokens', 'Incomplete token response');
    }

    // Set credentials to fetch user info
    oauth2Client.setCredentials(tokens);

    // Fetch user info using the Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    let userEmail: string | undefined;

    try {
      const aboutResponse = await drive.about.get({ fields: 'user' });
      userEmail = aboutResponse.data.user?.emailAddress || undefined;
    } catch (userError) {
      console.error('[Google Drive Callback] Failed to fetch user info:', userError);
      // Continue without user email - not critical
    }

    // Extract scopes from the token response
    const scopes = tokens.scope?.split(' ') || [];
    const supportsPublish = scopes.includes(WRITE_SCOPE);

    // Calculate token expiration
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour if not provided

    // Check if connector already exists for this org
    const { data: existingConnector } = await supabase
      .from('connector_configs')
      .select('id')
      .eq('org_id', orgId)
      .eq('connector_type', ConnectorType.GOOGLE_DRIVE)
      .single();

    const connectorData = {
      org_id: orgId,
      connector_type: ConnectorType.GOOGLE_DRIVE,
      name: 'Google Drive',
      description: userEmail
        ? `Connected as ${userEmail}`
        : 'Google Drive integration',
      credentials: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        scopes,
        externalUserName: userEmail,
      },
      settings: {
        publish: {
          autoPublish: false,
          defaultFormat: 'markdown',
        },
      },
      is_active: true,
      supports_publish: supportsPublish,
      publish_scopes: scopes,
      created_by: userId,
      credentials_updated_at: new Date().toISOString(),
    };

    if (existingConnector) {
      // Update existing connector
      const { error: updateError } = await supabase
        .from('connector_configs')
        .update({
          ...connectorData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnector.id);

      if (updateError) {
        console.error('[Google Drive Callback] Failed to update connector:', updateError);
        return redirectWithError('storage_failed', 'Failed to update integration');
      }

      console.log('[Google Drive Callback] Updated existing connector:', existingConnector.id);
    } else {
      // Create new connector
      const { error: insertError } = await supabase
        .from('connector_configs')
        .insert(connectorData);

      if (insertError) {
        console.error('[Google Drive Callback] Failed to create connector:', insertError);
        return redirectWithError('storage_failed', 'Failed to save integration');
      }

      console.log('[Google Drive Callback] Created new connector for org:', orgId);
    }

    console.log('[Google Drive Callback] Successfully connected', {
      orgId,
      supportsPublish,
      scopes: scopes.length,
      userEmail,
    });

    return redirectWithSuccess();
  } catch (error) {
    console.error('[Google Drive Callback] Unexpected error:', error);
    return redirectWithError(
      'unexpected_error',
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
