/**
 * POST /api/admin/vendor-docs/ingest
 *
 * GONE — This endpoint has moved.
 *
 * System-admin-only 410 shim. The canonical vendor-source ingestion endpoint
 * is now /api/admin/vendor-sources/ingest (TRIB-146). This shim exists for one
 * release cycle to surface a clear error to any lingering callers rather than
 * silently 401/403-ing them.
 *
 * TRIB-45 | Security: TRIB-156 | Relocated: TRIB-146
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
} from '@/lib/utils/api';

/**
 * POST /api/admin/vendor-docs/ingest
 * 410 Gone — use /api/admin/vendor-sources/ingest instead.
 */
export const POST = apiHandler(async (_request: NextRequest) => {
  // Guard: still fails closed for any non-system-admin caller.
  await requireSystemAdmin();

  return Response.json(
    {
      error: 'moved',
      newPath: '/api/admin/vendor-sources/ingest',
      message:
        'This endpoint has moved. Use POST /api/admin/vendor-sources/ingest (TRIB-146).',
    },
    { status: 410 },
  );
});
