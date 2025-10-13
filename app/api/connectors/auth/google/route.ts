/**
 * Google OAuth Callback Route
 *
 * GET /api/connectors/auth/google - Handle Google OAuth callback
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType } from '@/lib/connectors/base';

/**
 * GET /api/connectors/auth/google
 * Handle Google OAuth callback and exchange code for tokens
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireAuth();
  const { searchParams } = new URL(request.url);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    return errors.badRequest(
      `OAuth authentication failed: ${errorDescription || error}`,
      { error, errorDescription }
    );
  }

  if (!code || !state) {
    return errors.badRequest('Missing required OAuth parameters');
  }

  if (!orgId) {
    return errors.forbidden();
  }

  try {
    // Parse state to get connector ID or creation intent
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { connectorId, orgId: stateOrgId, returnUrl } = stateData;

    // Verify org ID matches
    if (stateOrgId !== orgId) {
      return errors.forbidden();
    }

    // Exchange code for tokens
    const connector = ConnectorRegistry.create(ConnectorType.GOOGLE_DRIVE, {});

    // Exchange authorization code for access tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/auth/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };

    // If connectorId exists, update existing connector
    if (connectorId) {
      const { error: updateError } = await supabaseAdmin
        .from('connector_configs')
        .update({
          credentials,
          credentials_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectorId)
        .eq('org_id', orgId);

      if (updateError) {
        throw new Error('Failed to update connector credentials');
      }

      // Redirect back to the application
      const redirectUrl = returnUrl || `/dashboard/connectors/${connectorId}`;
      return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}?success=true`);
    }

    // Otherwise, create new connector
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    const { data: newConnector, error: createError } = await supabaseAdmin
      .from('connector_configs')
      .insert({
        org_id: orgId,
        connector_type: 'google_drive',
        name: 'Google Drive',
        credentials,
        settings: {},
        sync_status: 'idle',
        is_active: true,
        created_by: userData?.id,
      })
      .select()
      .single();

    if (createError || !newConnector) {
      throw new Error('Failed to create connector');
    }

    // Redirect to new connector page
    const redirectUrl = returnUrl || `/dashboard/connectors/${newConnector.id}`;
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}?success=true&new=true`);
  } catch (err) {
    console.error('[Google OAuth] Error:', err);
    return errors.internalError();
  }
});
