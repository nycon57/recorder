/**
 * Vendor White-Label Config API
 *
 * CRUD endpoints for managing a vendor org's white-label configuration.
 * Auth: requireAdmin() — only org owners/admins can manage configs.
 *
 * GET    — fetch config for the authenticated user's org
 * POST   — create a new config (409 if one already exists)
 * PUT    — partial update of existing config (merges JSONB fields)
 * DELETE — soft-delete (sets is_active = false)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import {
  getWhiteLabelConfig,
  createWhiteLabelConfig,
  updateWhiteLabelConfig,
  deactivateWhiteLabelConfig,
} from '@/lib/services/white-label';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const brandingSchema = z.object({
  logo_url: z.string().url().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color (e.g. #ff5500)')
    .optional(),
  secondary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color (e.g. #ff5500)')
    .optional(),
  product_name: z.string().max(100).optional(),
  support_email: z.string().email().optional(),
});

const voiceConfigSchema = z.object({
  elevenlabs_voice_id: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
});

const createConfigSchema = z.object({
  branding: brandingSchema.optional(),
  voice_config: voiceConfigSchema.optional(),
  knowledge_scope: z.array(z.string()).nullable().optional(),
  custom_domain: z.string().max(253).nullable().optional(),
});

const updateConfigSchema = z.object({
  branding: brandingSchema.optional(),
  voice_config: voiceConfigSchema.optional(),
  knowledge_scope: z.array(z.string()).nullable().optional(),
  custom_domain: z.string().max(253).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/vendor/config
// ---------------------------------------------------------------------------

export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.notFound('White-label config');
  }

  return successResponse(config);
});

// ---------------------------------------------------------------------------
// POST /api/vendor/config
// ---------------------------------------------------------------------------

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const parsed = createConfigSchema.safeParse(body);
  if (!parsed.success) {
    return errors.validationError(parsed.error.issues);
  }

  try {
    const config = await createWhiteLabelConfig(orgId, parsed.data);
    return successResponse(config, undefined, 201);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONFLICT') {
      return errors.badRequest(
        'White-label config already exists for this organization. Use PUT to update.'
      );
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// PUT /api/vendor/config
// ---------------------------------------------------------------------------

export const PUT = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return errors.validationError(parsed.error.issues);
  }

  // For JSONB fields, merge with existing config so callers can send partials
  const existing = await getWhiteLabelConfig(orgId);
  if (!existing) {
    return errors.notFound('White-label config');
  }

  const mergedInput = { ...parsed.data };
  if (parsed.data.branding) {
    mergedInput.branding = { ...existing.branding, ...parsed.data.branding };
  }
  if (parsed.data.voice_config) {
    mergedInput.voice_config = {
      ...existing.voice_config,
      ...parsed.data.voice_config,
    };
  }

  try {
    const config = await updateWhiteLabelConfig(orgId, mergedInput);
    return successResponse(config);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return errors.notFound('White-label config');
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/vendor/config
// ---------------------------------------------------------------------------

export const DELETE = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const existing = await getWhiteLabelConfig(orgId);
  if (!existing) {
    return errors.notFound('White-label config');
  }

  await deactivateWhiteLabelConfig(orgId);

  return successResponse({ deactivated: true });
});
