import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  requireAdmin,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateOrganizationSchema } from '@/lib/validations/organizations';

/**
 * GET /api/organizations/current
 * Fetch current organization details
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Fetch organization details
  const { data: organization, error } = await supabaseAdmin
    .from('organizations')
    .select(
      `
      id,
      name,
      slug,
      clerk_org_id,
      plan,
      logo_url,
      primary_color,
      domain,
      features,
      max_users,
      max_storage_gb,
      billing_email,
      subscription_status,
      trial_ends_at,
      settings,
      onboarded_at,
      created_at,
      updated_at
    `
    )
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();

  if (error || !organization) {
    console.error('[GET /api/organizations/current] Error fetching organization:', error);
    return errors.notFound('Organization');
  }

  return successResponse(organization);
});

/**
 * PATCH /api/organizations/current
 * Update current organization (admin+ only)
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { orgId, role } = await requireAdmin();

  // Parse and validate request body
  const body = await parseBody(request, updateOrganizationSchema);

  // Build update object (only include provided fields)
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updates.name = body.name;
  if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
  if (body.primary_color !== undefined) updates.primary_color = body.primary_color;
  if (body.domain !== undefined) updates.domain = body.domain;
  if (body.billing_email !== undefined) updates.billing_email = body.billing_email;

  // Handle features - merge with existing
  if (body.features) {
    const { data: currentOrg } = await supabaseAdmin
      .from('organizations')
      .select('features')
      .eq('id', orgId)
      .single();

    updates.features = {
      ...(currentOrg?.features || {}),
      ...body.features,
    };
  }

  // Handle settings - merge with existing
  if (body.settings) {
    const { data: currentOrg } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    updates.settings = {
      ...(currentOrg?.settings || {}),
      ...body.settings,
    };
  }

  // Check if domain is already taken by another org
  if (body.domain) {
    const { data: existingOrg, error: domainCheckError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('domain', body.domain)
      .neq('id', orgId)
      .is('deleted_at', null)
      .single();

    if (domainCheckError && domainCheckError.code !== 'PGRST116') {
      console.error('[PATCH /api/organizations/current] Error checking domain:', domainCheckError);
      return errors.internalError();
    }

    if (existingOrg) {
      return errors.badRequest('Domain is already in use by another organization');
    }
  }

  // Update organization
  const { data: updatedOrg, error: updateError } = await supabaseAdmin
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .is('deleted_at', null)
    .select(
      `
      id,
      name,
      slug,
      clerk_org_id,
      plan,
      logo_url,
      primary_color,
      domain,
      features,
      max_users,
      max_storage_gb,
      billing_email,
      subscription_status,
      trial_ends_at,
      settings,
      onboarded_at,
      created_at,
      updated_at
    `
    )
    .single();

  if (updateError || !updatedOrg) {
    console.error('[PATCH /api/organizations/current] Error updating organization:', updateError);
    return errors.internalError();
  }

  return successResponse(updatedOrg);
});
