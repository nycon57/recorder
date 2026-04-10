import { randomBytes, createHash } from 'crypto';

import { NextRequest } from 'next/server';

import { apiHandler, requireAdmin, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit, RateLimitTier, extractUserIdFromAuth } from '@/lib/middleware/rate-limit';

/**
 * GET /api/organizations/mcp-keys — List MCP API keys (prefix only)
 */
export const GET = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async () => {
    const { orgId } = await requireAdmin();

    const { data: keys, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .select('id, name, key_prefix, permissions, last_used_at, request_count, is_active, created_at, expires_at')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return successResponse(keys ?? []);
  })
);

/**
 * POST /api/organizations/mcp-keys — Generate a new MCP API key
 *
 * Returns the full key exactly once. Stores only the SHA-256 hash.
 */
export const POST = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
    const { orgId } = await requireAdmin();

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name || name.length > 255) {
      return errors.badRequest('Name is required (max 255 characters)');
    }

    const keyHex = randomBytes(16).toString('hex');
    const fullKey = `trb_mcp_${keyHex}`;
    const keyPrefix = `trb_mcp_${keyHex.slice(0, 8)}`;
    const keyHash = createHash('sha256').update(fullKey).digest('hex');

    const { data: newKey, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .insert({
        org_id: orgId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
        permissions: ['read'],
      })
      .select('id, name, key_prefix, permissions, is_active, created_at')
      .single();

    if (error) throw error;

    return successResponse({ ...newKey, key: fullKey }, undefined, 201);
  })
);
