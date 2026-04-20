/**
 * POST /api/admin/vendor-sources/ingest
 *
 * System-admin-only route that enqueues an `ingest_vendor_docs` background job.
 * Canonical endpoint post-TRIB-146 relocation. Accepts { url, app, maxPages? }
 * or { sourceId, force? } to re-sync a registered vendor source.
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
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';
import { createVendorSourceRegistryService } from '@/lib/services/vendor-source-registry';
import { createVendorSourceSyncService } from '@/lib/services/vendor-source-sync';
import { vendorIngestInputSchema, vendorResyncInputSchema } from '@/lib/schemas/vendor-source';

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

  // Detect re-sync path (sourceId present) vs raw-URL path
  const bodyObj = rawBody as Record<string, unknown>;
  if (bodyObj && typeof bodyObj === 'object' && 'sourceId' in bodyObj) {
    const parsed = vendorResyncInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ');
      return errors.badRequest(msg);
    }

    const { sourceId, force } = parsed.data;
    const syncService = createVendorSourceSyncService();
    const [result] = await syncService.scheduleSources({
      sourceId,
      mode: 'manual',
      force: force ?? true,
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

  // Raw URL ingestion — validate with shared schema
  const parsed = vendorIngestInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return errors.badRequest(msg);
  }

  const { url, app, maxPages, force } = parsed.data;

  const syncService = createVendorSourceSyncService();
  await syncService.ensureAllowedSources();

  const registry = createVendorSourceRegistryService();
  const existingSource = await registry.findSourceForIngestion({
    app,
    sourceUrl: url,
  });

  if (existingSource) {
    const [result] = await syncService.scheduleSources({
      sourceId: existingSource.id,
      mode: 'manual',
      force: force ?? true,
      triggeredByUserId,
    });

    if (result?.status === 'unsupported') {
      return errors.badRequest(result.reason ?? 'Vendor source is not syncable');
    }

    return successResponse(
      {
        sourceId: existingSource.id,
        jobId: result?.jobId ?? null,
        status: result?.status ?? 'missing',
        message:
          result?.status === 'queued'
            ? 'Vendor source re-sync job enqueued successfully'
            : result?.reason ?? 'Vendor source sync was skipped',
      },
      undefined,
      result?.status === 'queued' ? 201 : 200,
    );
  }

  // Raw URL → enqueue directly
  const payload: Json = {
    url,
    app,
    syncType: 'manual',
    triggered_by_user_id: triggeredByUserId,
    ...(maxPages ? { maxPages } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error } = await (supabaseAdmin.from('jobs') as any)
    .insert({
      type: 'ingest_vendor_docs',
      status: 'pending',
      payload,
      priority: 2,
    })
    .select('id, type, status, created_at')
    .single() as {
      data: { id: string; type: string; status: string } | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error('[VendorSourcesIngest] Failed to enqueue job:', error);
    return errors.badRequest('Failed to enqueue ingestion job');
  }

  return successResponse(
    {
      jobId: job!.id,
      type: job!.type,
      status: job!.status,
      message: `Vendor doc ingestion job enqueued for ${app} (${url})`,
    },
    undefined,
    201,
  );
});
