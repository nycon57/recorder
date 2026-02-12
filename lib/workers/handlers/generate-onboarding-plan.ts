/**
 * Generate Onboarding Plan Job Handler
 *
 * Produces a personalized learning path for a new team member by:
 * 1. Querying the org's knowledge concepts (ordered by mention count)
 * 2. Optionally filtering to role-relevant concepts via Gemini
 * 3. Finding content that covers those concepts
 * 4. Sequencing the content into an optimal learning order via Gemini
 * 5. Inserting the plan into agent_onboarding_plans
 */

import { GoogleGenAI } from '@google/genai';

import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging } from '@/lib/services/agent-logger';
import { recallMemory } from '@/lib/services/agent-memory';
import { getTopConceptsForOrg, type StoredConcept } from '@/lib/services/concept-extractor';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { ContentType, Database, Json, LearningPathItem } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

const AGENT_TYPE = 'onboarding';
const MIN_PATH_ITEMS = 10;
const MAX_PATH_ITEMS = 20;

// Average reading speed: ~200 words/min for technical content
const WORDS_PER_MINUTE = 200;

/** Sanitize user-provided strings before embedding in Gemini prompts. */
function sanitizeForPrompt(input: string, maxLength = 100): string {
  return input
    .replace(/["""''`]/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .substring(0, maxLength)
    .trim();
}

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

interface ContentRow {
  id: string;
  title: string | null;
  content_type: string;
  duration_sec: number | null;
  created_at: string;
}

interface ContentCandidate {
  id: string;
  title: string;
  contentType: ContentType;
  durationSec: number | null;
  createdAt: string;
  conceptNames: string[];
  wordCount: number;
}

function toContentCandidate(
  row: ContentRow,
  conceptNames: string[] = [],
): ContentCandidate {
  return {
    id: row.id,
    title: row.title ?? 'Untitled',
    contentType: row.content_type as ContentType,
    durationSec: row.duration_sec,
    createdAt: row.created_at,
    conceptNames,
    wordCount: 0,
  };
}

export async function handleGenerateOnboardingPlan(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const orgId = (payload.orgId as string) || '';
  const userId = (payload.userId as string) || '';
  const userName = (payload.userName as string) || null;
  const userRole = (payload.userRole as string) || null;

  if (!orgId || !userId) {
    console.warn('[OnboardingPlan] Missing orgId or userId in payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[OnboardingPlan] Onboarding agent disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(5, 'Onboarding agent enabled, starting plan generation...');

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'generate_plan',
      inputSummary: `Generate onboarding plan for user ${userId}${userRole ? ` (role: ${userRole})` : ''}`,
    },
    async () => {
      const supabase = createAdminClient();

      progressCallback?.(10, 'Fetching knowledge concepts...');
      const allConcepts = await getTopConceptsForOrg(orgId, 100);

      if (allConcepts.length === 0) {
        console.log(`[OnboardingPlan] No concepts found for ${orgId}, generating minimal plan`);
      }

      progressCallback?.(20, 'Analyzing role relevance...');
      let relevantConcepts = allConcepts;

      if (userRole && allConcepts.length > 0) {
        try {
          relevantConcepts = await filterConceptsByRole(allConcepts, userRole);
        } catch (error) {
          console.error('[OnboardingPlan] Role filtering failed, using all concepts:', error);
        }
      }

      const conceptNames = relevantConcepts.map(c => c.name);

      // Recall engagement insights from previous onboardings for this role
      progressCallback?.(30, 'Checking past onboarding insights...');
      let priorInsights: string | null = null;
      const roleKey = userRole ?? 'general';
      try {
        const memory = await recallMemory({
          orgId,
          agentType: AGENT_TYPE,
          key: `onboarding_analysis:${orgId}:${roleKey}`,
        });
        if (memory) {
          priorInsights = memory.memory_value;
          console.log(`[OnboardingPlan] Found prior insights for role "${roleKey}"`);
        }
      } catch (error) {
        console.warn('[OnboardingPlan] Failed to recall engagement memory:', error);
      }

      progressCallback?.(35, 'Finding relevant content...');
      const contentCandidates = await findContentForConcepts(
        supabase,
        orgId,
        relevantConcepts.map(c => c.id)
      );

      if (contentCandidates.length === 0) {
        console.log(`[OnboardingPlan] No content found for ${orgId}, inserting empty plan`);
        await insertOnboardingPlan(supabase, {
          orgId,
          userId,
          userName,
          userRole,
          learningPath: [],
          notes: 'No content available to generate a learning path.',
        });
        progressCallback?.(100, 'Plan generation complete (no content available)');
        return;
      }

      const limitedContent = contentCandidates.length < 5;

      progressCallback?.(55, 'Generating optimal learning sequence...');
      let learningPath: LearningPathItem[];

      try {
        learningPath = await sequenceContentWithGemini(
          contentCandidates,
          conceptNames,
          userRole,
          userName,
          priorInsights,
        );
      } catch (error) {
        console.error('[OnboardingPlan] Gemini sequencing failed, using fallback order:', error);
        learningPath = buildFallbackPath(contentCandidates);
      }

      const targetSize = Math.min(Math.max(MIN_PATH_ITEMS, learningPath.length), MAX_PATH_ITEMS);
      learningPath = learningPath
        .slice(0, targetSize)
        .map((item, i) => ({ ...item, order: i + 1 }));

      progressCallback?.(80, 'Saving onboarding plan...');
      const notes = limitedContent
        ? 'Limited content available — path may be incomplete'
        : null;

      await insertOnboardingPlan(supabase, {
        orgId,
        userId,
        userName,
        userRole,
        learningPath,
        notes,
      });

      progressCallback?.(100, 'Onboarding plan generated');
      console.log(
        `[OnboardingPlan] Generated ${learningPath.length}-item plan for user ${userId} in org ${orgId}`,
      );
    },
  );
}

async function filterConceptsByRole(
  concepts: StoredConcept[],
  role: string,
): Promise<StoredConcept[]> {
  const genai = getGenAIClient();

  const conceptList = concepts
    .map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
    .join('\n');

  const safeRole = sanitizeForPrompt(role);

  const prompt = `You are an onboarding specialist. Given a list of knowledge concepts from an organization, identify which are relevant for a new team member with the role "${safeRole}".

**Concepts:**
${conceptList}

Return ONLY a JSON array of concept names that are relevant to this role. Include broadly useful concepts (e.g., onboarding, development setup) alongside role-specific ones. If unsure, include the concept.

Example: ["Kubernetes", "CI/CD", "API Design", "Local Development Setup"]`;

  const result = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { temperature: 0.3, maxOutputTokens: 1024 },
  });

  const responseText = result.text ?? '';
  const relevantNames = parseStringArray(responseText);

  if (relevantNames.length === 0) {
    return concepts;
  }

  const nameSet = new Set(relevantNames.map(n => n.toLowerCase()));
  const filtered = concepts.filter(c => nameSet.has(c.name.toLowerCase()));

  // If filtering was too aggressive (< 30% of concepts kept), include top concepts by mention count
  if (filtered.length < concepts.length * 0.3) {
    const topByMention = concepts
      .filter(c => !nameSet.has(c.name.toLowerCase()))
      .slice(0, Math.ceil(concepts.length * 0.2));
    return [...filtered, ...topByMention];
  }

  return filtered;
}

async function findContentForConcepts(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  conceptIds: string[],
): Promise<ContentCandidate[]> {
  const { data: contentRows, error: contentError } = await supabase
    .from('content')
    .select('id, title, content_type, duration_sec, created_at')
    .eq('org_id', orgId)
    .in('status', ['completed', 'transcribed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (contentError || !contentRows?.length) {
    return [];
  }

  if (conceptIds.length === 0) {
    return contentRows.map(c => toContentCandidate(c));
  }

  const contentIds = contentRows.map(c => c.id);
  const BATCH_SIZE = 100;
  const allMentions: { content_id: string; concept_id: string }[] = [];

  for (let i = 0; i < contentIds.length; i += BATCH_SIZE) {
    const batch = contentIds.slice(i, i + BATCH_SIZE);
    const { data: batchMentions, error: mentionError } = await supabase
      .from('concept_mentions')
      .select('content_id, concept_id')
      .in('concept_id', conceptIds)
      .eq('org_id', orgId)
      .in('content_id', batch);

    if (mentionError) {
      console.warn('[OnboardingPlan] Failed to fetch concept mentions batch:', mentionError.message);
      continue;
    }
    if (batchMentions) allMentions.push(...batchMentions);
  }

  if (!allMentions.length) {
    return contentRows.slice(0, MAX_PATH_ITEMS).map(c => toContentCandidate(c));
  }

  const { data: conceptRows, error: conceptError } = await supabase
    .from('knowledge_concepts')
    .select('id, name')
    .in('id', conceptIds);

  if (conceptError) {
    console.warn('[OnboardingPlan] Failed to fetch concept names:', conceptError.message);
  }
  const conceptNameMap = new Map((conceptRows ?? []).map(c => [c.id, c.name]));

  const contentConceptMap = new Map<string, Set<string>>();
  for (const { content_id, concept_id } of allMentions) {
    const existing = contentConceptMap.get(content_id);
    if (existing) {
      existing.add(concept_id);
    } else {
      contentConceptMap.set(content_id, new Set([concept_id]));
    }
  }

  const scored = contentRows
    .map(c => {
      const coveredIds = contentConceptMap.get(c.id);
      const names = coveredIds
        ? [...coveredIds].map(id => conceptNameMap.get(id) ?? id)
        : [];
      return { ...toContentCandidate(c, names), score: names.length };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  return enrichWithWordCounts(supabase, scored.slice(0, MAX_PATH_ITEMS * 2));
}

async function enrichWithWordCounts(
  supabase: ReturnType<typeof createAdminClient>,
  candidates: ContentCandidate[],
): Promise<ContentCandidate[]> {
  if (candidates.length === 0) return candidates;

  const ids = candidates.map(c => c.id);
  const { data: chunks, error: chunkError } = await supabase
    .from('transcript_chunks')
    .select('content_id, chunk_text')
    .in('content_id', ids);

  if (chunkError) {
    console.warn('[OnboardingPlan] Failed to fetch transcript chunks:', chunkError.message);
    return candidates;
  }

  if (!chunks?.length) return candidates;

  const wordCountMap = new Map<string, number>();
  for (const chunk of chunks) {
    const count = chunk.chunk_text?.split(/\s+/).length ?? 0;
    wordCountMap.set(
      chunk.content_id,
      (wordCountMap.get(chunk.content_id) ?? 0) + count,
    );
  }

  return candidates.map(c => ({
    ...c,
    wordCount: wordCountMap.get(c.id) ?? 0,
  }));
}

async function sequenceContentWithGemini(
  candidates: ContentCandidate[],
  conceptNames: string[],
  userRole: string | null,
  userName: string | null,
  priorInsights: string | null = null,
): Promise<LearningPathItem[]> {
  const genai = getGenAIClient();

  const contentList = candidates
    .map(
      (c, i) =>
        `${i + 1}. "${c.title}" [${c.contentType}] — covers: ${c.conceptNames.join(', ') || 'general'} (${estimateMinutes(c)} min)`,
    )
    .join('\n');

  const roleContext = userRole
    ? `The learner is a new ${sanitizeForPrompt(userRole)}.`
    : 'The learner is a new team member (role unspecified).';

  const nameContext = userName ? ` Their name is ${sanitizeForPrompt(userName)}.` : '';

  let insightsSection = '';
  if (priorInsights) {
    try {
      const insights = JSON.parse(priorInsights);
      const parts: string[] = [];
      if (insights.skippedTopics?.length) {
        parts.push(`- Items about these topics are frequently skipped: ${insights.skippedTopics.join(', ')}. Deprioritize or exclude them.`);
      }
      if (insights.highEngagementTopics?.length) {
        parts.push(`- These topics get high engagement: ${insights.highEngagementTopics.join(', ')}. Prioritize them.`);
      }
      if (insights.missingTopics?.length) {
        parts.push(`- Previous learners searched for these topics not in the plan: ${insights.missingTopics.join(', ')}. Include related content if available.`);
      }
      if (insights.orderingInsights?.length) {
        parts.push(`- Ordering insights: ${insights.orderingInsights.join('; ')}`);
      }
      if (parts.length > 0) {
        insightsSection = `\n**Insights from previous onboardings for this role:**\n${parts.join('\n')}\n`;
      }
    } catch {
      // Invalid JSON in memory — skip insights
    }
  }

  const prompt = `You are an onboarding plan designer. Given a list of content items, sequence them into an optimal learning path for a new team member.

${roleContext}${nameContext}

**Available content:**
${contentList}

**Organization's core topics:** ${conceptNames.slice(0, 30).join(', ') || 'various'}
${insightsSection}
**Rules:**
1. Start with foundational/setup content (local dev setup, getting started guides).
2. Progress from general knowledge to specific/advanced topics.
3. Group related content together.
4. End with advanced or production-focused content.
5. Select ${MIN_PATH_ITEMS}-${MAX_PATH_ITEMS} items maximum.
6. Each item needs a brief reason explaining why it's at that position.
${priorInsights ? '7. Apply the insights from previous onboardings to improve this plan.' : ''}

Return ONLY a JSON array ordered by learning sequence. Each element:
{"contentIndex": <1-based index from the list above>, "reason": "<brief reason for this position>"}

Example:
[{"contentIndex": 3, "reason": "Foundational setup guide — start here"},
 {"contentIndex": 1, "reason": "Core architecture overview before diving into specifics"}]`;

  const result = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { temperature: 0.5, maxOutputTokens: 2048 },
  });

  const responseText = result.text ?? '';
  const sequenced = parseSequenceResponse(responseText);

  if (sequenced.length === 0) {
    throw new Error('Gemini returned empty sequence');
  }

  const items: LearningPathItem[] = [];
  for (const [i, item] of sequenced.entries()) {
    if (item.contentIndex < 1 || item.contentIndex > candidates.length) {
      console.warn(`[OnboardingPlan] Invalid content index ${item.contentIndex} (valid: 1-${candidates.length})`);
      continue;
    }

    const candidate = candidates[item.contentIndex - 1];
    if (!candidate) continue;

    items.push({
      contentId: candidate.id,
      title: candidate.title,
      contentType: candidate.contentType,
      reason: item.reason,
      order: i + 1,
      completed: false,
      completedAt: null,
      estimatedMinutes: estimateMinutes(candidate),
    });
  }

  if (items.length === 0) {
    throw new Error('Gemini sequencing produced zero valid items');
  }

  return items;
}

const DEFAULT_MINUTES: Record<string, number> = {
  recording: 10,
  video: 10,
  audio: 5,
  document: 8,
  text: 3,
};

function estimateMinutes(candidate: ContentCandidate): number {
  if (candidate.durationSec && candidate.durationSec > 0) {
    return Math.max(1, Math.ceil(candidate.durationSec / 60));
  }
  if (candidate.wordCount > 0) {
    return Math.max(1, Math.ceil(candidate.wordCount / WORDS_PER_MINUTE));
  }
  return DEFAULT_MINUTES[candidate.contentType] ?? 5;
}

function buildFallbackPath(candidates: ContentCandidate[]): LearningPathItem[] {
  return candidates.slice(0, MAX_PATH_ITEMS).map((c, i) => ({
    contentId: c.id,
    title: c.title,
    contentType: c.contentType,
    reason: `Covers ${c.conceptNames.length} core concepts: ${c.conceptNames.slice(0, 3).join(', ') || 'general knowledge'}`,
    order: i + 1,
    completed: false,
    completedAt: null,
    estimatedMinutes: estimateMinutes(c),
  }));
}

async function insertOnboardingPlan(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    orgId: string;
    userId: string;
    userName: string | null;
    userRole: string | null;
    learningPath: LearningPathItem[];
    notes: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('agent_onboarding_plans')
    .insert({
      org_id: params.orgId,
      user_id: params.userId,
      user_name: params.userName,
      user_role: params.userRole,
      plan_status: 'active',
      learning_path: params.learningPath as unknown as Json[],
      total_items: params.learningPath.length,
      completed_items: 0,
      engagement_data: {} as Json,
      generated_by: 'agent',
      notes: params.notes,
    });

  if (error) {
    throw new Error(`Failed to insert onboarding plan: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Response parsing utilities
// ---------------------------------------------------------------------------

/** Extract the first JSON array from a Gemini response, stripping code fences. */
function extractJsonArray(responseText: string): unknown[] | null {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseStringArray(responseText: string): string[] {
  const arr = extractJsonArray(responseText);
  if (!arr) return [];
  return arr.filter((item): item is string => typeof item === 'string');
}

interface SequenceItem {
  contentIndex: number;
  reason: string;
}

function parseSequenceResponse(responseText: string): SequenceItem[] {
  const arr = extractJsonArray(responseText);
  if (!arr) return [];

  const seen = new Set<number>();
  return (arr as Partial<SequenceItem>[])
    .filter(
      (item): item is SequenceItem =>
        typeof item?.contentIndex === 'number' &&
        item.contentIndex > 0 &&
        typeof item?.reason === 'string',
    )
    .filter(item => {
      if (seen.has(item.contentIndex)) return false;
      seen.add(item.contentIndex);
      return true;
    });
}
