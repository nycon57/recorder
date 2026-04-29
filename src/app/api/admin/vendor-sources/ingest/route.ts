/**
 * POST /api/admin/vendor-sources/ingest
 *
 * System-admin-only route that enqueues an `ingest_vendor_docs` background job.
 * Canonical endpoint post-TRIB-146 relocation. Accepts { sourceId, force? }
 * to re-sync a registered vendor source.
 *
 * The triggered_by_user_id field in the job payload provides audit provenance
 * for all system-admin-initiated ingestions.
 *
 * TRIB-45 | Security: TRIB-156 | Canonical home: TRIB-146 | Schema unified: TRIB-149
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createVendorSourceSyncService } from '@/lib/services/vendor-source-sync';
import { vendorResyncInputSchema } from '@/lib/schemas/vendor-source';

/**
 * POST /api/admin/vendor-sources/ingest
 * Enqueue a vendor doc ingestion job
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Auth: system-admin only — canonical vendor corpus is platform-scoped
  const session = await requireSystemAdmin();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  // Shared audit field — plumbed into every job payload for provenance
  const triggeredByUserId: string = session.userId;

  // Source-driven ingestion only. Raw URL/app jobs bypass governed source
  // review and let stale payloads drive the worker.
  const bodyObj = rawBody as Record<string, unknown>;
  if (bodyObj && typeof bodyObj === 'object' && 'sourceId' in bodyObj) {
    const parsed = vendorResyncInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      return errors.badRequest(msg);
    }

    const { sourceId, force, maxPages } = parsed.data;
    const syncService = createVendorSourceSyncService();
    const [result] = await syncService.scheduleSources({
      sourceId,
      mode: 'manual',
      force: force ?? true,
      maxPages,
      triggeredByUserId,
    });

    if (!result || result.status === 'missing') {
      return errors.notFound('Vendor source');
    }

    if (result.status === 'unsupported') {
      return errors.badRequest(result.reason ?? 'Vendor source is not syncable');
    }

    return successResponse(
      {
        sourceId,
        jobId: result.jobId ?? null,
        status: result.status,
        message:
          result.status === 'queued'
            ? 'Vendor source re-sync job enqueued successfully'
            : result.reason ?? 'Vendor source sync was skipped',
      },
      undefined,
      result.status === 'queued' ? 201 : 200,
    );
  }

  return errors.badRequest(
    'Vendor doc ingestion now requires a registered vendor sourceId',
  );
});
