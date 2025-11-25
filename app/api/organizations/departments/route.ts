/**
 * Departments API Route
 *
 * Handles department management at organization level:
 * - GET: List all departments in tree structure
 * - POST: Create new department (admin+ only)
 *
 * Security:
 * - GET: Requires organization membership (any role)
 * - POST: Requires admin or owner role
 * - All queries scoped to user's organization via RLS
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, requireAdmin, successResponse, errors , parseBody } from '@/lib/utils/api';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  Department
} from '@/lib/validations/departments';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/organizations/departments
 *
 * List all departments with optional tree structure
 *
 * Query params:
 * - includeTree (boolean): Return hierarchical tree structure
 * - includeMembers (boolean): Include member count per department
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const query = listDepartmentsQuerySchema.parse({
    includeTree: searchParams.get('includeTree'),
    includeMembers: searchParams.get('includeMembers'),
  });

  const supabase = supabaseAdmin;

  // Build base query
  const selectQuery = `
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
  `;

  // Add member count if requested
  if (query.includeMembers) {
    // We'll fetch member counts separately for performance
  }

  const { data: departments, error } = await supabase
    .from('departments')
    .select(selectQuery)
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[GET /api/organizations/departments] Error fetching departments:', error);
    throw new Error('Failed to fetch departments');
  }

  let result: Department[] = (departments || []).map((dept: any) => ({
    id: dept.id,
    orgId: dept.org_id,
    parentId: dept.parent_id,
    name: dept.name,
    description: dept.description,
    slug: dept.slug,
    defaultVisibility: dept.default_visibility as 'private' | 'department' | 'org' | 'public',
    createdAt: dept.created_at,
    updatedAt: dept.updated_at,
    createdBy: dept.created_by,
  }));

  // Add member counts if requested
  if (query.includeMembers && result.length > 0) {
    const { data: memberCounts } = await supabase
      .from('user_departments')
      .select('department_id')
      .in('department_id', result.map(d => d.id));

    if (memberCounts) {
      const countMap = memberCounts.reduce((acc, { department_id }) => {
        acc[department_id] = (acc[department_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      result = result.map(dept => ({
        ...dept,
        memberCount: countMap[dept.id] || 0,
      }));
    }
  }

  // Build tree structure if requested
  if (query.includeTree) {
    result = buildDepartmentTree(result);
  }

  return successResponse({
    departments: result,
    total: result.length,
  });
});

/**
 * POST /api/organizations/departments
 *
 * Create new department
 *
 * Body:
 * - name (string, required): Department name
 * - description (string, optional): Department description
 * - slug (string, optional): URL-friendly identifier (auto-generated if not provided)
 * - parentId (string, optional): Parent department ID for hierarchy
 * - defaultVisibility (enum, optional): Default content visibility
 *
 * Security: Requires admin or owner role
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireAdmin();

  const bodyData = await parseBody<z.infer<typeof createDepartmentSchema>>(request, createDepartmentSchema);

  const supabase = supabaseAdmin;

  // Generate slug if not provided
  const slug = bodyData.slug || generateSlug(bodyData.name);

  // Validate parent department exists if provided
  if (bodyData.parentId) {
    const { data: parentDept, error: parentError } = await supabase
      .from('departments')
      .select('id, org_id')
      .eq('id', bodyData.parentId)
      .eq('org_id', orgId)
      .single();

    if (parentError || !parentDept) {
      return errors.badRequest('Parent department not found or not in your organization');
    }
  }

  // Check slug uniqueness within organization
  const { data: existing } = await supabase
    .from('departments')
    .select('id')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single();

  if (existing) {
    return errors.badRequest(`Department with slug "${slug}" already exists in your organization`);
  }

  // Create department
  const { data: department, error } = await supabase
    .from('departments')
    .insert({
      org_id: orgId,
      name: bodyData.name,
      description: bodyData.description,
      slug,
      parent_id: bodyData.parentId || null,
      default_visibility: bodyData.defaultVisibility || 'department',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/organizations/departments] Error creating department:', error);
    throw new Error('Failed to create department');
  }

  const formattedDepartment: Department = {
    id: department.id,
    orgId: department.org_id,
    parentId: department.parent_id,
    name: department.name,
    description: department.description,
    slug: department.slug,
    defaultVisibility: department.default_visibility as 'private' | 'department' | 'org' | 'public',
    createdAt: department.created_at,
    updatedAt: department.updated_at,
    createdBy: department.created_by,
    memberCount: 0,
  };

  return successResponse(
    {
      department: formattedDepartment,
    },
    undefined,
    201
  );
});

/**
 * Helper: Build hierarchical tree structure from flat list
 */
function buildDepartmentTree(departments: Department[]): Department[] {
  const deptMap = new Map<string, Department>();
  const roots: Department[] = [];

  // Initialize all departments with empty children array
  departments.forEach(dept => {
    deptMap.set(dept.id, { ...dept, children: [] });
  });

  // Build tree structure
  departments.forEach(dept => {
    const node = deptMap.get(dept.id)!;

    if (dept.parentId) {
      const parent = deptMap.get(dept.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Helper: Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}
