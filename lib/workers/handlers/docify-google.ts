/**
 * Document Generation Handler (Google Gemini)
 *
 * Uses Google Gemini to convert transcripts into well-structured, readable documents.
 * PERF-AI-006: Includes OpenAI fallback for API failures.
 */

import { googleAI, PROMPTS, GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import { streamDocumentGeneration, isStreamingAvailable, sendCompletionNotification } from '@/lib/services/llm-streaming-helper';
import { detectContentType, getInsightsPrompt, SCREEN_RECORDING_ENHANCEMENT } from '@/lib/prompts/insights-prompts';
import OpenAI from 'openai';

// PERF-AI-006: Lazy-initialized OpenAI client for fallback
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured for fallback');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * PERF-AI-006: Check if a Gemini error is recoverable via fallback
 */
function isRecoverableGeminiError(error: any): boolean {
  const errorMessage = error?.message || String(error);
  return (
    errorMessage.includes('503') ||
    errorMessage.includes('overloaded') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('quota') ||
    error?.status === 503 ||
    error?.status === 429
  );
}

/**
 * PERF-AI-006: Generate document using OpenAI as fallback
 */
async function generateDocumentWithOpenAIFallback(
  prompt: string,
  logger: ReturnType<typeof createLogger>
): Promise<{ content: string; provider: 'openai' }> {
  logger.info('Falling back to OpenAI GPT-4o-mini for document generation');

  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional document writer that creates clear, well-structured documents from transcripts. Follow the user\'s formatting instructions exactly.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty response');
  }

  logger.info('OpenAI fallback document generation successful', {
    context: {
      model: 'gpt-4o-mini',
      contentLength: content.length,
    },
  });

  return { content, provider: 'openai' };
}

type Job = Database['public']['Tables']['jobs']['Row'];

interface DocifyPayload {
  recordingId: string;
  transcriptId: string;
  orgId: string;
}

/**
 * Generate document from transcript using Google Gemini
 */
export async function generateDocument(job: Job, progressCallback?: (percent: number, message: string, data?: any) => void): Promise<void> {
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

    // Send progress via callback AND streaming (if available)
    progressCallback?.(10, 'Loading transcript and metadata...');
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

    // Detect content type for specialized prompt
    logger.info('Detecting content type for specialized insights', {
      context: { transcriptLength: transcript.text.length },
    });

    progressCallback?.(20, 'Analyzing content type...');
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 20, 'Analyzing content type...');
    }

    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
    });

    const contentType = await detectContentType(transcript.text, model);

    logger.info('Content type detected', {
      context: { contentType, hasVisualContext },
    });

    progressCallback?.(25, `Generating ${contentType.replace('_', ' ')} insights...`);
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 25, `Generating ${contentType.replace('_', ' ')} insights...`);
    }

    // Get content-type-specific prompt
    const basePrompt = getInsightsPrompt(contentType);

    // Build the full prompt with context
    let enhancedPrompt = `${basePrompt}\n\n${contextInfo}\n\n`;

    // Add screen recording enhancement if visual context is available
    if (hasVisualContext) {
      enhancedPrompt += `${SCREEN_RECORDING_ENHANCEMENT}\n\n`;
      enhancedPrompt += `AUDIO TRANSCRIPT:\n${transcript.text}\n${visualContext}`;
    } else {
      enhancedPrompt += `Content to analyze:\n${transcript.text}`;
    }

    // Call Gemini to generate document
    logger.info('Calling Google Gemini for document generation', {
      context: {
        model: GOOGLE_CONFIG.DOCIFY_MODEL,
        contentType,
        hasVisualContext,
        promptLength: enhancedPrompt.length,
        temperature: GOOGLE_CONFIG.DOCIFY_TEMPERATURE,
        maxTokens: GOOGLE_CONFIG.DOCIFY_MAX_TOKENS,
      },
    });

    progressCallback?.(30, 'Preparing prompt for AI analysis...');
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 30, 'Preparing prompt for AI analysis...');
    }

    // Brief delay to show the "preparing" message
    await new Promise(resolve => setTimeout(resolve, 100));

    progressCallback?.(35, 'Calling Gemini AI (this may take 15-30 seconds)...');
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 35, 'Calling Gemini AI (this may take 15-30 seconds)...');
    }

    // PERF-AI-006: Track which provider was used
    let generatedContent: string;
    let docProvider: 'gemini' | 'openai' = 'gemini';
    let modelUsed: string = GOOGLE_CONFIG.DOCIFY_MODEL;
    let chunkCount = 0;
    let streamedToClient = false;

    try {
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

      generatedContent = streamingResult.fullText;
      chunkCount = streamingResult.chunkCount;
      streamedToClient = streamingResult.streamedToClient;

      if (!generatedContent) {
        throw new Error('Gemini returned empty response');
      }
    } catch (geminiError: any) {
      // PERF-AI-006: Attempt fallback on recoverable errors
      if (isRecoverableGeminiError(geminiError) && process.env.OPENAI_API_KEY) {
        logger.warn('Gemini document generation failed, attempting OpenAI fallback', {
          context: {
            recordingId,
            error: geminiError.message || String(geminiError),
          },
        });

        progressCallback?.(40, 'Gemini unavailable, using OpenAI fallback...');
        if (isStreaming) {
          streamingManager.sendProgress(recordingId, 'document', 40, 'Gemini unavailable, using OpenAI fallback...');
        }

        const fallbackResult = await generateDocumentWithOpenAIFallback(enhancedPrompt, logger);
        generatedContent = fallbackResult.content;
        docProvider = 'openai';
        modelUsed = 'gpt-4o-mini';
      } else {
        // Non-recoverable error or no fallback configured
        throw geminiError;
      }
    }

    logger.info('Generated document successfully', {
      context: {
        provider: docProvider,
        model: modelUsed,
        contentLength: generatedContent.length,
        contentPreview: generatedContent.substring(0, 200),
        chunkCount,
        streamedToClient,
      },
    });

    progressCallback?.(80, 'AI response received, processing output...');
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 80, 'AI response received, processing output...');
    }

    // Brief delay to show processing message
    await new Promise(resolve => setTimeout(resolve, 100));

    progressCallback?.(85, 'Saving document to database...');
    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'document', 85, 'Saving document to database...');
    }

    // Save document to database

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        recording_id: recordingId,
        org_id: orgId,
        markdown: generatedContent,
        version: 'v2', // v2 indicates new insights-based generation
        model: modelUsed, // PERF-AI-006: Use actual model (Gemini or OpenAI)
        status: 'generated',
        metadata: {
          content_type: contentType,
          has_visual_context: hasVisualContext,
          generation_method: 'insights',
          doc_provider: docProvider, // PERF-AI-006: Track provider
        },
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

    progressCallback?.(90, 'Document saved, starting embedding generation...');
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
        contentType,
        hasVisualContext,
        model: modelUsed, // PERF-AI-006: Actual model used
        provider: docProvider, // PERF-AI-006: Track provider
        generationMethod: 'insights',
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
