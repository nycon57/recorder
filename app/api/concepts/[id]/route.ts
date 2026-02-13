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
    (data) => {
      // At least one field must be provided
      return (
        data.name !== undefined ||
        data.concept_type !== undefined ||
        data.description !== undefined ||
        data.merge_into_id !== undefined ||
        data.marked_incorrect !== undefined
      );
    },
    { message: 'At least one field must be provided' }
  );

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/concepts/[id] - Update a concept or merge it into another.
 *
 * Supports renaming, changing type, updating description,
 * merging into another concept, or marking as incorrect.
 * Every correction is logged in agent_feedback.
 */
export const PATCH = apiHandler(async (request: NextRequest, { params }: RouteParams) => {
  const { userId, orgId } = await requireOrg();
  const { id } = await params;
  const body = await parseBody<z.infer<typeof patchSchema>>(request, patchSchema);

  const supabase = createClient();

  // Verify the concept exists and belongs to this org
  const { data: concept, error: fetchError } = await supabase
    .from('knowledge_concepts')
    .select('id, org_id, name, concept_type')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (fetchError) {
    console.error('[PATCH /api/concepts] Fetch error:', fetchError);
    return errors.internalError();
  }

  if (!concept) {
    return errors.notFound('Concept');
  }

  // --- Handle merge ---
  if (body.merge_into_id) {
    if (body.merge_into_id === id) {
      return errors.badRequest('Cannot merge a concept into itself');
    }

    // Verify target concept exists in same org
    const { data: target, error: targetError } = await supabase
      .from('knowledge_concepts')
      .select('id, name')
      .eq('id', body.merge_into_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (targetError) {
      console.error('[PATCH /api/concepts] Target lookup error:', targetError);
      return errors.internalError();
    }

    if (!target) {
      return errors.notFound('Target concept');
    }

    // Reassign all concept_mentions from old concept to target
    const { error: mentionError } = await supabase
      .from('concept_mentions')
      .update({ concept_id: body.merge_into_id })
      .eq('concept_id', id)
      .eq('org_id', orgId);

    if (mentionError) {
      console.error('[PATCH /api/concepts] Mention reassign error:', mentionError);
      return errors.internalError();
    }

    // Update the target concept's mention_count
    const { count } = await supabase
      .from('concept_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('concept_id', body.merge_into_id);

    if (count !== null) {
      await supabase
        .from('knowledge_concepts')
        .update({ mention_count: count })
        .eq('id', body.merge_into_id);
    }

    // Delete the old concept
    await supabase
      .from('knowledge_concepts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    // Log merge correction
    await logCorrection(supabase, {
      orgId,
      userId,
      correctionValue: `Merged "${concept.name}" into "${target.name}"`,
      metadata: {
        action: 'merge',
        sourceConceptId: id,
        sourceConceptName: concept.name,
        targetConceptId: body.merge_into_id,
        targetConceptName: target.name,
      },
    });

    return successResponse({
      merged: true,
      sourceId: id,
      targetId: body.merge_into_id,
    });
  }

  // --- Handle mark as incorrect ---
  if (body.marked_incorrect) {
    // Delete concept_mentions first (FK), then delete concept
    await supabase
      .from('concept_mentions')
      .delete()
      .eq('concept_id', id)
      .eq('org_id', orgId);

    await supabase
      .from('knowledge_concepts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    await logCorrection(supabase, {
      orgId,
      userId,
      correctionValue: `Marked "${concept.name}" as incorrect`,
      metadata: {
        action: 'mark_incorrect',
        conceptId: id,
        conceptName: concept.name,
        conceptType: concept.concept_type,
      },
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

  if (updateError) {
    console.error('[PATCH /api/concepts] Update error:', updateError);
    return errors.internalError();
  }

  // Log the correction
  await logCorrection(supabase, {
    orgId,
    userId,
    correctionValue: changes.join('; '),
    metadata: {
      action: 'update',
      conceptId: id,
      changes: changes,
      before: { name: concept.name, concept_type: concept.concept_type },
      after: updates,
    },
  });

  return successResponse({ concept: updated, changed: true });
});

/** Log a concept correction to agent_feedback */
async function logCorrection(
  supabase: ReturnType<typeof createClient>,
  params: {
    orgId: string;
    userId: string;
    correctionValue: string;
    metadata: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from('agent_feedback').insert({
    org_id: params.orgId,
    user_id: params.userId,
    feedback_type: 'correction' as FeedbackType,
    correction_value: params.correctionValue,
    metadata: params.metadata,
  });

  if (error) {
    console.error('[PATCH /api/concepts] Failed to log correction:', error);
  }
}
