import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  rateLimit,
  RateLimitTier,
  extractUserIdFromAuth,
} from '@/lib/middleware/rate-limit';

/**
 * DELETE /api/organizations/mcp-keys/[id] — Revoke an MCP API key
 *
 * Sets is_active to false so any connection using the key
 * receives "unauthorized" on the next request.
 */
export const DELETE = rateLimit(
  RateLimitTier.API,
  extractUserIdFromAuth,
)(
  apiHandler(
    async (
      _request: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) => {
      const { orgId, key, fetchError } = await Promise.all([
        requireAdmin(),
        params,
      ]).then(([{ orgId }, { id }]) =>
        supabaseAdmin
          .from('mcp_api_keys')
          .select('id')
          .eq('id', id)
          .eq('org_id', orgId)
          .single()
          .then(({ data: key, error: fetchError }) => ({
            orgId,
            key,
            fetchError,
          })),
      );

      if (fetchError || !key) {
        return errors.notFound('MCP API key');
      }

      const { error: updateError } = await supabaseAdmin
        .from('mcp_api_keys')
        .update({ is_active: false })
        .eq('id', key.id)
        .eq('org_id', orgId);

      if (updateError) throw updateError;

      return successResponse({ message: 'MCP API key revoked' });
    },
  ),
);
