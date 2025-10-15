/**
 * Department Detail API Route
 *
 * Handles individual department operations:
 * - GET: Get department details with member count
 * - PATCH: Update department (admin+ only)
 * - DELETE: Delete department (admin+ only)
 *
 * Security:
 * - GET: Requires organization membership
 * - PATCH/DELETE: Requires admin or owner role
 * - All queries scoped to user's organization via RLS
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, requireAdmin, successResponse, errors } from '@/lib/utils/api';
import { parseBody } from '@/lib/utils/api';
import {
  updateDepartmentSchema,
  deleteDepartmentSchema,
  Department
} from '@/lib/validations/departments';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/organizations/departments/[id]
 *
 * Get department details with member count and path
 *
 * Returns:
 * - Department details
 * - Member count
 * - Path from root to this department
 */
export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { orgId } = await requireOrg();
  const { id } = await context.params;

  if (!id) {
    return errors.badRequest('Department ID is required');
  }

  const supabase = supabaseAdmin;

  // Fetch department
  const { data: department, error } = await supabase
    .from('departments')
    .select(`
      id,
      org_id,
      parent_id,
      name,
      description,
      slug,
      default_visibility,
      created_at,
      updated_at,
      created_by
    `)
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !department) {
    return errors.notFound('Department');
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from('user_departments')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', id);

  // Get department path using helper function
  const { data: pathData } = await supabase
    .rpc('get_department_path', { dept_id: id });

  return successResponse({
    department: {
      ...department,
      memberCount: memberCount || 0,
      path: pathData || [],
    } as Department,
  });
});

/**
 * PATCH /api/organizations/departments/[id]
 *
 * Update department
 *
 * Body:
 * - name (string, optional): Department name
 * - description (string, optional): Department description
 * - parentId (string, optional): Parent department ID
 * - defaultVisibility (enum, optional): Default content visibility
 *
 * Security: Requires admin or owner role
 * Validation: Prevents circular references
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { orgId, userId } = await requireAdmin();
  const { id } = await context.params;

  if (!id) {
    return errors.badRequest('Department ID is required');
  }

  const body = await parseBody(request, updateDepartmentSchema);

  const supabase = supabaseAdmin;

  // Verify department exists and belongs to org
  const { data: department, error: fetchError } = await supabase
    .from('departments')
    .select('id, org_id, parent_id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !department) {
    return errors.notFound('Department');
  }

  // Validate parent department if being changed
  if (body.parentId !== undefined) {
    // Prevent setting self as parent
    if (body.parentId === id) {
      return errors.badRequest('Department cannot be its own parent');
    }

    // Validate parent exists if not null
    if (body.parentId) {
      const { data: parentDept, error: parentError } = await supabase
        .from('departments')
        .select('id, org_id')
        .eq('id', body.parentId)
        .eq('org_id', orgId)
        .single();

      if (parentError || !parentDept) {
        return errors.badRequest('Parent department not found or not in your organization');
      }

      // Prevent circular references using is_descendant_of function
      const { data: isDescendant } = await supabase
        .rpc('is_descendant_of', {
          child_id: body.parentId,
          ancestor_id: id,
        });

      if (isDescendant) {
        return errors.badRequest('Cannot set parent to a descendant department (would create circular reference)');
      }
    }
  }

  // Update department
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.parentId !== undefined) updateData.parent_id = body.parentId;
  if (body.defaultVisibility !== undefined) updateData.default_visibility = body.defaultVisibility;

  const { data: updatedDepartment, error: updateError } = await supabase
    .from('departments')
    .update(updateData)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateError) {
    console.error('[PATCH /api/organizations/departments/[id]] Error updating department:', updateError);
    throw new Error('Failed to update department');
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from('user_departments')
    .select('*', { count: 'exact', head: true })
    .eq('department_id', id);

  return successResponse({
    department: {
      ...updatedDepartment,
      memberCount: memberCount || 0,
    },
  });
});

/**
 * DELETE /api/organizations/departments/[id]
 *
 * Delete department
 *
 * Query params:
 * - reassignUsersTo (string, optional): Department ID to reassign users to
 *
 * Security: Requires admin or owner role
 * Validation:
 * - Prevents deletion if department has children (unless reassigned)
 * - Optionally reassigns users to another department
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { orgId } = await requireAdmin();
  const { id } = await context.params;

  if (!id) {
    return errors.badRequest('Department ID is required');
  }

  const supabase = supabaseAdmin;

  // Verify department exists and belongs to org
  const { data: department, error: fetchError } = await supabase
    .from('departments')
    .select('id, org_id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !department) {
    return errors.notFound('Department');
  }

  // Check for child departments
  const { data: children, error: childError } = await supabase
    .from('departments')
    .select('id')
    .eq('parent_id', id);

  if (childError) {
    console.error('[DELETE /api/organizations/departments/[id]] Error checking children:', childError);
    throw new Error('Failed to check department children');
  }

  if (children && children.length > 0) {
    return errors.badRequest(
      `Cannot delete department with ${children.length} child department(s). Please delete or reassign child departments first.`,
      { childCount: children.length }
    );
  }

  // Parse query params for user reassignment
  const { searchParams } = new URL(request.url);
  const reassignUsersTo = searchParams.get('reassignUsersTo');

  // If reassignment requested, validate target department
  if (reassignUsersTo) {
    const { data: targetDept, error: targetError } = await supabase
      .from('departments')
      .select('id, org_id')
      .eq('id', reassignUsersTo)
      .eq('org_id', orgId)
      .single();

    if (targetError || !targetDept) {
      return errors.badRequest('Target department for reassignment not found or not in your organization');
    }

    // Reassign users
    const { error: reassignError } = await supabase
      .from('user_departments')
      .update({ department_id: reassignUsersTo })
      .eq('department_id', id);

    if (reassignError) {
      console.error('[DELETE /api/organizations/departments/[id]] Error reassigning users:', reassignError);
      throw new Error('Failed to reassign users');
    }
  } else {
    // Remove all user associations
    const { error: deleteUsersError } = await supabase
      .from('user_departments')
      .delete()
      .eq('department_id', id);

    if (deleteUsersError) {
      console.error('[DELETE /api/organizations/departments/[id]] Error removing users:', deleteUsersError);
      throw new Error('Failed to remove department users');
    }
  }

  // Delete department
  const { error: deleteError } = await supabase
    .from('departments')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (deleteError) {
    console.error('[DELETE /api/organizations/departments/[id]] Error deleting department:', deleteError);
    throw new Error('Failed to delete department');
  }

  return successResponse({
    message: 'Department deleted successfully',
    reassignedUsers: reassignUsersTo ? true : false,
  });
});
