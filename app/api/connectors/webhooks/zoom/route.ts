/**
 * Zoom Webhook Receiver
 *
 * POST /api/connectors/webhooks/zoom - Receive Zoom webhook events
 */

import crypto from 'crypto';

import { NextRequest } from 'next/server';

import { apiHandler, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Verify Zoom webhook signature
 */
function verifyZoomSignature(
  payload: string,
  timestamp: string,
  signature: string,
  secretToken: string
): boolean {
  const message = `v0:${timestamp}:${payload}`;
  const hashForVerify = crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex');
  const expectedSignature = `v0=${hashForVerify}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /api/connectors/webhooks/zoom
 * Handle Zoom webhook events for recording notifications
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.text();
  const event = JSON.parse(body);

  // Verify webhook signature
  const timestamp = request.headers.get('x-zm-request-timestamp');
  const signature = request.headers.get('x-zm-signature');

  if (!timestamp || !signature) {
    return errors.badRequest('Missing webhook signature headers');
  }

  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken) {
    console.error('[Zoom Webhook] Secret token not configured');
    return errors.internalError();
  }

  if (!verifyZoomSignature(body, timestamp, signature, secretToken)) {
    return errors.forbidden();
  }

  // Handle URL validation
  if (event.event === 'endpoint.url_validation') {
    const plainToken = event.payload.plainToken;
    const encryptedToken = crypto
      .createHmac('sha256', secretToken)
      .update(plainToken)
      .digest('hex');

    return successResponse({
      plainToken,
      encryptedToken,
    });
  }

  // Find connector by webhook URL or account ID
  const accountId = event.payload?.account_id;
  if (!accountId) {
    return errors.badRequest('Missing account ID in webhook payload');
  }

  const { data: connectors } = await supabaseAdmin
    .from('connector_configs')
    .select('id, org_id, settings')
    .eq('connector_type', 'zoom')
    .eq('is_active', true);

  const connector = connectors?.find(
    (c) => c.settings?.accountId === accountId
  );

  if (!connector) {
    console.warn('[Zoom Webhook] No active connector found for account:', accountId);
    return successResponse({ message: 'No connector found' });
  }

  // Store webhook event
  await supabaseAdmin.from('connector_webhook_events').insert({
    connector_id: connector.id,
    org_id: connector.org_id,
    event_type: event.event,
    event_source: 'zoom',
    event_id: event.payload?.object?.id,
    payload: event,
    headers: {
      timestamp,
      signature,
    },
    processed: false,
    retry_count: 0,
    received_at: new Date().toISOString(),
  });

  // Handle specific events
  switch (event.event) {
    case 'recording.completed':
      // Queue job to fetch and process recording
      await supabaseAdmin.from('jobs').insert({
        type: 'connector_sync_file',
        payload: {
          connectorId: connector.id,
          fileId: event.payload.object.id,
          fileType: 'zoom_recording',
        },
        org_id: connector.org_id,
        status: 'pending',
        run_after: new Date().toISOString(),
      });
      break;

    case 'recording.trashed':
    case 'recording.deleted':
      // Mark document as deleted
      await supabaseAdmin
        .from('imported_documents')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('connector_id', connector.id)
        .eq('external_id', event.payload.object.id);
      break;
  }

  return successResponse({ received: true });
});
