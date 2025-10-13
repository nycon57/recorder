/**
 * Frame Extraction Service
 *
 * Extracts key frames from video recordings using FFmpeg.
 * Implements smart frame selection based on scene changes.
 */

import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@/lib/supabase/admin';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  validateFilePath,
  validateStoragePath,
  sanitizeFFmpegQuality,
  sanitizeFFmpegFPS,
  sanitizeMaxFrames,
} from '@/lib/utils/security';

export interface FrameExtractionOptions {
  /** Frames per second to extract (default: 0.5 = 1 frame every 2 seconds) */
  fps?: number;
  /** Maximum number of frames to extract */
  maxFrames?: number;
  /** JPEG quality (0-100) */
  quality?: number;
  /** Detect scene changes (more intelligent frame selection) */
  detectSceneChanges?: boolean;
}

export interface ExtractedFrame {
  frameNumber: number;
  timeSec: number;
  localPath: string;
  storagePath: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface FrameExtractionResult {
  recordingId: string;
  frames: ExtractedFrame[];
  duration: number;
  totalFrames: number;
}

/**
 * Extract frames from video file
 */
export async function extractFrames(
  videoPath: string,
  recordingId: string,
  orgId: string,
  options: FrameExtractionOptions = {}
): Promise<FrameExtractionResult> {
  // SECURITY: Validate video path to prevent path traversal
  if (!validateFilePath(videoPath, ['mp4', 'webm', 'mov'])) {
    throw new Error('Invalid video path format');
  }

  // SECURITY: Sanitize all numeric parameters to prevent injection
  const fps = sanitizeFFmpegFPS(
    options.fps ?? parseFloat(process.env.FRAME_EXTRACTION_FPS || '0.5')
  );
  const maxFrames = sanitizeMaxFrames(
    options.maxFrames ?? parseInt(process.env.FRAME_EXTRACTION_MAX_FRAMES || '300')
  );
  const quality = sanitizeFFmpegQuality(
    options.quality ?? parseInt(process.env.FRAME_QUALITY || '85')
  );
  const detectSceneChanges = options.detectSceneChanges ?? false;

  const startTime = Date.now();

  console.log('[Frame Extraction] Starting:', {
    recordingId,
    fps,
    maxFrames,
    detectSceneChanges,
  });

  // Create temp directory for frames
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frames-'));

  try {
    // Get video metadata
    const metadata = await getVideoMetadata(videoPath);
    const duration = metadata.duration;

    console.log('[Frame Extraction] Video metadata:', {
      duration: `${duration}s`,
      width: metadata.width,
      height: metadata.height,
    });

    // Calculate frame interval
    const frameInterval = 1 / fps;
    const estimatedFrames = Math.ceil(duration * fps);
    const actualFrameCount = Math.min(estimatedFrames, maxFrames);

    // Extract frames using FFmpeg
    if (detectSceneChanges) {
      await extractSceneChangeFrames(
        videoPath,
        tempDir,
        actualFrameCount,
        quality
      );
    } else {
      await extractUniformFrames(
        videoPath,
        tempDir,
        fps,
        actualFrameCount,
        quality
      );
    }

    // Get extracted frame files
    const frameFiles = await fs.readdir(tempDir);
    const framePaths = frameFiles
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .slice(0, actualFrameCount);

    console.log('[Frame Extraction] Frames extracted:', framePaths.length);

    // Upload frames to Supabase Storage
    const supabase = createClient();
    const extractedFrames: ExtractedFrame[] = [];

    for (const [index, filename] of framePaths.entries()) {
      const localPath = path.join(tempDir, filename);
      const frameNumber = index + 1;
      const timeSec = frameNumber * frameInterval;

      // Optimize image with Sharp
      const imageBuffer = await sharp(localPath)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const imageMetadata = await sharp(imageBuffer).metadata();

      // Upload to storage with validated path
      const storagePath = `${orgId}/${recordingId}/frames/frame_${frameNumber.toString().padStart(4, '0')}.jpg`;

      // SECURITY: Validate storage path before upload
      try {
        validateStoragePath(storagePath, orgId);
      } catch (error) {
        console.error('[Frame Extraction] Invalid storage path:', error);
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
        .upload(storagePath, imageBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[Frame Extraction] Upload error:', uploadError);
        continue;
      }

      extractedFrames.push({
        frameNumber,
        timeSec,
        localPath,
        storagePath,
        width: imageMetadata.width || 0,
        height: imageMetadata.height || 0,
        sizeBytes: imageBuffer.length,
      });
    }

    const extractionDuration = Date.now() - startTime;

    console.log('[Frame Extraction] Complete:', {
      recordingId,
      framesExtracted: extractedFrames.length,
      durationMs: extractionDuration,
    });

    return {
      recordingId,
      frames: extractedFrames,
      duration: extractionDuration,
      totalFrames: extractedFrames.length,
    };
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[Frame Extraction] Cleanup failed:', error);
    }
  }
}

/**
 * Extract frames at uniform intervals
 */
function extractUniformFrames(
  videoPath: string,
  outputDir: string,
  fps: number,
  maxFrames: number,
  quality: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .fps(fps)
      .frames(maxFrames)
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions([
        `-q:v ${Math.ceil((100 - quality) / 3)}`, // Map quality to FFmpeg scale
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Extract frames at scene changes (more intelligent selection)
 */
function extractSceneChangeFrames(
  videoPath: string,
  outputDir: string,
  maxFrames: number,
  quality: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .complexFilter([
        // Scene change detection
        {
          filter: 'select',
          options: `gt(scene\\,0.3)`,
          outputs: 'scenes',
        },
        // Limit frames
        {
          filter: 'select',
          options: `lt(n\\,${maxFrames})`,
          inputs: 'scenes',
        },
      ])
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions([`-q:v ${Math.ceil((100 - quality) / 3)}`])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Get video metadata
 */
function getVideoMetadata(
  videoPath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
      });
    });
  });
}