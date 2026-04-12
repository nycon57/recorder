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

/**
 * POST /api/admin/vendor-docs/ingest
 * Enqueue a vendor doc ingestion job
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Auth: require org admin role
  const { orgId } = await requireAdmin();

  let body: { url?: string; app?: string; maxPages?: number };
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  const { url, app, maxPages } = body;

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

  // Enqueue the job
  const payload: Json = {
    url,
    app,
    ...(maxPages ? { maxPages } : {}),
  };

  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .insert({
      type: 'ingest_vendor_docs',
      status: 'pending',
      payload,
      priority: 2, // NORMAL priority — background operation
    })
    .select('id, type, status, created_at')
    .single();

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
    },
    undefined,
    201
  );
});
