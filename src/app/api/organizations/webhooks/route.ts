import { randomBytes } from 'crypto';

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { createSupabaseClient } from '@/lib/supabase/server';
import { createWebhookSchema } from '@/lib/validations/api';

// GET /api/organizations/webhooks - List webhooks
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, role } = await requireOrg();

  // Only admins and owners can view webhooks
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const supabase = await createSupabaseClient();

  // Get webhooks with delivery statistics
  const { data: webhooks, error } = await supabase
    .from('org_webhooks')
    .select(`
      *,
      webhook_deliveries:webhook_deliveries(
        status,
        created_at
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Calculate statistics for each webhook
  const formattedWebhooks = webhooks.map((webhook) => {
    const deliveries = webhook.webhook_deliveries || [];
    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(
      (d: any) => d.status === 'success'
    ).length;
    const failedDeliveries = totalDeliveries - successfulDeliveries;
    const successRate = totalDeliveries > 0
      ? (successfulDeliveries / totalDeliveries) * 100
      : 0;

    // Get last triggered time
    const lastDelivery = deliveries[0];
    const lastTriggeredAt = lastDelivery?.created_at || null;

    // Determine webhook health status
    let status: 'healthy' | 'degraded' | 'failing' | 'disabled';
    if (!webhook.enabled) {
      status = 'disabled';
    } else if (successRate >= 90 || totalDeliveries === 0) {
      status = 'healthy';
    } else if (successRate >= 50) {
      status = 'degraded';
    } else {
      status = 'failing';
    }

    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      description: webhook.description,
      events: webhook.events,
      status,
      enabled: webhook.enabled,
      last_triggered_at: lastTriggeredAt,
      success_rate: successRate,
      total_deliveries: totalDeliveries,
      failed_deliveries: failedDeliveries,
      created_at: webhook.created_at,
      retry_enabled: webhook.retry_enabled,
      max_retries: webhook.max_retries,
      timeout_ms: webhook.timeout_ms,
    };
  });

  return successResponse({ data: formattedWebhooks });
});

// POST /api/organizations/webhooks - Create webhook
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can create webhooks
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const bodyData = await parseBody<z.infer<typeof createWebhookSchema>>(request, createWebhookSchema);
  const supabase = await createSupabaseClient();

  // Validate URL is HTTPS
  if (!bodyData.url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS');
  }

  // Generate a secret for webhook signature verification
  const secret = randomBytes(32).toString('hex');

  // Create the webhook
  const { data: webhook, error } = await supabase
    .from('org_webhooks')
    .insert({
      org_id: orgId,
      created_by: userId,
      name: bodyData.name,
      description: bodyData.description,
      url: bodyData.url,
      events: bodyData.events,
      headers: bodyData.headers || {},
      secret,
      enabled: true,
      retry_enabled: bodyData.retry_enabled,
      max_retries: bodyData.max_retries,
      timeout_ms: bodyData.timeout_ms,
    })
    .select()
    .single();

  if (error) throw error;

  // Log webhook creation
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'webhook.created',
    resource_type: 'webhook',
    resource_id: webhook.id,
    metadata: {
      webhook_name: bodyData.name,
      events: bodyData.events,
    },
  });

  return successResponse({
    data: {
      ...webhook,
      // Don't return the secret in the response
      secret: undefined,
    },
  });
});