/**
 * Segment Transcription Handler
 *
 * Transcribes a single video segment as part of the long video processing pipeline.
 * Results are stored in a temporary table and merged by the merge-transcripts handler.
 */

import { createReadStream, createWriteStream } from 'fs';
import { readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import type { Database } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAI, getFileManager, FileState, GOOGLE_CONFIG } from '@/lib/google/client';
import { createLogger } from '@/lib/utils/logger';
import { streamTranscription, type VideoSource } from '@/lib/services/llm-streaming-helper';

const logger = createLogger({ service: 'transcribe-segment' });

// Size threshold for using Gemini File API vs inline base64
const FILE_API_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribeSegmentPayload {
  contentId: string;
  orgId: string;
  segmentPath: string;
  segmentIndex: number;
  totalSegments: number;
  parentJobId: string;
  segmentStartTime: number;
  segmentEndTime: number;
  segmentDuration: number;
}

interface AudioSegment {
  timestamp: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
}

interface VisualEvent {
  timestamp: string;
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string;
  location?: string;
  description: string;
  confidence?: number;
}

interface SegmentTranscriptResult {
  audioTranscript: AudioSegment[];
  visualEvents: VisualEvent[];
  combinedNarrative: string;
  duration: number;
  keyMoments?: Array<{
    timestamp: string;
    description: string;
  }>;
}

/**
 * Sleep helper for polling file processing status
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Transcribe a video segment
 */
export async function transcribeSegment(job: Job): Promise<void> {
  const payload = job.payload as unknown as TranscribeSegmentPayload;
  const {
    contentId,
    orgId,
    segmentPath,
    segmentIndex,
    totalSegments,
    parentJobId,
    segmentStartTime,
    segmentDuration,
  } = payload;

  logger.info('Starting segment transcription', {
    context: {
      contentId,
      segmentIndex,
      totalSegments,
      segmentPath,
      segmentStartTime,
      segmentDuration,
      parentJobId,
    },
  });

  const supabase = createAdminClient();
  let tempFilePath: string | null = null;

  try {
    // Read segment file
    const fileStats = await stat(segmentPath);
    const fileSize = fileStats.size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    logger.info('Segment file info', {
      context: {
        segmentPath,
        fileSize,
        fileSizeMB,
      },
    });

    // Determine upload method based on file size
    const useFileAPI = fileSize >= FILE_API_THRESHOLD_BYTES;

    logger.info('Selected Gemini upload method for segment', {
      context: {
        method: useFileAPI ? 'File API' : 'inline',
        fileSizeMB,
        segmentIndex,
      },
    });

    // Prepare video source
    let videoSource: VideoSource;

    if (useFileAPI) {
      // Use Gemini File API for large segments
      const fileManager = getFileManager();

      const uploadResult = await fileManager.uploadFile(segmentPath, {
        mimeType: 'video/webm',
        displayName: `segment-${contentId}-${segmentIndex}`,
      });

      // Wait for processing
      let file = uploadResult.file;
      let pollCount = 0;
      const maxPolls = 60; // 5 minutes max

      while (file.state === FileState.PROCESSING) {
        pollCount++;
        if (pollCount > maxPolls) {
          throw new Error('Gemini file processing timeout for segment');
        }
        await sleep(5000);
        file = await fileManager.getFile(file.name);
      }

      if (file.state === FileState.FAILED) {
        throw new Error(`Gemini file processing failed for segment ${segmentIndex}`);
      }

      videoSource = {
        type: 'fileApi',
        fileUri: file.uri,
        mimeType: file.mimeType,
      };

      logger.info('Segment uploaded to Gemini File API', {
        context: {
          segmentIndex,
          uri: file.uri,
          processingTime: pollCount * 5,
        },
      });
    } else {
      // Use inline base64 for small segments
      const videoBytes = await readFile(segmentPath);
      const videoBase64 = videoBytes.toString('base64');

      videoSource = {
        type: 'inline',
        base64: videoBase64,
      };

      logger.info('Segment prepared for inline upload', {
        context: {
          segmentIndex,
          base64Length: videoBase64.length,
        },
      });
    }

    // Initialize Gemini model
    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
    });

    // Segment-specific prompt (note: we'll adjust timestamps in merge phase)
    const prompt = `Analyze this video segment and extract comprehensive information.
This is segment ${segmentIndex + 1} of ${totalSegments} from a longer video.

**TASK 1: AUDIO TRANSCRIPTION**
Transcribe all spoken content with precise timestamps (MM:SS format relative to this segment's start).
For each segment, provide:
- timestamp: exact time when speech starts (relative to segment start at 00:00)
- text: the spoken words
- speaker: identify if multiple speakers

**TASK 2: VISUAL EVENTS**
Extract key visual actions:
- UI elements clicked
- Text typed
- Screen transitions
- Important visual elements

For each visual event, provide timestamp, type, target, location, and description.

**TASK 3: COMBINED NARRATIVE**
Create a unified narrative merging audio and visual context.

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON:
{
  "audioTranscript": [
    {
      "timestamp": "00:05",
      "startTime": 5.0,
      "endTime": 8.5,
      "speaker": "narrator",
      "text": "..."
    }
  ],
  "visualEvents": [
    {
      "timestamp": "00:05",
      "type": "click",
      "target": "...",
      "location": "...",
      "description": "..."
    }
  ],
  "combinedNarrative": "...",
  "duration": ${Math.round(segmentDuration)},
  "keyMoments": [
    {"timestamp": "00:05", "description": "..."}
  ]
}

IMPORTANT: Return ONLY the JSON object.`;

    // Call Gemini
    const startTime = Date.now();
    logger.info('Sending segment to Gemini', {
      context: { segmentIndex, totalSegments },
    });

    const streamingResult = await streamTranscription(
      model,
      videoSource,
      prompt,
      {
        recordingId: contentId,
        chunkBufferSize: 500,
        chunkDelayMs: 100,
        punctuationChunking: true,
        progressUpdateInterval: 5,
      }
    );

    const responseText = streamingResult.fullText;
    const analysisTime = Date.now() - startTime;

    logger.info('Received Gemini response for segment', {
      context: {
        segmentIndex,
        responseLength: responseText.length,
        analysisTime,
      },
    });

    // Parse response
    const jsonText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsedResponse: SegmentTranscriptResult = JSON.parse(jsonText);

    logger.info('Parsed segment transcription', {
      context: {
        segmentIndex,
        audioSegments: parsedResponse.audioTranscript.length,
        visualEvents: parsedResponse.visualEvents.length,
      },
    });

    // Store segment result in database
    // We use the jobs payload to store intermediate results
    const segmentResult = {
      segmentIndex,
      segmentStartTime,
      segmentDuration,
      audioTranscript: parsedResponse.audioTranscript,
      visualEvents: parsedResponse.visualEvents,
      combinedNarrative: parsedResponse.combinedNarrative,
      keyMoments: parsedResponse.keyMoments || [],
      processedAt: new Date().toISOString(),
    };

    // Update parent job with segment result
    // Store in a dedicated table for segment results
    const { error: insertError } = await supabase
      .from('segment_transcripts')
      .upsert({
        content_id: contentId,
        parent_job_id: parentJobId,
        segment_index: segmentIndex,
        segment_start_time: segmentStartTime,
        segment_duration: segmentDuration,
        audio_transcript: parsedResponse.audioTranscript,
        visual_events: parsedResponse.visualEvents,
        combined_narrative: parsedResponse.combinedNarrative,
        key_moments: parsedResponse.keyMoments || [],
        processed_at: new Date().toISOString(),
      }, {
        onConflict: 'content_id,segment_index',
      });

    if (insertError) {
      // If segment_transcripts table doesn't exist, store in job result
      logger.warn('Could not store in segment_transcripts table, using job result', {
        context: { error: insertError.message },
      });

      // Store in job's result field instead
      await supabase
        .from('jobs')
        .update({
          result: segmentResult,
        })
        .eq('id', job.id);
    }

    logger.info('Segment transcription complete', {
      context: {
        contentId,
        segmentIndex,
        totalSegments,
        analysisTime,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Segment transcription failed';

    logger.error('Segment transcription failed', {
      context: {
        contentId,
        segmentIndex,
        segmentPath,
      },
      error: error as Error,
    });

    throw error;
  }
}
