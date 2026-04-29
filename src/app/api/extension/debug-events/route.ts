import { NextRequest, NextResponse } from 'next/server';

import {
  findUnsafeTelemetryField,
  sanitizePageContextLocation,
  sanitizePageContextSelector,
  sanitizePageContextText,
  type ExtensionDebugSessionEventType,
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

const ALLOWED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'session_start_requested',
  'session_started',
  'session_ended',
  'session_error',
  'mic_permission_opened',
  'mic_permission_granted',
  'mic_permission_denied',
  'mic_permission_resumed',
  'page_context_checked',
  'contextual_update_sent',
  'user_message',
  'low_confidence_user_message',
  'assistant_message',
  'assistant_reply_watchdog_fired',
  'duplicate_assistant_reply',
  'tool_call_started',
  'tool_call_completed',
]);
const RAW_DEBUG_EVENTS_ENABLED =
  process.env.TRIBORA_ENABLE_EXTENSION_RAW_DEBUG_EVENTS === 'true';

function isAllowedEventType(
  value: unknown,
): value is ExtensionDebugSessionEventType {
  return typeof value === 'string' && ALLOWED_EVENT_TYPES.has(value);
}

function normalizeOccurredAt(value: string): string | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function sanitizeDebugIdentifier(
  value: string | null | undefined,
  fallback: string | null = null,
): string | null {
  return sanitizePageContextText(value, 120) ?? fallback;
}

function sanitizeOptionalInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function sanitizeOptionalDuration(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function isValidEventInput(
  value: unknown,
): value is ExtensionDebugSessionEventInput {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.sessionId === 'string' &&
    Number.isInteger(record.seq) &&
    Number(record.seq) >= 0 &&
    isAllowedEventType(record.eventType) &&
    typeof record.occurredAt === 'string' &&
    normalizeOccurredAt(record.occurredAt) !== null
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
    sessionId: sanitizeDebugIdentifier(event.sessionId, 'unknown') ?? 'unknown',
    seq: event.seq,
    turnId: sanitizeDebugIdentifier(event.turnId),
    eventType: event.eventType,
    occurredAt: normalizeOccurredAt(event.occurredAt) ?? event.occurredAt,
    urlHost: event.urlHost ? location.host : event.urlHost,
    urlPath: event.urlPath ? location.path : event.urlPath,
    app: sanitizePageContextText(event.app, 80) ?? null,
    screen: sanitizePageContextText(event.screen, 80) ?? null,
    messageText: sanitizePageContextText(event.messageText, 500) ?? null,
    toolName: sanitizePageContextText(event.toolName, 80) ?? null,
    selector: sanitizePageContextSelector(event.selector) ?? null,
    label: sanitizePageContextText(event.label, 140) ?? null,
    action: sanitizePageContextText(event.action, 80) ?? null,
    inputTextPreview: event.inputTextPreview ? '[input present]' : null,
    resultText: sanitizePageContextText(event.resultText, 500) ?? null,
    error: sanitizePageContextText(event.error, 260) ?? null,
    pageSummary: sanitizePageContextText(event.pageSummary, 500) ?? null,
    selectedEntityTitle:
      sanitizePageContextText(event.selectedEntityTitle, 200) ?? null,
    conversationId: sanitizeDebugIdentifier(event.conversationId),
    fingerprint: sanitizeDebugIdentifier(event.fingerprint),
    pageInstanceId: sanitizeDebugIdentifier(event.pageInstanceId),
    contentInstanceId: sanitizeDebugIdentifier(event.contentInstanceId),
    tabId: sanitizeOptionalInteger(event.tabId),
    windowId: sanitizeOptionalInteger(event.windowId),
    bindingEpoch: sanitizeOptionalInteger(event.bindingEpoch),
    durationMs: sanitizeOptionalDuration(event.durationMs),
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
    if (!RAW_DEBUG_EVENTS_ENABLED) {
      const unsafeField = findUnsafeTelemetryField(body.events);
      if (unsafeField) {
        return errors.badRequest(
          `Raw debug field "${unsafeField}" is disabled for extension debug ingest`,
        );
      }
    }

    const supabase = createAdminClient();
    const sanitizedEvents = events.map(sanitizeDebugEvent);
    const rows: Database['public']['Tables']['events']['Insert'][] =
      sanitizedEvents.map((sanitizedEvent) => ({
        type: 'extension.debug_session.event',
        payload: {
          ...sanitizedEvent,
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
