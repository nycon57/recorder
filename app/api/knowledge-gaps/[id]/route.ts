import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const patchSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('acknowledged') }),
  z.object({
    status: z.literal('dismissed'),
    rejection_reason: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    status: z.literal('resolved'),
    resolved_by_content_id: z.string().uuid().nullable().optional(),
  }),
]);

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/knowledge-gaps/[id] - Update the status of a knowledge gap. */
export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { orgId } = await requireOrg();
  const { id } = await params;
  const body = await parseBody<z.infer<typeof patchSchema>>(request, patchSchema);

  // Verify the gap exists and belongs to this org. Also fetch metadata for merge on dismiss.
  const { data: gap, error: fetchError } = await supabaseAdmin
    .from('knowledge_gaps')
    .select('id, org_id, metadata')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('[PATCH /api/knowledge-gaps]', fetchError);
    throw new Error('Failed to fetch knowledge gap');
  }

  if (!gap) return errors.notFound('Knowledge gap');
  if (gap.org_id !== orgId) return errors.forbidden();

  const updates: Record<string, unknown> = { status: body.status };

  if (body.status === 'dismissed') {
    // Merge into existing metadata so bus_factor and other fields are preserved.
    const existingMetadata = (gap.metadata as Record<string, unknown>) ?? {};
    updates.metadata = { ...existingMetadata, rejection_reason: body.rejection_reason ?? null };
  }

  if (body.status === 'resolved') {
    if (body.resolved_by_content_id) {
      updates.resolved_by_content_id = body.resolved_by_content_id;
    }
    updates.resolved_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('knowledge_gaps')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (updateError) {
    console.error('[PATCH /api/knowledge-gaps]', updateError);
    throw new Error('Failed to update knowledge gap');
  }

  // Fetch the linked content title for traceability when resolving.
  let resolvedContentTitle: string | null = null;
  if (body.status === 'resolved' && body.resolved_by_content_id) {
    const { data: content } = await supabaseAdmin
      .from('content')
      .select('title')
      .eq('id', body.resolved_by_content_id)
      .maybeSingle();
    resolvedContentTitle = content?.title ?? null;
  }

  return successResponse({ gap: updated, resolvedContentTitle });
});
