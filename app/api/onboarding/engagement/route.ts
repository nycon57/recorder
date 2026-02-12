import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { EngagementData, ContentViewEvent, Json, LearningPathItem } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/onboarding/engagement
 * Record engagement signals on onboarding content.
 *
 * Body: { contentView?: ContentViewEvent, searchQuery?: string, chatQuestion?: string }
 */
export const PATCH = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();

  const body = await request.json();
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

  // Validate contentView.contentId is part of the plan's learning path
  if (contentView) {
    const learningPath = (plan.learning_path ?? []) as LearningPathItem[];
    const validIds = new Set(learningPath.map((item) => item.contentId));
    if (!validIds.has(contentView.contentId)) {
      return errors.badRequest('contentId is not in the learning path');
    }
  }

  const existing = (plan.engagement_data ?? {}) as Partial<EngagementData>;
  const engagement: EngagementData = {
    viewedContent: existing.viewedContent ?? [],
    searchQueries: existing.searchQueries ?? [],
    chatQuestions: existing.chatQuestions ?? [],
  };

  if (contentView) {
    const existingIndex = engagement.viewedContent.findIndex(
      (v) => v.contentId === contentView.contentId,
    );
    const event: ContentViewEvent = {
      contentId: contentView.contentId,
      viewedAt: contentView.viewedAt || new Date().toISOString(),
      durationSec: contentView.durationSec,
    };
    if (existingIndex >= 0) {
      // Accumulate duration for repeat views
      event.durationSec += engagement.viewedContent[existingIndex].durationSec;
      engagement.viewedContent[existingIndex] = event;
    } else {
      engagement.viewedContent.push(event);
    }
  }

  if (searchQuery && typeof searchQuery === 'string') {
    const trimmed = searchQuery.trim();
    if (trimmed && !engagement.searchQueries.includes(trimmed)) {
      engagement.searchQueries.push(trimmed);
    }
  }

  if (chatQuestion && typeof chatQuestion === 'string') {
    const trimmed = chatQuestion.trim();
    if (trimmed) {
      engagement.chatQuestions.push(trimmed);
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('agent_onboarding_plans')
    .update({
      engagement_data: engagement as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', plan.id);

  if (updateError) {
    console.error('[onboarding/engagement] Error updating engagement:', updateError);
    return errors.internalError();
  }

  return successResponse({ recorded: true });
});
