/**
 * POST /api/extension/context
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Accepts:
 *   { url: string, appSignature: string }
 *   or
 *   { context: PageContext }
 *
 * Returns:
 *   {
 *     app: string;
 *     screen: string;
 *     relevantWikiPages: string[];
 *     vendorKnowledgeMatch: KnowledgeMatch | null;
 *     orgKnowledgeMatch: KnowledgeMatch | null;
 *     knowledgeAvailability: KnowledgeAvailability;
 *   }
 *
 * The appSignature is a string produced by the extension's app-detector
 * (e.g. "salesforce:lead-detail"). If it contains a colon, the left part
 * is the app and the right part is the screen. Otherwise the whole value
 * is treated as the app and the screen is derived from the URL pathname.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import type { PageContext } from '@tribora/shared';

import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';
import { resolveExtensionContextMatches } from '@/lib/services/extension-context';
import { buildExtensionContextTelemetry } from '@/lib/services/extension-context-telemetry';
import { recordKnowledgeTelemetryEvent } from '@/lib/services/knowledge-telemetry';
import { logger } from '@/lib/monitoring/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS preflight handler
export function OPTIONS() {
  return corsPreflightResponse();
}

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
    const requestStartedAt = Date.now();

    // TRIB-56: Accept API key auth (Bearer sk_live_...) alongside session auth.
    const authCtx = await requireApiKeyOrSession(request, 'context');

    const body = await request.json();
    const { url, appSignature, context } = body as {
      url?: string;
      appSignature?: string;
      context?: PageContext;
    };

    const resolvedUrl = context?.url ?? url;
    const resolvedAppSignature = context?.appSignature ?? appSignature;

    if (!resolvedUrl || typeof resolvedUrl !== 'string') {
      return errors.badRequest('url is required');
    }
    if (!resolvedAppSignature || typeof resolvedAppSignature !== 'string') {
      return errors.badRequest('appSignature is required');
    }

    // Parse appSignature: "salesforce:lead-detail" → { app, screen }
    const colonIdx = resolvedAppSignature.indexOf(':');
    const app =
      context?.app?.toLowerCase() ??
      (colonIdx !== -1
        ? resolvedAppSignature.slice(0, colonIdx).toLowerCase()
        : resolvedAppSignature.toLowerCase());
    const screen =
      context?.screen?.toLowerCase() ??
      (colonIdx !== -1
        ? resolvedAppSignature.slice(colonIdx + 1).toLowerCase()
        : screenFromUrl(resolvedUrl));

    const matches = await resolveExtensionContextMatches({
      orgId: authCtx.orgId,
      app,
      screen,
      url: resolvedUrl,
    });

    const mergedContext: PageContext = {
      app,
      screen,
      appSignature: resolvedAppSignature.includes(':')
        ? resolvedAppSignature
        : `${app}:${screen}`,
      url: resolvedUrl,
      title: context?.title ?? '',
      interactiveElements: context?.interactiveElements ?? [],
      detectionConfidence: context?.detectionConfidence,
      pageSummary: context?.pageSummary,
      headings: context?.headings ?? [],
      navigation: context?.navigation ?? [],
      primaryActions: context?.primaryActions ?? [],
      selectedEntity: context?.selectedEntity,
      workspaceContext: context?.workspaceContext,
      forms: context?.forms ?? [],
      tables: context?.tables ?? [],
      dialogs: context?.dialogs ?? [],
      vendorKnowledgeMatch: matches.vendorKnowledgeMatch,
      orgKnowledgeMatch: matches.orgKnowledgeMatch,
      knowledgeAvailability: matches.knowledgeAvailability,
      breadcrumbs: context?.breadcrumbs ?? [],
      visibleText: context?.visibleText,
    };
    const telemetry = buildExtensionContextTelemetry({
      context: mergedContext,
      latencyMs: Date.now() - requestStartedAt,
      authMethod: authCtx.authMethod,
      orgId: authCtx.orgId,
      actorId:
        authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId,
    });

    after(async () => {
      try {
        logger.info('Extension context checked', {
          orgId: telemetry.orgId,
          authMethod: telemetry.authMethod,
          app: telemetry.app,
          screen: telemetry.screen,
          pageType: telemetry.pageType,
          knowledgeMode: telemetry.knowledgeMode,
          vendorMatchBasis: telemetry.vendorMatchBasis,
          orgMatchBasis: telemetry.orgMatchBasis,
          latencyMs: telemetry.latencyMs,
          fingerprint: telemetry.fingerprint,
        });

        await recordKnowledgeTelemetryEvent({
          type: 'extension.context.checked',
          payload: telemetry,
        });
      } catch (error) {
        logger.warn('Failed to record extension context telemetry', {
          orgId: authCtx.orgId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return NextResponse.json(
      {
        app,
        screen,
        relevantWikiPages: matches.relevantWikiPages,
        vendorKnowledgeMatch: matches.vendorKnowledgeMatch,
        orgKnowledgeMatch: matches.orgKnowledgeMatch,
        knowledgeAvailability: matches.knowledgeAvailability,
      },
      { headers: CORS_HEADERS },
    );
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
