/**
 * Compile Wiki — Step 5: Cross-page contradiction detection (TRIB-41)
 *
 * After TRIB-39's relationship extraction runs, this module looks for OTHER
 * live wiki pages in the same org that address overlapping ground but were
 * not edited by the current `compile_wiki` invocation, and emits inferred
 * `contradicts` edges when the content of the pages disagrees.
 *
 * Why: `compile-wiki.ts` picks a single existing page to merge into by
 * exact `(org_id, app, screen, topic)` match (scoped to `valid_until IS NULL`).
 * When classification drifts across recordings — e.g. one recording lands on
 * topic `lead-disposition-web` and another on `lead-disposition-inbound-web`
 * for the same UI — the second recording updates only ONE of the two pages
 * and the other drifts out of sync. TRIB-41 closes that gap by explicitly
 * linking the stale page to the freshly-edited one with a typed
 * `contradicts` relationship so the admin review dashboard and wiki lint
 * cron (TRIB-42) can surface it.
 *
 * Algorithm:
 *   1. Load every live sibling page in the org that shares the current
 *      page's `(app, screen)` pair. Null values on either axis disable the
 *      match to avoid the `null=null` footgun — cross-page detection only
 *      runs when we have a concrete app+screen to group on.
 *   2. For each sibling, call Gemini with the current page body + the
 *      sibling body and ask for a strict JSON verdict:
 *        { contradicts: boolean, evidence: string, confidence: number }
 *   3. When a sibling is flagged contradicts, upsert a `wiki_relationships`
 *      row with `relationship_type='contradicts'`, `source_type='inferred'`,
 *      confidence from the LLM, and the evidence string.
 *
 * Failure policy: best-effort — every network / LLM error is caught and
 * logged as a warn. The parent `compile_wiki` job never fails because of
 * cross-page detection.
 */

import { GoogleGenAI } from '@google/genai';

import type { createClient as createAdminClient } from '@/lib/supabase/admin';
import { sanitizeVisualDescription } from '@/lib/utils/security';
import type { Database } from '@/lib/types/database';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type WikiRelationshipInsert =
  Database['public']['Tables']['wiki_relationships']['Insert'];

type SiblingPage = {
  id: string;
  topic: string | null;
  app: string | null;
  screen: string | null;
  content: string;
};

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Hard cap on siblings we will diff per compile_wiki invocation. Bounds cost. */
const MAX_SIBLINGS_PER_COMPILATION = 5;

/** Max characters of page body sent to the LLM on each side of the diff. */
const MAX_CONTENT_CHARS = 6000;

/** Floor confidence below which we drop the contradiction entirely. */
const MIN_CONTRADICTION_CONFIDENCE = 0.5;

// ---------------------------------------------------------------------------
// Gemini client (lazy, matches compile-wiki.ts pattern)
// ---------------------------------------------------------------------------

let _genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!_genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    _genaiClient = new GoogleGenAI({ apiKey });
  }
  return _genaiClient;
}

async function callGemini(
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number } = {}
): Promise<string> {
  const genai = getGenAIClient();
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    },
  });
  return result.text ?? '';
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface RunCrossPageContradictionInputs {
  supabase: SupabaseAdminClient;
  orgId: string;
  pageId: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  recordingId: string;
}

/**
 * Detect contradictions between the current page and its siblings in the
 * same `(app, screen)` group. Emits inferred `contradicts` edges in
 * `wiki_relationships`. Wraps every failure in a warn log — never throws.
 */
export async function runCrossPageContradictionDetection(
  inputs: RunCrossPageContradictionInputs
): Promise<void> {
  try {
    await detectAndWriteCrossPageContradictions(inputs);
  } catch (error) {
    console.warn(
      `[compile-wiki] Step 5 cross-page contradiction detection failed for page ${inputs.pageId} ` +
        `(org=${inputs.orgId}, recording=${inputs.recordingId}): ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function detectAndWriteCrossPageContradictions(
  inputs: RunCrossPageContradictionInputs
): Promise<void> {
  const { supabase, orgId, pageId, app, screen, topic, content, recordingId } = inputs;

  // Cross-page detection only runs when we have a concrete app+screen pair.
  // Null on either axis means "no UI grouping" — matching everything with
  // null would flood the admin queue with false positives.
  if (!app || !screen) {
    return;
  }

  if (!content || content.trim().length === 0) {
    return;
  }

  // ---- 1. Load candidate siblings ------------------------------------------
  const siblingsResponse = await supabase
    .from('org_wiki_pages')
    .select('id, topic, app, screen, content')
    .eq('org_id', orgId)
    .eq('app', app)
    .eq('screen', screen)
    .is('valid_until', null)
    .neq('id', pageId)
    .limit(MAX_SIBLINGS_PER_COMPILATION);

  if (siblingsResponse.error) {
    throw new Error(
      `Failed to load cross-page contradiction candidates: ${siblingsResponse.error.message}`
    );
  }

  const siblings = (siblingsResponse.data as SiblingPage[] | null) ?? [];
  if (siblings.length === 0) {
    return;
  }

  // ---- 2. LLM-diff each sibling against the current page -------------------
  const currentExcerpt = sanitizeVisualDescription(content, MAX_CONTENT_CHARS);

  const rows: WikiRelationshipInsert[] = [];

  for (const sibling of siblings) {
    const siblingExcerpt = sanitizeVisualDescription(sibling.content, MAX_CONTENT_CHARS);

    const verdict = await detectPairwiseContradiction({
      currentTopic: topic,
      currentContent: currentExcerpt,
      siblingTopic: sibling.topic ?? '(unknown)',
      siblingContent: siblingExcerpt,
      recordingId,
    });

    if (!verdict || !verdict.contradicts) continue;
    if (verdict.confidence < MIN_CONTRADICTION_CONFIDENCE) continue;

    rows.push({
      org_id: orgId,
      source_page_id: pageId,
      target_page_id: sibling.id,
      relationship_type: 'contradicts',
      confidence: verdict.confidence,
      source_type: 'inferred',
      evidence: verdict.evidence,
    });
  }

  if (rows.length === 0) {
    return;
  }

  // ---- 3. Upsert into wiki_relationships -----------------------------------
  const { error: upsertError } = await supabase
    .from('wiki_relationships')
    .upsert(rows as never, {
      onConflict: 'org_id,source_page_id,target_page_id,relationship_type',
      ignoreDuplicates: true,
    });

  if (upsertError) {
    throw new Error(
      `Failed to upsert cross-page contradiction rows: ${upsertError.message}`
    );
  }

  console.log(
    `[compile-wiki] Step 5: wrote ${rows.length} cross-page contradiction edge(s) for page ${pageId} ` +
      `(app=${app}, screen=${screen}, ${siblings.length} sibling(s) considered)`
  );
}

// ---------------------------------------------------------------------------
// Pairwise LLM diff
// ---------------------------------------------------------------------------

interface PairwiseVerdict {
  contradicts: boolean;
  confidence: number;
  evidence: string | null;
}

async function detectPairwiseContradiction(params: {
  currentTopic: string;
  currentContent: string;
  siblingTopic: string;
  siblingContent: string;
  recordingId: string;
}): Promise<PairwiseVerdict | null> {
  const prompt = `You are a knowledge-base auditor. Your job is to compare two wiki pages from the same organization and the same application screen, and decide whether they contain contradictory guidance.

PAGE A — topic "${params.currentTopic}":
"""
${params.currentContent}
"""

PAGE B — topic "${params.siblingTopic}":
"""
${params.siblingContent}
"""

Return ONLY a JSON object of the form:
{
  "contradicts": true | false,
  "confidence": <number between 0 and 1>,
  "evidence": "one short sentence (<= 200 chars) describing the contradicting fact, or null"
}

Rules:
1. "contradicts" means the two pages give conflicting instructions about the SAME step, field, or outcome — e.g. page A says "click Save" and page B says "click Submit" for the same action. A mere difference in scope (page A covers more steps than page B) is NOT a contradiction.
2. Use confidence >= 0.9 for directly contradictory statements, 0.6-0.89 for clear but paraphrased contradictions, and below 0.5 for speculative conflicts (which should set contradicts=false).
3. Do not wrap the JSON in markdown fences. Do not emit any commentary before or after the JSON.
4. Evidence must quote or paraphrase the specific conflict in <= 200 characters.`;

  let responseText = '';
  try {
    responseText = await callGemini(prompt, {
      temperature: 0.2,
      maxOutputTokens: 512,
    });
  } catch (error) {
    console.warn(
      `[compile-wiki] Step 5: pairwise LLM call failed for recording ${params.recordingId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }

  return parsePairwiseVerdict(responseText, params.recordingId);
}

function parsePairwiseVerdict(
  responseText: string,
  recordingId: string
): PairwiseVerdict | null {
  if (!responseText) return null;

  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const contradicts = parsed.contradicts === true;
    const rawConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence))
      : 0;
    const evidence =
      typeof parsed.evidence === 'string' && parsed.evidence.trim().length > 0
        ? parsed.evidence.trim().slice(0, 500)
        : null;

    return { contradicts, confidence, evidence };
  } catch (error) {
    console.warn(
      `[compile-wiki] Step 5: failed to parse pairwise verdict JSON for ${recordingId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
