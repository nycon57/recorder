/**
 * SEC-002: Webhook Signature Verification Utilities
 *
 * Provides secure HMAC signature verification with:
 * - Timing-safe comparison to prevent timing attacks
 * - Timestamp validation to prevent replay attacks
 * - Idempotency key tracking to prevent duplicate processing
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Maximum age for webhook timestamps (5 minutes)
 * Webhooks older than this will be rejected to prevent replay attacks
 */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

/**
 * Webhook verification result
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from the request header
 * @param secret - The webhook secret key
 * @param options - Additional verification options
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  options: {
    /** Timestamp from webhook header (ISO string or Unix timestamp) */
    timestamp?: string | number;
    /** Algorithm to use (default: sha256) */
    algorithm?: 'sha256' | 'sha512';
  } = {}
): VerificationResult {
  const { timestamp, algorithm = 'sha256' } = options;

  // Validate inputs
  if (!payload) {
    return { valid: false, error: 'Missing payload' };
  }

  if (!signature) {
    return { valid: false, error: 'Missing signature' };
  }

  if (!secret) {
    // In production, always require a secret
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'Webhook secret not configured' };
    }
    // In development, warn but allow
    console.warn('[Webhook] SECURITY WARNING: No secret configured, skipping verification');
    return { valid: true };
  }

  // Validate timestamp if provided (replay attack prevention)
  if (timestamp) {
    const timestampMs =
      typeof timestamp === 'number'
        ? timestamp * 1000 // Unix timestamp in seconds
        : new Date(timestamp).getTime();

    const now = Date.now();
    const age = now - timestampMs;

    if (isNaN(timestampMs)) {
      return { valid: false, error: 'Invalid timestamp format' };
    }

    if (age > MAX_TIMESTAMP_AGE_MS) {
      return { valid: false, error: 'Webhook timestamp too old (possible replay attack)' };
    }

    if (age < -60000) {
      // Allow 1 minute clock skew into the future
      return { valid: false, error: 'Webhook timestamp in the future' };
    }
  }

  // Calculate expected signature
  // Include timestamp in signature calculation if provided (prevents tampering)
  const signaturePayload = timestamp ? `${timestamp}.${payload}` : payload;
  const expectedSignature = createHmac(algorithm, secret)
    .update(signaturePayload)
    .digest('hex');

  // Parse signature (may be prefixed with version, e.g., "v1=abc123")
  let actualSignature = signature;
  if (signature.includes('=')) {
    const parts = signature.split('=');
    actualSignature = parts[parts.length - 1];
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(actualSignature, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
      return { valid: false, error: 'Invalid signature' };
    }

    const isValid = timingSafeEqual(expectedBuffer, actualBuffer);
    return { valid: isValid, error: isValid ? undefined : 'Invalid signature' };
  } catch {
    return { valid: false, error: 'Signature verification failed' };
  }
}

/**
 * Check if a webhook event has already been processed (idempotency)
 *
 * @param eventId - Unique identifier for the webhook event
 * @param source - Source of the webhook (e.g., 'stripe', 'custom')
 * @returns True if the event has already been processed
 */
export async function isWebhookEventProcessed(
  eventId: string,
  source: string
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .eq('source', source)
      .single();

    return !!data;
  } catch {
    // If table doesn't exist or query fails, assume not processed
    return false;
  }
}

/**
 * Mark a webhook event as processed
 *
 * @param eventId - Unique identifier for the webhook event
 * @param source - Source of the webhook
 * @param metadata - Additional metadata to store
 */
export async function markWebhookEventProcessed(
  eventId: string,
  source: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from('webhook_events').insert({
      event_id: eventId,
      source,
      processed_at: new Date().toISOString(),
      metadata,
    });
  } catch (error) {
    // Log but don't throw - idempotency tracking is a best-effort feature
    console.warn('[Webhook] Failed to mark event as processed:', error);
  }
}

/**
 * Full webhook verification including signature and idempotency checks
 */
export async function verifyWebhook(
  payload: string,
  headers: {
    signature?: string | null;
    timestamp?: string | null;
    eventId?: string | null;
  },
  secret: string,
  source: string
): Promise<VerificationResult> {
  const { signature, timestamp, eventId } = headers;

  // Verify signature
  const signatureResult = verifyWebhookSignature(payload, signature || '', secret, {
    timestamp: timestamp || undefined,
  });

  if (!signatureResult.valid) {
    return signatureResult;
  }

  // Check idempotency if event ID provided
  if (eventId) {
    const isDuplicate = await isWebhookEventProcessed(eventId, source);
    if (isDuplicate) {
      return { valid: true, isDuplicate: true };
    }
  }

  return { valid: true, isDuplicate: false };
}

/**
 * Generate HMAC signature for outgoing webhooks
 *
 * @param payload - The payload to sign
 * @param secret - The webhook secret
 * @param timestamp - Optional timestamp to include
 * @returns Signature string
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signaturePayload = `${ts}.${payload}`;

  const signature = createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return {
    signature: `v1=${signature}`,
    timestamp: ts,
  };
}
