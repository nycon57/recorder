/**
 * POST /api/extension/context
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Accepts:
 *   { url: string, appSignature: string }
 *
 * Returns:
 *   { app: string, screen: string, relevantWikiPages: string[] }
 *
 * The appSignature is a string produced by the extension's app-detector
 * (e.g. "salesforce:lead-detail"). If it contains a colon, the left part
 * is the app and the right part is the screen. Otherwise the whole value
 * is treated as the app and the screen is derived from the URL pathname.
 */

import { NextRequest, NextResponse } from 'next/server';

import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Derive a screen slug from a URL pathname. */
function screenFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    // Take the last meaningful path segment, normalise slashes
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function POST(request: NextRequest) {
  try {
    // TRIB-56: Accept API key auth (Bearer sk_live_...) alongside session auth.
    await requireApiKeyOrSession(request, 'context');

    const body = await request.json();
    const { url, appSignature } = body as {
      url?: string;
      appSignature?: string;
    };

    if (!url || typeof url !== 'string') {
      return errors.badRequest('url is required');
    }
    if (!appSignature || typeof appSignature !== 'string') {
      return errors.badRequest('appSignature is required');
    }

    // Parse appSignature: "salesforce:lead-detail" → { app, screen }
    const colonIdx = appSignature.indexOf(':');
    const app =
      colonIdx !== -1
        ? appSignature.slice(0, colonIdx).toLowerCase()
        : appSignature.toLowerCase();
    const screen =
      colonIdx !== -1
        ? appSignature.slice(colonIdx + 1).toLowerCase()
        : screenFromUrl(url);

    // Look up relevant vendor wiki pages for this app + screen
    const { data: wikiPages, error } = await supabaseAdmin
      .from('vendor_wiki_pages')
      .select('id, app, screen, content, element_selectors, source_url')
      .eq('app', app)
      .eq('screen', screen)
      .order('updated_at', { ascending: false })
      .limit(5) as {
        data: Array<{ id: string; app: string; screen: string; content: string; element_selectors: unknown; source_url: string | null }> | null;
        error: unknown;
      };

    if (error) {
      console.error('[extension/context] DB error:', error);
      return errors.internalError();
    }

    const relevantWikiPages = (wikiPages ?? []).map((p) => p.id);

    return NextResponse.json({
      app,
      screen,
      relevantWikiPages,
    });
  } catch (error: any) {
    console.error('[extension/context] error:', error);

    if (error.message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (error.message === 'Rate limit exceeded') {
      return errors.rateLimitExceeded();
    }
    if (error.message === 'Insufficient scope') {
      return errors.forbidden();
    }
    if (
      error.message === 'Organization context required' ||
      error.message === 'User organization not found' ||
      error.message?.includes('not found in database')
    ) {
      return errors.forbidden();
    }

    return errors.internalError();
  }
}
