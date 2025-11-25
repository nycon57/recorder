/**
 * Webhook Handler
 *
 * SEC-002: Handles incoming webhooks with secure HMAC verification.
 * Features:
 * - Timing-safe signature comparison (prevents timing attacks)
 * - Timestamp validation (prevents replay attacks)
 * - Idempotency checking (prevents duplicate processing)
 *
 * Currently supports custom transcription webhooks (for external transcription services).
 */

import { NextRequest, NextResponse } from 'next/server';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  verifyWebhook,
  markWebhookEventProcessed,
} from '@/lib/utils/webhook-verification';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks
 * Handle incoming webhooks with secure verification
 */
export async function POST(request: NextRequest) {
  try {
    // Extract verification headers
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const eventId = request.headers.get('x-webhook-event-id');
    const payload = await request.text();

    // SEC-002: Verify webhook with timing-safe comparison and replay protection
    const verification = await verifyWebhook(
      payload,
      { signature, timestamp, eventId },
      WEBHOOK_SECRET,
      'custom'
    );

    if (!verification.valid) {
      console.warn('[Webhook] Verification failed:', verification.error);
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check for duplicate processing
    if (verification.isDuplicate) {
      console.log('[Webhook] Duplicate event, already processed:', eventId);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Parse payload
    const data = JSON.parse(payload);
    const { type, ...eventData } = data;

    console.log(`[Webhook] Received event: ${type}`);

    // Route to appropriate handler
    switch (type) {
      case 'transcription.completed':
        await handleTranscriptionCompleted(eventData);
        break;

      case 'transcription.failed':
        await handleTranscriptionFailed(eventData);
        break;

      default:
        console.warn(`[Webhook] Unknown event type: ${type}`);
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        );
    }

    // SEC-002: Mark event as processed for idempotency
    if (eventId) {
      await markWebhookEventProcessed(eventId, 'custom', { type });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle transcription completed webhook
 */
async function handleTranscriptionCompleted(data: {
  recordingId: string;
  transcriptId: string;
  text: string;
  language: string;
  duration: number;
  words?: any[];
  segments?: any[];
}) {
  const supabase = createAdminClient();

  console.log(`[Webhook] Transcription completed for recording ${data.recordingId}`);

  // Update transcript in database
  const { error: updateError } = await supabase
    .from('transcripts')
    .update({
      text: data.text,
      language: data.language,
      duration_seconds: data.duration,
      words: data.words || [],
      segments: data.segments || [],
    })
    .eq('id', data.transcriptId);

  if (updateError) {
    throw new Error(`Failed to update transcript: ${updateError.message}`);
  }

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'transcribed' })
    .eq('id', data.recordingId);

  // Get org_id for the recording
  const { data: recording } = await supabase
    .from('recordings')
    .select('org_id')
    .eq('id', data.recordingId)
    .single();

  if (!recording) {
    throw new Error('Recording not found');
  }

  // Enqueue document generation job
  await supabase.from('jobs').insert({
    type: 'doc_generate',
    payload: {
      recordingId: data.recordingId,
      transcriptId: data.transcriptId,
      orgId: recording.org_id,
    },
    dedupe_key: `doc_generate:${data.recordingId}`,
  });

  console.log(`[Webhook] Enqueued document generation for recording ${data.recordingId}`);
}

/**
 * Handle transcription failed webhook
 */
async function handleTranscriptionFailed(data: {
  recordingId: string;
  error: string;
}) {
  const supabase = createAdminClient();

  console.log(`[Webhook] Transcription failed for recording ${data.recordingId}: ${data.error}`);

  // Update recording status
  await supabase
    .from('recordings')
    .update({
      status: 'error',
      metadata: { error: data.error },
    })
    .eq('id', data.recordingId);
}
