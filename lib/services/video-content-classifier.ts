/**
 * Video Content Classification Service
 *
 * Analyzes video files to determine optimal compression profile:
 * - Screen Recording: High text density, static regions, screen resolutions
 * - Uploaded Video: Camera footage with motion, natural scenes
 * - Presentation: Slide decks with transitions, static text layouts
 * - High Motion: Fast-paced content requiring higher bitrates
 */

import type { ContentType, CompressionProfile } from '@/lib/types/database';

/**
 * Video content characteristics extracted from analysis
 */
export interface VideoContentFeatures {
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Frames per second */
  fps: number;
  /** Video duration in seconds */
  duration: number;
  /** Estimated motion level (0-1 scale, 0=static, 1=high motion) */
  motionLevel?: number;
  /** Whether video appears to be screen capture */
  isScreenCapture: boolean;
  /** Whether video contains presentation/slide content */
  isPresentation: boolean;
  /** Whether video appears to be camera footage */
  isCameraFootage: boolean;
  /** Average bitrate in kbps */
  avgBitrate?: number;
  /** Codec used in source video */
  sourceCodec?: string;
}

/**
 * Video classification result with recommended compression profile
 */
export interface VideoClassification {
  /** Detected video content type */
  contentType: 'screen_recording' | 'camera_footage' | 'presentation' | 'mixed';
  /** Recommended compression profile */
  profile: CompressionProfile;
  /** Confidence score (0-1) */
  confidence: number;
  /** Features used for classification */
  features: VideoContentFeatures;
  /** Reasoning for classification */
  reasoning: string;
}

/**
 * Common screen recording resolutions
 */
const SCREEN_RESOLUTIONS = new Set([
  '1920x1080', // Full HD
  '2560x1440', // 2K/QHD
  '3840x2160', // 4K/UHD
  '1366x768',  // HD
  '1440x900',  // WXGA+
  '1680x1050', // WSXGA+
  '1280x720',  // HD 720p
  '1280x800',  // WXGA
  '1600x900',  // HD+
  '2048x1152', // QWXGA
  '3440x1440', // UWQHD
  '3840x1600', // UW4K
]);

/**
 * Common camera recording aspect ratios
 */
const CAMERA_ASPECT_RATIOS = [
  16 / 9,  // Standard widescreen
  4 / 3,   // Classic
  9 / 16,  // Vertical video
  21 / 9,  // Cinematic
  1 / 1,   // Square (Instagram, etc.)
];

/**
 * Classify video content based on metadata
 *
 * @param features - Video content features extracted from FFmpeg
 * @returns Classification with recommended compression profile
 */
export function classifyVideoContent(features: VideoContentFeatures): VideoClassification {
  const resolution = `${features.width}x${features.height}`;
  const aspectRatio = features.width / features.height;

  // Initialize classification scores
  let screenScore = 0;
  let cameraScore = 0;
  let presentationScore = 0;

  // 1. Resolution-based detection
  if (SCREEN_RESOLUTIONS.has(resolution)) {
    screenScore += 0.3;
  }

  // Check if aspect ratio matches common camera ratios
  const matchesCameraAspectRatio = CAMERA_ASPECT_RATIOS.some(
    (ratio) => Math.abs(aspectRatio - ratio) < 0.05
  );
  if (matchesCameraAspectRatio) {
    cameraScore += 0.2;
  }

  // 2. Bitrate analysis
  if (features.avgBitrate) {
    // Screen recordings typically have lower bitrates due to static content
    if (features.avgBitrate < 2000) {
      screenScore += 0.2;
      presentationScore += 0.1;
    }
    // Camera footage typically has higher bitrates
    else if (features.avgBitrate > 5000) {
      cameraScore += 0.3;
    }
  }

  // 3. Frame rate detection
  if (features.fps <= 30) {
    screenScore += 0.1;
    presentationScore += 0.2;
  } else if (features.fps >= 60) {
    cameraScore += 0.2; // High FPS often indicates camera footage or gaming
  }

  // 4. Motion level detection
  if (features.motionLevel !== undefined) {
    if (features.motionLevel < 0.3) {
      screenScore += 0.2;
      presentationScore += 0.3;
    } else if (features.motionLevel > 0.6) {
      cameraScore += 0.3;
    }
  }

  // 5. Direct feature flags (if provided by advanced analysis)
  if (features.isScreenCapture) {
    screenScore += 0.5;
  }
  if (features.isPresentation) {
    presentationScore += 0.5;
  }
  if (features.isCameraFootage) {
    cameraScore += 0.5;
  }

  // 6. Source codec analysis
  if (features.sourceCodec) {
    const codec = features.sourceCodec.toLowerCase();
    // H.264/H.265 common for camera footage
    if (codec.includes('h264') || codec.includes('h265') || codec.includes('hevc')) {
      cameraScore += 0.1;
    }
    // VP8/VP9 common for screen recordings (WebRTC)
    if (codec.includes('vp8') || codec.includes('vp9')) {
      screenScore += 0.1;
    }
  }

  // Determine classification
  const maxScore = Math.max(screenScore, cameraScore, presentationScore);
  let contentType: VideoClassification['contentType'];
  let profile: CompressionProfile;
  let reasoning: string;

  if (maxScore < 0.3) {
    // Low confidence - use safe defaults
    contentType = 'mixed';
    profile = 'uploadedVideo'; // Balanced profile
    reasoning = 'Unable to confidently classify content type. Using balanced compression settings.';
  } else if (presentationScore === maxScore) {
    contentType = 'presentation';
    profile = 'screenRecording'; // Use screen recording profile (static content)
    reasoning = `Detected presentation content (score: ${presentationScore.toFixed(2)}). Low motion, structured layout.`;
  } else if (screenScore === maxScore) {
    contentType = 'screen_recording';
    profile = 'screenRecording';
    reasoning = `Detected screen recording (score: ${screenScore.toFixed(2)}). Common screen resolution: ${resolution}, low motion.`;
  } else {
    contentType = 'camera_footage';
    profile = 'uploadedVideo';
    reasoning = `Detected camera footage (score: ${cameraScore.toFixed(2)}). Natural aspect ratio, higher motion/bitrate.`;
  }

  return {
    contentType,
    profile,
    confidence: maxScore,
    features,
    reasoning,
  };
}

/**
 * Extract basic video features from metadata
 * (To be called after FFmpeg metadata extraction)
 *
 * @param metadata - Raw FFmpeg metadata object
 * @returns Extracted video features
 */
export function extractVideoFeatures(metadata: any): VideoContentFeatures {
  const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');

  if (!videoStream) {
    throw new Error('No video stream found in metadata');
  }

  // Parse frame rate (can be in format like "30/1" or "29.97")
  let fps = 30; // default
  if (videoStream.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    fps = num / (den || 1);
  } else if (videoStream.avg_frame_rate) {
    const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
    fps = num / (den || 1);
  }

  // Calculate duration
  const duration = parseFloat(videoStream.duration || metadata.format?.duration || '0');

  // Calculate average bitrate
  const avgBitrate = metadata.format?.bit_rate
    ? parseInt(metadata.format.bit_rate) / 1000 // Convert to kbps
    : undefined;

  // Extract codec
  const sourceCodec = videoStream.codec_name;

  return {
    width: videoStream.width,
    height: videoStream.height,
    fps: Math.round(fps),
    duration,
    avgBitrate,
    sourceCodec,
    isScreenCapture: false, // Will be updated by advanced analysis
    isPresentation: false,
    isCameraFootage: false,
  };
}

/**
 * Determine if video should be compressed at all
 *
 * @param features - Video content features
 * @returns True if compression is recommended
 */
export function shouldCompress(features: VideoContentFeatures): boolean {
  // Don't compress if already using efficient codec
  if (features.sourceCodec?.toLowerCase().includes('hevc') ||
      features.sourceCodec?.toLowerCase().includes('h265')) {
    return false;
  }

  // Don't compress very short videos (< 10 seconds)
  if (features.duration < 10) {
    return false;
  }

  // Always compress large files
  return true;
}

/**
 * Get recommended CRF value based on video classification
 *
 * @param classification - Video classification result
 * @returns Recommended CRF value (lower = higher quality)
 */
export function getRecommendedCRF(classification: VideoClassification): number {
  switch (classification.profile) {
    case 'screenRecording':
      // Higher CRF for screen recordings (text remains readable at 28-30)
      return 30;
    case 'uploadedVideo':
      // Balanced CRF for camera footage
      return 26;
    case 'highQuality':
      // Lower CRF for high quality preservation
      return 23;
    default:
      return 26; // Safe default
  }
}

/**
 * Get recommended audio settings based on video classification
 *
 * @param classification - Video classification result
 * @returns Audio codec and bitrate recommendation
 */
export function getRecommendedAudioSettings(classification: VideoClassification): {
  codec: string;
  bitrate: string;
  channels: number;
} {
  // Screen recordings typically have voice-over only
  if (classification.profile === 'screenRecording') {
    return {
      codec: 'libopus',
      bitrate: '64k',
      channels: 1, // Mono for voice
    };
  }

  // Camera footage and high quality - preserve stereo
  return {
    codec: 'aac',
    bitrate: '128k',
    channels: 2, // Stereo
  };
}
