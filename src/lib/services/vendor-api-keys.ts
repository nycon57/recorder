/**
 * Vendor API Key Service (TRIB-56)
 *
 * Generate, validate, list, revoke, and rotate API keys for vendor SDK
 * authentication. Keys are scoped to a white_label_config and never
 * stored in plaintext — only the SHA-256 hash is persisted.
 *
 * Uses supabaseAdmin (service_role) — callers must enforce auth.
 */

import crypto from 'crypto';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { VendorApiKey, VendorApiKeyScope } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX_DISPLAY_LEN = 12; // "sk_live_Ab3x" — enough to identify a key

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** SHA-256 hash a raw API key string. */
function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Generate a cryptographically random API key: `sk_live_<32 hex bytes>`. */
function generateRawKey(): string {
  const random = crypto.randomBytes(32).toString('hex');
  return `sk_live_${random}`;
}

/** Cast a raw DB row to the typed VendorApiKey interface. */
function toTyped(row: Record<string, unknown>): VendorApiKey {
  return row as unknown as VendorApiKey;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new vendor API key.
 *
 * Returns the full plaintext key exactly ONCE. The caller must surface it
 * to the user immediately — it is never retrievable again.
 */
export async function generateApiKey(
  vendorOrgId: string,
  configId: string,
  name: string,
  scopes: VendorApiKeyScope[] = ['query']
): Promise<{ key: string; record: VendorApiKey }> {
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_DISPLAY_LEN);

  const { data, error } = await supabaseAdmin
    .from('vendor_api_keys')
    .insert({
      vendor_org_id: vendorOrgId,
      white_label_config_id: configId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
    })
    .select()
    .single();

  if (error) {
    console.error('[vendor-api-keys] generateApiKey error:', error);
    throw new Error('Failed to generate API key');
  }

  return { key: rawKey, record: toTyped(data) };
}

/**
 * Validate a raw API key. Returns the key metadata if valid, null otherwise.
 * Updates `last_used_at` on successful validation.
 */
export async function validateApiKey(
  rawKey: string
): Promise<{
  vendorOrgId: string;
  configId: string;
  scopes: VendorApiKeyScope[];
  rateLimitRpm: number;
  keyId: string;
} | null> {
  const keyHash = hashKey(rawKey);

  const { data, error } = await supabaseAdmin
    .from('vendor_api_keys')
    .select('id, vendor_org_id, white_label_config_id, scopes, rate_limit_rpm, is_active, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error) {
    console.error('[vendor-api-keys] validateApiKey error:', error);
    return null;
  }

  if (!data) return null;

  const row = data as {
    id: string;
    vendor_org_id: string;
    white_label_config_id: string;
    scopes: VendorApiKeyScope[];
    rate_limit_rpm: number;
    is_active: boolean;
    revoked_at: string | null;
  };

  // Reject inactive or revoked keys
  if (!row.is_active || row.revoked_at) return null;

  // Fire-and-forget last_used_at update — don't block the request
  supabaseAdmin
    .from('vendor_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(({ error: updateError }) => {
      if (updateError) {
        console.warn('[vendor-api-keys] failed to update last_used_at:', updateError);
      }
    });

  return {
    vendorOrgId: row.vendor_org_id,
    configId: row.white_label_config_id,
    scopes: row.scopes,
    rateLimitRpm: row.rate_limit_rpm,
    keyId: row.id,
  };
}

/**
 * List all API keys for a vendor org. Returns metadata only — never the
 * full key or hash.
 */
export async function listApiKeys(
  vendorOrgId: string
): Promise<
  Array<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: VendorApiKeyScope[];
    rate_limit_rpm: number;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
    white_label_config_id: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from('vendor_api_keys')
    .select(
      'id, name, key_prefix, scopes, rate_limit_rpm, is_active, last_used_at, created_at, revoked_at, white_label_config_id'
    )
    .eq('vendor_org_id', vendorOrgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[vendor-api-keys] listApiKeys error:', error);
    throw new Error('Failed to list API keys');
  }

  return (data ?? []) as Array<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: VendorApiKeyScope[];
    rate_limit_rpm: number;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
    white_label_config_id: string;
  }>;
}

/**
 * Revoke a key: sets `is_active = false` and `revoked_at = now()`.
 * Verifies the key belongs to the given vendor org.
 */
export async function revokeApiKey(
  keyId: string,
  vendorOrgId: string
): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from('vendor_api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', keyId)
    .eq('vendor_org_id', vendorOrgId)
    .eq('is_active', true);

  if (error) {
    console.error('[vendor-api-keys] revokeApiKey error:', error);
    throw new Error('Failed to revoke API key');
  }

  // count is null when head:false (default) — we check via a separate query
  // if needed, but the update is idempotent so this is fine.
  if (count === 0) {
    // Might already be revoked or not belong to this org — either way, no-op
  }
}

/**
 * Rotate a key: revokes the old key and generates a new one with the same
 * name, scopes, and config. Returns the new plaintext key (shown once).
 */
export async function rotateApiKey(
  keyId: string,
  vendorOrgId: string
): Promise<{ key: string; record: VendorApiKey }> {
  // Fetch the existing key to copy its metadata
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('vendor_api_keys')
    .select('name, scopes, white_label_config_id, rate_limit_rpm')
    .eq('id', keyId)
    .eq('vendor_org_id', vendorOrgId)
    .single();

  if (fetchError || !existing) {
    console.error('[vendor-api-keys] rotateApiKey fetch error:', fetchError);
    throw new Error('API key not found');
  }

  const row = existing as {
    name: string;
    scopes: VendorApiKeyScope[];
    white_label_config_id: string;
    rate_limit_rpm: number;
  };

  // Revoke old
  await revokeApiKey(keyId, vendorOrgId);

  // Generate new with same metadata
  return generateApiKey(vendorOrgId, row.white_label_config_id, row.name, row.scopes);
}
