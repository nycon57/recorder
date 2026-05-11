/**
 * GET /api/docs/search/[audience]
 *
 * Serves the pre-built MiniSearch index for `org-admin` and `system-admin`.
 * The `public` variant is a static Next.js public asset (no auth needed).
 *
 * Security model (see plan §9 / §R4):
 *  - Resolves caller's audience via `resolveDocsAudience`.
 *  - Caller must be at least as privileged as the requested index.
 *  - Under-privileged callers receive 404 (not 403 — don't acknowledge the endpoint).
 *
 * Cache-Control: private, max-age=60 — client may cache for 1 minute but
 * must not share with other users or CDN public caches.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';

import type { Audience } from '@/lib/docs';
import { resolveDocsAudience } from '@/lib/docs';

const AUDIENCE_LEVEL: Record<Audience, number> = {
  public: 0,
  'org-admin': 1,
  'system-admin': 2,
};

type ValidGatedAudience = 'org-admin' | 'system-admin';

const VALID_GATED: Set<string> = new Set<ValidGatedAudience>(['org-admin', 'system-admin']);

function loadSearchIndex(audience: ValidGatedAudience): unknown | null {
  const indexPath = join(
    process.cwd(),
    'src',
    'lib',
    'docs',
    'generated',
    `search-index.${audience}.json`,
  );

  if (!existsSync(indexPath)) {
    return null;
  }

  return JSON.parse(readFileSync(indexPath, 'utf8')) as unknown;
}

const SEARCH_INDEXES: Record<ValidGatedAudience, unknown | null> = {
  'org-admin': loadSearchIndex('org-admin'),
  'system-admin': loadSearchIndex('system-admin'),
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ audience: string }> },
): Promise<NextResponse> {
  const { audience: audienceParam } = await params;

  // Only serve gated indexes; public.json is static
  if (!VALID_GATED.has(audienceParam)) {
    notFound();
  }

  const requestedAudience = audienceParam as ValidGatedAudience;

  // Resolve caller's audience
  const reqHeaders = await headers();
  const { audience: callerAudience } = await resolveDocsAudience(reqHeaders);

  // Caller must have sufficient privilege
  if (AUDIENCE_LEVEL[callerAudience] < AUDIENCE_LEVEL[requestedAudience]) {
    notFound(); // 404 — never acknowledge the endpoint to under-privileged callers
  }

  const payload = SEARCH_INDEXES[requestedAudience];

  if (!payload) {
    // Manifest not built yet — degrade gracefully
    return NextResponse.json(
      { index: null, entries: [], error: 'Search index not built. Run npm run prebuild.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=60',
    },
  });
}
