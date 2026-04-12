/**
 * Compile Wiki — Step 4: Relationship extraction (TRIB-39)
 *
 * After a wiki page is created or updated by `compile-wiki.ts`, this module
 * extracts typed relationships to other pages in the same org and writes
 * them to `wiki_relationships`. Two sources feed the extraction:
 *
 *   1. Obsidian-style [[wiki-links]] in the page body — resolved by
 *      case-insensitive topic match scoped to org_id. These are emitted as
 *      EXTRACTED edges (confidence 1.0, source_type='extracted',
 *      relationship_type='related').
 *
 *   2. LLM semantic extraction — Gemini 2.5 Flash at temperature 0.3
 *      produces a JSON-strict list of `{target_topic, type, confidence,
 *      evidence}` tuples. Classifications follow the Graphify rubric:
 *
 *        - EXTRACTED (confidence >= 0.9, source_type='extracted')
 *            Directly stated in the page body, e.g. "after X you must do Y"
 *        - INFERRED  (0.5 <= confidence < 0.9, source_type='inferred')
 *            Reasonable connection based on shared workflow context
 *        - AMBIGUOUS (confidence < 0.5,   source_type='inferred')
 *            Vague mention — flagged for review via low confidence
 *
 * Symmetric handling: `relationship_type='related'` writes two edges
 * (source→target AND target→source). Directional types
 * (`requires`, `precedes`, `contradicts`) only write the forward edge.
 *
 * Dedupe: `upsert` with `onConflict` on the
 * `(org_id, source_page_id, target_page_id, relationship_type)` unique
 * constraint and `ignoreDuplicates: true`.
 *
 * Backlinks: After extracting edges, a `## Related Pages` block is rendered
 * into the page body with Obsidian-style `[[topic]]` links. The block is
 * delimited by HTML comment markers so re-compilations replace it in place
 * rather than appending duplicates. `[[wiki-links]]` already present in the
 * content are PRESERVED — we never strip them.
 *
 * Failure policy: The entry point `runRelationshipExtraction` is wrapped in
 * a top-level try/catch that only emits warn logs. Step 4 is purely
 * additive: the parent `compile_wiki` job should still complete successfully
 * even if relationship extraction fails — the page just ships without its
 * edges and the wiki lint cron (TRIB-42) will backfill later.
 */

import { GoogleGenAI } from '@google/genai';

import type { createClient as createAdminClient } from '@/lib/supabase/admin';
import { detectPII, logPIIDetection, sanitizeVisualDescription } from '@/lib/utils/security';
import type { Database } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WikiRelationshipType = 'requires' | 'precedes' | 'contradicts' | 'related';
type WikiRelationshipSourceType = 'extracted' | 'inferred' | 'manual';
type WikiRelationshipInsert =
  Database['public']['Tables']['wiki_relationships']['Insert'];

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

interface ExtractedRelationshipCandidate {
  target_topic: string;
  relationship_type: WikiRelationshipType;
  confidence: number;
  source_type: WikiRelationshipSourceType;
  evidence: string | null;
}

export interface RunRelationshipExtractionInputs {
  supabase: SupabaseAdminClient;
  orgId: string;
  pageId: string;
  topic: string;
  content: string;
  recordingId: string;
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Topic column is `text` but we cap slugs at 120 chars elsewhere — bail early on anything longer. */
const MAX_TOPIC_LENGTH = 120;

/** Hard cap on edges written per compilation. Bounds LLM cost and write volume. */
const MAX_RELATIONSHIPS_PER_COMPILATION = 20;

/** Confidence band thresholds for the Graphify-style rubric. */
const CONFIDENCE_EXTRACTED_MIN = 0.9;

/** Max characters of page body to send to the extraction LLM. */
const MAX_CONTENT_CHARS_FOR_EXTRACTION = 12000;

/** Max known-topic lines included in the LLM prompt (bounds context window cost on large orgs). */
const MAX_KNOWN_TOPICS_IN_PROMPT = 400;

// ---------------------------------------------------------------------------
// Lazy Gemini client (matches compile-wiki.ts pattern)
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
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  });
  return result.text ?? '';
}

function checkAndLogPII(text: string, source: string, recordingId?: string): void {
  const piiCheck = detectPII(text);
  if (piiCheck.hasPII) {
    logPIIDetection(source, piiCheck.types, recordingId);
  }
}

function clampConfidence(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Entry point — called from compile-wiki.ts for both new + update paths
// ---------------------------------------------------------------------------

export async function runRelationshipExtraction(
  inputs: RunRelationshipExtractionInputs
): Promise<void> {
  try {
    await extractAndWriteRelationships(inputs);
  } catch (error) {
    // Step 4 is additive — never fail the parent compile_wiki job.
    console.warn(
      `[compile-wiki] Step 4 relationship extraction failed for page ${inputs.pageId} ` +
        `(org=${inputs.orgId}, recording=${inputs.recordingId}): ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

async function extractAndWriteRelationships(
  inputs: RunRelationshipExtractionInputs
): Promise<void> {
  const { supabase, orgId, pageId, topic, content, recordingId } = inputs;

  if (!content || content.trim().length === 0) {
    return;
  }

  // ---- 1. Load sibling pages in the same org (topic → id lookup) ----------
  const otherPagesResponse = await supabase
    .from('org_wiki_pages')
    .select('id, topic')
    .eq('org_id', orgId)
    .is('valid_until', null);

  if (otherPagesResponse.error) {
    throw new Error(
      `Failed to load org wiki pages for relationship extraction: ${otherPagesResponse.error.message}`
    );
  }

  const otherPages = (otherPagesResponse.data as
    | Array<{ id: string; topic: string | null }>
    | null) ?? [];

  // Map lowercased topic → page id. Exclude the current page so we never
  // emit self-loop edges.
  const topicIndex = new Map<string, string>();
  for (const p of otherPages) {
    if (!p.topic || p.id === pageId) continue;
    topicIndex.set(p.topic.toLowerCase(), p.id);
  }

  if (topicIndex.size === 0) {
    console.log(
      `[compile-wiki] Step 4: no sibling pages in org ${orgId}, skipping relationship extraction for page ${pageId}`
    );
    return;
  }

  const candidates: ExtractedRelationshipCandidate[] = [];

  // ---- 2. [[wiki-link]] harvest (EXTRACTED 'related' edges, conf 1.0) ----
  const bracketTargets = parseBracketLinks(content);
  for (const raw of bracketTargets) {
    const normalized = raw.toLowerCase();
    if (normalized === topic.toLowerCase()) continue; // guard self-loops
    candidates.push({
      target_topic: normalized,
      relationship_type: 'related',
      confidence: 1.0,
      source_type: 'extracted',
      evidence: `Obsidian-style bracket link [[${raw}]] in page body`,
    });
  }

  // ---- 3. LLM semantic extraction -----------------------------------------
  const knownTopics = Array.from(topicIndex.keys());
  const llmCandidates = await extractRelationshipsWithLLM({
    pageTopic: topic,
    pageContent: content,
    knownTopics,
    recordingId,
  });
  candidates.push(...llmCandidates);

  if (candidates.length === 0) {
    console.log(
      `[compile-wiki] Step 4: no relationship candidates for page ${pageId}`
    );
    return;
  }

  // ---- 4. Resolve topics → page ids and dedupe by (topic, type) -----------
  // Keep the highest-confidence candidate for each unique (topic, type) pair.
  const bestByKey = new Map<string, ExtractedRelationshipCandidate>();
  for (const c of candidates) {
    const normalizedTopic = c.target_topic.toLowerCase();
    if (normalizedTopic === topic.toLowerCase()) continue;
    if (!topicIndex.has(normalizedTopic)) continue;
    const key = `${normalizedTopic}::${c.relationship_type}`;
    const existing = bestByKey.get(key);
    if (!existing || c.confidence > existing.confidence) {
      bestByKey.set(key, { ...c, target_topic: normalizedTopic });
    }
  }

  const resolved = Array.from(bestByKey.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_RELATIONSHIPS_PER_COMPILATION);

  if (resolved.length === 0) {
    console.log(
      `[compile-wiki] Step 4: no resolvable targets for page ${pageId} ` +
        `(${candidates.length} candidates, ${topicIndex.size} known topics)`
    );
    return;
  }

  // ---- 5. Build bidirectional rows (symmetric for 'related') --------------
  const rows: WikiRelationshipInsert[] = [];
  for (const c of resolved) {
    const targetPageId = topicIndex.get(c.target_topic);
    if (!targetPageId) continue;

    const normalizedConfidence = clampConfidence(c.confidence);

    rows.push({
      org_id: orgId,
      source_page_id: pageId,
      target_page_id: targetPageId,
      relationship_type: c.relationship_type,
      confidence: normalizedConfidence,
      source_type: c.source_type,
      evidence: c.evidence,
    });

    // 'related' is symmetric → also emit the reverse edge.
    // Directional types (requires/precedes/contradicts) do NOT get a reverse.
    if (c.relationship_type === 'related') {
      rows.push({
        org_id: orgId,
        source_page_id: targetPageId,
        target_page_id: pageId,
        relationship_type: 'related',
        confidence: normalizedConfidence,
        source_type: c.source_type,
        evidence: c.evidence,
      });
    }
  }

  if (rows.length === 0) return;

  // ---- 6. Upsert with on-conflict dedupe ----------------------------------
  const { error: upsertError } = await supabase
    .from('wiki_relationships')
    .upsert(rows as never, {
      onConflict: 'org_id,source_page_id,target_page_id,relationship_type',
      ignoreDuplicates: true,
    });

  if (upsertError) {
    throw new Error(
      `Failed to upsert wiki_relationships rows: ${upsertError.message}`
    );
  }

  // ---- 7. Render Obsidian backlinks into the page body -------------------
  // Best-effort: failures log but don't propagate up.
  try {
    await renderRelationshipBacklinks({
      supabase,
      pageId,
      content,
      relationships: resolved,
    });
  } catch (backlinkError) {
    console.warn(
      `[compile-wiki] Step 4: failed to render backlinks on page ${pageId}:`,
      backlinkError instanceof Error ? backlinkError.message : backlinkError
    );
  }

  const extractedCount = resolved.filter((r) => r.source_type === 'extracted').length;
  const inferredCount = resolved.filter((r) => r.source_type === 'inferred').length;
  console.log(
    `[compile-wiki] Step 4: wrote ${rows.length} relationship edge(s) for page ${pageId} ` +
      `(${extractedCount} extracted, ${inferredCount} inferred, ${bracketTargets.length} bracket links)`
  );
}

// ---------------------------------------------------------------------------
// [[wiki-link]] extraction
// ---------------------------------------------------------------------------

/**
 * Parse Obsidian-style `[[wiki-link]]` targets out of page content. Matches
 * both `[[topic]]` and `[[topic|display text]]` forms — only the topic
 * portion (before the pipe) is kept. Duplicates are folded.
 */
function parseBracketLinks(content: string): string[] {
  const out = new Set<string>();
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const m of matches) {
    const raw = m[1];
    if (!raw) continue;
    const topic = raw.split('|')[0]?.trim();
    if (!topic) continue;
    if (topic.length > MAX_TOPIC_LENGTH) continue;
    out.add(topic);
  }
  return Array.from(out);
}

// ---------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------

async function extractRelationshipsWithLLM(params: {
  pageTopic: string;
  pageContent: string;
  knownTopics: string[];
  recordingId: string;
}): Promise<ExtractedRelationshipCandidate[]> {
  if (params.knownTopics.length === 0) return [];

  const contentExcerpt = sanitizeVisualDescription(
    params.pageContent,
    MAX_CONTENT_CHARS_FOR_EXTRACTION
  );

  checkAndLogPII(
    contentExcerpt,
    'compile-wiki-relationship-extraction',
    params.recordingId
  );

  const topicsBlock = params.knownTopics
    .slice(0, MAX_KNOWN_TOPICS_IN_PROMPT)
    .map((t) => `- ${t}`)
    .join('\n');

  const prompt = `You are a knowledge graph assistant. Extract typed relationships from a wiki page to other known wiki pages in the same organization.

CURRENT PAGE TOPIC: "${params.pageTopic}"

CURRENT PAGE CONTENT (Markdown with YAML frontmatter):
"""
${contentExcerpt}
"""

KNOWN WIKI PAGE TOPICS IN THIS ORGANIZATION (choose target_topic values from this list only):
${topicsBlock}

TASK: Identify every meaningful relationship from the CURRENT PAGE to one of the KNOWN TOPICS above. For each relationship, emit:
- target_topic: one of the known topics (exact string match, lowercased)
- relationship_type: one of "requires" | "precedes" | "contradicts" | "related"
- confidence: a number between 0.0 and 1.0 using this rubric:
    * 0.9 - 1.0 = EXTRACTED: directly and explicitly stated in the page body (e.g. "you must do X before Y")
    * 0.5 - 0.89 = INFERRED: reasonable connection based on shared concepts / workflow context
    * 0.0 - 0.49 = AMBIGUOUS: vague mention, unclear whether a real relationship exists
- source_type: "extracted" when confidence >= 0.9, otherwise "inferred"
- evidence: one short sentence (<= 200 chars) quoting or paraphrasing the passage from the page that supports the relationship

Relationship type meanings:
- "requires": the current page REQUIRES the target page to be understood or completed first (prerequisite)
- "precedes": the current page PRECEDES the target page in a workflow sequence (the target happens after the current page)
- "contradicts": the current page CONTRADICTS something stated in the target page
- "related": the current page is topically RELATED to the target but without a directional dependency

Rules:
1. Only emit relationships to topics that appear EXACTLY in the KNOWN TOPICS list above. Do NOT invent new topic names.
2. Never emit a self-relationship (target_topic === the current page topic).
3. Never emit more than ${MAX_RELATIONSHIPS_PER_COMPILATION} relationships total.
4. Prefer higher-confidence EXTRACTED relationships over lower-confidence INFERRED ones.
5. Do not emit a relationship you cannot justify with a specific passage from the current page content.
6. Return ONLY a JSON object matching the schema below. Do not wrap it in markdown code fences. Do not include any commentary.

Schema:
{
  "relationships": [
    {
      "target_topic": "example-topic",
      "relationship_type": "requires" | "precedes" | "contradicts" | "related",
      "confidence": 0.0,
      "source_type": "extracted" | "inferred",
      "evidence": "short quote or paraphrase"
    }
  ]
}
`;

  let responseText = '';
  try {
    responseText = await callGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 4096,
    });
  } catch (error) {
    console.warn(
      `[compile-wiki] Step 4: LLM relationship extraction call failed for recording ${params.recordingId}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }

  return parseRelationshipExtractionResponse(responseText, params.recordingId);
}

function parseRelationshipExtractionResponse(
  responseText: string,
  recordingId: string
): ExtractedRelationshipCandidate[] {
  if (!responseText) return [];

  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.warn(
      `[compile-wiki] Step 4: failed to parse relationship JSON for ${recordingId}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];
  const rels = (parsed as { relationships?: unknown }).relationships;
  if (!Array.isArray(rels)) return [];

  const out: ExtractedRelationshipCandidate[] = [];
  for (const raw of rels) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;

    const targetTopic =
      typeof obj.target_topic === 'string' ? obj.target_topic.trim().toLowerCase() : '';
    if (!targetTopic || targetTopic.length > MAX_TOPIC_LENGTH) continue;

    const rawType =
      typeof obj.relationship_type === 'string'
        ? obj.relationship_type.trim().toLowerCase()
        : '';
    if (
      rawType !== 'requires' &&
      rawType !== 'precedes' &&
      rawType !== 'contradicts' &&
      rawType !== 'related'
    ) {
      continue;
    }

    const rawConfidence = Number(obj.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence))
      : 0.5;

    // Force source_type to match the confidence band regardless of what the
    // LLM claimed. This keeps the Graphify rubric authoritative.
    //
    //   confidence >= 0.9          → EXTRACTED → 'extracted'
    //   0.5 <= confidence < 0.9    → INFERRED  → 'inferred'
    //   confidence < 0.5           → AMBIGUOUS → 'inferred' (review via low confidence)
    const sourceType: WikiRelationshipSourceType =
      confidence >= CONFIDENCE_EXTRACTED_MIN ? 'extracted' : 'inferred';

    const evidence =
      typeof obj.evidence === 'string' && obj.evidence.trim().length > 0
        ? obj.evidence.trim().slice(0, 500)
        : null;

    out.push({
      target_topic: targetTopic,
      relationship_type: rawType,
      confidence,
      source_type: sourceType,
      evidence,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Backlink rendering
// ---------------------------------------------------------------------------

const BACKLINK_START_MARKER = '<!-- trib-39:relationships:start -->';
const BACKLINK_END_MARKER = '<!-- trib-39:relationships:end -->';

/**
 * Append or replace a `## Related Pages` Obsidian-backlink block at the end
 * of the page content, then write it back to `org_wiki_pages.content`.
 *
 * The block is wrapped in HTML comment markers (`trib-39:relationships:*`)
 * so re-compilations replace it in place rather than appending duplicates.
 * This is best-effort — failures surface as warn logs only.
 */
async function renderRelationshipBacklinks(params: {
  supabase: SupabaseAdminClient;
  pageId: string;
  content: string;
  relationships: ExtractedRelationshipCandidate[];
}): Promise<void> {
  const { supabase, pageId, content, relationships } = params;

  // One line per unique target topic.
  const uniqueTargets = new Map<string, ExtractedRelationshipCandidate>();
  for (const r of relationships) {
    if (!uniqueTargets.has(r.target_topic)) {
      uniqueTargets.set(r.target_topic, r);
    }
  }
  if (uniqueTargets.size === 0) return;

  const lines = Array.from(uniqueTargets.values())
    .sort((a, b) => a.target_topic.localeCompare(b.target_topic))
    .map(
      (r) =>
        `- [[${r.target_topic}]] — ${r.relationship_type} (confidence ${r.confidence.toFixed(2)})`
    );

  const block = [
    BACKLINK_START_MARKER,
    '## Related Pages',
    '',
    ...lines,
    BACKLINK_END_MARKER,
  ].join('\n');

  const blockRegex = new RegExp(
    `${escapeRegex(BACKLINK_START_MARKER)}[\\s\\S]*?${escapeRegex(BACKLINK_END_MARKER)}`,
    'g'
  );

  const updated = blockRegex.test(content)
    ? content.replace(blockRegex, block)
    : `${content.trimEnd()}\n\n${block}\n`;

  // No-op if we didn't actually change anything.
  if (updated === content) return;

  const { error } = await supabase
    .from('org_wiki_pages')
    .update({ content: updated } as never)
    .eq('id', pageId);

  if (error) {
    throw new Error(
      `Failed to write Related Pages block to page ${pageId}: ${error.message}`
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
