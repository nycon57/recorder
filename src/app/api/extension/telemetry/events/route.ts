import { NextRequest, NextResponse } from 'next/server';

import {
  sanitizeExtensionProductTelemetryEvent,
  type ExtensionProductTelemetryEventInput,
} from '@tribora/shared';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

type ExtensionProductEventInsert =
  Database['public']['Tables']['extension_product_events']['Insert'];

function toRow(args: {
  event: ExtensionProductTelemetryEventInput;
  orgId: string;
  actorId: string | null;
  authMethod: 'session' | 'api_key';
}): ExtensionProductEventInsert {
  const { event, orgId, actorId, authMethod } = args;

  return {
    org_id: orgId,
    actor_id: actorId,
    auth_method: authMethod,
    event_id: event.eventId,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    session_id: event.sessionId,
    conversation_id: event.conversationId,
    turn_id: event.turnId,
    seq: event.seq,
    url_host: event.urlHost,
    url_path: event.urlPath,
    app: event.app,
    screen: event.screen,
    knowledge_mode: event.knowledgeMode,
    vendor_match_basis: event.vendorMatchBasis,
    org_match_basis: event.orgMatchBasis,
    vendor_match_category: event.vendorMatchCategory,
    org_match_category: event.orgMatchCategory,
    latency_ms: event.latencyMs,
    source_count: event.sourceCount,
    source_kinds: event.sourceKinds,
    outcome: event.outcome,
    error_code: event.errorCode,
    error_category: event.errorCategory,
    message_direction: event.messageDirection,
    message_length: event.messageLength,
    tool_name: event.toolName,
    action: event.action,
    selector_present: event.selectorPresent,
    input_text_length: event.inputTextLength,
    output_text_length: event.outputTextLength,
    fingerprint: event.fingerprint,
    metadata: (event.metadata ?? {}) as Json,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiKeyOrSession(request, 'query');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errors.badRequest('events[] is required');
    }

    const eventsBody = (body as { events?: unknown }).events;
    if (!Array.isArray(eventsBody) || eventsBody.length === 0) {
      return errors.badRequest('events[] is required');
    }

    if (eventsBody.length > 100) {
      return errors.badRequest('Too many events in one batch');
    }

    const events = eventsBody.map(sanitizeExtensionProductTelemetryEvent);
    if (events.some((event) => event === null)) {
      return errors.badRequest(
        'One or more telemetry events are invalid or contain unsafe fields',
      );
    }

    const actorId =
      authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId;
    const rows = (events as ExtensionProductTelemetryEventInput[]).map(
      (event) =>
        toRow({
          event,
          orgId: authCtx.orgId,
          actorId,
          authMethod: authCtx.authMethod,
        }),
    );

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('extension_product_events')
      .upsert(rows as never, {
        onConflict: 'event_id',
        ignoreDuplicates: true,
      });

    if (error) {
      throw new Error(
        `Failed to store extension product telemetry: ${error.message}`,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: rows.length,
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

    console.error('[extension/telemetry/events] error:', error);
    return errors.internalError();
  }
}
