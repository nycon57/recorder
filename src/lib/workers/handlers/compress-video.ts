/**
 * Compress Video Job Handler
 *
 * Background job handler for video compression tasks.
 * Downloads video from storage, compresses it, uploads compressed version,
 * updates database with compression statistics, and optionally replaces original.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { VideoCompressor } from '@/lib/services/video-compressor';
import { createLogger } from '@/lib/utils/logger';
import type { CompressVideoJobPayload, CompressionStats } from '@/lib/types/database';

const logger = createLogger({ service: 'compress-video' });

/**
 * Compress video job handler
 *
 * @param jobPayload - Job payload with recording details
 * @returns Result with compression statistics
 */
export async function handleCompressVideo(
  jobPayload: CompressVideoJobPayload
): Promise<{ success: boolean; result?: any; error?: string }> {
  const { recordingId, orgId, inputPath, outputPath, profile, contentType } = jobPayload;

  logger.info('Starting compression job', {
    context: { recordingId, orgId, profile, inputPath, outputPath },
  });

  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    // 1. Download file from Supabase Storage
    logger.info('Downloading from storage', { context: { inputPath } });
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('content')
      .download(inputPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 2. Save to temporary file
    tempInputPath = path.join(os.tmpdir(), `compress-input-${recordingId}-${Date.now()}.mp4`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(tempInputPath, buffer);

    logger.info('Video downloaded to temp file', {
      context: { tempInputPath, sizeBytes: buffer.length },
    });

    // 3. Set up output temporary file
    tempOutputPath = path.join(
      os.tmpdir(),
      `compress-output-${recordingId}-${Date.now()}.mp4`
    );

    // 4. Get recording details for file size
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('content')
      .select('file_size, content_type')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error(`Failed to fetch recording: ${recordingError?.message}`);
    }

    // 5. Compress video
    logger.info('Starting video compression', {
      context: { tempInputPath, tempOutputPath, profile },
    });
    const compressionResult = await VideoCompressor.compressVideo({
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      contentType: recording.content_type || contentType,
      fileSize: recording.file_size || buffer.length,
      preferences: {
        enabled: true,
        minFileSizeMB: 10,
        qualityPreference: 'balanced',
        useHardwareAccel: true,
      },
      onProgress: (progress) => {
        // Log progress every 10%
        if (Math.floor(progress.percent) % 10 === 0) {
          logger.info('Compression progress', {
            context: { recordingId },
            data: { percent: Math.floor(progress.percent), fps: progress.fps, speed: progress.speed },
          });
        }
      },
      validateQuality: true,
      minVMAF: 85,
    });

    if (!compressionResult.success) {
      throw new Error(compressionResult.error || 'Compression failed');
    }

    // 6. If compression was skipped (file already optimal), mark as complete
    if (compressionResult.warning) {
      logger.info('Compression skipped', {
        context: { recordingId },
        data: { reason: compressionResult.warning },
      });

      await supabaseAdmin
        .from('content')
        .update({
          compression_stats: {
            original_size: recording.file_size,
            compressed_size: recording.file_size,
            compression_ratio: 1.0,
            codec: 'original',
            crf: 0,
            encoding_time_seconds: 0,
            profile: profile,
            compressed_at: new Date().toISOString(),
          },
        })
        .eq('id', recordingId);

      return {
        success: true,
        result: {
          skipped: true,
          reason: compressionResult.warning,
        },
      };
    }

    // 7. Upload compressed file to storage
    logger.info('Uploading compressed file', { context: { outputPath } });
    const compressedBuffer = await fs.readFile(tempOutputPath);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('content')
      .upload(outputPath, compressedBuffer, {
        contentType: 'video/mp4',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Failed to upload compressed file: ${uploadError.message}`);
    }

    logger.info('Compressed file uploaded', {
      context: { outputPath, sizeBytes: compressedBuffer.length },
    });

    // 8. Update recording with compression stats
    await supabaseAdmin
      .from('content')
      .update({
        storage_path_processed: outputPath,
        compression_stats: compressionResult.stats,
      })
      .eq('id', recordingId);

    // 9. Calculate savings
    const stats = compressionResult.stats!;
    const savingsBytes = stats.original_size - stats.compressed_size;
    const savingsMB = savingsBytes / 1024 / 1024;
    const savingsPercent = ((savingsBytes / stats.original_size) * 100).toFixed(2);

    logger.info('Compression complete', {
      context: { recordingId },
      data: {
        savingsMB: parseFloat(savingsMB.toFixed(2)),
        savingsPercent: parseFloat(savingsPercent),
        compressionRatio: parseFloat(stats.compression_ratio.toFixed(2)),
        vmaf: stats.quality_score?.vmaf ? parseFloat(stats.quality_score.vmaf.toFixed(2)) : undefined,
      },
    });

    return {
      success: true,
      result: {
        compressionStats: stats,
        savingsBytes,
        savingsMB: Math.round(savingsMB * 100) / 100,
        savingsPercent: parseFloat(savingsPercent),
      },
    };
  } catch (error) {
    logger.error('Compression job failed', {
      context: { recordingId, inputPath },
      error: error as Error,
    });

    // Update recording with error
    await supabaseAdmin
      .from('content')
      .update({
        error_message: error instanceof Error ? error.message : 'Compression failed',
      })
      .eq('id', recordingId);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Cleanup temporary files
    if (tempInputPath) {
      await fs.unlink(tempInputPath).catch((err) => {
        logger.warn('Failed to delete temp input file', {
          context: { tempInputPath },
          error: err as Error,
        });
      });
    }
    if (tempOutputPath) {
      await fs.unlink(tempOutputPath).catch((err) => {
        logger.warn('Failed to delete temp output file', {
          context: { tempOutputPath },
          error: err as Error,
        });
      });
    }
  }
}
