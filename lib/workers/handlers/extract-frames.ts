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

import type { Job } from '@/lib/types/jobs';

export interface ExtractFramesPayload {
  recordingId: string;
  orgId: string;
  videoPath?: string;
  videoUrl?: string;
}

export async function handleExtractFrames(
  job: Job<ExtractFramesPayload>
): Promise<void> {
  const { recordingId, orgId, videoPath, videoUrl } = job.payload;

  console.log('[Job: Extract Frames] Starting:', {
    jobId: job.id,
    recordingId,
    orgId,
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
      console.log('[Job: Extract Frames] Downloading video from storage');
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

    console.log('[Job: Extract Frames] Extracted:', extraction.totalFrames);

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
      console.log('[Job: Extract Frames] Generating visual descriptions');
      await indexRecordingFrames(recordingId, orgId);
    }

    // Step 4: Extract OCR text (if enabled)
    if (process.env.ENABLE_OCR === 'true') {
      console.log('[Job: Extract Frames] Extracting OCR text');
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

    console.log('[Job: Extract Frames] Complete:', {
      recordingId,
      framesProcessed: extraction.totalFrames,
    });

    // Cleanup temp video file if downloaded
    if (shouldCleanup) {
      await fs.unlink(localVideoPath).catch((err) => {
        console.warn('[Job: Extract Frames] Failed to cleanup temp video:', err);
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
    console.error('[Job: Extract Frames] Error:', error);

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

  console.log(`[OCR] Processing ${frames.length} frames for recording ${recordingId}`);

  // Get frames from database
  const { data: dbFrames, error: fetchError } = await supabase
    .from('video_frames')
    .select('id, frame_number, frame_url')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId)
    .order('frame_number');

  if (fetchError || !dbFrames) {
    console.error('[OCR] Failed to fetch frames:', fetchError);
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
            console.warn('[OCR] Frame not found:', dbFrame.id);
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

            console.log(`[OCR] Extracted text from frame ${dbFrame.frame_number}: ${ocrResult.text.substring(0, 50)}...`);
          }

          // Cleanup temp file
          await fs.unlink(tempPath).catch(() => {});
        } catch (error) {
          console.error(`[OCR] Error processing frame ${dbFrame.id}:`, error);
        }
      })
    );
  }

  console.log(`[OCR] Complete for recording ${recordingId}`);
}