/**
 * Extract Frames Job Handler
 *
 * Background job that extracts and indexes video frames.
 */

import { promises as fs } from 'fs';
import path from 'path';

import { extractFrames } from '@/lib/services/frame-extraction';
import { indexRecordingFrames } from '@/lib/services/visual-indexing';
import { extractFrameText } from '@/lib/services/ocr-service';
import { createClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'extract-frames' });

type Job = Database['public']['Tables']['jobs']['Row'];

type JsonObject = { [key: string]: Json | undefined };

export interface ExtractFramesPayload {
  recordingId: string;
  orgId: string;
  videoPath?: string;
  videoUrl?: string;
}

// Generic job type with typed payload
type TypedJob<T> = Omit<Job, 'payload'> & { payload: T };

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function isJsonObject(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFrameNumber(metadata: Json): number | null {
  if (!isJsonObject(metadata)) {
    return null;
  }

  const frameNumber = metadata.frameNumber;
  return typeof frameNumber === 'number' && Number.isFinite(frameNumber)
    ? frameNumber
    : null;
}

export async function handleExtractFrames(
  job: TypedJob<ExtractFramesPayload>
): Promise<void> {
  // Validate payload structure at runtime
  const payload = job.payload;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }

  if (!payload.recordingId || typeof payload.recordingId !== 'string') {
    throw new Error('Invalid payload: recordingId is required and must be a string');
  }

  if (!payload.orgId || typeof payload.orgId !== 'string') {
    throw new Error('Invalid payload: orgId is required and must be a string');
  }

  if (payload.videoPath && typeof payload.videoPath !== 'string') {
    throw new Error('Invalid payload: videoPath must be a string if provided');
  }

  if (payload.videoUrl && typeof payload.videoUrl !== 'string') {
    throw new Error('Invalid payload: videoUrl must be a string if provided');
  }

  const { recordingId, orgId, videoPath, videoUrl } = payload;

  logger.info('Starting frame extraction', {
    context: { recordingId, orgId, jobId: job.id },
  });

  const supabase = createClient();

  try {
    // Determine video source
    let localVideoPath: string;
    let shouldCleanup = false;

    if (videoPath) {
      localVideoPath = videoPath;
    } else if (videoUrl) {
      // Download video from Supabase Storage
      logger.info('Downloading video from storage', {
        context: { recordingId, videoUrl },
      });
      const { data: videoData, error: downloadError } = await supabase.storage
        .from('content')
        .download(videoUrl);

      if (downloadError || !videoData) {
        throw new Error(`Failed to download video: ${downloadError?.message || 'Unknown error'}`);
      }

      // Save to temp file
      localVideoPath = path.join('/tmp', `video_${recordingId}.webm`);
      const videoBytes = new Uint8Array(await videoData.arrayBuffer());
      await fs.writeFile(localVideoPath, videoBytes);
      shouldCleanup = true;
    } else {
      throw new Error('No video path or URL provided');
    }

    // Step 1: Extract frames
    const extraction = await extractFrames(localVideoPath, recordingId, orgId, {
      detectSceneChanges: true,
      fps: parseFloat(process.env.FRAME_EXTRACTION_FPS || '0.5'),
      maxFrames: parseInt(process.env.FRAME_EXTRACTION_MAX_FRAMES || '300'),
      quality: parseInt(process.env.FRAME_QUALITY || '85'),
    });

    logger.info('Frames extracted', {
      context: { recordingId },
      data: { totalFrames: extraction.totalFrames },
    });

    // Step 2: Store frame metadata
    const frameRecords = extraction.frames.map((frame) => ({
      content_id: recordingId,
      org_id: orgId,
      frame_time_sec: frame.timeSec,
      frame_url: frame.storagePath,
      metadata: toJson({
        frameNumber: frame.frameNumber,
        width: frame.width,
        height: frame.height,
        sizeBytes: frame.sizeBytes,
        mimeType: frame.mimeType,
      }),
    }));

    const { error: insertError } = await supabase
      .from('video_frames')
      .insert(frameRecords);

    if (insertError) {
      throw new Error(`Failed to store frames: ${insertError.message}`);
    }

    // Step 3: Generate visual descriptions (Gemini Vision)
    if (process.env.ENABLE_FRAME_DESCRIPTIONS !== 'false') {
      logger.info('Generating visual descriptions', {
        context: { recordingId },
      });
      await indexRecordingFrames(recordingId, orgId);
    }

    // Step 4: Extract OCR text (if enabled)
    if (process.env.ENABLE_OCR === 'true') {
      logger.info('Extracting OCR text', {
        context: { recordingId },
      });
      await performOCR(recordingId, orgId);
    }

    logger.info('Frame extraction complete', {
      context: { recordingId },
      data: { framesProcessed: extraction.totalFrames },
    });

    // Cleanup temp video file if downloaded
    if (shouldCleanup) {
      await fs.unlink(localVideoPath).catch((err) => {
        logger.warn('Failed to cleanup temp video', {
          context: { recordingId, localVideoPath },
          error: err as Error,
        });
      });
    }

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'frames.extracted',
      payload: {
        recordingId,
        orgId,
        frameCount: extraction.totalFrames,
      },
    });

  } catch (error) {
    logger.error('Frame extraction failed', {
      context: { recordingId, orgId },
      error: error as Error,
    });

    throw error;
  }
}

/**
 * Perform OCR on extracted frames
 */
async function performOCR(
  recordingId: string,
  orgId: string
): Promise<void> {
  const supabase = createClient();

  logger.info('Starting OCR processing', {
    context: { recordingId, orgId },
    data: { totalFrames: frames.length },
  });

  // Get frames from database
  const { data: dbFrames, error: fetchError } = await supabase
    .from('video_frames')
    .select('id, frame_time_sec, frame_url, metadata')
    .eq('content_id', recordingId)
    .eq('org_id', orgId)
    .order('frame_time_sec');

  if (fetchError || !dbFrames) {
    logger.error('Failed to fetch frames for OCR', {
      context: { recordingId, orgId },
      error: fetchError as Error,
    });
    return;
  }

  // Process frames in batches
  const batchSize = 5;
  for (let i = 0; i < dbFrames.length; i += batchSize) {
    const batch = dbFrames.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (dbFrame) => {
        try {
          if (!dbFrame.frame_url) {
            logger.warn('Frame is missing storage path for OCR', {
              context: { frameId: dbFrame.id, recordingId },
            });
            return;
          }

          // Download frame from storage
          const { data: imageData } = await supabase.storage
            .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
            .download(dbFrame.frame_url);

          if (!imageData) {
            logger.warn('Frame not found for OCR', {
              context: { frameId: dbFrame.id, recordingId },
            });
            return;
          }

          // Create temp file for OCR
          const tempPath = `/tmp/ocr_${dbFrame.id}.jpg`;
          const imageBytes = new Uint8Array(await imageData.arrayBuffer());
          await fs.writeFile(tempPath, imageBytes);

          // Perform OCR
          const ocrResult = await extractFrameText(tempPath);

          // Update frame with OCR results
          if (ocrResult.text && ocrResult.text.trim().length > 0) {
            await supabase
              .from('video_frames')
              .update({
                ocr_text: ocrResult.text,
                metadata: toJson({
                  ...(isJsonObject(dbFrame.metadata) ? dbFrame.metadata : {}),
                  ocrConfidence: ocrResult.confidence,
                  ocrBlocks: ocrResult.blocks,
                }),
              })
              .eq('id', dbFrame.id);

            logger.info('OCR text extracted from frame', {
              context: {
                frameId: dbFrame.id,
                frameNumber: getFrameNumber(dbFrame.metadata) ?? 'unknown',
                recordingId,
              },
              data: { textLength: ocrResult.text.length, confidence: ocrResult.confidence },
            });
          }

          // Cleanup temp file
          await fs.unlink(tempPath).catch(() => {});
        } catch (error) {
          logger.error('OCR processing failed for frame', {
            context: { frameId: dbFrame.id, recordingId },
            error: error as Error,
          });
        }
      })
    );
  }

  logger.info('OCR processing complete', {
    context: { recordingId, orgId },
    data: { totalFrames: dbFrames.length },
  });
}
