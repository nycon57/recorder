/**
 * Video Transcription Handler (Gemini Video Understanding)
 *
 * Downloads recording from Supabase Storage, sends to Gemini 2.5 Flash for
 * multimodal analysis (audio + visual), and stores transcript with visual events.
 */

import { getGoogleAI, GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { readFile, unlink } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';
import { streamTranscription, isStreamingAvailable, sendCompletionNotification } from '@/lib/services/llm-streaming-helper';

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
    .select('id, recording_id')
    .eq('recording_id', recordingId)
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
      .from('recordings')
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
    .from('recordings')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  let tempFilePath: string | null = null;

  try {
    // Download video from Supabase Storage
    logger.info('Downloading video from storage', {
      context: { storagePath },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 10, 'Downloading video from storage...');
    }

    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('recordings')
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

    // Save to temp file
    tempFilePath = join(tmpdir(), `${randomUUID()}.webm`);
    const buffer = await videoBlob.arrayBuffer();
    await writeFile(tempFilePath, Buffer.from(buffer));

    logger.info('Saved to temp file', {
      context: { tempFilePath, bufferSize: buffer.byteLength },
    });

    // Read video file as base64
    const videoBytes = await readFile(tempFilePath);
    const videoBase64 = videoBytes.toString('base64');

    logger.info('Prepared video for Gemini', {
      context: {
        bytesLength: videoBytes.length,
        base64Length: videoBase64.length,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 30, 'Preparing video for analysis...');
    }

    // Determine method based on file size
    const use20MBLimit = fileSize < 20 * 1024 * 1024;

    logger.info('Selected Gemini upload method', {
      context: {
        method: use20MBLimit ? 'inline' : 'File API',
        fileSizeMB: fileSizeMB,
        threshold: '20MB',
      },
    });

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
    logger.info('Sending video to Gemini for analysis', {
      context: {
        promptLength: prompt.length,
        videoDataSize: videoBase64.length,
      },
    });

    if (isStreaming) {
      streamingManager.sendProgress(recordingId, 'transcribe', 50, 'Analyzing video with Gemini AI...');
    }

    // Use streaming helper for transcription
    const streamingResult = await streamTranscription(
      model,
      videoBase64,
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
    let parsedResponse: GeminiVideoResponse;

    try {
      // Remove markdown code blocks if present
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(jsonText);

      logger.info('Parsed response successfully', {
        context: {
          audioSegments: parsedResponse.audioTranscript.length,
          visualEvents: parsedResponse.visualEvents.length,
          keyMoments: parsedResponse.keyMoments?.length || 0,
          duration: parsedResponse.duration,
        },
      });

      if (isStreaming) {
        streamingManager.sendProgress(
          recordingId,
          'transcribe',
          80,
          `Extracted ${parsedResponse.audioTranscript.length} audio segments and ${parsedResponse.visualEvents.length} visual events`
        );
      }
    } catch (parseError) {
      logger.error('Failed to parse Gemini JSON response', {
        context: {
          responseLength: responseText.length,
          responsePreview: responseText.substring(0, 500),
        },
        error: parseError as Error,
      });
      throw new Error(
        `Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
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
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
      provider: 'gemini-video',
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
        recording_id: recordingId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json,
        visual_events: parsedResponse.visualEvents,
        video_metadata,
        confidence: 0.95, // Gemini is generally high confidence
        provider: 'gemini-video',
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
      .from('recordings')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

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
      context: {
        recordingId,
        transcriptId: transcript.id,
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
      .from('recordings')
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
