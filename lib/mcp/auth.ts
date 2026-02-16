/**
 * MCP Server Authentication
 *
 * Validates MCP API keys (trb_mcp_*) against the mcp_api_keys table,
 * or falls back to the legacy api_keys table for sk_live_* keys.
 */

import { createHash } from 'crypto';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateApiKey } from '@/lib/utils/api-key-validation';

export interface McpAuthContext {
  orgId: string;
  scopes: string[];
  rateLimit: number;
  /** The mcp_api_keys row ID (set only for trb_mcp_ keys). */
  keyId?: string;
}

/**
 * Authenticate an MCP connection using an API key.
 *
 * For trb_mcp_* keys: hashes with SHA-256 and looks up mcp_api_keys.
 * For sk_live_* keys: delegates to the existing api-key-validation utility.
 */
export async function authenticateMcpConnection(
  apiKey: string
): Promise<McpAuthContext> {
  if (!apiKey) {
    throw new McpAuthError('Invalid or missing API key');
  }

  // Route trb_mcp_ keys to the dedicated table
  if (apiKey.startsWith('trb_mcp_')) {
    return validateMcpKey(apiKey);
  }

  // Legacy path: sk_live_ keys validated via api_keys table
  const result = await validateApiKey(apiKey);

  if (!result.valid || !result.orgId) {
    throw new McpAuthError(result.error || 'Invalid or missing API key');
  }

  return {
    orgId: result.orgId,
    scopes: result.scopes || [],
    rateLimit: result.rateLimit || 1000,
  };
}

/**
 * Validate a trb_mcp_* key against the mcp_api_keys table.
 *
 * Uses SHA-256 hashing (deterministic) so we can query by hash directly —
 * no need to iterate candidates like bcrypt requires.
 */
async function validateMcpKey(apiKey: string): Promise<McpAuthContext> {
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const { data: key, error } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('id, org_id, permissions, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !key) {
    throw new McpAuthError('Invalid or missing API key');
  }

  if (!key.is_active) {
    throw new McpAuthError('API key has been revoked');
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    throw new McpAuthError('API key has expired');
  }

  // Fire-and-forget: atomically increment request_count + update last_used_at
  void Promise.resolve(
    supabaseAdmin.rpc('increment_mcp_request_count', { p_key_id: key.id })
  ).then(({ error: rpcError }) => {
    if (rpcError) {
      console.error('[MCP Auth] Failed to update usage stats:', rpcError);
    }
  }).catch((err: unknown) => {
    console.error('[MCP Auth] Failed to update usage stats:', err);
  });

  return {
    orgId: key.org_id,
    scopes: key.permissions || ['read'],
    rateLimit: 100,
    keyId: key.id,
  };
}

// Lazy-initialized rate limiter
let mcpRateLimiter: import('@upstash/ratelimit').Ratelimit | null = null;

/**
 * Check MCP rate limit for a key (100 req/min via Upstash Redis).
 *
 * Returns { allowed: true } or throws McpAuthError with rate limit details.
 * Fails open if Redis is unavailable.
 */
export async function checkMcpRateLimit(keyId: string): Promise<void> {
  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { getRedis } = await import('@/lib/rate-limit/redis');

    const redis = getRedis();
    if (!redis) return;

    if (!mcpRateLimiter) {
      mcpRateLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        prefix: 'ratelimit:mcp',
      });
    }

    const { success, reset } = await mcpRateLimiter.limit(`mcp_key:${keyId}`);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      throw new McpRateLimitError(retryAfter);
    }
  } catch (error) {
    if (error instanceof McpRateLimitError) throw error;
    console.error('[MCP Rate Limit] Error:', error);
  }
}

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpAuthError';
  }
}

export class McpRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded (100 requests/minute). Retry after ${retryAfter} seconds.`
    );
    this.name = 'McpRateLimitError';
    this.retryAfter = retryAfter;
  }
}
