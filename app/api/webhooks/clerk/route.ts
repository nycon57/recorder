/**
 * Clerk Webhook Handler
 *
 * Receives Clerk webhook events (via svix) and routes them to handlers.
 * Currently handles organizationMembership.created to auto-trigger
 * onboarding plan generation for new org members.
 */

import { verifyWebhook } from '@clerk/backend/webhooks';
import type {
  OrganizationMembershipWebhookEvent,
  WebhookEvent,
} from '@clerk/backend/webhooks';

import { isAgentEnabled } from '@/lib/services/agent-config';
import { logAgentAction } from '@/lib/services/agent-logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let evt: WebhookEvent;

  try {
    evt = await verifyWebhook(request);
  } catch {
    console.error('[Clerk Webhook] Signature verification failed');
    return new Response('Invalid signature', { status: 401 });
  }

  const eventType = evt.type;

  try {
    switch (eventType) {
      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(evt);
        break;

      default:
        break;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error(`[Clerk Webhook] Error handling ${eventType}:`, error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Handle a new member joining an organization.
 * If the onboarding agent is enabled for the org, create a
 * generate_onboarding_plan job with dedupe protection.
 */
async function handleOrganizationMembershipCreated(
  evt: OrganizationMembershipWebhookEvent
) {
  const { organization, public_user_data, role } = evt.data;

  if (!organization?.id || !public_user_data?.user_id) {
    console.error('[Clerk Webhook] Missing required fields in membership event');
    return;
  }

  const orgId = organization.id;
  const userId = public_user_data.user_id;
  const userName = [public_user_data.first_name, public_user_data.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown';

  const enabled = await isAgentEnabled(orgId, 'onboarding');

  // Log detection regardless of whether onboarding is enabled (best-effort)
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
    payload: {
      orgId,
      userId,
      userName,
      userRole: role,
    },
    dedupe_key: `onboarding_plan:${orgId}:${userId}`,
  });

  if (error) {
    // Unique constraint violation means a plan job already exists for this user
    if (error.code === '23505') {
      return;
    }
    throw new Error(`Failed to create onboarding plan job: ${error.message}`);
  }
}
