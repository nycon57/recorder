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
import type { FeedbackType } from '@/lib/types/database';

const feedbackSchema = z.object({
  agent_activity_log_id: z.string().uuid('Invalid activity log ID'),
  feedback_type: z.enum(['thumbs_up', 'thumbs_down', 'correction', 'rating']),
  score: z.number().int().min(1).max(5).optional(),
  correction_value: z.string().max(2000).optional(),
  comment: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Submit feedback on an agent action. Upserts so repeated submissions
 * from the same user on the same activity log update the existing record.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const body = await parseBody<z.infer<typeof feedbackSchema>>(request, feedbackSchema);

  const supabase = createClient();

  const { data: activity, error: activityError } = await supabase
    .from('agent_activity_log')
    .select('id, org_id')
    .eq('id', body.agent_activity_log_id)
    .maybeSingle();

  if (activityError) {
    console.error('[POST /api/agent-feedback] Activity lookup error:', activityError);
    return errors.internalError();
  }

  if (!activity) {
    return errors.notFound('Activity log entry not found');
  }

  if (activity.org_id !== orgId) {
    return errors.forbidden();
  }

  const { data: feedback, error: upsertError } = await supabase
    .from('agent_feedback')
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        agent_activity_log_id: body.agent_activity_log_id,
        feedback_type: body.feedback_type as FeedbackType,
        score: body.score ?? null,
        correction_value: body.correction_value ?? null,
        comment: body.comment ?? null,
        metadata: body.metadata ?? {},
      },
      { onConflict: 'agent_activity_log_id,user_id' }
    )
    .select('id, feedback_type, created_at')
    .single();

  if (upsertError || !feedback) {
    console.error('[POST /api/agent-feedback] Upsert error:', upsertError);
    return errors.internalError();
  }

  return successResponse({ feedback }, undefined, 201);
});
