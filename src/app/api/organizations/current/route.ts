import { NextRequest } from 'next/server';
import { z } from 'zod';

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
  const { orgId } = await requireAdmin();

  // Parse and validate request body
  const bodyData = await parseBody<z.infer<typeof updateOrganizationSchema>>(request, updateOrganizationSchema);

  // Build update object (only include provided fields)
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (bodyData.name !== undefined) updates.name = bodyData.name;
  if (bodyData.logo_url !== undefined) updates.logo_url = bodyData.logo_url;
  if (bodyData.primary_color !== undefined) updates.primary_color = bodyData.primary_color;
  if (bodyData.domain !== undefined) updates.domain = bodyData.domain;
  if (bodyData.billing_email !== undefined) updates.billing_email = bodyData.billing_email;

  // Handle features - merge with existing
  if (bodyData.features) {
    const { data: currentOrg } = await supabaseAdmin
      .from('organizations')
      .select('features')
      .eq('id', orgId)
      .single();

    updates.features = {
      ...(currentOrg?.features || {}),
      ...bodyData.features,
    };
  }

  // Handle settings - merge with existing
  if (bodyData.settings) {
    const { data: currentOrg } = await supabaseAdmin
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    updates.settings = {
      ...(currentOrg?.settings || {}),
      ...bodyData.settings,
    };
  }

  // Check if domain is already taken by another org
  if (bodyData.domain) {
    const { data: existingOrg, error: domainCheckError } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('domain', bodyData.domain)
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
