import { createHmac } from 'crypto';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { createSupabaseClient } from '@/lib/supabase/server';
import { testWebhookSchema } from '@/lib/validations/api';

// POST /api/organizations/webhooks/[id]/test - Test webhook
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can test webhooks
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const bodyData = await parseBody<z.infer<typeof testWebhookSchema>>(request, testWebhookSchema);
  const supabase = await createSupabaseClient();

  // Get webhook details
  const { data: webhook, error: fetchError } = await supabase
    .from('org_webhooks')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !webhook) {
    throw new Error('Webhook not found');
  }

  // Prepare the test payload
  const payload = bodyData.test_payload || {
    event: bodyData.event_type || 'test',
    timestamp: new Date().toISOString(),
    test: true,
    data: {
      message: 'This is a test webhook delivery',
      webhook_id: webhook.id,
      webhook_name: webhook.name,
    },
  };

  // Generate signature for the payload
  const signature = createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': bodyData.event_type || 'test',
    'X-Webhook-Test': 'true',
    ...webhook.headers,
  };

  // Send the test webhook
  const startTime = Date.now();
  let responseStatus = 0;
  const responseHeaders: Record<string, string> = {};
  let responseBody: any = null;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(webhook.timeout_ms),
    });

    responseStatus = response.status;

    // Collect response headers
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    // Consider 2xx status codes as success
    const success = response.status >= 200 && response.status < 300;

    if (!success) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error: any) {
    errorMessage = error.message || 'Failed to deliver webhook';
    responseStatus = 0;
  }

  const duration = Date.now() - startTime;
  const success = responseStatus >= 200 && responseStatus < 300;

  // Record the test delivery
  await supabase.from('webhook_deliveries').insert({
    webhook_id: webhook.id,
    org_id: orgId,
    event_type: bodyData.event_type || 'test',
    status: success ? 'success' : 'failure',
    status_code: responseStatus,
    duration_ms: duration,
    request_headers: headers,
    request_body: payload,
    response_headers: responseHeaders,
    response_body: responseBody,
    error: errorMessage,
    is_test: true,
  });

  return successResponse({
    data: {
      success,
      status_code: responseStatus,
      duration_ms: duration,
      response_headers: responseHeaders,
      response_body: responseBody,
      error: errorMessage,
    },
  });
});