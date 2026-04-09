/**
 * Extract Audio Handler
 *
 * Extracts audio track from video files (MP4, MOV, WEBM, AVI) using FFmpeg.
 * Saves the extracted audio to Supabase Storage and enqueues transcription job.
 */

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import ffmpeg from 'fluent-ffmpeg';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';
import { streamingManager } from '@/lib/services/streaming-processor';

import type { ProgressCallback } from '../job-processor';

// Import ffmpeg binary path if installed via @ffmpeg-installer/ffmpeg
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  if (ffmpegInstaller && ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  }
} catch (err) {
  // FFmpeg installer not available, will use system FFmpeg
  console.log('[Extract Audio] Using system FFmpeg');
}

type Job = Database['public']['Tables']['jobs']['Row'];

interface ExtractAudioPayload {
  recordingId: string;
  orgId: string;
  videoPath: string; // Storage path in Supabase
}

/**
 * Extract audio track from video file
 */
export async function handleExtractAudio(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as ExtractAudioPayload;
  const { recordingId, orgId, videoPath } = payload;

  const logger = createLogger({ service: 'extract-audio' });

  logger.info('Starting audio extraction', {
    context: {
      recordingId,
      orgId,
      videoPath,
      jobId: job.id,
    },
  });

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('content')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  progressCallback?.(5, 'Downloading video file...');
  streamingManager.sendProgress(
    recordingId,
    'all',
    5,
    'Downloading video file for audio extraction...'
  );

  let tempVideoPath: string | null = null;
  let tempAudioPath: string | null = null;

  try {
    // Download video from Supabase Storage
    logger.info('Downloading video from storage', {
      context: { videoPath },
    });

    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('content')
      .download(videoPath);

    if (downloadError || !videoBlob) {
      throw new Error(
        `Failed to download video: ${downloadError?.message || 'Unknown error'}`
      );
    }

    // Get file extension from videoPath
    const videoExtension = videoPath.split('.').pop() || 'mp4';

    // Save video to temp file
    tempVideoPath = join(tmpdir(), `${randomUUID()}.${videoExtension}`);
    const buffer = await videoBlob.arrayBuffer();
    await writeFile(tempVideoPath, Buffer.from(buffer));

    logger.info('Video saved to temp file', {
      context: { tempVideoPath, sizeBytes: buffer.byteLength },
    });

    progressCallback?.(20, 'Extracting audio track...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      20,
      'Extracting audio track from video...'
    );

    // Extract audio using FFmpeg
    tempAudioPath = join(tmpdir(), `${randomUUID()}.mp3`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath!)
        .outputOptions([
          '-vn', // No video
          '-acodec libmp3lame', // MP3 codec
          '-ab 192k', // Audio bitrate
          '-ar 44100', // Sample rate
          '-ac 2', // Stereo
        ])
        .output(tempAudioPath!)
        .on('start', (commandLine) => {
          logger.info('FFmpeg command started', {
            context: { commandLine },
          });
        })
        .on('progress', (progress) => {
          // FFmpeg progress callback
          if (progress.percent) {
            const currentProgress = Math.min(20 + progress.percent * 0.5, 70);
            progressCallback?.(
              currentProgress,
              `Extracting audio: ${Math.round(progress.percent)}%`
            );
            streamingManager.sendProgress(
              recordingId,
              'all',
              currentProgress,
              `Extracting audio: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on('end', () => {
          logger.info('Audio extraction completed');
          resolve();
        })
        .on('error', (err) => {
          logger.error('FFmpeg error', { error: err });
          reject(
            new Error(`FFmpeg audio extraction failed: ${err.message}`)
          );
        })
        .run();
    });

    progressCallback?.(75, 'Uploading extracted audio...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      75,
      'Uploading extracted audio to storage...'
    );

    // Upload audio to Supabase Storage
    const audioBuffer = await require('fs').promises.readFile(tempAudioPath);
    const audioStoragePath = videoPath.replace(/\.[^.]+$/, '.mp3');

    const { error: uploadError } = await supabase.storage
      .from('content')
      .upload(audioStoragePath, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    logger.info('Audio uploaded to storage', {
      context: { audioStoragePath },
    });

    // Fetch existing metadata to preserve it
    const { data: recording } = await supabase
      .from('content')
      .select('metadata')
      .eq('id', recordingId)
      .single();

    const existingMetadata = (recording?.metadata || {}) as Record<string, any>;

    // Update recording with audio path, preserving existing metadata
    await supabase
      .from('content')
      .update({
        metadata: {
          ...existingMetadata,
          audio_path: audioStoragePath,
          extracted_at: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    progressCallback?.(85, 'Audio extraction complete, queuing transcription...');
    streamingManager.sendProgress(
      recordingId,
      'all',
      85,
      'Audio extraction complete, queuing transcription...'
    );

    // Enqueue transcription job
    await supabase.from('jobs').insert({
      type: 'transcribe',
      status: 'pending',
      payload: {
        recordingId,
        orgId,
        storagePath: audioStoragePath,
      },
      dedupe_key: `transcribe:${recordingId}`,
    });

    logger.info('Enqueued transcription job', {
      context: { recordingId, audioStoragePath },
    });

    progressCallback?.(100, 'Audio extraction complete');
    streamingManager.sendProgress(
      recordingId,
      'all',
      100,
      'Audio extraction complete'
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'audio.extracted',
      payload: {
        recordingId,
        audioPath: audioStoragePath,
        orgId,
      },
    });

  } catch (error) {
    logger.error('Audio extraction failed', {
      context: { recordingId, videoPath },
      error: error as Error,
    });

    streamingManager.sendError(
      recordingId,
      `Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // Fetch existing metadata to preserve it
    const { data: recording } = await supabase
      .from('content')
      .select('metadata')
      .eq('id', recordingId)
      .maybeSingle();

    const existingMetadata = (recording?.metadata || {}) as Record<string, any>;

    // Update recording status to error, preserving existing metadata
    await supabase
      .from('content')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Audio extraction failed',
        metadata: {
          ...existingMetadata,
          error: error instanceof Error ? error.message : 'Audio extraction failed',
          errorType: 'audio_extraction',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp files
    if (tempVideoPath) {
      try {
        await unlink(tempVideoPath);
        logger.info('Cleaned up temp video file');
      } catch (err) {
        logger.error('Failed to delete temp video file', {
          error: err as Error,
        });
      }
    }

    if (tempAudioPath) {
      try {
        await unlink(tempAudioPath);
        logger.info('Cleaned up temp audio file');
      } catch (err) {
        logger.error('Failed to delete temp audio file', {
          error: err as Error,
        });
      }
    }
  }
}
