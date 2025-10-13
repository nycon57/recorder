/**
 * OCR Service
 *
 * Extracts text from video frames using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import type { RecognizeResult } from 'tesseract.js';
import { sanitizeOcrText, detectPII, logPIIDetection } from '@/lib/utils/security';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * Perform OCR on image
 */
export async function extractText(imagePath: string): Promise<OCRResult> {
  const worker = await Tesseract.createWorker('eng');

  try {
    const result: RecognizeResult = await worker.recognize(imagePath);

    const blocks: OCRBlock[] = (result.data.blocks || []).map((block) => ({
      text: block.text,
      confidence: block.confidence,
      bbox: {
        x0: block.bbox.x0,
        y0: block.bbox.y0,
        x1: block.bbox.x1,
        y1: block.bbox.y1,
      },
    }));

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      blocks,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from frame with filtering and PII sanitization
 */
export async function extractFrameText(
  imagePath: string,
  confidenceThreshold?: number,
  recordingId?: string
): Promise<OCRResult> {
  const threshold =
    confidenceThreshold ||
    parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '70');

  const result = await extractText(imagePath);

  // Filter low-confidence blocks
  const filteredBlocks = result.blocks.filter(
    (block) => block.confidence >= threshold
  );

  const filteredText = filteredBlocks.map((b) => b.text).join(' ');

  // SECURITY: Detect and sanitize PII in OCR output
  const piiDetection = detectPII(filteredText);

  if (piiDetection.hasPII) {
    logPIIDetection('OCR extraction', piiDetection.types, recordingId);
  }

  // Sanitize the full text and each block
  const sanitizedText = sanitizeOcrText(piiDetection.redacted);
  const sanitizedBlocks = filteredBlocks.map((block) => ({
    ...block,
    text: sanitizeOcrText(block.text),
  }));

  return {
    text: sanitizedText,
    confidence: result.confidence,
    blocks: sanitizedBlocks,
  };
}