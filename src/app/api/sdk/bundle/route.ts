/**
 * GET /api/sdk/bundle
 *
 * Serves the Tribora SDK JavaScript bundle with appropriate cache headers.
 * This route is public (no auth required) — the SDK authenticates via
 * API key when calling /api/sdk/init.
 *
 * The bundle is read from `packages/sdk/dist/tribora-sdk.js` (UMD build).
 * If the built file is not available, returns a 404 with instructions.
 *
 * Cache-Control: public, max-age=86400, stale-while-revalidate=3600
 *
 * TRIB-58: Custom domain support — serves from any configured vendor domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache the bundle contents in memory after first read
let bundleCache: { content: string; etag: string } | null = null;

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(request: NextRequest) {
  try {
    // Serve from memory cache if available
    if (bundleCache) {
      const ifNoneMatch = request.headers.get('if-none-match');
      if (ifNoneMatch === bundleCache.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ...CORS_HEADERS,
            ETag: bundleCache.etag,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          },
        });
      }

      return new NextResponse(bundleCache.content, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          ETag: bundleCache.etag,
        },
      });
    }

    // Try to read the SDK bundle from the packages directory
    // In production, the built bundle lives at packages/sdk/dist/tribora-sdk.js
    const bundlePath = join(process.cwd(), 'packages', 'sdk', 'dist', 'tribora-sdk.js');

    let content: string;
    try {
      content = await readFile(bundlePath, 'utf-8');
    } catch {
      return NextResponse.json(
        {
          error: 'SDK bundle not found',
          hint: 'Run `cd packages/sdk && npm run build` to build the SDK bundle.',
        },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Generate a simple ETag from content length + hash of first 1KB
    const { createHash } = await import('crypto');
    const etag = `"sdk-${createHash('md5').update(content.slice(0, 1024)).digest('hex').slice(0, 12)}"`;

    // Cache in memory
    bundleCache = { content, etag };

    return new NextResponse(content, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        ETag: etag,
      },
    });
  } catch (err) {
    console.error('[sdk/bundle] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
