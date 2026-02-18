import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getRedis } from '@/lib/rate-limit/redis';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_RANGE_DAYS = 30;

const CSV_COLUMNS = [
  'timestamp',
  'agent_type',
  'action_type',
  'content_id',
  'target_entity',
  'target_id',
  'outcome',
  'confidence',
  'duration_ms',
  'tokens_used',
  'cost_estimate',
  'input_summary',
  'output_summary',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a CSV field value, wrapping in quotes when needed. */
function csvField(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Serialize one agent_activity_log row as a CSV line. */
function rowToCsvLine(row: Record<string, unknown>): string {
  return CSV_COLUMNS.map(col => {
    if (col === 'timestamp') return csvField(row['created_at']);
    return csvField(row[col]);
  }).join(',');
}

interface QueryFilters {
  orgId: string;
  startDate: string;
  endDate: string;
  agentType?: string;
  actionType?: string;
}

/** Build a paginated Supabase query for agent_activity_log with the given filters. */
function buildActivityQuery(filters: QueryFilters, offset: number) {
  let query = supabaseAdmin
    .from('agent_activity_log')
    .select('*')
    .eq('org_id', filters.orgId)
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate)
    .order('created_at', { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1);

  if (filters.agentType) query = query.eq('agent_type', filters.agentType);
  if (filters.actionType) query = query.eq('action_type', filters.actionType);

  return query;
}

/**
 * Check org-level export rate limit using Redis.
 * Returns the number of seconds until the rate limit resets, or 0 if allowed.
 */
async function checkExportRateLimit(orgId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  const key = `export:ratelimit:org:${orgId}`;
  const result = await redis.set(key, '1', { ex: RATE_LIMIT_WINDOW_SECONDS, nx: true });

  if (result !== null) return 0;

  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 1;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  // Require admin (owner or admin role)
  let orgId: string;
  try {
    const context = await requireAdmin();
    orgId = context.orgId;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 1 export per minute per org
  const retryAfter = await checkExportRateLimit(orgId);
  if (retryAfter > 0) {
    return NextResponse.json(
      { error: 'Too Many Requests', message: `Export rate limit exceeded. Try again in ${retryAfter} seconds.` },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  // Parse query params
  const { searchParams } = new URL(request.url);

  const format = searchParams.get('format') ?? 'csv';
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json({ error: 'format must be csv or json' }, { status: 400 });
  }

  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_RANGE_DAYS);

  const rawStart = searchParams.get('startDate');
  const rawEnd = searchParams.get('endDate');

  const parsedStart = rawStart ? new Date(rawStart) : defaultStart;
  const parsedEnd = rawEnd ? new Date(rawEnd) : defaultEnd;

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return NextResponse.json({ error: 'Invalid startDate or endDate' }, { status: 400 });
  }

  const filters: QueryFilters = {
    orgId,
    startDate: parsedStart.toISOString(),
    endDate: parsedEnd.toISOString(),
    agentType: searchParams.get('agentType') ?? undefined,
    actionType: searchParams.get('actionType') ?? undefined,
  };

  const startLabel = parsedStart.toISOString().slice(0, 10);
  const endLabel = parsedEnd.toISOString().slice(0, 10);
  const filename = `agent-audit-org_${orgId}-${startLabel}-to-${endLabel}.${format}`;

  // ---------------------------------------------------------------------------
  // JSON export — fetch all rows then serialize
  // ---------------------------------------------------------------------------
  if (format === 'json') {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await buildActivityQuery(filters, offset);

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // CSV streaming export
  // ---------------------------------------------------------------------------
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(CSV_COLUMNS.join(',') + '\n'));

      let offset = 0;

      while (true) {
        const { data, error } = await buildActivityQuery(filters, offset);

        if (error) {
          console.error('[agent-audit-export] Supabase query error:', error);
          controller.close();
          return;
        }

        if (!data || data.length === 0) break;

        const chunk = (data as Record<string, unknown>[])
          .map(rowToCsvLine)
          .join('\n') + '\n';

        controller.enqueue(encoder.encode(chunk));

        if (data.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
    },
  });
}
