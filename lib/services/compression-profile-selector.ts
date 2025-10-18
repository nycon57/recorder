/**
 * Compression Profile Selector
 *
 * Determines optimal compression settings for recordings based on:
 * - Content type (recording, video, audio, document, text)
 * - Video classification (screen recording, camera footage, presentation)
 * - File size and quality requirements
 * - Organization preferences
 */

import type { ContentType, CompressionProfile } from '@/lib/types/database';
import {
  classifyVideoContent,
  extractVideoFeatures,
  shouldCompress,
  getRecommendedCRF,
  getRecommendedAudioSettings,
  type VideoContentFeatures,
  type VideoClassification,
} from './video-content-classifier';

/**
 * Compression configuration for a specific recording
 */
export interface CompressionConfig {
  /** Whether compression should be applied */
  shouldCompress: boolean;
  /** Compression profile to use */
  profile: CompressionProfile;
  /** Video codec (e.g., 'libx265') */
  videoCodec: string;
  /** CRF value for video quality */
  crf: number;
  /** Encoding preset (e.g., 'medium', 'slow') */
  preset: string;
  /** Audio codec (e.g., 'libopus', 'aac') */
  audioCodec: string;
  /** Audio bitrate (e.g., '64k', '128k') */
  audioBitrate: string;
  /** Audio channels (1=mono, 2=stereo) */
  audioChannels: number;
  /** Video classification details */
  classification?: VideoClassification;
  /** Reasoning for selected configuration */
  reasoning: string;
}

/**
 * Organization compression preferences
 */
export interface CompressionPreferences {
  /** Enable automatic compression */
  enabled: boolean;
  /** Minimum file size to compress (in MB) */
  minFileSizeMB: number;
  /** Quality preference: 'balanced', 'quality', 'size' */
  qualityPreference: 'balanced' | 'quality' | 'size';
  /** Enable hardware acceleration if available */
  useHardwareAccel: boolean;
}

/**
 * Default compression preferences
 */
const DEFAULT_PREFERENCES: CompressionPreferences = {
  enabled: true,
  minFileSizeMB: 10, // Don't compress files smaller than 10MB
  qualityPreference: 'balanced',
  useHardwareAccel: true,
};

/**
 * Select compression configuration for a recording
 *
 * @param contentType - Content type of the recording
 * @param fileSize - File size in bytes
 * @param metadata - Optional FFmpeg metadata for video classification
 * @param preferences - Organization compression preferences
 * @returns Compression configuration
 */
export async function selectCompressionConfig(
  contentType: ContentType,
  fileSize: number,
  metadata?: any,
  preferences: Partial<CompressionPreferences> = {}
): Promise<CompressionConfig> {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const fileSizeMB = fileSize / 1024 / 1024;

  // Check if compression is disabled globally
  if (!prefs.enabled) {
    return {
      shouldCompress: false,
      profile: 'uploadedVideo',
      videoCodec: 'copy', // Copy without re-encoding
      crf: 0,
      preset: 'copy',
      audioCodec: 'copy',
      audioBitrate: 'copy',
      audioChannels: 2,
      reasoning: 'Compression disabled in organization preferences',
    };
  }

  // Check minimum file size threshold
  if (fileSizeMB < prefs.minFileSizeMB) {
    return {
      shouldCompress: false,
      profile: 'uploadedVideo',
      videoCodec: 'copy',
      crf: 0,
      preset: 'copy',
      audioCodec: 'copy',
      audioBitrate: 'copy',
      audioChannels: 2,
      reasoning: `File size (${fileSizeMB.toFixed(2)}MB) below minimum threshold (${prefs.minFileSizeMB}MB)`,
    };
  }

  // Handle different content types
  switch (contentType) {
    case 'recording':
    case 'video':
      return selectVideoCompressionConfig(metadata, prefs, fileSizeMB);

    case 'audio':
      return selectAudioCompressionConfig(fileSizeMB, prefs);

    case 'document':
    case 'text':
      // Documents and text don't need compression
      return {
        shouldCompress: false,
        profile: 'uploadedVideo',
        videoCodec: 'copy',
        crf: 0,
        preset: 'copy',
        audioCodec: 'copy',
        audioBitrate: 'copy',
        audioChannels: 2,
        reasoning: `Content type '${contentType}' does not require video/audio compression`,
      };

    default:
      return {
        shouldCompress: false,
        profile: 'uploadedVideo',
        videoCodec: 'copy',
        crf: 0,
        preset: 'copy',
        audioCodec: 'copy',
        audioBitrate: 'copy',
        audioChannels: 2,
        reasoning: 'Unknown content type',
      };
  }
}

/**
 * Select compression configuration for video content
 *
 * @param metadata - FFmpeg metadata
 * @param preferences - Compression preferences
 * @param fileSizeMB - File size in MB
 * @returns Video compression configuration
 */
function selectVideoCompressionConfig(
  metadata: any,
  preferences: CompressionPreferences,
  fileSizeMB: number
): CompressionConfig {
  // If no metadata available, use safe defaults
  if (!metadata) {
    return {
      shouldCompress: true,
      profile: 'uploadedVideo',
      videoCodec: 'libx265',
      crf: 26,
      preset: 'medium',
      audioCodec: 'aac',
      audioBitrate: '128k',
      audioChannels: 2,
      reasoning: 'No metadata available, using balanced defaults for video content',
    };
  }

  // Extract features and classify video
  const features = extractVideoFeatures(metadata);
  const classification = classifyVideoContent(features);

  // Check if compression is needed
  if (!shouldCompress(features)) {
    return {
      shouldCompress: false,
      profile: classification.profile,
      videoCodec: 'copy',
      crf: 0,
      preset: 'copy',
      audioCodec: 'copy',
      audioBitrate: 'copy',
      audioChannels: 2,
      classification,
      reasoning: `Video already uses efficient codec (${features.sourceCodec}), no compression needed`,
    };
  }

  // Get base CRF and adjust based on quality preference
  let crf = getRecommendedCRF(classification);
  if (preferences.qualityPreference === 'quality') {
    crf = Math.max(crf - 3, 18); // Higher quality (lower CRF)
  } else if (preferences.qualityPreference === 'size') {
    crf = Math.min(crf + 3, 32); // Smaller size (higher CRF)
  }

  // Select encoding preset
  let preset = 'medium';
  if (preferences.qualityPreference === 'quality') {
    preset = 'slow'; // Better quality, slower encoding
  } else if (preferences.qualityPreference === 'size') {
    preset = 'fast'; // Faster encoding, slightly worse compression
  }

  // Get audio settings
  const audioSettings = getRecommendedAudioSettings(classification);

  return {
    shouldCompress: true,
    profile: classification.profile,
    videoCodec: 'libx265',
    crf,
    preset,
    audioCodec: audioSettings.codec,
    audioBitrate: audioSettings.bitrate,
    audioChannels: audioSettings.channels,
    classification,
    reasoning: `${classification.reasoning}. Using ${preset} preset with CRF ${crf} (${preferences.qualityPreference} quality).`,
  };
}

/**
 * Select compression configuration for audio content
 *
 * @param fileSizeMB - File size in MB
 * @param preferences - Compression preferences
 * @returns Audio compression configuration
 */
function selectAudioCompressionConfig(
  fileSizeMB: number,
  preferences: CompressionPreferences
): CompressionConfig {
  // Determine audio profile based on file size and quality preference
  let profile: CompressionProfile;
  let audioBitrate: string;
  let audioCodec: string;

  if (preferences.qualityPreference === 'quality') {
    profile = 'audioMusic';
    audioCodec = 'aac';
    audioBitrate = '192k';
  } else if (preferences.qualityPreference === 'size') {
    profile = 'audioVoice';
    audioCodec = 'libopus';
    audioBitrate = '48k'; // Very low bitrate for voice
  } else {
    // Balanced: assume voice content (most common for recordings)
    profile = 'audioVoice';
    audioCodec = 'libopus';
    audioBitrate = '64k';
  }

  return {
    shouldCompress: true,
    profile,
    videoCodec: 'none', // No video stream
    crf: 0,
    preset: 'none',
    audioCodec,
    audioBitrate,
    audioChannels: 1, // Mono for voice, stereo would be set in music profile
    reasoning: `Audio file (${fileSizeMB.toFixed(2)}MB) classified as ${profile}. Using ${audioCodec} at ${audioBitrate}.`,
  };
}

/**
 * Format compression configuration as FFmpeg command arguments
 *
 * @param config - Compression configuration
 * @returns Array of FFmpeg command arguments
 */
export function formatFFmpegArgs(config: CompressionConfig): string[] {
  if (!config.shouldCompress) {
    // Copy streams without re-encoding
    return ['-c:v', 'copy', '-c:a', 'copy'];
  }

  const args: string[] = [];

  // Video codec and settings
  if (config.videoCodec !== 'none') {
    args.push('-c:v', config.videoCodec);
    if (config.crf > 0) {
      args.push('-crf', config.crf.toString());
    }
    if (config.preset !== 'none') {
      args.push('-preset', config.preset);
    }
  }

  // Audio codec and settings
  if (config.audioCodec !== 'none') {
    args.push('-c:a', config.audioCodec);
    if (config.audioBitrate !== 'copy') {
      args.push('-b:a', config.audioBitrate);
    }
    if (config.audioChannels) {
      args.push('-ac', config.audioChannels.toString());
    }
  }

  // Add fast start for MP4 (better streaming)
  args.push('-movflags', '+faststart');

  return args;
}

/**
 * Estimate compression ratio based on configuration
 *
 * @param config - Compression configuration
 * @returns Estimated compression ratio (e.g., 0.3 = 70% reduction)
 */
export function estimateCompressionRatio(config: CompressionConfig): number {
  if (!config.shouldCompress) {
    return 1.0; // No compression
  }

  // Estimate based on profile and CRF
  let ratio = 1.0;

  if (config.profile === 'screenRecording') {
    // Screen recordings compress very well (70-85% reduction)
    ratio = config.crf >= 28 ? 0.15 : 0.25;
  } else if (config.profile === 'uploadedVideo') {
    // Camera footage compresses moderately (50-70% reduction)
    ratio = config.crf >= 26 ? 0.35 : 0.50;
  } else if (config.profile === 'highQuality') {
    // High quality preserves more data (30-50% reduction)
    ratio = 0.60;
  } else if (config.profile === 'audioVoice') {
    // Voice audio compresses well (70-80% reduction)
    ratio = 0.25;
  } else if (config.profile === 'audioMusic') {
    // Music audio needs higher bitrate (40-60% reduction)
    ratio = 0.50;
  }

  return ratio;
}
