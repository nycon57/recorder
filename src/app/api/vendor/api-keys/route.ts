/**
 * Vendor API Key Management (TRIB-56)
 *
 * GET  /api/vendor/api-keys       — list keys for the authenticated vendor org
 * POST /api/vendor/api-keys       — generate a new key
 *
 * Auth: session-only (requireAdmin). Vendors manage keys via the dashboard,
 * not via API keys themselves.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { getWhiteLabelConfig } from '@/lib/services/white-label';
import {
  generateApiKey,
  listApiKeys,
} from '@/lib/services/vendor-api-keys';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(z.enum(['query', 'context', 'tts']))
    .min(1)
    .optional()
    .default(['query']),
  white_label_config_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/vendor/api-keys
// ---------------------------------------------------------------------------

export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const keys = await listApiKeys(orgId);

  return successResponse(keys);
});

// ---------------------------------------------------------------------------
// POST /api/vendor/api-keys
// ---------------------------------------------------------------------------

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return errors.validationError(parsed.error.issues);
  }

  // Resolve the white-label config. If caller didn't specify one,
  // use the org's default (there's at most one per org).
  let configId = parsed.data.white_label_config_id;
  if (!configId) {
    const config = await getWhiteLabelConfig(orgId);
    if (!config) {
      return errors.badRequest(
        'No white-label config found for this organization. Create one first via POST /api/vendor/config.'
      );
    }
    configId = config.id;
  }

  const { key, record } = await generateApiKey(
    orgId,
    configId,
    parsed.data.name,
    parsed.data.scopes
  );

  // Return the full plaintext key ONCE — it's never retrievable again.
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
});
