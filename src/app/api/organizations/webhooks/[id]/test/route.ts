import { createHmac } from 'crypto';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';
import { testWebhookSchema } from '@/lib/validations/api';

type JsonObject = { [key: string]: Json | undefined };

const isJsonObject = (value: Json): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toJson = (value: unknown): Json => value as Json;

const toResponseBody = (value: Json): string | null => {
  if (typeof value === 'string') return value;
  if (value === null) return null;
  return JSON.stringify(value);
};

// POST /api/organizations/webhooks/[id]/test - Test webhook
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const [{ orgId }, bodyData, supabase] = await Promise.all([
      requireAdmin(),
      parseBody<z.infer<typeof testWebhookSchema>>(request, testWebhookSchema),
      createClient(),
    ]);

    // Get webhook details
    const { data: webhook, error: fetchError } = await supabase
      .from('org_webhooks')
      .select('*')
      .eq('id', id)
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
    const customHeaders = isJsonObject(webhook.headers) ? webhook.headers : {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': bodyData.event_type || 'test',
      'X-Webhook-Test': 'true',
      ...Object.fromEntries(
        Object.entries(customHeaders).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
    };

    // Send the test webhook
    const startTime = Date.now();
    let responseStatus = 0;
    const responseHeaders: Record<string, string> = {};
    let responseBody: Json = null;
    let errorMessage: string | undefined;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeout_ms ?? 5000),
        cache: 'no-store',
      });

      responseStatus = response.status;

      // Collect response headers
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = toJson(await response.json());
      } else {
        responseBody = await response.text();
      }

      // Consider 2xx status codes as success
      const success = response.status >= 200 && response.status < 300;

      if (!success) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error: unknown) {
      errorMessage =
        error instanceof Error ? error.message : 'Failed to deliver webhook';
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
      response_status_code: responseStatus,
      duration_ms: duration,
      payload: toJson(payload),
      response_headers: responseHeaders,
      response_body: toResponseBody(responseBody),
      error_message: errorMessage,
      metadata: {
        is_test: true,
        request_headers: headers,
      },
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
  },
);
