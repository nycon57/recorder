/**
 * Document Generation Handler (Google Gemini)
 *
 * Uses Google Gemini to convert transcripts into well-structured, readable documents.
 */

import { googleAI, PROMPTS, GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import { streamDocumentGeneration, isStreamingAvailable, sendCompletionNotification } from '@/lib/services/llm-streaming-helper';

type Job = Database['public']['Tables']['jobs']['Row'];

interface DocifyPayload {
  recordingId: string;
  transcriptId: string;
  orgId: string;
}

/**
 * Generate document from transcript using Google Gemini
 */
export async function generateDocument(job: Job): Promise<void> {
  const payload = job.payload as unknown as DocifyPayload;
  const { recordingId, transcriptId, orgId } = payload;

  const logger = createLogger({ service: 'docify-google' });

  // Check if streaming is available for this recording
  const isStreaming = isStreamingAvailable(recordingId);

  logger.info('Starting document generation', {
    context: {
      recordingId,
      transcriptId,
      orgId,
      jobId: job.id,
      streamingEnabled: isStreaming,
    },
  });

  const startTime = Date.now();

  const supabase = createAdminClient();

  // Check if document already exists (idempotency check)
  const { data: existingDocument } = await supabase
    .from('documents')
    .select('id, recording_id')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (existingDocument) {
    logger.info('Document already exists, skipping generation', {
      context: {
        documentId: existingDocument.id,
        recordingId,
      },
    });

    // Ensure recording status is correct
    await supabase
      .from('recordings')
      .update({ status: 'completed' })
      .eq('id', recordingId);

    // Enqueue embedding generation job (in case pipeline was interrupted)
    const { data: existingEmbJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('type', 'generate_embeddings')
      .eq('dedupe_key', `generate_embeddings:${recordingId}`)
      .maybeSingle();

    if (!existingEmbJob) {
      await supabase.from('jobs').insert({
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId,
          documentId: existingDocument.id,
          orgId,
        },
        dedupe_key: `generate_embeddings:${recordingId}`,
      });
      console.log(
        `[Docify] Enqueued embedding generation job for existing document`
      );
    }

    return;
  }

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'doc_generating' })
    .eq('id', recordingId);

  try {
    // Fetch transcript with visual events
    const { data: transcript, error: transcriptError} = await supabase
      .from('transcripts')
      .select('text, language, words_json, visual_events, video_metadata, provider')
      .eq('id', transcriptId)
      .single();

    if (transcriptError || !transcript) {
      throw new Error(`Failed to fetch transcript: ${transcriptError?.message || 'Not found'}`);
    }

    const hasVisualContext = transcript.visual_events && (transcript.visual_events as any[]).length > 0;
    const visualEventsCount = hasVisualContext ? (transcript.visual_events as any[]).length : 0;

    logger.info('Loaded transcript', {
      context: {
        textLength: transcript.text.length,
        hasVisualContext,
        visualEventsCount,
        provider: transcript.provider,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 10, 'Loading transcript and metadata...');
    }

    // Fetch recording metadata for context
    const { data: recording } = await supabase
      .from('recordings')
      .select('title, metadata')
      .eq('id', recordingId)
      .single();

    const title = recording?.title || 'Untitled Recording';
    const metadata = (recording?.metadata || {}) as Record<string, any>;

    // Extract duration from words_json
    const wordsData = (transcript.words_json || {}) as Record<string, any>;
    const durationSeconds = wordsData.duration || 0;

    // Build context for Gemini
    const contextInfo = [
      `Title: ${title}`,
      `Duration: ${Math.round(durationSeconds / 60)} minutes`,
      metadata.description ? `Description: ${metadata.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Format visual events if available
    let visualContext = '';
    if (hasVisualContext) {
      const visualEvents = transcript.visual_events as any[];
      visualContext = '\n\nVISUAL EVENTS (what happened on screen):\n' +
        visualEvents
          .map((event: any, index: number) => {
            const parts = [
              `${index + 1}. [${event.timestamp}]`,
              event.type ? `(${event.type})` : '',
              event.target ? event.target : '',
              event.location ? `at ${event.location}` : '',
              `-`,
              event.description,
            ].filter(Boolean);
            return parts.join(' ');
          })
          .join('\n');
    }

    // Enhanced prompt for video recordings with visual context
    const enhancedPrompt = hasVisualContext
      ? `${PROMPTS.DOCIFY}

**IMPORTANT:** This is a screen recording tutorial with both audio narration and visual actions.
Create a step-by-step guide that combines WHAT is being said (audio) with WHAT is happening on screen (visual).

For each step:
- Describe the SPECIFIC button/field/element being clicked or typed into
- Include the LOCATION of UI elements (e.g., "top right corner", "sidebar menu")
- Use the actual button text and UI labels from the visual events
- Make it clear WHERE to look and WHAT to click

Example format:
**Step 1: Open Settings**
Click the gear icon in the top right corner to open the Settings panel. Then select "Advanced Options" from the dropdown menu.

${contextInfo}

AUDIO TRANSCRIPT:
${transcript.text}
${visualContext}`
      : `${PROMPTS.DOCIFY}\n\n${contextInfo}\n\nTranscript:\n${transcript.text}`;

    // Call Gemini to generate document
    logger.info('Calling Google Gemini for document generation', {
      context: {
        model: GOOGLE_CONFIG.DOCIFY_MODEL,
        hasVisualContext,
        promptLength: enhancedPrompt.length,
        temperature: GOOGLE_CONFIG.DOCIFY_TEMPERATURE,
        maxTokens: GOOGLE_CONFIG.DOCIFY_MAX_TOKENS,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 30, 'Generating document with Gemini AI...');
    }

    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
    });

    // Use streaming helper for document generation
    const streamingResult = await streamDocumentGeneration(
      model,
      enhancedPrompt,
      {
        recordingId,
        chunkBufferSize: 200,
        chunkDelayMs: 100,
        punctuationChunking: true,
        progressUpdateInterval: 5,
      }
    );

    const generatedContent = streamingResult.fullText;

    if (!generatedContent) {
      throw new Error('Gemini returned empty response');
    }

    logger.info('Generated document successfully', {
      context: {
        contentLength: generatedContent.length,
        contentPreview: generatedContent.substring(0, 200),
        chunkCount: streamingResult.chunkCount,
        streamedToClient: streamingResult.streamedToClient,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 85, 'Document generated, saving to database...');
    }

    // Save document to database

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        recording_id: recordingId,
        org_id: orgId,
        markdown: generatedContent,
        version: 'v1',
        model: GOOGLE_CONFIG.DOCIFY_MODEL,
        status: 'generated',
      })
      .select()
      .single();

    if (documentError) {
      logger.error('Failed to save document', {
        error: documentError,
      });
      throw new Error(`Failed to save document: ${documentError.message}`);
    }

    logger.info('Document saved successfully', {
      context: {
        documentId: document.id,
        recordingId,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 90, 'Document saved, starting embedding generation...');
    }

    // Update recording status
    await supabase
      .from('recordings')
      .update({ status: 'completed' })
      .eq('id', recordingId);

    // Enqueue embedding generation job
    await supabase.from('jobs').insert({
      type: 'generate_embeddings',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId,
        documentId: document.id,
        orgId,
      },
      dedupe_key: `generate_embeddings:${recordingId}`,
    });

    logger.info('Enqueued embedding generation', {
      context: {
        recordingId,
        documentId: document.id,
      },
    });

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'document.generated',
      payload: {
        recordingId,
        documentId: document.id,
        orgId,
      },
    });

    const totalTime = Date.now() - startTime;
    logger.info('Document generation completed', {
      context: {
        recordingId,
        documentId: document.id,
        hasVisualContext,
        model: GOOGLE_CONFIG.DOCIFY_MODEL,
        totalTime,
      },
    });

    if (isStreaming) {
      sendCompletionNotification(recordingId, 'Document generation', totalTime);
      streamingManager.sendComplete(recordingId, `Document generation complete in ${Math.round(totalTime / 1000)}s`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Document generation failed';

    logger.error('Document generation failed', {
      context: {
        recordingId,
        transcriptId,
        orgId,
        jobId: job.id,
      },
      error: error as Error,
    });

    if (isStreaming) {
      streamingManager.sendError(recordingId, errorMessage);
    }

    // Update recording status to error
    await supabase
      .from('recordings')
      .update({
        status: 'error',
        metadata: {
          error: errorMessage,
          errorType: 'document_generation',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  }
}
