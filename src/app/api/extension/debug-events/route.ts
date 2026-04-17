import { NextRequest, NextResponse } from 'next/server';
import type { ExtensionDebugSessionEventInput } from '@tribora/shared';

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

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiKeyOrSession(request, 'context');
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
    const rows: Database['public']['Tables']['events']['Insert'][] = events.map(
      (event) => ({
        type: 'extension.debug_session.event',
        payload: {
          ...event,
          orgId: authCtx.orgId,
          actorId:
            authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId,
          authMethod: authCtx.authMethod,
        },
      }),
    );

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
  } catch (error: any) {
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

    console.error('[extension/debug-events] error:', error);
    return errors.internalError();
  }
}
