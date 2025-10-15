/**
 * Microsoft Teams Webhook Receiver
 *
 * POST /api/connectors/webhooks/teams - Receive Teams webhook events
 */

import crypto from 'crypto';

import { NextRequest } from 'next/server';

import { apiHandler, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Verify Microsoft Graph webhook signature
 */
function verifyTeamsSignature(
  payload: string,
  signature: string | null,
  clientState: string
): boolean {
  if (!signature) return false;

  // Microsoft sends the client state as validation token
  // In production, implement proper token validation
  return true;
}

/**
 * POST /api/connectors/webhooks/teams
 * Handle Microsoft Teams/Graph webhook notifications
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.text();

  // Handle validation request
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  if (validationToken) {
    // Microsoft Graph subscription validation
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const event = JSON.parse(body);

  // Verify webhook signature
  const signature = request.headers.get('x-ms-signature');
  const clientState = event.value?.[0]?.clientState;

  if (!verifyTeamsSignature(body, signature, clientState)) {
    return errors.forbidden();
  }

  // Process each notification in the batch
  for (const notification of event.value || []) {
    const { subscriptionId, changeType, resource, resourceData, clientState } = notification;

    // Find connector by subscription ID or client state
    const { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('id, org_id')
      .eq('connector_type', 'microsoft_teams')
      .eq('is_active', true)
      .contains('settings', { subscriptionId })
      .single();

    if (!connector) {
      console.warn('[Teams Webhook] No connector found for subscription:', subscriptionId);
      continue;
    }

    // Store webhook event
    await supabaseAdmin.from('connector_webhook_events').insert({
      connector_id: connector.id,
      org_id: connector.org_id,
      event_type: changeType,
      event_source: 'microsoft_teams',
      event_id: notification.id,
      payload: notification,
      headers: {
        signature,
      },
      processed: false,
      retry_count: 0,
      received_at: new Date().toISOString(),
    });

    // Handle different change types
    switch (changeType) {
      case 'created':
      case 'updated':
        // Queue job to fetch and process resource
        await supabaseAdmin.from('jobs').insert({
          type: 'connector_sync_file',
          payload: {
            connectorId: connector.id,
            resourceId: resource,
            changeType,
          },
          org_id: connector.org_id,
          status: 'pending',
          run_after: new Date().toISOString(),
        });
        break;

      case 'deleted':
        // Mark document as deleted
        await supabaseAdmin
          .from('imported_documents')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('connector_id', connector.id)
          .eq('external_id', resource);
        break;
    }
  }

  return successResponse({ received: true });
});
