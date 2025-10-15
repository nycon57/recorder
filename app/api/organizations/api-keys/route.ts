import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { createSupabaseClient } from '@/lib/supabase/server';
import { createApiKeySchema } from '@/lib/validations/api';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { rateLimit, RateLimitTier, extractUserIdFromAuth } from '@/lib/middleware/rate-limit';

/**
 * GET /api/organizations/api-keys - List API keys
 *
 * @security Rate limited to 100 requests per minute per user
 */
export const GET = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { orgId, role } = await requireOrg();

  // Only admins and owners can view API keys
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const supabase = await createSupabaseClient();

  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Format the response, never send the actual key hash
  const formattedKeys = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    description: key.description,
    key_prefix: key.key_prefix,
    status: key.status,
    scopes: key.scopes,
    rate_limit: key.rate_limit,
    ip_whitelist: key.ip_whitelist,
    last_used_at: key.last_used_at,
    expires_at: key.expires_at,
    created_at: key.created_at,
    usage_count: key.usage_count || 0,
  }));

  return successResponse({ data: formattedKeys });
}));

/**
 * POST /api/organizations/api-keys - Create new API key
 *
 * @security Rate limited to 100 requests per minute per user
 * @security API key hashed with bcrypt (cost factor 12)
 */
export const POST = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { orgId, userId, role } = await requireOrg();

  // Only admins and owners can create API keys
  if (!['admin', 'owner'].includes(role)) {
    throw new Error('Unauthorized: Admin access required');
  }

  const body = await parseBody(request, createApiKeySchema);
  const supabase = await createSupabaseClient();

  // Generate a secure API key
  const keyBytes = randomBytes(32);
  const apiKey = `sk_live_${keyBytes.toString('base64url')}`;

  // Hash the key using bcrypt with cost factor 12
  // SECURITY: bcrypt with cost factor 12 provides strong protection against brute force
  // Reference: OWASP Password Storage Cheat Sheet
  const saltRounds = 12;
  const keyHash = await bcrypt.hash(apiKey, saltRounds);

  // Extract prefix for display (first 12 chars after sk_live_)
  const keyPrefix = apiKey.substring(0, 19); // "sk_live_" + first 11 chars

  // Create the API key record
  const { data: newKey, error } = await supabase
    .from('api_keys')
    .insert({
      org_id: orgId,
      created_by: userId,
      name: body.name,
      description: body.description,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: body.scopes,
      rate_limit: body.rate_limit,
      ip_whitelist: body.ip_whitelist || null,
      expires_at: body.expires_at || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;

  // Log the API key creation in audit log
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action: 'api_key.created',
    resource_type: 'api_key',
    resource_id: newKey.id,
    metadata: {
      key_name: body.name,
      scopes: body.scopes,
    },
  });

  // Return the full key only on creation
  return successResponse({
    data: {
      ...newKey,
      key: apiKey, // Only returned once!
    },
  });
}));