import { NextRequest } from 'next/server';

import {
  apiHandler,
  errorResponse,
  successResponse,
} from '@/lib/utils/api';
import { createVendorSourceSyncService } from '@/lib/services/vendor-source-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!cronSecret) {
      console.error('[cron/vendor-doc-sync] CRON_SECRET not set in production');
      return errorResponse(
        'Unauthorized - CRON_SECRET not configured',
        'UNAUTHORIZED',
        401,
      );
    }

    const bearerOk = authHeader === `Bearer ${cronSecret}`;
    const cronHeaderOk = Boolean(vercelCronHeader);
    if (!bearerOk && !cronHeaderOk) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }
  } else if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  const startedAt = Date.now();
  try {
    const syncService = createVendorSourceSyncService();
    const results = await syncService.scheduleSources({ mode: 'scheduled' });
    const elapsedMs = Date.now() - startedAt;

    const summary = results.reduce(
      (accumulator, result) => {
        accumulator[result.status] += 1;
        return accumulator;
      },
      {
        queued: 0,
        skipped: 0,
        unsupported: 0,
        missing: 0,
      },
    );

    console.log(
      `[cron/vendor-doc-sync] queued=${summary.queued} skipped=${summary.skipped} unsupported=${summary.unsupported} missing=${summary.missing} elapsedMs=${elapsedMs}`,
    );

    return successResponse({
      success: true,
      elapsed_ms: elapsedMs,
      summary,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cron/vendor-doc-sync] Sync run failed:', message);
    return errorResponse(
      `Vendor doc sync failed: ${message}`,
      'VENDOR_DOC_SYNC_FAILED',
      500,
    );
  }
}

export const GET = apiHandler(handle);
export const POST = apiHandler(handle);
