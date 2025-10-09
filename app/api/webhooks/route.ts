/**
 * Webhook Handler
 *
 * Handles incoming webhooks from external services with HMAC verification.
 * Currently supports custom transcription webhooks (for future external transcription services).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

/**
 * Verify HMAC signature
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] WEBHOOK_SECRET not configured, skipping verification');
    return true; // Allow in development
  }

  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * POST /api/webhooks
 * Handle incoming webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-webhook-signature') || '';
    const payload = await request.text();

    // Verify signature
    if (!verifySignature(payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
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
