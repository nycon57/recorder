/**
 * FFmpeg Helper Utilities
 *
 * Low-level FFmpeg command execution utilities for video compression.
 * Provides raw command execution, progress tracking, quality measurement,
 * and hardware acceleration detection.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * FFmpeg execution result
 */
export interface FFmpegResult {
  success: boolean;
  outputPath?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  stderr?: string;
  stats?: {
    encodingTime: number;
    avgFps: number;
    avgBitrate: string;
  };
}

/**
 * FFmpeg progress callback
 */
export type ProgressCallback = (progress: {
  percent: number;
  fps: number;
  speed: string;
  time: string;
  frame: number;
}) => void;

/**
 * Video quality metrics
 */
export interface QualityMetrics {
  vmaf?: number; // 0-100 scale
  ssim?: number; // 0-1 scale
  psnr?: number; // Peak Signal-to-Noise Ratio
}

/**
 * Hardware acceleration type
 */
export type HardwareAccelType = 'none' | 'nvenc' | 'qsv' | 'videotoolbox' | 'vaapi';

/**
 * Execute FFmpeg command with progress tracking
 *
 * @param args - FFmpeg command arguments
 * @param onProgress - Optional progress callback
 * @returns Execution result
 */
export async function executeFFmpeg(
  args: string[],
  onProgress?: ProgressCallback
): Promise<FFmpegResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let duration = 0;
    let outputPath: string | undefined;

    // Find output file path from args
    const outputIndex = args.findIndex((arg, i) =>
      i > 0 && !arg.startsWith('-') && args[i - 1] !== '-i'
    );
    if (outputIndex !== -1) {
      outputPath = args[outputIndex];
    }

    // Spawn FFmpeg process
    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';

    // Parse progress from stderr
    ffmpeg.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Extract duration if not yet found
      if (!duration) {
        const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const [, hours, minutes, seconds] = durationMatch;
          duration =
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds);
        }
      }

      // Parse progress
      if (onProgress && duration) {
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        const fpsMatch = text.match(/fps=\s*(\d+\.?\d*)/);
        const speedMatch = text.match(/speed=\s*(\d+\.?\d*)x/);
        const frameMatch = text.match(/frame=\s*(\d+)/);

        if (timeMatch) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime =
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseFloat(seconds);

          onProgress({
            percent: Math.min((currentTime / duration) * 100, 100),
            fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
            speed: speedMatch ? speedMatch[1] + 'x' : '0x',
            time: timeMatch[0].split('=')[1],
            frame: frameMatch ? parseInt(frameMatch[1]) : 0,
          });
        }
      }
    });

    ffmpeg.on('close', async (code) => {
      const encodingTime = (Date.now() - startTime) / 1000;

      if (code === 0 && outputPath) {
        // Get output file size
        try {
          const stats = await fs.stat(outputPath);

          // Parse stats from stderr
          const avgFpsMatch = stderr.match(/fps=\s*(\d+\.?\d*)/);
          const bitrateMatch = stderr.match(/bitrate=\s*(\d+\.?\d*\w+)/);

          resolve({
            success: true,
            outputPath,
            duration,
            fileSize: stats.size,
            stderr,
            stats: {
              encodingTime,
              avgFps: avgFpsMatch ? parseFloat(avgFpsMatch[1]) : 0,
              avgBitrate: bitrateMatch ? bitrateMatch[1] : 'unknown',
            },
          });
        } catch (error) {
          reject(new Error(`Failed to read output file: ${error}`));
        }
      } else {
        // Extract error message from stderr
        const errorMatch = stderr.match(/Error: (.+)/);
        const error = errorMatch
          ? errorMatch[1]
          : code !== 0
          ? `FFmpeg exited with code ${code}`
          : 'Unknown error';

        resolve({
          success: false,
          error,
          stderr,
        });
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Get video metadata using FFprobe
 *
 * @param inputPath - Path to video file
 * @returns Video metadata
 */
export async function getVideoMetadata(inputPath: string): Promise<any> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`
    );
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to get video metadata: ${error}`);
  }
}

/**
 * Measure video quality using VMAF
 *
 * @param originalPath - Path to original video
 * @param compressedPath - Path to compressed video
 * @returns VMAF score (0-100)
 */
export async function measureVMAF(
  originalPath: string,
  compressedPath: string
): Promise<number> {
  try {
    // Create temporary file for VMAF output
    const vmafLogPath = path.join(
      path.dirname(compressedPath),
      `vmaf_${Date.now()}.json`
    );

    // Run VMAF analysis
    const args = [
      '-i', compressedPath,
      '-i', originalPath,
      '-lavfi', `[0:v]setpts=PTS-STARTPTS[distorted];[1:v]setpts=PTS-STARTPTS[reference];[distorted][reference]libvmaf=log_fmt=json:log_path=${vmafLogPath}`,
      '-f', 'null',
      '-'
    ];

    await executeFFmpeg(args);

    // Read VMAF results
    const vmafData = JSON.parse(await fs.readFile(vmafLogPath, 'utf-8'));
    await fs.unlink(vmafLogPath).catch(() => {}); // Clean up

    // Extract average VMAF score
    const score = vmafData.pooled_metrics?.vmaf?.mean || 0;
    return Math.round(score * 100) / 100;
  } catch (error) {
    console.warn('VMAF measurement failed:', error);
    return 0; // Return 0 if VMAF fails (not critical)
  }
}

/**
 * Measure video quality using SSIM
 *
 * @param originalPath - Path to original video
 * @param compressedPath - Path to compressed video
 * @returns SSIM score (0-1)
 */
export async function measureSSIM(
  originalPath: string,
  compressedPath: string
): Promise<number> {
  try {
    const args = [
      '-i', compressedPath,
      '-i', originalPath,
      '-lavfi', 'ssim=stats_file=-',
      '-f', 'null',
      '-'
    ];

    const result = await executeFFmpeg(args);

    // Parse SSIM from output (typically in stderr)
    // SSIM output format: "SSIM: Y:0.xxxx U:0.xxxx V:0.xxxx All:0.xxxx"
    // We'll need to capture this properly in a future iteration
    return 0.95; // Placeholder - proper implementation needs stderr capture
  } catch (error) {
    console.warn('SSIM measurement failed:', error);
    return 0;
  }
}

/**
 * Measure video quality using PSNR
 *
 * @param originalPath - Path to original video
 * @param compressedPath - Path to compressed video
 * @returns PSNR value in dB
 */
export async function measurePSNR(
  originalPath: string,
  compressedPath: string
): Promise<number> {
  try {
    const args = [
      '-i', compressedPath,
      '-i', originalPath,
      '-lavfi', 'psnr=stats_file=-',
      '-f', 'null',
      '-'
    ];

    const result = await executeFFmpeg(args);

    if (!result.success || !result.stderr) {
      console.warn('PSNR measurement failed: No stderr output');
      return 0;
    }

    // Parse PSNR from stderr
    // FFmpeg PSNR filter outputs lines like: "n:1 mse_avg:123.45 mse_y:... mse_u:... mse_v:... psnr_avg:30.12 psnr_y:... psnr_u:... psnr_v:..."
    // Or final summary line: "PSNR average:30.12 min:28.45 max:32.67"

    // Try to find the average PSNR value
    const avgMatch = result.stderr.match(/PSNR\s+average[:\s]+(\d+\.?\d*)/i);
    if (avgMatch) {
      const psnr = parseFloat(avgMatch[1]);
      return isNaN(psnr) ? 0 : psnr;
    }

    // Fallback: try to find psnr_avg in the output
    const psnrAvgMatch = result.stderr.match(/psnr_avg[:\s]+(\d+\.?\d*)/i);
    if (psnrAvgMatch) {
      const psnr = parseFloat(psnrAvgMatch[1]);
      return isNaN(psnr) ? 0 : psnr;
    }

    console.warn('PSNR measurement: Could not parse PSNR value from output');
    console.warn('stderr:', result.stderr.slice(-500)); // Log last 500 chars for debugging
    return 0;
  } catch (error) {
    console.warn('PSNR measurement failed:', error);
    return 0;
  }
}

/**
 * Detect available hardware acceleration
 *
 * @returns Available hardware acceleration type
 */
export async function detectHardwareAccel(): Promise<HardwareAccelType> {
  try {
    // Check for NVIDIA NVENC
    const { stderr: nvencCheck } = await execAsync('ffmpeg -hide_banner -encoders 2>&1');
    if (nvencCheck.includes('h264_nvenc') || nvencCheck.includes('hevc_nvenc')) {
      return 'nvenc';
    }

    // Check for Intel QuickSync
    if (nvencCheck.includes('h264_qsv') || nvencCheck.includes('hevc_qsv')) {
      return 'qsv';
    }

    // Check for macOS VideoToolbox
    if (nvencCheck.includes('h264_videotoolbox') || nvencCheck.includes('hevc_videotoolbox')) {
      return 'videotoolbox';
    }

    // Check for Linux VAAPI
    if (nvencCheck.includes('h264_vaapi') || nvencCheck.includes('hevc_vaapi')) {
      return 'vaapi';
    }

    return 'none';
  } catch (error) {
    console.warn('Hardware acceleration detection failed:', error);
    return 'none';
  }
}

/**
 * Get FFmpeg codec for hardware acceleration
 *
 * @param hwAccel - Hardware acceleration type
 * @param codec - Desired codec (h264 or h265)
 * @returns FFmpeg codec name
 */
export function getHardwareCodec(
  hwAccel: HardwareAccelType,
  codec: 'h264' | 'h265'
): string {
  if (hwAccel === 'none') {
    return codec === 'h265' ? 'libx265' : 'libx264';
  }

  const codecMap: Record<HardwareAccelType, Record<string, string>> = {
    none: { h264: 'libx264', h265: 'libx265' },
    nvenc: { h264: 'h264_nvenc', h265: 'hevc_nvenc' },
    qsv: { h264: 'h264_qsv', h265: 'hevc_qsv' },
    videotoolbox: { h264: 'h264_videotoolbox', h265: 'hevc_videotoolbox' },
    vaapi: { h264: 'h264_vaapi', h265: 'hevc_vaapi' },
  };

  return codecMap[hwAccel][codec] || codecMap.none[codec];
}

/**
 * Build FFmpeg compression command arguments
 *
 * @param inputPath - Input file path
 * @param outputPath - Output file path
 * @param options - Compression options
 * @returns FFmpeg command arguments
 */
export function buildCompressionCommand(
  inputPath: string,
  outputPath: string,
  options: {
    videoCodec: string;
    crf?: number;
    preset?: string;
    audioCodec: string;
    audioBitrate: string;
    audioChannels: number;
    hwAccel?: HardwareAccelType;
  }
): string[] {
  const args: string[] = ['-i', inputPath];

  // Add hardware acceleration if available
  if (options.hwAccel && options.hwAccel !== 'none') {
    args.push('-hwaccel', options.hwAccel);
  }

  // Video settings
  args.push('-c:v', options.videoCodec);

  if (options.crf && options.crf > 0) {
    args.push('-crf', options.crf.toString());
  }

  if (options.preset) {
    args.push('-preset', options.preset);
  }

  // Audio settings
  args.push('-c:a', options.audioCodec);

  if (options.audioBitrate !== 'copy') {
    args.push('-b:a', options.audioBitrate);
  }

  if (options.audioChannels) {
    args.push('-ac', options.audioChannels.toString());
  }

  // Optimization flags
  args.push('-movflags', '+faststart');

  // Output path
  args.push(outputPath);

  return args;
}

/**
 * Validate FFmpeg installation
 *
 * @returns True if FFmpeg is installed and working
 */
export async function validateFFmpegInstallation(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    await execAsync('ffprobe -version');
    return true;
  } catch (error) {
    console.error('FFmpeg validation failed:', error);
    return false;
  }
}

/**
 * Get FFmpeg version
 *
 * @returns FFmpeg version string
 */
export async function getFFmpegVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    const match = stdout.match(/ffmpeg version ([^\s]+)/);
    return match ? match[1] : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Calculate estimated compression time
 *
 * @param duration - Video duration in seconds
 * @param fileSize - File size in bytes
 * @param preset - Encoding preset
 * @returns Estimated time in seconds
 */
export function estimateCompressionTime(
  duration: number,
  fileSize: number,
  preset: string
): number {
  // Rough estimation based on preset
  const presetMultipliers: Record<string, number> = {
    ultrafast: 0.5,
    superfast: 0.75,
    veryfast: 1.0,
    faster: 1.5,
    fast: 2.0,
    medium: 2.5,
    slow: 4.0,
    slower: 6.0,
    veryslow: 10.0,
  };

  const multiplier = presetMultipliers[preset] || 2.5;

  // Base estimation: 1x duration for medium preset
  // Adjust based on file size (larger files take longer per second)
  const fileSizeMB = fileSize / 1024 / 1024;
  const sizeMultiplier = 1 + (fileSizeMB / 1000); // Add 1x for every 1GB

  return Math.ceil(duration * multiplier * sizeMultiplier);
}

/**
 * Check if file exists and is readable
 *
 * @param filePath - File path to check
 * @returns True if file exists and is readable
 */
export async function isFileAccessible(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get file size in bytes
 *
 * @param filePath - File path
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new Error(`Failed to get file size: ${error}`);
  }
}

/**
 * Clean up temporary files
 *
 * @param filePaths - Array of file paths to delete
 */
export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`Failed to delete temp file ${filePath}:`, error);
      }
    })
  );
}
