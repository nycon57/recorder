/**
 * Media Processor Service
 *
 * Video, audio, and image processing service using fluent-ffmpeg.
 * Handles format conversion, thumbnail generation, audio extraction, and media validation.
 */

import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { supabaseAdmin } from '@/lib/supabase/admin';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

export interface MediaInfo {
  format: string;
  duration?: number;
  bitrate?: number;
  size: number;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  audioChannels?: number;
  audioSampleRate?: number;
}

export interface ProcessingOptions {
  /** Output format */
  format?: 'mp4' | 'webm' | 'mp3' | 'wav' | 'jpg' | 'png' | 'gif';
  /** Video codec */
  videoCodec?: 'libx264' | 'libvpx' | 'h264' | 'copy';
  /** Audio codec */
  audioCodec?: 'aac' | 'libvorbis' | 'mp3' | 'copy';
  /** Video bitrate (e.g., '1000k') */
  videoBitrate?: string;
  /** Audio bitrate (e.g., '128k') */
  audioBitrate?: string;
  /** Output width */
  width?: number;
  /** Output height */
  height?: number;
  /** Frame rate */
  frameRate?: number;
  /** Quality (for images: 1-100) */
  quality?: number;
  /** Start time (in seconds) */
  startTime?: number;
  /** Duration (in seconds) */
  duration?: number;
  /** Maintain aspect ratio */
  aspectRatio?: boolean;
}

export interface ThumbnailOptions {
  /** Timestamp to capture (in seconds) */
  timestamp?: number;
  /** Number of thumbnails to generate */
  count?: number;
  /** Thumbnail width */
  width?: number;
  /** Thumbnail height */
  height?: number;
  /** Output format */
  format?: 'jpg' | 'png';
  /** Quality (1-100) */
  quality?: number;
}

export interface AudioExtractionOptions {
  /** Output format */
  format?: 'mp3' | 'wav' | 'aac';
  /** Bitrate */
  bitrate?: string;
  /** Sample rate */
  sampleRate?: number;
  /** Number of channels */
  channels?: number;
  /** Start time */
  startTime?: number;
  /** Duration */
  duration?: number;
}

/**
 * Media Processor - Main processing service
 */
export class MediaProcessor {
  /**
   * Get media information
   */
  static async getMediaInfo(input: string | Buffer): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      if (Buffer.isBuffer(input)) {
        // Create temporary file for buffer input
        const tempFile = path.join(os.tmpdir(), `media-${Date.now()}`);
        fs.writeFile(tempFile, input)
          .then(() => {
            command.input(tempFile);
          })
          .catch(reject);
      } else {
        command.input(input);
      }

      command.ffprobe((err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get media info: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

        const info: MediaInfo = {
          format: metadata.format.format_name || 'unknown',
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          size: metadata.format.size || 0,
        };

        if (videoStream) {
          info.videoCodec = videoStream.codec_name;
          info.width = videoStream.width;
          info.height = videoStream.height;
          info.frameRate = this.parseFrameRate(videoStream.r_frame_rate);
        }

        if (audioStream) {
          info.audioCodec = audioStream.codec_name;
          info.audioChannels = audioStream.channels;
          info.audioSampleRate = audioStream.sample_rate;
        }

        resolve(info);
      });
    });
  }

  /**
   * Process video file
   */
  static async processVideo(
    input: string | Buffer,
    outputPath: string,
    options: ProcessingOptions = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      const tempInputFile = Buffer.isBuffer(input)
        ? await this.bufferToTempFile(input, 'video')
        : null;

      const inputPath = tempInputFile || input;

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Set output format
        if (options.format) {
          command = command.format(options.format);
        }

        // Set video codec
        if (options.videoCodec) {
          command = command.videoCodec(options.videoCodec);
        } else {
          command = command.videoCodec('libx264');
        }

        // Set audio codec
        if (options.audioCodec) {
          command = command.audioCodec(options.audioCodec);
        } else {
          command = command.audioCodec('aac');
        }

        // Set bitrates
        if (options.videoBitrate) {
          command = command.videoBitrate(options.videoBitrate);
        }
        if (options.audioBitrate) {
          command = command.audioBitrate(options.audioBitrate);
        }

        // Set dimensions
        if (options.width || options.height) {
          const width = options.width || -1;
          const height = options.height || -1;
          command = command.size(`${width}x${height}`);
        }

        // Set frame rate
        if (options.frameRate) {
          command = command.fps(options.frameRate);
        }

        // Set time range
        if (options.startTime !== undefined) {
          command = command.setStartTime(options.startTime);
        }
        if (options.duration !== undefined) {
          command = command.duration(options.duration);
        }

        // Add optimization flags
        command = command.outputOptions(['-movflags', '+faststart']);

        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      // Clean up temp file
      if (tempInputFile) {
        await fs.unlink(tempInputFile).catch(() => {});
      }

      return { success: true, outputPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate thumbnail from video
   */
  static async generateThumbnail(
    input: string | Buffer,
    outputPath: string,
    options: ThumbnailOptions = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      const tempInputFile = Buffer.isBuffer(input)
        ? await this.bufferToTempFile(input, 'video')
        : null;

      const inputPath = tempInputFile || input;

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Set timestamp (default to 1 second)
        const timestamp = options.timestamp !== undefined ? options.timestamp : 1;
        command = command.screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: options.width && options.height ? `${options.width}x${options.height}` : '320x240',
        });

        command.on('end', () => resolve()).on('error', (err) => reject(err));
      });

      // Clean up temp file
      if (tempInputFile) {
        await fs.unlink(tempInputFile).catch(() => {});
      }

      return { success: true, outputPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate multiple thumbnails from video
   */
  static async generateThumbnails(
    input: string | Buffer,
    outputDir: string,
    options: ThumbnailOptions = {}
  ): Promise<{ success: boolean; outputPaths?: string[]; error?: string }> {
    try {
      const tempInputFile = Buffer.isBuffer(input)
        ? await this.bufferToTempFile(input, 'video')
        : null;

      const inputPath = tempInputFile || input;

      // Get video duration first
      const info = await this.getMediaInfo(inputPath);
      const duration = info.duration || 10;

      const count = options.count || 5;
      const interval = duration / (count + 1);

      const timestamps = Array.from({ length: count }, (_, i) => (i + 1) * interval);

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath);

        command = command.screenshots({
          timestamps,
          filename: 'thumb-%i.jpg',
          folder: outputDir,
          size: options.width && options.height ? `${options.width}x${options.height}` : '320x240',
        });

        command.on('end', () => resolve()).on('error', (err) => reject(err));
      });

      // Clean up temp file
      if (tempInputFile) {
        await fs.unlink(tempInputFile).catch(() => {});
      }

      const outputPaths = Array.from(
        { length: count },
        (_, i) => path.join(outputDir, `thumb-${i + 1}.jpg`)
      );

      return { success: true, outputPaths };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract audio from video
   */
  static async extractAudio(
    input: string | Buffer,
    outputPath: string,
    options: AudioExtractionOptions = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      const tempInputFile = Buffer.isBuffer(input)
        ? await this.bufferToTempFile(input, 'video')
        : null;

      const inputPath = tempInputFile || input;

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Remove video stream
        command = command.noVideo();

        // Set audio codec
        const audioCodec = options.format === 'mp3' ? 'libmp3lame' : options.format || 'aac';
        command = command.audioCodec(audioCodec);

        // Set bitrate
        if (options.bitrate) {
          command = command.audioBitrate(options.bitrate);
        }

        // Set sample rate
        if (options.sampleRate) {
          command = command.audioFrequency(options.sampleRate);
        }

        // Set channels
        if (options.channels) {
          command = command.audioChannels(options.channels);
        }

        // Set time range
        if (options.startTime !== undefined) {
          command = command.setStartTime(options.startTime);
        }
        if (options.duration !== undefined) {
          command = command.duration(options.duration);
        }

        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      // Clean up temp file
      if (tempInputFile) {
        await fs.unlink(tempInputFile).catch(() => {});
      }

      return { success: true, outputPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert image format
   */
  static async convertImage(
    input: string | Buffer,
    outputPath: string,
    options: ProcessingOptions = {}
  ): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      const tempInputFile = Buffer.isBuffer(input)
        ? await this.bufferToTempFile(input, 'image')
        : null;

      const inputPath = tempInputFile || input;

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Set dimensions
        if (options.width || options.height) {
          const width = options.width || -1;
          const height = options.height || -1;
          command = command.size(`${width}x${height}`);
        }

        // Set quality
        if (options.quality) {
          command = command.outputOptions(['-q:v', `${options.quality}`]);
        }

        command
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      // Clean up temp file
      if (tempInputFile) {
        await fs.unlink(tempInputFile).catch(() => {});
      }

      return { success: true, outputPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate media file
   */
  static async validateMedia(
    input: string | Buffer
  ): Promise<{ valid: boolean; info?: MediaInfo; error?: string }> {
    try {
      const info = await this.getMediaInfo(input);
      return { valid: true, info };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid media file',
      };
    }
  }

  /**
   * Get video duration
   */
  static async getDuration(input: string | Buffer): Promise<number | null> {
    try {
      const info = await this.getMediaInfo(input);
      return info.duration || null;
    } catch (error) {
      console.error('Failed to get duration:', error);
      return null;
    }
  }

  /**
   * Check if file has video stream
   */
  static async hasVideo(input: string | Buffer): Promise<boolean> {
    try {
      const info = await this.getMediaInfo(input);
      return !!info.videoCodec;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file has audio stream
   */
  static async hasAudio(input: string | Buffer): Promise<boolean> {
    try {
      const info = await this.getMediaInfo(input);
      return !!info.audioCodec;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload processed media to Supabase Storage
   */
  static async uploadToStorage(
    filePath: string,
    storagePath: string,
    bucket = 'recordings'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const mimeType = this.getMimeType(filePath);

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
          cacheControl: '3600',
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

      return { success: true, url: publicUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Helper: Create temp file from buffer
   */
  private static async bufferToTempFile(
    buffer: Buffer,
    type: 'video' | 'audio' | 'image'
  ): Promise<string> {
    const ext = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'jpg';
    const tempFile = path.join(os.tmpdir(), `${type}-${Date.now()}.${ext}`);
    await fs.writeFile(tempFile, buffer);
    return tempFile;
  }

  /**
   * Helper: Parse frame rate string
   */
  private static parseFrameRate(frameRate?: string): number | undefined {
    if (!frameRate) return undefined;
    const parts = frameRate.split('/');
    if (parts.length === 2) {
      return parseInt(parts[0]) / parseInt(parts[1]);
    }
    return parseFloat(frameRate);
  }

  /**
   * Helper: Get MIME type from file extension
   */
  private static getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get supported video formats
   */
  static getSupportedVideoFormats(): string[] {
    return ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv'];
  }

  /**
   * Get supported audio formats
   */
  static getSupportedAudioFormats(): string[] {
    return ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma'];
  }

  /**
   * Get supported image formats
   */
  static getSupportedImageFormats(): string[] {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
  }
}
