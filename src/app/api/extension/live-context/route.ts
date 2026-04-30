import { NextRequest, NextResponse } from 'next/server';

import {
  buildKnowledgeResolvedFor,
  knowledgeResolvedForContextMatches,
  sanitizePageContextForNetwork,
  type KnowledgeAvailability,
  type KnowledgeMatch,
  type LiveContextPack,
  type PageContext,
} from '@tribora/shared';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { resolveExtensionContextMatches } from '@/lib/services/extension-context';
import {
  buildLiveContextPack,
  type LiveContextSourcePage,
} from '@/lib/services/extension-live-context';
import { resolveCustomerOrgForVendor } from '@/lib/services/vendor-customers';
import { filterQueryableVendorSourceRows } from '@/lib/services/vendor-source-queryability';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

function screenFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function usableAppSignature(value: string | undefined): string | undefined {
  if (!value || value.toLowerCase() === 'unknown:unknown') return undefined;
  return value;
}

function orderPagesByRequestedIds<T extends { id: string }>(
  pages: T[],
  pageIds: string[],
): T[] {
  const rankById = new Map(pageIds.map((id, index) => [id, index]));
  return [...pages].sort((left, right) => {
    const leftRank = rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.id.localeCompare(right.id);
  });
}

async function loadVendorPages(
  pageIds: string[],
): Promise<LiveContextSourcePage[]> {
  const requestedPageIds = pageIds.slice(0, 2);
  if (requestedPageIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vendor_wiki_pages')
    .select('id, screen, content, vendor_source_id')
    .in('id', requestedPageIds)
    .is('retired_at', null);

  if (error) {
    throw new Error(`Failed to load vendor pages: ${error.message}`);
  }

  const queryablePages = await filterQueryableVendorSourceRows(data ?? [], supabase);

  return orderPagesByRequestedIds(queryablePages, requestedPageIds).map((page) => ({
    id: page.id,
    title: page.screen,
    content: page.content,
    kind: 'vendor_generic',
  }));
}

async function loadOrgPages(args: {
  orgId: string;
  pageIds: string[];
}): Promise<LiveContextSourcePage[]> {
  const requestedPageIds = args.pageIds.slice(0, 2);
  if (requestedPageIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('org_wiki_pages')
    .select('id, topic, content')
    .eq('org_id', args.orgId)
    .is('valid_until', null)
    .in('id', requestedPageIds);

  if (error) {
    throw new Error(`Failed to load org pages: ${error.message}`);
  }

  return orderPagesByRequestedIds(data ?? [], requestedPageIds).map((page) => ({
    id: page.id,
    title: page.topic,
    content: page.content,
    kind: 'org',
  }));
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiKeyOrSession(request, 'query');
    const body = (await request.json()) as {
      context?: PageContext;
      customerOrgId?: string;
    };

    if (!body.context) {
      return errors.badRequest('context is required');
    }

    const baseContext = sanitizePageContextForNetwork(body.context);
    const normalizedApp = baseContext.app?.toLowerCase();
    const normalizedScreen = baseContext.screen?.toLowerCase();
    const resolvedApp =
      normalizedApp && normalizedApp !== 'unknown' ? normalizedApp : 'unknown';
    const resolvedScreen =
      normalizedScreen && normalizedScreen !== 'unknown'
        ? normalizedScreen
        : screenFromUrl(baseContext.url);
    const resolvedAppSignature =
      usableAppSignature(baseContext.appSignature) ??
      `${resolvedApp}:${resolvedScreen}`;
    const currentKnowledgeResolvedFor = buildKnowledgeResolvedFor({
      app: resolvedApp,
      screen: resolvedScreen,
      appSignature: resolvedAppSignature,
      url: baseContext.url,
    });
    const customerOrgId =
      typeof body.customerOrgId === 'string' && body.customerOrgId.trim()
        ? body.customerOrgId.trim()
        : null;
    let effectiveOrgId = authCtx.orgId;

    if (authCtx.authMethod === 'api_key') {
      if (!customerOrgId) {
        return errors.badRequest(
          'customerOrgId is required for API-key recall',
        );
      }

      const customerOrg = await resolveCustomerOrgForVendor(
        authCtx.orgId,
        customerOrgId,
      );

      if (!customerOrg) {
        return errors.forbidden();
      }

      effectiveOrgId = customerOrg.id;
    }

    let vendorKnowledgeMatch: KnowledgeMatch | null =
      baseContext.vendorKnowledgeMatch ?? null;
    let orgKnowledgeMatch: KnowledgeMatch | null =
      baseContext.orgKnowledgeMatch ?? null;
    let knowledgeAvailability: KnowledgeAvailability | undefined =
      baseContext.knowledgeAvailability;
    let relevantWikiPages = baseContext.relevantWikiPages;

    if (
      !knowledgeAvailability ||
      !knowledgeResolvedForContextMatches(baseContext.knowledgeResolvedFor, {
        app: resolvedApp,
        screen: resolvedScreen,
        appSignature: resolvedAppSignature,
        url: baseContext.url,
      })
    ) {
      const matches = await resolveExtensionContextMatches({
        orgId: effectiveOrgId,
        app: resolvedApp,
        screen: resolvedScreen,
        url: baseContext.url,
      });
      vendorKnowledgeMatch = matches.vendorKnowledgeMatch;
      orgKnowledgeMatch = matches.orgKnowledgeMatch;
      knowledgeAvailability = matches.knowledgeAvailability;
      relevantWikiPages = matches.relevantWikiPages;
    }

    const mergedContext: PageContext = {
      ...baseContext,
      app: resolvedApp,
      screen: resolvedScreen,
      appSignature: resolvedAppSignature,
      vendorKnowledgeMatch,
      orgKnowledgeMatch,
      knowledgeAvailability,
      relevantWikiPages,
      knowledgeResolvedFor: currentKnowledgeResolvedFor,
    };

    const [orgPages, vendorPages] = await Promise.all([
      loadOrgPages({
        orgId: effectiveOrgId,
        pageIds: orgKnowledgeMatch?.pageIds ?? [],
      }),
      loadVendorPages(vendorKnowledgeMatch?.pageIds ?? []),
    ]);

    const pack: LiveContextPack = buildLiveContextPack({
      context: mergedContext,
      orgPages,
      vendorPages,
    });

    return NextResponse.json(pack, { headers: CORS_HEADERS });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);

    if (errorMessage === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (errorMessage === 'Rate limit exceeded') {
      return errors.rateLimitExceeded();
    }
    if (errorMessage === 'Insufficient scope') {
      return errors.forbidden();
    }
    if (
      errorMessage === 'Organization context required' ||
      errorMessage === 'User organization not found' ||
      errorMessage.includes('not found in database')
    ) {
      return errors.forbidden();
    }

    console.error('[extension/live-context] error:', error);
    return errors.internalError();
  }
}
