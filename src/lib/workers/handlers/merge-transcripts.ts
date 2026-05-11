/**
 * Merge Transcripts Handler
 *
 * Combines segment transcripts into a final unified transcript.
 * Adjusts timestamps from segment-relative to absolute video time.
 * Creates the final transcript record and triggers downstream jobs.
 */

import type { Database, Json } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import {
  cleanupSegments,
  type VideoSegment,
} from '@/lib/services/video-splitter';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';

const logger = createLogger({ service: 'merge-transcripts' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface MergeTranscriptsPayload {
  contentId: string;
  orgId: string;
  parentJobId: string;
  segmentCount: number;
  totalDuration: number;
  segments: VideoSegment[];
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

interface KeyMoment {
  timestamp: string;
  description: string;
}

interface SegmentResult {
  segmentIndex: number;
  segmentStartTime: number;
  segmentDuration: number;
  audioTranscript: AudioSegment[];
  visualEvents: VisualEvent[];
  combinedNarrative: string;
  keyMoments: KeyMoment[];
}

type JsonObject = { [key: string]: Json | undefined };

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseVisualEventType(value: unknown): VisualEvent['type'] {
  switch (value) {
    case 'click':
    case 'type':
    case 'navigate':
    case 'scroll':
    case 'other':
      return value;
    default:
      return 'other';
  }
}

function parseAudioSegments(value: Json | null): AudioSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const timestamp = readString(entry.timestamp);
    const startTime = readNumber(entry.startTime);
    const endTime = readNumber(entry.endTime);
    const text = readString(entry.text);

    if (!timestamp || startTime === null || endTime === null || !text) {
      return [];
    }

    return [
      {
        timestamp,
        startTime,
        endTime,
        text,
        speaker: readString(entry.speaker) ?? undefined,
      },
    ];
  });
}

function parseVisualEvents(value: Json | null): VisualEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const timestamp = readString(entry.timestamp);
    const description = readString(entry.description);

    if (!timestamp || !description) {
      return [];
    }

    return [
      {
        timestamp,
        description,
        type: parseVisualEventType(entry.type),
        target: readString(entry.target) ?? undefined,
        location: readString(entry.location) ?? undefined,
        confidence: readNumber(entry.confidence) ?? undefined,
      },
    ];
  });
}

function parseKeyMoments(value: Json | null): KeyMoment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const timestamp = readString(entry.timestamp);
    const description = readString(entry.description);

    if (!timestamp || !description) {
      return [];
    }

    return [{ timestamp, description }];
  });
}

function parseSegmentResult(value: Json | null): SegmentResult | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const segmentIndex = readNumber(value.segmentIndex);
  const segmentStartTime = readNumber(value.segmentStartTime);
  const segmentDuration = readNumber(value.segmentDuration);

  if (
    segmentIndex === null ||
    segmentStartTime === null ||
    segmentDuration === null
  ) {
    return null;
  }

  return {
    segmentIndex,
    segmentStartTime,
    segmentDuration,
    audioTranscript: parseAudioSegments(value.audioTranscript ?? null),
    visualEvents: parseVisualEvents(value.visualEvents ?? null),
    combinedNarrative: readString(value.combinedNarrative) ?? '',
    keyMoments: parseKeyMoments(value.keyMoments ?? null),
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
 * Parse timestamp to seconds. Supports HH:MM:SS and MM:SS formats.
 * @throws Error if timestamp format is invalid or contains non-numeric values
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');

  if (parts.length === 3) {
    // HH:MM:SS format
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      throw new Error(
        `Invalid timestamp format: "${timestamp}" contains non-numeric values`,
      );
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    // MM:SS format
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);

    if (isNaN(minutes) || isNaN(seconds)) {
      throw new Error(
        `Invalid timestamp format: "${timestamp}" contains non-numeric values`,
      );
    }

    return minutes * 60 + seconds;
  }

  throw new Error(
    `Invalid timestamp format: "${timestamp}". Expected HH:MM:SS or MM:SS`,
  );
}

/**
 * Adjust timestamps in audio segments by adding offset
 */
function adjustAudioTimestamps(
  segments: AudioSegment[],
  offset: number,
): AudioSegment[] {
  return segments.map((seg) => ({
    ...seg,
    timestamp: formatTimestamp(parseTimestamp(seg.timestamp) + offset),
    startTime: seg.startTime + offset,
    endTime: seg.endTime + offset,
  }));
}

/**
 * Adjust timestamps in visual events by adding offset
 */
function adjustVisualTimestamps(
  events: VisualEvent[],
  offset: number,
): VisualEvent[] {
  return events.map((event) => ({
    ...event,
    timestamp: formatTimestamp(parseTimestamp(event.timestamp) + offset),
  }));
}

/**
 * Adjust timestamps in key moments by adding offset
 */
function adjustKeyMomentTimestamps(
  moments: Array<{ timestamp: string; description: string }>,
  offset: number,
): Array<{ timestamp: string; description: string }> {
  return moments.map((moment) => ({
    ...moment,
    timestamp: formatTimestamp(parseTimestamp(moment.timestamp) + offset),
  }));
}

/**
 * Merge all segment transcripts into a unified transcript
 */
export async function mergeTranscripts(job: Job): Promise<void> {
  const payload = job.payload as unknown as MergeTranscriptsPayload;
  const {
    contentId,
    orgId,
    parentJobId,
    segmentCount,
    totalDuration,
    segments,
  } = payload;

  logger.info('Starting transcript merge', {
    context: {
      contentId,
      segmentCount,
      totalDuration,
      parentJobId,
    },
  });

  const supabase = createAdminClient();

  try {
    // =========================================================================
    // VALIDATION: Verify all segments are complete before merging
    // This is a safety check - the job should only run when triggered by
    // the last segment completion via increment_segment_completion()
    // =========================================================================

    // Check this job's segments_completed counter matches total_segments
    const { data: jobStatus, error: jobStatusError } = await supabase
      .from('jobs')
      .select('segments_completed, total_segments')
      .eq('id', job.id)
      .single();

    if (!jobStatusError && jobStatus) {
      const { segments_completed, total_segments } = jobStatus;
      const completedSegments = segments_completed ?? 0;

      if (total_segments && completedSegments < total_segments) {
        // Not all segments have completed yet - this shouldn't happen
        // if dependency-based triggering is working correctly
        logger.warn('Merge job triggered before all segments complete', {
          context: {
            contentId,
            segmentsCompleted: completedSegments,
            totalSegments: total_segments,
            jobId: job.id,
          },
        });

        // Re-queue this job to wait for remaining segments
        // Set back to 'waiting' status
        await supabase
          .from('jobs')
          .update({
            status: 'waiting',
            error: `Waiting for ${total_segments - completedSegments} more segments to complete`,
          })
          .eq('id', job.id);

        logger.info('Merge job re-queued to wait for remaining segments', {
          context: {
            contentId,
            remaining: total_segments - completedSegments,
          },
        });

        return; // Exit early - don't throw error, just wait
      }

      logger.info('All segments confirmed complete', {
        context: {
          contentId,
          segmentsCompleted: completedSegments,
          totalSegments: total_segments,
        },
      });
    }

    // Fetch all segment results
    // First try the segment_transcripts table
    let segmentResults: SegmentResult[] = [];

    const { data: storedSegments, error: fetchError } = await supabase
      .from('segment_transcripts')
      .select('*')
      .eq('content_id', contentId)
      .order('segment_index', { ascending: true });

    if (!fetchError && storedSegments && storedSegments.length > 0) {
      // Use segment_transcripts table data
      segmentResults = storedSegments.map((s) => ({
        segmentIndex: s.segment_index,
        segmentStartTime: s.segment_start_time,
        segmentDuration: s.segment_duration,
        audioTranscript: parseAudioSegments(s.audio_transcript),
        visualEvents: parseVisualEvents(s.visual_events),
        combinedNarrative: s.combined_narrative ?? '',
        keyMoments: parseKeyMoments(s.key_moments),
      }));
    } else {
      // Fallback: fetch from completed segment jobs
      const { data: segmentJobs, error: jobsError } = await supabase
        .from('jobs')
        .select('result')
        .eq('type', 'transcribe_segment')
        .eq('status', 'completed')
        .contains('payload', { contentId })
        .order('created_at', { ascending: true });

      if (jobsError || !segmentJobs || segmentJobs.length === 0) {
        throw new Error(
          `Failed to fetch segment results: ${fetchError?.message || jobsError?.message || 'No segments found'}`,
        );
      }

      segmentResults = segmentJobs
        .flatMap((__item, __index, __array) => {
          const __mapped = parseSegmentResult(__item.result);
          return __mapped !== null ? [__mapped] : [];
        })
        .sort((a, b) => a.segmentIndex - b.segmentIndex);
    }

    if (segmentResults.length !== segmentCount) {
      logger.warn('Segment count mismatch', {
        context: {
          expected: segmentCount,
          found: segmentResults.length,
        },
      });
    }

    logger.info('Fetched segment results', {
      context: {
        segmentCount: segmentResults.length,
        segmentIndices: segmentResults.map((s) => s.segmentIndex),
      },
    });

    // Merge all segments with adjusted timestamps
    const mergedAudioTranscript: AudioSegment[] = [];
    const mergedVisualEvents: VisualEvent[] = [];
    const mergedKeyMoments: KeyMoment[] = [];
    const narrativeParts: string[] = [];

    for (const segment of segmentResults) {
      const offset = segment.segmentStartTime;

      // Adjust and merge audio transcripts
      const adjustedAudio = adjustAudioTimestamps(
        segment.audioTranscript || [],
        offset,
      );
      mergedAudioTranscript.push(...adjustedAudio);

      // Adjust and merge visual events
      const adjustedVisual = adjustVisualTimestamps(
        segment.visualEvents || [],
        offset,
      );
      mergedVisualEvents.push(...adjustedVisual);

      // Adjust and merge key moments
      const adjustedMoments = adjustKeyMomentTimestamps(
        segment.keyMoments || [],
        offset,
      );
      mergedKeyMoments.push(...adjustedMoments);

      // Add segment narrative with context
      const segmentLabel = `[Segment ${segment.segmentIndex + 1} - ${formatTimestamp(offset)} to ${formatTimestamp(offset + segment.segmentDuration)}]`;
      narrativeParts.push(`${segmentLabel}\n${segment.combinedNarrative}`);
    }

    // Build full transcript text
    const fullTranscript = mergedAudioTranscript
      .map((seg) => seg.text)
      .join(' ')
      .trim();

    // Build words_json compatible structure
    const wordsJson = {
      segments: mergedAudioTranscript.map((seg) => ({
        start: seg.startTime,
        end: seg.endTime,
        text: seg.text,
      })),
      duration: totalDuration,
      words: [],
    };

    // Video metadata
    const videoMetadata = {
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
      provider: 'gemini-video-segmented',
      duration: totalDuration,
      processed_at: new Date().toISOString(),
      visual_events_count: mergedVisualEvents.length,
      audio_segments_count: mergedAudioTranscript.length,
      key_moments_count: mergedKeyMoments.length,
      segment_count: segmentResults.length,
      processing_method: 'segmented',
    };

    logger.info('Merged transcript data', {
      context: {
        audioSegments: mergedAudioTranscript.length,
        visualEvents: mergedVisualEvents.length,
        keyMoments: mergedKeyMoments.length,
        transcriptLength: fullTranscript.length,
        totalDuration,
      },
    });

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        content_id: contentId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json: toJson(wordsJson),
        visual_events: toJson(mergedVisualEvents),
        video_metadata: toJson(videoMetadata),
        confidence: 0.93, // Slightly lower than single-pass due to boundary effects
        provider: 'gemini-video-segmented',
      })
      .select()
      .single();

    if (transcriptError) {
      throw new Error(
        `Failed to save merged transcript: ${transcriptError.message}`,
      );
    }

    logger.info('Merged transcript saved', {
      context: {
        transcriptId: transcript.id,
        contentId,
      },
    });

    // Create downstream jobs (doc generation, embeddings, metadata)
    const jobPromises = [
      supabase.from('jobs').insert({
        type: 'doc_generate',
        status: 'pending',
        payload: {
          recordingId: contentId,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: `doc_generate:${contentId}`,
      }),
      supabase.from('jobs').insert({
        type: 'generate_embeddings',
        status: 'pending',
        payload: {
          recordingId: contentId,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: `generate_embeddings:${contentId}`,
      }),
      supabase.from('jobs').insert({
        type: 'generate_metadata',
        status: 'pending',
        payload: {
          recordingId: contentId,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: `generate_metadata:${contentId}`,
        priority: 1, // JOB_PRIORITY.HIGH — titles appear quickly
      }),
    ];

    await Promise.all(jobPromises);

    await supabase
      .from('content')
      .update({
        status:
          getQueuedSourceStatusForJob('doc_generate') ??
          SOURCE_STATUS.DOCUMENT_GENERATING,
      })
      .eq('id', contentId);

    logger.info('Created downstream jobs', {
      context: {
        contentId,
        transcriptId: transcript.id,
        jobs: ['doc_generate', 'generate_embeddings', 'generate_metadata'],
      },
    });

    // Clean up segment files
    if (segments && segments.length > 0) {
      try {
        await cleanupSegments(segments);
        logger.info('Cleaned up segment files', {
          context: { segmentCount: segments.length },
        });
      } catch (cleanupError) {
        logger.warn('Failed to clean up segment files', {
          error: cleanupError as Error,
        });
      }
    }

    // Clean up segment_transcripts records
    const { error: cleanupError } = await supabase
      .from('segment_transcripts')
      .delete()
      .eq('content_id', contentId);

    if (cleanupError) {
      logger.warn('Failed to clean up segment_transcripts', {
        context: { error: cleanupError.message },
      });
    }

    // Create completion event
    await supabase.from('events').insert({
      type: 'recording.transcribed',
      payload: {
        recordingId: contentId,
        transcriptId: transcript.id,
        orgId,
        hasVisualContext: true,
        visualEventsCount: mergedVisualEvents.length,
        processingMethod: 'segmented',
        segmentCount: segmentResults.length,
      },
    });

    logger.info('Transcript merge complete', {
      context: {
        contentId,
        transcriptId: transcript.id,
        segmentCount: segmentResults.length,
        totalDuration,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Merge failed';

    logger.error('Transcript merge failed', {
      context: { contentId, segmentCount },
      error: error as Error,
    });

    // Update content status to error
    await supabase
      .from('content')
      .update({
        status: SOURCE_STATUS.ERROR,
        metadata: toJson({
          error: errorMessage,
          errorType: 'merge_transcripts',
          timestamp: new Date().toISOString(),
        }),
      })
      .eq('id', contentId);

    throw error;
  }
}
