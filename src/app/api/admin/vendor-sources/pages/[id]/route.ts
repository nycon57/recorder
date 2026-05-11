/**
 * GET /api/admin/vendor-sources/pages/[id]
 * Single vendor_wiki_pages row with parent vendor_doc_sources context.
 * Includes `content` (markdown) and resolved `curatedByEmail` for preview + detail view.
 * Returns 404 if row is missing.
 *
 * DELETE /api/admin/vendor-sources/pages/[id]
 * System-admin-only. Governance endpoint for removing a vendor_wiki_pages row.
 * Hard-deletes the row (no soft-delete column on the table).
 * Logs a structured `vendor_source.page.deleted` event for audit provenance.
 *
 * TRIB-146 (DELETE) | TRIB-149 (GET) | TRIB-152 (content + curatedByEmail)
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'vendor-sources-pages' });

export const GET = apiHandler(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    await requireSystemAdmin();

    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return errors.badRequest('Missing page id');
    }

    const { data: page, error: pageError } = (await (supabaseAdmin as any)
      .from('vendor_wiki_pages')
      .select(
        'id, app, screen, source_url, content, content_hash, created_at, updated_at, vendor_source_id, curated_by, ingest_job_id',
      )
      .eq('id', id)
      .single()) as {
      data: {
        id: string;
        app: string;
        screen: string;
        source_url: string | null;
        content: string | null;
        content_hash: string | null;
        created_at: string;
        updated_at: string;
        vendor_source_id: string | null;
        curated_by: string | null;
        ingest_job_id: string | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

    if (pageError || !page) {
      return errors.notFound('Vendor wiki page');
    }

    // Fetch parent source context for breadcrumb / detail view
    let parentSource: {
      app: string;
      source_url: string;
      publisher_hostname: string;
      status: string;
    } | null = null;

    if (page.vendor_source_id) {
      const { data: source } = (await (supabaseAdmin as any)
        .from('vendor_doc_sources')
        .select('app, source_url, publisher_hostname, status')
        .eq('id', page.vendor_source_id)
        .single()) as {
        data: {
          app: string;
          source_url: string;
          publisher_hostname: string;
          status: string;
        } | null;
        error: unknown;
      };
      parentSource = source;
    }

    // Resolve curated_by UUID → operator email (best-effort; null on missing row)
    let curatedByEmail: string | null = null;
    if (page.curated_by) {
      try {
        const { data: userRow } = (await (supabaseAdmin as any)
          .from('user')
          .select('email')
          .eq('id', page.curated_by)
          .maybeSingle()) as { data: { email: string } | null };
        curatedByEmail = userRow?.email ?? null;
      } catch {
        // Non-fatal — fall through to null
      }
    }

    return successResponse({ page, parentSource, curatedByEmail });
  },
);

export const DELETE = apiHandler(
  async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return errors.badRequest('Missing page id');
    }

    const session = await requireSystemAdmin();
    // Fetch before delete so we can log with context
    const { data: existing, error: fetchError } = (await (supabaseAdmin as any)
      .from('vendor_wiki_pages')
      .select('id, app, screen, source_url')
      .eq('id', id)
      .single()) as {
      data: {
        id: string;
        app: string;
        screen: string;
        source_url: string | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

    if (fetchError || !existing) {
      return errors.notFound('Vendor wiki page');
    }

    const { error: deleteError } = await (supabaseAdmin as any)
      .from('vendor_wiki_pages')
      .delete()
      .eq('id', id);

    if (deleteError) {
      logger.error('Failed to delete vendor wiki page', {
        context: { id, app: existing.app, screen: existing.screen },
        error: deleteError,
      });
      return errors.internalError();
    }

    logger.info('vendor_source.page.deleted', {
      context: {
        id,
        app: existing.app,
        screen: existing.screen,
        sourceUrl: existing.source_url,
        deletedByUserId: session.userId,
        deletedByEmail: session.email,
      },
    });

    return successResponse({ deleted: true, id });
  },
);
