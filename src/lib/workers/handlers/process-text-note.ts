/**
 * Process Text Note Handler
 *
 * Processes user-created text notes. This is a lightweight handler that validates
 * and prepares text content for document generation and embedding.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

interface ProcessTextNotePayload {
  recordingId: string;
  orgId: string;
  transcriptId?: string; // Optional: if transcript already exists
}

const MIN_TEXT_LENGTH = 10; // Minimum characters for a valid note
const MAX_TEXT_LENGTH = 500000; // Maximum characters to process

/**
 * Process text note and prepare for document generation
 */
export async function handleProcessTextNote(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as ProcessTextNotePayload;
  const { recordingId, orgId, transcriptId } = payload;

  const logger = createLogger({ service: 'process-text-note' });

  logger.info('Starting text note processing', {
    context: {
      recordingId,
      orgId,
      transcriptId,
      jobId: job.id,
    },
  });

  const supabase = createAdminClient();

  progressCallback?.(10, 'Loading text note...');
  streamingManager.sendProgress(
    recordingId,
    'all',
    10,
    'Loading text note...'
  );

  try {
    // If transcriptId is provided, fetch existing transcript
    // Otherwise, check if transcript was already created
    let transcript: any = null;

    if (transcriptId) {
      const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch transcript: ${error.message}`);
      }
      transcript = data;
    } else {
      // Check if transcript exists for this recording
      const { data, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('content_id', recordingId)
        .maybeSingle();

      if (!error && data) {
        transcript = data;
      }
    }

    // If no transcript exists, this is an error
    if (!transcript) {
      throw new Error(
        'No transcript found for text note. Text content should be created before processing.'
      );
    }

    logger.info('Transcript loaded', {
      context: {
        transcriptId: transcript.id,
        textLength: transcript.text.length,
      },
    });

    progressCallback?.(30, 'Validating text content...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      30,
      'Validating text content...'
    );

    // Validate text length
    const textContent = transcript.text || '';
    if (textContent.trim().length < MIN_TEXT_LENGTH) {
      throw new Error(
        `Text note is too short. Minimum ${MIN_TEXT_LENGTH} characters required.`
      );
    }

    if (textContent.length > MAX_TEXT_LENGTH) {
      logger.warn('Text note exceeds maximum length, will be truncated', {
        context: {
          originalLength: textContent.length,
          maxLength: MAX_TEXT_LENGTH,
        },
      });
    }

    progressCallback?.(50, 'Cleaning and normalizing text...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      50,
      'Cleaning and normalizing text...'
    );

    // Clean and normalize text
    let cleanedText = textContent
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]+/g, ' ') // Normalize whitespace
      .trim();

    // Truncate if necessary
    let wasTruncated = false;
    if (cleanedText.length > MAX_TEXT_LENGTH) {
      cleanedText = cleanedText.substring(0, MAX_TEXT_LENGTH);
      wasTruncated = true;
    }

    // Update transcript if text was cleaned/truncated
    if (cleanedText !== textContent || wasTruncated) {
      const { error: updateError } = await supabase
        .from('transcripts')
        .update({
          text: cleanedText,
          words_json: {
            ...(transcript.words_json as any),
            originalLength: textContent.length,
            cleanedLength: cleanedText.length,
            wasTruncated,
            processedAt: new Date().toISOString(),
          },
        })
        .eq('id', transcript.id);

      if (updateError) {
        logger.error('Failed to update transcript', {
          error: updateError,
        });
        // Non-fatal, continue processing
      }
    }

    progressCallback?.(70, 'Text validation complete...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      70,
      'Text validation complete...'
    );

    // Update recording status
    await supabase
      .from('content')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

    progressCallback?.(85, 'Queuing document generation...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      85,
      'Queuing document generation...'
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

    progressCallback?.(100, 'Text note processing complete');
    streamingManager.sendProgress(
      recordingId,
      'all',
      100,
      'Text note processing complete'
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'text_note.processed',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        textLength: cleanedText.length,
        orgId,
      },
    });

  } catch (error) {
    logger.error('Text note processing failed', {
      context: { recordingId, transcriptId },
      error: error as Error,
    });

    streamingManager.sendError(
      recordingId,
      `Text note processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Update recording status to error
    await supabase
      .from('content')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Text note processing failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Text note processing failed',
          errorType: 'text_note_processing',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  }
}
