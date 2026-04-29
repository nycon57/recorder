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

import {
  buildKnowledgeResolvedFor,
  sanitizePageContextForNetwork,
  sanitizePageContextText,
  type PageContext,
} from '@tribora/shared';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';
import { resolveExtensionContextMatches } from '@/lib/services/extension-context';
import { buildExtensionContextTelemetry } from '@/lib/services/extension-context-telemetry';
import { recordKnowledgeTelemetryEvent } from '@/lib/services/knowledge-telemetry';
import type { Json } from '@/lib/types/database';
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeIncomingUrl(url: string): string {
  return sanitizePageContextForNetwork({
    app: 'unknown',
    screen: 'unknown',
    appSignature: 'unknown:unknown',
    url,
    title: '',
    interactiveElements: [],
  }).url;
}

function sanitizeIncomingAppSignature(
  value: string | undefined,
): string | undefined {
  return sanitizePageContextText(value, 120);
}

export async function POST(request: NextRequest) {
  try {
    const requestStartedAt = Date.now();

    // TRIB-56: Accept API key auth (Bearer sk_live_...) alongside session auth.
    const authCtx = await requireApiKeyOrSession(request, 'query');

    const body = await request.json();
    const { url, appSignature, context } = body as {
      url?: string;
      appSignature?: string;
      context?: PageContext;
    };

    const sanitizedIncomingContext = context
      ? sanitizePageContextForNetwork(context)
      : undefined;
    const resolvedUrl =
      sanitizedIncomingContext?.url ?? (url ? sanitizeIncomingUrl(url) : url);
    const resolvedAppSignature =
      sanitizedIncomingContext?.appSignature ??
      sanitizeIncomingAppSignature(appSignature);

    if (!resolvedUrl || typeof resolvedUrl !== 'string') {
      return errors.badRequest('url is required');
    }
    if (!resolvedAppSignature || typeof resolvedAppSignature !== 'string') {
      return errors.badRequest('appSignature is required');
    }

    // Parse appSignature: "salesforce:lead-detail" → { app, screen }
    const colonIdx = resolvedAppSignature.indexOf(':');
    const app =
      sanitizedIncomingContext?.app?.toLowerCase() ??
      (colonIdx !== -1
        ? resolvedAppSignature.slice(0, colonIdx).toLowerCase()
        : resolvedAppSignature.toLowerCase());
    const screen =
      sanitizedIncomingContext?.screen?.toLowerCase() ??
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
      title: sanitizedIncomingContext?.title ?? '',
      interactiveElements: sanitizedIncomingContext?.interactiveElements ?? [],
      detectionConfidence: sanitizedIncomingContext?.detectionConfidence,
      pageSummary: sanitizedIncomingContext?.pageSummary,
      headings: sanitizedIncomingContext?.headings ?? [],
      navigation: sanitizedIncomingContext?.navigation ?? [],
      primaryActions: sanitizedIncomingContext?.primaryActions ?? [],
      selectedEntity: sanitizedIncomingContext?.selectedEntity,
      workspaceContext: sanitizedIncomingContext?.workspaceContext,
      viewport: sanitizedIncomingContext?.viewport,
      regions: sanitizedIncomingContext?.regions ?? [],
      snippets: sanitizedIncomingContext?.snippets ?? [],
      forms: sanitizedIncomingContext?.forms ?? [],
      tables: sanitizedIncomingContext?.tables ?? [],
      dialogs: sanitizedIncomingContext?.dialogs ?? [],
      vendorKnowledgeMatch: matches.vendorKnowledgeMatch,
      orgKnowledgeMatch: matches.orgKnowledgeMatch,
      knowledgeAvailability: matches.knowledgeAvailability,
      relevantWikiPages: matches.relevantWikiPages,
      knowledgeResolvedFor: buildKnowledgeResolvedFor({
        app,
        screen,
        appSignature: resolvedAppSignature.includes(':')
          ? resolvedAppSignature
          : `${app}:${screen}`,
        url: resolvedUrl,
      }),
      breadcrumbs: sanitizedIncomingContext?.breadcrumbs ?? [],
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
          payload: telemetry as unknown as Json,
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
        knowledgeResolvedFor: mergedContext.knowledgeResolvedFor,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error('[extension/context] error:', error);

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

    return errors.internalError();
  }
}
