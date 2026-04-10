/**
 * Workflow Extraction Job Handler
 *
 * Combines frame analysis, OCR, and transcript data to extract
 * step-by-step workflows from screen recordings. Stores results
 * in the workflows table.
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging } from '@/lib/services/agent-logger';
import { detectUITransitions } from '@/lib/services/ui-state-detector';
import type { ExtractedFrame } from '@/lib/services/frame-extraction';
import type { OCRResult } from '@/lib/services/ocr-service';
import type { UITransition } from '@/lib/services/ui-state-detector';
import type { Database, WorkflowStep } from '@/lib/types/database';
import { detectPII, logPIIDetection, sanitizeVisualDescription } from '@/lib/utils/security';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

interface WorkflowPayload {
  recordingId: string;
  orgId: string;
}

interface TransitionWithNarration extends UITransition {
  narration: string;
}

const AGENT_TYPE = 'workflow_extraction';
const MAX_STEPS = 50;
const MAX_FRAMES_IN_MEMORY = 1000;
const LONG_RECORDING_THRESHOLD_SEC = 30 * 60; // 30 minutes

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

/** Send a prompt to Gemini and return the response text. */
async function callGemini(prompt: string): Promise<string> {
  const genai = getGenAIClient();
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.3, maxOutputTokens: 8192 },
  });
  return result.text ?? '';
}

/** Detect PII in text and log if found. */
function checkAndLogPII(text: string, source: string): void {
  const piiCheck = detectPII(text);
  if (piiCheck.hasPII) {
    logPIIDetection(source, piiCheck.types);
  }
}

/** Truncate to MAX_STEPS and renumber starting from 1. */
function limitAndRenumberSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const limited = steps.slice(0, MAX_STEPS);
  for (let i = 0; i < limited.length; i++) {
    limited[i].stepNumber = i + 1;
  }
  return limited;
}

/** Return a consolidation hint for long recordings, or empty string. */
function getConsolidateHint(isLongRecording: boolean): string {
  return isLongRecording
    ? '\nThis is a long recording (>30 min). Group rapid micro-actions into consolidated steps. Limit to 50 steps maximum.'
    : '';
}

/** Format seconds as M:SS. */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract a step-by-step workflow from a screen recording.
 *
 * Pipeline:
 * 1. Fetch extracted frames and OCR data
 * 2. Detect UI state transitions
 * 3. Correlate transitions with transcript timestamps
 * 4. Synthesize into coherent workflow steps via Gemini
 * 5. Store workflow in the workflows table
 */
export async function handleWorkflowExtraction(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as WorkflowPayload;
  const { recordingId, orgId } = payload;

  if (!recordingId || !orgId) {
    console.warn('[WorkflowExtraction] Missing recordingId or orgId in payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[WorkflowExtraction] Agent disabled for org ${orgId}, skipping`);
    return;
  }

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'extract_workflow',
      contentId: recordingId,
      inputSummary: `Extract workflow from recording ${recordingId}`,
    },
    () => runExtractionPipeline(recordingId, orgId, progressCallback)
  );
}

async function runExtractionPipeline(
  recordingId: string,
  orgId: string,
  progressCallback?: ProgressCallback
): Promise<void> {
  const supabase = createAdminClient();

  progressCallback?.(5, 'Loading recording metadata...');

  const { data: recording, error: recordingError } = await supabase
    .from('content')
    .select('id, title, duration_sec')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw new Error(`Recording ${recordingId} not found: ${recordingError?.message}`);
  }

  const isLongRecording = (recording.duration_sec ?? 0) > LONG_RECORDING_THRESHOLD_SEC;

  progressCallback?.(10, 'Fetching frames and transcript...');

  const [framesResult, transcriptResult] = await Promise.all([
    supabase
      .from('video_frames')
      .select('id, frame_time_sec, frame_url, visual_description, ocr_text, metadata')
      .eq('content_id', recordingId)
      .eq('org_id', orgId)
      .order('frame_time_sec', { ascending: true })
      .limit(MAX_FRAMES_IN_MEMORY),
    supabase
      .from('transcripts')
      .select('text, words_json')
      .eq('content_id', recordingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const { data: frameRows, error: framesError } = framesResult;
  if (framesError) {
    throw new Error(`Failed to fetch frames: ${framesError.message}`);
  }

  if (frameRows.length >= MAX_FRAMES_IN_MEMORY) {
    console.warn(
      `[WorkflowExtraction] Recording ${recordingId} has ${MAX_FRAMES_IN_MEMORY}+ frames, using first ${MAX_FRAMES_IN_MEMORY}`
    );
  }

  const transcript = transcriptResult.data;
  const transcriptText = transcript?.text?.trim() ? transcript.text : '';
  const hasFrames = frameRows.length > 0;

  if (!hasFrames && !transcriptText) {
    console.warn(`[WorkflowExtraction] No frames or transcript for ${recordingId}, skipping`);
    return;
  }

  // No frames -- fall back to text-only workflow from transcript
  if (!hasFrames) {
    console.warn(`[WorkflowExtraction] No frames for ${recordingId}, falling back to text-only workflow`);
    progressCallback?.(30, 'Generating text-only workflow from transcript...');
    const steps = await synthesizeFromTranscriptOnly(transcriptText, isLongRecording);
    await storeWorkflow(supabase, recordingId, orgId, recording.title, steps, 0.5);
    progressCallback?.(100, 'Text-only workflow extraction complete');
    return;
  }

  // Build ExtractedFrame and OCRResult arrays for detectUITransitions
  const frames: ExtractedFrame[] = frameRows.map((row, i) => ({
    frameNumber: i,
    timeSec: row.frame_time_sec,
    localPath: row.frame_url ?? '',
    storagePath: row.frame_url ?? '',
    width: 0,
    height: 0,
    sizeBytes: 0,
  }));

  const ocrResults: OCRResult[] = frameRows.map((row) => ({
    text: row.ocr_text ?? '',
    confidence: row.ocr_text ? 0.8 : 0,
    blocks: [],
  }));

  progressCallback?.(25, 'Detecting UI state transitions...');
  let transitions: UITransition[] = [];
  try {
    transitions = await detectUITransitions(frames, ocrResults);
  } catch (error) {
    console.error(`[WorkflowExtraction] UI transition detection failed for ${recordingId}:`, error);
    // Continue with empty transitions -- Gemini will rely on frame descriptions + transcript
  }

  console.log(`[WorkflowExtraction] Detected ${transitions.length} transitions for ${recordingId}`);

  progressCallback?.(40, 'Correlating transitions with transcript...');
  const wordsJson = transcript?.words_json as Array<{ word: string; startTime: number; endTime: number }> | null;
  const transitionsWithNarration = correlateWithTranscript(transitions, wordsJson);

  progressCallback?.(55, 'Synthesizing workflow steps...');
  const frameDescriptions = frameRows.map((row) => ({
    timeSec: row.frame_time_sec,
    description: row.visual_description ?? '',
    ocrText: row.ocr_text ?? '',
    frameUrl: row.frame_url,
  }));

  const steps = await synthesizeWorkflowSteps(
    transitionsWithNarration,
    frameDescriptions,
    transcriptText,
    isLongRecording
  );

  if (steps.length === 0) {
    console.warn(`[WorkflowExtraction] Gemini returned no valid steps for ${recordingId}`);
  }

  // Assign screenshot paths from nearest frames
  for (const step of steps) {
    const nearest = findNearestFrame(step.timestamp, frameRows);
    if (nearest?.frame_url) {
      step.screenshotPath = nearest.frame_url;
    }
  }

  const avgConfidence = calculateConfidence(transitions, !!transcriptText);

  progressCallback?.(85, 'Storing workflow...');
  await storeWorkflow(supabase, recordingId, orgId, recording.title, steps, avgConfidence);
  progressCallback?.(100, 'Workflow extraction complete');

  console.log(
    `[WorkflowExtraction] Extracted ${steps.length} steps for ${recordingId} (confidence: ${avgConfidence.toFixed(2)})`
  );

  // TRIB-33: Enqueue the compile_wiki job as the next step in the pipeline.
  // This runs AFTER the workflow has been successfully stored. A failure here
  // is NOT fatal to workflow_extraction — the workflow was extracted, and a
  // compile_wiki job can be re-enqueued manually if this fails.
  try {
    await enqueueCompileWikiJob(supabase, { recordingId, orgId });
  } catch (error) {
    console.error(
      `[WorkflowExtraction] Failed to enqueue compile_wiki for ${recordingId}:`,
      error
    );
    // Intentionally swallowed — workflow_extraction succeeded.
  }
}

/**
 * Enqueue a `compile_wiki` job for a recording after workflow extraction
 * completes. Idempotent via the `dedupe_key` unique index on the `jobs`
 * table: if a `compile_wiki:<recordingId>` row already exists, the insert
 * no-ops and we log that fact instead of throwing.
 *
 * Payload shape is intentionally `{ recordingId, orgId }` to match
 * `CompileWikiPayload` in `src/lib/workers/handlers/compile-wiki.ts`.
 */
async function enqueueCompileWikiJob(
  supabase: ReturnType<typeof createAdminClient>,
  args: { recordingId: string; orgId: string }
): Promise<void> {
  const { recordingId, orgId } = args;
  const dedupeKey = `compile_wiki:${recordingId}`;

  const { error } = await supabase.from('jobs').insert({
    type: 'compile_wiki',
    status: 'pending',
    payload: { recordingId, orgId },
    dedupe_key: dedupeKey,
    priority: 2, // JOB_PRIORITY.NORMAL
  });

  if (error) {
    // Unique-violation on dedupe_key means another worker already queued
    // this recording's compile_wiki job — that's the desired behaviour.
    if (error.code === '23505') {
      console.log(
        `[WorkflowExtraction] compile_wiki already queued for ${recordingId} (dedupe_key=${dedupeKey})`
      );
      return;
    }
    throw new Error(`Failed to enqueue compile_wiki job: ${error.message}`);
  }

  console.log(
    `[WorkflowExtraction] Enqueued compile_wiki job for ${recordingId} (dedupe_key=${dedupeKey})`
  );
}

/**
 * Correlate UI transitions with transcript word timestamps.
 * For each transition, find transcript words spoken within a window
 * around the transition timestamp to add narration context.
 */
function correlateWithTranscript(
  transitions: UITransition[],
  wordsJson: Array<{ word: string; startTime: number; endTime: number }> | null
): TransitionWithNarration[] {
  if (!wordsJson || wordsJson.length === 0) {
    return transitions.map((t) => ({ ...t, narration: '' }));
  }

  const WINDOW_SEC = 5;

  return transitions.map((transition) => {
    const start = transition.timestamp - WINDOW_SEC;
    const end = transition.timestamp + WINDOW_SEC;

    const nearbyWords = wordsJson
      .filter((w) => w.startTime >= start && w.startTime <= end)
      .map((w) => w.word);

    return {
      ...transition,
      narration: nearbyWords.join(' '),
    };
  });
}

/**
 * Use Gemini to synthesize transitions, frame descriptions, and transcript
 * into coherent workflow steps. Falls back to raw transition data on API failure.
 */
async function synthesizeWorkflowSteps(
  transitions: TransitionWithNarration[],
  frameDescriptions: Array<{
    timeSec: number;
    description: string;
    ocrText: string;
    frameUrl: string | null;
  }>,
  transcript: string,
  isLongRecording: boolean
): Promise<WorkflowStep[]> {
  const allUserData = [
    ...transitions.map((t) => `${t.fromState} ${t.toState} ${t.narration}`),
    ...frameDescriptions.map((f) => `${f.description} ${f.ocrText}`),
    transcript,
  ].join(' ');

  checkAndLogPII(allUserData, 'workflow-extraction');

  const transitionSummary = transitions
    .slice(0, 100)
    .map((t) => {
      const fromState = sanitizeVisualDescription(t.fromState, 500);
      const toState = sanitizeVisualDescription(t.toState, 500);
      const narration = sanitizeVisualDescription(t.narration || '', 500);
      const uiEls = t.uiElements.map((el) => sanitizeVisualDescription(el, 200));

      return (
        `[${formatTimestamp(t.timestamp)}] ${t.transitionType}: ${fromState} → ${toState}` +
        (narration ? ` | Narration: "${narration}"` : '') +
        (uiEls.length > 0 ? ` | UI: ${uiEls.join(', ')}` : '')
      );
    })
    .join('\n');

  const frameContext = frameDescriptions
    .slice(0, 60)
    .map((f) => {
      const desc = sanitizeVisualDescription(f.description, 500);
      const ocr = sanitizeVisualDescription(f.ocrText || '', 200);
      return `[${formatTimestamp(f.timeSec)}] ${desc}` + (ocr ? ` | Text on screen: ${ocr}` : '');
    })
    .join('\n');

  const transcriptExcerpt = sanitizeVisualDescription(transcript, 8000);

  const prompt = `You are a workflow documentation specialist. Analyze this screen recording data and extract a clear, step-by-step workflow.

## UI State Transitions
${transitionSummary || 'No transitions detected.'}

## Frame Descriptions (chronological)
${frameContext || 'No frame descriptions available.'}

## Transcript
${transcriptExcerpt || 'No audio transcript available.'}
${getConsolidateHint(isLongRecording)}

Extract a workflow as a JSON array of steps. Each step should represent a distinct user action or milestone.

Rules:
- Each step title should be a clear imperative action (e.g., "Click Settings icon in the top navigation")
- Description explains what this step accomplishes
- Action is the specific interaction type (click, type, navigate, scroll, select, drag, etc.)
- uiElements lists the UI elements involved
- timestamp is the time in seconds when this step occurs
- duration is how long this step takes in seconds (estimate from gap to next step)
- stepNumber starts at 1 and increments

Return ONLY a JSON array:
[
  {
    "stepNumber": 1,
    "title": "Open the Settings page",
    "description": "Navigate to the application settings to configure deployment options",
    "action": "click",
    "uiElements": ["Settings icon", "top navigation bar"],
    "timestamp": 12.5,
    "duration": 3.0
  }
]`;

  try {
    const responseText = await callGemini(prompt);
    const steps = parseWorkflowSteps(responseText);
    return limitAndRenumberSteps(steps);
  } catch (error) {
    console.error('[WorkflowExtraction] Gemini synthesis failed:', error);

    if (transitions.length === 0) return [];

    return transitions.slice(0, MAX_STEPS).map((t, i) => ({
      stepNumber: i + 1,
      title: `${t.transitionType}: ${t.toState}`,
      description: t.narration || `Transition from ${t.fromState}`,
      action: t.transitionType,
      screenshotPath: null,
      timestamp: t.timestamp,
      duration: 0,
      uiElements: t.uiElements,
    }));
  }
}

/**
 * Generate a text-only workflow from transcript when no frames are available.
 */
async function synthesizeFromTranscriptOnly(
  transcriptText: string,
  isLongRecording: boolean
): Promise<WorkflowStep[]> {
  checkAndLogPII(transcriptText, 'workflow-extraction-transcript-only');

  const sanitizedTranscript = sanitizeVisualDescription(transcriptText, 12000);

  const prompt = `You are a workflow documentation specialist. Extract a step-by-step workflow from this transcript of a screen recording. No visual data is available, so infer steps from what the speaker describes.

## Transcript
${sanitizedTranscript}
${getConsolidateHint(isLongRecording)}

Extract a workflow as a JSON array:
[
  {
    "stepNumber": 1,
    "title": "Action description",
    "description": "What this step accomplishes",
    "action": "the interaction type (click, type, navigate, etc.)",
    "uiElements": ["relevant UI elements mentioned"],
    "timestamp": 0,
    "duration": 0
  }
]

Return ONLY the JSON array.`;

  try {
    const responseText = await callGemini(prompt);
    const steps = parseWorkflowSteps(responseText);
    const limited = limitAndRenumberSteps(steps);
    for (const step of limited) {
      step.screenshotPath = null;
    }
    return limited;
  } catch (error) {
    console.error('[WorkflowExtraction] Gemini transcript-only synthesis failed:', error);
    return [];
  }
}

/** Parse Gemini JSON response into WorkflowStep array. */
function parseWorkflowSteps(responseText: string): WorkflowStep[] {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((s: unknown): s is Record<string, unknown> => {
        const item = s as Record<string, unknown>;
        return typeof item?.title === 'string' && (item.title as string).length > 0;
      })
      .map((s, i): WorkflowStep => ({
        stepNumber: typeof s.stepNumber === 'number' ? s.stepNumber : i + 1,
        title: String(s.title).slice(0, 200),
        description: String(s.description ?? '').slice(0, 500),
        action: String(s.action ?? 'unknown').slice(0, 50),
        screenshotPath: null,
        timestamp: typeof s.timestamp === 'number' ? s.timestamp : 0,
        duration: typeof s.duration === 'number' ? s.duration : 0,
        uiElements: Array.isArray(s.uiElements)
          ? (s.uiElements as unknown[]).slice(0, 20).map((el) => String(el).slice(0, 100))
          : [],
      }));
  } catch {
    console.error('[WorkflowExtraction] Failed to parse workflow steps from Gemini response');
    return [];
  }
}

/** Find the nearest frame row to a given timestamp. */
function findNearestFrame<T extends { frame_time_sec: number }>(
  timestamp: number,
  frameRows: T[]
): T | null {
  if (frameRows.length === 0) return null;

  let closest = frameRows[0];
  let minDiff = Math.abs(frameRows[0].frame_time_sec - timestamp);

  for (let i = 1; i < frameRows.length; i++) {
    const diff = Math.abs(frameRows[i].frame_time_sec - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frameRows[i];
    }
  }

  return closest;
}

/** Calculate overall workflow confidence. */
function calculateConfidence(transitions: UITransition[], hasTranscript: boolean): number {
  if (transitions.length === 0) {
    return hasTranscript ? 0.5 : 0.3;
  }

  const avgTransitionConfidence =
    transitions.reduce((sum, t) => sum + t.confidence, 0) / transitions.length;

  const transcriptBonus = hasTranscript ? 0.1 : -0.1;

  return Math.min(1, Math.max(0, avgTransitionConfidence + transcriptBonus));
}

/** Store the extracted workflow in the workflows table. */
async function storeWorkflow(
  supabase: ReturnType<typeof createAdminClient>,
  recordingId: string,
  orgId: string,
  title: string | null,
  steps: WorkflowStep[],
  confidence: number
): Promise<void> {
  if (steps.length === 0) {
    console.warn(`[WorkflowExtraction] No steps extracted for ${recordingId}, skipping storage`);
    return;
  }

  const { error: outdateError } = await supabase
    .from('workflows')
    .update({ status: 'outdated' as const })
    .eq('content_id', recordingId)
    .eq('org_id', orgId)
    .in('status', ['draft', 'published']);

  if (outdateError) {
    throw new Error(`Failed to mark existing workflows as outdated for ${recordingId} (org ${orgId}): ${outdateError.message}`);
  }

  const workflowTitle = title
    ? `Workflow: ${title}`
    : `Workflow for recording ${recordingId.slice(0, 8)}`;

  const { error: insertError } = await supabase
    .from('workflows')
    .insert({
      content_id: recordingId,
      org_id: orgId,
      title: workflowTitle,
      description: `${steps.length}-step workflow extracted from screen recording`,
      steps: steps as unknown as Database['public']['Tables']['workflows']['Insert']['steps'],
      step_count: steps.length,
      status: 'draft' as const,
      confidence,
      metadata: {
        extractedAt: new Date().toISOString(),
        agentType: AGENT_TYPE,
      },
    });

  if (insertError) {
    throw new Error(`Failed to store workflow: ${insertError.message}`);
  }
}
