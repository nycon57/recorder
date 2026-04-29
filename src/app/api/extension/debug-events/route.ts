import { NextRequest, NextResponse } from 'next/server';

import {
  sanitizePageContextLocation,
  sanitizePageContextSelector,
  sanitizePageContextText,
  type ExtensionDebugSessionEventInput,
} from '@tribora/shared';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

function isValidEventInput(
  value: unknown,
): value is ExtensionDebugSessionEventInput {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.sessionId === 'string' &&
    typeof record.seq === 'number' &&
    typeof record.eventType === 'string' &&
    typeof record.occurredAt === 'string'
  );
}

function sanitizeDebugEvent(
  event: ExtensionDebugSessionEventInput,
): ExtensionDebugSessionEventInput {
  const normalizedPath = event.urlPath?.startsWith('/')
    ? event.urlPath
    : `/${event.urlPath ?? ''}`;
  const location = sanitizePageContextLocation(
    `https://${event.urlHost ?? 'unknown'}${normalizedPath}`,
  );

  return {
    sessionId: event.sessionId,
    seq: event.seq,
    turnId: sanitizePageContextText(event.turnId, 120) ?? null,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    urlHost: event.urlHost ? location.host : event.urlHost,
    urlPath: event.urlPath ? location.path : event.urlPath,
    app: sanitizePageContextText(event.app, 80) ?? event.app,
    screen: sanitizePageContextText(event.screen, 80) ?? event.screen,
    messageText: sanitizePageContextText(event.messageText, 500) ?? null,
    toolName: sanitizePageContextText(event.toolName, 80) ?? event.toolName,
    selector: sanitizePageContextSelector(event.selector) ?? null,
    label: sanitizePageContextText(event.label, 140) ?? event.label,
    action: sanitizePageContextText(event.action, 80) ?? event.action,
    inputTextPreview:
      sanitizePageContextText(event.inputTextPreview, 160) ?? null,
    resultText: sanitizePageContextText(event.resultText, 500) ?? null,
    error: sanitizePageContextText(event.error, 260) ?? event.error,
    pageSummary: sanitizePageContextText(event.pageSummary, 500) ?? null,
    selectedEntityTitle:
      sanitizePageContextText(event.selectedEntityTitle, 200) ?? null,
    conversationId:
      sanitizePageContextText(event.conversationId, 120) ??
      event.conversationId,
    fingerprint:
      sanitizePageContextText(event.fingerprint, 120) ?? event.fingerprint,
    pageInstanceId:
      sanitizePageContextText(event.pageInstanceId, 120) ??
      event.pageInstanceId,
    contentInstanceId:
      sanitizePageContextText(event.contentInstanceId, 120) ??
      event.contentInstanceId,
    tabId: event.tabId ?? null,
    windowId: event.windowId ?? null,
    bindingEpoch: event.bindingEpoch ?? null,
    durationMs: event.durationMs ?? null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiKeyOrSession(request, 'query');
    const body = (await request.json()) as {
      events?: unknown;
    };

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return errors.badRequest('events[] is required');
    }

    if (body.events.length > 100) {
      return errors.badRequest('Too many events in one batch');
    }

    const events = body.events.filter(isValidEventInput);
    if (events.length !== body.events.length) {
      return errors.badRequest('One or more debug events are invalid');
    }

    const supabase = createAdminClient();
    const sanitizedEvents = events.map(sanitizeDebugEvent);
    const rows: Database['public']['Tables']['events']['Insert'][] =
      sanitizedEvents.map((event) => ({
        type: 'extension.debug_session.event',
        payload: {
          ...event,
          orgId: authCtx.orgId,
          actorId:
            authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId,
          authMethod: authCtx.authMethod,
        },
      }));

    for (const row of rows) {
      // Repo-wide Supabase typing currently narrows admin inserts to `never`
      // during full `tsc --noEmit`, even for valid rows.
      const { error } = await supabase.from('events').insert(row as never);
      if (error) {
        throw new Error(
          `Failed to store extension debug events: ${error.message}`,
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        inserted: rows.length,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') {
      return errors.unauthorized();
    }
    if (message === 'Rate limit exceeded') {
      return errors.rateLimitExceeded();
    }
    if (message === 'Insufficient scope') {
      return errors.forbidden();
    }
    if (
      message === 'Organization context required' ||
      message === 'User organization not found' ||
      message.includes('not found in database')
    ) {
      return errors.forbidden();
    }

    console.error('[extension/debug-events] error:', error);
    return errors.internalError();
  }
}
