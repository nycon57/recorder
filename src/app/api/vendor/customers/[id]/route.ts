/**
 * Vendor Customer Unlink API — TRIB-54
 *
 * DELETE /api/vendor/customers/[id] — unlink a customer org
 *
 * Auth: requireAdmin() + must have an active white_label_config.
 * Validates that the target org is actually linked to this vendor
 * before unlinking (prevents vendors from clearing another vendor's
 * customer links).
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { getWhiteLabelConfig } from '@/lib/services/white-label';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { unlinkCustomerOrg } from '@/lib/services/vendor-customers';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// DELETE /api/vendor/customers/[id]
// ---------------------------------------------------------------------------

export const DELETE = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const { orgId } = await requireAdmin();

    // Must be a vendor
    const config = await getWhiteLabelConfig(orgId);
    if (!config) {
      return errors.forbidden();
    }

    const { id: customerOrgId } = await params;

    // Verify the customer is actually linked to THIS vendor
    const { data: custOrg, error: custError } = await supabaseAdmin
      .from('organizations')
      .select('id, vendor_org_id')
      .eq('id', customerOrgId)
      .single();

    if (custError || !custOrg) {
      return errors.notFound('Customer organization');
    }

    const cust = custOrg as { id: string; vendor_org_id: string | null };
    if (cust.vendor_org_id !== orgId) {
      return errors.notFound('Customer organization');
    }

    await unlinkCustomerOrg(customerOrgId);

    return successResponse({ unlinked: true });
  }
);
