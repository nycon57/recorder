/**
 * Dual Auth Middleware (TRIB-56)
 *
 * Checks for `Authorization: Bearer sk_live_...` header first. If present
 * and valid, returns the vendor org context from the API key. Otherwise
 * falls back to Better Auth session auth via `requireOrg()`.
 *
 * Rate limiting: API key requests are rate-limited per-key using the
 * key's `rate_limit_rpm` setting via the existing Redis rate limiter.
 */

import { NextRequest } from 'next/server';

import { requireOrg } from '@/lib/utils/api';
import { validateApiKey } from '@/lib/services/vendor-api-keys';
import { rateLimit } from '@/lib/rate-limit/limiter';
import type { VendorApiKeyScope } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiKeyAuthResult {
  orgId: string;
  configId: string;
  scopes: VendorApiKeyScope[];
  authMethod: 'api_key';
  keyId: string;
}

export interface SessionAuthResult {
  orgId: string;
  userId: string;
  role: string;
  authMethod: 'session';
}

export type DualAuthResult = ApiKeyAuthResult | SessionAuthResult;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Authenticate a request via API key or session.
 *
 * Priority:
 *   1. If `Authorization: Bearer sk_live_...` header is present, validate the
 *      API key and enforce per-key rate limiting.
 *   2. Otherwise, fall back to `requireOrg()` (Better Auth session cookie).
 *   3. If both fail, throws `'Unauthorized'`.
 *
 * @param request - The incoming NextRequest
 * @param requiredScope - Optional scope the key must have (e.g. 'query').
 *                        Session auth always passes scope checks.
 */
export async function requireApiKeyOrSession(
  request: NextRequest,
  requiredScope?: VendorApiKeyScope
): Promise<DualAuthResult> {
  const authHeader = request.headers.get('authorization');

  // --- Path 1: API key auth ---
  if (authHeader?.startsWith('Bearer sk_live_')) {
    const rawKey = authHeader.slice('Bearer '.length);

    const keyData = await validateApiKey(rawKey);
    if (!keyData) {
      throw new Error('Unauthorized');
    }

    // Scope check
    if (requiredScope && !keyData.scopes.includes(requiredScope)) {
      throw new Error('Insufficient scope');
    }

    // Per-key rate limiting (sliding window, keyed by keyId)
    const rateLimitResult = await rateLimit(keyData.keyId, {
      prefix: 'vendor-api-key',
      limit: keyData.rateLimitRpm,
      window: 60, // 1 minute
    });

    if (!rateLimitResult.success) {
      throw new Error('Rate limit exceeded');
    }

    return {
      orgId: keyData.vendorOrgId,
      configId: keyData.configId,
      scopes: keyData.scopes,
      authMethod: 'api_key',
      keyId: keyData.keyId,
    };
  }

  // --- Path 2: Session auth fallback ---
  const ctx = await requireOrg();
  return {
    orgId: ctx.orgId,
    userId: ctx.userId,
    role: ctx.role,
    authMethod: 'session',
  };
}
