/**
 * GET /api/admin/vendor-sources/jobs
 *
 * System-admin-only. Returns recent `ingest_vendor_docs` job rows.
 *
 * Query params:
 *   ?limit=<n>     — max rows (default 10, clamped to 50)
 *   ?status=<s>    — filter by status (pending|processing|completed|failed)
 *
 * Feeds the RecentIngestJobs strip on the vendor-sources dashboard.
 * Poll cadence: 5 s (two cold queries per operator per 5 s is acceptable;
 * jobs table is indexed on type + created_at).
 *
 * TRIB-149
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireSystemAdmin, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
type JobStatus = (typeof VALID_STATUSES)[number];

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);

  const rawLimit = searchParams.get('limit');
  const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10), 1), 50) : 10;

  if (Number.isNaN(limit)) {
    return errors.badRequest('limit must be a positive integer');
  }

  const statusParam = searchParams.get('status');
  if (statusParam && !VALID_STATUSES.includes(statusParam as JobStatus)) {
    return errors.badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any).from('jobs')
    .select(
      'id, status, payload, error, created_at, processing_started_at, completed_at, attempt_count, dedupe_key',
    )
    .eq('type', 'ingest_vendor_docs')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusParam) {
    query = query.eq('status', statusParam);
  }

  const { data: jobs, error: queryError } = await query as {
    data: {
      id: string;
      status: string;
      payload: Record<string, unknown> | null;
      error: string | null;
      created_at: string;
      processing_started_at: string | null;
      completed_at: string | null;
      attempt_count: number;
      dedupe_key: string | null;
    }[] | null;
    error: { message: string } | null;
  };

  if (queryError) {
    console.error('[VendorSourcesJobs] Failed to fetch jobs:', queryError);
    return errors.internalError();
  }

  return successResponse({ jobs: jobs ?? [] });
});
