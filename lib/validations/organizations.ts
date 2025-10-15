import { z } from 'zod';

/**
 * Organization Management Validation Schemas
 * Phase: Organization Management API
 */

// Update organization schema
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logo_url: z.string().url().optional().nullable(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #3b82f6)')
    .optional(),
  domain: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Must be a valid domain')
    .optional()
    .nullable(),
  features: z.record(z.boolean()).optional(),
  billing_email: z.string().email().optional().nullable(),
  settings: z.record(z.any()).optional(),
});

// List members query parameters
export const listMembersQuerySchema = z.object({
  role: z.enum(['owner', 'admin', 'contributor', 'reader']).optional(),
  department_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'active', 'suspended', 'deleted']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// Invite member schema
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'contributor', 'reader']),
  department_ids: z.array(z.string().uuid()).optional(),
  custom_message: z.string().max(500).optional(),
});

// Update member schema
export const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'contributor', 'reader']).optional(),
  department_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  title: z.string().max(100).optional().nullable(),
});

// Organization stats query schema
export const organizationStatsQuerySchema = z.object({
  include_quotas: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional()
    .default(true),
  include_usage: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional()
    .default(true),
});
