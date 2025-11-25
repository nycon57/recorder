import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { createSupabaseClient } from '@/lib/supabase/server';
import { updateWebhookSchema } from '@/lib/validations/api';

// PATCH /api/organizations/webhooks/[id] - Update webhook
export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can update webhooks
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const bodyData = await parseBody<z.infer<typeof updateWebhookSchema>>(request, updateWebhookSchema);
  const supabase = await createSupabaseClient();

  // Verify webhook belongs to this org
  const { data: webhook, error: fetchError } = await supabase
    .from('org_webhooks')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !webhook) {
    throw new Error('Webhook not found');
  }

  // Validate URL is HTTPS if being updated
  if (bodyData.url && !bodyData.url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS');
  }

  // Update webhook
  const { data: updatedWebhook, error: updateError } = await supabase
    .from('org_webhooks')
    .update({
      name: bodyData.name !== undefined ? bodyData.name : webhook.name,
      description: bodyData.description !== undefined ? bodyData.description : webhook.description,
      url: bodyData.url !== undefined ? bodyData.url : webhook.url,
      events: bodyData.events !== undefined ? bodyData.events : webhook.events,
      headers: bodyData.headers !== undefined ? bodyData.headers : webhook.headers,
      enabled: bodyData.enabled !== undefined ? bodyData.enabled : webhook.enabled,
      retry_enabled: bodyData.retry_enabled !== undefined ? bodyData.retry_enabled : webhook.retry_enabled,
      max_retries: bodyData.max_retries !== undefined ? bodyData.max_retries : webhook.max_retries,
      timeout_ms: bodyData.timeout_ms !== undefined ? bodyData.timeout_ms : webhook.timeout_ms,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateError) throw updateError;

  // Log webhook update
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'webhook.updated',
    resource_type: 'webhook',
    resource_id: params.id,
    metadata: {
      webhook_name: webhook.name,
      changes: bodyData,
    },
  });

  return successResponse({
    data: {
      ...updatedWebhook,
      secret: undefined, // Never return the secret
    },
  });
});

// DELETE /api/organizations/webhooks/[id] - Delete webhook
export const DELETE = apiHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can delete webhooks
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const supabase = await createSupabaseClient();

  // Verify webhook belongs to this org
  const { data: webhook, error: fetchError } = await supabase
    .from('org_webhooks')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !webhook) {
    throw new Error('Webhook not found');
  }

  // Delete webhook (cascade will delete deliveries)
  const { error: deleteError } = await supabase
    .from('org_webhooks')
    .delete()
    .eq('id', params.id)
    .eq('org_id', orgId);

  if (deleteError) throw deleteError;

  // Log webhook deletion
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'webhook.deleted',
    resource_type: 'webhook',
    resource_id: params.id,
    metadata: {
      webhook_name: webhook.name,
    },
  });

  return successResponse({ message: 'Webhook deleted successfully' });
});