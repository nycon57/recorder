/**
 * Shared Zod schema for vendor source ingest operations.
 * Imported by both the client form (react-hook-form zodResolver) and
 * the server route handler (POST /api/admin/vendor-sources/ingest).
 *
 * TRIB-149
 */

import { z } from 'zod';

export const vendorIngestInputSchema = z.object({
  app: z
    .string()
    .min(1, 'App identifier is required')
    .max(64, 'App identifier must be 64 characters or fewer')
    .regex(/^[a-z0-9_-]+$/, 'App identifier must be lowercase alphanumeric with hyphens/underscores'),
  url: z
    .string()
    .min(1, 'Source URL is required')
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('https://'), 'URL must use https protocol'),
  maxPages: z
    .number()
    .int('Max pages must be a whole number')
    .min(1, 'Max pages must be at least 1')
    .max(500, 'Max pages cannot exceed 500')
    .optional(),
  force: z.boolean().optional(),
});

export type VendorIngestInput = z.infer<typeof vendorIngestInputSchema>;

/** Re-sync existing source schema (sourceId path) */
export const vendorResyncInputSchema = z.object({
  sourceId: z.string().uuid('sourceId must be a valid UUID'),
  force: z.boolean().optional(),
});

export type VendorResyncInput = z.infer<typeof vendorResyncInputSchema>;
