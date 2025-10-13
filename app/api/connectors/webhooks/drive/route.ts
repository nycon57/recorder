/**
 * Google Drive Webhook Receiver
 *
 * POST /api/connectors/webhooks/drive - Receive Google Drive push notifications
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/connectors/webhooks/drive
 * Handle Google Drive push notifications
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceId = request.headers.get('x-goog-resource-id');
  const resourceState = request.headers.get('x-goog-resource-state');
  const resourceUri = request.headers.get('x-goog-resource-uri');
  const messageNumber = request.headers.get('x-goog-message-number');

  if (!channelId || !resourceId || !resourceState) {
    return errors.badRequest('Missing required Google webhook headers');
  }

  // Find connector by channel ID
  const { data: connector } = await supabaseAdmin
    .from('connector_configs')
    .select('id, org_id, settings')
    .eq('connector_type', 'google_drive')
    .eq('is_active', true)
    .contains('settings', { webhookChannelId: channelId })
    .single();

  if (!connector) {
    console.warn('[Drive Webhook] No connector found for channel:', channelId);
    return successResponse({ message: 'No connector found' });
  }

  // Store webhook event
  await supabaseAdmin.from('connector_webhook_events').insert({
    connector_id: connector.id,
    org_id: connector.org_id,
    event_type: resourceState,
    event_source: 'google_drive',
    event_id: `${channelId}-${messageNumber}`,
    payload: {
      channelId,
      resourceId,
      resourceState,
      resourceUri,
      messageNumber,
    },
    headers: {
      'x-goog-channel-id': channelId,
      'x-goog-resource-id': resourceId,
      'x-goog-resource-state': resourceState,
      'x-goog-resource-uri': resourceUri,
      'x-goog-message-number': messageNumber,
    },
    processed: false,
    retry_count: 0,
    received_at: new Date().toISOString(),
  });

  // Handle different resource states
  switch (resourceState) {
    case 'sync':
      // Initial sync notification - ignore
      break;

    case 'add':
    case 'update':
    case 'change':
      // Queue incremental sync to fetch changes
      await supabaseAdmin.from('jobs').insert({
        type: 'connector_incremental_sync',
        payload: {
          connectorId: connector.id,
          since: new Date(Date.now() - 60000).toISOString(), // Last minute
        },
        org_id: connector.org_id,
        status: 'pending',
        run_after: new Date(Date.now() + 5000).toISOString(), // Debounce by 5 seconds
      });
      break;

    case 'trash':
    case 'remove':
      // Mark documents as deleted
      // Note: We can't identify specific file from webhook, need to sync
      await supabaseAdmin.from('jobs').insert({
        type: 'connector_incremental_sync',
        payload: {
          connectorId: connector.id,
          checkDeleted: true,
        },
        org_id: connector.org_id,
        status: 'pending',
        run_after: new Date().toISOString(),
      });
      break;
  }

  return successResponse({ received: true });
});

/**
 * GET /api/connectors/webhooks/drive
 * Handle Google Drive webhook verification
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // Google doesn't require GET verification, but keep for testing
  return successResponse({ status: 'ok' });
});
