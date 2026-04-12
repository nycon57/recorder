/**
 * Vendor API Key — Single Key Operations (TRIB-56)
 *
 * DELETE /api/vendor/api-keys/[id]        — revoke a key
 * POST   /api/vendor/api-keys/[id]/rotate — handled below via query param
 *
 * Auth: session-only (requireAdmin).
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { revokeApiKey, rotateApiKey } from '@/lib/services/vendor-api-keys';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// DELETE /api/vendor/api-keys/[id] — revoke a key
// ---------------------------------------------------------------------------

export const DELETE = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireAdmin();
    const { id: keyId } = await params;

    if (!keyId) {
      return errors.badRequest('Key ID is required');
    }

    await revokeApiKey(keyId, orgId);

    return successResponse({ revoked: true });
  }
);

// ---------------------------------------------------------------------------
// POST /api/vendor/api-keys/[id] — rotate a key (revoke old + create new)
// ---------------------------------------------------------------------------

export const POST = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireAdmin();
    const { id: keyId } = await params;

    if (!keyId) {
      return errors.badRequest('Key ID is required');
    }

    try {
      const { key, record } = await rotateApiKey(keyId, orgId);

      return successResponse(
        {
          key,
          id: record.id,
          name: record.name,
          key_prefix: record.key_prefix,
          scopes: record.scopes,
          rate_limit_rpm: record.rate_limit_rpm,
          created_at: record.created_at,
        },
        undefined,
        201
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'API key not found') {
        return errors.notFound('API key');
      }
      throw err;
    }
  }
);
