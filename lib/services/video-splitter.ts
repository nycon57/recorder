/**
 * Video Splitter Service
 *
 * Splits long videos into segments for processing videos that exceed
 * the Gemini context window limit (~58 minutes).
 *
 * Uses FFmpeg's segment muxer for lossless splitting at keyframes.
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'video-splitter' });

/**
 * Segment information
 */
export interface VideoSegment {
  index: number;
  path: string;
  duration: number;
  startTime: number;
  endTime: number;
}

/**
 * Split result
 */
export interface SplitResult {
  success: boolean;
  segments: VideoSegment[];
  totalDuration: number;
  error?: string;
}

/**
 * Split options
 */
export interface SplitOptions {
  /** Target segment duration in seconds (default: 25 minutes) */
  segmentDuration?: number;
  /** Output directory (default: same as input) */
  outputDir?: string;
  /** Progress callback */
  onProgress?: (percent: number, message: string) => void;
}

// Default segment duration: 25 minutes (safe margin under 30-minute Gemini limit)
const DEFAULT_SEGMENT_DURATION = 25 * 60; // 1500 seconds

// Maximum video duration we'll attempt to split (60 minutes)
const MAX_SPLITTABLE_DURATION = 60 * 60; // 3600 seconds

// Minimum duration to trigger splitting (30 minutes)
export const SPLIT_THRESHOLD_SECONDS = 30 * 60; // 1800 seconds

/**
 * Check if a video should be split based on duration
 */
export function shouldSplitVideo(durationSeconds: number): boolean {
  return durationSeconds > SPLIT_THRESHOLD_SECONDS;
}

/**
 * Get video duration using FFprobe
 */
export async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);

    let output = '';
    let error = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration)) {
          resolve(duration);
          return;
        }
      }
      reject(new Error(`Failed to get video duration: ${error || 'Unknown error'}`));
    });
  });
}

/**
 * Split video into segments using FFmpeg segment muxer
 *
 * Uses lossless copy mode (-c copy) for fast splitting without re-encoding.
 * Splits occur at keyframes, so segment durations may vary slightly.
 *
 * @param inputPath - Path to input video file
 * @param options - Split options
 * @returns Split result with segment information
 */
export async function splitVideoIntoSegments(
  inputPath: string,
  options: SplitOptions = {}
): Promise<SplitResult> {
  const {
    segmentDuration = DEFAULT_SEGMENT_DURATION,
    outputDir,
    onProgress,
  } = options;

  const inputDir = path.dirname(inputPath);
  const inputExt = path.extname(inputPath);
  const inputBase = path.basename(inputPath, inputExt);
  const segmentDir = outputDir || inputDir;

  logger.info('Starting video split', {
    context: {
      inputPath,
      segmentDuration,
      segmentDir,
    },
  });

  try {
    // Get video duration first
    const totalDuration = await getVideoDuration(inputPath);

    logger.info('Video duration detected', {
      context: {
        totalDuration,
        totalMinutes: Math.round(totalDuration / 60),
        expectedSegments: Math.ceil(totalDuration / segmentDuration),
      },
    });

    // Validate duration
    if (totalDuration > MAX_SPLITTABLE_DURATION) {
      return {
        success: false,
        segments: [],
        totalDuration,
        error: `Video duration (${Math.round(totalDuration / 60)} min) exceeds maximum splittable duration (${MAX_SPLITTABLE_DURATION / 60} min)`,
      };
    }

    if (!shouldSplitVideo(totalDuration)) {
      logger.info('Video does not need splitting', {
        context: { totalDuration, threshold: SPLIT_THRESHOLD_SECONDS },
      });
      return {
        success: true,
        segments: [{
          index: 0,
          path: inputPath,
          duration: totalDuration,
          startTime: 0,
          endTime: totalDuration,
        }],
        totalDuration,
      };
    }

    // Ensure output directory exists
    await fs.mkdir(segmentDir, { recursive: true });

    // Create segment list file path
    const segmentListPath = path.join(segmentDir, `${inputBase}_segments.csv`);
    const outputPattern = path.join(segmentDir, `${inputBase}_segment_%03d${inputExt}`);

    if (onProgress) {
      onProgress(5, 'Preparing to split video...');
    }

    // Execute FFmpeg segmentation
    const segments = await executeSegmentation(
      inputPath,
      outputPattern,
      segmentListPath,
      segmentDuration,
      totalDuration,
      onProgress
    );

    logger.info('Video split complete', {
      context: {
        segmentCount: segments.length,
        segments: segments.map(s => ({
          index: s.index,
          duration: Math.round(s.duration),
        })),
      },
    });

    return {
      success: true,
      segments,
      totalDuration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video split failed', {
      context: { inputPath },
      error: error as Error,
    });

    return {
      success: false,
      segments: [],
      totalDuration: 0,
      error: errorMessage,
    };
  }
}

/**
 * Execute FFmpeg segmentation command
 */
async function executeSegmentation(
  inputPath: string,
  outputPattern: string,
  segmentListPath: string,
  segmentDuration: number,
  totalDuration: number,
  onProgress?: (percent: number, message: string) => void
): Promise<VideoSegment[]> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c', 'copy',                    // Lossless copy (no re-encoding)
      '-map', '0',                     // Copy all streams
      '-f', 'segment',                 // Segment muxer
      '-segment_time', segmentDuration.toString(),
      '-reset_timestamps', '1',        // Reset timestamps per segment
      '-segment_list_type', 'csv',
      '-segment_list', segmentListPath,
      '-y',                            // Overwrite output files
      outputPattern,
    ];

    logger.debug('FFmpeg segment command', {
      context: { args: args.join(' ') },
    });

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    let lastProgress = 0;

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress from time output
      const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch && onProgress) {
        const [, hours, minutes, seconds] = timeMatch;
        const currentTime =
          parseInt(hours) * 3600 +
          parseInt(minutes) * 60 +
          parseFloat(seconds);

        const progress = Math.min(Math.round((currentTime / totalDuration) * 90) + 5, 95);
        if (progress > lastProgress) {
          lastProgress = progress;
          onProgress(progress, `Splitting video... ${Math.round(currentTime / 60)}/${Math.round(totalDuration / 60)} min`);
        }
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg segmentation failed with code ${code}: ${stderr.slice(-500)}`));
        return;
      }

      if (onProgress) {
        onProgress(95, 'Parsing segment information...');
      }

      try {
        // Parse segment list CSV
        const segments = await parseSegmentList(segmentListPath);

        if (onProgress) {
          onProgress(100, `Split complete: ${segments.length} segments`);
        }

        resolve(segments);
      } catch (parseError) {
        reject(new Error(`Failed to parse segment list: ${parseError}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Parse FFmpeg segment list CSV file
 *
 * Format: segment_filename,start_time,end_time
 */
async function parseSegmentList(listPath: string): Promise<VideoSegment[]> {
  const content = await fs.readFile(listPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  const segments: VideoSegment[] = [];
  const listDir = path.dirname(listPath);

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 3) {
      const [filename, startTime, endTime] = parts;
      const segmentPath = path.isAbsolute(filename)
        ? filename
        : path.join(listDir, filename);

      segments.push({
        index: i,
        path: segmentPath,
        startTime: parseFloat(startTime),
        endTime: parseFloat(endTime),
        duration: parseFloat(endTime) - parseFloat(startTime),
      });
    }
  }

  return segments;
}

/**
 * Clean up segment files after processing
 */
export async function cleanupSegments(segments: VideoSegment[]): Promise<void> {
  for (const segment of segments) {
    try {
      await fs.unlink(segment.path);
      logger.debug('Cleaned up segment file', {
        context: { path: segment.path },
      });
    } catch (error) {
      logger.warn('Failed to clean up segment file', {
        context: { path: segment.path },
        error: error as Error,
      });
    }
  }

  // Also clean up segment list file if it exists
  if (segments.length > 0) {
    const segmentDir = path.dirname(segments[0].path);
    const listFiles = await fs.readdir(segmentDir);
    for (const file of listFiles) {
      if (file.endsWith('_segments.csv')) {
        try {
          await fs.unlink(path.join(segmentDir, file));
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}

/**
 * Estimate processing time for segmented video
 *
 * @param totalDuration - Total video duration in seconds
 * @param segmentCount - Number of segments
 * @returns Estimated processing time in minutes
 */
export function estimateSegmentedProcessingTime(
  totalDuration: number,
  segmentCount: number
): number {
  // Splitting: ~10 seconds per minute of video
  const splitTime = (totalDuration / 60) * (10 / 60);

  // Transcription: ~1.5 minutes per minute of video per segment
  // (Segments can be processed in parallel, but we're conservative)
  const transcribeTime = (totalDuration / 60) * 1.5;

  // Merging: ~30 seconds total
  const mergeTime = 0.5;

  return Math.ceil(splitTime + transcribeTime + mergeTime);
}
