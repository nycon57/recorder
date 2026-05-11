/**
 * Compile Wiki Job Handler — New Page + Update/Contradiction Detection
 *
 * Turns a processed recording (workflow extraction + docify + transcript)
 * into an `org_wiki_pages` row for the org. Implements Steps 3a (new page)
 * and 3b (update existing page) of Component 4 "Compiled Wiki" in
 * product-architecture-v2.md.
 *
 * Pipeline:
 *   1. Load workflow + document + transcript inputs for the recording
 *   2. LLM-classify the recording into { app, screen, topic }
 *   3. Look up any existing matching `org_wiki_pages` row
 *      - If found: Step 3b update path — LLM-diff existing page against new
 *        recording and classify the delta as ADDITIVE, REDUNDANT, or
 *        CONTRADICTION (TRIB-32)
 *      - If not:   Step 3a — generate a Markdown + YAML frontmatter wiki page
 *   4. Insert/update into `org_wiki_pages` and `wiki_page_sources`
 *   5. Best-effort embedding hook (activates when TRIB-36 lands)
 *
 * Step 3b classification outcomes:
 *   - REDUNDANT: no content change, confidence nudged up, source appended
 *   - ADDITIVE: content replaced with LLM-merged body, confidence bumped,
 *     source appended
 *   - CONTRADICTION: if `wiki_auto_publish` is false, the existing page's
 *     content is left untouched and a `flagged` entry is written to
 *     compilation_log for TRIB-34's admin review UI. If
 *     `wiki_auto_publish` is true, the old row is superseded (valid_until
 *     set to now()) and a new row is inserted with supersedes_id pointing
 *     at the old row.
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import {
  getAgentSettings,
  getWikiCompilationSettings,
  shouldAutoApplyWikiContradiction,
} from '@/lib/services/agent-config';
import { withAgentLogging } from '@/lib/services/agent-logger';
import { requestApproval } from '@/lib/services/agent-permissions';
import { generateOrgWikiPageEmbeddingBestEffort } from '@/lib/services/org-wiki-embedding';
import {
  ROUTING_REVIEW_AGENT_TYPE,
  ROUTING_REVIEW_ACTION_TYPE,
  buildRoutingReviewDescription,
  buildRoutingReviewProposedAction,
  getApprovedRoutingOverride,
  requiresRoutingReview,
  writeRoutingReviewState,
} from '@/lib/services/routing-review';
import {
  detectPII,
  logPIIDetection,
  sanitizeVisualDescription,
} from '@/lib/utils/security';
import type { Database, Json, WorkflowStep } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

import { runRelationshipExtraction } from './compile-wiki-relationships';
import { runCrossPageContradictionDetection } from './compile-wiki-cross-page';

type Job = Database['public']['Tables']['jobs']['Row'];
type OrgWikiPageInsert =
  Database['public']['Tables']['org_wiki_pages']['Insert'];
type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];
type WikiPageSourceInsert =
  Database['public']['Tables']['wiki_page_sources']['Insert'];

type SupersedeOrgWikiPageRpc = {
  rpc(
    fn: 'supersede_org_wiki_page',
    args: {
      p_existing_page_id: string;
      p_org_id: string;
      p_app: string | null;
      p_screen: string | null;
      p_topic: string;
      p_content: string;
      p_confidence: number;
      p_supersedes_id: string;
      p_compilation_log: Json;
      p_valid_until: string;
    },
  ): Promise<{ data: string | null; error: { message: string } | null }>;
};

// Narrow row shapes for the subset of columns this handler selects. The
// generated Supabase typings sometimes infer `never` from string-literal
// select arguments, so we annotate the fetched data explicitly.
type ContentRowForCompile = Pick<
  Database['public']['Tables']['content']['Row'],
  'id' | 'title' | 'description' | 'content_type' | 'metadata'
>;

type WorkflowRowForCompile = Pick<
  Database['public']['Tables']['workflows']['Row'],
  | 'id'
  | 'title'
  | 'description'
  | 'steps'
  | 'step_count'
  | 'confidence'
  | 'status'
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
  recordingId?: string;
  contentId?: string;
  orgId: string;
  sourceType?: string | null;
}

type WikiPageSourceType = 'recording' | 'video' | 'audio' | 'document' | 'text';

/** Output of the LLM classification step. */
interface WikiClassification {
  app: string | null;
  screen: string | null;
  topic: string;
  routeConfidence: number | null;
  routeReason: string | null;
}

const AGENT_TYPE = 'wiki_compiler';
const MAX_TRANSCRIPT_CHARS = 12000;
const MAX_DOCUMENT_CHARS = 8000;
const MAX_WORKFLOW_STEPS_IN_PROMPT = 50;
const WIKI_PAGE_SOURCE_TYPES = new Set<WikiPageSourceType>([
  'recording',
  'video',
  'audio',
  'document',
  'text',
]);

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
  opts: { temperature?: number; maxOutputTokens?: number } = {},
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

function checkAndLogPII(
  text: string,
  source: string,
  recordingId?: string,
): void {
  const piiCheck = detectPII(text);
  if (piiCheck.hasPII) {
    logPIIDetection(source, piiCheck.types, recordingId);
  }
}

function normalizeWikiPageSourceType(
  value: string | null | undefined,
): WikiPageSourceType {
  return WIKI_PAGE_SOURCE_TYPES.has(value as WikiPageSourceType)
    ? (value as WikiPageSourceType)
    : 'recording';
}

function wikiSourceLabel(sourceType: WikiPageSourceType): string {
  if (sourceType === 'text') return 'text note';
  return sourceType;
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
      error instanceof Error ? error.message : error,
    );
    return true;
  }
}

// ---------------------------------------------------------------------------
// Handler entry point
// ---------------------------------------------------------------------------

export async function handleCompileWiki(
  job: Job,
  progressCallback?: ProgressCallback,
): Promise<void> {
  const payload = job.payload as unknown as CompileWikiPayload;
  const { orgId } = payload ?? {};
  const contentId = payload?.contentId ?? payload?.recordingId;
  const payloadSourceType = payload?.sourceType ?? null;

  if (!contentId || !orgId) {
    console.warn(
      '[compile-wiki] Missing contentId or orgId in payload, skipping',
      { payload },
    );
    return;
  }

  if (!(await isWikiCompilerEnabled(orgId))) {
    console.log(
      `[compile-wiki] Agent disabled for org ${orgId}, skipping content ${contentId}`,
    );
    return;
  }

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'compile_wiki_page',
      contentId,
      inputSummary: `Compile wiki page from content ${contentId}`,
    },
    () =>
      runCompilationPipeline(
        contentId,
        orgId,
        payloadSourceType,
        progressCallback,
      ),
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function runCompilationPipeline(
  recordingId: string,
  orgId: string,
  payloadSourceType?: string | null,
  progressCallback?: ProgressCallback,
): Promise<void> {
  const supabase = createAdminClient();

  // ---- Step 1 — Load inputs -------------------------------------------------
  progressCallback?.(5, 'Loading recording metadata...');

  const recordingResponse = await supabase
    .from('content')
    .select('id, title, description, content_type, metadata')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  const recordingError = recordingResponse.error;
  const recording = recordingResponse.data as ContentRowForCompile | null;

  if (recordingError || !recording) {
    console.warn(
      `[compile-wiki] Recording ${recordingId} not found in org ${orgId}: ${recordingError?.message ?? 'missing'} — skipping`,
    );
    return;
  }

  const sourceType = normalizeWikiPageSourceType(
    recording.content_type ?? payloadSourceType,
  );
  const sourceLabel = wikiSourceLabel(sourceType);

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
      `Failed to load workflow for ${recordingId}: ${workflowResult.error.message}`,
    );
  }
  if (documentResult.error) {
    throw new Error(
      `Failed to load document for ${recordingId}: ${documentResult.error.message}`,
    );
  }
  if (transcriptResult.error) {
    throw new Error(
      `Failed to load transcript for ${recordingId}: ${transcriptResult.error.message}`,
    );
  }

  const workflow = workflowResult.data as WorkflowRowForCompile | null;
  const document = documentResult.data as DocumentRowForCompile | null;
  const transcript = transcriptResult.data as TranscriptRowForCompile | null;

  // Require *some* substantive source to compile from. If every input is
  // empty, skip rather than hallucinate a wiki page.
  const workflowSteps: WorkflowStep[] = Array.isArray(workflow?.steps)
    ? (workflow!.steps as unknown as WorkflowStep[])
    : [];
  const hasWorkflowSteps = workflowSteps.length > 0;
  const hasDocument =
    !!document?.markdown && document.markdown.trim().length > 0;
  const hasTranscript = !!transcript?.text && transcript.text.trim().length > 0;

  if (!hasWorkflowSteps && !hasDocument && !hasTranscript) {
    console.warn(
      `[compile-wiki] No workflow, document, or transcript available for ${recordingId}, skipping`,
    );
    return;
  }

  const approvedRoutingOverride = getApprovedRoutingOverride(
    recording.metadata,
  );
  let classification: WikiClassification;

  if (approvedRoutingOverride) {
    progressCallback?.(25, 'Applying approved routing...');
    classification = {
      app: approvedRoutingOverride.app,
      screen: approvedRoutingOverride.screen,
      topic: approvedRoutingOverride.topic,
      routeConfidence: 1,
      routeReason: 'Approved by a reviewer in Needs Routing.',
    };
  } else {
    // ---- Step 2 — LLM classify ---------------------------------------------
    progressCallback?.(25, 'Classifying recording into app/screen/topic...');

    classification = await classifyRecording({
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
  }

  console.log(
    `[compile-wiki] Classified recording ${recordingId} as app=${classification.app ?? '(none)'} screen=${classification.screen ?? '(none)'} topic="${classification.topic}" confidence=${classification.routeConfidence ?? 'n/a'}`,
  );

  if (!approvedRoutingOverride && requiresRoutingReview(classification)) {
    await queueRoutingReview({
      supabase,
      orgId,
      recording,
      recordingId,
      classification,
    });
    progressCallback?.(100, 'Queued for routing review');
    return;
  }

  // ---- Step 3 — Look up existing page --------------------------------------
  progressCallback?.(40, 'Checking for existing wiki page...');

  const existingPage = await findExistingWikiPage(supabase, {
    orgId,
    topic: classification.topic,
    app: classification.app,
    screen: classification.screen,
  });

  if (existingPage) {
    await runUpdatePath({
      supabase,
      existingPage,
      orgId,
      recordingId,
      recordingTitle: recording.title,
      sourceType,
      sourceLabel,
      workflow,
      workflowSteps,
      document,
      transcript,
      classification,
      progressCallback,
    });
    return;
  }

  // ---- Step 4 — Generate new wiki page body --------------------------------
  progressCallback?.(55, 'Generating new wiki page content...');

  const generatedContent = await generateWikiPageContent({
    orgId,
    classification,
    recordingTitle: recording.title,
    recordingDescription: recording.description,
    sourceType,
    sourceLabel,
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
      `[compile-wiki] Gemini returned empty content for ${recordingId}, skipping insert`,
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
    source_content_id: recordingId,
    source_type: sourceType,
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
      `Failed to insert org_wiki_pages row: ${insertError?.message ?? 'unknown error'}`,
    );
  }

  // ---- Step 6 — Insert source reference ------------------------------------
  progressCallback?.(92, `Linking source ${sourceLabel}...`);

  const titleForSummary = recording.title?.trim()
    ? recording.title.trim()
    : recordingId.slice(0, 8);

  const sourceInsert: WikiPageSourceInsert = {
    page_id: newPage.id,
    source_type: sourceType,
    source_id: recordingId,
    contribution_summary: `Initial wiki page creation from ${sourceLabel} ${titleForSummary}`,
  };

  const { error: sourceError } = await supabase
    .from('wiki_page_sources')
    .insert(sourceInsert as never);

  if (sourceError) {
    // Best-effort cleanup: log the issue but don't rip out the page we just
    // created — the next run of the wiki linter can backfill the source row.
    console.error(
      `[compile-wiki] Failed to insert wiki_page_sources row for page ${newPage.id}: ${sourceError.message}`,
    );
  }

  // ---- Step 7 — Relationship extraction (TRIB-39) --------------------------
  progressCallback?.(97, 'Extracting wiki relationships (best-effort)...');

  await runRelationshipExtraction({
    supabase,
    orgId,
    pageId: newPage.id,
    topic: classification.topic,
    content: generatedContent,
    recordingId,
  });

  // ---- Step 8 — Cross-page contradiction detection (TRIB-41) ---------------
  progressCallback?.(
    99,
    'Detecting cross-page contradictions (best-effort)...',
  );

  await runCrossPageContradictionDetection({
    supabase,
    orgId,
    pageId: newPage.id,
    app: classification.app,
    screen: classification.screen,
    topic: classification.topic,
    content: generatedContent,
    recordingId,
  });

  // ---- Step 9 — Best-effort embedding generation (TRIB-36) -----------------
  progressCallback?.(99, 'Generating final embedding (best-effort)...');
  await runBestEffortEmbedding(newPage.id, {
    source: 'compile-wiki.new-page',
    orgId,
    recordingId,
  });

  progressCallback?.(100, 'Wiki page compiled successfully');

  console.log(
    `[compile-wiki] Created org_wiki_pages row ${newPage.id} for recording ${recordingId} ` +
      `(org=${orgId}, topic="${classification.topic}", confidence=${confidence.toFixed(2)})`,
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
    4000,
  );
  const documentExcerpt = sanitizeVisualDescription(
    params.documentSummary ?? params.documentMarkdown ?? '',
    2000,
  );
  const titleInput = sanitizeVisualDescription(
    params.recordingTitle ?? params.workflowTitle ?? '',
    300,
  );
  const descriptionInput = sanitizeVisualDescription(
    params.recordingDescription ?? params.workflowDescription ?? '',
    500,
  );

  checkAndLogPII(
    [
      titleInput,
      descriptionInput,
      stepsPreview,
      transcriptExcerpt,
      documentExcerpt,
    ].join(' '),
    'compile-wiki-classification',
    params.recordingId,
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
  "topic": "lowercased, hyphenated slug describing what the workflow accomplishes, e.g. \\"lead-disposition-web-inbound\\". This is required.",
  "route_confidence": 0.0,
  "route_reason": "short explanation of why this route is or is not a stable match"
}

Rules:
- topic is required and must be a short hyphenated slug (1-5 hyphenated words).
- app and screen may be null when the recording is not about a specific software screen.
- route_confidence must be a number between 0 and 1 that reflects confidence in the full topic/app/screen assignment.
- Use a lower route_confidence when app or screen are missing, when multiple screens seem plausible, or when the title/transcript are too vague to trust.
- route_reason should be a short single sentence that a human reviewer can use to understand why the route needs review.
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
      error,
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
  },
): WikiClassification {
  const fallback = fallbackClassification(params);

  if (!responseText) {
    return fallback;
  }

  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
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
      routeConfidence: clampConfidence(
        typeof parsed.route_confidence === 'number'
          ? parsed.route_confidence
          : null,
      ),
      routeReason:
        typeof parsed.route_reason === 'string'
          ? parsed.route_reason.trim().slice(0, 280)
          : null,
    };
  } catch (error) {
    console.error(
      `[compile-wiki] Failed to parse classification JSON for ${params.recordingId}:`,
      error,
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
    topic:
      normalizeSlug(source) || `recording-${params.recordingId.slice(0, 8)}`,
    routeConfidence: 0.2,
    routeReason:
      'Fallback route inferred from the recording title because classification was incomplete.',
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

async function queueRoutingReview(args: {
  supabase: ReturnType<typeof createAdminClient>;
  orgId: string;
  recording: ContentRowForCompile;
  recordingId: string;
  classification: WikiClassification;
}): Promise<void> {
  const { supabase, orgId, recording, recordingId, classification } = args;
  const proposedRoute = {
    topic: classification.topic,
    app: classification.app,
    screen: classification.screen,
  };

  const description = buildRoutingReviewDescription({
    contentTitle: recording.title,
    proposedRoute,
    routeConfidence: classification.routeConfidence,
  });

  const proposedAction = buildRoutingReviewProposedAction({
    contentId: recordingId,
    contentTitle: recording.title,
    proposedRoute,
    routeConfidence: classification.routeConfidence,
    routeReason: classification.routeReason,
  });

  const approvalId = await requestApproval({
    orgId,
    agentType: ROUTING_REVIEW_AGENT_TYPE,
    actionType: ROUTING_REVIEW_ACTION_TYPE,
    contentId: recordingId,
    description,
    proposedAction: proposedAction as unknown as Json,
  });

  const nowIso = new Date().toISOString();
  await supabase
    .from('agent_approval_queue')
    .update({
      description,
      proposed_action: proposedAction as unknown as Json,
    } as never)
    .eq('id', approvalId)
    .eq('status', 'pending');

  const nextMetadata = writeRoutingReviewState(recording.metadata, {
    status: 'pending',
    approvalId,
    requestedAt: nowIso,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    routeConfidence: classification.routeConfidence,
    routeReason: classification.routeReason,
    proposedRoute,
    approvedRoute: null,
    decisionVersion: 0,
    lastAction: null,
    history: [],
  });

  const { error: updateError } = await supabase
    .from('content')
    .update({
      metadata: nextMetadata,
      updated_at: nowIso,
    } as never)
    .eq('id', recordingId)
    .eq('org_id', orgId);

  if (updateError) {
    throw new Error(
      `Failed to persist routing review metadata for ${recordingId}: ${updateError.message}`,
    );
  }

  console.log(
    `[compile-wiki] Queued routing review for recording ${recordingId} ` +
      `(approval=${approvalId}, topic="${classification.topic}", app=${classification.app ?? 'null'}, screen=${classification.screen ?? 'null'})`,
  );
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
  },
): Promise<OrgWikiPageRow | null> {
  let query = supabase
    .from('org_wiki_pages')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('topic', params.topic)
    .is('valid_until', null);

  // supabase-js does not expose `IS NOT DISTINCT FROM`, so match on
  // nullability explicitly to treat null-null as equal.
  query =
    params.app === null ? query.is('app', null) : query.eq('app', params.app);
  query =
    params.screen === null
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
  sourceType: WikiPageSourceType;
  sourceLabel: string;
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
    300,
  );

  const workflowStepsBlock = params.workflowSteps
    .slice(0, MAX_WORKFLOW_STEPS_IN_PROMPT)
    .map((step, i) => {
      const title = sanitizeVisualDescription(step.title ?? '', 200);
      const description = sanitizeVisualDescription(
        step.description ?? '',
        400,
      );
      const action = sanitizeVisualDescription(step.action ?? '', 50);
      const uiEls = (step.uiElements ?? [])
        .slice(0, 10)
        .map((el) => sanitizeVisualDescription(String(el), 100))
        .join(', ');
      const line = `${i + 1}. ${title}${action ? ` (${action})` : ''}`;
      const details = [description, uiEls ? `UI: ${uiEls}` : '']
        .filter(Boolean)
        .join(' | ');
      return details ? `${line}\n   ${details}` : line;
    })
    .join('\n');

  const documentExcerpt = sanitizeVisualDescription(
    params.documentMarkdown ?? params.documentSummary ?? '',
    MAX_DOCUMENT_CHARS,
  );

  const transcriptExcerpt = sanitizeVisualDescription(
    params.transcript ?? '',
    MAX_TRANSCRIPT_CHARS,
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
  const prompt = `You are a knowledge compiler. Your job is to turn a single first-party ${params.sourceLabel} into a clean, self-contained wiki page describing how this organization actually does a specific workflow or process. This is the FIRST wiki page for this topic — there is no existing page to merge with.

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
  - type: ${params.sourceType}
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
      error,
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
// Step 3b — Update existing page (TRIB-32)
// ---------------------------------------------------------------------------

/** Small confidence nudge applied when a recording corroborates an existing page. */
const REDUNDANT_CONFIDENCE_DELTA = 0.05;

type ContradictionEntry = {
  old: string;
  new: string;
  field?: string;
};

type CompilationLogAction =
  | 'created'
  | 'additive'
  | 'redundant'
  | 'flagged'
  | 'applied'
  | 'rejected';

interface CompilationLogEntry {
  action: CompilationLogAction;
  source_recording_id: string;
  source_content_id?: string;
  source_type?: WikiPageSourceType;
  detected_at: string;
  classification?: WikiClassification;
  confidence?: number;
  confidence_delta?: number;
  additions?: string[];
  contradictions?: ContradictionEntry[];
  /**
   * TRIB-41 audit-trail additions. Populated on every `flagged` and `applied`
   * entry so the admin review UI can show a full before/after diff and apply
   * the LLM's `merged_content` verbatim instead of falling back to literal
   * substring replacement.
   */
  old_content?: string | null;
  new_content?: string | null;
  merged_content?: string | null;
  diff_summary?: string | null;
  applied_at?: string | null;
  applied_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

/**
 * Structured output of the Step 3b LLM diff call. `action` is the primary
 * classification; the other fields are only required for certain actions
 * and we validate them defensively at parse time.
 */
interface WikiDiffResult {
  action: 'additive' | 'redundant' | 'contradiction';
  additions: string[];
  contradictions: ContradictionEntry[];
  merged_content: string | null;
  confidence_delta: number;
}

interface UpdatePathInputs {
  supabase: ReturnType<typeof createAdminClient>;
  existingPage: OrgWikiPageRow;
  orgId: string;
  recordingId: string;
  recordingTitle: string | null;
  sourceType: WikiPageSourceType;
  sourceLabel: string;
  workflow: WorkflowRowForCompile | null;
  workflowSteps: WorkflowStep[];
  document: DocumentRowForCompile | null;
  transcript: TranscriptRowForCompile | null;
  classification: WikiClassification;
  progressCallback?: ProgressCallback;
}

async function runUpdatePath(inputs: UpdatePathInputs): Promise<void> {
  const {
    supabase,
    existingPage,
    orgId,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    workflow,
    workflowSteps,
    document,
    transcript,
    classification,
    progressCallback,
  } = inputs;

  console.log(
    `[compile-wiki] Update path — existing page ${existingPage.id} ` +
      `(org=${orgId}, app=${classification.app ?? 'null'}, ` +
      `screen=${classification.screen ?? 'null'}, topic="${classification.topic}")`,
  );

  // ---- 30% — Load existing page already done above (passed in) -------------
  progressCallback?.(30, 'Loaded existing wiki page for diff...');

  // ---- 50% — LLM diff call -------------------------------------------------
  progressCallback?.(50, 'Running LLM diff against existing page...');

  const diffResponseText = await callUpdateDiffLLM({
    existingPage,
    recordingTitle,
    sourceLabel,
    workflow,
    workflowSteps,
    document,
    transcript,
    recordingId,
  });

  // ---- 70% — Parse + classify ---------------------------------------------
  progressCallback?.(70, 'Classifying new facts against existing content...');

  const diff = parseUpdateDiff(diffResponseText, recordingId);

  if (!diff) {
    // Defensive no-op: we still want to record that this recording referenced
    // the page (so the wiki_page_sources table stays truthful) but we do not
    // mutate content or confidence when the LLM output is unparseable.
    console.warn(
      `[compile-wiki] LLM diff unparseable for recording ${recordingId}, ` +
        `appending source-only and returning`,
    );
    await insertWikiPageSource(supabase, {
      pageId: existingPage.id,
      recordingId,
      recordingTitle,
      sourceType,
      sourceLabel,
      summary:
        'Source recorded (LLM diff unparseable — no content changes applied)',
    });
    progressCallback?.(100, 'Update path completed (no content changes)');
    return;
  }

  const nowIso = new Date().toISOString();

  // ---- 85% — Write branch --------------------------------------------------
  progressCallback?.(85, `Applying ${diff.action} classification...`);

  // Each write branch returns the (pageId, content) that should be used as
  // input for Step 4 (relationship extraction). Flagged contradictions return
  // null to indicate "don't re-extract relationships" — the page content was
  // not mutated, so the existing edges are still valid.
  let relationshipTarget: {
    pageId: string;
    content: string;
    contentChanged: boolean;
    embeddingContext: string;
  } | null = null;

  if (diff.action === 'redundant') {
    relationshipTarget = await applyRedundantUpdate({
      supabase,
      existingPage,
      recordingId,
      recordingTitle,
      sourceType,
      sourceLabel,
      nowIso,
    });
  } else if (diff.action === 'additive') {
    relationshipTarget = await applyAdditiveUpdate({
      supabase,
      existingPage,
      recordingId,
      recordingTitle,
      sourceType,
      sourceLabel,
      diff,
      nowIso,
    });
  } else {
    // contradiction
    const settings = await getWikiCompilationSettings(orgId);
    const shouldAutoApply = shouldAutoApplyWikiContradiction(settings, {
      contradictionCount: diff.contradictions.length,
      confidenceDelta: diff.confidence_delta,
    });

    if (shouldAutoApply) {
      relationshipTarget = await applyContradictionWithSupersede({
        supabase,
        existingPage,
        orgId,
        recordingId,
        recordingTitle,
        sourceType,
        sourceLabel,
        diff,
        nowIso,
        classification,
      });
    } else {
      console.log(
        `[compile-wiki] Contradiction routed to manual review ` +
          `(mode=${settings.contradictionReviewMode}, conflicts=${diff.contradictions.length}, ` +
          `confidence_delta=${diff.confidence_delta.toFixed(3)})`,
      );
      await applyContradictionFlagged({
        supabase,
        existingPage,
        recordingId,
        recordingTitle,
        sourceType,
        sourceLabel,
        diff,
        nowIso,
      });
      // No content mutation on flagged path — leave relationships untouched.
      relationshipTarget = null;
    }
  }

  // ---- 93% — Relationship extraction (TRIB-39) -----------------------------
  if (relationshipTarget) {
    progressCallback?.(93, 'Extracting wiki relationships (best-effort)...');
    const backlinksChanged = await runRelationshipExtraction({
      supabase,
      orgId,
      pageId: relationshipTarget.pageId,
      topic: classification.topic,
      content: relationshipTarget.content,
      recordingId,
    });
    const shouldRefreshEmbedding =
      relationshipTarget.contentChanged || backlinksChanged;

    // ---- 97% — Cross-page contradiction detection (TRIB-41) ----------------
    progressCallback?.(
      97,
      'Detecting cross-page contradictions (best-effort)...',
    );
    await runCrossPageContradictionDetection({
      supabase,
      orgId,
      pageId: relationshipTarget.pageId,
      app: classification.app,
      screen: classification.screen,
      topic: classification.topic,
      content: relationshipTarget.content,
      recordingId,
    });

    if (shouldRefreshEmbedding) {
      progressCallback?.(
        99,
        'Refreshing final wiki embedding (best-effort)...',
      );
      await runBestEffortEmbedding(relationshipTarget.pageId, {
        source: relationshipTarget.embeddingContext,
        orgId,
        recordingId,
        contentChanged: relationshipTarget.contentChanged,
        backlinksChanged,
      });
    }
  }

  progressCallback?.(100, `Update path completed (${diff.action})`);
}

async function callUpdateDiffLLM(params: {
  existingPage: OrgWikiPageRow;
  recordingTitle: string | null;
  sourceLabel: string;
  workflow: WorkflowRowForCompile | null;
  workflowSteps: WorkflowStep[];
  document: DocumentRowForCompile | null;
  transcript: TranscriptRowForCompile | null;
  recordingId: string;
}): Promise<string> {
  const titleInput = sanitizeVisualDescription(
    params.recordingTitle ?? params.workflow?.title ?? 'Untitled recording',
    300,
  );

  const workflowStepsBlock = params.workflowSteps
    .slice(0, MAX_WORKFLOW_STEPS_IN_PROMPT)
    .map((step, i) => {
      const title = sanitizeVisualDescription(step.title ?? '', 200);
      const description = sanitizeVisualDescription(
        step.description ?? '',
        400,
      );
      const action = sanitizeVisualDescription(step.action ?? '', 50);
      const uiEls = (step.uiElements ?? [])
        .slice(0, 10)
        .map((el) => sanitizeVisualDescription(String(el), 100))
        .join(', ');
      const line = `${i + 1}. ${title}${action ? ` (${action})` : ''}`;
      const details = [description, uiEls ? `UI: ${uiEls}` : '']
        .filter(Boolean)
        .join(' | ');
      return details ? `${line}\n   ${details}` : line;
    })
    .join('\n');

  const documentExcerpt = sanitizeVisualDescription(
    params.document?.markdown ?? params.document?.summary ?? '',
    MAX_DOCUMENT_CHARS,
  );

  const transcriptExcerpt = sanitizeVisualDescription(
    params.transcript?.text ?? '',
    MAX_TRANSCRIPT_CHARS,
  );

  // PII scan mirrors the generation path (Gemini + logs)
  checkAndLogPII(
    [titleInput, workflowStepsBlock, documentExcerpt, transcriptExcerpt].join(
      ' ',
    ),
    'compile-wiki-update-diff',
    params.recordingId,
  );

  // Follows product-architecture-v2.md Part 3 Component 4 Step 3b template.
  const prompt = `You are a knowledge compiler. You maintain a wiki page about a specific workflow inside one organization's knowledge base. A new ${params.sourceLabel} covering the same workflow or process has just been processed and you must decide how it changes the page.

EXISTING PAGE (Markdown with YAML frontmatter):
"""
${params.existingPage.content}
"""

NEW SOURCE DATA:
- Source title: ${titleInput}
- Workflow steps (extracted from UI state transitions):
${workflowStepsBlock || '(no structured steps available)'}
- Generated document excerpt:
${documentExcerpt || '(none)'}
- Narration transcript:
${transcriptExcerpt || '(none)'}

TASK: Decide how this new recording relates to the existing page and return a JSON object. Possible classifications:
1. "redundant" — The recording covers the same ground as the existing page. No new information. No contradiction. (The page body should NOT change — we will only bump the confidence score and log the corroboration.)
2. "additive" — The recording adds NEW information that does not conflict with anything already on the page (e.g. a new step, a new edge case, a new UI element). You must return merged_content containing the full updated page body — keep the existing structure and frontmatter, then splice the new information into the most appropriate section.
3. "contradiction" — The recording contradicts something that is already on the page (e.g. the page says "click Save" but the recording clearly shows "click Submit", or the page says a field is required but the recording shows it is optional). List every contradicted fact as an object with "old" (exact string or paraphrase from the existing page), "new" (what the recording shows), and an optional "field" naming the UI element or section. Also return merged_content containing a *proposed* rewrite that resolves the contradictions — the caller may auto-apply it or route it to admin review depending on org settings.

Rules:
- Only use information grounded in the source material. Do not invent URLs, field names, keyboard shortcuts, or people.
- Prefer the workflow steps when the transcript and document disagree with each other — the steps were extracted from actual UI transitions.
- Never remove existing information from merged_content unless a contradiction explicitly supersedes it.
- If you return merged_content, it MUST be the complete page body including the YAML frontmatter block and all sections. Do not wrap it in code fences.
- additions must be a JSON array of short human-readable strings, one per new fact (empty array when none).
- contradictions must be a JSON array of { old, new, field? } objects (empty array when none).
- confidence_delta must be a number between -0.2 and 0.2 describing how the new recording should move the page's confidence score. Use positive values when the recording corroborates or clarifies, negative when it introduces doubt.

Return ONLY a JSON object of the form:
{
  "action": "additive" | "redundant" | "contradiction",
  "additions": ["..."],
  "contradictions": [{"old": "...", "new": "...", "field": "..."}],
  "merged_content": "complete Markdown page with YAML frontmatter, or empty string for redundant",
  "confidence_delta": 0.0
}

Do not include any commentary before or after the JSON. Do not wrap the JSON in markdown fences.`;

  try {
    return await callGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 8192,
    });
  } catch (error) {
    console.error(
      `[compile-wiki] Step 3b diff LLM call failed for ${params.recordingId}:`,
      error,
    );
    return '';
  }
}

function parseUpdateDiff(
  responseText: string,
  recordingId: string,
): WikiDiffResult | null {
  if (!responseText) return null;

  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const rawAction =
      typeof parsed.action === 'string' ? parsed.action.toLowerCase() : '';
    if (
      rawAction !== 'additive' &&
      rawAction !== 'redundant' &&
      rawAction !== 'contradiction'
    ) {
      console.warn(
        `[compile-wiki] LLM diff returned unknown action "${rawAction}" for ${recordingId}`,
      );
      return null;
    }

    const additions = Array.isArray(parsed.additions)
      ? parsed.additions.flatMap((__item, __index, __array) => {
          const __mapped = typeof __item === 'string' ? __item.trim() : '';
          return __mapped.length > 0 ? [__mapped] : [];
        })
      : [];

    const contradictions = Array.isArray(parsed.contradictions)
      ? parsed.contradictions.flatMap((raw): ContradictionEntry[] => {
          if (!raw || typeof raw !== 'object') return [];
          const obj = raw as Record<string, unknown>;
          const oldVal = typeof obj.old === 'string' ? obj.old.trim() : '';
          const newVal = typeof obj.new === 'string' ? obj.new.trim() : '';
          if (!oldVal || !newVal) return [];
          const field =
            typeof obj.field === 'string' ? obj.field.trim() : undefined;
          return [
            field
              ? { old: oldVal, new: newVal, field }
              : { old: oldVal, new: newVal },
          ];
        })
      : [];

    const mergedRaw =
      typeof parsed.merged_content === 'string' ? parsed.merged_content : '';
    const merged_content = stripCodeFences(mergedRaw) || null;

    const rawDelta = Number(parsed.confidence_delta);
    const confidence_delta = Number.isFinite(rawDelta)
      ? Math.max(-0.2, Math.min(0.2, rawDelta))
      : 0;

    return {
      action: rawAction,
      additions,
      contradictions,
      merged_content,
      confidence_delta,
    };
  } catch (error) {
    console.error(
      `[compile-wiki] Failed to parse Step 3b diff JSON for ${recordingId}:`,
      error,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3b — Write branches
// ---------------------------------------------------------------------------

async function applyRedundantUpdate(args: {
  supabase: ReturnType<typeof createAdminClient>;
  existingPage: OrgWikiPageRow;
  recordingId: string;
  recordingTitle: string | null;
  sourceType: WikiPageSourceType;
  sourceLabel: string;
  nowIso: string;
}): Promise<{
  pageId: string;
  content: string;
  contentChanged: boolean;
  embeddingContext: string;
}> {
  const {
    supabase,
    existingPage,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    nowIso,
  } = args;

  const newConfidence = clampConfidence(
    (existingPage.confidence ?? 0.5) + REDUNDANT_CONFIDENCE_DELTA,
  );

  const logEntry: CompilationLogEntry = {
    action: 'redundant',
    source_recording_id: recordingId,
    source_content_id: recordingId,
    source_type: sourceType,
    detected_at: nowIso,
    confidence_delta: REDUNDANT_CONFIDENCE_DELTA,
  };

  const updatedLog = appendCompilationLog(
    existingPage.compilation_log,
    logEntry,
  );

  const { error } = await supabase
    .from('org_wiki_pages')
    .update({
      confidence: newConfidence,
      compilation_log: updatedLog as unknown as Json,
    } as never)
    .eq('id', existingPage.id);

  if (error) {
    throw new Error(
      `Failed to record redundant update on page ${existingPage.id}: ${error.message}`,
    );
  }

  await insertWikiPageSource(supabase, {
    pageId: existingPage.id,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    summary: `Redundant corroboration from ${sourceLabel} (confidence ${existingPage.confidence.toFixed(2)} → ${newConfidence.toFixed(2)})`,
  });

  console.log(
    `[compile-wiki] Redundant update applied to page ${existingPage.id} ` +
      `(confidence ${existingPage.confidence.toFixed(2)} → ${newConfidence.toFixed(2)})`,
  );

  // Content unchanged on redundant — return existing content so Step 4 can
  // still refresh/upsert relationships (idempotent via on-conflict).
  return {
    pageId: existingPage.id,
    content: existingPage.content,
    contentChanged: false,
    embeddingContext: 'compile-wiki.redundant',
  };
}

async function applyAdditiveUpdate(args: {
  supabase: ReturnType<typeof createAdminClient>;
  existingPage: OrgWikiPageRow;
  recordingId: string;
  recordingTitle: string | null;
  sourceType: WikiPageSourceType;
  sourceLabel: string;
  diff: WikiDiffResult;
  nowIso: string;
}): Promise<{
  pageId: string;
  content: string;
  contentChanged: boolean;
  embeddingContext: string;
}> {
  const {
    supabase,
    existingPage,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    diff,
    nowIso,
  } = args;

  const mergedContent = diff.merged_content?.trim();

  // Defensive: if the LLM classified as additive but didn't actually return
  // merged content, fall back to a redundant-style no-op (content stays, log
  // records the no-op explicitly).
  if (!mergedContent) {
    console.warn(
      `[compile-wiki] Additive diff missing merged_content for recording ${recordingId}, ` +
        `falling back to source-only record on page ${existingPage.id}`,
    );
    await insertWikiPageSource(supabase, {
      pageId: existingPage.id,
      recordingId,
      recordingTitle,
      sourceType,
      sourceLabel,
      summary:
        'Additive classification but LLM returned no merged content — source recorded only',
    });
    return {
      pageId: existingPage.id,
      content: existingPage.content,
      contentChanged: false,
      embeddingContext: 'compile-wiki.additive-source-only',
    };
  }

  const newConfidence = clampConfidence(
    (existingPage.confidence ?? 0.5) + diff.confidence_delta,
  );

  const logEntry: CompilationLogEntry = {
    action: 'additive',
    source_recording_id: recordingId,
    source_content_id: recordingId,
    source_type: sourceType,
    detected_at: nowIso,
    additions: diff.additions,
    confidence_delta: diff.confidence_delta,
  };

  const updatedLog = appendCompilationLog(
    existingPage.compilation_log,
    logEntry,
  );

  const { error } = await supabase
    .from('org_wiki_pages')
    .update({
      content: mergedContent,
      confidence: newConfidence,
      compilation_log: updatedLog as unknown as Json,
    } as never)
    .eq('id', existingPage.id);

  if (error) {
    throw new Error(
      `Failed to apply additive update to page ${existingPage.id}: ${error.message}`,
    );
  }

  await insertWikiPageSource(supabase, {
    pageId: existingPage.id,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    summary: `Additive update from ${sourceLabel} — ${diff.additions.length} new fact(s) merged (confidence ${existingPage.confidence.toFixed(2)} → ${newConfidence.toFixed(2)})`,
  });

  console.log(
    `[compile-wiki] Additive update applied to page ${existingPage.id} ` +
      `(+${diff.additions.length} additions, confidence ${existingPage.confidence.toFixed(2)} → ${newConfidence.toFixed(2)})`,
  );

  return {
    pageId: existingPage.id,
    content: mergedContent,
    contentChanged: mergedContent !== existingPage.content,
    embeddingContext: 'compile-wiki.additive',
  };
}

async function applyContradictionFlagged(args: {
  supabase: ReturnType<typeof createAdminClient>;
  existingPage: OrgWikiPageRow;
  recordingId: string;
  recordingTitle: string | null;
  sourceType: WikiPageSourceType;
  sourceLabel: string;
  diff: WikiDiffResult;
  nowIso: string;
}): Promise<void> {
  const {
    supabase,
    existingPage,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    diff,
    nowIso,
  } = args;

  // Leave page content untouched; TRIB-34's admin review UI will surface the
  // flagged entry and let a human decide whether to accept merged_content.
  //
  // TRIB-41: persist the full audit trail — old_content, merged_content, a
  // short diff_summary, plus applied_at/applied_by placeholders — so the
  // approve server action can adopt `merged_content` verbatim instead of
  // falling back to literal substring replacement.
  const mergedContent = diff.merged_content?.trim() || null;
  const diffSummary = buildDiffSummary(diff);

  const logEntry: CompilationLogEntry = {
    action: 'flagged',
    source_recording_id: recordingId,
    source_content_id: recordingId,
    source_type: sourceType,
    detected_at: nowIso,
    contradictions: diff.contradictions,
    additions: diff.additions,
    confidence_delta: diff.confidence_delta,
    old_content: existingPage.content,
    new_content: null,
    merged_content: mergedContent,
    diff_summary: diffSummary,
    applied_at: null,
    applied_by: null,
    resolved_at: null,
    resolved_by: null,
  };

  const updatedLog = appendCompilationLog(
    existingPage.compilation_log,
    logEntry,
  );

  const { error } = await supabase
    .from('org_wiki_pages')
    .update({
      compilation_log: updatedLog as unknown as Json,
    } as never)
    .eq('id', existingPage.id);

  if (error) {
    throw new Error(
      `Failed to flag contradiction on page ${existingPage.id}: ${error.message}`,
    );
  }

  await insertWikiPageSource(supabase, {
    pageId: existingPage.id,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    summary: `Contradiction flagged for admin review — ${diff.contradictions.length} conflict(s)`,
  });

  console.log(
    `[compile-wiki] Contradiction flagged on page ${existingPage.id} ` +
      `(${diff.contradictions.length} conflicts, awaiting admin review via TRIB-34)`,
  );
}

async function applyContradictionWithSupersede(args: {
  supabase: ReturnType<typeof createAdminClient>;
  existingPage: OrgWikiPageRow;
  orgId: string;
  recordingId: string;
  recordingTitle: string | null;
  sourceType: WikiPageSourceType;
  sourceLabel: string;
  diff: WikiDiffResult;
  nowIso: string;
  classification: WikiClassification;
}): Promise<{
  pageId: string;
  content: string;
  contentChanged: boolean;
  embeddingContext: string;
} | null> {
  const {
    supabase,
    existingPage,
    orgId,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    diff,
    nowIso,
    classification,
  } = args;

  const mergedContent = diff.merged_content?.trim();

  // Defensive: auto-publish mode requires merged_content. If the LLM didn't
  // return any, fall back to the flagged path so the old page isn't left in
  // an inconsistent half-superseded state.
  if (!mergedContent) {
    console.warn(
      `[compile-wiki] Auto-publish contradiction missing merged_content for recording ${recordingId}, ` +
        `falling back to flagged path on page ${existingPage.id}`,
    );
    await applyContradictionFlagged({
      supabase,
      existingPage,
      recordingId,
      recordingTitle,
      sourceType,
      sourceLabel,
      diff,
      nowIso,
    });
    return null;
  }

  const newConfidence = clampConfidence(
    (existingPage.confidence ?? 0.5) + diff.confidence_delta,
  );

  const appliedLogEntry: CompilationLogEntry = {
    action: 'applied',
    source_recording_id: recordingId,
    source_content_id: recordingId,
    source_type: sourceType,
    detected_at: nowIso,
    contradictions: diff.contradictions,
    additions: diff.additions,
    confidence_delta: diff.confidence_delta,
    // TRIB-41 audit trail — mirror the shape used for flagged entries so the
    // admin UI / dashboards can treat auto-applied and human-approved rows
    // uniformly when surfacing history.
    old_content: existingPage.content,
    new_content: null,
    merged_content: mergedContent,
    diff_summary: buildDiffSummary(diff),
    applied_at: nowIso,
    applied_by: null, // auto-applied (no user)
    resolved_at: nowIso,
    resolved_by: null,
  };

  const newPageInsert: OrgWikiPageInsert = {
    org_id: orgId,
    app: classification.app,
    screen: classification.screen,
    topic: classification.topic,
    content: mergedContent,
    confidence: newConfidence,
    supersedes_id: existingPage.id,
    compilation_log: [appliedLogEntry] as unknown as Json,
  };

  const supersedeResponse = await (
    supabase as unknown as SupersedeOrgWikiPageRpc
  ).rpc('supersede_org_wiki_page', {
    p_existing_page_id: existingPage.id,
    p_org_id: orgId,
    p_app: newPageInsert.app ?? null,
    p_screen: newPageInsert.screen ?? null,
    p_topic: newPageInsert.topic,
    p_content: newPageInsert.content,
    p_confidence: newPageInsert.confidence ?? 0.5,
    p_supersedes_id: existingPage.id,
    p_compilation_log: newPageInsert.compilation_log as Json,
    p_valid_until: nowIso,
  });

  const supersedeError = supersedeResponse.error;
  const newPageId = supersedeResponse.data;

  if (supersedeError || !newPageId) {
    throw new Error(
      `Failed to atomically supersede page ${existingPage.id}: ${supersedeError?.message ?? 'unknown error'}`,
    );
  }

  await insertWikiPageSource(supabase, {
    pageId: newPageId,
    recordingId,
    recordingTitle,
    sourceType,
    sourceLabel,
    summary: `Auto-applied contradiction resolution (supersedes ${existingPage.id}, ${diff.contradictions.length} conflicts)`,
  });

  console.log(
    `[compile-wiki] Contradiction auto-applied: superseded ${existingPage.id} → ${newPageId} ` +
      `(${diff.contradictions.length} conflicts resolved, confidence ${existingPage.confidence.toFixed(2)} → ${newConfidence.toFixed(2)})`,
  );

  return {
    pageId: newPageId,
    content: mergedContent,
    contentChanged: true,
    embeddingContext: 'compile-wiki.auto-supersede',
  };
}

// ---------------------------------------------------------------------------
// Step 3b — Shared helpers
// ---------------------------------------------------------------------------

/**
 * Append a new entry to an existing compilation_log JSONB array. Defensively
 * coerces non-array payloads (e.g. a legacy `{}` or `null`) to `[]` first so
 * we never corrupt the column with an object shape.
 */
function appendCompilationLog(
  existing: Json | null | undefined,
  entry: CompilationLogEntry,
): CompilationLogEntry[] {
  const base = Array.isArray(existing)
    ? (existing as unknown as CompilationLogEntry[])
    : [];
  return [...base, entry];
}

/**
 * Build a short human-readable summary of a contradiction diff for the
 * admin review UI and dashboards. Keeps the string under ~240 characters so
 * the JSONB payload stays compact regardless of how noisy the LLM diff is.
 *
 * TRIB-41.
 */
function buildDiffSummary(diff: WikiDiffResult): string {
  const contradictionCount = diff.contradictions.length;
  const additionCount = diff.additions.length;

  const parts: string[] = [];
  parts.push(
    contradictionCount === 1
      ? '1 contradiction'
      : `${contradictionCount} contradictions`,
  );
  if (additionCount > 0) {
    parts.push(
      additionCount === 1 ? '1 addition' : `${additionCount} additions`,
    );
  }

  // Include a truncated preview of the first contradicted field so admins
  // can scan the log without opening every entry.
  const firstContradiction = diff.contradictions[0];
  if (firstContradiction) {
    const label = firstContradiction.field
      ? firstContradiction.field
      : firstContradiction.old.slice(0, 60);
    parts.push(`first: "${label.slice(0, 80)}"`);
  }

  const joined = parts.join(', ');
  return joined.length > 240 ? `${joined.slice(0, 237)}...` : joined;
}

async function insertWikiPageSource(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    pageId: string;
    recordingId: string;
    recordingTitle: string | null;
    sourceType: WikiPageSourceType;
    sourceLabel: string;
    summary: string;
  },
): Promise<void> {
  const titleForSummary = params.recordingTitle?.trim()
    ? params.recordingTitle.trim()
    : params.recordingId.slice(0, 8);

  const sourceInsert: WikiPageSourceInsert = {
    page_id: params.pageId,
    source_type: params.sourceType,
    source_id: params.recordingId,
    contribution_summary: `${params.summary} [${params.sourceLabel}: ${titleForSummary}]`,
  };

  const { error } = await supabase
    .from('wiki_page_sources')
    .insert(sourceInsert as never);

  if (error) {
    // Mirror the new-page branch's best-effort posture: log but don't throw.
    console.error(
      `[compile-wiki] Failed to insert wiki_page_sources row for page ${params.pageId}: ${error.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Best-effort embedding hook (TRIB-36 integration — wired in TRIB-64)
// ---------------------------------------------------------------------------

/**
 * Best-effort call into TRIB-36's org-wiki-embedding service after a wiki
 * page is inserted or updated. Failures are logged but never thrown so the
 * compile_wiki job still completes — the page simply ships without an
 * embedding and TRIB-36's backfill can catch it on the next pass.
 */
async function runBestEffortEmbedding(
  pageId: string,
  context: Record<string, unknown>,
): Promise<boolean> {
  return generateOrgWikiPageEmbeddingBestEffort(pageId, context);
}
