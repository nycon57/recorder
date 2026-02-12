import { verifyWebhook } from '@clerk/backend/webhooks';
import type {
  OrganizationMembershipWebhookEvent,
  WebhookEvent,
} from '@clerk/backend/webhooks';

import { isAgentEnabled } from '@/lib/services/agent-config';
import { logAgentAction } from '@/lib/services/agent-logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PG_UNIQUE_VIOLATION = '23505';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let evt: WebhookEvent;

  try {
    evt = await verifyWebhook(request);
  } catch {
    console.error('[Clerk Webhook] Signature verification failed');
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    switch (evt.type) {
      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(evt);
        break;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`[Clerk Webhook] Error handling ${evt.type}:`, error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function handleOrganizationMembershipCreated(
  evt: OrganizationMembershipWebhookEvent
): Promise<void> {
  const { organization, public_user_data, role } = evt.data;

  if (!organization?.id || !public_user_data?.user_id) {
    console.error('[Clerk Webhook] Missing required fields in membership event');
    return;
  }

  const orgId = organization.id;
  const userId = public_user_data.user_id;
  const userName =
    [public_user_data.first_name, public_user_data.last_name]
      .filter(Boolean)
      .join(' ') || 'Unknown';

  const enabled = await isAgentEnabled(orgId, 'onboarding');

  // Best-effort logging -- failures must not block the handler
  try {
    await logAgentAction({
      orgId,
      agentType: 'onboarding',
      actionType: 'detect_new_member',
      targetEntity: 'user',
      targetId: userId,
      inputSummary: `New member ${userName} joined as ${role}`,
      outputSummary: enabled
        ? 'Onboarding enabled — creating plan generation job'
        : 'Onboarding disabled — skipping plan generation',
      outcome: 'success',
    });
  } catch (logErr) {
    console.error('[Clerk Webhook] Failed to log agent action:', logErr);
  }

  if (!enabled) {
    return;
  }

  const { error } = await supabaseAdmin.from('jobs').insert({
    type: 'generate_onboarding_plan',
    status: 'pending',
    payload: { orgId, userId, userName, userRole: role },
    dedupe_key: `onboarding_plan:${orgId}:${userId}`,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return;
    }
    throw new Error(`Failed to create onboarding plan job: ${error.message}`);
  }
}
