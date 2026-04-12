/**
 * Vendor Customer Management API — TRIB-54
 *
 * Manage the customer orgs linked to a vendor org.
 *
 * GET  /api/vendor/customers — list customer orgs
 * POST /api/vendor/customers — link an existing org as a customer
 *
 * Auth: requireAdmin() + must have an active white_label_config.
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
  getCustomerOrgs,
  linkCustomerOrg,
} from '@/lib/services/vendor-customers';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const linkCustomerSchema = z.object({
  customerOrgId: z.string().uuid('customerOrgId must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify the caller's org is a vendor with an active white-label config. */
async function requireVendor() {
  const ctx = await requireAdmin();

  const config = await getWhiteLabelConfig(ctx.orgId);
  if (!config) {
    throw new Error('Vendor config required');
  }

  return { ...ctx, config };
}

// ---------------------------------------------------------------------------
// GET /api/vendor/customers
// ---------------------------------------------------------------------------

export const GET = apiHandler(async () => {
  const { orgId } = await requireVendor();

  const customers = await getCustomerOrgs(orgId);
  return successResponse(customers);
});

// ---------------------------------------------------------------------------
// POST /api/vendor/customers
// ---------------------------------------------------------------------------

export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireVendor();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }

  const parsed = linkCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return errors.validationError(parsed.error.issues);
  }

  try {
    await linkCustomerOrg(orgId, parsed.data.customerOrgId);
    return successResponse({ linked: true }, undefined, 201);
  } catch (err: unknown) {
    if (err instanceof Error) {
      switch (err.message) {
        case 'SELF_LINK':
          return errors.badRequest('Cannot link a vendor org to itself');
        case 'NO_VENDOR_CONFIG':
          return errors.badRequest(
            'Vendor must have an active white-label config to link customers'
          );
        case 'CUSTOMER_NOT_FOUND':
          return errors.notFound('Customer organization');
        case 'ALREADY_LINKED':
          return errors.badRequest(
            'This organization is already linked to another vendor'
          );
      }
    }
    throw err;
  }
});
