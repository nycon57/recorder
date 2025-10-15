import { z } from 'zod';

/**
 * Department validation schemas
 */

// Create department schema
export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(255),
  description: z.string().max(2000).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  parentId: z.string().uuid().nullable().optional(),
  defaultVisibility: z
    .enum(['private', 'department', 'org', 'public'])
    .optional()
    .default('department'),
});

// Update department schema
export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  defaultVisibility: z
    .enum(['private', 'department', 'org', 'public'])
    .optional(),
});

// Delete department schema
export const deleteDepartmentSchema = z.object({
  reassignUsersTo: z.string().uuid().nullable().optional(),
});

// Add user to department schema
export const addUserToDepartmentSchema = z.object({
  userId: z.string().uuid(),
});

// Remove user from department schema
export const removeUserFromDepartmentSchema = z.object({
  userId: z.string().uuid(),
});

// List departments query schema
export const listDepartmentsQuerySchema = z.object({
  includeTree: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
  includeMembers: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
});

// List department members query schema
export const listDepartmentMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  includeDetails: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
});

/**
 * Response types
 */

export type Department = {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  slug: string;
  defaultVisibility: 'private' | 'department' | 'org' | 'public';
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  memberCount?: number;
  path?: string[];
  children?: Department[];
};

export type DepartmentMember = {
  userId: string;
  departmentId: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};
