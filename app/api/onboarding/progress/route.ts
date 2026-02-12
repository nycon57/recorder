import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { LearningPathItem } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/onboarding/progress
 * Mark a learning path item as complete or incomplete.
 *
 * Body: { contentId: string, completed?: boolean }
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();

  const body = await request.json();
  const { contentId, completed = true } = body;

  if (!contentId || typeof contentId !== 'string') {
    return errors.badRequest('contentId is required');
  }

  const { data: plan, error: fetchError } = await supabaseAdmin
    .from('agent_onboarding_plans')
    .select('id, learning_path, completed_items, total_items, plan_status')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('plan_status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('[onboarding/progress] Error fetching plan:', fetchError);
    return errors.internalError();
  }

  if (!plan) {
    return errors.notFound('Active onboarding plan');
  }

  const learningPath = (plan.learning_path ?? []) as LearningPathItem[];
  const itemIndex = learningPath.findIndex((item) => item.contentId === contentId);

  if (itemIndex === -1) {
    return errors.notFound('Learning path item');
  }

  learningPath[itemIndex] = {
    ...learningPath[itemIndex],
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  };

  const completedItems = learningPath.filter((item) => item.completed).length;
  const totalItems = plan.total_items ?? learningPath.length;
  const newStatus = completedItems >= totalItems ? 'completed' : 'active';

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('agent_onboarding_plans')
    .update({
      learning_path: learningPath,
      completed_items: completedItems,
      plan_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', plan.id)
    .select('id, plan_status, completed_items, total_items, learning_path')
    .single();

  if (updateError) {
    console.error('[onboarding/progress] Error updating plan:', updateError);
    return errors.internalError();
  }

  return successResponse(updated);
});
