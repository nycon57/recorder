/**
 * Feedback Processor
 *
 * Converts user feedback (thumbs, corrections, ratings) into agent memory
 * entries so agents learn from corrections and reinforce good patterns.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { storeMemory, recallMemory } from '@/lib/services/agent-memory';
import type { FeedbackType, Json } from '@/lib/types/database';

/** Importance scores by feedback type */
const IMPORTANCE = {
  positive: 0.9,
  negative: 0.8,
  correction: 0.95,
  low_rating: 0.8,
} as const;

/** Max importance for escalated (repeated) negative feedback */
const IMPORTANCE_CAP = 0.99;

/** Importance bump per repeated negative feedback on the same pattern */
const IMPORTANCE_BUMP = 0.05;

interface FeedbackRow {
  id: string;
  org_id: string;
  feedback_type: FeedbackType;
  agent_activity_log_id: string | null;
  score: number | null;
  correction_value: string | null;
  comment: string | null;
  metadata: Json;
}

interface ActivityRow {
  id: string;
  org_id: string;
  agent_type: string;
  action_type: string;
  content_id: string | null;
  output_summary: string | null;
  metadata: Json;
}

/**
 * Process a feedback entry and store relevant memories for agent learning.
 *
 * Safe to call multiple times for the same feedbackId (idempotent via upsert).
 * If storeMemory fails, the error is logged but does not propagate — the
 * feedback record in agent_feedback remains intact for retry on the next call.
 */
export async function processFeedback(feedbackId: string): Promise<void> {
  const { data: feedback, error: fbError } = await supabaseAdmin
    .from('agent_feedback')
    .select('id, org_id, feedback_type, agent_activity_log_id, score, correction_value, comment, metadata')
    .eq('id', feedbackId)
    .maybeSingle();

  if (fbError) {
    console.error('[FeedbackProcessor] Failed to fetch feedback:', fbError);
    return;
  }
  if (!feedback) {
    console.error('[FeedbackProcessor] Feedback not found:', feedbackId);
    return;
  }

  const fb = feedback as FeedbackRow;

  // Fetch linked activity log if present (needed for thumbs feedback context)
  let activity: ActivityRow | null = null;
  if (fb.agent_activity_log_id) {
    const { data, error } = await supabaseAdmin
      .from('agent_activity_log')
      .select('id, org_id, agent_type, action_type, content_id, output_summary, metadata')
      .eq('id', fb.agent_activity_log_id)
      .maybeSingle();

    if (error) {
      console.error('[FeedbackProcessor] Failed to fetch activity:', error);
    }
    activity = data as ActivityRow | null;
  }

  try {
    switch (fb.feedback_type) {
      case 'thumbs_down':
        await handleThumbsDown(fb, activity);
        break;
      case 'thumbs_up':
        await handleThumbsUp(fb, activity);
        break;
      case 'correction':
        await handleCorrection(fb);
        break;
      case 'rating':
        await handleRating(fb);
        break;
    }
  } catch (err) {
    // Memory storage failed — feedback record is safe; will retry next call
    console.error('[FeedbackProcessor] Memory storage failed for feedback', feedbackId, err);
  }
}

/**
 * Thumbs-down on an agent action: store negative signal so the agent avoids
 * repeating the mistake. If the same content already has a negative memory,
 * escalate importance (up to cap).
 */
async function handleThumbsDown(fb: FeedbackRow, activity: ActivityRow | null): Promise<void> {
  if (!activity) return;

  const isCategorizationAction = activity.action_type === 'auto_categorize' || activity.action_type === 'auto_apply_tags';
  const contentId = activity.content_id ?? 'unknown';

  const memoryKey = isCategorizationAction
    ? `negative_feedback:categorize:${contentId}`
    : `negative_feedback:${activity.action_type}:${contentId}`;

  const description = buildNegativeDescription(activity, fb);

  // Check for existing memory to escalate importance
  const importance = await escalateImportance(fb.org_id, activity.agent_type, memoryKey, IMPORTANCE.negative);

  await storeMemory({
    orgId: fb.org_id,
    agentType: activity.agent_type,
    key: memoryKey,
    value: description,
    importance,
    metadata: {
      feedbackId: fb.id,
      contentId,
      actionType: activity.action_type,
      comment: fb.comment,
    },
  });
}

/**
 * Thumbs-up on an agent action: reinforce the pattern with high importance.
 */
async function handleThumbsUp(fb: FeedbackRow, activity: ActivityRow | null): Promise<void> {
  if (!activity) return;

  const contentId = activity.content_id ?? 'unknown';
  const memoryKey = `positive_feedback:${activity.action_type}:${contentId}`;

  const description = activity.output_summary
    ? `Good result: ${activity.output_summary}`
    : `User confirmed ${activity.action_type} action was correct.`;

  await storeMemory({
    orgId: fb.org_id,
    agentType: activity.agent_type,
    key: memoryKey,
    value: description,
    importance: IMPORTANCE.positive,
    metadata: {
      feedbackId: fb.id,
      contentId,
      actionType: activity.action_type,
      comment: fb.comment,
    },
  });
}

/**
 * Concept correction: store before/after so concept extraction learns
 * org-specific terminology.
 */
async function handleCorrection(fb: FeedbackRow): Promise<void> {
  const meta = fb.metadata as Record<string, unknown> | null;
  const conceptId = (meta?.conceptId as string) ?? (meta?.concept_id as string) ?? 'unknown';

  const memoryKey = `concept_correction:${conceptId}`;

  const description = fb.correction_value
    ? `Correction: ${fb.correction_value}`
    : 'Concept was corrected by user.';

  // Corrections go to the 'curator' agent since it handles concept extraction
  await storeMemory({
    orgId: fb.org_id,
    agentType: 'curator',
    key: memoryKey,
    value: description,
    importance: IMPORTANCE.correction,
    metadata: {
      feedbackId: fb.id,
      conceptId,
      action: (meta?.action as string) ?? null,
      before: (meta?.before ?? meta?.originalName ?? null) as string | null,
      after: (meta?.after ?? meta?.newName ?? meta?.mergeTargetName ?? null) as string | null,
      correctionValue: fb.correction_value,
    },
  });
}

/**
 * RAG response rated low (score <= 2): store memory so future retrieval
 * can adjust. High ratings (4-5) reinforce with positive importance.
 */
async function handleRating(fb: FeedbackRow): Promise<void> {
  const score = fb.score;
  if (score == null) return;

  const meta = fb.metadata as Record<string, unknown> | null;
  const query = (meta?.query as string) ?? '';
  const responseSnippet = (meta?.responseSnippet as string) ?? '';

  if (score <= 2) {
    // Low rating — store as negative signal for RAG
    const queryHash = simpleHash(query);
    const memoryKey = `low_rated_query:${queryHash}`;

    const description = query
      ? `Low-rated response (${score}/5) for query: "${query}". Response was: "${truncate(responseSnippet, 200)}". ${fb.comment ? `User comment: ${fb.comment}` : ''}`
      : `Low-rated RAG response (${score}/5).`;

    const importance = await escalateImportance(fb.org_id, 'rag', memoryKey, IMPORTANCE.low_rating);

    await storeMemory({
      orgId: fb.org_id,
      agentType: 'rag',
      key: memoryKey,
      value: description.trim(),
      importance,
      metadata: {
        feedbackId: fb.id,
        query,
        responseSnippet: truncate(responseSnippet, 500),
        score,
        comment: fb.comment,
      },
    });
  } else if (score >= 4) {
    // High rating — reinforce good pattern
    const queryHash = simpleHash(query);
    const memoryKey = `high_rated_query:${queryHash}`;

    const description = query
      ? `Well-rated response (${score}/5) for query: "${query}".`
      : `Well-rated RAG response (${score}/5).`;

    await storeMemory({
      orgId: fb.org_id,
      agentType: 'rag',
      key: memoryKey,
      value: description,
      importance: IMPORTANCE.positive,
      metadata: {
        feedbackId: fb.id,
        query,
        score,
        comment: fb.comment,
      },
    });
  }
}

/**
 * Check if a memory already exists for this key; if so, bump importance
 * (capped at IMPORTANCE_CAP). This handles repeated negative feedback
 * on the same pattern.
 */
async function escalateImportance(
  orgId: string,
  agentType: string,
  key: string,
  baseImportance: number
): Promise<number> {
  try {
    const existing = await recallMemory({ orgId, agentType, key });
    if (existing) {
      const current = existing.importance ?? baseImportance;
      return Math.min(current + IMPORTANCE_BUMP, IMPORTANCE_CAP);
    }
  } catch {
    // If recall fails, use base importance
  }
  return baseImportance;
}

function buildNegativeDescription(activity: ActivityRow, fb: FeedbackRow): string {
  const parts: string[] = [];

  if (activity.output_summary) {
    parts.push(`Bad result: ${activity.output_summary}`);
  } else {
    parts.push(`User rejected ${activity.action_type} action.`);
  }

  if (fb.comment) {
    parts.push(`User comment: ${fb.comment}`);
  }

  return parts.join(' ');
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
