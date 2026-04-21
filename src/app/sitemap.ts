import type { MetadataRoute } from 'next';

/**
 * sitemap.ts — public sitemap for Tribora.
 *
 * Includes:
 * - Core marketing pages
 * - Public docs section indexes and individual pages
 *
 * Deliberately excludes:
 * - Org-admin docs (audience-gated, no benefit to public indexing)
 * - System-admin / security / platform-runbooks / vendor-sources
 *   (already blocked by robots.ts)
 * - All /dashboard/* routes (require auth)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tribora.ai';

const PUBLIC_DOC_SLUGS = [
  // Getting Started
  'getting-started/welcome',
  'getting-started/install-the-extension',
  'getting-started/record-your-first-workflow',
  'getting-started/from-recording-to-knowledge',
  // Product
  'product/recordings',
  'product/wiki',
  'product/search',
  'product/assistant',
  // Integrations
  'integrations/browser-extension',
  'integrations/sdk-widget',
  // Reference
  'reference/data-model',
  'reference/limits-and-quotas',
  // Policies
  'policies/privacy',
  'policies/security',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const marketing: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ];

  const docsIndex: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
  ];

  const docsPages: MetadataRoute.Sitemap = PUBLIC_DOC_SLUGS.map((slug) => ({
    url: `${BASE_URL}/docs/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...marketing, ...docsIndex, ...docsPages];
}
