/**
 * Department Members API Route
 *
 * Handles department membership operations:
 * - GET: List all users in department
 * - POST: Add user to department
 * - DELETE: Remove user from department
 *
 * Security:
 * - GET: Requires organization membership
 * - POST/DELETE: Requires admin or owner role
 * - All queries scoped to user's organization
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, requireAdmin, successResponse, errors } from '@/lib/utils/api';
import { parseBody } from '@/lib/utils/api';
import {
  addUserToDepartmentSchema,
  removeUserFromDepartmentSchema,
  listDepartmentMembersQuerySchema,
  DepartmentMember
} from '@/lib/validations/departments';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/organizations/departments/[id]/members
 *
 * List all users in department
 *
 * Query params:
 * - page (number, default: 1): Page number
 * - limit (number, default: 50): Items per page
 * - includeDetails (boolean, default: false): Include user details
 *
 * Returns:
 * - List of department members
 * - Optional user details (name, email, role)
 * - Pagination metadata
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

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const query = listDepartmentMembersQuerySchema.parse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    includeDetails: searchParams.get('includeDetails'),
  });

  const supabase = supabaseAdmin;

  // Verify department exists and belongs to org
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (deptError || !department) {
    return errors.notFound('Department');
  }

  // Calculate pagination
  const offset = (query.page - 1) * query.limit;

  // Build query
  let selectQuery = 'user_id, department_id, created_at';

  if (query.includeDetails) {
    selectQuery += ', users:user_id(id, email, name, role)';
  }

  const { data: members, error, count } = await supabase
    .from('user_departments')
    .select(selectQuery, { count: 'exact' })
    .eq('department_id', id)
    .range(offset, offset + query.limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/organizations/departments/[id]/members] Error fetching members:', error);
    throw new Error('Failed to fetch department members');
  }

  const formattedMembers = (members || []).map(member => {
    const base: DepartmentMember = {
      userId: member.user_id,
      departmentId: member.department_id,
      createdAt: member.created_at,
    };

    if (query.includeDetails && member.users) {
      const user = Array.isArray(member.users) ? member.users[0] : member.users;
      base.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }

    return base;
  });

  return successResponse({
    members: formattedMembers,
    pagination: {
      total: count || 0,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil((count || 0) / query.limit),
      hasMore: offset + query.limit < (count || 0),
    },
  });
});

/**
 * POST /api/organizations/departments/[id]/members
 *
 * Add user to department
 *
 * Body:
 * - userId (string, required): User ID to add
 *
 * Security: Requires admin or owner role
 * Validation:
 * - User must exist and belong to same organization
 * - Prevents duplicate memberships
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { orgId } = await requireAdmin();
  const { id } = await context.params;

  if (!id) {
    return errors.badRequest('Department ID is required');
  }

  const body = await parseBody(request, addUserToDepartmentSchema);

  const supabase = supabaseAdmin;

  // Verify department exists and belongs to org
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, org_id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (deptError || !department) {
    return errors.notFound('Department');
  }

  // Verify user exists and belongs to same organization
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, org_id, email, name')
    .eq('id', body.userId)
    .eq('org_id', orgId)
    .single();

  if (userError || !user) {
    return errors.badRequest('User not found or not in your organization');
  }

  // Check if user is already in department
  const { data: existing } = await supabase
    .from('user_departments')
    .select('user_id')
    .eq('user_id', body.userId)
    .eq('department_id', id)
    .single();

  if (existing) {
    return errors.badRequest('User is already a member of this department');
  }

  // Add user to department
  const { data: membership, error: insertError } = await supabase
    .from('user_departments')
    .insert({
      user_id: body.userId,
      department_id: id,
    })
    .select('user_id, department_id, created_at')
    .single();

  if (insertError) {
    console.error('[POST /api/organizations/departments/[id]/members] Error adding user:', insertError);
    throw new Error('Failed to add user to department');
  }

  return successResponse(
    {
      member: {
        ...membership,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      message: `User ${user.email} added to department ${department.name}`,
    },
    undefined,
    201
  );
});

/**
 * DELETE /api/organizations/departments/[id]/members
 *
 * Remove user from department
 *
 * Body:
 * - userId (string, required): User ID to remove
 *
 * Security: Requires admin or owner role
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

  const body = await parseBody(request, removeUserFromDepartmentSchema);

  const supabase = supabaseAdmin;

  // Verify department exists and belongs to org
  const { data: department, error: deptError } = await supabase
    .from('departments')
    .select('id, org_id, name')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (deptError || !department) {
    return errors.notFound('Department');
  }

  // Verify user exists and belongs to same organization
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, org_id, email')
    .eq('id', body.userId)
    .eq('org_id', orgId)
    .single();

  if (userError || !user) {
    return errors.badRequest('User not found or not in your organization');
  }

  // Check if user is in department
  const { data: existing } = await supabase
    .from('user_departments')
    .select('user_id')
    .eq('user_id', body.userId)
    .eq('department_id', id)
    .single();

  if (!existing) {
    return errors.badRequest('User is not a member of this department');
  }

  // Remove user from department
  const { error: deleteError } = await supabase
    .from('user_departments')
    .delete()
    .eq('user_id', body.userId)
    .eq('department_id', id);

  if (deleteError) {
    console.error('[DELETE /api/organizations/departments/[id]/members] Error removing user:', deleteError);
    throw new Error('Failed to remove user from department');
  }

  return successResponse({
    message: `User ${user.email} removed from department ${department.name}`,
  });
});
