/**
 * GET /api/extension/health
 *
 * Public endpoint — no auth required.
 * Returns wiki page counts and loaded vendor apps so the Chrome extension
 * can surface a "knowledge base loaded" indicator.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  countVendorWikiPages,
  listVendorApps,
} from '@/lib/services/vendor-wiki-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const [wikiPageCount, vendorApps] = await Promise.all([
      countVendorWikiPages(),
      listVendorApps(),
    ]);

    return NextResponse.json({
      status: 'ok',
      wikiPageCount,
      vendorDocsLoaded: vendorApps,
    });
  } catch (error) {
    console.error('[extension/health] error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
