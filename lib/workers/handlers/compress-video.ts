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
import type { CompressVideoJobPayload, CompressionStats } from '@/lib/types/database';

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

  console.log('[compress-video] Starting compression job');
  console.log(`[compress-video] Recording: ${recordingId}`);
  console.log(`[compress-video] Profile: ${profile}`);

  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    // 1. Download file from Supabase Storage
    console.log('[compress-video] Downloading from storage...');
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('recordings')
      .download(inputPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 2. Save to temporary file
    tempInputPath = path.join(os.tmpdir(), `compress-input-${recordingId}-${Date.now()}.mp4`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(tempInputPath, buffer);

    console.log(`[compress-video] Downloaded ${buffer.length} bytes to ${tempInputPath}`);

    // 3. Set up output temporary file
    tempOutputPath = path.join(
      os.tmpdir(),
      `compress-output-${recordingId}-${Date.now()}.mp4`
    );

    // 4. Get recording details for file size
    const { data: recording, error: recordingError } = await supabaseAdmin
      .from('recordings')
      .select('file_size, content_type')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error(`Failed to fetch recording: ${recordingError?.message}`);
    }

    // 5. Compress video
    console.log('[compress-video] Starting compression...');
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
          console.log(
            `[compress-video] Progress: ${Math.floor(progress.percent)}% @ ${progress.fps} fps (${progress.speed})`
          );
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
      console.log(`[compress-video] ${compressionResult.warning}`);

      await supabaseAdmin
        .from('recordings')
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
    console.log('[compress-video] Uploading compressed file...');
    const compressedBuffer = await fs.readFile(tempOutputPath);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(outputPath, compressedBuffer, {
        contentType: 'video/mp4',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error(`Failed to upload compressed file: ${uploadError.message}`);
    }

    console.log(
      `[compress-video] Uploaded ${compressedBuffer.length} bytes to ${outputPath}`
    );

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

    console.log('[compress-video] Compression complete');
    console.log(`[compress-video] Saved: ${savingsMB.toFixed(2)}MB (${savingsPercent}%)`);
    console.log(`[compress-video] Ratio: ${stats.compression_ratio.toFixed(2)}x`);
    if (stats.quality_score?.vmaf) {
      console.log(`[compress-video] Quality (VMAF): ${stats.quality_score.vmaf.toFixed(2)}`);
    }

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
    console.error('[compress-video] Compression job failed:', error);

    // Update recording with error
    await supabaseAdmin
      .from('recordings')
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
        console.warn(`[compress-video] Failed to delete temp input: ${err.message}`);
      });
    }
    if (tempOutputPath) {
      await fs.unlink(tempOutputPath).catch((err) => {
        console.warn(`[compress-video] Failed to delete temp output: ${err.message}`);
      });
    }
  }
}
