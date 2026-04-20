/**
 * DELETE /api/admin/vendor-sources/pages/[id]
 *
 * System-admin-only. Governance endpoint for removing a vendor_wiki_pages row.
 * Hard-deletes the row (no soft-delete column on the table).
 * Logs a structured `vendor_source.page.deleted` event for audit provenance.
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
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'vendor-sources-pages' });

export const DELETE = apiHandler(
  async (_request: NextRequest, context: { params: { id: string } }) => {
    const session = await requireSystemAdmin();

    const { id } = await Promise.resolve(context.params);

    if (!id || typeof id !== 'string') {
      return errors.badRequest('Missing page id');
    }

    // Fetch before delete so we can log with context
    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from('vendor_wiki_pages')
      .select('id, app, screen, source_url')
      .eq('id', id)
      .single() as {
        data: { id: string; app: string; screen: string; source_url: string | null } | null;
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
