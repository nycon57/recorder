/**
 * Curate Knowledge Job Handler
 *
 * Runs curator sub-tasks (categorize, detect duplicates, detect staleness)
 * against content created since the last curator run.
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled, getAgentSettings } from '@/lib/services/agent-config';
import { checkPermission, requestApproval } from '@/lib/services/agent-permissions';
import { estimateActionCost } from '@/lib/services/agent-cost-estimator';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import { storeMemory, recallMemory } from '@/lib/services/agent-memory';
import { getConceptsForContent } from '@/lib/services/concept-extractor';
import { hammingDistance, hammingToSimilarity } from '@/lib/services/similarity-detector';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];
type SessionState = Database['public']['Tables']['agent_sessions']['Update']['state'];

const AGENT_TYPE = 'curator';
const ZERO_HASH = '0'.repeat(64);

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

/** Duplicate detection levels, from strongest to weakest match. */
type DuplicateLevel = 'EXACT_DUPLICATE' | 'NEAR_DUPLICATE' | 'RELATED';

/** Result of comparing a new content item against an existing one. */
interface DuplicateMatch {
  matchedContentId: string;
  matchedTitle: string;
  level: DuplicateLevel;
  perceptualSimilarity: number | null;
  embeddingSimilarity: number | null;
  conceptOverlap: number | null;
}

/** Sub-task definition: action key, human label, and implementation. */
interface SubTask {
  actionType: string;
  label: string;
  run: (contentId: string, orgId: string) => Promise<void>;
}

/** Payload stored in output_summary for suggest_merge log entries. */
interface MergeSuggestion {
  sourceIds: string[];
  reason: string;
  suggestedAction: 'merge' | 'archive_older' | 'review';
}

function curatorState(lastProcessedAt: string | null): SessionState {
  return { lastProcessedAt } as unknown as SessionState;
}

/**
 * Check permission tier and, if 'approve', request approval with an
 * attached cost estimate. Silently skips if tier is not 'approve'.
 */
async function requestApprovalWithCost(
  orgId: string,
  actionType: string,
  contentId: string,
  params: { description: string; proposedAction: Record<string, unknown> },
): Promise<void> {
  const tier = await checkPermission(orgId, AGENT_TYPE, actionType);
  if (tier !== 'approve') return;

  try {
    const cost = await estimateActionCost(AGENT_TYPE, actionType);
    await requestApproval({
      orgId,
      agentType: AGENT_TYPE,
      actionType,
      contentId,
      description: params.description,
      proposedAction: {
        ...params.proposedAction,
        estimatedCost: {
          estimatedTokens: cost.estimatedTokens,
          estimatedCostUsd: cost.estimatedCostUsd,
          breakdown: cost.breakdown,
        },
      },
    });
    console.log(`[CurateKnowledge] Approval requested for ${actionType} on ${contentId}`);
  } catch (error) {
    console.error(`[CurateKnowledge] Failed to request approval for ${actionType} on ${contentId}:`, error);
  }
}

const SUB_TASKS: SubTask[] = [
  {
    actionType: 'auto_categorize',
    label: 'Auto-categorize content',
    run: categorizeContent,
  },
  {
    actionType: 'detect_duplicate',
    label: 'Check duplicates for content',
    run: detectDuplicates,
  },
  {
    actionType: 'detect_staleness',
    label: 'Check staleness for content',
    run: detectStaleness,
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

  // PGRST116 = no rows found (expected when no session exists)
  const { data: existingSession, error: sessionError } = await supabase
    .from('agent_sessions')
    .select()
    .eq('org_id', orgId)
    .eq('agent_type', AGENT_TYPE)
    .in('session_status', ['active', 'paused'])
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

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
        state: curatorState(null),
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
    console.log(`[CurateKnowledge] No new content for ${orgId} since ${lastProcessedAt ?? 'first run'}`);
    return;
  }

  console.log(`[CurateKnowledge] Found ${newContent.length} new content items for ${orgId}`);

  for (const [i, item] of newContent.entries()) {
    const progressPercent = 30 + Math.round((i / newContent.length) * 60);
    progressCallback?.(progressPercent, `Processing item ${i + 1} of ${newContent.length}...`);

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

      await supabase
        .from('agent_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          state: curatorState(item.created_at),
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
  console.log(`[CurateKnowledge] Curation complete for ${orgId} -- processed ${newContent.length} items`);
}

// ---------------------------------------------------------------------------
// Auto-categorization: suggest tags based on extracted concepts
// ---------------------------------------------------------------------------

/**
 * Suggest tags for a content item based on its extracted concepts
 * and the org's existing tag vocabulary. Results are stored in
 * agent_activity_log (action_type 'suggest_tags'). Tags are NOT
 * auto-applied (requires authorization framework E06).
 */
async function categorizeContent(contentId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient();
  const concepts = await getConceptsForContent(contentId);

  const tagLogBase = {
    orgId,
    agentType: AGENT_TYPE,
    actionType: 'suggest_tags',
    contentId,
    targetEntity: 'content',
    targetId: contentId,
  } as const;

  if (concepts.length === 0) {
    console.log(`[CurateKnowledge] Skipping categorization: no extracted concepts for ${contentId}`);
    await logAgentAction({
      ...tagLogBase,
      outcome: 'skipped',
      outputSummary: JSON.stringify({ reason: 'No extracted concepts' }),
    });
    return;
  }

  const { data: orgTags } = await supabase
    .from('tags')
    .select('id, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('name');

  const tags = orgTags ?? [];
  const orgTagNames = tags.map(t => t.name);

  const { data: existingAssociations } = await supabase
    .from('content_tags')
    .select('tag_id')
    .eq('content_id', contentId);

  const existingTagIds = new Set((existingAssociations ?? []).map(a => a.tag_id));
  const existingTagNames = new Set(
    tags
      .filter(t => existingTagIds.has(t.id))
      .map(t => t.name.toLowerCase())
  );

  const tagVocabulary = await recallMemory({
    orgId,
    agentType: AGENT_TYPE,
    key: `tag_vocabulary:${orgId}`,
  });

  const conceptNames = concepts.map(c => c.name);
  const prompt = buildCategorizationPrompt(
    conceptNames,
    orgTagNames,
    existingTagNames,
    tagVocabulary?.memory_value ?? ''
  );

  let suggestions: TagSuggestion[];
  try {
    const genai = getGenAIClient();
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const parsed = parseTagSuggestions(result.text ?? '');
    const filtered = parsed.filter(s => !existingTagNames.has(s.name.toLowerCase()));
    suggestions = deduplicateSuggestions(filtered, orgTagNames);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CurateKnowledge] Tag suggestion failed for ${contentId}:`, errorMessage);
    await logAgentAction({ ...tagLogBase, outcome: 'failure', errorMessage });
    return;
  }

  await logAgentAction({
    ...tagLogBase,
    outcome: 'success',
    outputSummary: JSON.stringify(
      suggestions.map(s => ({ name: s.name, confidence: s.confidence }))
    ),
    metadata: {
      conceptCount: concepts.length,
      concepts: conceptNames,
      existingTagsOnContent: Array.from(existingTagNames),
      orgTagCount: orgTagNames.length,
    },
  });

  console.log(
    `[CurateKnowledge] Suggested ${suggestions.length} tags for ${contentId}: ` +
      suggestions.map(s => `${s.name} (${s.confidence})`).join(', ')
  );

  if (suggestions.length > 0) {
    await requestApprovalWithCost(orgId, 'auto_apply_tags', contentId, {
      description: `Auto-apply ${suggestions.length} suggested tags: ${suggestions.map(s => s.name).join(', ')}`,
      proposedAction: {
        type: 'apply_tags',
        tags: suggestions.map(s => ({ name: s.name, confidence: s.confidence })),
      },
    });
  }

  // Best-effort: update agent memory with org tag vocabulary
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
    console.error('[CurateKnowledge] Tag vocabulary memory update failed (non-critical):', memoryError);
  }
}

// ---------------------------------------------------------------------------
// Duplicate and near-duplicate detection
// ---------------------------------------------------------------------------

/**
 * Detect duplicate or near-duplicate content by combining three signals:
 * 1. Perceptual hash similarity (video/audio dHash)
 * 2. Transcript embedding cosine similarity (via transcript_chunks)
 * 3. Concept overlap (shared concepts via concept_mentions)
 *
 * Classification:
 * - EXACT_DUPLICATE:  perceptual hash similarity > 95%
 * - NEAR_DUPLICATE:   embedding similarity > 0.9 AND concept overlap > 80%
 * - RELATED:          embedding similarity > 0.75 OR concept overlap > 60%
 *
 * Logs EXACT_DUPLICATE and NEAR_DUPLICATE matches to agent_activity_log.
 * Stores all matches in agent memory for later review. Does NOT auto-delete
 * or merge content.
 */
async function detectDuplicates(contentId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient();

  const logBase = {
    orgId,
    agentType: AGENT_TYPE,
    actionType: 'detect_duplicate',
    contentId,
    targetEntity: 'content',
    targetId: contentId,
  } as const;

  // Fetch the new content's hashes and title
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id, title, video_hash, audio_hash')
    .eq('id', contentId)
    .single();

  if (contentError || !content) {
    console.error(`[CurateKnowledge] Cannot load content ${contentId} for duplicate check`);
    await logAgentAction({ ...logBase, outcome: 'failure', errorMessage: contentError?.message ?? 'Content not found' });
    return;
  }

  const perceptualMatches = await findPerceptualMatches(supabase, content.video_hash, content.audio_hash, orgId, contentId);
  const embeddingMatches = await findEmbeddingMatches(supabase, contentId, orgId);
  const conceptOverlapMap = await findConceptOverlap(supabase, contentId, orgId);

  const candidateIds = new Set([
    ...perceptualMatches.keys(),
    ...embeddingMatches.keys(),
    ...conceptOverlapMap.keys(),
  ]);

  if (candidateIds.size === 0) {
    console.log(`[CurateKnowledge] No duplicate candidates for ${contentId}`);
    return;
  }

  const { data: candidateRows } = await supabase
    .from('content')
    .select('id, title')
    .in('id', Array.from(candidateIds))
    .is('deleted_at', null);

  const titleMap = new Map((candidateRows ?? []).map(r => [r.id, r.title ?? 'Untitled']));

  const matches: DuplicateMatch[] = [...candidateIds].flatMap(candidateId => {
    const phash = perceptualMatches.get(candidateId) ?? null;
    const embedding = embeddingMatches.get(candidateId) ?? null;
    const concepts = conceptOverlapMap.get(candidateId) ?? null;
    const level = classifyDuplicateLevel(phash, embedding, concepts);

    if (!level) return [];
    return [{
      matchedContentId: candidateId,
      matchedTitle: titleMap.get(candidateId) ?? 'Untitled',
      level,
      perceptualSimilarity: phash,
      embeddingSimilarity: embedding,
      conceptOverlap: concepts,
    }];
  });

  if (matches.length === 0) {
    console.log(`[CurateKnowledge] No duplicates above threshold for ${contentId}`);
    return;
  }

  const actionableMatches = matches.filter(
    m => m.level === 'EXACT_DUPLICATE' || m.level === 'NEAR_DUPLICATE'
  );
  for (const match of actionableMatches) {
    await logAgentAction({
      ...logBase,
      outcome: 'success',
      outputSummary: JSON.stringify({
        level: match.level,
        matchedContentId: match.matchedContentId,
        matchedTitle: match.matchedTitle,
        perceptualSimilarity: match.perceptualSimilarity,
        embeddingSimilarity: match.embeddingSimilarity,
        conceptOverlap: match.conceptOverlap,
      }),
      metadata: { level: match.level, matchedContentId: match.matchedContentId },
    });
  }

  if (actionableMatches.length > 0) {
    const topMatch = actionableMatches[0];
    await requestApprovalWithCost(orgId, 'merge_content', contentId, {
      description: `Merge duplicate recordings: ${topMatch.matchedTitle} (${topMatch.level})`,
      proposedAction: {
        type: 'merge',
        sourceIds: actionableMatches.map(m => m.matchedContentId),
      },
    });
  }

  // Generate a structured merge suggestion for every NEAR_DUPLICATE pair.
  // Non-fatal: a logging failure here should not abort duplicate detection.
  const nearDuplicates = actionableMatches.filter(m => m.level === 'NEAR_DUPLICATE');
  if (nearDuplicates.length > 0) {
    try {
      await suggestMerges(contentId, orgId, nearDuplicates);
    } catch (mergeError) {
      console.error(
        `[CurateKnowledge] Merge suggestion logging failed for ${contentId} (non-critical):`,
        mergeError,
      );
    }
  }

  try {
    await storeMemory({
      orgId,
      agentType: AGENT_TYPE,
      key: `duplicate:${contentId}`,
      value: JSON.stringify(
        matches.map(m => ({
          matchedContentId: m.matchedContentId,
          level: m.level,
          perceptualSimilarity: m.perceptualSimilarity,
          embeddingSimilarity: m.embeddingSimilarity,
          conceptOverlap: m.conceptOverlap,
        }))
      ),
      importance: matches.some(m => m.level === 'EXACT_DUPLICATE') ? 0.9 : 0.7,
    });
  } catch (memoryError) {
    console.error('[CurateKnowledge] Duplicate memory store failed (non-critical):', memoryError);
  }

  const summary = matches.map(m => `${m.level}: ${m.matchedContentId}`).join(', ');
  console.log(`[CurateKnowledge] Duplicate detection for ${contentId}: ${summary}`);
}

/**
 * Classify a candidate into EXACT_DUPLICATE, NEAR_DUPLICATE, RELATED, or null.
 */
function classifyDuplicateLevel(
  perceptualSimilarity: number | null,
  embeddingSimilarity: number | null,
  conceptOverlap: number | null
): DuplicateLevel | null {
  // EXACT_DUPLICATE: perceptual hash > 95%
  if (perceptualSimilarity !== null && perceptualSimilarity > 95) {
    return 'EXACT_DUPLICATE';
  }

  // NEAR_DUPLICATE: embedding > 0.9 AND concept overlap > 80%
  if (
    embeddingSimilarity !== null && embeddingSimilarity > 0.9 &&
    conceptOverlap !== null && conceptOverlap > 80
  ) {
    return 'NEAR_DUPLICATE';
  }

  // RELATED: embedding > 0.75 OR concept overlap > 60%
  if (
    (embeddingSimilarity !== null && embeddingSimilarity > 0.75) ||
    (conceptOverlap !== null && conceptOverlap > 60)
  ) {
    return 'RELATED';
  }

  return null;
}

/**
 * Find content with similar perceptual hashes. Returns a map of
 * contentId -> overallSimilarity (0-100 percentage).
 * Gracefully returns empty map if the content has no hashes.
 */
async function findPerceptualMatches(
  supabase: ReturnType<typeof createAdminClient>,
  videoHash: string | null,
  audioHash: string | null,
  orgId: string,
  excludeContentId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (!videoHash || !audioHash) return result;
  // Zero hashes indicate failed or missing hash computation
  if (videoHash === ZERO_HASH && audioHash === ZERO_HASH) return result;

  const { data: candidates } = await supabase
    .from('content')
    .select('id, video_hash, audio_hash')
    .eq('org_id', orgId)
    .not('video_hash', 'is', null)
    .not('audio_hash', 'is', null)
    .neq('id', excludeContentId)
    .is('deleted_at', null);

  if (!candidates?.length) return result;

  for (const candidate of candidates) {
    try {
      const videoSim = hammingToSimilarity(hammingDistance(videoHash, candidate.video_hash!));
      const audioSim = hammingToSimilarity(hammingDistance(audioHash, candidate.audio_hash!));
      const overall = videoSim * 0.6 + audioSim * 0.4;

      if (overall > 50) {
        result.set(candidate.id, Math.round(overall * 100) / 100);
      }
    } catch {
      // Hash length mismatch; skip candidate
    }
  }

  return result;
}

/**
 * Find content with similar transcript embeddings. Returns a map of
 * contentId -> cosineSimilarity (0-1 scale).
 * Gracefully returns empty map if the content has no transcript chunks.
 */
async function findEmbeddingMatches(
  supabase: ReturnType<typeof createAdminClient>,
  contentId: string,
  orgId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('chunk_text')
    .eq('content_id', contentId)
    .eq('org_id', orgId)
    .order('chunk_index', { ascending: true })
    .limit(5);

  if (!chunks?.length) return result;

  const representativeText = chunks.map(c => c.chunk_text).join(' ').slice(0, 2000);
  if (!representativeText.trim()) return result;

  let queryEmbedding: number[];
  try {
    const embeddingResult = await generateEmbeddingWithFallback(representativeText, 'RETRIEVAL_QUERY');
    queryEmbedding = embeddingResult.embedding;
  } catch (error) {
    console.error(`[CurateKnowledge] Embedding generation failed for ${contentId}:`, error);
    return result;
  }

  const { data: matches, error } = await supabase.rpc('match_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: 0.7, // Low threshold to catch RELATED items
    match_count: 20,
    filter_org_id: orgId,
    filter_content_ids: null,
    filter_source: null,
    filter_date_from: null,
    filter_date_to: null,
    filter_content_types: null,
    exclude_deleted: true,
  });

  if (error || !matches) {
    console.error(`[CurateKnowledge] match_chunks failed for ${contentId}:`, error?.message);
    return result;
  }

  for (const match of matches as { content_id: string; similarity: number }[]) {
    if (match.content_id === contentId) continue;
    const existing = result.get(match.content_id);
    if (!existing || match.similarity > existing) {
      result.set(match.content_id, Math.round(match.similarity * 1000) / 1000);
    }
  }

  return result;
}

/**
 * Find content that shares concepts with the given content. Returns a map of
 * contentId -> overlapPercentage (0-100).
 * Gracefully returns empty map if the content has no concepts.
 */
async function findConceptOverlap(
  supabase: ReturnType<typeof createAdminClient>,
  contentId: string,
  orgId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const concepts = await getConceptsForContent(contentId);
  if (concepts.length === 0) return result;

  const conceptIds = concepts.map(c => c.id);

  const { data: activeContent } = await supabase
    .from('content')
    .select('id')
    .eq('org_id', orgId)
    .neq('id', contentId)
    .is('deleted_at', null)
    .in('status', ['completed', 'transcribed']);

  if (!activeContent?.length) return result;

  const { data: mentions } = await supabase
    .from('concept_mentions')
    .select('content_id, concept_id')
    .in('concept_id', conceptIds)
    .eq('org_id', orgId)
    .in('content_id', activeContent.map(c => c.id));

  if (!mentions?.length) return result;

  const sharedCounts = new Map<string, Set<string>>();
  for (const { content_id, concept_id } of mentions) {
    if (!sharedCounts.has(content_id)) {
      sharedCounts.set(content_id, new Set());
    }
    sharedCounts.get(content_id)!.add(concept_id);
  }

  for (const [otherContentId, sharedSet] of sharedCounts) {
    const overlapPercent = (sharedSet.size / conceptIds.length) * 100;
    result.set(otherContentId, Math.round(overlapPercent * 100) / 100);
  }

  return result;
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

    return (parsed as Partial<TagSuggestion>[])
      .filter(
        (s): s is TagSuggestion =>
          typeof s?.name === 'string' &&
          s.name.length > 0 &&
          typeof s?.confidence === 'number' &&
          s.confidence >= 0 &&
          s.confidence <= 1
      )
      .map(s => ({
        name: s.name.trim().toLowerCase(),
        confidence: Math.round(s.confidence * 100) / 100,
        reason: s.reason?.trim() ?? '',
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

    const dupeIdx = result.findIndex(kept => areSimilarTags(kept.name, lower));
    if (dupeIdx >= 0) {
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

/** Check if two tag names are near-duplicates (e.g., "deploy"/"deployment"). */
function areSimilarTags(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  return longer.startsWith(shorter) && longer.length - shorter.length <= 5;
}

// ---------------------------------------------------------------------------
// Merge suggestion
// ---------------------------------------------------------------------------

/**
 * Build a merge suggestion for a NEAR_DUPLICATE pair.
 *
 * Determines the suggested action from the similarity metrics:
 * - conceptOverlap ≥ 80 %  → archive_older (one clearly supersedes the other)
 * - otherwise              → review
 *
 * The reason includes the overlap percentages and identifies which item is newer.
 */
function buildMergeSuggestion(
  contentId: string,
  contentTitle: string,
  contentCreatedAt: string | null,
  match: DuplicateMatch,
  matchedCreatedAt: string | null,
): MergeSuggestion {
  const overlapPct = match.conceptOverlap !== null ? Math.round(match.conceptOverlap) : null;
  const embPct = match.embeddingSimilarity !== null
    ? Math.round(match.embeddingSimilarity * 100)
    : null;

  // Identify which item is older so the reason can name it explicitly.
  const currentDate = contentCreatedAt ? new Date(contentCreatedAt) : null;
  const matchedDate = matchedCreatedAt ? new Date(matchedCreatedAt) : null;
  const currentIsOlder =
    currentDate && matchedDate ? currentDate < matchedDate : null;
  const newerTitle = currentIsOlder === true ? match.matchedTitle : contentTitle;

  const overlapDesc = overlapPct !== null ? `${overlapPct}% concept overlap` : 'high content similarity';
  const embeddingDesc = embPct !== null ? ` and ${embPct}% embedding similarity` : '';
  const reason =
    `Both "${contentTitle}" and "${match.matchedTitle}" cover similar content with ` +
    `${overlapDesc}${embeddingDesc}. "${newerTitle}" is newer and may be more comprehensive.`;

  const suggestedAction: MergeSuggestion['suggestedAction'] =
    overlapPct !== null && overlapPct >= 80 ? 'archive_older' : 'review';

  return { sourceIds: [contentId, match.matchedContentId], reason, suggestedAction };
}

/**
 * Log merge suggestions for all NEAR_DUPLICATE matches of a content item.
 *
 * Each suggestion is recorded in agent_activity_log with action_type 'suggest_merge'
 * and an output_summary containing { sourceIds, reason, suggestedAction }.
 */
async function suggestMerges(
  contentId: string,
  orgId: string,
  nearDuplicates: DuplicateMatch[],
): Promise<void> {
  if (nearDuplicates.length === 0) return;

  const supabase = createAdminClient();

  const allIds = [contentId, ...nearDuplicates.map(m => m.matchedContentId)];
  const { data: contentRows } = await supabase
    .from('content')
    .select('id, title, created_at')
    .in('id', allIds);

  const contentMap = new Map((contentRows ?? []).map(r => [r.id, r]));
  const currentContent = contentMap.get(contentId);

  for (const match of nearDuplicates) {
    const matchedContent = contentMap.get(match.matchedContentId);
    const suggestion = buildMergeSuggestion(
      contentId,
      currentContent?.title ?? 'Untitled',
      currentContent?.created_at ?? null,
      match,
      matchedContent?.created_at ?? null,
    );

    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'suggest_merge',
      contentId,
      targetEntity: 'content',
      targetId: match.matchedContentId,
      outcome: 'success',
      outputSummary: JSON.stringify(suggestion),
      metadata: {
        level: match.level,
        embeddingSimilarity: match.embeddingSimilarity,
        conceptOverlap: match.conceptOverlap,
        perceptualSimilarity: match.perceptualSimilarity,
      },
    });

    console.log(
      `[CurateKnowledge] Merge suggestion: ${contentId} ↔ ${match.matchedContentId} → ${suggestion.suggestedAction}`
    );
  }
}

// ---------------------------------------------------------------------------
// Staleness detection
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_STALENESS_THRESHOLD_DAYS = 90;

/**
 * Detect stale content in the org triggered by a new content item.
 *
 * Three independent criteria:
 * 1. Content age: updated_at older than configurable threshold (default 90 days)
 * 2. Concept freshness: newer content covers the same concepts
 * 3. Supersession: newer content has same title pattern or 80%+ concept overlap
 *
 * Each stale item is logged to agent_activity_log (action_type 'detect_stale')
 * and stored in agent memory with key 'stale:{contentId}'.
 */
async function detectStaleness(contentId: string, orgId: string): Promise<void> {
  const supabase = createAdminClient();

  // Read configurable threshold from org_agent_settings.metadata
  const settings = await getAgentSettings(orgId);
  const metadata = (settings.metadata ?? {}) as Record<string, unknown>;
  const thresholdDays =
    typeof metadata.staleness_threshold_days === 'number'
      ? metadata.staleness_threshold_days
      : DEFAULT_STALENESS_THRESHOLD_DAYS;

  const now = new Date();
  const thresholdDate = new Date(now.getTime() - thresholdDays * MS_PER_DAY);

  // Fetch the new content item (used for supersession/freshness comparison)
  const { data: newContent, error: contentError } = await supabase
    .from('content')
    .select('id, title, updated_at')
    .eq('id', contentId)
    .single();

  if (contentError || !newContent) {
    console.error(`[CurateKnowledge] Cannot load content ${contentId} for staleness check`);
    return;
  }

  const newConcepts = await getConceptsForContent(contentId);
  const newConceptIds = newConcepts.map(c => c.id);

  // Concept overlap: other contentId -> shared concept count
  const conceptOverlap = new Map<string, number>();

  if (newConceptIds.length > 0) {
    const { data: mentions } = await supabase
      .from('concept_mentions')
      .select('content_id, concept_id')
      .in('concept_id', newConceptIds)
      .eq('org_id', orgId)
      .neq('content_id', contentId);

    for (const { content_id } of mentions ?? []) {
      conceptOverlap.set(content_id, (conceptOverlap.get(content_id) ?? 0) + 1);
    }
  }

  // Criterion 1: age-based candidates (updated_at before threshold)
  const { data: agedContent } = await supabase
    .from('content')
    .select('id')
    .eq('org_id', orgId)
    .neq('id', contentId)
    .is('deleted_at', null)
    .in('status', ['completed', 'transcribed'])
    .lt('updated_at', thresholdDate.toISOString());

  const candidateIds = new Set([
    ...(agedContent ?? []).map(c => c.id),
    ...conceptOverlap.keys(),
  ]);

  if (candidateIds.size === 0) {
    console.log(`[CurateKnowledge] No staleness candidates for ${contentId}`);
    return;
  }

  // Fetch full details for all candidates in one query
  const { data: candidates } = await supabase
    .from('content')
    .select('id, title, updated_at')
    .in('id', Array.from(candidateIds))
    .is('deleted_at', null)
    .in('status', ['completed', 'transcribed']);

  if (!candidates?.length) return;

  // Batch-fetch total concept counts per candidate (for overlap %)
  const candidateConceptCounts = new Map<string, number>();
  const candidateIdSet = new Set(candidates.map(c => c.id));
  const overlapIds = [...conceptOverlap.keys()].filter(id => candidateIdSet.has(id));

  if (overlapIds.length > 0) {
    const { data: allMentions } = await supabase
      .from('concept_mentions')
      .select('content_id, concept_id')
      .in('content_id', overlapIds)
      .eq('org_id', orgId);

    const perContent = new Map<string, Set<string>>();
    for (const { content_id, concept_id } of allMentions ?? []) {
      if (!perContent.has(content_id)) {
        perContent.set(content_id, new Set());
      }
      perContent.get(content_id)!.add(concept_id);
    }
    for (const [cid, conceptSet] of perContent) {
      candidateConceptCounts.set(cid, conceptSet.size);
    }
  }

  let flaggedCount = 0;

  for (const item of candidates) {
    const reasons: string[] = [];
    let confidence = 0;
    let supersededBy: string | null = null;

    const updatedAt = new Date(item.updated_at);
    const daysSinceUpdate = Math.floor(
      (now.getTime() - updatedAt.getTime()) / MS_PER_DAY
    );

    // Criterion 1: content age
    if (daysSinceUpdate > thresholdDays) {
      reasons.push(
        `Content is ${daysSinceUpdate} days old (threshold: ${thresholdDays} days) and has not been updated`
      );
      confidence = Math.max(
        confidence,
        Math.min(0.9, 0.5 + (daysSinceUpdate - thresholdDays) / 365)
      );
    }

    // Criteria 2 & 3 only apply to content older than the new item
    const isOlderThanNew = item.updated_at < newContent.updated_at;
    if (isOlderThanNew && newConceptIds.length > 0) {
      const sharedCount = conceptOverlap.get(item.id) ?? 0;
      const oldConceptCount = candidateConceptCounts.get(item.id) ?? 0;
      const overlapPercent = oldConceptCount > 0
        ? (sharedCount / oldConceptCount) * 100
        : 0;

      // Criterion 3: supersession (80%+ concept overlap OR matching title)
      const titleMatch =
        newContent.title != null &&
        item.title != null &&
        areSimilarTitles(item.title, newContent.title);

      if (overlapPercent >= 80 || titleMatch) {
        supersededBy = contentId;
        const detail =
          overlapPercent >= 80
            ? `${Math.round(overlapPercent)}% concept overlap`
            : 'matching title pattern';
        reasons.push(
          `Potentially superseded by "${newContent.title ?? 'Untitled'}" (${detail})`
        );
        confidence = Math.max(confidence, 0.8);

        // When concept overlap ≥ 80%, mark any active workflows for this content as outdated
        if (overlapPercent >= 80) {
          try {
            await markSupersededWorkflowsAsOutdated(supabase, item.id, contentId, orgId);
          } catch (workflowError) {
            console.error(
              `[CurateKnowledge] Failed to mark workflows outdated for ${item.id} (non-critical):`,
              workflowError,
            );
          }
        }
      }
      // Criterion 2: concept freshness (any shared concepts, lower signal)
      else if (sharedCount > 0) {
        reasons.push(
          `Newer content "${newContent.title ?? 'Untitled'}" covers similar concepts`
        );
        confidence = Math.max(confidence, 0.6);
      }
    }

    if (reasons.length === 0) continue;
    flaggedCount++;

    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'detect_stale',
      contentId: item.id,
      targetEntity: 'content',
      targetId: item.id,
      outcome: 'success',
      confidence,
      outputSummary: reasons.join('; '),
      metadata: {
        daysSinceUpdate,
        thresholdDays,
        supersededBy,
        triggeredByContentId: contentId,
      },
    });

    if (confidence >= 0.7) {
      await requestApprovalWithCost(orgId, 'archive_content', item.id, {
        description: `Archive stale content: ${item.title ?? 'Untitled'} (${reasons[0]})`,
        proposedAction: {
          type: 'archive',
          contentId: item.id,
          reason: reasons.join('; '),
          confidence,
        },
      });
    }

    try {
      await storeMemory({
        orgId,
        agentType: AGENT_TYPE,
        key: `stale:${item.id}`,
        value: JSON.stringify({
          reason: reasons.join('; '),
          confidence,
          daysSinceUpdate,
          thresholdDays,
          supersededBy,
          detectedAt: now.toISOString(),
        }),
        importance: confidence,
      });
    } catch (memoryError) {
      console.error(
        '[CurateKnowledge] Staleness memory store failed (non-critical):',
        memoryError
      );
    }
  }

  console.log(
    `[CurateKnowledge] Staleness check triggered by ${contentId}: flagged ${flaggedCount} of ${candidates.length} candidates`
  );
}

/**
 * Mark the active workflows of a superseded content item as 'outdated'.
 *
 * When new content covers 80%+ of an existing content item's concepts, the
 * existing workflows are no longer current. This function:
 * 1. Checks whether the superseded content has any active (draft/published) workflows.
 * 2. Looks up the new content's most recent workflow (if already extracted).
 * 3. Updates the superseded workflows to status='outdated', setting superseded_by
 *    to the new workflow's ID when available (null if extraction hasn't run yet).
 */
async function markSupersededWorkflowsAsOutdated(
  supabase: ReturnType<typeof createAdminClient>,
  supersededContentId: string,
  newContentId: string,
  orgId: string,
): Promise<void> {
  const { data: existingWorkflows } = await supabase
    .from('workflows')
    .select('id')
    .eq('content_id', supersededContentId)
    .eq('org_id', orgId)
    .in('status', ['draft', 'published']);

  if (!existingWorkflows?.length) return;

  // Find the new content's most recent workflow (may not exist yet if extraction
  // hasn't run — superseded_by will be updated once workflow_extraction completes)
  const { data: newWorkflow } = await supabase
    .from('workflows')
    .select('id')
    .eq('content_id', newContentId)
    .eq('org_id', orgId)
    .in('status', ['draft', 'published'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const supersededById = newWorkflow?.id ?? null;

  await supabase
    .from('workflows')
    .update({ status: 'outdated', superseded_by: supersededById })
    .eq('content_id', supersededContentId)
    .eq('org_id', orgId)
    .in('id', existingWorkflows.map(w => w.id));

  console.log(
    `[CurateKnowledge] Marked ${existingWorkflows.length} workflow(s) for content ${supersededContentId} as outdated` +
      (supersededById ? ` — superseded by workflow ${supersededById}` : ' (new workflow not yet extracted)'),
  );
}

/**
 * Check if two titles follow the same pattern. True when titles match
 * case-insensitively or one contains the other (minimum 5 chars to avoid
 * false positives on very short titles).
 */
function areSimilarTitles(a: string, b: string): boolean {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return true;
  const longer = normA.length >= normB.length ? normA : normB;
  const shorter = normA.length >= normB.length ? normB : normA;
  return shorter.length >= 5 && longer.includes(shorter);
}
