/**
 * POST /api/admin/vendor-docs/ingest
 *
 * Admin-only route that enqueues an `ingest_vendor_docs` background job.
 * Accepts { url, app, maxPages? } and creates a pending job row that the
 * worker will pick up and execute.
 *
 * TRIB-45
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';
import { createVendorSourceRegistryService } from '@/lib/services/vendor-source-registry';
import { createVendorSourceSyncService } from '@/lib/services/vendor-source-sync';

/**
 * POST /api/admin/vendor-docs/ingest
 * Enqueue a vendor doc ingestion job
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Auth: require org admin role
  const { orgId } = await requireAdmin();

  let body: {
    url?: string;
    app?: string;
    maxPages?: number;
    sourceId?: string;
    force?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  const { url, app, maxPages, sourceId, force } = body;

  if (sourceId && typeof sourceId !== 'string') {
    return errors.badRequest('sourceId must be a string when provided');
  }

  if (sourceId) {
    const syncService = createVendorSourceSyncService();
    const [result] = await syncService.scheduleSources({
      sourceId,
      mode: 'manual',
      force: force ?? true,
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

  // Validate required fields
  if (!url || typeof url !== 'string') {
    return errors.badRequest('Missing or invalid "url" field');
  }

  if (!app || typeof app !== 'string') {
    return errors.badRequest('Missing or invalid "app" field');
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) {
      return errors.badRequest('URL must use http or https protocol');
    }
  } catch {
    return errors.badRequest('Invalid URL format');
  }

  // Validate maxPages if provided
  if (maxPages !== undefined) {
    if (typeof maxPages !== 'number' || maxPages < 1 || maxPages > 500) {
      return errors.badRequest('maxPages must be a number between 1 and 500');
    }
  }

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

  // Enqueue the job
  const payload: Json = {
    url,
    app,
    syncType: 'manual',
    ...(maxPages ? { maxPages } : {}),
  };

  const { data: job, error } = await (supabaseAdmin
    .from('jobs') as any)
    .insert({
      type: 'ingest_vendor_docs',
      status: 'pending',
      payload,
      priority: 2, // NORMAL priority — background operation
    })
    .select('id, type, status, created_at')
    .single() as {
      data: { id: string; type: string; status: string } | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error('[VendorDocsIngest] Failed to enqueue job:', error);
    return errors.badRequest('Failed to enqueue ingestion job');
  }

  return successResponse(
    {
      jobId: job!.id,
      type: job!.type,
      status: job!.status,
      message: `Vendor doc ingestion job enqueued for ${app} (${url})`,
      orgId,
    },
    undefined,
    201
  );
});
