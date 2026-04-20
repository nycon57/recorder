/**
 * GET /api/admin/vendor-sources/failures
 *
 * System-admin-only. Returns paginated failed `ingest_vendor_docs` jobs.
 * Distinct from /jobs: focused on status='failed', higher default limit,
 * optional ?app= filter, and left-joins operator email from users.
 *
 * Query params:
 *   ?limit=<n>   — max rows (default 25, clamped 1–100)
 *   ?offset=<n>  — pagination offset (default 0)
 *   ?app=<name>  — filter by payload app name (exact match)
 *
 * Response: { failures: [...], totalCount: n }
 *
 * TRIB-152
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireSystemAdmin, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'vendor-sources-failures' });

interface FailureRow {
  id: string;
  status: string;
  payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  processing_started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  dedupe_key: string | null;
}

interface FailureRowWithEmail extends FailureRow {
  triggeredByEmail: string | null;
}

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get('limit');
  const limit = rawLimit
    ? Math.min(Math.max(parseInt(rawLimit, 10) || 25, 1), 100)
    : 25;

  const rawOffset = searchParams.get('offset');
  const offset = rawOffset ? Math.max(parseInt(rawOffset, 10) || 0, 0) : 0;

  const appFilter = searchParams.get('app');

  // Fetch rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rowQuery = (supabaseAdmin as any)
    .from('jobs')
    .select(
      'id, status, payload, error, created_at, processing_started_at, completed_at, attempt_count, dedupe_key',
    )
    .eq('type', 'ingest_vendor_docs')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (appFilter) {
    rowQuery = rowQuery.filter('payload->>app', 'eq', appFilter);
  }

  const { data: rows, error: rowError } = await rowQuery as {
    data: FailureRow[] | null;
    error: { message: string } | null;
  };

  if (rowError) {
    logger.error('Failed to fetch failed vendor-source jobs', {
      error: new Error(rowError.message),
    });
    return errors.internalError();
  }

  // Count query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabaseAdmin as any)
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'ingest_vendor_docs')
    .eq('status', 'failed');

  if (appFilter) {
    countQuery = countQuery.filter('payload->>app', 'eq', appFilter);
  }

  const { count: totalCount, error: countError } = await countQuery as {
    count: number | null;
    error: { message: string } | null;
  };

  if (countError) {
    logger.warn('Count query failed for failures endpoint — returning rows without total', {
      error: new Error(countError.message),
    });
  }

  // Resolve operator emails (best-effort per row; skip join entirely if payload
  // has no triggered_by_user_id to avoid unnecessary DB calls)
  const failures: FailureRowWithEmail[] = await Promise.all(
    (rows ?? []).map(async (row) => {
      const triggeredByUserId = row.payload?.triggered_by_user_id as string | undefined;
      if (!triggeredByUserId) {
        return { ...row, triggeredByEmail: null };
      }

      try {
        const { data: userRow } = await (supabaseAdmin as any)
          .from('user')
          .select('email')
          .eq('id', triggeredByUserId)
          .maybeSingle() as { data: { email: string } | null };

        return { ...row, triggeredByEmail: userRow?.email ?? null };
      } catch {
        return { ...row, triggeredByEmail: null };
      }
    }),
  );

  return successResponse({
    failures,
    totalCount: totalCount ?? failures.length,
  });
});
