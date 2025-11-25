/**
 * Extract Text from PDF Handler
 *
 * Extracts text content from PDF documents using pdf-parse.
 * Saves the extracted text to the transcripts table and enqueues document generation.
 */

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const pdfParse = require('pdf-parse');

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

interface ExtractTextPdfPayload {
  recordingId: string;
  orgId: string;
  pdfPath: string; // Storage path in Supabase
}

const MAX_TEXT_LENGTH = 500000; // Maximum characters to process (approximately 125k words)
const CHUNK_SIZE = 5000; // Characters per chunk for very long documents

/**
 * Extract text from PDF document
 */
export async function handleExtractTextPdf(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as ExtractTextPdfPayload;
  const { recordingId, orgId, pdfPath } = payload;

  const logger = createLogger({ service: 'extract-text-pdf' });

  logger.info('Starting PDF text extraction', {
    context: {
      recordingId,
      orgId,
      pdfPath,
      jobId: job.id,
    },
  });

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('content')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  progressCallback?.(5, 'Downloading PDF file...');
  streamingManager.sendProgress(
    recordingId,
    'all',
    5,
    'Downloading PDF file...'
  );

  let tempPdfPath: string | null = null;

  try {
    // Download PDF from Supabase Storage
    logger.info('Downloading PDF from storage', {
      context: { pdfPath },
    });

    const { data: pdfBlob, error: downloadError } = await supabase.storage
      .from('content')
      .download(pdfPath);

    if (downloadError || !pdfBlob) {
      throw new Error(
        `Failed to download PDF: ${downloadError?.message || 'Unknown error'}`
      );
    }

    // Save PDF to temp file
    tempPdfPath = join(tmpdir(), `${randomUUID()}.pdf`);
    const buffer = await pdfBlob.arrayBuffer();
    await writeFile(tempPdfPath, Buffer.from(buffer));

    logger.info('PDF saved to temp file', {
      context: { tempPdfPath, sizeBytes: buffer.byteLength },
    });

    progressCallback?.(25, 'Extracting text from PDF...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      25,
      'Extracting text from PDF document...'
    );

    // Parse PDF and extract text
    const dataBuffer = Buffer.from(buffer);
    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text;
    const pageCount = pdfData.numpages;

    logger.info('PDF text extracted', {
      context: {
        pageCount,
        textLength: extractedText.length,
        hasText: extractedText.length > 0,
      },
    });

    // Check if PDF is scanned (OCR needed)
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error(
        'PDF appears to be scanned or contains no extractable text. OCR support is required for scanned documents.'
      );
    }

    progressCallback?.(60, 'Processing extracted text...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      60,
      'Processing extracted text...'
    );

    // Clean and normalize text
    let cleanedText = extractedText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate if too long
    let wasTruncated = false;
    if (cleanedText.length > MAX_TEXT_LENGTH) {
      cleanedText = cleanedText.substring(0, MAX_TEXT_LENGTH);
      wasTruncated = true;
      logger.warn('Text truncated due to length', {
        context: {
          originalLength: extractedText.length,
          truncatedLength: cleanedText.length,
        },
      });
    }

    progressCallback?.(75, 'Saving extracted text...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      75,
      'Saving extracted text to database...'
    );

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        content_id: recordingId,
        text: cleanedText,
        language: 'en', // Default to English, could be detected
        words_json: {
          pageCount,
          extractedLength: extractedText.length,
          cleanedLength: cleanedText.length,
          wasTruncated,
          extractionMethod: 'pdf-parse',
        },
        provider: 'pdf-parse',
      })
      .select()
      .single();

    if (transcriptError) {
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    logger.info('Transcript saved', {
      context: { transcriptId: transcript.id },
    });

    // Update recording status
    await supabase
      .from('content')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

    progressCallback?.(85, 'Text extraction complete, queuing document generation...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      85,
      'Text extraction complete, queuing document generation...'
    );

    // Enqueue document generation job
    await supabase.from('jobs').insert({
      type: 'doc_generate',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
      },
      dedupe_key: `doc_generate:${recordingId}`,
    });

    logger.info('Enqueued document generation job', {
      context: { recordingId, transcriptId: transcript.id },
    });

    progressCallback?.(100, 'PDF text extraction complete');
    streamingManager.sendProgress(
      recordingId,
      'all',
      100,
      'PDF text extraction complete'
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'pdf.extracted',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        pageCount,
        textLength: cleanedText.length,
        orgId,
      },
    });

  } catch (error) {
    logger.error('PDF text extraction failed', {
      context: { recordingId, pdfPath },
      error: error as Error,
    });

    streamingManager.sendError(
      recordingId,
      `PDF text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Update recording status to error
    await supabase
      .from('content')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'PDF text extraction failed',
        metadata: {
          error: error instanceof Error ? error.message : 'PDF text extraction failed',
          errorType: 'pdf_extraction',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempPdfPath) {
      try {
        await unlink(tempPdfPath);
        logger.info('Cleaned up temp PDF file');
      } catch (err) {
        logger.error('Failed to delete temp PDF file', {
          error: err as Error,
        });
      }
    }
  }
}
