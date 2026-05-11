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

import { readFile } from 'fs/promises';
import { join } from 'path';
import { webcrypto } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BundleCache {
  content: string;
  etag: string;
}

async function createBundleEtag(content: string): Promise<string> {
  const digest = await webcrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(content.slice(0, 1024))
  );
  const hash = Buffer.from(digest).toString('hex').slice(0, 12);
  return `"sdk-${hash}"`;
}

const bundlePath = join(process.cwd(), 'packages', 'sdk', 'dist', 'tribora-sdk.js');
const bundleCachePromise: Promise<BundleCache | null> = readFile(bundlePath, 'utf-8')
  .then(async (content) => ({
    content,
    etag: await createBundleEtag(content),
  }))
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  });

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(request: NextRequest) {
  try {
    const bundleCache = await bundleCachePromise;

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

    return NextResponse.json(
      {
        error: 'SDK bundle not found',
        hint: 'Run `cd packages/sdk && npm run build` to build the SDK bundle.',
      },
      { status: 404, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[sdk/bundle] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
