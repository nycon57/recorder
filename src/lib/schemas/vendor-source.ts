/**
 * Shared Zod schema for vendor source ingest operations.
 * Imported by both the client form (react-hook-form zodResolver) and
 * the server route handler (POST /api/admin/vendor-sources/ingest).
 *
 * TRIB-149
 */

import { z } from 'zod';

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const optionalHttpsUrlSchema = z
  .string()
  .optional()
  .refine(
    (url) => !url || url.startsWith('https://'),
    'Legal review reference must use https protocol',
  )
  .refine((url) => !url || isValidUrl(url), {
    message: 'Legal review reference must be a valid URL',
  });

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
  legalReviewReferenceUrl: optionalHttpsUrlSchema,
  legalReviewNotes: z.string().max(4000).optional(),
});

export type VendorIngestInput = z.infer<typeof vendorIngestInputSchema>;

/** Re-sync existing source schema (sourceId path) */
export const vendorResyncInputSchema = z.object({
  sourceId: z.string().uuid('sourceId must be a valid UUID'),
  force: z.boolean().optional(),
  maxPages: z
    .number()
    .int('Max pages must be a whole number')
    .min(1, 'Max pages must be at least 1')
    .max(500, 'Max pages cannot exceed 500')
    .optional(),
});

export type VendorResyncInput = z.infer<typeof vendorResyncInputSchema>;

export const vendorSourceLifecycleSchema = z.enum(['active', 'paused', 'retired']);

export const vendorSourceUpdateSchema = z.object({
  lifecycle: vendorSourceLifecycleSchema.optional(),
  termsReviewStatus: z
    .enum(['pending', 'approved', 'restricted', 'rejected'])
    .optional(),
  legalReviewReferenceUrl: z.preprocess(
    (value) => (value === '' ? null : value),
    z
      .string()
      .url('Legal review reference must be a valid URL')
      .refine(
        (u) => u.startsWith('https://'),
        'Legal review reference must use https protocol',
      )
      .nullable()
      .optional(),
  ),
  legalReviewNotes: z.string().max(4000).nullable().optional(),
});

export const vendorSourceRetireSchema = z.object({
  reason: z.string().trim().min(5, 'Retirement reason is required'),
  replacementSourceId: z.string().uuid().nullable().optional(),
});

export type VendorSourceUpdateInput = z.infer<typeof vendorSourceUpdateSchema>;
export type VendorSourceRetireInput = z.infer<typeof vendorSourceRetireSchema>;
