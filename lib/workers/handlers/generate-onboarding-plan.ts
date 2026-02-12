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

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging } from '@/lib/services/agent-logger';
import { getTopConceptsForOrg, type StoredConcept } from '@/lib/services/concept-extractor';
import type { Database, LearningPathItem, ContentType, Json } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

const AGENT_TYPE = 'onboarding';
const MIN_PATH_ITEMS = 10;
const MAX_PATH_ITEMS = 20;

// Average reading speed: ~200 words/min for technical content
const WORDS_PER_MINUTE = 200;

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

interface ContentCandidate {
  id: string;
  title: string;
  contentType: ContentType;
  durationSec: number | null;
  createdAt: string;
  conceptNames: string[];
  wordCount: number;
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

      // Step 1: Query top concepts for the org
      progressCallback?.(10, 'Fetching knowledge concepts...');
      const allConcepts = await getTopConceptsForOrg(orgId, 100);

      if (allConcepts.length === 0) {
        console.log(`[OnboardingPlan] No concepts found for ${orgId}, generating minimal plan`);
      }

      // Step 2: Filter concepts by role relevance (if role provided)
      progressCallback?.(20, 'Analyzing role relevance...');
      let relevantConcepts = allConcepts;

      if (userRole && allConcepts.length > 0) {
        try {
          relevantConcepts = await filterConceptsByRole(allConcepts, userRole);
        } catch (error) {
          console.error('[OnboardingPlan] Role filtering failed, using all concepts:', error);
          // Fallback: use all concepts (no role-based filtering)
        }
      }

      const conceptNames = relevantConcepts.map(c => c.name);

      // Step 3: Find content covering those concepts
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

      // Step 4: Sequence content into a learning path via Gemini
      progressCallback?.(55, 'Generating optimal learning sequence...');
      let learningPath: LearningPathItem[];

      try {
        learningPath = await sequenceContentWithGemini(
          contentCandidates,
          conceptNames,
          userRole,
          userName,
        );
      } catch (error) {
        console.error('[OnboardingPlan] Gemini sequencing failed, using fallback order:', error);
        // Fallback: order by concept mention count DESC (most-referenced first)
        learningPath = buildFallbackPath(contentCandidates);
      }

      // Trim to configured bounds
      const targetSize = Math.min(
        Math.max(MIN_PATH_ITEMS, learningPath.length),
        MAX_PATH_ITEMS,
      );
      learningPath = learningPath.slice(0, targetSize);

      // Re-number after trimming
      learningPath = learningPath.map((item, i) => ({ ...item, order: i + 1 }));

      // Step 5: Insert into agent_onboarding_plans
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

// ---------------------------------------------------------------------------
// Role-based concept filtering via Gemini
// ---------------------------------------------------------------------------

async function filterConceptsByRole(
  concepts: StoredConcept[],
  role: string,
): Promise<StoredConcept[]> {
  const genai = getGenAIClient();

  const conceptList = concepts
    .map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
    .join('\n');

  const prompt = `You are an onboarding specialist. Given a list of knowledge concepts from an organization, identify which are relevant for a new team member with the role "${role}".

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
    // If Gemini returned nothing useful, keep all concepts
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

// ---------------------------------------------------------------------------
// Content discovery via concept_mentions
// ---------------------------------------------------------------------------

async function findContentForConcepts(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  conceptIds: string[],
): Promise<ContentCandidate[]> {
  // Fetch completed/transcribed content for the org
  const { data: contentRows, error: contentError } = await supabase
    .from('content')
    .select('id, title, content_type, duration_sec, created_at')
    .eq('org_id', orgId)
    .in('status', ['completed', 'transcribed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (contentError || !contentRows?.length) {
    return [];
  }

  // If no concepts, return content sorted by freshness
  if (conceptIds.length === 0) {
    return contentRows.map(c => ({
      id: c.id,
      title: c.title ?? 'Untitled',
      contentType: c.content_type as ContentType,
      durationSec: c.duration_sec,
      createdAt: c.created_at,
      conceptNames: [],
      wordCount: 0,
    }));
  }

  // Find concept mentions for these content items
  const contentIds = contentRows.map(c => c.id);
  const { data: mentions } = await supabase
    .from('concept_mentions')
    .select('content_id, concept_id')
    .in('concept_id', conceptIds)
    .eq('org_id', orgId)
    .in('content_id', contentIds);

  if (!mentions?.length) {
    // No concept overlap — return content by freshness
    return contentRows.slice(0, MAX_PATH_ITEMS).map(c => ({
      id: c.id,
      title: c.title ?? 'Untitled',
      contentType: c.content_type as ContentType,
      durationSec: c.duration_sec,
      createdAt: c.created_at,
      conceptNames: [],
      wordCount: 0,
    }));
  }

  // Build concept names lookup
  const { data: conceptRows } = await supabase
    .from('knowledge_concepts')
    .select('id, name')
    .in('id', conceptIds);
  const conceptNameMap = new Map((conceptRows ?? []).map(c => [c.id, c.name]));

  // Map content -> covered concept names, count
  const contentConceptMap = new Map<string, Set<string>>();
  for (const { content_id, concept_id } of mentions) {
    if (!contentConceptMap.has(content_id)) {
      contentConceptMap.set(content_id, new Set());
    }
    contentConceptMap.get(content_id)!.add(concept_id);
  }

  // Score by concept coverage count, then freshness
  const scored = contentRows
    .map(c => {
      const coveredIds = contentConceptMap.get(c.id);
      const conceptNames = coveredIds
        ? [...coveredIds].map(id => conceptNameMap.get(id) ?? id)
        : [];
      return {
        id: c.id,
        title: c.title ?? 'Untitled',
        contentType: c.content_type as ContentType,
        durationSec: c.duration_sec,
        createdAt: c.created_at,
        conceptNames,
        wordCount: 0,
        score: conceptNames.length,
      };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  // Enrich with word counts for time estimation
  const topCandidates = scored.slice(0, MAX_PATH_ITEMS * 2);
  const enriched = await enrichWithWordCounts(supabase, topCandidates);

  return enriched;
}

async function enrichWithWordCounts(
  supabase: ReturnType<typeof createAdminClient>,
  candidates: ContentCandidate[],
): Promise<ContentCandidate[]> {
  if (candidates.length === 0) return candidates;

  const ids = candidates.map(c => c.id);
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('content_id, chunk_text')
    .in('content_id', ids);

  if (!chunks?.length) return candidates;

  // Sum word counts per content
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

// ---------------------------------------------------------------------------
// Gemini-powered content sequencing
// ---------------------------------------------------------------------------

async function sequenceContentWithGemini(
  candidates: ContentCandidate[],
  conceptNames: string[],
  userRole: string | null,
  userName: string | null,
): Promise<LearningPathItem[]> {
  const genai = getGenAIClient();

  const contentList = candidates
    .map(
      (c, i) =>
        `${i + 1}. "${c.title}" [${c.contentType}] — covers: ${c.conceptNames.join(', ') || 'general'} (${estimateMinutes(c)} min)`,
    )
    .join('\n');

  const roleContext = userRole
    ? `The learner is a new ${userRole}.`
    : 'The learner is a new team member (role unspecified).';

  const nameContext = userName ? ` Their name is ${userName}.` : '';

  const prompt = `You are an onboarding plan designer. Given a list of content items, sequence them into an optimal learning path for a new team member.

${roleContext}${nameContext}

**Available content:**
${contentList}

**Organization's core topics:** ${conceptNames.slice(0, 30).join(', ') || 'various'}

**Rules:**
1. Start with foundational/setup content (local dev setup, getting started guides).
2. Progress from general knowledge to specific/advanced topics.
3. Group related content together.
4. End with advanced or production-focused content.
5. Select ${MIN_PATH_ITEMS}-${MAX_PATH_ITEMS} items maximum.
6. Each item needs a brief reason explaining why it's at that position.

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
  return items;
}

function estimateMinutes(candidate: ContentCandidate): number {
  // For recordings/videos/audio, use duration
  if (candidate.durationSec && candidate.durationSec > 0) {
    return Math.max(1, Math.ceil(candidate.durationSec / 60));
  }

  // For documents/text, use word count
  if (candidate.wordCount > 0) {
    return Math.max(1, Math.ceil(candidate.wordCount / WORDS_PER_MINUTE));
  }

  // Default estimate based on content type
  const defaults: Record<string, number> = {
    recording: 10,
    video: 10,
    audio: 5,
    document: 8,
    text: 3,
  };

  return defaults[candidate.contentType] ?? 5;
}

// ---------------------------------------------------------------------------
// Fallback ordering (when Gemini fails)
// ---------------------------------------------------------------------------

function buildFallbackPath(candidates: ContentCandidate[]): LearningPathItem[] {
  // Order by concept coverage (most-referenced first), already sorted
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

// ---------------------------------------------------------------------------
// Database insertion
// ---------------------------------------------------------------------------

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

function parseStringArray(responseText: string): string[] {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

interface SequenceItem {
  contentIndex: number;
  reason: string;
}

function parseSequenceResponse(responseText: string): SequenceItem[] {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return (parsed as Partial<SequenceItem>[]).filter(
      (item): item is SequenceItem =>
        typeof item?.contentIndex === 'number' &&
        item.contentIndex > 0 &&
        typeof item?.reason === 'string',
    );
  } catch {
    return [];
  }
}
