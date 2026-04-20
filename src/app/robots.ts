import type { MetadataRoute } from 'next';

/**
 * robots.ts — crawl policy for Tribora docs.
 *
 * System-admin and security sections must never be indexed.
 * Deny patterns use the /docs/<section-id>/ prefix for all privileged sections.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/docs/platform-runbooks/',
          '/docs/vendor-sources/',
          '/docs/system-admin/',
          '/docs/security/',
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tribora.ai'}/sitemap.xml`,
  };
}
