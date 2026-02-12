/**
 * Curate Knowledge Job Handler
 *
 * Runs curator sub-tasks (categorize, detect duplicates, detect staleness)
 * against content created since the last curator run.
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import { storeMemory, recallMemory } from '@/lib/services/agent-memory';
import { getConceptsForContent } from '@/lib/services/concept-extractor';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];
type SessionState = Database['public']['Tables']['agent_sessions']['Update']['state'];

const AGENT_TYPE = 'curator';

// Lazy-initialized Gemini client for tag suggestion
let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

/** Tag suggestion returned by Gemini. */
interface TagSuggestion {
  name: string;
  confidence: number;
  reason: string;
}

/** Sub-task definition: action key, human label, and stub implementation. */
interface SubTask {
  actionType: string;
  label: string;
  run: (contentId: string, orgId: string) => Promise<void>;
}

const SUB_TASKS: SubTask[] = [
  {
    actionType: 'auto_categorize',
    label: 'Auto-categorize content',
    run: categorizeContent,
  },
  {
    actionType: 'detect_duplicates',
    label: 'Check duplicates for content',
    run: async (contentId, orgId) => {
      console.log(`[CurateKnowledge] TODO: detectDuplicates for ${contentId} (org: ${orgId})`);
    },
  },
  {
    actionType: 'detect_staleness',
    label: 'Check staleness for content',
    run: async (contentId, orgId) => {
      console.log(`[CurateKnowledge] TODO: detectStaleness for ${contentId} (org: ${orgId})`);
    },
  },
];

export async function handleCurateKnowledge(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const orgId = (payload.orgId as string) || '';

  if (!orgId) {
    console.warn('[CurateKnowledge] Missing orgId in job payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[CurateKnowledge] Curator disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(10, 'Curator enabled, loading session...');

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Get or create a curator session
  const { data: existingSession, error: sessionError } = await supabase
    .from('agent_sessions')
    .select()
    .eq('org_id', orgId)
    .eq('agent_type', AGENT_TYPE)
    .in('session_status', ['active', 'paused'])
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  // PGRST116 = no rows found (expected when no session exists)
  if (sessionError && sessionError.code !== 'PGRST116') {
    throw new Error(`Failed to query curator session: ${sessionError.message}`);
  }

  let sessionId: string;
  let lastProcessedAt: string | null;

  if (existingSession) {
    sessionId = existingSession.id;
    lastProcessedAt =
      (existingSession.state as { lastProcessedAt?: string | null })?.lastProcessedAt ?? null;

    await supabase
      .from('agent_sessions')
      .update({ session_status: 'active', last_active_at: now })
      .eq('id', sessionId);
  } else {
    lastProcessedAt = null;

    const { data: newSession, error: createError } = await supabase
      .from('agent_sessions')
      .insert({
        org_id: orgId,
        agent_type: AGENT_TYPE,
        session_status: 'active',
        goal: 'Curate and organize knowledge base content',
        state: { lastProcessedAt: null } as unknown as SessionState,
        started_at: now,
        last_active_at: now,
      })
      .select('id')
      .single();

    if (createError || !newSession) {
      throw new Error(`Failed to create curator session: ${createError?.message}`);
    }

    sessionId = newSession.id;
  }

  progressCallback?.(20, 'Fetching new content...');

  // Fetch content created since the last successful run
  let contentQuery = supabase
    .from('content')
    .select('id, created_at')
    .eq('org_id', orgId)
    .in('status', ['completed', 'transcribed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (lastProcessedAt) {
    contentQuery = contentQuery.gt('created_at', lastProcessedAt);
  }

  const { data: newContent, error: contentError } = await contentQuery;

  if (contentError) {
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'curate_knowledge',
      outcome: 'failure',
      errorMessage: `Failed to fetch new content: ${contentError.message}`,
    });
    throw new Error(`Failed to fetch new content: ${contentError.message}`);
  }

  if (newContent.length === 0) {
    await supabase
      .from('agent_sessions')
      .update({ last_active_at: now })
      .eq('id', sessionId);

    progressCallback?.(100, 'No new content to process');
    console.log(`[CurateKnowledge] No new content for ${orgId} since ${lastProcessedAt ?? 'beginning'}`);
    return;
  }

  console.log(`[CurateKnowledge] Found ${newContent.length} new content items for ${orgId}`);

  const totalItems = newContent.length;

  for (let i = 0; i < totalItems; i++) {
    const item = newContent[i];
    const progressPercent = 30 + Math.round((i / totalItems) * 60);
    progressCallback?.(progressPercent, `Processing item ${i + 1} of ${totalItems}...`);

    try {
      for (const task of SUB_TASKS) {
        await withAgentLogging(
          {
            orgId,
            agentType: AGENT_TYPE,
            actionType: task.actionType,
            contentId: item.id,
            inputSummary: `${task.label} ${item.id}`,
          },
          () => task.run(item.id, orgId)
        );
      }

      // Checkpoint: advance lastProcessedAt so retries skip this item
      await supabase
        .from('agent_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          state: { lastProcessedAt: item.created_at } as unknown as SessionState,
        })
        .eq('id', sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CurateKnowledge] Error processing content ${item.id}: ${errorMessage}`);

      await logAgentAction({
        orgId,
        agentType: AGENT_TYPE,
        actionType: 'curate_knowledge',
        contentId: item.id,
        outcome: 'failure',
        errorMessage,
      });

      throw error;
    }
  }

  progressCallback?.(100, 'Knowledge curation complete');
  console.log(`[CurateKnowledge] Curation complete for ${orgId} — processed ${totalItems} items`);
}

// ---------------------------------------------------------------------------
// Auto-categorization: suggest tags based on extracted concepts
// ---------------------------------------------------------------------------

/**
 * Suggest tags for a content item based on its extracted concepts
 * and the org's existing tag vocabulary. Results are stored in
 * agent_activity_log (action_type 'suggest_tags') — tags are NOT
 * auto-applied (requires authorization framework E06).
 */
async function categorizeContent(contentId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient();

  // Get extracted concepts for this content
  const concepts = await getConceptsForContent(contentId);

  // Edge case: no concepts → skip
  if (concepts.length === 0) {
    console.log(`[CurateKnowledge] No concepts for ${contentId}, skipping categorization`);
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'suggest_tags',
      contentId,
      targetEntity: 'content',
      targetId: contentId,
      outcome: 'skipped',
      outputSummary: JSON.stringify({ reason: 'No extracted concepts' }),
    });
    return;
  }

  // Get existing org tags (non-deleted)
  const { data: orgTags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name');

  const orgTagNames = (orgTags || []).map(t => t.name);

  // Get existing content-tag associations to avoid re-suggesting
  const { data: existingAssociations } = await supabase
    .from('content_tags')
    .select('tag_id')
    .eq('content_id', contentId);

  const existingTagIds = new Set((existingAssociations || []).map(a => a.tag_id));
  const existingTagNames = new Set(
    (orgTags || [])
      .filter(t => existingTagIds.has(t.id))
      .map(t => t.name.toLowerCase())
  );

  // Recall agent memory for tag vocabulary patterns
  const memory = await recallMemory({
    orgId,
    agentType: AGENT_TYPE,
    key: `tag_vocabulary:${orgId}`,
  });

  // Call Gemini for tag suggestions
  const conceptNames = concepts.map(c => c.name);
  const prompt = buildCategorizationPrompt(
    conceptNames,
    orgTagNames,
    existingTagNames,
    memory?.memory_value || ''
  );

  let suggestions: TagSuggestion[];
  try {
    const genai = getGenAIClient();
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    suggestions = parseTagSuggestions(result.text || '');
    suggestions = suggestions.filter(s => !existingTagNames.has(s.name.toLowerCase()));
    suggestions = deduplicateSuggestions(suggestions, orgTagNames);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CurateKnowledge] Gemini API error for ${contentId}:`, errorMessage);
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'suggest_tags',
      contentId,
      targetEntity: 'content',
      targetId: contentId,
      outcome: 'failure',
      errorMessage,
    });
    return;
  }

  // Store suggestions in agent_activity_log
  await logAgentAction({
    orgId,
    agentType: AGENT_TYPE,
    actionType: 'suggest_tags',
    contentId,
    targetEntity: 'content',
    targetId: contentId,
    outcome: 'success',
    outputSummary: JSON.stringify(
      suggestions.map(s => ({ name: s.name, confidence: s.confidence }))
    ),
    metadata: {
      conceptCount: concepts.length,
      concepts: conceptNames,
      existingTagsOnContent: [...existingTagNames],
      orgTagCount: orgTagNames.length,
    },
  });

  console.log(
    `[CurateKnowledge] Suggested ${suggestions.length} tags for ${contentId}: ` +
      suggestions.map(s => `${s.name} (${s.confidence})`).join(', ')
  );

  // Update agent memory with org tag vocabulary (best-effort)
  try {
    const allKnownTags = [
      ...new Set([
        ...orgTagNames.map(t => t.toLowerCase()),
        ...suggestions.map(s => s.name.toLowerCase()),
      ]),
    ].sort();

    await storeMemory({
      orgId,
      agentType: AGENT_TYPE,
      key: `tag_vocabulary:${orgId}`,
      value: JSON.stringify({
        tags: allKnownTags,
        tagCount: allKnownTags.length,
        updatedAt: new Date().toISOString(),
      }),
      importance: 0.7,
    });
  } catch (memoryError) {
    console.error('[CurateKnowledge] Failed to update tag vocabulary memory:', memoryError);
  }
}

/** Build the Gemini prompt for tag suggestion. */
function buildCategorizationPrompt(
  concepts: string[],
  orgTags: string[],
  existingContentTags: Set<string>,
  memoryContext: string
): string {
  const existingTagsList =
    orgTags.length > 0
      ? `\nExisting organization tags: ${orgTags.join(', ')}`
      : '\nNo existing tags in this organization yet.';

  const alreadyApplied =
    existingContentTags.size > 0
      ? `\nTags already on this content (DO NOT suggest these): ${[...existingContentTags].join(', ')}`
      : '';

  const memoryHint = memoryContext
    ? `\nPrevious tag patterns observed: ${memoryContext}`
    : '';

  return `You are a content categorization specialist. Based on the extracted concepts from a piece of content, suggest appropriate tags.

**Extracted concepts from the content:**
${concepts.map(c => `- ${c}`).join('\n')}
${existingTagsList}${alreadyApplied}${memoryHint}

**Rules:**
1. Prefer EXISTING tag names from the organization when they match or closely relate to the concepts.
2. For new tags, use lowercase with hyphens for multi-word tags (e.g., "aws-deployment").
3. Follow the naming conventions of existing tags.
4. Each suggestion needs a confidence score from 0 to 1:
   - 0.9-1.0: Direct match with an existing tag
   - 0.7-0.9: Strong match with minor adaptation
   - 0.5-0.7: Reasonable but less certain categorization
5. Do NOT suggest tags already applied to this content.
6. Do NOT suggest duplicate tags (e.g., both "deploy" and "deployment"). Pick the one matching existing vocabulary.
7. Suggest 1-10 tags maximum, ordered by confidence.
8. Tag names must contain only lowercase letters, numbers, hyphens, and spaces.

Return ONLY a JSON array. No markdown, no explanation.

Example:
[{"name": "react", "confidence": 0.95, "reason": "Direct match with existing tag"},
 {"name": "docker", "confidence": 0.90, "reason": "Matches Docker concept"},
 {"name": "aws-deployment", "confidence": 0.75, "reason": "Combines AWS concept with existing deployment convention"}]`;
}

/** Parse Gemini response into tag suggestions. */
function parseTagSuggestions(responseText: string): TagSuggestion[] {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    interface RawSuggestion {
      name: string;
      confidence: number;
      reason?: string;
    }

    return (parsed as RawSuggestion[])
      .filter(
        s =>
          s.name &&
          typeof s.name === 'string' &&
          typeof s.confidence === 'number' &&
          s.confidence >= 0 &&
          s.confidence <= 1
      )
      .map(s => ({
        name: s.name.trim().toLowerCase(),
        confidence: Math.round(s.confidence * 100) / 100,
        reason: s.reason?.trim() || '',
      }));
  } catch {
    console.error('[CurateKnowledge] Failed to parse tag suggestions from Gemini response');
    return [];
  }
}

/**
 * Deduplicate tag suggestions. When two names are near-duplicates
 * (e.g., "deploy" vs "deployment"), keep the one matching existing org tags.
 */
function deduplicateSuggestions(
  suggestions: TagSuggestion[],
  orgTagNames: string[]
): TagSuggestion[] {
  const orgTagSet = new Set(orgTagNames.map(t => t.toLowerCase()));
  const result: TagSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const lower = suggestion.name.toLowerCase();
    if (seen.has(lower)) continue;

    // Check for near-duplicate of an already-kept suggestion
    const dupeIdx = result.findIndex(kept => areSimilarTags(kept.name, lower));
    if (dupeIdx >= 0) {
      // Replace if the new one matches org vocabulary and the existing one does not
      if (orgTagSet.has(lower) && !orgTagSet.has(result[dupeIdx].name)) {
        result[dupeIdx] = suggestion;
      }
      continue;
    }

    seen.add(lower);
    result.push(suggestion);
  }

  return result;
}

/**
 * Check if two tag names are near-duplicates.
 * Handles "deploy" / "deployment", "api" / "apis", etc.
 */
function areSimilarTags(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 5) return true;
  return false;
}
