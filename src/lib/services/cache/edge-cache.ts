/**
 * Edge caching utilities for Next.js CDN caching
 */

export interface EdgeCacheConfig {
  maxAge: number; // seconds
  staleWhileRevalidate?: number; // seconds
  tags?: string[];
}

/**
 * Set cache headers for edge caching (Vercel, Cloudflare, etc.)
 */
export function setEdgeCacheHeaders(
  headers: Headers,
  config: EdgeCacheConfig
): void {
  const directives: string[] = [
    `max-age=${config.maxAge}`,
    'public',
  ];

  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  headers.set('Cache-Control', directives.join(', '));

  // Set cache tags for invalidation
  if (config.tags && config.tags.length > 0) {
    headers.set('Cache-Tag', config.tags.join(','));
  }
}

/**
 * Revalidate edge cache by tag (Vercel)
 */
export async function revalidateByTag(tag: string): Promise<void> {
  if (!process.env.VERCEL_REVALIDATE_TOKEN) {
    console.warn('[Edge Cache] No revalidation token configured');
    return;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/revalidate-tag`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_REVALIDATE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to revalidate: ${response.statusText}`);
    }

    console.log(`[Edge Cache] Revalidated tag: ${tag}`);
  } catch (error) {
    console.error('[Edge Cache] Revalidation failed:', error);
  }
}

/**
 * Purge edge cache by URL (Cloudflare)
 */
export async function purgeByUrl(urls: string[]): Promise<void> {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    console.warn('[Edge Cache] Cloudflare credentials not configured');
    return;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to purge: ${response.statusText}`);
    }

    console.log(`[Edge Cache] Purged ${urls.length} URLs`);
  } catch (error) {
    console.error('[Edge Cache] Purge failed:', error);
  }
}
