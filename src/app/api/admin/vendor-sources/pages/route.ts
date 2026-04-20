/**
 * GET /api/admin/vendor-sources/pages
 *
 * System-admin-only. Paginated list of vendor_wiki_pages rows.
 * Accepts ?app=<string> to filter by app, ?offset=<n> for pagination.
 * Returns 50 rows per page by default (consistent with other admin list endpoints).
 *
 * Feeds TRIB-149 / TRIB-152.
 *
 * TRIB-146
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PAGE_SIZE = 50;

export const GET = apiHandler(async (request: NextRequest) => {
  await requireSystemAdmin();

  const { searchParams } = new URL(request.url);
  const app = searchParams.get('app') ?? undefined;
  const rawOffset = searchParams.get('offset');
  const offset = rawOffset ? parseInt(rawOffset, 10) : 0;

  if (Number.isNaN(offset) || offset < 0) {
    return errors.badRequest('offset must be a non-negative integer');
  }

  let query = (supabaseAdmin as any)
    .from('vendor_wiki_pages')
    .select(
      'id, app, screen, source_url, content_hash, created_at, updated_at, vendor_source_id',
      { count: 'exact' },
    )
    .order('app', { ascending: true })
    .order('screen', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (app) {
    query = query.eq('app', app);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[VendorSourcesPages] Failed to list pages:', error);
    return errors.internalError();
  }

  const total = count ?? 0;
  const nextOffset = offset + PAGE_SIZE < total ? offset + PAGE_SIZE : null;

  return successResponse({
    pages: data ?? [],
    pagination: {
      offset,
      limit: PAGE_SIZE,
      total,
      nextOffset,
    },
  });
});
