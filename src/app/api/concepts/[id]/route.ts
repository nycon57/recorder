import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { processFeedback } from '@/lib/services/feedback-processor';
import { CONCEPT_TYPES } from '@/lib/validations/knowledge';
import type { FeedbackType } from '@/lib/types/database';

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    concept_type: z.enum(CONCEPT_TYPES).optional(),
    description: z.string().max(1000).nullable().optional(),
    merge_into_id: z.string().uuid().optional(),
    marked_incorrect: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' }
  );

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/concepts/[id] - Rename, retype, merge, or remove a concept. */
export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { userId, orgId } = await requireOrg();
  const { id } = await params;
  const body = await parseBody<z.infer<typeof patchSchema>>(request, patchSchema);

  const supabase = createClient();

  const { data: concept, error: fetchError } = await supabase
    .from('knowledge_concepts')
    .select('id, org_id, name, concept_type')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (fetchError) return logAndFail('Fetch error', fetchError);
  if (!concept) return errors.notFound('Concept');

  const recordCorrection = (correctionValue: string, metadata: Record<string, unknown>) =>
    recordCorrectionFeedback(supabase, { orgId, userId, correctionValue, metadata });

  // --- Handle merge (transactional via DB function) ---
  if (body.merge_into_id) {
    if (body.merge_into_id === id) {
      return errors.badRequest('Cannot merge a concept into itself');
    }

    const { data: mergeResult, error: mergeError } = await supabaseAdmin.rpc(
      'merge_concepts',
      { source_id: id, target_id: body.merge_into_id, p_org_id: orgId } as Record<string, unknown>
    );

    if (mergeError) return logAndFail('Merge concepts error', mergeError);
    if (!mergeResult) return logAndFail('Merge concepts returned no data', null);

    const result = mergeResult as {
      source_id: string;
      source_name: string;
      target_id: string;
      target_name: string;
    };

    await recordCorrection(`Merged "${result.source_name}" into "${result.target_name}"`, {
      action: 'merge',
      sourceConceptId: result.source_id,
      sourceConceptName: result.source_name,
      targetConceptId: result.target_id,
      targetConceptName: result.target_name,
    });

    return successResponse({ merged: true, sourceId: id, targetId: body.merge_into_id });
  }

  // --- Handle mark as incorrect (transactional via DB function) ---
  if (body.marked_incorrect) {
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc(
      'delete_concept_with_mentions',
      { p_concept_id: id, p_org_id: orgId } as Record<string, unknown>
    );

    if (deleteError) return logAndFail('Delete concept error', deleteError);
    if (!deleteResult) return logAndFail('Delete concept returned no data', null);

    const result = deleteResult as {
      concept_id: string;
      concept_name: string;
      concept_type: string;
    };

    await recordCorrection(`Marked "${result.concept_name}" as incorrect`, {
      action: 'mark_incorrect',
      conceptId: result.concept_id,
      conceptName: result.concept_name,
      conceptType: result.concept_type,
    });

    return successResponse({ deleted: true, id });
  }

  // --- Handle field updates (rename, type change, description) ---
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.name !== undefined && body.name !== concept.name) {
    updates.name = body.name;
    updates.normalized_name = body.name.toLowerCase().trim().replace(/\s+/g, '_');
    changes.push(`Renamed "${concept.name}" to "${body.name}"`);
  }

  if (body.concept_type !== undefined && body.concept_type !== concept.concept_type) {
    updates.concept_type = body.concept_type;
    changes.push(`Changed type from "${concept.concept_type}" to "${body.concept_type}"`);
  }

  if (body.description !== undefined) {
    updates.description = body.description;
    changes.push('Updated description');
  }

  if (Object.keys(updates).length === 0) {
    return successResponse({ concept, changed: false });
  }

  const { data: updated, error: updateError } = await supabase
    .from('knowledge_concepts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (updateError) return logAndFail('Update error', updateError);

  await recordCorrection(changes.join('; '), {
    action: 'update',
    conceptId: id,
    changes,
    before: { name: concept.name, concept_type: concept.concept_type },
    after: updates,
  });

  return successResponse({ concept: updated, changed: true });
});

function logAndFail(label: string, err: unknown) {
  console.error(`[PATCH /api/concepts] ${label}:`, err);
  return errors.internalError();
}

async function recordCorrectionFeedback(
  supabase: ReturnType<typeof createClient>,
  params: {
    orgId: string;
    userId: string;
    correctionValue: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  const { data, error } = await supabase
    .from('agent_feedback')
    .insert({
      org_id: params.orgId,
      user_id: params.userId,
      feedback_type: 'correction' as FeedbackType,
      correction_value: params.correctionValue,
      metadata: params.metadata,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[PATCH /api/concepts] Failed to log correction:', error);
    return;
  }

  processFeedback(data.id).catch((err) =>
    console.error('[PATCH /api/concepts] processFeedback failed:', err)
  );
}
