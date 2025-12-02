/**
 * Video Transcription Handler (Gemini Video Understanding)
 *
 * Downloads recording from Supabase Storage, sends to Gemini 2.5 Flash for
 * multimodal analysis (audio + visual), and stores transcript with visual events.
 *
 * PERF-AI-006: Includes automatic fallback to OpenAI Whisper if Gemini fails.
 */

import { createReadStream, createWriteStream } from 'fs';
import { readFile, unlink, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import OpenAI from 'openai';

import type { Database } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAI, getFileManager, FileState, GOOGLE_CONFIG } from '@/lib/google/client';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import { streamTranscription, isStreamingAvailable, sendCompletionNotification, type VideoSource } from '@/lib/services/llm-streaming-helper';

// Size threshold for using Gemini File API vs inline base64
const FILE_API_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Sleep helper for polling file processing status
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// PERF-AI-006: Lazy-initialized OpenAI client for fallback transcription
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
 * PERF-AI-006: Check if error is recoverable (should fall back to Whisper)
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

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribePayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
}

interface VisualEvent {
  timestamp: string; // "MM:SS" format
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string; // UI element name
  location?: string; // e.g., "top right", "menu bar"
  description: string; // Full description of the visual event
  confidence?: number; // Optional confidence score
}

interface AudioSegment {
  timestamp: string; // "MM:SS" format
  startTime: number; // Seconds
  endTime: number; // Seconds
  speaker?: string; // "narrator" | "system" | etc.
  text: string;
}

interface GeminiVideoResponse {
  audioTranscript: AudioSegment[];
  visualEvents: VisualEvent[];
  combinedNarrative: string;
  duration: number; // Total duration in seconds
  keyMoments?: Array<{
    timestamp: string;
    description: string;
  }>;
}

/**
 * PERF-AI-006: Fallback transcription using OpenAI Whisper
 * Used when Gemini is unavailable (503, rate limits, quota exhausted)
 * Note: Returns audio-only transcription (no visual events)
 */
async function transcribeWithWhisperFallback(
  tempFilePath: string,
  logger: ReturnType<typeof createLogger>
): Promise<GeminiVideoResponse> {
  logger.info('Using Whisper fallback for transcription');

  const openai = getOpenAIClient();

  // Call Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(tempFilePath) as any,
    model: 'whisper-1',
    language: 'en',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });

  // Convert Whisper response to GeminiVideoResponse format
  const segments = (transcription as any).segments || [];
  const audioTranscript: AudioSegment[] = segments.map((seg: any, index: number) => ({
    timestamp: formatTimestamp(seg.start),
    startTime: seg.start,
    endTime: seg.end,
    speaker: 'narrator',
    text: seg.text.trim(),
  }));

  const fullText = (transcription as any).text || audioTranscript.map(s => s.text).join(' ');
  const duration = (transcription as any).duration || (segments.length > 0 ? segments[segments.length - 1].end : 0);

  logger.info('Whisper fallback completed', {
    context: {
      segmentCount: audioTranscript.length,
      duration,
      textLength: fullText.length,
    },
  });

  return {
    audioTranscript,
    visualEvents: [], // Whisper doesn't provide visual events
    combinedNarrative: `[Transcribed via Whisper fallback - no visual events available]\n\n${fullText}`,
    duration,
    keyMoments: [], // No key moments from Whisper
  };
}

/**
 * Format seconds to MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Transcribe a video recording using Gemini video understanding
 */
export async function transcribeRecording(job: Job): Promise<void> {
  const payload = job.payload as unknown as TranscribePayload;
  const { recordingId, orgId, storagePath } = payload;

  const logger = createLogger({ service: 'transcribe-gemini' });

  // Check if streaming is available for this recording
  const isStreaming = isStreamingAvailable(recordingId);

  logger.info('Starting video transcription', {
    context: {
      recordingId,
      orgId,
      storagePath,
      jobId: job.id,
      streamingEnabled: isStreaming,
    },
  });

  const supabase = createAdminClient();

  // Check if transcript already exists (idempotency check)
  const { data: existingTranscript } = await supabase
    .from('transcripts')
    .select('id, content_id')
    .eq('content_id', recordingId)
    .single();

  if (existingTranscript) {
    logger.info('Transcript already exists, skipping transcription', {
      context: {
        recordingId,
        transcriptId: existingTranscript.id,
      },
    });

    // Ensure recording status is correct
    await supabase
      .from('content')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

    // Enqueue document generation job (in case pipeline was interrupted)
    const { data: existingDocJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('type', 'doc_generate')
      .eq('dedupe_key', `doc_generate:${recordingId}`)
      .maybeSingle();

    if (!existingDocJob) {
      await supabase.from('jobs').insert({
        type: 'doc_generate',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId: existingTranscript.id,
          orgId,
        },
        dedupe_key: `doc_generate:${recordingId}`,
      });
      console.log(
        `[Transcribe-Video] Enqueued document generation job for existing transcript`
      );
    }

    return;
  }

  // Update recording status
  await supabase
    .from('content')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  let tempFilePath: string | null = null;

  try {
    // Download video from Supabase Storage using streaming to reduce memory usage
    logger.info('Downloading video from storage', {
      context: { storagePath },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 10, 'Downloading video from storage...');
    }

    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('content')
      .download(storagePath);

    if (downloadError || !videoBlob) {
      throw new Error(
        `Failed to download video: ${downloadError?.message || 'Unknown error'}`
      );
    }

    // Get file size
    const fileSize = videoBlob.size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    logger.info('Video downloaded successfully', {
      context: { fileSize, fileSizeMB },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 20, `Downloaded video (${fileSizeMB} MB)`);
    }

    // Stream video to temp file to reduce memory pressure
    // This avoids holding the entire file in memory as arrayBuffer
    tempFilePath = join(tmpdir(), `${randomUUID()}.webm`);

    // Use streaming to write blob to file
    const blobStream = videoBlob.stream();
    const writeStream = createWriteStream(tempFilePath);
    await pipeline(Readable.fromWeb(blobStream as any), writeStream);

    // Verify file was written correctly
    const tempFileStats = await stat(tempFilePath);

    logger.info('Saved to temp file via streaming', {
      context: {
        tempFilePath,
        fileSize: tempFileStats.size,
        matchesBlob: tempFileStats.size === fileSize,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 30, 'Preparing video for analysis...');
    }

    // Determine method based on file size
    // Files >20MB must use Gemini File API, smaller files can use inline base64
    const useFileAPI = fileSize >= FILE_API_THRESHOLD_BYTES;

    logger.info('Selected Gemini upload method', {
      context: {
        method: useFileAPI ? 'File API' : 'inline',
        fileSizeMB: fileSizeMB,
        threshold: '20MB',
      },
    });

    // For File API uploads, we need to upload the file first and get a URI
    // For inline uploads, we read the file as base64
    let videoBase64: string | null = null;
    let geminiFileUri: string | null = null;
    let geminiMimeType: string | null = null;

    if (useFileAPI) {
      // Use Gemini File API for large files (>20MB)
      logger.info('Uploading video to Gemini File API', {
        context: { fileSizeMB, recordingId },
      });

      if (isStreaming) {
        streamingManager.sendProgress(recordingId, 'transcribe', 35, 'Uploading large video to Gemini...');
      }

      const fileManager = getFileManager();

      // Upload file to Gemini
      const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: 'video/webm',
        displayName: `video-${recordingId}`,
      });

      logger.info('File uploaded to Gemini, waiting for processing', {
        context: {
          fileName: uploadResult.file.name,
          state: uploadResult.file.state,
          uri: uploadResult.file.uri,
        },
      });

      // Wait for file to be processed (Gemini needs to process video before use)
      let file = uploadResult.file;
      let pollCount = 0;
      const maxPolls = 120; // 10 minutes max wait (120 * 5 seconds)

      while (file.state === FileState.PROCESSING) {
        pollCount++;
        if (pollCount > maxPolls) {
          throw new Error('Gemini file processing timeout - video may be too long or complex');
        }

        if (pollCount % 6 === 0) { // Log every 30 seconds
          logger.info('Waiting for Gemini file processing', {
            context: {
              fileName: file.name,
              pollCount,
              elapsedSeconds: pollCount * 5,
            },
          });

          if (isStreaming) {
            streamingManager.sendProgress(
              recordingId,
              'transcribe',
              35 + Math.min(pollCount / 2, 10), // Progress from 35-45%
              `Processing video in Gemini (${Math.round(pollCount * 5 / 60)}m)...`
            );
          }
        }

        await sleep(5000); // Poll every 5 seconds
        file = await fileManager.getFile(file.name);
      }

      if (file.state === FileState.FAILED) {
        throw new Error(`Gemini file processing failed: ${file.name}`);
      }

      geminiFileUri = file.uri;
      geminiMimeType = file.mimeType;

      logger.info('Gemini file processing complete', {
        context: {
          fileName: file.name,
          uri: geminiFileUri,
          mimeType: geminiMimeType,
          pollCount,
          processingTimeSeconds: pollCount * 5,
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(recordingId, 'transcribe', 45, 'Video ready for analysis');
      }
    } else {
      // Use inline base64 for small files (<20MB)
      const videoBytes = await readFile(tempFilePath);
      videoBase64 = videoBytes.toString('base64');

      logger.info('Prepared video for inline upload', {
        context: {
          bytesLength: videoBytes.length,
          base64Length: videoBase64.length,
        },
      });
    }

    // Call Gemini API
    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL, // gemini-2.5-flash
    });

    logger.info('Initialized Gemini model', {
      context: { model: GOOGLE_CONFIG.DOCIFY_MODEL },
    });

    // Structured prompt for video analysis
    const prompt = `Analyze this screen recording tutorial video and extract comprehensive information:

**TASK 1: AUDIO TRANSCRIPTION**
Transcribe all spoken content with precise timestamps (MM:SS format).
For each segment, provide:
- timestamp: exact time when speech starts
- text: the spoken words
- speaker: identify if multiple speakers (e.g., "narrator", "interviewer")

**TASK 2: VISUAL EVENTS**
Extract key visual actions that occur on screen:
- UI elements clicked (button text, icon description, location)
- Text typed into form fields (field name, value if visible)
- Screen/page transitions (what changed)
- Mouse movements to important areas
- Any visual elements referenced in narration
- Pop-ups, modals, notifications that appear

For each visual event, provide:
- timestamp: when it occurred (MM:SS)
- type: 'click' | 'type' | 'navigate' | 'scroll' | 'other'
- target: specific UI element name (e.g., "Settings button", "Email field")
- location: where on screen (e.g., "top right corner", "sidebar", "menu bar")
- description: full description of what happened

**TASK 3: COMBINED NARRATIVE**
Create a unified narrative that merges audio and visual, making it clear WHAT was done and WHERE/HOW.
Example: "At 00:15, the instructor says 'now we configure settings' while clicking the gear icon in the top right corner, then selecting 'Advanced Options' from the dropdown menu."

**TASK 4: KEY MOMENTS**
Identify the 3-5 most important moments in the video (major steps, critical actions).

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON matching this structure:
{
  "audioTranscript": [
    {
      "timestamp": "00:05",
      "startTime": 5.0,
      "endTime": 8.5,
      "speaker": "narrator",
      "text": "First, we open the settings panel"
    }
  ],
  "visualEvents": [
    {
      "timestamp": "00:05",
      "type": "click",
      "target": "Settings gear icon",
      "location": "top right corner",
      "description": "User clicks the gear icon to open settings"
    }
  ],
  "combinedNarrative": "Complete merged narrative here...",
  "duration": 125.5,
  "keyMoments": [
    {"timestamp": "00:05", "description": "Opening settings panel"}
  ]
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting or explanatory text.`;

    const startTime = Date.now();

    // Build video source based on upload method
    const videoSource: VideoSource = geminiFileUri
      ? { type: 'fileApi', fileUri: geminiFileUri, mimeType: geminiMimeType || 'video/webm' }
      : { type: 'inline', base64: videoBase64 || '' };

    logger.info('Sending video to Gemini for analysis', {
      context: {
        promptLength: prompt.length,
        videoSourceType: videoSource.type,
        videoDataSize: videoSource.type === 'inline' ? videoSource.base64.length : 'File API',
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 50, 'Analyzing video with Gemini AI...');
    }

    // PERF-AI-006: Track which provider was used for transcription
    let transcriptionProvider: 'gemini' | 'whisper' = 'gemini';
    let parsedResponse: GeminiVideoResponse;

    try {
      // Use streaming helper for transcription (Gemini)
      // Supports both inline base64 (<20MB) and File API (>20MB) sources
      const streamingResult = await streamTranscription(
        model,
        videoSource,
        prompt,
        {
          recordingId,
          chunkBufferSize: 500,
          chunkDelayMs: 100,
          punctuationChunking: true,
          progressUpdateInterval: 5,
        }
      );

      const responseText = streamingResult.fullText;
      const analysisTime = Date.now() - startTime;

      logger.info('Received Gemini response', {
        context: {
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 200),
          analysisTime,
          streamedToClient: streamingResult.streamedToClient,
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(recordingId, 'transcribe', 70, 'Processing Gemini response...');
      }

      // Parse JSON response (strip markdown if present)
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(jsonText);

      logger.info('Parsed Gemini response successfully', {
        context: {
          audioSegments: parsedResponse.audioTranscript.length,
          visualEvents: parsedResponse.visualEvents.length,
          keyMoments: parsedResponse.keyMoments?.length || 0,
          duration: parsedResponse.duration,
          provider: 'gemini',
        },
      });
    } catch (geminiError: any) {
      // PERF-AI-006: Check if we should fall back to Whisper
      if (isRecoverableGeminiError(geminiError) && process.env.OPENAI_API_KEY && tempFilePath) {
        logger.warn('Gemini transcription failed, using Whisper fallback', {
          context: {
            geminiError: geminiError.message,
            recordingId,
          },
        });

        if (isStreaming) {
          streamingManager.sendProgress(recordingId, 'transcribe', 55, 'Gemini unavailable, using Whisper fallback...');
        }

        try {
          parsedResponse = await transcribeWithWhisperFallback(tempFilePath, logger);
          transcriptionProvider = 'whisper';
          logger.info('Whisper fallback successful', {
            context: {
              recordingId,
              audioSegments: parsedResponse.audioTranscript.length,
            },
          });
        } catch (whisperError: any) {
          logger.error('Both Gemini and Whisper failed', {
            context: {
              geminiError: geminiError.message,
              whisperError: whisperError.message,
              recordingId,
            },
          });
          throw new Error(`All transcription providers failed: Gemini (${geminiError.message}), Whisper (${whisperError.message})`);
        }
      } else {
        // Not a recoverable error, or no fallback available
        throw geminiError;
      }
    }

    if (isStreaming) {
      streamingManager.sendProgress(
        recordingId,
        'transcribe',
        80,
        `Extracted ${parsedResponse.audioTranscript.length} audio segments` +
          (parsedResponse.visualEvents.length > 0 ? ` and ${parsedResponse.visualEvents.length} visual events` : '')
      );
    }

    // Convert audio transcript to compatible format (similar to words_json structure)
    const fullTranscript = parsedResponse.audioTranscript
      .map(seg => seg.text)
      .join(' ')
      .trim();

    // Build words_json compatible structure
    const words_json = {
      segments: parsedResponse.audioTranscript.map(seg => ({
        start: seg.startTime,
        end: seg.endTime,
        text: seg.text,
      })),
      duration: parsedResponse.duration,
      words: [], // Gemini doesn't provide word-level timestamps, leave empty
    };

    // Prepare video metadata
    const video_metadata = {
      model: transcriptionProvider === 'gemini' ? GOOGLE_CONFIG.DOCIFY_MODEL : 'whisper-1',
      provider: transcriptionProvider === 'gemini' ? 'gemini-video' : 'whisper-fallback', // PERF-AI-006: Track provider
      duration: parsedResponse.duration,
      file_size_mb: (fileSize / 1024 / 1024).toFixed(2),
      processed_at: new Date().toISOString(),
      visual_events_count: parsedResponse.visualEvents.length,
      audio_segments_count: parsedResponse.audioTranscript.length,
      key_moments_count: parsedResponse.keyMoments?.length || 0,
    };

    // Save transcript to database
    logger.info('Saving transcript to database', {
      context: {
        textLength: fullTranscript.length,
        visualEventsCount: parsedResponse.visualEvents.length,
        duration: parsedResponse.duration,
      },
    });

    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        content_id: recordingId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json,
        visual_events: parsedResponse.visualEvents,
        video_metadata,
        confidence: transcriptionProvider === 'gemini' ? 0.95 : 0.92, // Gemini 95%, Whisper 92%
        provider: transcriptionProvider === 'gemini' ? 'gemini-video' : 'whisper-fallback', // PERF-AI-006
      })
      .select()
      .single();

    if (transcriptError) {
      logger.error('Failed to save transcript', {
        context: { recordingId },
        error: transcriptError,
      });
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    logger.info('Transcript saved successfully', {
      context: {
        transcriptId: transcript.id,
        audioPreview: fullTranscript.substring(0, 100),
        visualEventsCount: parsedResponse.visualEvents.length,
        duration: parsedResponse.duration,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 90, 'Transcript saved successfully');
    }

    // Update recording status
    await supabase
      .from('content')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

    // PERF-AI-001: Create all dependent jobs in parallel for faster pipeline execution
    // Previously, jobs were created sequentially which added unnecessary latency
    // Get recording info first for compression job preparation
    const { data: recording } = await supabase
      .from('content')
      .select('content_type, file_type, file_size, storage_path_raw')
      .eq('id', recordingId)
      .single();

    // Build array of jobs to create in parallel
    const jobPromises: Promise<any>[] = [
      // Document generation job
      Promise.resolve(supabase.from('jobs').insert({
        type: 'doc_generate',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: `doc_generate:${recordingId}`,
      })).then(res => res.data),
      // Embeddings generation job - can start in parallel with doc generation
      Promise.resolve(supabase.from('jobs').insert({
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: `generate_embeddings:${recordingId}`,
      })).then(res => res.data),
    ];

    // Add compression job if applicable
    if (recording && recording.storage_path_raw) {
      const contentType = recording.content_type || 'recording';
      const outputPath = recording.storage_path_raw.replace('/raw.', '/compressed.');

      // Only compress video/audio content types
      if (['recording', 'video', 'audio'].includes(contentType)) {
        jobPromises.push(
          Promise.resolve(supabase.from('jobs').insert({
            type: contentType === 'audio' ? 'compress_audio' : 'compress_video',
            status: 'pending',
            payload: {
              recordingId,
              orgId,
              inputPath: recording.storage_path_raw,
              outputPath,
              profile: 'uploadedVideo', // Will be determined by classifier
              contentType,
              fileType: recording.file_type || 'mp4',
            },
            dedupe_key: `compress_${contentType}:${recordingId}`,
          })).then(res => res.data)
        );
      }
    }

    // Execute all job creations in parallel
    await Promise.all(jobPromises);

    logger.info('Enqueued all dependent jobs in parallel', {
      context: {
        recordingId,
        transcriptId: transcript.id,
        jobCount: jobPromises.length,
        jobs: ['doc_generate', 'generate_embeddings', recording?.storage_path_raw ? 'compression' : null].filter(Boolean),
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 95, 'Processing complete, starting document generation');
    }

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'recording.transcribed',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
        hasVisualContext: true,
        visualEventsCount: parsedResponse.visualEvents.length,
      },
    });

    const totalTime = Date.now() - startTime;
    logger.info('Video transcription completed', {
      context: {
        recordingId,
        transcriptId: transcript.id,
        hasVisualContext: true,
        visualEventsCount: parsedResponse.visualEvents.length,
        totalTime,
      },
    });

    if (isStreaming) {
      sendCompletionNotification(recordingId, 'Transcription', totalTime);
      streamingManager.sendComplete(recordingId, `Transcription complete in ${Math.round(totalTime / 1000)}s`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Video transcription failed';

    logger.error('Video transcription failed', {
      context: {
        recordingId,
        orgId,
        storagePath,
        jobId: job.id,
      },
      error: error as Error,
    });

    if (isStreaming) {
      streamingManager.sendError(recordingId, errorMessage);
    }

    // Update recording status to error
    await supabase
      .from('content')
      .update({
        status: 'error',
        metadata: {
          error: errorMessage,
          errorType: 'transcription',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        logger.info('Cleaned up temp file', {
          context: { tempFilePath },
        });
      } catch (err) {
        logger.warn('Failed to delete temp file', {
          context: {
            tempFilePath,
            error: (err as Error).message,
          },
        });
      }
    }
  }
}
