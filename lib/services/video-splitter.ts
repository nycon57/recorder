/**
 * Video Splitter Service
 *
 * Splits long videos into segments for progressive processing.
 * Supports videos up to 2 hours with adaptive segment sizing.
 *
 * Segmentation Strategy:
 * - < 30 min: No splitting (single-pass)
 * - 30-60 min: 25-minute segments
 * - 60-120 min: 15-minute segments (better progress granularity)
 *
 * Uses FFmpeg's segment muxer for lossless splitting at keyframes.
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '@/lib/utils/logger';
import {
  SEGMENTATION_CONFIG,
  getOptimalSegmentDuration,
  calculateSegmentCount,
  getProcessingStrategy,
} from '@/lib/types/content';

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
  segmentDuration: number;
  processingStrategy: 'single' | 'segmented';
  error?: string;
}

/**
 * Split options
 */
export interface SplitOptions {
  /** Target segment duration in seconds (auto-calculated if not provided) */
  segmentDuration?: number;
  /** Output directory (default: same as input) */
  outputDir?: string;
  /** Progress callback */
  onProgress?: (percent: number, message: string) => void;
}

// Re-export from content types for backwards compatibility
export const SPLIT_THRESHOLD_SECONDS = SEGMENTATION_CONFIG.SPLIT_THRESHOLD_SECONDS;

/**
 * Check if a video should be split based on duration
 */
export function shouldSplitVideo(durationSeconds: number): boolean {
  return durationSeconds > SEGMENTATION_CONFIG.SPLIT_THRESHOLD_SECONDS;
}

/**
 * Get segment configuration for a given duration
 */
export function getSegmentConfig(totalDurationSeconds: number): {
  shouldSplit: boolean;
  segmentDuration: number;
  expectedSegments: number;
  strategy: 'single' | 'segmented';
} {
  return {
    shouldSplit: shouldSplitVideo(totalDurationSeconds),
    segmentDuration: getOptimalSegmentDuration(totalDurationSeconds),
    expectedSegments: calculateSegmentCount(totalDurationSeconds),
    strategy: getProcessingStrategy(totalDurationSeconds),
  };
}

/**
 * Default timeout for ffprobe operations (30 seconds)
 */
const FFPROBE_TIMEOUT_MS = 30000;

/**
 * Get video duration using FFprobe
 *
 * @param inputPath - Path to video file
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 */
export async function getVideoDuration(
  inputPath: string,
  timeoutMs: number = FFPROBE_TIMEOUT_MS
): Promise<number> {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    let timeoutTimer: NodeJS.Timeout | null = null;

    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);

    let output = '';
    let stderrOutput = '';

    // Cleanup function to remove listeners and clear timer
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      ffprobe.stdout.removeAllListeners('data');
      ffprobe.stderr.removeAllListeners('data');
      ffprobe.removeAllListeners('close');
      ffprobe.removeAllListeners('error');
    };

    // Safe resolve - only settles once
    const safeResolve = (value: number) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(value);
    };

    // Safe reject - only settles once
    const safeReject = (error: Error) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(error);
    };

    // Set up timeout watchdog
    timeoutTimer = setTimeout(() => {
      if (isSettled) return;

      logger.error('ffprobe timeout', {
        context: {
          inputPath,
          timeoutMs,
          stderrTail: stderrOutput.slice(-200),
        },
      });

      // Kill the ffprobe process
      try {
        ffprobe.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }

      safeReject(
        new Error(
          `ffprobe timed out after ${timeoutMs}ms for file: ${inputPath}. ` +
            `This may indicate a corrupted file or inaccessible path.`
        )
      );
    }, timeoutMs);

    // Handle spawn errors (e.g., ffprobe not found, permission denied)
    ffprobe.on('error', (error) => {
      safeReject(
        new Error(`Failed to spawn ffprobe: ${error.message}. Is ffprobe installed?`)
      );
    });

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (isSettled) return;

      if (code === 0 && output.trim()) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration) && duration > 0) {
          safeResolve(duration);
          return;
        }
        safeReject(
          new Error(
            `Invalid duration value from ffprobe: "${output.trim()}". ` +
              `Expected a positive number.`
          )
        );
        return;
      }

      safeReject(
        new Error(
          `ffprobe failed with exit code ${code}: ${stderrOutput || 'Unknown error'}. ` +
            `File: ${inputPath}`
        )
      );
    });
  });
}

/**
 * Split video into segments using FFmpeg segment muxer
 *
 * Uses lossless copy mode (-c copy) for fast splitting without re-encoding.
 * Splits occur at keyframes, so segment durations may vary slightly.
 *
 * Segment duration is automatically calculated based on total video duration:
 * - 30-60 min videos: 25-minute segments
 * - 60+ min videos: 15-minute segments (for better progress tracking)
 *
 * @param inputPath - Path to input video file
 * @param options - Split options
 * @returns Split result with segment information
 */
export async function splitVideoIntoSegments(
  inputPath: string,
  options: SplitOptions = {}
): Promise<SplitResult> {
  const inputDir = path.dirname(inputPath);
  const inputExt = path.extname(inputPath);
  const inputBase = path.basename(inputPath, inputExt);
  const segmentDir = options.outputDir || inputDir;

  logger.info('Starting video split', {
    context: {
      inputPath,
      segmentDir,
    },
  });

  try {
    // Get video duration first
    const totalDuration = await getVideoDuration(inputPath);

    // Get optimal segment configuration
    const segmentConfig = getSegmentConfig(totalDuration);
    const segmentDuration = options.segmentDuration || segmentConfig.segmentDuration;

    logger.info('Video duration detected', {
      context: {
        totalDuration,
        totalMinutes: Math.round(totalDuration / 60),
        segmentDuration: Math.round(segmentDuration / 60),
        expectedSegments: segmentConfig.expectedSegments,
        strategy: segmentConfig.strategy,
      },
    });

    // Validate duration
    if (totalDuration > SEGMENTATION_CONFIG.MAX_DURATION_SECONDS) {
      return {
        success: false,
        segments: [],
        totalDuration,
        segmentDuration,
        processingStrategy: 'segmented',
        error: `Video duration (${Math.round(totalDuration / 60)} min) exceeds maximum supported duration (${SEGMENTATION_CONFIG.MAX_DURATION_SECONDS / 60} min)`,
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
        segmentDuration: totalDuration,
        processingStrategy: 'single',
      };
    }

    // Ensure output directory exists
    await fs.mkdir(segmentDir, { recursive: true });

    // Create segment list file path
    const segmentListPath = path.join(segmentDir, `${inputBase}_segments.csv`);
    const outputPattern = path.join(segmentDir, `${inputBase}_segment_%03d${inputExt}`);

    const { onProgress } = options;

    if (onProgress) {
      onProgress(5, `Preparing to split video into ~${segmentConfig.expectedSegments} segments...`);
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
        segmentDurationMinutes: Math.round(segmentDuration / 60),
        strategy: segmentConfig.strategy,
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
      segmentDuration,
      processingStrategy: segmentConfig.strategy,
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
      segmentDuration: 0,
      processingStrategy: 'segmented',
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
    // Calculate timeout: minimum 2 minutes, or 4x the video duration
    const timeoutMs = Math.max(120000, totalDuration * 4 * 1000);

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
      context: {
        args: args.join(' '),
        timeoutMs,
        totalDuration,
      },
    });

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    let lastProgress = 0;
    let isResolved = false;
    let wasKilledByTimeout = false;

    // Helper to safely resolve/reject only once and cleanup
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      // Remove listeners to prevent memory leaks
      ffmpeg.stderr.removeAllListeners('data');
      ffmpeg.removeAllListeners('close');
      ffmpeg.removeAllListeners('error');
    };

    const safeResolve = (segments: VideoSegment[]) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve(segments);
    };

    const safeReject = (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      reject(error);
    };

    // Set up timeout timer
    let timeoutTimer: NodeJS.Timeout | null = setTimeout(() => {
      if (isResolved) return;

      wasKilledByTimeout = true;
      logger.error('FFmpeg segmentation timeout', {
        context: {
          inputPath,
          timeoutMs,
          totalDuration,
          stderrTail: stderr.slice(-500),
        },
      });

      // Kill the FFmpeg process
      try {
        ffmpeg.kill('SIGKILL');
      } catch {
        // Process may already be dead
      }

      safeReject(new Error(
        `FFmpeg segmentation timed out after ${Math.round(timeoutMs / 1000)}s ` +
        `(video duration: ${Math.round(totalDuration)}s, timeout: ${Math.round(timeoutMs / 1000)}s). ` +
        `Last output: ${stderr.slice(-200)}`
      ));
    }, timeoutMs);

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
      // Skip processing if already resolved (e.g., by timeout)
      if (isResolved) return;

      // Skip segment parsing if killed by timeout
      if (wasKilledByTimeout) {
        return; // safeReject already called by timeout handler
      }

      if (code !== 0) {
        safeReject(new Error(`FFmpeg segmentation failed with code ${code}: ${stderr.slice(-500)}`));
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

        safeResolve(segments);
      } catch (parseError) {
        safeReject(new Error(`Failed to parse segment list: ${parseError}`));
      }
    });

    ffmpeg.on('error', (error) => {
      safeReject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Parse a simple CSV line, handling quoted fields that may contain commas
 *
 * @param line - CSV line to parse
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes (two consecutive quotes)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last field
  fields.push(current);

  return fields;
}

/**
 * Parse FFmpeg segment list CSV file
 *
 * Format: segment_filename,start_time,end_time
 *
 * Validates each row to ensure:
 * - At least 3 fields present
 * - Start and end times are finite numbers
 * - Start time is less than end time
 * - Duration is positive and finite
 *
 * Malformed rows are skipped with a warning logged.
 */
async function parseSegmentList(listPath: string): Promise<VideoSegment[]> {
  const content = await fs.readFile(listPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  const segments: VideoSegment[] = [];
  const listDir = path.dirname(listPath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);

    // Validate we have at least 3 parts
    if (parts.length < 3) {
      logger.warn('Skipping malformed CSV row: insufficient fields', {
        context: {
          lineNumber: i + 1,
          line,
          fieldCount: parts.length,
          expected: 3,
        },
      });
      continue;
    }

    // Trim all parts
    const filename = parts[0].trim();
    const startTimeStr = parts[1].trim();
    const endTimeStr = parts[2].trim();

    // Validate filename is not empty
    if (!filename) {
      logger.warn('Skipping malformed CSV row: empty filename', {
        context: { lineNumber: i + 1, line },
      });
      continue;
    }

    // Parse and validate start time
    const startTime = Number(startTimeStr);
    if (!Number.isFinite(startTime)) {
      logger.warn('Skipping malformed CSV row: invalid start time', {
        context: {
          lineNumber: i + 1,
          line,
          startTimeStr,
          parsedValue: startTime,
        },
      });
      continue;
    }

    // Parse and validate end time
    const endTime = Number(endTimeStr);
    if (!Number.isFinite(endTime)) {
      logger.warn('Skipping malformed CSV row: invalid end time', {
        context: {
          lineNumber: i + 1,
          line,
          endTimeStr,
          parsedValue: endTime,
        },
      });
      continue;
    }

    // Validate start time is less than end time
    if (startTime >= endTime) {
      logger.warn('Skipping malformed CSV row: start time >= end time', {
        context: {
          lineNumber: i + 1,
          line,
          startTime,
          endTime,
        },
      });
      continue;
    }

    // Calculate and validate duration
    const duration = endTime - startTime;
    if (!Number.isFinite(duration) || duration <= 0) {
      logger.warn('Skipping malformed CSV row: invalid duration', {
        context: {
          lineNumber: i + 1,
          line,
          startTime,
          endTime,
          duration,
        },
      });
      continue;
    }

    // Build segment path
    const segmentPath = path.isAbsolute(filename)
      ? filename
      : path.join(listDir, filename);

    // All validations passed - add segment
    segments.push({
      index: segments.length, // Use actual segment count for index
      path: segmentPath,
      startTime,
      endTime,
      duration,
    });
  }

  // Log summary if any rows were skipped
  const skippedCount = lines.length - segments.length;
  if (skippedCount > 0) {
    logger.warn('Some CSV rows were skipped during parsing', {
      context: {
        totalRows: lines.length,
        validSegments: segments.length,
        skippedRows: skippedCount,
      },
    });
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

  // Also clean up the specific segment list file for this operation
  if (segments.length > 0) {
    const segmentDir = path.dirname(segments[0].path);
    const segmentFilename = path.basename(segments[0].path);
    // Segment files are named like "video_segment_000.mp4"
    // The CSV is named like "video_segments.csv"
    // Extract the base name by removing "_segment_XXX" suffix
    const segmentMatch = segmentFilename.match(/^(.+)_segment_\d+/);
    if (segmentMatch) {
      const inputBase = segmentMatch[1];
      const csvFilename = `${inputBase}_segments.csv`;
      try {
        await fs.unlink(path.join(segmentDir, csvFilename));
        logger.debug('Cleaned up segment list file', {
          context: { path: path.join(segmentDir, csvFilename) },
        });
      } catch {
        // Ignore cleanup errors - file may not exist or already deleted
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

/**
 * Pre-split compression result
 */
export interface PreSplitCompressionResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  error?: string;
}

/**
 * Fast compression options for pre-split processing
 */
export interface FastCompressionOptions {
  /** Progress callback */
  onProgress?: (percent: number, message: string) => void;
  /** CRF value (default: 30 - good balance for screen recordings) */
  crf?: number;
  /** Preset (default: 'veryfast' for speed) */
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast';
}

/**
 * Compress video quickly before splitting
 *
 * Uses fast settings optimized for:
 * - Speed over maximum compression
 * - Preserving enough quality for AI analysis
 * - Screen recording content (high text clarity)
 *
 * @param inputPath - Path to input video
 * @param options - Compression options
 * @returns Compression result with output path and statistics
 */
export async function compressVideoBeforeSplit(
  inputPath: string,
  options: FastCompressionOptions = {}
): Promise<PreSplitCompressionResult> {
  const {
    onProgress,
    crf = 30, // Good balance: visible quality, significant size reduction
    preset = 'veryfast', // Fast encoding
  } = options;

  const startTime = Date.now();
  const inputDir = path.dirname(inputPath);
  const inputExt = path.extname(inputPath);
  const inputBase = path.basename(inputPath, inputExt);
  const outputPath = path.join(inputDir, `${inputBase}_compressed.mp4`);

  logger.info('Starting pre-split compression', {
    context: {
      inputPath,
      outputPath,
      crf,
      preset,
    },
  });

  if (onProgress) {
    onProgress(0, 'Starting video compression...');
  }

  try {
    // Get original file size
    const inputStats = await fs.stat(inputPath);
    const originalSize = inputStats.size;

    // Get video duration for progress tracking
    const duration = await getVideoDuration(inputPath);

    // Build FFmpeg compression command
    // Using libx264 with fast preset for speed
    // CRF 30 provides good compression with acceptable quality for AI analysis
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf.toString(),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart', // Optimize for streaming
      '-y', // Overwrite output
      outputPath,
    ];

    logger.debug('FFmpeg compression command', {
      context: { args: args.join(' ') },
    });

    // Execute compression
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      let lastProgress = 0;

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;

        // Parse progress from time output
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && onProgress && duration > 0) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime =
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds);

          const progress = Math.min(Math.round((currentTime / duration) * 95), 95);
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress, `Compressing video... ${Math.round(currentTime / 60)}/${Math.round(duration / 60)} min`);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg compression failed with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });
    });

    // Get compressed file size
    const outputStats = await fs.stat(outputPath);
    const compressedSize = outputStats.size;
    const compressionRatio = originalSize / compressedSize;
    const compressionTime = (Date.now() - startTime) / 1000;

    logger.info('Pre-split compression complete', {
      context: {
        originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
        compressedSizeMB: (compressedSize / 1024 / 1024).toFixed(2),
        compressionRatio: compressionRatio.toFixed(2),
        compressionTime: compressionTime.toFixed(1),
        savingsPercent: ((1 - compressedSize / originalSize) * 100).toFixed(1),
      },
    });

    if (onProgress) {
      onProgress(100, `Compression complete (${((1 - compressedSize / originalSize) * 100).toFixed(0)}% smaller)`);
    }

    return {
      success: true,
      outputPath,
      originalSize,
      compressedSize,
      compressionRatio,
      compressionTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Compression failed';

    logger.error('Pre-split compression failed', {
      context: { inputPath },
      error: error as Error,
    });

    // Clean up partial output if exists
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      outputPath: inputPath, // Fall back to original
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 1,
      compressionTime: 0,
      error: errorMessage,
    };
  }
}
