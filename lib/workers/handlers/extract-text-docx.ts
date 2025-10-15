/**
 * Extract Text from DOCX Handler
 *
 * Extracts text content from Word documents (DOCX) using mammoth.js.
 * Preserves basic formatting and saves the extracted text to the transcripts table.
 */

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import mammoth from 'mammoth';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

interface ExtractTextDocxPayload {
  recordingId: string;
  orgId: string;
  docxPath: string; // Storage path in Supabase
}

const MAX_TEXT_LENGTH = 500000; // Maximum characters to process (approximately 125k words)

/**
 * Extract text from DOCX document
 */
export async function handleExtractTextDocx(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as ExtractTextDocxPayload;
  const { recordingId, orgId, docxPath } = payload;

  const logger = createLogger({ service: 'extract-text-docx' });

  logger.info('Starting DOCX text extraction', {
    context: {
      recordingId,
      orgId,
      docxPath,
      jobId: job.id,
    },
  });

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  progressCallback?.(5, 'Downloading DOCX file...');
  streamingManager.sendProgress(
    recordingId,
    'all',
    5,
    'Downloading DOCX file...'
  );

  let tempDocxPath: string | null = null;

  try {
    // Download DOCX from Supabase Storage
    logger.info('Downloading DOCX from storage', {
      context: { docxPath },
    });

    const { data: docxBlob, error: downloadError } = await supabase.storage
      .from('recordings')
      .download(docxPath);

    if (downloadError || !docxBlob) {
      throw new Error(
        `Failed to download DOCX: ${downloadError?.message || 'Unknown error'}`
      );
    }

    // Save DOCX to temp file
    tempDocxPath = join(tmpdir(), `${randomUUID()}.docx`);
    const buffer = await docxBlob.arrayBuffer();
    await writeFile(tempDocxPath, Buffer.from(buffer));

    logger.info('DOCX saved to temp file', {
      context: { tempDocxPath, sizeBytes: buffer.byteLength },
    });

    progressCallback?.(25, 'Extracting text from DOCX...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      25,
      'Extracting text from Word document...'
    );

    // Extract text using mammoth
    const result = await mammoth.extractRawText({
      path: tempDocxPath,
    });

    const extractedText = result.value;
    const warnings = result.messages;

    logger.info('DOCX text extracted', {
      context: {
        textLength: extractedText.length,
        warningCount: warnings.length,
        hasText: extractedText.length > 0,
      },
    });

    // Log warnings if any
    if (warnings.length > 0) {
      logger.warn('Mammoth extraction warnings', {
        context: { warnings: warnings.map(w => w.message) },
      });
    }

    // Check if document is empty
    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error(
        'DOCX document appears to be empty or contains no extractable text.'
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
        recording_id: recordingId,
        text: cleanedText,
        language: 'en', // Default to English, could be detected
        words_json: {
          extractedLength: extractedText.length,
          cleanedLength: cleanedText.length,
          wasTruncated,
          warningCount: warnings.length,
          extractionMethod: 'mammoth',
        },
        provider: 'mammoth',
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
      .from('recordings')
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

    progressCallback?.(100, 'DOCX text extraction complete');
    streamingManager.sendProgress(
      recordingId,
      'all',
      100,
      'DOCX text extraction complete'
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'docx.extracted',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        textLength: cleanedText.length,
        orgId,
      },
    });

  } catch (error) {
    logger.error('DOCX text extraction failed', {
      context: { recordingId, docxPath },
      error: error as Error,
    });

    streamingManager.sendError(
      recordingId,
      `DOCX text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Update recording status to error
    await supabase
      .from('recordings')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'DOCX text extraction failed',
        metadata: {
          error: error instanceof Error ? error.message : 'DOCX text extraction failed',
          errorType: 'docx_extraction',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempDocxPath) {
      try {
        await unlink(tempDocxPath);
        logger.info('Cleaned up temp DOCX file');
      } catch (err) {
        logger.error('Failed to delete temp DOCX file', {
          error: err as Error,
        });
      }
    }
  }
}
