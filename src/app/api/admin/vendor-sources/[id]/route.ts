import { NextRequest } from 'next/server';

import {
  apiHandler,
  errors,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { vendorSourceUpdateSchema } from '@/lib/schemas/vendor-source';

export const PATCH = apiHandler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    if (!id || typeof id !== 'string') {
      return errors.badRequest('Missing source id');
    }

    const [session, rawBody] = await Promise.all([
      requireSystemAdmin(),
      request.json().catch(() => null),
    ]);
    const parsed = vendorSourceUpdateSchema.safeParse(rawBody);

    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    if (parsed.data.lifecycle === 'retired') {
      return errors.badRequest(
        'Retire vendor sources through the dedicated retirement endpoint so audit fields are captured',
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      updated_at: now,
    };

    if (parsed.data.lifecycle) {
      patch.lifecycle = parsed.data.lifecycle;
    }

    if (parsed.data.termsReviewStatus) {
      patch.terms_review_status = parsed.data.termsReviewStatus;
    }

    if (
      'legalReviewReferenceUrl' in parsed.data ||
      'legalReviewNotes' in parsed.data
    ) {
      patch.legal_reviewed_at = now;
      patch.legal_reviewed_by = session.userId;
      if ('legalReviewReferenceUrl' in parsed.data) {
        patch.legal_review_reference_url =
          parsed.data.legalReviewReferenceUrl ?? null;
      }
      if ('legalReviewNotes' in parsed.data) {
        patch.legal_review_notes = parsed.data.legalReviewNotes ?? null;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('vendor_doc_sources')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return errors.internalError();
    }

    if (!data) {
      return errors.notFound('Vendor source');
    }

    return successResponse({ source: data });
  },
);
