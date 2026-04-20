import { z } from 'zod';

import type { DocsPage } from './types';

const slugRegex = /^[a-z0-9][a-z0-9/-]*$/;

const AudienceSchema = z.enum(['public', 'org-admin', 'system-admin']);

const SectionIdSchema = z.enum([
  'getting-started',
  'product',
  'integrations',
  'reference',
  'policies',
  'knowledge-ops',
  'org-admin',
  'observability',
  'platform-runbooks',
  'vendor-sources',
  'system-admin',
  'security',
]);

export const DocsPageSchema = z.object({
  slug: z.string().regex(slugRegex, 'Slug must match ^[a-z0-9][a-z0-9/-]*$'),
  title: z.string().min(1),
  description: z.string().min(1),
  audience: AudienceSchema,
  section: SectionIdSchema,
  group: z.string().optional(),
  order: z.number().int().optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'updatedAt must be YYYY-MM-DD'),
  related: z.array(z.string().regex(slugRegex)).optional(),
  tags: z.array(z.string()).optional(),
  unlisted: z.boolean().optional(),
  draft: z.boolean().optional(),
  source: z.enum(['git', 'db']),
  contentHash: z.string().min(1),
});

/** Parse and validate an unknown value as a DocsPage. Throws ZodError on failure. */
export function parseDocsPage(input: unknown): DocsPage {
  return DocsPageSchema.parse(input);
}
