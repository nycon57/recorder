/**
 * Microsoft Teams OAuth Callback Route
 *
 * GET /api/connectors/auth/teams - Handle Teams OAuth callback
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireAuth, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/connectors/auth/teams
 * Handle Microsoft Teams OAuth callback and exchange code for tokens
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
    // Parse state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { connectorId, orgId: stateOrgId, returnUrl } = stateData;

    // Verify org ID matches
    if (stateOrgId !== orgId) {
      return errors.forbidden();
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/auth/teams`,
          grant_type: 'authorization_code',
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
    };

    // Update or create connector
    if (connectorId) {
      await supabaseAdmin
        .from('connector_configs')
        .update({
          credentials,
          credentials_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectorId)
        .eq('org_id', orgId);

      const redirectUrl = returnUrl || `/dashboard/connectors/${connectorId}`;
      return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}?success=true`);
    }

    // Create new connector
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    const { data: newConnector } = await supabaseAdmin
      .from('connector_configs')
      .insert({
        org_id: orgId,
        connector_type: 'microsoft_teams',
        name: 'Microsoft Teams',
        credentials,
        settings: {},
        sync_status: 'idle',
        is_active: true,
        created_by: userData?.id,
      })
      .select()
      .single();

    const redirectUrl = returnUrl || `/dashboard/connectors/${newConnector.id}`;
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectUrl}?success=true&new=true`);
  } catch (err) {
    console.error('[Teams OAuth] Error:', err);
    return errors.internalError();
  }
});
