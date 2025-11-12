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
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'extract-frames' });

type Job = Database['public']['Tables']['jobs']['Row'];

export interface ExtractFramesPayload {
  recordingId: string;
  orgId: string;
  videoPath?: string;
  videoUrl?: string;
}

// Generic job type with typed payload
type TypedJob<T> = Omit<Job, 'payload'> & { payload: T };

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
    // Update status
    await supabase
      .from('recordings')
      .update({ visual_indexing_status: 'processing' })
      .eq('id', recordingId);

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
        .from('recordings')
        .download(videoUrl);

      if (downloadError || !videoData) {
        throw new Error(`Failed to download video: ${downloadError?.message || 'Unknown error'}`);
      }

      // Save to temp file
      localVideoPath = path.join('/tmp', `video_${recordingId}.webm`);
      const buffer = Buffer.from(await videoData.arrayBuffer());
      await fs.writeFile(localVideoPath, buffer);
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
      recording_id: recordingId,
      org_id: orgId,
      frame_number: frame.frameNumber,
      frame_time_sec: frame.timeSec,
      frame_url: frame.storagePath,
      metadata: {
        width: frame.width,
        height: frame.height,
        sizeBytes: frame.sizeBytes,
      },
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
      await performOCR(recordingId, orgId, extraction.frames);
    }

    // Update recording
    await supabase
      .from('recordings')
      .update({
        frames_extracted: true,
        frame_count: extraction.totalFrames,
        visual_indexing_status: 'completed',
      })
      .eq('id', recordingId);

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

    await supabase
      .from('recordings')
      .update({ visual_indexing_status: 'failed' })
      .eq('id', recordingId);

    throw error;
  }
}

/**
 * Perform OCR on extracted frames
 */
async function performOCR(
  recordingId: string,
  orgId: string,
  frames: Array<{ frameNumber: number; localPath: string }>
): Promise<void> {
  const supabase = createClient();

  logger.info('Starting OCR processing', {
    context: { recordingId, orgId },
    data: { totalFrames: frames.length },
  });

  // Get frames from database
  const { data: dbFrames, error: fetchError } = await supabase
    .from('video_frames')
    .select('id, frame_number, frame_url')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId)
    .order('frame_number');

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
          const buffer = Buffer.from(await imageData.arrayBuffer());
          await fs.writeFile(tempPath, buffer);

          // Perform OCR
          const ocrResult = await extractFrameText(tempPath);

          // Update frame with OCR results
          if (ocrResult.text && ocrResult.text.trim().length > 0) {
            await supabase
              .from('video_frames')
              .update({
                ocr_text: ocrResult.text,
                ocr_confidence: ocrResult.confidence,
                ocr_blocks: ocrResult.blocks,
              })
              .eq('id', dbFrame.id);

            logger.info('OCR text extracted from frame', {
              context: { frameId: dbFrame.id, frameNumber: dbFrame.frame_number, recordingId },
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