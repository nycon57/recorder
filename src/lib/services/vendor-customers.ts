/**
 * Vendor-Customer Relationship Service — TRIB-54
 *
 * Manages the vendor → customer org hierarchy. A vendor org (one that
 * has an active `white_label_configs` row) can link customer orgs to
 * itself via `organizations.vendor_org_id`.
 *
 * The three-layer knowledge fusion in `/api/extension/query` uses this
 * hierarchy: vendor software docs → vendor org training docs → customer
 * org-specific docs.
 *
 * Uses supabaseAdmin (service_role) — callers must enforce auth.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { WhiteLabelConfig } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerOrg {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * List all customer orgs linked to a vendor org.
 */
export async function getCustomerOrgs(
  vendorOrgId: string
): Promise<CustomerOrg[]> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan, created_at')
    .eq('vendor_org_id', vendorOrgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[vendor-customers] getCustomerOrgs error:', error);
    throw new Error('Failed to fetch customer organizations');
  }

  return (data ?? []) as CustomerOrg[];
}

/**
 * Link an existing org as a customer of a vendor org.
 *
 * Validates:
 *  - The vendor has an active white_label_config
 *  - The customer org exists and is not deleted
 *  - The customer org is not already linked to another vendor
 *  - The customer org is not the vendor itself
 */
export async function linkCustomerOrg(
  vendorOrgId: string,
  customerOrgId: string
): Promise<void> {
  // Guard: can't link to yourself
  if (vendorOrgId === customerOrgId) {
    throw new Error('SELF_LINK');
  }

  // Guard: vendor must have an active white-label config
  const { data: wlConfig, error: wlError } = await supabaseAdmin
    .from('white_label_configs')
    .select('id')
    .eq('vendor_org_id', vendorOrgId)
    .eq('is_active', true)
    .maybeSingle();

  if (wlError) {
    console.error('[vendor-customers] linkCustomerOrg wl check error:', wlError);
    throw new Error('Failed to verify vendor config');
  }

  if (!wlConfig) {
    throw new Error('NO_VENDOR_CONFIG');
  }

  // Guard: customer org must exist
  const { data: customerOrg, error: custError } = await supabaseAdmin
    .from('organizations')
    .select('id, vendor_org_id, deleted_at')
    .eq('id', customerOrgId)
    .single();

  if (custError || !customerOrg) {
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  const cust = customerOrg as { id: string; vendor_org_id: string | null; deleted_at: string | null };

  if (cust.deleted_at) {
    throw new Error('CUSTOMER_NOT_FOUND');
  }

  // Guard: not already linked to another vendor
  if (cust.vendor_org_id && cust.vendor_org_id !== vendorOrgId) {
    throw new Error('ALREADY_LINKED');
  }

  // Guard: already linked to this vendor (idempotent)
  if (cust.vendor_org_id === vendorOrgId) {
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('organizations')
    .update({ vendor_org_id: vendorOrgId } as never)
    .eq('id', customerOrgId);

  if (updateError) {
    console.error('[vendor-customers] linkCustomerOrg update error:', updateError);
    throw new Error('Failed to link customer organization');
  }
}

/**
 * Unlink a customer org from its vendor (set vendor_org_id = NULL).
 * Idempotent — does not error if the org has no vendor.
 */
export async function unlinkCustomerOrg(
  customerOrgId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ vendor_org_id: null } as never)
    .eq('id', customerOrgId);

  if (error) {
    console.error('[vendor-customers] unlinkCustomerOrg error:', error);
    throw new Error('Failed to unlink customer organization');
  }
}

/**
 * Get the vendor org and its white-label config for a given org.
 * Returns null if the org has no vendor_org_id or the vendor has no
 * active white-label config.
 */
export async function getVendorForOrg(
  orgId: string
): Promise<{ vendorOrgId: string; whiteLabelConfig: WhiteLabelConfig } | null> {
  // Fetch the org's vendor_org_id
  const { data: orgData, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('vendor_org_id')
    .eq('id', orgId)
    .single();

  if (orgError || !orgData) {
    return null;
  }

  const org = orgData as { vendor_org_id: string | null };
  if (!org.vendor_org_id) {
    return null;
  }

  // Fetch the vendor's active white-label config
  const { data: wlData, error: wlError } = await supabaseAdmin
    .from('white_label_configs')
    .select('*')
    .eq('vendor_org_id', org.vendor_org_id)
    .eq('is_active', true)
    .maybeSingle();

  if (wlError || !wlData) {
    return null;
  }

  const config = wlData as unknown as WhiteLabelConfig;

  return {
    vendorOrgId: org.vendor_org_id,
    whiteLabelConfig: config,
  };
}
