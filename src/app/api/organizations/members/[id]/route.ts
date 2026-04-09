import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateMemberSchema } from '@/lib/validations/organizations';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/organizations/members/[id]
 * Get member details (admin+ only)
 */
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { orgId } = await requireAdmin();
  const memberId = context.params.id;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(memberId)) {
    return errors.badRequest('Invalid member ID format');
  }

  // Fetch member details
  const { data: member, error } = await supabaseAdmin
    .from('users')
    .select(
      `
      id,
      clerk_id,
      email,
      name,
      avatar_url,
      role,
      title,
      department_id,
      bio,
      phone,
      timezone,
      status,
      last_login_at,
      last_active_at,
      login_count,
      notification_preferences,
      ui_preferences,
      onboarded_at,
      invited_by,
      created_at,
      updated_at
    `
    )
    .eq('id', memberId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (error || !member) {
    console.error('[GET /api/organizations/members/[id]] Error fetching member:', error);
    return errors.notFound('Member');
  }

  return successResponse(member);
});

/**
 * PATCH /api/organizations/members/[id]
 * Update member details (admin+ only)
 * Role hierarchy validation: Only owner can change owner role, admin cannot promote to owner
 */
export const PATCH = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { orgId, role: requesterRole, userId: requesterId } = await requireAdmin();
  const memberId = context.params.id;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(memberId)) {
    return errors.badRequest('Invalid member ID format');
  }

  // Parse and validate request body
  const bodyData = await parseBody<z.infer<typeof updateMemberSchema>>(request, updateMemberSchema);

  // Fetch current member details
  const { data: currentMember, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, role, status, org_id')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !currentMember) {
    console.error('[PATCH /api/organizations/members/[id]] Error fetching member:', fetchError);
    return errors.notFound('Member');
  }

  // Prevent self-modification of role
  if (requesterId === memberId && bodyData.role) {
    return errors.forbidden('You cannot change your own role');
  }

  // Role hierarchy validation
  if (bodyData.role) {
    // Only owner can change someone's role to owner
    if (bodyData.role === 'owner' && requesterRole !== 'owner') {
      return errors.forbidden('Only organization owners can assign the owner role');
    }

    // Only owner can modify another owner's role
    if (currentMember.role === 'owner' && requesterRole !== 'owner') {
      return errors.forbidden('Only organization owners can modify owner roles');
    }

    // Ensure at least one owner remains
    if (currentMember.role === 'owner' && bodyData.role !== 'owner') {
      const { count: ownerCount, error: countError } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active')
        .is('deleted_at', null);

      if (countError) {
        console.error('[PATCH /api/organizations/members/[id]] Error counting owners:', countError);
        return errors.internalError();
      }

      if (ownerCount && ownerCount <= 1) {
        return errors.badRequest('Cannot change role: At least one owner must remain');
      }
    }
  }

  // Build update object
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (bodyData.role !== undefined) updates.role = bodyData.role;
  if (bodyData.status !== undefined) updates.status = bodyData.status;
  if (bodyData.title !== undefined) updates.title = bodyData.title;
  if (bodyData.department_ids !== undefined && bodyData.department_ids.length > 0) {
    // For now, we'll just store the first department
    // In the future, you might want a junction table for multiple departments
    updates.department_id = bodyData.department_ids[0];
  }

  // Update member
  const { data: updatedMember, error: updateError } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', memberId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .select(
      `
      id,
      clerk_id,
      email,
      name,
      avatar_url,
      role,
      title,
      department_id,
      bio,
      phone,
      timezone,
      status,
      last_login_at,
      last_active_at,
      login_count,
      onboarded_at,
      created_at,
      updated_at
    `
    )
    .single();

  if (updateError || !updatedMember) {
    console.error('[PATCH /api/organizations/members/[id]] Error updating member:', updateError);
    return errors.internalError();
  }

  return successResponse(updatedMember);
});

/**
 * DELETE /api/organizations/members/[id]
 * Remove member from organization (soft delete, admin+ only)
 */
export const DELETE = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { orgId, role: requesterRole, userId: requesterId } = await requireAdmin();
  const memberId = context.params.id;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(memberId)) {
    return errors.badRequest('Invalid member ID format');
  }

  // Prevent self-deletion
  if (requesterId === memberId) {
    return errors.forbidden('You cannot remove yourself from the organization');
  }

  // Fetch current member details
  const { data: currentMember, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, role, status')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !currentMember) {
    console.error('[DELETE /api/organizations/members/[id]] Error fetching member:', fetchError);
    return errors.notFound('Member');
  }

  // Only owner can remove another owner
  if (currentMember.role === 'owner' && requesterRole !== 'owner') {
    return errors.forbidden('Only organization owners can remove other owners');
  }

  // Ensure at least one owner remains
  if (currentMember.role === 'owner') {
    const { count: ownerCount, error: countError } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .is('deleted_at', null);

    if (countError) {
      console.error('[DELETE /api/organizations/members/[id]] Error counting owners:', countError);
      return errors.internalError();
    }

    if (ownerCount && ownerCount <= 1) {
      return errors.badRequest('Cannot remove member: At least one owner must remain');
    }
  }

  // Soft delete the member
  const { error: deleteError } = await supabaseAdmin
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'deleted',
    })
    .eq('id', memberId)
    .eq('org_id', orgId);

  if (deleteError) {
    console.error('[DELETE /api/organizations/members/[id]] Error deleting member:', deleteError);
    return errors.internalError();
  }

  // TODO: Additional cleanup
  // - Revoke all user sessions
  // - Notify user via email
  // - Transfer ownership of recordings (if needed)
  // - Create audit log entry

  return successResponse({
    success: true,
    message: 'Member removed successfully',
  });
});
