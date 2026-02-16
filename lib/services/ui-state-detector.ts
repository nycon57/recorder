/**
 * UI State Transition Detector
 *
 * Detects meaningful UI state transitions in screen recordings
 * by comparing consecutive frames for pixel differences and using
 * Gemini Vision to classify the type of change.
 */

import { promises as fs } from 'fs';

import sharp from 'sharp';

import { getGoogleAI } from '@/lib/google/client';
import type { ExtractedFrame } from '@/lib/services/frame-extraction';
import type { OCRResult } from '@/lib/services/ocr-service';
import { sanitizeVisualDescription, detectPII, logPIIDetection } from '@/lib/utils/security';

export interface UITransition {
  frameIndex: number;
  timestamp: number;
  transitionType:
    | 'navigation'
    | 'click'
    | 'form_fill'
    | 'modal_open'
    | 'modal_close'
    | 'page_load'
    | 'scroll'
    | 'unknown';
  fromState: string;
  toState: string;
  confidence: number;
  uiElements: string[];
}

/** Minimum pixel difference ratio to consider a transition (15%) */
const PIXEL_DIFF_THRESHOLD = 0.15;

/** Batch size for Gemini Vision classification requests */
const CLASSIFICATION_BATCH_SIZE = 3;

/**
 * Detect UI state transitions across a sequence of extracted frames.
 *
 * Compares consecutive frames for significant pixel differences (>15%),
 * filters out noise (scrolling without content change), and uses
 * Gemini Vision to classify each detected transition.
 */
export async function detectUITransitions(
  frames: ExtractedFrame[],
  ocrResults: OCRResult[]
): Promise<UITransition[]> {
  if (frames.length < 2) {
    return [];
  }

  console.log('[UI State Detector] Analyzing', frames.length, 'frames');

  // Step 1: Compute pixel differences between consecutive frames
  const diffs = await computeFrameDifferences(frames);

  // Step 2: Identify candidate transitions (>15% pixel change)
  const candidates = diffs
    .map((diff, index) => ({ index, diff }))
    .filter(({ diff }) => diff > PIXEL_DIFF_THRESHOLD);

  if (candidates.length === 0) {
    console.log('[UI State Detector] No significant transitions detected');
    return [];
  }

  console.log(
    '[UI State Detector] Found',
    candidates.length,
    'candidate transitions'
  );

  // Step 3: Filter noise — scrolling with no meaningful content change
  const meaningful = filterNoise(candidates, ocrResults);

  if (meaningful.length === 0) {
    console.log(
      '[UI State Detector] All candidates filtered as noise (scrolling/minor changes)'
    );
    return [];
  }

  console.log(
    '[UI State Detector] After noise filter:',
    meaningful.length,
    'transitions'
  );

  // Step 4: Classify transitions using Gemini Vision
  const transitions = await classifyTransitions(
    meaningful,
    frames,
    ocrResults
  );

  // Step 5: Sort by timestamp
  transitions.sort((a, b) => a.timestamp - b.timestamp);

  console.log(
    '[UI State Detector] Detected',
    transitions.length,
    'UI transitions'
  );

  return transitions;
}

/**
 * Compute normalized pixel difference ratio between each pair
 * of consecutive frames. Returns array of length (frames.length - 1).
 */
async function computeFrameDifferences(
  frames: ExtractedFrame[]
): Promise<number[]> {
  const diffs: number[] = [];

  for (let i = 0; i < frames.length - 1; i++) {
    const diff = await computePairDifference(
      frames[i].localPath,
      frames[i + 1].localPath
    );
    diffs.push(diff);
  }

  return diffs;
}

/**
 * Compute the fraction of pixels that differ between two images.
 * Resizes both to a common small resolution for fast comparison,
 * converts to grayscale, and counts pixels that differ beyond a threshold.
 */
async function computePairDifference(
  pathA: string,
  pathB: string
): Promise<number> {
  const compareWidth = 320;
  const compareHeight = 240;

  const [bufA, bufB] = await Promise.all([
    sharp(pathA)
      .resize(compareWidth, compareHeight, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer(),
    sharp(pathB)
      .resize(compareWidth, compareHeight, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer(),
  ]);

  const totalPixels = compareWidth * compareHeight;
  // Per-pixel intensity threshold (0-255) to ignore compression noise
  const intensityThreshold = 20;
  let changedPixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (Math.abs(bufA[i] - bufB[i]) > intensityThreshold) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

interface Candidate {
  index: number;
  diff: number;
}

/**
 * Filter out noise: consecutive frames with high pixel difference
 * but no meaningful content change (e.g., scrolling, cursor movement,
 * loading spinners).
 *
 * Uses OCR text overlap between frames — if text content is largely
 * the same despite pixel change, the transition is likely scrolling.
 */
function filterNoise(
  candidates: Candidate[],
  ocrResults: OCRResult[]
): Candidate[] {
  return candidates.filter(({ index }) => {
    const beforeOcr = ocrResults[index];
    const afterOcr = ocrResults[index + 1];

    // If OCR data is missing for either frame, keep the candidate
    if (!beforeOcr || !afterOcr) {
      return true;
    }

    // Compare OCR text content between frames
    const beforeWords = extractWords(beforeOcr.text);
    const afterWords = extractWords(afterOcr.text);

    // If both frames have very little text, keep — could be a visual-only transition
    if (beforeWords.size < 3 && afterWords.size < 3) {
      return true;
    }

    // Calculate word overlap ratio
    const overlap = wordOverlap(beforeWords, afterWords);

    // High overlap (>80%) with pixel change = scrolling/cursor/spinner
    return overlap <= 0.8;
  });
}

/** Extract unique lowercase words from text, ignoring short tokens */
function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Jaccard similarity between two word sets */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Classify each transition using Gemini Vision. Sends pairs of
 * consecutive frames and asks Gemini to describe the UI change.
 *
 * Processes in batches to avoid rate limits. If a request fails,
 * the transition is marked as 'unknown' with lower confidence.
 */
async function classifyTransitions(
  candidates: Candidate[],
  frames: ExtractedFrame[],
  ocrResults: OCRResult[]
): Promise<UITransition[]> {
  const transitions: UITransition[] = [];

  for (let i = 0; i < candidates.length; i += CLASSIFICATION_BATCH_SIZE) {
    const batch = candidates.slice(i, i + CLASSIFICATION_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((candidate) =>
        classifySingleTransition(candidate, frames, ocrResults)
      )
    );

    transitions.push(...batchResults);

    // Delay between batches to avoid Gemini API rate limits
    if (i + CLASSIFICATION_BATCH_SIZE < candidates.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return transitions;
}

/**
 * Classify a single transition by sending the frame pair to Gemini Vision.
 * Gracefully degrades to 'unknown' on API errors or rate limits.
 */
async function classifySingleTransition(
  candidate: Candidate,
  frames: ExtractedFrame[],
  ocrResults: OCRResult[]
): Promise<UITransition> {
  const { index } = candidate;
  const frameBefore = frames[index];
  const frameAfter = frames[index + 1];
  const ocrBefore = ocrResults[index];
  const ocrAfter = ocrResults[index + 1];

  try {
    const [imgBefore, imgAfter] = await Promise.all([
      fs.readFile(frameBefore.localPath),
      fs.readFile(frameAfter.localPath),
    ]);

    const genAI = getGoogleAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const ocrContext = buildOcrContext(ocrBefore, ocrAfter);

    const prompt = `Compare these two consecutive screenshots from a screen recording. The first image is the "before" state and the second is the "after" state.

${ocrContext}

Classify the UI change as one of these types:
- navigation: URL or page changed entirely
- click: a button, link, or interactive element was activated
- form_fill: text was entered into a form field
- modal_open: a modal, dialog, or popup appeared
- modal_close: a modal, dialog, or popup was dismissed
- page_load: a page finished loading (content appeared where loading indicator was)
- scroll: page was scrolled (content shifted vertically/horizontally)

Respond in JSON:
{
  "transitionType": "navigation|click|form_fill|modal_open|modal_close|page_load|scroll",
  "fromState": "brief description of the before state",
  "toState": "brief description of the after state",
  "confidence": 0.0-1.0,
  "uiElements": ["list", "of", "relevant", "UI", "elements"]
}`;

    const result = await model.generateContent([
      { inlineData: { mimeType: 'image/jpeg', data: imgBefore.toString('base64') } },
      { inlineData: { mimeType: 'image/jpeg', data: imgAfter.toString('base64') } },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validTypes = new Set([
      'navigation', 'click', 'form_fill', 'modal_open',
      'modal_close', 'page_load', 'scroll',
    ]);

    // Sanitize Gemini output to redact any PII visible in screenshots
    const fromState = sanitizeVisualDescription(parsed.fromState || 'unknown state', 500);
    const toState = sanitizeVisualDescription(parsed.toState || 'unknown state', 500);
    const uiElements = Array.isArray(parsed.uiElements)
      ? parsed.uiElements.map((el: string) => sanitizeVisualDescription(String(el), 200)).slice(0, 20)
      : [];

    const combinedText = `${parsed.fromState ?? ''} ${parsed.toState ?? ''} ${(parsed.uiElements ?? []).join(' ')}`;
    const piiCheck = detectPII(combinedText);
    if (piiCheck.hasPII) {
      logPIIDetection('ui-state-transition', piiCheck.types);
    }

    return {
      frameIndex: index,
      timestamp: frameBefore.timeSec,
      transitionType: validTypes.has(parsed.transitionType)
        ? parsed.transitionType
        : 'unknown',
      fromState: fromState || 'unknown state',
      toState: toState || 'unknown state',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.7)),
      uiElements,
    };
  } catch (error) {
    console.error(
      `[UI State Detector] Classification failed for frame pair ${index}/${index + 1}:`,
      error
    );

    // Graceful degradation: mark as 'unknown' with lower confidence
    return {
      frameIndex: index,
      timestamp: frameBefore.timeSec,
      transitionType: 'unknown',
      fromState: sanitizeVisualDescription(ocrBefore?.text?.slice(0, 100) || 'unknown state', 200),
      toState: sanitizeVisualDescription(ocrAfter?.text?.slice(0, 100) || 'unknown state', 200),
      confidence: 0.3,
      uiElements: [],
    };
  }
}

/** Build OCR context string for the Gemini prompt */
function buildOcrContext(
  ocrBefore?: OCRResult,
  ocrAfter?: OCRResult
): string {
  const parts: string[] = [];

  if (ocrBefore?.text) {
    parts.push(`Text visible in "before" frame: ${ocrBefore.text.slice(0, 500)}`);
  }
  if (ocrAfter?.text) {
    parts.push(`Text visible in "after" frame: ${ocrAfter.text.slice(0, 500)}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
}
