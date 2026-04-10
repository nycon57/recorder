import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ContentViewEvent, LearningPathItem } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/onboarding/engagement
 * Record engagement signals on onboarding content.
 *
 * Body: { contentView?: ContentViewEvent, searchQuery?: string, chatQuestion?: string }
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest('Invalid JSON in request body');
  }
  const { contentView, searchQuery, chatQuestion } = body as {
    contentView?: ContentViewEvent;
    searchQuery?: string;
    chatQuestion?: string;
  };

  if (!contentView && !searchQuery && !chatQuestion) {
    return errors.badRequest('At least one engagement signal is required');
  }

  if (contentView) {
    if (!contentView.contentId || typeof contentView.contentId !== 'string') {
      return errors.badRequest('contentView.contentId is required');
    }
    if (typeof contentView.durationSec !== 'number' || contentView.durationSec < 0 || contentView.durationSec > 86400) {
      return errors.badRequest('contentView.durationSec must be between 0 and 86400');
    }
  }

  const { data: plan, error: fetchError } = await supabaseAdmin
    .from('agent_onboarding_plans')
    .select('id, engagement_data, learning_path')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('plan_status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('[onboarding/engagement] Error fetching plan:', fetchError);
    return errors.internalError();
  }

  if (!plan) {
    return errors.notFound('Onboarding plan');
  }

  if (contentView) {
    const learningPath = (plan.learning_path ?? []) as LearningPathItem[];
    const validIds = new Set(learningPath.map((item) => item.contentId));
    if (!validIds.has(contentView.contentId)) {
      return errors.badRequest('contentId is not in the learning path');
    }
  }

  // Use DB-level atomic merge to prevent lost updates under concurrency
  const contentViewParam = contentView
    ? JSON.stringify({
        contentId: contentView.contentId,
        viewedAt: contentView.viewedAt || new Date().toISOString(),
        durationSec: contentView.durationSec,
      })
    : null;

  const { error: rpcError } = await supabaseAdmin.rpc(
    'append_onboarding_engagement',
    {
      p_plan_id: plan.id,
      p_content_view: contentViewParam,
      p_search_query: searchQuery?.trim() || null,
      p_chat_question: chatQuestion?.trim() || null,
    } as Record<string, unknown>
  );

  if (rpcError) {
    console.error('[onboarding/engagement] Error updating engagement:', rpcError);
    return errors.internalError();
  }

  return successResponse({ recorded: true });
});
