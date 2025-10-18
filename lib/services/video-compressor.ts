/**
 * Video Compressor Service
 *
 * High-level service for intelligent video compression.
 * Analyzes video content, selects optimal compression settings,
 * executes compression, validates quality, and updates database.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import type { ContentType, CompressionStats } from '@/lib/types/database';
import {
  selectCompressionConfig,
  type CompressionConfig,
  type CompressionPreferences,
} from './compression-profile-selector';
import {
  executeFFmpeg,
  getVideoMetadata,
  measureVMAF,
  detectHardwareAccel,
  buildCompressionCommand,
  validateFFmpegInstallation,
  getFileSize,
  cleanupTempFiles,
  estimateCompressionTime,
  type ProgressCallback,
} from '@/lib/utils/ffmpeg-helpers';

/**
 * Compression result with detailed statistics
 */
export interface CompressionResult {
  success: boolean;
  outputPath?: string;
  stats?: CompressionStats;
  error?: string;
  warning?: string;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Input file path (must be absolute) */
  inputPath: string;
  /** Output file path (must be absolute) */
  outputPath: string;
  /** Content type */
  contentType: ContentType;
  /** File size in bytes */
  fileSize: number;
  /** Organization compression preferences */
  preferences?: Partial<CompressionPreferences>;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Whether to validate quality (VMAF) after compression */
  validateQuality?: boolean;
  /** Minimum VMAF score to accept (default: 85) */
  minVMAF?: number;
}

/**
 * Video Compressor Service
 */
export class VideoCompressor {
  private static hwAccel: string | null = null;
  private static ffmpegValidated: boolean | null = null;

  /**
   * Initialize compressor (validate FFmpeg, detect hardware acceleration)
   */
  static async initialize(): Promise<void> {
    // Validate FFmpeg installation
    if (this.ffmpegValidated === null) {
      this.ffmpegValidated = await validateFFmpegInstallation();
      if (!this.ffmpegValidated) {
        throw new Error('FFmpeg is not installed or not accessible');
      }
    }

    // Detect hardware acceleration
    if (this.hwAccel === null) {
      this.hwAccel = await detectHardwareAccel();
      console.log(`[VideoCompressor] Hardware acceleration: ${this.hwAccel}`);
    }
  }

  /**
   * Compress video with intelligent settings
   *
   * @param options - Compression options
   * @returns Compression result with statistics
   */
  static async compressVideo(options: CompressionOptions): Promise<CompressionResult> {
    const startTime = Date.now();

    try {
      // Initialize if needed
      await this.initialize();

      // Validate input file exists
      try {
        await fs.access(options.inputPath, fs.constants.R_OK);
      } catch (error) {
        return {
          success: false,
          error: `Input file not accessible: ${options.inputPath}`,
        };
      }

      // Get video metadata for analysis
      console.log('[VideoCompressor] Extracting metadata...');
      const metadata = await getVideoMetadata(options.inputPath);

      // Select compression configuration
      console.log('[VideoCompressor] Selecting compression profile...');
      const config = await selectCompressionConfig(
        options.contentType,
        options.fileSize,
        metadata,
        options.preferences
      );

      // Check if compression is needed
      if (!config.shouldCompress) {
        console.log(`[VideoCompressor] Skipping compression: ${config.reasoning}`);
        return {
          success: true,
          outputPath: options.inputPath, // Use original file
          warning: config.reasoning,
        };
      }

      // Ensure output directory exists
      const outputDir = path.dirname(options.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build FFmpeg command
      const ffmpegArgs = buildCompressionCommand(
        options.inputPath,
        options.outputPath,
        {
          videoCodec: config.videoCodec,
          crf: config.crf,
          preset: config.preset,
          audioCodec: config.audioCodec,
          audioBitrate: config.audioBitrate,
          audioChannels: config.audioChannels,
          hwAccel: this.hwAccel as any,
        }
      );

      console.log('[VideoCompressor] Starting compression...');
      console.log(`[VideoCompressor] Profile: ${config.profile}`);
      console.log(`[VideoCompressor] CRF: ${config.crf}, Preset: ${config.preset}`);
      console.log(`[VideoCompressor] Estimated time: ${estimateCompressionTime(
        metadata.format?.duration || 0,
        options.fileSize,
        config.preset
      )}s`);

      // Execute compression
      const result = await executeFFmpeg(ffmpegArgs, options.onProgress);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Compression failed',
        };
      }

      const encodingTime = (Date.now() - startTime) / 1000;

      // Get file sizes
      const originalSize = await getFileSize(options.inputPath);
      const compressedSize = await getFileSize(options.outputPath);

      // Guard against division by zero
      let compressionRatio: number;
      if (!compressedSize || compressedSize === 0) {
        console.error('[VideoCompressor] Compressed file size is 0, compression failed');
        // Delete invalid output file
        await fs.unlink(options.outputPath).catch(() => {});
        return {
          success: false,
          error: 'Compression produced an empty file',
        };
      }
      compressionRatio = originalSize / compressedSize;

      console.log('[VideoCompressor] Compression complete');
      console.log(`[VideoCompressor] Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`[VideoCompressor] Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`[VideoCompressor] Ratio: ${compressionRatio.toFixed(2)}x`);
      console.log(`[VideoCompressor] Time: ${encodingTime.toFixed(2)}s`);

      // Validate quality if requested
      let qualityScore: { vmaf?: number; ssim?: number } | undefined;

      if (options.validateQuality !== false) {
        console.log('[VideoCompressor] Validating quality (VMAF)...');
        try {
          const vmaf = await measureVMAF(options.inputPath, options.outputPath);
          qualityScore = { vmaf };

          const minVMAF = options.minVMAF || 85;
          if (vmaf < minVMAF) {
            console.warn(
              `[VideoCompressor] Quality below threshold: VMAF ${vmaf} < ${minVMAF}`
            );

            // Delete low-quality output
            await fs.unlink(options.outputPath).catch(() => {});

            return {
              success: false,
              error: `Compression quality too low (VMAF: ${vmaf}, required: ${minVMAF}). Original file preserved.`,
            };
          }

          console.log(`[VideoCompressor] Quality validated: VMAF ${vmaf}`);
        } catch (error) {
          console.warn('[VideoCompressor] Quality validation failed:', error);
          // Continue without quality validation if it fails
        }
      }

      // Build compression stats
      const stats: CompressionStats = {
        original_size: originalSize,
        compressed_size: compressedSize,
        compression_ratio: compressionRatio,
        codec: config.videoCodec,
        crf: config.crf,
        preset: config.preset,
        audio_codec: config.audioCodec,
        audio_bitrate: config.audioBitrate,
        encoding_time_seconds: encodingTime,
        quality_score: qualityScore,
        profile: config.profile,
        compressed_at: new Date().toISOString(),
      };

      return {
        success: true,
        outputPath: options.outputPath,
        stats,
      };
    } catch (error) {
      console.error('[VideoCompressor] Compression error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Compress audio file
   *
   * @param options - Compression options
   * @returns Compression result
   */
  static async compressAudio(options: CompressionOptions): Promise<CompressionResult> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Validate input
      try {
        await fs.access(options.inputPath, fs.constants.R_OK);
      } catch (error) {
        return {
          success: false,
          error: `Input file not accessible: ${options.inputPath}`,
        };
      }

      // Get audio metadata
      const metadata = await getVideoMetadata(options.inputPath);

      // Select compression configuration
      const config = await selectCompressionConfig(
        'audio',
        options.fileSize,
        metadata,
        options.preferences
      );

      if (!config.shouldCompress) {
        return {
          success: true,
          outputPath: options.inputPath,
          warning: config.reasoning,
        };
      }

      // Ensure output directory exists
      const outputDir = path.dirname(options.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build FFmpeg command for audio
      const args = [
        '-i', options.inputPath,
        '-vn', // No video
        '-c:a', config.audioCodec,
        '-b:a', config.audioBitrate,
        '-ac', config.audioChannels.toString(),
        options.outputPath,
      ];

      console.log('[VideoCompressor] Compressing audio...');
      const result = await executeFFmpeg(args, options.onProgress);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Audio compression failed',
        };
      }

      const encodingTime = (Date.now() - startTime) / 1000;
      const originalSize = await getFileSize(options.inputPath);
      const compressedSize = await getFileSize(options.outputPath);

      // Guard against division by zero
      let compressionRatio: number;
      if (!compressedSize || compressedSize === 0) {
        console.error('[VideoCompressor] Compressed audio file size is 0, compression failed');
        // Delete invalid output file
        await fs.unlink(options.outputPath).catch(() => {});
        return {
          success: false,
          error: 'Audio compression produced an empty file',
        };
      }
      compressionRatio = originalSize / compressedSize;

      const stats: CompressionStats = {
        original_size: originalSize,
        compressed_size: compressedSize,
        compression_ratio: compressionRatio,
        codec: 'none',
        crf: 0,
        audio_codec: config.audioCodec,
        audio_bitrate: config.audioBitrate,
        encoding_time_seconds: encodingTime,
        profile: config.profile,
        compressed_at: new Date().toISOString(),
      };

      return {
        success: true,
        outputPath: options.outputPath,
        stats,
      };
    } catch (error) {
      console.error('[VideoCompressor] Audio compression error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Estimate compression savings for a file
   *
   * @param contentType - Content type
   * @param fileSize - File size in bytes
   * @param metadata - Optional video metadata
   * @returns Estimated savings in bytes
   */
  static async estimateSavings(
    contentType: ContentType,
    fileSize: number,
    metadata?: any
  ): Promise<{
    estimatedCompressedSize: number;
    estimatedSavings: number;
    estimatedRatio: number;
  }> {
    const config = await selectCompressionConfig(contentType, fileSize, metadata);

    // Estimate based on profile
    let estimatedRatio = 1.0;

    if (config.profile === 'screenRecording') {
      estimatedRatio = 0.2; // 80% reduction
    } else if (config.profile === 'uploadedVideo') {
      estimatedRatio = 0.35; // 65% reduction
    } else if (config.profile === 'highQuality') {
      estimatedRatio = 0.55; // 45% reduction
    } else if (config.profile === 'audioVoice') {
      estimatedRatio = 0.25; // 75% reduction
    } else if (config.profile === 'audioMusic') {
      estimatedRatio = 0.45; // 55% reduction
    }

    const estimatedCompressedSize = Math.ceil(fileSize * estimatedRatio);
    const estimatedSavings = fileSize - estimatedCompressedSize;

    return {
      estimatedCompressedSize,
      estimatedSavings,
      estimatedRatio,
    };
  }

  /**
   * Get supported video formats
   */
  static getSupportedVideoFormats(): string[] {
    return ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv'];
  }

  /**
   * Get supported audio formats
   */
  static getSupportedAudioFormats(): string[] {
    return ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'];
  }
}
