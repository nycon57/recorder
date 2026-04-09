/**
 * LLM Streaming Helper
 *
 * Provides utilities for streaming responses from Google Gemini API
 * with proper buffering, error handling, and progress tracking.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

import { streamingManager } from '@/lib/services/streaming-processor';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'llm-streaming' });

export interface StreamingConfig {
  recordingId: string;
  chunkBufferSize?: number; // Characters to buffer before sending
  chunkDelayMs?: number; // Minimum delay between chunks
  punctuationChunking?: boolean; // Chunk on sentence boundaries
  progressUpdateInterval?: number; // Progress updates every N chunks
}

export interface StreamingResult {
  fullText: string;
  chunkCount: number;
  totalTime: number;
  streamedToClient: boolean;
}

/**
 * Buffer manager for streaming chunks
 * Handles intelligent chunking based on content and timing
 */
class ChunkBuffer {
  private buffer: string = '';
  private lastFlushTime: number = 0;
  private chunkCount: number = 0;

  constructor(
    private readonly config: StreamingConfig,
    private readonly onFlush: (chunk: string, chunkNumber: number) => void
  ) {}

  /**
   * Add text to buffer and flush if conditions are met
   */
  append(text: string): void {
    this.buffer += text;

    const shouldFlush = this.shouldFlush();
    if (shouldFlush) {
      this.flush();
    }
  }

  /**
   * Determine if buffer should be flushed
   */
  private shouldFlush(): boolean {
    const bufferSize = this.buffer.length;
    const timeSinceLastFlush = Date.now() - this.lastFlushTime;

    // Always flush if buffer is large
    if (bufferSize >= (this.config.chunkBufferSize || 200)) {
      return true;
    }

    // Flush on sentence boundaries if enabled
    if (this.config.punctuationChunking && this.buffer.match(/[.!?]\s*$/)) {
      return true;
    }

    // Flush if enough time has passed and we have content
    if (bufferSize > 0 && timeSinceLastFlush >= (this.config.chunkDelayMs || 100)) {
      return true;
    }

    return false;
  }

  /**
   * Flush buffer contents
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    this.chunkCount++;
    this.onFlush(this.buffer, this.chunkCount);
    this.buffer = '';
    this.lastFlushTime = Date.now();
  }

  /**
   * Force flush any remaining content
   */
  forceFlush(): void {
    if (this.buffer.length > 0) {
      this.flush();
    }
  }

  getChunkCount(): number {
    return this.chunkCount;
  }
}

/**
 * Video source for transcription - either inline base64 or File API reference
 */
export type VideoSource =
  | { type: 'inline'; base64: string; mimeType?: string }
  | { type: 'fileApi'; fileUri: string; mimeType: string };

/**
 * Stream transcription with Gemini (video understanding)
 * Supports both inline base64 (for files <20MB) and File API (for files >20MB)
 */
export async function streamTranscription(
  model: GenerativeModel,
  videoSource: string | VideoSource,
  prompt: string,
  config: StreamingConfig
): Promise<StreamingResult> {
  const startTime = Date.now();
  let fullText = '';
  let streamedToClient = false;

  // Normalize video source - support legacy string format (base64) for backwards compatibility
  const normalizedSource: VideoSource =
    typeof videoSource === 'string'
      ? { type: 'inline', base64: videoSource }
      : videoSource;

  // Check if client is connected
  const isConnected = streamingManager.isConnected(config.recordingId);

  logger.info('Starting transcription streaming', {
    context: {
      recordingId: config.recordingId,
      isConnected,
      modelName: model.model,
      videoSourceType: normalizedSource.type,
    },
  });

  try {
    // Build the content parts based on source type
    const contentParts: any[] = [];

    if (normalizedSource.type === 'inline') {
      // Inline base64 for files <20MB
      contentParts.push({
        inlineData: {
          mimeType: normalizedSource.mimeType || 'video/webm',
          data: normalizedSource.base64,
        },
      });
    } else {
      // File API reference for files >20MB
      contentParts.push({
        fileData: {
          fileUri: normalizedSource.fileUri,
          mimeType: normalizedSource.mimeType,
        },
      });
    }

    contentParts.push({ text: prompt });

    // Note: Gemini video understanding doesn't support true streaming
    // We'll simulate streaming by processing the response in chunks
    const result = await model.generateContent(contentParts);

    const responseText = result.response.text();
    fullText = responseText;

    // If client is connected, simulate streaming by sending chunks
    if (isConnected) {
      streamedToClient = true;

      // Parse the JSON response and extract transcript segments
      try {
        const jsonText = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const parsedResponse = JSON.parse(jsonText);
        const audioTranscript = parsedResponse.audioTranscript || [];

        // Stream each audio segment with timing
        for (let i = 0; i < audioTranscript.length; i++) {
          const segment = audioTranscript[i];
          const progress = Math.round((i / audioTranscript.length) * 100);

          // Send transcript chunk
          streamingManager.sendTranscriptChunk(
            config.recordingId,
            segment.text,
            {
              timestamp: segment.timestamp,
              speaker: segment.speaker,
              segmentIndex: i,
              totalSegments: audioTranscript.length,
            }
          );

          // Update progress periodically
          if (i % 5 === 0) {
            streamingManager.sendProgress(
              config.recordingId,
              'transcribe',
              progress,
              `Processing segment ${i + 1} of ${audioTranscript.length}`
            );
          }

          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send visual events summary if available
        const visualEvents = parsedResponse.visualEvents || [];
        if (visualEvents.length > 0) {
          streamingManager.sendLog(
            config.recordingId,
            `Detected ${visualEvents.length} visual events`,
            { visualEventsCount: visualEvents.length }
          );
        }

      } catch (parseError) {
        logger.warn('Failed to parse response for streaming, falling back to raw text', {
          context: { recordingId: config.recordingId },
          error: parseError as Error,
        });

        // Fallback: stream raw text in chunks
        const chunkSize = 500;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.slice(i, Math.min(i + chunkSize, fullText.length));
          streamingManager.sendTranscriptChunk(config.recordingId, chunk);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const totalTime = Date.now() - startTime;

    logger.info('Transcription streaming completed', {
      context: {
        recordingId: config.recordingId,
        totalTime,
        responseLength: fullText.length,
        streamedToClient,
      },
    });

    return {
      fullText,
      chunkCount: 1, // Video transcription returns full response
      totalTime,
      streamedToClient,
    };

  } catch (error) {
    logger.error('Transcription streaming failed', {
      context: { recordingId: config.recordingId },
      error: error as Error,
    });

    // Send error to client if connected
    if (isConnected) {
      streamingManager.sendError(
        config.recordingId,
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    throw error;
  }
}

/**
 * Stream document generation with Gemini
 */
export async function streamDocumentGeneration(
  model: GenerativeModel,
  prompt: string,
  config: StreamingConfig
): Promise<StreamingResult> {
  const startTime = Date.now();
  let fullText = '';
  let streamedToClient = false;

  // Check if client is connected
  const isConnected = streamingManager.isConnected(config.recordingId);

  logger.info('Starting document generation streaming', {
    context: {
      recordingId: config.recordingId,
      isConnected,
      modelName: model.model,
    },
  });

  // Set up chunk buffer
  const buffer = new ChunkBuffer(config, (chunk, chunkNumber) => {
    if (isConnected) {
      streamingManager.sendDocumentChunk(config.recordingId, chunk, {
        chunkNumber,
        chunkLength: chunk.length,
      });

      // Send progress updates periodically
      if (chunkNumber % (config.progressUpdateInterval || 5) === 0) {
        const estimatedProgress = Math.min(30 + (chunkNumber * 2), 80);
        streamingManager.sendProgress(
          config.recordingId,
          'document',
          estimatedProgress,
          `Generating document... (${fullText.length} characters)`
        );
      }
    }
  });

  try {
    // Use streaming API for real-time updates
    const streamingResult = await model.generateContentStream({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    streamedToClient = isConnected;

    // Process streaming chunks
    for await (const chunk of streamingResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullText += chunkText;

        if (isConnected) {
          buffer.append(chunkText);
        }
      }
    }

    // Flush any remaining buffered content
    buffer.forceFlush();

    const totalTime = Date.now() - startTime;
    const chunkCount = buffer.getChunkCount();

    logger.info('Document generation streaming completed', {
      context: {
        recordingId: config.recordingId,
        totalTime,
        fullTextLength: fullText.length,
        chunkCount,
        streamedToClient,
      },
    });

    return {
      fullText,
      chunkCount,
      totalTime,
      streamedToClient,
    };

  } catch (streamError) {
    logger.warn('Streaming failed, falling back to standard generation', {
      context: { recordingId: config.recordingId },
      error: streamError as Error,
    });

    // Fallback to non-streaming generation
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      fullText = result.response.text();

      // If client is connected, send the full response in chunks
      if (isConnected) {
        const chunkSize = 500;
        for (let i = 0; i < fullText.length; i += chunkSize) {
          const chunk = fullText.slice(i, Math.min(i + chunkSize, fullText.length));
          streamingManager.sendDocumentChunk(config.recordingId, chunk);

          const progress = Math.round((i / fullText.length) * 100);
          if (i % (chunkSize * 3) === 0) {
            streamingManager.sendProgress(
              config.recordingId,
              'document',
              progress,
              'Generating document...'
            );
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }
        streamedToClient = true;
      }

      const totalTime = Date.now() - startTime;

      return {
        fullText,
        chunkCount: Math.ceil(fullText.length / 500),
        totalTime,
        streamedToClient,
      };

    } catch (fallbackError) {
      logger.error('Fallback generation also failed', {
        context: { recordingId: config.recordingId },
        error: fallbackError as Error,
      });

      // Send error to client if connected
      if (isConnected) {
        streamingManager.sendError(
          config.recordingId,
          `Document generation failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
      }

      throw fallbackError;
    }
  }
}

/**
 * Send embedding progress updates
 */
export function sendEmbeddingProgress(
  recordingId: string,
  currentChunk: number,
  totalChunks: number,
  message?: string
): void {
  const isConnected = streamingManager.isConnected(recordingId);
  if (!isConnected) {
    return;
  }

  const progress = Math.round((currentChunk / totalChunks) * 100);
  const defaultMessage = `Processing chunk ${currentChunk} of ${totalChunks}`;

  streamingManager.sendProgress(
    recordingId,
    'embeddings',
    progress,
    message || defaultMessage,
    {
      currentChunk,
      totalChunks,
    }
  );
}

/**
 * Check if streaming is available for a recording
 */
export function isStreamingAvailable(recordingId: string): boolean {
  return streamingManager.isConnected(recordingId);
}

/**
 * Send completion notification
 */
export function sendCompletionNotification(
  recordingId: string,
  step: string,
  duration: number
): void {
  const isConnected = streamingManager.isConnected(recordingId);
  if (!isConnected) {
    return;
  }

  const message = `${step} completed in ${Math.round(duration / 1000)}s`;
  streamingManager.sendLog(recordingId, message, {
    step,
    duration,
  });
}