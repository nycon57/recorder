/**
 * Compile Wiki Job Handler — New Page Creation (TRIB-31)
 *
 * Turns a processed recording (workflow extraction + docify + transcript)
 * into a brand-new `org_wiki_pages` row for the org. This is Step 3a of
 * Component 4 "Compiled Wiki" in product-architecture-v2.md.
 *
 * Pipeline:
 *   1. Load workflow + document + transcript inputs for the recording
 *   2. LLM-classify the recording into { app, screen, topic }
 *   3. Look up any existing matching `org_wiki_pages` row
 *      - If found: log `[TRIB-32]` update-path placeholder and return
 *      - If not:   generate a Markdown + YAML frontmatter wiki page
 *   4. Insert into `org_wiki_pages` and `wiki_page_sources`
 *   5. Best-effort embedding hook (activates when TRIB-36 lands)
 *
 * Step 3b (contradiction detection / update path) is deferred to TRIB-32.
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getAgentSettings } from '@/lib/services/agent-config';
import { withAgentLogging } from '@/lib/services/agent-logger';
import {
  detectPII,
  logPIIDetection,
  sanitizeVisualDescription,
} from '@/lib/utils/security';
import type { Database, Json, WorkflowStep } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];
type OrgWikiPageInsert = Database['public']['Tables']['org_wiki_pages']['Insert'];
type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];
type WikiPageSourceInsert = Database['public']['Tables']['wiki_page_sources']['Insert'];

// Narrow row shapes for the subset of columns this handler selects. The
// generated Supabase typings sometimes infer `never` from string-literal
// select arguments, so we annotate the fetched data explicitly.
type ContentRowForCompile = Pick<
  Database['public']['Tables']['content']['Row'],
  'id' | 'title' | 'description' | 'content_type'
>;

type WorkflowRowForCompile = Pick<
  Database['public']['Tables']['workflows']['Row'],
  'id' | 'title' | 'description' | 'steps' | 'step_count' | 'confidence' | 'status'
>;

type DocumentRowForCompile = Pick<
  Database['public']['Tables']['documents']['Row'],
  'id' | 'markdown' | 'summary'
>;

type TranscriptRowForCompile = Pick<
  Database['public']['Tables']['transcripts']['Row'],
  'id' | 'text'
>;

interface CompileWikiPayload {
  recordingId: string;
  orgId: string;
}

/** Output of the LLM classification step. */
interface WikiClassification {
  app: string | null;
  screen: string | null;
  topic: string;
}

const AGENT_TYPE = 'wiki_compiler';
const MAX_TRANSCRIPT_CHARS = 12000;
const MAX_DOCUMENT_CHARS = 8000;
const MAX_WORKFLOW_STEPS_IN_PROMPT = 50;

// ---------------------------------------------------------------------------
// Gemini client (lazy init — matches workflow-extraction.ts pattern)
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
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
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

// ---------------------------------------------------------------------------
// Agent gate
// ---------------------------------------------------------------------------

/**
 * `wiki_compiler` is a new agent type introduced in TRIB-31. The
 * `org_agent_settings` column / plan-tier entry for it is scheduled to land
 * with TRIB-37. Until then, we default the agent to enabled and only honour
 * the `global_agent_enabled` kill switch so admins retain an escape hatch.
 */
async function isWikiCompilerEnabled(orgId: string): Promise<boolean> {
  try {
    const settings = await getAgentSettings(orgId);
    if (!settings.global_agent_enabled) {
      return false;
    }
    return true;
  } catch (error) {
    console.warn(
      `[compile-wiki] Failed to load agent settings for org ${orgId}, defaulting to enabled:`,
      error instanceof Error ? error.message : error
    );
    return true;
  }
}

// ---------------------------------------------------------------------------
// Handler entry point
// ---------------------------------------------------------------------------

export async function handleCompileWiki(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as CompileWikiPayload;
  const { recordingId, orgId } = payload ?? {};

  if (!recordingId || !orgId) {
    console.warn(
      '[compile-wiki] Missing recordingId or orgId in payload, skipping',
      { payload }
    );
    return;
  }

  if (!(await isWikiCompilerEnabled(orgId))) {
    console.log(
      `[compile-wiki] Agent disabled for org ${orgId}, skipping recording ${recordingId}`
    );
    return;
  }

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'compile_wiki_page',
      contentId: recordingId,
      inputSummary: `Compile wiki page from recording ${recordingId}`,
    },
    () => runCompilationPipeline(recordingId, orgId, progressCallback)
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function runCompilationPipeline(
  recordingId: string,
  orgId: string,
  progressCallback?: ProgressCallback
): Promise<void> {
  const supabase = createAdminClient();

  // ---- Step 1 — Load inputs -------------------------------------------------
  progressCallback?.(5, 'Loading recording metadata...');

  const recordingResponse = await supabase
    .from('content')
    .select('id, title, description, content_type')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  const recordingError = recordingResponse.error;
  const recording = recordingResponse.data as ContentRowForCompile | null;

  if (recordingError || !recording) {
    console.warn(
      `[compile-wiki] Recording ${recordingId} not found in org ${orgId}: ${recordingError?.message ?? 'missing'} — skipping`
    );
    return;
  }

  progressCallback?.(10, 'Fetching workflow, document, and transcript...');

  const [workflowResult, documentResult, transcriptResult] = await Promise.all([
    supabase
      .from('workflows')
      .select('id, title, description, steps, step_count, confidence, status')
      .eq('content_id', recordingId)
      .eq('org_id', orgId)
      .neq('status', 'outdated')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('id, markdown, summary')
      .eq('content_id', recordingId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transcripts')
      .select('id, text')
      .eq('content_id', recordingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (workflowResult.error) {
    throw new Error(
      `Failed to load workflow for ${recordingId}: ${workflowResult.error.message}`
    );
  }
  if (documentResult.error) {
    throw new Error(
      `Failed to load document for ${recordingId}: ${documentResult.error.message}`
    );
  }
  if (transcriptResult.error) {
    throw new Error(
      `Failed to load transcript for ${recordingId}: ${transcriptResult.error.message}`
    );
  }

  const workflow = workflowResult.data as WorkflowRowForCompile | null;
  const document = documentResult.data as DocumentRowForCompile | null;
  const transcript = transcriptResult.data as TranscriptRowForCompile | null;

  // Require *some* substantive source to compile from. If every input is
  // empty, skip rather than hallucinate a wiki page.
  const workflowSteps: WorkflowStep[] = Array.isArray(workflow?.steps)
    ? (workflow!.steps as WorkflowStep[])
    : [];
  const hasWorkflowSteps = workflowSteps.length > 0;
  const hasDocument = !!document?.markdown && document.markdown.trim().length > 0;
  const hasTranscript = !!transcript?.text && transcript.text.trim().length > 0;

  if (!hasWorkflowSteps && !hasDocument && !hasTranscript) {
    console.warn(
      `[compile-wiki] No workflow, document, or transcript available for ${recordingId}, skipping`
    );
    return;
  }

  // ---- Step 2 — LLM classify -----------------------------------------------
  progressCallback?.(25, 'Classifying recording into app/screen/topic...');

  const classification = await classifyRecording({
    recordingTitle: recording.title,
    recordingDescription: recording.description,
    workflowTitle: workflow?.title ?? null,
    workflowDescription: workflow?.description ?? null,
    workflowSteps,
    documentSummary: document?.summary ?? null,
    documentMarkdown: document?.markdown ?? null,
    transcript: transcript?.text ?? null,
    recordingId,
  });

  console.log(
    `[compile-wiki] Classified recording ${recordingId} as app=${classification.app ?? '(none)'} screen=${classification.screen ?? '(none)'} topic="${classification.topic}"`
  );

  // ---- Step 3 — Look up existing page --------------------------------------
  progressCallback?.(40, 'Checking for existing wiki page...');

  const existingPage = await findExistingWikiPage(supabase, {
    orgId,
    topic: classification.topic,
    app: classification.app,
    screen: classification.screen,
  });

  if (existingPage) {
    console.log(
      `[compile-wiki] [TRIB-32] update path — existing page ${existingPage.id} ` +
        `(org=${orgId}, app=${classification.app ?? 'null'}, ` +
        `screen=${classification.screen ?? 'null'}, topic="${classification.topic}"). ` +
        `Skipping update in TRIB-31; TRIB-32 will extend this branch.`
    );
    progressCallback?.(100, 'Existing page found — update deferred to TRIB-32');
    return;
  }

  // ---- Step 4 — Generate new wiki page body --------------------------------
  progressCallback?.(55, 'Generating new wiki page content...');

  const generatedContent = await generateWikiPageContent({
    orgId,
    classification,
    recordingTitle: recording.title,
    recordingDescription: recording.description,
    workflowTitle: workflow?.title ?? null,
    workflowDescription: workflow?.description ?? null,
    workflowSteps,
    documentSummary: document?.summary ?? null,
    documentMarkdown: document?.markdown ?? null,
    transcript: transcript?.text ?? null,
    recordingId,
  });

  if (!generatedContent || generatedContent.trim().length === 0) {
    console.warn(
      `[compile-wiki] Gemini returned empty content for ${recordingId}, skipping insert`
    );
    return;
  }

  progressCallback?.(85, 'Storing compiled wiki page...');

  // ---- Step 5 — Insert wiki page -------------------------------------------
  const confidence = clampConfidence(workflow?.confidence ?? 0.5);
  const nowIso = new Date().toISOString();

  const compilationLogEntry = {
    action: 'created' as const,
    source_recording_id: recordingId,
    detected_at: nowIso,
    classification,
    confidence,
  };

  const pageInsert: OrgWikiPageInsert = {
    org_id: orgId,
    app: classification.app,
    screen: classification.screen,
    topic: classification.topic,
    content: generatedContent,
    confidence,
    compilation_log: [compilationLogEntry] as unknown as Json,
  };

  const insertResponse = await supabase
    .from('org_wiki_pages')
    .insert(pageInsert as never)
    .select('id')
    .single();

  const insertError = insertResponse.error;
  const newPage = insertResponse.data as { id: string } | null;

  if (insertError || !newPage) {
    throw new Error(
      `Failed to insert org_wiki_pages row: ${insertError?.message ?? 'unknown error'}`
    );
  }

  // ---- Step 6 — Insert source reference ------------------------------------
  progressCallback?.(92, 'Linking source recording...');

  const titleForSummary = recording.title?.trim()
    ? recording.title.trim()
    : recordingId.slice(0, 8);

  const sourceInsert: WikiPageSourceInsert = {
    page_id: newPage.id,
    source_type: 'recording',
    source_id: recordingId,
    contribution_summary: `Initial wiki page creation from recording ${titleForSummary}`,
  };

  const { error: sourceError } = await supabase
    .from('wiki_page_sources')
    .insert(sourceInsert as never);

  if (sourceError) {
    // Best-effort cleanup: log the issue but don't rip out the page we just
    // created — the next run of the wiki linter can backfill the source row.
    console.error(
      `[compile-wiki] Failed to insert wiki_page_sources row for page ${newPage.id}: ${sourceError.message}`
    );
  }

  // ---- Step 7 — Best-effort embedding generation (TRIB-36) -----------------
  progressCallback?.(97, 'Generating embedding (best-effort)...');

  try {
    await runBestEffortEmbedding(newPage.id);
  } catch (embeddingError) {
    console.warn(
      `[compile-wiki] Embedding generation skipped for page ${newPage.id}:`,
      embeddingError instanceof Error ? embeddingError.message : embeddingError
    );
  }

  progressCallback?.(100, 'Wiki page compiled successfully');

  console.log(
    `[compile-wiki] Created org_wiki_pages row ${newPage.id} for recording ${recordingId} ` +
      `(org=${orgId}, topic="${classification.topic}", confidence=${confidence.toFixed(2)})`
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Classification
// ---------------------------------------------------------------------------

async function classifyRecording(params: {
  recordingTitle: string | null;
  recordingDescription: string | null;
  workflowTitle: string | null;
  workflowDescription: string | null;
  workflowSteps: WorkflowStep[];
  documentSummary: string | null;
  documentMarkdown: string | null;
  transcript: string | null;
  recordingId: string;
}): Promise<WikiClassification> {
  const stepsPreview = params.workflowSteps
    .slice(0, 20)
    .map((s, i) => `${i + 1}. ${sanitizeVisualDescription(s.title ?? '', 200)}`)
    .join('\n');

  const transcriptExcerpt = sanitizeVisualDescription(
    params.transcript ?? '',
    4000
  );
  const documentExcerpt = sanitizeVisualDescription(
    params.documentSummary ?? params.documentMarkdown ?? '',
    2000
  );
  const titleInput = sanitizeVisualDescription(
    params.recordingTitle ?? params.workflowTitle ?? '',
    300
  );
  const descriptionInput = sanitizeVisualDescription(
    params.recordingDescription ?? params.workflowDescription ?? '',
    500
  );

  checkAndLogPII(
    [titleInput, descriptionInput, stepsPreview, transcriptExcerpt, documentExcerpt].join(' '),
    'compile-wiki-classification',
    params.recordingId
  );

  const prompt = `You are a knowledge compiler assistant. Your task is to classify a screen recording into three labels that will be used as keys in an organization's wiki.

RECORDING TITLE: ${titleInput || '(none)'}
RECORDING DESCRIPTION: ${descriptionInput || '(none)'}

WORKFLOW STEPS (truncated):
${stepsPreview || '(no steps extracted)'}

DOCUMENT SUMMARY (truncated):
${documentExcerpt || '(none)'}

TRANSCRIPT (truncated):
${transcriptExcerpt || '(none)'}

Respond with ONLY a JSON object of the form:
{
  "app": "lowercased single-word application name, e.g. \\"salesforce\\", \\"hubspot\\", \\"notion\\". Use null if no single app is clearly the subject.",
  "screen": "lowercased, hyphenated screen identifier, e.g. \\"lead-detail\\", \\"opportunity-list\\". Use null if no single screen is the focus.",
  "topic": "lowercased, hyphenated slug describing what the workflow accomplishes, e.g. \\"lead-disposition-web-inbound\\". This is required."
}

Rules:
- topic is required and must be a short hyphenated slug (1-5 hyphenated words).
- app and screen may be null when the recording is not about a specific software screen.
- Do not wrap the JSON in markdown fences or commentary.`;

  let responseText = '';
  try {
    responseText = await callGemini(prompt, {
      temperature: 0.2,
      maxOutputTokens: 1024,
    });
  } catch (error) {
    console.error(
      `[compile-wiki] Classification call failed for ${params.recordingId}:`,
      error
    );
  }

  return parseClassification(responseText, params);
}

function parseClassification(
  responseText: string,
  params: {
    recordingTitle: string | null;
    workflowTitle: string | null;
    recordingId: string;
  }
): WikiClassification {
  const fallback = fallbackClassification(params);

  if (!responseText) {
    return fallback;
  }

  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const topic = normalizeSlug(parsed.topic);
    if (!topic) return fallback;

    return {
      app: normalizeLowercase(parsed.app),
      screen: normalizeSlug(parsed.screen),
      topic,
    };
  } catch (error) {
    console.error(
      `[compile-wiki] Failed to parse classification JSON for ${params.recordingId}:`,
      error
    );
    return fallback;
  }
}

/** Deterministic fallback when Gemini classification fails or is malformed. */
function fallbackClassification(params: {
  recordingTitle: string | null;
  workflowTitle: string | null;
  recordingId: string;
}): WikiClassification {
  const source =
    params.recordingTitle?.trim() ||
    params.workflowTitle?.trim() ||
    `recording-${params.recordingId.slice(0, 8)}`;

  return {
    app: null,
    screen: null,
    topic: normalizeSlug(source) || `recording-${params.recordingId.slice(0, 8)}`,
  };
}

function normalizeLowercase(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'null' || trimmed === 'none') return null;
  return trimmed.slice(0, 120);
}

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || slug === 'null' || slug === 'none') return null;
  return slug.slice(0, 120);
}

// ---------------------------------------------------------------------------
// Step 3 — Existing page lookup
// ---------------------------------------------------------------------------

async function findExistingWikiPage(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    orgId: string;
    topic: string;
    app: string | null;
    screen: string | null;
  }
): Promise<OrgWikiPageRow | null> {
  let query = supabase
    .from('org_wiki_pages')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('topic', params.topic)
    .is('valid_until', null);

  // supabase-js does not expose `IS NOT DISTINCT FROM`, so match on
  // nullability explicitly to treat null-null as equal.
  query = params.app === null ? query.is('app', null) : query.eq('app', params.app);
  query = params.screen === null
    ? query.is('screen', null)
    : query.eq('screen', params.screen);

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Failed to query existing wiki pages: ${error.message}`);
  }

  return (data as OrgWikiPageRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Step 4 — Wiki page generation (Component 4 Step 3a)
// ---------------------------------------------------------------------------

async function generateWikiPageContent(params: {
  orgId: string;
  classification: WikiClassification;
  recordingTitle: string | null;
  recordingDescription: string | null;
  workflowTitle: string | null;
  workflowDescription: string | null;
  workflowSteps: WorkflowStep[];
  documentSummary: string | null;
  documentMarkdown: string | null;
  transcript: string | null;
  recordingId: string;
}): Promise<string> {
  const validFrom = new Date().toISOString().slice(0, 10);

  const titleInput = sanitizeVisualDescription(
    params.recordingTitle ?? params.workflowTitle ?? 'Untitled recording',
    300
  );

  const workflowStepsBlock = params.workflowSteps
    .slice(0, MAX_WORKFLOW_STEPS_IN_PROMPT)
    .map((step, i) => {
      const title = sanitizeVisualDescription(step.title ?? '', 200);
      const description = sanitizeVisualDescription(step.description ?? '', 400);
      const action = sanitizeVisualDescription(step.action ?? '', 50);
      const uiEls = (step.uiElements ?? [])
        .slice(0, 10)
        .map((el) => sanitizeVisualDescription(String(el), 100))
        .join(', ');
      const line = `${i + 1}. ${title}${action ? ` (${action})` : ''}`;
      const details = [description, uiEls ? `UI: ${uiEls}` : ''].filter(Boolean).join(' | ');
      return details ? `${line}\n   ${details}` : line;
    })
    .join('\n');

  const documentExcerpt = sanitizeVisualDescription(
    params.documentMarkdown ?? params.documentSummary ?? '',
    MAX_DOCUMENT_CHARS
  );

  const transcriptExcerpt = sanitizeVisualDescription(
    params.transcript ?? '',
    MAX_TRANSCRIPT_CHARS
  );

  const combinedInput = [
    titleInput,
    workflowStepsBlock,
    documentExcerpt,
    transcriptExcerpt,
  ].join(' ');
  checkAndLogPII(combinedInput, 'compile-wiki-generation', params.recordingId);

  // This prompt follows product-architecture-v2.md Part 3 Component 4 Step 3a
  // (new page creation). Step 3b (contradiction detection on existing pages)
  // is the subject of TRIB-32 and is intentionally NOT handled here.
  const prompt = `You are a knowledge compiler. Your job is to turn a single screen recording into a clean, self-contained wiki page describing how this organization actually does a specific workflow. This is the FIRST wiki page for this topic — there is no existing page to merge with.

Produce exactly one Markdown document with a YAML frontmatter header, and nothing else. Do NOT wrap the output in code fences. Do NOT include any commentary before or after the document.

The frontmatter MUST use these exact keys (and only these keys):
---
layer: org
org_id: "${params.orgId}"
app: ${params.classification.app ? `"${params.classification.app}"` : 'null'}
screen: ${params.classification.screen ? `"${params.classification.screen}"` : 'null'}
topic: "${params.classification.topic}"
confidence: <number between 0 and 1>
sources:
  - type: recording
    id: "${params.recordingId}"
    title: "${escapeYamlString(titleInput)}"
    recorded_at: ${validFrom}
---

After the frontmatter, write a Markdown body with these sections (skip a section entirely if there is not enough information for it):
# <Human-readable title for the topic>
## When This Applies
## Workflow Steps
(numbered list — use the workflow steps below as the primary source; tighten them into concise imperative instructions)
## Common Mistakes
(only if clearly evidenced in the source material)
## Related Workflows
(only if clearly referenced; otherwise omit)

Rules:
1. Only use information that is grounded in the source material below. Do not invent URLs, field names, keyboard shortcuts, or people.
2. Write the body in plain prose + Markdown lists. No HTML.
3. Prefer the workflow steps when the transcript and document disagree — the steps were extracted from actual UI transitions.
4. Keep the body focused on *how this org does it* rather than generic app documentation.
5. The confidence number in the frontmatter should reflect how clearly the source material describes this workflow (0.3 = vague, 0.6 = clear, 0.9 = step-by-step).

## Source Material

### Recording Title
${titleInput}

### Workflow Steps (extracted from UI state transitions)
${workflowStepsBlock || '(no structured steps available)'}

### Generated Document Excerpt
${documentExcerpt || '(no document available)'}

### Narration Transcript
${transcriptExcerpt || '(no transcript available)'}
`;

  try {
    const response = await callGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 8192,
    });
    return stripCodeFences(response);
  } catch (error) {
    console.error(
      `[compile-wiki] Wiki page generation failed for ${params.recordingId}:`,
      error
    );
    throw error;
  }
}

/** Strip leading/trailing ``` fences if Gemini ignored the no-fences rule. */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:markdown|md|yaml)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

/** Minimal YAML string escaping for values we interpolate into frontmatter. */
function escapeYamlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function clampConfidence(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Best-effort embedding hook (TRIB-36 integration seam)
// ---------------------------------------------------------------------------

/**
 * Placeholder for the embedding-generation hand-off. TRIB-36 will add
 * `src/lib/services/org-wiki-embedding.ts` with a
 * `generateOrgWikiPageEmbedding(pageId: string)` helper. When that PR lands,
 * replace the no-op body below with:
 *
 *     import { generateOrgWikiPageEmbedding } from '@/lib/services/org-wiki-embedding';
 *     // ...
 *     try {
 *       await generateOrgWikiPageEmbedding(pageId);
 *     } catch (error) {
 *       console.warn('[compile-wiki] Embedding generation failed:', error);
 *     }
 *
 * Keeping the import static avoids bundler warnings from both Turbopack and
 * webpack during the TRIB-31 window. Until TRIB-36 lands, this function is a
 * no-op and the compiled wiki page simply has no embedding row yet — TRIB-36
 * can backfill existing rows as part of its migration.
 */
async function runBestEffortEmbedding(pageId: string): Promise<void> {
  console.log(
    `[compile-wiki] org-wiki-embedding hook pending TRIB-36; no embedding generated for page ${pageId}`
  );
}
