/**
 * Vendor Domain Verification API (TRIB-58)
 *
 * POST   /api/vendor/domain — Initiate domain verification (generates TXT record)
 * GET    /api/vendor/domain — Check DNS verification status
 * PUT    /api/vendor/domain — Confirm verification and set custom_domain
 * DELETE /api/vendor/domain — Remove custom domain
 *
 * Auth: session-only, admin role, must have white_label_config.
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhiteLabelConfig } from '@/lib/services/white-label';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const domainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .max(253)
    .regex(
      /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
      'Must be a valid domain (e.g. training.acme.com)'
    ),
});

// ---------------------------------------------------------------------------
// DNS lookup helper
// ---------------------------------------------------------------------------

/**
 * Check if a TXT record matching the expected value exists for the domain.
 * Uses the `dns` module (lazy import for edge-compat safety).
 */
async function checkDnsTxtRecord(
  domain: string,
  expectedValue: string
): Promise<boolean> {
  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const resolveTxt = promisify(dns.resolveTxt);

    // TXT records for _tribora-verify.<domain>
    const subdomain = `_tribora-verify.${domain}`;
    const records = await resolveTxt(subdomain);

    // records is string[][] — each entry is an array of strings that may be
    // chunked. Join each record's chunks and check for our value.
    return records.some((chunks) => chunks.join('') === expectedValue);
  } catch (err: unknown) {
    // ENOTFOUND / ENODATA are expected when record doesn't exist yet
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return false;
    }
    console.warn('[vendor/domain] DNS lookup error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/vendor/domain — Initiate verification
// ---------------------------------------------------------------------------

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.notFound('White-label config');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const parsed = domainSchema.safeParse(body);
  if (!parsed.success) {
    return errors.validationError(parsed.error.issues);
  }

  const { domain } = parsed.data;

  // Check that this domain isn't already claimed by another config
  const { data: existing } = await supabaseAdmin
    .from('white_label_configs')
    .select('id')
    .eq('custom_domain', domain)
    .eq('is_active', true)
    .neq('id', config.id)
    .maybeSingle();

  if (existing) {
    return errors.badRequest('This domain is already claimed by another vendor');
  }

  // Generate a verification token
  const token = `tribora-verify=${crypto.randomBytes(16).toString('hex')}`;

  // Store the token and pending domain
  const { error: updateError } = await supabaseAdmin
    .from('white_label_configs')
    .update({
      custom_domain: domain,
      domain_verification_token: token,
      domain_verified: false,
      domain_verified_at: null,
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('[vendor/domain] POST update error:', updateError);
    return errors.internalError();
  }

  return successResponse(
    {
      domain,
      verified: false,
      txtRecord: {
        host: `_tribora-verify.${domain}`,
        type: 'TXT',
        value: token,
      },
    },
    undefined,
    201
  );
});

// ---------------------------------------------------------------------------
// GET /api/vendor/domain — Check verification status
// ---------------------------------------------------------------------------

export const GET = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.notFound('White-label config');
  }

  if (!config.custom_domain) {
    return successResponse({
      domain: null,
      verified: false,
      txtRecord: null,
    });
  }

  // If already verified, return status
  if (config.domain_verified) {
    return successResponse({
      domain: config.custom_domain,
      verified: true,
      verifiedAt: config.domain_verified_at,
      txtRecord: null,
    });
  }

  // Check DNS for the TXT record
  const dnsVerified = config.domain_verification_token
    ? await checkDnsTxtRecord(
        config.custom_domain,
        config.domain_verification_token
      )
    : false;

  return successResponse({
    domain: config.custom_domain,
    verified: false,
    dnsRecordFound: dnsVerified,
    txtRecord: config.domain_verification_token
      ? {
          host: `_tribora-verify.${config.custom_domain}`,
          type: 'TXT',
          value: config.domain_verification_token,
        }
      : null,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/vendor/domain — Confirm verification
// ---------------------------------------------------------------------------

export const PUT = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.notFound('White-label config');
  }

  if (!config.custom_domain || !config.domain_verification_token) {
    return errors.badRequest(
      'No domain verification pending. Start verification with POST first.'
    );
  }

  if (config.domain_verified) {
    return successResponse({
      domain: config.custom_domain,
      verified: true,
      verifiedAt: config.domain_verified_at,
    });
  }

  // Verify DNS
  const dnsVerified = await checkDnsTxtRecord(
    config.custom_domain,
    config.domain_verification_token
  );

  if (!dnsVerified) {
    return errors.badRequest(
      'DNS verification failed. Ensure the TXT record is set for ' +
        `_tribora-verify.${config.custom_domain} and try again. ` +
        'DNS changes may take up to 48 hours to propagate.'
    );
  }

  // Mark as verified
  const { error: updateError } = await supabaseAdmin
    .from('white_label_configs')
    .update({
      domain_verified: true,
      domain_verified_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('[vendor/domain] PUT update error:', updateError);
    return errors.internalError();
  }

  return successResponse({
    domain: config.custom_domain,
    verified: true,
    verifiedAt: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/vendor/domain — Remove custom domain
// ---------------------------------------------------------------------------

export const DELETE = apiHandler(async () => {
  const { orgId } = await requireAdmin();

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    return errors.notFound('White-label config');
  }

  if (!config.custom_domain) {
    return successResponse({ removed: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from('white_label_configs')
    .update({
      custom_domain: null,
      domain_verification_token: null,
      domain_verified: false,
      domain_verified_at: null,
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('[vendor/domain] DELETE update error:', updateError);
    return errors.internalError();
  }

  return successResponse({ removed: true });
});
