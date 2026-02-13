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
    (data) =>
      data.name !== undefined ||
      data.concept_type !== undefined ||
      data.description !== undefined ||
      data.merge_into_id !== undefined ||
      data.marked_incorrect !== undefined,
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

  const log = (correctionValue: string, metadata: Record<string, unknown>) =>
    logCorrection(supabase, { orgId, userId, correctionValue, metadata });

  // --- Handle merge ---
  if (body.merge_into_id) {
    if (body.merge_into_id === id) {
      return errors.badRequest('Cannot merge a concept into itself');
    }

    const { data: target, error: targetError } = await supabase
      .from('knowledge_concepts')
      .select('id, name')
      .eq('id', body.merge_into_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (targetError) return logAndFail('Target lookup error', targetError);
    if (!target) return errors.notFound('Target concept');

    const { error: mentionError } = await supabase
      .from('concept_mentions')
      .update({ concept_id: body.merge_into_id })
      .eq('concept_id', id)
      .eq('org_id', orgId);

    if (mentionError) return logAndFail('Mention reassign error', mentionError);

    const { count, error: countError } = await supabase
      .from('concept_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('concept_id', body.merge_into_id)
      .eq('org_id', orgId);

    if (countError) return logAndFail('Mention count error', countError);

    if (count !== null) {
      const { error: updateCountError } = await supabase
        .from('knowledge_concepts')
        .update({ mention_count: count })
        .eq('id', body.merge_into_id)
        .eq('org_id', orgId);

      if (updateCountError) return logAndFail('Update mention count error', updateCountError);
    }

    const { error: deleteError } = await supabase
      .from('knowledge_concepts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (deleteError) return logAndFail('Delete source concept error', deleteError);

    await log(`Merged "${concept.name}" into "${target.name}"`, {
      action: 'merge',
      sourceConceptId: id,
      sourceConceptName: concept.name,
      targetConceptId: body.merge_into_id,
      targetConceptName: target.name,
    });

    return successResponse({ merged: true, sourceId: id, targetId: body.merge_into_id });
  }

  // --- Handle mark as incorrect ---
  if (body.marked_incorrect) {
    const { error: deleteMentionsError } = await supabase
      .from('concept_mentions')
      .delete()
      .eq('concept_id', id)
      .eq('org_id', orgId);

    if (deleteMentionsError) return logAndFail('Delete mentions error', deleteMentionsError);

    const { error: deleteConceptError } = await supabase
      .from('knowledge_concepts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (deleteConceptError) return logAndFail('Delete concept error', deleteConceptError);

    await log(`Marked "${concept.name}" as incorrect`, {
      action: 'mark_incorrect',
      conceptId: id,
      conceptName: concept.name,
      conceptType: concept.concept_type,
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

  await log(changes.join('; '), {
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

async function logCorrection(
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
