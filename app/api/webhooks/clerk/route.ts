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
  } catch (err) {
    console.error('[Clerk Webhook] Signature verification failed:', err);
    return new Response('Invalid signature', { status: 401 });
  }

  const eventType = evt.type;
  console.log(`[Clerk Webhook] Received event: ${eventType}`);

  try {
    switch (eventType) {
      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(evt);
        break;

      default:
        // Acknowledge unhandled event types without error
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
  const orgId = organization.id;
  const userId = public_user_data.user_id;
  const userName = [public_user_data.first_name, public_user_data.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown';

  console.log(
    `[Clerk Webhook] New member: ${userName} (${userId}) joined org ${orgId} as ${role}`
  );

  const enabled = await isAgentEnabled(orgId, 'onboarding');

  // Log the detection regardless of whether onboarding is enabled
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

  if (!enabled) {
    console.log(
      `[Clerk Webhook] Onboarding disabled for org ${orgId}, skipping plan generation`
    );
    return;
  }

  // Insert job with dedupe_key to prevent duplicate plans for the same user
  const { error } = await supabaseAdmin.from('jobs').insert({
    type: 'generate_onboarding_plan' as any,
    payload: {
      orgId,
      userId,
      userName,
      userRole: role,
    },
    dedupe_key: `onboarding_plan:${orgId}:${userId}`,
  });

  if (error) {
    // Unique constraint on dedupe_key means a plan job already exists
    if (error.code === '23505') {
      console.log(
        `[Clerk Webhook] Plan job already exists for user ${userId} in org ${orgId} (dedupe)`
      );
      return;
    }
    throw new Error(`Failed to create onboarding plan job: ${error.message}`);
  }

  console.log(
    `[Clerk Webhook] Created generate_onboarding_plan job for ${userName} (${userId}) in org ${orgId}`
  );
}
