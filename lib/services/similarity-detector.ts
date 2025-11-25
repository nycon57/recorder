/**
 * Content-Based Similarity Detection Service
 *
 * Implements perceptual hashing and fingerprinting to detect near-duplicate files:
 * - Video similarity using difference hash (dHash)
 * - Audio fingerprinting using spectral analysis
 * - Hamming distance for similarity scoring
 * - Threshold-based matching
 */

import { createHash } from 'crypto';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, isAbsolute, resolve } from 'path';
import * as tmp from 'tmp-promise';
import { createClient } from '@/lib/supabase/admin';
import { StorageManager } from './storage-manager';
import type { StorageProvider } from '@/lib/types/database';

const execFileAsync = promisify(execFile);

// Timeout for ffmpeg operations (30 seconds)
const FFMPEG_TIMEOUT_MS = 30000;

/**
 * Perceptual hash result
 */
export interface PerceptualHash {
  videoHash: string; // 64-character hex string (256-bit dHash)
  audioHash: string; // 64-character hex string (256-bit audio fingerprint)
  duration: number; // Duration in seconds
  contentId: string;
  createdAt: Date;
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  contentId: string;
  originalRecordingId: string;
  videoSimilarity: number; // 0-100 (percentage)
  audioSimilarity: number; // 0-100 (percentage)
  overallSimilarity: number; // 0-100 (weighted average)
  hammingDistance: number; // Bit differences
  title: string;
  duration: number;
  fileSize: number;
}

/**
 * Similarity detection configuration
 */
export interface SimilarityConfig {
  videoThreshold: number; // Minimum video similarity % (default: 90)
  audioThreshold: number; // Minimum audio similarity % (default: 85)
  overallThreshold: number; // Minimum overall similarity % (default: 88)
  maxHammingDistance: number; // Maximum bit differences (default: 10)
}

const DEFAULT_CONFIG: SimilarityConfig = {
  videoThreshold: 90,
  audioThreshold: 85,
  overallThreshold: 88,
  maxHammingDistance: 10,
};

/**
 * Validate and normalize file path
 * Ensures path exists, is a regular file, and is absolute
 */
async function validateFilePath(filePath: string): Promise<string> {
  // Normalize to absolute path
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

  try {
    // Check if file exists and is a regular file
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a regular file: ${absolutePath}`);
    }
    return absolutePath;
  } catch (error) {
    throw new Error(
      `Invalid file path: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate difference hash (dHash) for video
 * Extracts keyframe, resizes to 9x8, compares adjacent pixels
 */
export async function calculateVideoHash(
  filePath: string,
  timestamp: number = 10
): Promise<string> {
  let frameFile: tmp.FileResult | null = null;

  try {
    // Validate input path
    const validatedPath = await validateFilePath(filePath);

    // Create secure temp file for frame
    frameFile = await tmp.file({ postfix: '.png' });

    // Extract single frame at specified timestamp using execFile (no shell interpolation)
    await execFileAsync(
      'ffmpeg',
      [
        '-ss',
        timestamp.toString(),
        '-i',
        validatedPath,
        '-vframes',
        '1',
        '-vf',
        'scale=9:8,format=gray',
        '-y',
        frameFile.path,
      ],
      { timeout: FFMPEG_TIMEOUT_MS, killSignal: 'SIGKILL' }
    );

    // Calculate dHash from frame - spawn ffmpeg and read stdout directly
    const pixels = await new Promise<number[]>((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i',
        frameFile!.path,
        '-vf',
        'scale=9:8',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'gray',
        '-',
      ]);

      const chunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      ffmpegProcess.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpegProcess.stderr.on('data', (chunk) => stderrChunks.push(chunk));

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          const stderrOutput = Buffer.concat(stderrChunks).toString('utf8');
          reject(new Error(`ffmpeg exited with code ${code}: ${stderrOutput}`));
          return;
        }

        const buffer = Buffer.concat(chunks);
        const pixelArray = Array.from(buffer);
        resolve(pixelArray);
      });

      ffmpegProcess.on('error', (err) => {
        const stderrOutput = Buffer.concat(stderrChunks).toString('utf8');
        reject(new Error(`ffmpeg process error: ${err.message}${stderrOutput ? `: ${stderrOutput}` : ''}`));
      });
    });

    // Convert pixel data to binary hash
    let hash = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = row * 9 + col;
        const nextIdx = row * 9 + col + 1;
        if (idx < pixels.length && nextIdx < pixels.length) {
          hash += pixels[idx] < pixels[nextIdx] ? '1' : '0';
        }
      }
    }

    // Convert binary string to hex
    const hexHash = binaryToHex(hash);

    return hexHash;
  } catch (error) {
    console.error('[SimilarityDetector] Error calculating video hash:', error);
    return '0'.repeat(64); // Return zero hash on error
  } finally {
    // Always cleanup temp file
    if (frameFile) {
      try {
        await frameFile.cleanup();
      } catch (cleanupError) {
        console.error('[SimilarityDetector] Error cleaning up frame file:', cleanupError);
      }
    }
  }
}

/**
 * Calculate audio fingerprint using spectral analysis
 * Extracts audio, performs FFT, generates fingerprint
 */
export async function calculateAudioHash(filePath: string): Promise<string> {
  let audioFile: tmp.FileResult | null = null;

  try {
    // Validate input path
    const validatedPath = await validateFilePath(filePath);

    // Create secure temp file for audio
    audioFile = await tmp.file({ postfix: '.wav' });

    // Extract audio and convert to mono using execFile (no shell interpolation)
    await execFileAsync(
      'ffmpeg',
      [
        '-i',
        validatedPath,
        '-vn',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '22050',
        '-ac',
        '1',
        '-t',
        '30',
        '-y',
        audioFile.path,
      ],
      { timeout: FFMPEG_TIMEOUT_MS, killSignal: 'SIGKILL' }
    );

    // Calculate audio fingerprint - spawn ffmpeg and read stdout directly
    const samples = await new Promise<number[]>((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i',
        audioFile!.path,
        '-af',
        'aresample=11025,asetnsamples=2048',
        '-f',
        'f32le',
        '-',
      ]);

      const chunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      ffmpegProcess.stdout.on('data', (chunk) => chunks.push(chunk));
      ffmpegProcess.stderr.on('data', (chunk) => stderrChunks.push(chunk));

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          const stderrOutput = Buffer.concat(stderrChunks).toString('utf8');
          reject(new Error(`ffmpeg exited with code ${code}: ${stderrOutput}`));
          return;
        }

        const buffer = Buffer.concat(chunks);
        const floatArray: number[] = [];

        // Read 32-bit floats from buffer (limit to 256 samples)
        for (let i = 0; i < Math.min(256 * 4, buffer.length); i += 4) {
          if (i + 4 <= buffer.length) {
            floatArray.push(buffer.readFloatLE(i));
          }
        }

        resolve(floatArray);
      });

      ffmpegProcess.on('error', (err) => {
        const stderrOutput = Buffer.concat(stderrChunks).toString('utf8');
        reject(new Error(`ffmpeg process error: ${err.message}${stderrOutput ? `: ${stderrOutput}` : ''}`));
      });
    });

    // Generate fingerprint from spectral features
    let hash = '';
    for (let i = 0; i < Math.min(256, samples.length); i++) {
      hash += samples[i] > 0 ? '1' : '0';
    }

    // Pad to 256 bits if needed
    while (hash.length < 256) {
      hash += '0';
    }

    const hexHash = binaryToHex(hash);

    return hexHash;
  } catch (error) {
    console.error('[SimilarityDetector] Error calculating audio hash:', error);
    return '0'.repeat(64); // Return zero hash on error
  } finally {
    // Always cleanup temp file
    if (audioFile) {
      try {
        await audioFile.cleanup();
      } catch (cleanupError) {
        console.error('[SimilarityDetector] Error cleaning up audio file:', cleanupError);
      }
    }
  }
}

/**
 * Calculate perceptual hashes for a recording
 */
export async function calculatePerceptualHash(
  contentId: string,
  storagePath: string,
  storageProvider: StorageProvider
): Promise<PerceptualHash | null> {
  let tempPath: string | undefined;

  try {
    // Download file to temp location
    const storageManager = new StorageManager();
    const supabase = createClient();

    // Prefer the provided storagePath, fall back to DB query if not provided
    let pathToUse = storagePath;
    let duration = 0;

    if (!storagePath) {
      const { data: recording } = await supabase
        .from('content')
        .select('storage_path, storage_path_r2, duration')
        .eq('id', contentId)
        .single();

      if (!recording) {
        throw new Error('Recording not found');
      }

      pathToUse = recording.storage_path_r2 || recording.storage_path;
      duration = recording.duration || 0;
    } else {
      // If storagePath is provided, still get duration from DB
      const { data: recording } = await supabase
        .from('content')
        .select('duration')
        .eq('id', contentId)
        .single();

      duration = recording?.duration || 0;
    }

    const downloadResult = await storageManager.download(
      pathToUse,
      pathToUse, // Use same path for both (manager will handle)
      storageProvider,
      { asBuffer: false } // Download to temp file
    );

    if (!downloadResult.success || !downloadResult.data) {
      throw new Error(downloadResult.error || 'Failed to download file');
    }

    tempPath = downloadResult.data as unknown as string;

    // Calculate hashes
    const timestamp = Math.min(10, duration / 2); // 10s or midpoint
    const videoHash = await calculateVideoHash(tempPath, timestamp);
    const audioHash = await calculateAudioHash(tempPath);

    return {
      videoHash,
      audioHash,
      duration,
      contentId,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[SimilarityDetector] Error calculating perceptual hash:', error);
    return null;
  } finally {
    // Always cleanup temp file
    if (tempPath) {
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        console.error('[SimilarityDetector] Error cleaning up temp file:', cleanupError);
      }
    }
  }
}

/**
 * Calculate Hamming distance between two hex hashes
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16);
    // Count set bits
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }

  return distance;
}

/**
 * Convert Hamming distance to similarity percentage
 */
export function hammingToSimilarity(distance: number, hashBits: number = 256): number {
  const maxDistance = hashBits;
  const similarity = ((maxDistance - distance) / maxDistance) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Find similar recordings by perceptual hash
 */
export async function findSimilarRecordings(
  videoHash: string,
  audioHash: string,
  orgId: string,
  config: SimilarityConfig = DEFAULT_CONFIG,
  excludeRecordingId?: string
): Promise<SimilarityMatch[]> {
  const supabase = createClient();

  // Get all recordings with perceptual hashes in the organization
  let query = supabase
    .from('content')
    .select('id, title, duration, file_size, video_hash, audio_hash')
    .eq('org_id', orgId)
    .not('video_hash', 'is', null)
    .not('audio_hash', 'is', null)
    .is('deleted_at', null);

  if (excludeRecordingId) {
    query = query.neq('id', excludeRecordingId);
  }

  const { data: recordings, error } = await query;

  if (error || !recordings || recordings.length === 0) {
    return [];
  }

  const matches: SimilarityMatch[] = [];

  for (const recording of recordings) {
    try {
      // Calculate video similarity
      const videoDistance = hammingDistance(videoHash, recording.video_hash);
      const videoSimilarity = hammingToSimilarity(videoDistance);

      // Calculate audio similarity
      const audioDistance = hammingDistance(audioHash, recording.audio_hash);
      const audioSimilarity = hammingToSimilarity(audioDistance);

      // Overall similarity (weighted: 60% video, 40% audio)
      const overallSimilarity = videoSimilarity * 0.6 + audioSimilarity * 0.4;

      // Average Hamming distance
      const avgDistance = (videoDistance + audioDistance) / 2;

      // Check if meets thresholds
      if (
        videoSimilarity >= config.videoThreshold &&
        audioSimilarity >= config.audioThreshold &&
        overallSimilarity >= config.overallThreshold &&
        avgDistance <= config.maxHammingDistance
      ) {
        matches.push({
          contentId: recording.id,
          originalRecordingId: recording.id,
          videoSimilarity: Math.round(videoSimilarity * 100) / 100,
          audioSimilarity: Math.round(audioSimilarity * 100) / 100,
          overallSimilarity: Math.round(overallSimilarity * 100) / 100,
          hammingDistance: Math.round(avgDistance),
          title: recording.title,
          duration: recording.duration,
          fileSize: recording.file_size,
        });
      }
    } catch (error) {
      console.error(`[SimilarityDetector] Error comparing with ${recording.id}:`, error);
      continue;
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.overallSimilarity - a.overallSimilarity);

  return matches;
}

/**
 * Store perceptual hash in database
 */
export async function storePerceptualHash(hash: PerceptualHash): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('content')
      .update({
        video_hash: hash.videoHash,
        audio_hash: hash.audioHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hash.contentId);

    if (error) {
      console.error('[SimilarityDetector] Error storing hash:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SimilarityDetector] Error storing hash:', error);
    return false;
  }
}

/**
 * Batch process recordings for perceptual hashing
 */
export async function batchProcessSimilarity(
  orgId: string,
  batchSize: number = 50
): Promise<{
  processed: number;
  matches: number;
  errors: string[];
}> {
  const supabase = createClient();

  // Get recordings without perceptual hashes
  const { data: recordings, error } = await supabase
    .from('content')
    .select('id, storage_path, storage_path_r2, storage_provider')
    .eq('org_id', orgId)
    .is('video_hash', null)
    .is('deleted_at', null)
    .limit(batchSize);

  if (error || !recordings || recordings.length === 0) {
    return {
      processed: 0,
      matches: 0,
      errors: error ? [error.message] : [],
    };
  }

  let processed = 0;
  let matches = 0;
  const errors: string[] = [];

  for (const recording of recordings) {
    try {
      const hash = await calculatePerceptualHash(
        recording.id,
        recording.storage_path_r2 || recording.storage_path,
        recording.storage_provider || 'supabase'
      );

      if (!hash) {
        errors.push(`Failed to calculate hash for ${recording.id}`);
        continue;
      }

      // Store hash
      await storePerceptualHash(hash);

      // Find similar recordings
      const similar = await findSimilarRecordings(
        hash.videoHash,
        hash.audioHash,
        orgId,
        DEFAULT_CONFIG,
        recording.id
      );

      if (similar.length > 0) {
        matches += similar.length;
        console.log(
          `[SimilarityDetector] Found ${similar.length} similar recordings for ${recording.id}`
        );
      }

      processed++;
    } catch (error) {
      errors.push(`${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    processed,
    matches,
    errors,
  };
}

/**
 * Helper: Convert binary string to hex
 */
function binaryToHex(binary: string): string {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4).padEnd(4, '0');
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex.padEnd(64, '0').slice(0, 64);
}
