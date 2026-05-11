/**
 * API Key Validation Utilities
 *
 * Secure API key validation using bcrypt
 * SECURITY: Uses bcrypt.compare() for constant-time comparison to prevent timing attacks
 *
 * OWASP Reference: A02:2021 – Cryptographic Failures
 * CWE-327: Use of a Broken or Risky Cryptographic Algorithm
 */

import * as bcrypt from 'bcryptjs';

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ValidatedApiKey {
  valid: boolean;
  orgId?: string;
  scopes?: string[];
  rateLimit?: number;
  error?: string;
}

/**
 * Validate API key and check permissions
 *
 * SECURITY FEATURES:
 * - Uses bcrypt.compare() for constant-time comparison (prevents timing attacks)
 * - Validates expiration, status, and IP whitelist
 * - Checks scope permissions
 * - Updates last_used_at and usage_count
 *
 * @param apiKey - The plain text API key from request
 * @param requiredScope - Optional scope required for this request
 * @param ipAddress - Optional IP address for whitelist validation
 * @returns Validation result with org context and permissions
 */
export async function validateApiKey(
  apiKey: string,
  requiredScope?: string,
  ipAddress?: string,
): Promise<ValidatedApiKey> {
  try {
    // Extract key prefix for lookup optimization
    const keyPrefix = apiKey.substring(0, 19); // "sk_live_" + first 11 chars

    // Get all active API keys with this prefix
    // NOTE: We can't query by hash directly since bcrypt generates different hashes each time
    // We need to fetch candidates and use bcrypt.compare() to find the match
    const { data: apiKeys, error: fetchError } = await supabaseAdmin
      .from('api_keys')
      .select(
        'id, key_hash, org_id, scopes, rate_limit, status, expires_at, ip_whitelist',
      )
      .eq('key_prefix', keyPrefix)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[API Key Validation] Database error:', fetchError);
      return {
        valid: false,
        error: 'Internal error validating API key',
      };
    }

    if (!apiKeys || apiKeys.length === 0) {
      return {
        valid: false,
        error: 'Invalid or expired API key',
      };
    }

    // Find matching key using bcrypt.compare() - constant time comparison
    const keyMatches = await Promise.all(
      apiKeys.map(async (key) => ({
        key,
        isMatch: await bcrypt.compare(apiKey, key.key_hash),
      })),
    );
    const matchedKey = keyMatches.find((match) => match.isMatch)?.key ?? null;

    if (!matchedKey) {
      return {
        valid: false,
        error: 'Invalid or expired API key',
      };
    }

    // Check expiration
    if (matchedKey.expires_at && new Date(matchedKey.expires_at) < new Date()) {
      // Auto-expire the key
      await supabaseAdmin
        .from('api_keys')
        .update({ status: 'expired' })
        .eq('id', matchedKey.id);

      return {
        valid: false,
        error: 'API key has expired',
      };
    }

    // Check IP whitelist if configured
    if (
      matchedKey.ip_whitelist != null &&
      !Array.isArray(matchedKey.ip_whitelist)
    ) {
      return {
        valid: false,
        error: 'API key whitelist configuration is invalid',
      };
    }

    const ipWhitelist = Array.isArray(matchedKey.ip_whitelist)
      ? matchedKey.ip_whitelist.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    if (
      Array.isArray(matchedKey.ip_whitelist) &&
      matchedKey.ip_whitelist.length > 0 &&
      ipWhitelist.length === 0
    ) {
      return {
        valid: false,
        error: 'API key whitelist configuration is invalid',
      };
    }

    if (ipWhitelist.length > 0) {
      if (!ipAddress) {
        return {
          valid: false,
          error: 'IP address required for validation',
        };
      }

      // Check if IP is in whitelist
      const isWhitelisted = ipWhitelist.some((whitelistedIp) => {
        // Support CIDR notation in the future - for now, exact match
        return whitelistedIp === ipAddress;
      });

      if (!isWhitelisted) {
        return {
          valid: false,
          error: 'IP address not whitelisted',
        };
      }
    }

    // Check scope if required
    const scopes = Array.isArray(matchedKey.scopes)
      ? matchedKey.scopes.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    if (requiredScope) {
      const hasScope =
        scopes.includes('*') || // Wildcard scope
        scopes.includes(requiredScope);

      if (!hasScope) {
        return {
          valid: false,
          error: 'Insufficient permissions for requested scope',
        };
      }
    }

    // Update last used timestamp and usage count atomically.
    void Promise.resolve(
      supabaseAdmin.rpc(
        'increment_api_key_usage_count' as never,
        { p_key_id: matchedKey.id } as never,
      ),
    )
      .then(({ error }: { error: unknown }) => {
        if (error) {
          console.error(
            '[API Key Validation] Failed to update usage stats:',
            error,
          );
        }
      })
      .catch((error: unknown) => {
        console.error(
          '[API Key Validation] Failed to update usage stats:',
          error,
        );
      });

    return {
      valid: true,
      orgId: matchedKey.org_id,
      scopes,
      rateLimit: matchedKey.rate_limit ?? undefined,
    };
  } catch (error) {
    console.error('[API Key Validation] Unexpected error:', error);
    return {
      valid: false,
      error: 'Internal error validating API key',
    };
  }
}

/**
 * Extract API key from request headers
 *
 * Supports:
 * - Authorization: Bearer sk_live_...
 * - X-API-Key: sk_live_...
 *
 * @param headers - Request headers
 * @returns API key or null if not found
 */
function extractApiKey(headers: Headers): string | null {
  // Try Authorization header first (preferred)
  const authHeader = headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKeyHeader = headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Get client IP address from request headers
 *
 * @param headers - Request headers
 * @returns IP address or undefined if not found
 */
function extractIpAddress(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return undefined;
}
