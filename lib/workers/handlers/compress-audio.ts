/**
 * Compress Audio Job Handler
 *
 * Background job handler for audio compression tasks.
 * Downloads audio from storage, compresses it using optimized codecs,
 * uploads compressed version, and updates database with statistics.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { VideoCompressor } from '@/lib/services/video-compressor';
import { createLogger } from '@/lib/utils/logger';
import type { CompressAudioJobPayload } from '@/lib/types/database';

const logger = createLogger({ service: 'compress-audio' });

/**
 * Compress audio job handler
 *
 * @param jobPayload - Job payload with recording details
 * @returns Result with compression statistics
 */
export async function handleCompressAudio(
  jobPayload: CompressAudioJobPayload
): Promise<{ success: boolean; result?: any; error?: string }> {
  const { recordingId, orgId, inputPath, outputPath, profile } = jobPayload;

  logger.info('Starting audio compression job', {
    context: { recordingId, orgId, profile, inputPath, outputPath },
  });

  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    // 1. Download file from Supabase Storage
    logger.info('Downloading from storage', { context: { inputPath } });
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('recordings')
      .download(inputPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 2. Save to temporary file
    const inputExt = path.extname(inputPath) || '.mp3';
    tempInputPath = path.join(
      os.tmpdir(),
      `compress-audio-input-${recordingId}-${Date.now()}${inputExt}`
    );
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(tempInputPath, buffer);

    logger.info('Audio downloaded to temp file', {
      context: { tempInputPath, sizeBytes: buffer.length },
    });

    // 3. Set up output temporary file
    tempOutputPath = path.join(
      os.tmpdir(),
      `compress-audio-output-${recordingId}-${Date.now()}.opus`
    );

    // 4. Get recording details
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('recordings')
      .select('file_size, content_type')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error(`Failed to fetch recording: ${recordingError?.message}`);
    }

    // 5. Compress audio
    logger.info('Starting audio compression', {
      context: { tempInputPath, tempOutputPath, profile },
    });
    const compressionResult = await VideoCompressor.compressAudio({
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
      contentType: 'audio',
      fileSize: recording.file_size || buffer.length,
      preferences: {
        enabled: true,
        minFileSizeMB: 5, // Lower threshold for audio
        qualityPreference: 'balanced',
        useHardwareAccel: false, // Audio doesn't use hardware accel
      },
      onProgress: (progress) => {
        if (Math.floor(progress.percent) % 20 === 0) {
          logger.info('Compression progress', {
            context: { recordingId },
            data: { percent: Math.floor(progress.percent) },
          });
        }
      },
    });

    if (!compressionResult.success) {
      throw new Error(compressionResult.error || 'Audio compression failed');
    }

    // 6. If compression was skipped
    if (compressionResult.warning) {
      logger.info('Compression skipped', {
        context: { recordingId },
        data: { reason: compressionResult.warning },
      });

      await supabaseAdmin
        .from('recordings')
        .update({
          compression_stats: {
            original_size: recording.file_size,
            compressed_size: recording.file_size,
            compression_ratio: 1.0,
            codec: 'none',
            crf: 0,
            audio_codec: 'original',
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

    // 7. Upload compressed file
    logger.info('Uploading compressed file', { context: { outputPath } });
    const compressedBuffer = await fs.readFile(tempOutputPath);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(outputPath, compressedBuffer, {
        contentType: 'audio/opus',
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
      .from('recordings')
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
      .from('recordings')
      .update({
        error_message: error instanceof Error ? error.message : 'Audio compression failed',
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
