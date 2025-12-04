/**
 * Segment Transcription Handler
 *
 * Transcribes a single video segment as part of the progressive processing pipeline.
 *
 * Key Features:
 * - Generates embeddings IMMEDIATELY after transcription
 * - Content becomes searchable before full video processing completes
 * - Updates progress tracking for real-time UI feedback
 * - Logs processing events for detailed progress monitoring
 */

import { readFile, stat } from 'fs/promises';

import type { Database } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getGoogleAI, getFileManager, FileState, GOOGLE_CONFIG } from '@/lib/google/client';
import { createLogger } from '@/lib/utils/logger';
import { streamTranscription, type VideoSource } from '@/lib/services/llm-streaming-helper';
import { generateEmbedding } from '@/lib/utils/embeddings';

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

    let parsedResponse: SegmentTranscriptResult;
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      const responsePreview = jsonText.slice(0, 500);
      logger.error('Failed to parse transcription JSON response', {
        context: {
          contentId,
          segmentIndex,
          responsePreview,
        },
        error: parseError as Error,
      });
      throw new Error(`Failed to parse transcription response for segment ${segmentIndex}`);
    }

    logger.info('Parsed segment transcription', {
      context: {
        segmentIndex,
        audioSegments: parsedResponse.audioTranscript.length,
        visualEvents: parsedResponse.visualEvents.length,
      },
    });

    // Store segment result in database with 'processing' status
    const keyMoments = parsedResponse.keyMoments || [];

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
        key_moments: keyMoments,
        key_moments_count: keyMoments.length,
        status: 'processing', // Will be updated to 'completed' after embeddings
        processed_at: new Date().toISOString(),
      }, {
        onConflict: 'content_id,segment_index',
      });

    if (insertError) {
      logger.warn('Could not store in segment_transcripts table', {
        context: { error: insertError.message },
      });
    }

    // Log processing event for progress tracking
    try {
      await supabase.from('content_processing_events').insert({
        content_id: contentId,
        event_type: 'segment_transcribed',
        segment_index: segmentIndex,
        payload: {
          audioSegments: parsedResponse.audioTranscript.length,
          visualEvents: parsedResponse.visualEvents.length,
          keyMoments: keyMoments.length,
          analysisTime,
        },
      });
    } catch {
      // Ignore if table doesn't exist yet
    }

    // =========================================================================
    // PROGRESSIVE EMBEDDINGS: Generate embeddings immediately for instant search
    // =========================================================================
    logger.info('Generating progressive embeddings for segment', {
      context: { contentId, segmentIndex },
    });

    try {
      // Create chunks from segment transcript (with timestamp adjustment)
      const chunks = createChunksFromSegment(
        parsedResponse.combinedNarrative,
        parsedResponse.audioTranscript,
        segmentIndex,
        segmentStartTime // Offset for absolute timestamps
      );

      let embeddingsGenerated = 0;

      for (const chunk of chunks) {
        try {
          const embedding = await generateEmbedding(chunk.text);

          // Store chunk with embedding - immediately searchable!
          const { error: chunkError } = await supabase
            .from('transcript_chunks')
            .insert({
              content_id: contentId,
              org_id: orgId,
              text: chunk.text,
              embedding,
              segment_index: segmentIndex,
              start_time: chunk.startTime,
              end_time: chunk.endTime,
              metadata: {
                source: 'progressive_segment',
                segmentIndex,
                absoluteStartTime: chunk.startTime + segmentStartTime,
              },
            });

          if (!chunkError) {
            embeddingsGenerated++;
          }
        } catch (embError) {
          logger.warn('Failed to generate embedding for chunk', {
            context: { contentId, segmentIndex, chunkIndex: chunks.indexOf(chunk) },
            error: embError as Error,
          });
        }
      }

      logger.info('Progressive embeddings generated', {
        context: {
          contentId,
          segmentIndex,
          chunksCreated: chunks.length,
          embeddingsGenerated,
        },
      });

      // Update segment status to completed with embeddings flag
      await supabase
        .from('segment_transcripts')
        .update({
          status: 'completed',
          embeddings_generated: embeddingsGenerated > 0,
        })
        .eq('content_id', contentId)
        .eq('segment_index', segmentIndex);

      // Log embeddings event
      try {
        await supabase.from('content_processing_events').insert({
          content_id: contentId,
          event_type: 'embeddings_generated',
          segment_index: segmentIndex,
          payload: {
            chunksCreated: chunks.length,
            embeddingsGenerated,
          },
        });
      } catch {
        // Ignore if table doesn't exist
      }

    } catch (embeddingError) {
      logger.error('Failed to generate progressive embeddings', {
        context: { contentId, segmentIndex },
        error: embeddingError as Error,
      });

      // Still mark segment as completed even if embeddings fail
      // Embeddings can be regenerated later
      await supabase
        .from('segment_transcripts')
        .update({
          status: 'completed',
          embeddings_generated: false,
        })
        .eq('content_id', contentId)
        .eq('segment_index', segmentIndex);
    }

    // =========================================================================
    // DEPENDENCY-BASED MERGE TRIGGERING: Signal completion to parent merge job
    // =========================================================================

    // The job's parent_job_id points to the merge job that should run when all segments complete
    const mergeJobId = job.parent_job_id;

    if (mergeJobId) {
      // Use the atomic increment_segment_completion function
      // This will automatically transition the merge job to 'pending' when all segments complete
      const { data: completionResult, error: completionError } = await supabase
        .rpc('increment_segment_completion', { p_merge_job_id: mergeJobId });

      if (completionError) {
        logger.warn('Failed to increment segment completion counter', {
          context: {
            contentId,
            segmentIndex,
            mergeJobId,
            error: completionError.message
          },
        });
      } else if (completionResult && completionResult.length > 0) {
        const result = completionResult[0];
        logger.info('Updated merge job completion status', {
          context: {
            contentId,
            segmentIndex,
            mergeJobId,
            completedCount: result.completed_count,
            totalCount: result.total_count,
            allComplete: result.all_complete,
          },
        });

        if (result.all_complete) {
          logger.info('All segments complete - merge job triggered', {
            context: { contentId, mergeJobId },
          });
        }
      }

      // Update content's completed_segments count atomically
      const { data: newCount } = await supabase
        .rpc('increment_completed_segments', { p_content_id: contentId });

      if (newCount !== null) {
        logger.debug('Updated content completed_segments', {
          context: { contentId, completedSegments: newCount },
        });
      }
    }

    logger.info('Segment transcription complete', {
      context: {
        contentId,
        segmentIndex,
        totalSegments,
        analysisTime,
        mergeJobId: mergeJobId || 'none',
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

    // Update segment status to failed
    try {
      const supabase = createAdminClient();
      await supabase
        .from('segment_transcripts')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('content_id', contentId)
        .eq('segment_index', segmentIndex);
    } catch {
      // Ignore update failure
    }

    throw error;
  }
}

/**
 * Create searchable chunks from segment transcript
 */
function createChunksFromSegment(
  narrative: string,
  audioTranscript: AudioSegment[],
  segmentIndex: number,
  segmentStartTime: number
): Array<{ text: string; startTime: number; endTime: number }> {
  const chunks: Array<{ text: string; startTime: number; endTime: number }> = [];

  // Strategy 1: Create chunks from combined narrative (broader context)
  if (narrative && narrative.length > 100) {
    // Split narrative into ~500 char chunks with overlap
    const chunkSize = 500;
    const overlap = 50;

    for (let i = 0; i < narrative.length; i += chunkSize - overlap) {
      const chunkText = narrative.slice(i, i + chunkSize);
      if (chunkText.length >= 50) {
        chunks.push({
          text: chunkText,
          startTime: segmentStartTime,
          endTime: segmentStartTime + 60, // Approximate
        });
      }
    }
  }

  // Strategy 2: Create chunks from audio transcript segments (precise timestamps)
  const transcriptChunks: string[] = [];
  let currentChunk = '';
  let chunkStartTime = 0;
  let chunkEndTime = 0;

  for (const segment of audioTranscript) {
    if (currentChunk.length === 0) {
      chunkStartTime = segment.startTime;
    }

    currentChunk += (currentChunk ? ' ' : '') + segment.text;
    chunkEndTime = segment.endTime;

    // Create chunk when we have enough text (~300-500 chars)
    if (currentChunk.length >= 300) {
      chunks.push({
        text: currentChunk,
        startTime: segmentStartTime + chunkStartTime,
        endTime: segmentStartTime + chunkEndTime,
      });
      currentChunk = '';
    }
  }

  // Don't forget remaining text
  if (currentChunk.length >= 50) {
    chunks.push({
      text: currentChunk,
      startTime: segmentStartTime + chunkStartTime,
      endTime: segmentStartTime + chunkEndTime,
    });
  }

  return chunks;
}
