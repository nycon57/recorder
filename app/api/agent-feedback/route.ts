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
import type { FeedbackType } from '@/lib/types/database';

const feedbackSchema = z.object({
  agent_activity_log_id: z.string().uuid('Invalid activity log ID').optional(),
  feedback_type: z.enum(['thumbs_up', 'thumbs_down', 'correction', 'rating']),
  score: z.number().int().min(1).max(5).optional(),
  correction_value: z.string().max(2000).optional(),
  comment: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const FEEDBACK_SELECT = 'id, feedback_type, created_at' as const;

/** Fire-and-forget: integrate feedback into agent memory (non-blocking). */
function processInBackground(feedbackId: string): void {
  processFeedback(feedbackId).catch((err) =>
    console.error('[POST /api/agent-feedback] processFeedback failed:', err)
  );
}

/** POST /api/agent-feedback - Submit feedback on an agent action or RAG response. */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const body = await parseBody<z.infer<typeof feedbackSchema>>(request, feedbackSchema);

  const supabase = createClient();

  const feedbackFields = {
    score: body.score ?? null,
    correction_value: body.correction_value ?? null,
    comment: body.comment ?? null,
    metadata: body.metadata ?? {},
  };

  // Feedback tied to an agent activity log entry
  if (body.agent_activity_log_id) {
    const { data: activity, error: activityError } = await supabase
      .from('agent_activity_log')
      .select('id, org_id')
      .eq('id', body.agent_activity_log_id)
      .maybeSingle();

    if (activityError) {
      console.error('[POST /api/agent-feedback] Activity lookup error:', activityError);
      return errors.internalError();
    }
    if (!activity) return errors.notFound('Activity log entry not found');
    if (activity.org_id !== orgId) return errors.forbidden();

    const { data: feedback, error: upsertError } = await supabase
      .from('agent_feedback')
      .upsert(
        {
          org_id: orgId,
          user_id: userId,
          agent_activity_log_id: body.agent_activity_log_id,
          feedback_type: body.feedback_type as FeedbackType,
          ...feedbackFields,
        },
        { onConflict: 'agent_activity_log_id,user_id' }
      )
      .select(FEEDBACK_SELECT)
      .single();

    if (upsertError || !feedback) {
      console.error('[POST /api/agent-feedback] Upsert error:', upsertError);
      return errors.internalError();
    }

    processInBackground(feedback.id);

    return successResponse({ feedback }, undefined, 201);
  }

  // Direct feedback (e.g. chat response rating) -- dedup by responseId
  const responseId = body.metadata?.responseId;

  if (responseId && typeof responseId === 'string') {
    const { data: existing } = await supabase
      .from('agent_feedback')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('feedback_type', body.feedback_type)
      .contains('metadata', { responseId })
      .maybeSingle();

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('agent_feedback')
        .update({ score: feedbackFields.score, comment: feedbackFields.comment, metadata: feedbackFields.metadata })
        .eq('id', existing.id)
        .select(FEEDBACK_SELECT)
        .single();

      if (updateError || !updated) {
        console.error('[POST /api/agent-feedback] Update error:', updateError);
        return errors.internalError();
      }

      processInBackground(updated.id);

      return successResponse({ feedback: updated });
    }
  }

  const { data: feedback, error: insertError } = await supabase
    .from('agent_feedback')
    .insert({
      org_id: orgId,
      user_id: userId,
      feedback_type: body.feedback_type as FeedbackType,
      ...feedbackFields,
    })
    .select(FEEDBACK_SELECT)
    .single();

  if (insertError || !feedback) {
    console.error('[POST /api/agent-feedback] Insert error:', insertError);
    return errors.internalError();
  }

  processInBackground(feedback.id);

  return successResponse({ feedback }, undefined, 201);
});
