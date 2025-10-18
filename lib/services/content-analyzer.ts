/**
 * Enhanced Content Analyzer
 *
 * Advanced content analysis for intelligent processing decisions:
 * - Audio quality and content type detection
 * - Video complexity and scene analysis
 * - Text density estimation
 * - Tutorial and code demo detection
 * - Processing cost estimation
 */

import type { ContentType, CompressionProfile } from '@/lib/types/database';
import {
  classifyVideoContent,
  extractVideoFeatures,
  type VideoContentFeatures,
  type VideoClassification,
} from './video-content-classifier';

/**
 * Audio content features
 */
export interface AudioContentFeatures {
  /** Audio codec */
  codec?: string;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Bitrate in kbps */
  bitrate?: number;
  /** Number of channels (1=mono, 2=stereo) */
  channels?: number;
  /** Duration in seconds */
  duration: number;
  /** Estimated speech ratio (0-1, 0=silence, 1=continuous speech) */
  speechRatio?: number;
  /** Estimated music ratio (0-1) */
  musicRatio?: number;
  /** Background noise level (0-1, 0=clean, 1=noisy) */
  noiseLevel?: number;
}

/**
 * Audio classification result
 */
export interface AudioClassification {
  /** Detected audio type */
  audioType: 'voice' | 'music' | 'mixed' | 'ambient' | 'silent';
  /** Audio quality assessment */
  quality: 'high' | 'medium' | 'low';
  /** Recommended audio codec */
  recommendedCodec: 'libopus' | 'aac' | 'mp3';
  /** Recommended bitrate */
  recommendedBitrate: string;
  /** Recommended channels */
  recommendedChannels: 1 | 2;
  /** Confidence score */
  confidence: number;
  /** Features used */
  features: AudioContentFeatures;
  /** Reasoning */
  reasoning: string;
}

/**
 * Scene complexity analysis
 */
export interface SceneComplexity {
  /** Overall complexity score (0-1, 0=static, 1=complex) */
  complexity: number;
  /** Estimated number of scene changes */
  sceneChanges?: number;
  /** Motion intensity (0-1) */
  motionIntensity: number;
  /** Text density estimate (0-1, 0=no text, 1=lots of text) */
  textDensity?: number;
  /** Color complexity (0-1, 0=monochrome, 1=colorful) */
  colorComplexity?: number;
}

/**
 * Content category for specialized processing
 */
export type ContentCategory =
  | 'tutorial'          // Educational content with narration
  | 'presentation'      // Slide deck presentation
  | 'code_demo'         // Programming/coding demonstration
  | 'screen_recording'  // General screen capture
  | 'camera_video'      // Camera footage
  | 'hybrid'            // Mixed screen + camera
  | 'podcast'           // Audio-only or static video
  | 'webinar'           // Live presentation/meeting
  | 'unknown';          // Cannot determine

/**
 * Comprehensive content analysis result
 */
export interface ContentAnalysisResult {
  /** Primary content category */
  category: ContentCategory;
  /** Video classification (if video content) */
  video?: VideoClassification;
  /** Audio classification */
  audio?: AudioClassification;
  /** Scene complexity analysis */
  sceneComplexity?: SceneComplexity;
  /** Recommended compression profile */
  recommendedProfile: CompressionProfile;
  /** Processing priority (1-5, 1=highest) */
  processingPriority: number;
  /** Estimated processing cost in credits */
  estimatedCost: number;
  /** Recommended transcription provider */
  transcriptionProvider: 'gemini' | 'whisper' | 'assemblyai' | 'none';
  /** Skip unnecessary processing steps */
  skipProcessing: {
    compression: boolean;
    transcription: boolean;
    docGeneration: boolean;
    embeddings: boolean;
  };
  /** Overall confidence */
  confidence: number;
  /** Analysis reasoning */
  reasoning: string;
}

/**
 * Analyze audio content
 */
export function analyzeAudioContent(features: AudioContentFeatures): AudioClassification {
  let voiceScore = 0;
  let musicScore = 0;
  let ambientScore = 0;

  // 1. Analyze speech ratio
  if (features.speechRatio !== undefined) {
    if (features.speechRatio > 0.7) {
      voiceScore += 0.5;
    } else if (features.speechRatio > 0.3) {
      voiceScore += 0.3;
    } else if (features.speechRatio < 0.1) {
      ambientScore += 0.3;
    }
  }

  // 2. Analyze music ratio
  if (features.musicRatio !== undefined) {
    if (features.musicRatio > 0.7) {
      musicScore += 0.5;
    } else if (features.musicRatio > 0.3) {
      musicScore += 0.3;
    }
  }

  // 3. Channel analysis
  if (features.channels === 1) {
    voiceScore += 0.2; // Mono typically indicates voice content
  } else if (features.channels === 2) {
    musicScore += 0.1; // Stereo more common in music
  }

  // 4. Bitrate analysis
  if (features.bitrate) {
    if (features.bitrate < 96) {
      voiceScore += 0.1; // Low bitrate suggests voice optimization
    } else if (features.bitrate > 192) {
      musicScore += 0.2; // High bitrate suggests music
    }
  }

  // 5. Codec analysis
  if (features.codec) {
    const codec = features.codec.toLowerCase();
    if (codec.includes('opus')) {
      voiceScore += 0.1; // Opus optimized for voice
    } else if (codec.includes('aac')) {
      musicScore += 0.1; // AAC common for music
    }
  }

  // Determine audio type
  const maxScore = Math.max(voiceScore, musicScore, ambientScore);
  let audioType: AudioClassification['audioType'];
  let recommendedCodec: AudioClassification['recommendedCodec'];
  let recommendedBitrate: string;
  let recommendedChannels: 1 | 2;
  let quality: AudioClassification['quality'];
  let reasoning: string;

  if (maxScore < 0.2) {
    audioType = 'silent';
    recommendedCodec = 'aac';
    recommendedBitrate = '64k';
    recommendedChannels = 1;
    quality = 'low';
    reasoning = 'Minimal audio content detected';
  } else if (voiceScore === maxScore) {
    audioType = 'voice';
    recommendedCodec = 'libopus';
    recommendedBitrate = features.noiseLevel && features.noiseLevel > 0.5 ? '96k' : '64k';
    recommendedChannels = 1;
    quality = features.noiseLevel && features.noiseLevel < 0.3 ? 'high' : 'medium';
    reasoning = `Voice content detected (score: ${voiceScore.toFixed(2)}). ${features.noiseLevel && features.noiseLevel > 0.5 ? 'Higher bitrate due to background noise.' : 'Clean voice, using efficient Opus codec.'}`;
  } else if (musicScore === maxScore) {
    audioType = 'music';
    recommendedCodec = 'aac';
    recommendedBitrate = '128k';
    recommendedChannels = 2;
    quality = 'high';
    reasoning = `Music content detected (score: ${musicScore.toFixed(2)}). Preserving stereo with AAC codec.`;
  } else if (ambientScore === maxScore) {
    audioType = 'ambient';
    recommendedCodec = 'aac';
    recommendedBitrate = '96k';
    recommendedChannels = 2;
    quality = 'medium';
    reasoning = `Ambient audio detected. Using moderate quality settings.`;
  } else {
    audioType = 'mixed';
    recommendedCodec = 'aac';
    recommendedBitrate = '128k';
    recommendedChannels = 2;
    quality = 'medium';
    reasoning = 'Mixed audio content. Using balanced settings.';
  }

  return {
    audioType,
    quality,
    recommendedCodec,
    recommendedBitrate,
    recommendedChannels,
    confidence: maxScore,
    features,
    reasoning,
  };
}

/**
 * Analyze scene complexity
 */
export function analyzeSceneComplexity(
  videoFeatures: VideoContentFeatures,
  videoClassification: VideoClassification
): SceneComplexity {
  let complexity = 0;
  let motionIntensity = videoFeatures.motionLevel || 0.5;

  // 1. Base complexity from content type
  switch (videoClassification.contentType) {
    case 'screen_recording':
      complexity = 0.3; // Generally low complexity
      motionIntensity = 0.2;
      break;
    case 'presentation':
      complexity = 0.2; // Very low complexity
      motionIntensity = 0.1;
      break;
    case 'camera_footage':
      complexity = 0.7; // Higher complexity
      motionIntensity = 0.6;
      break;
    case 'mixed':
      complexity = 0.5;
      motionIntensity = 0.5;
      break;
  }

  // 2. Adjust based on motion level
  if (videoFeatures.motionLevel !== undefined) {
    complexity = (complexity + videoFeatures.motionLevel) / 2;
    motionIntensity = videoFeatures.motionLevel;
  }

  // 3. Adjust based on FPS
  if (videoFeatures.fps >= 60) {
    complexity += 0.1; // High FPS adds complexity
    motionIntensity += 0.1;
  }

  // 4. Adjust based on resolution
  const pixelCount = videoFeatures.width * videoFeatures.height;
  if (pixelCount >= 3840 * 2160) {
    // 4K
    complexity += 0.15;
  } else if (pixelCount >= 2560 * 1440) {
    // 2K
    complexity += 0.1;
  }

  // Normalize
  complexity = Math.min(1, Math.max(0, complexity));
  motionIntensity = Math.min(1, Math.max(0, motionIntensity));

  return {
    complexity,
    motionIntensity,
    sceneChanges: undefined, // TODO: Implement scene change detection
    textDensity: videoClassification.contentType === 'screen_recording' ? 0.7 : 0.2,
    colorComplexity: undefined, // TODO: Implement color complexity analysis
  };
}

/**
 * Determine content category
 */
export function determineContentCategory(
  contentType: ContentType,
  videoClassification?: VideoClassification,
  audioClassification?: AudioClassification,
  metadata?: any
): ContentCategory {
  // 1. Check explicit content type
  if (contentType === 'recording') {
    // Screen recording with voice likely tutorial or demo
    if (audioClassification?.audioType === 'voice') {
      // Check for code patterns in title/description
      const title = metadata?.title?.toLowerCase() || '';
      const desc = metadata?.description?.toLowerCase() || '';

      if (
        title.includes('code') ||
        title.includes('programming') ||
        title.includes('tutorial') ||
        desc.includes('code')
      ) {
        return 'code_demo';
      }

      if (videoClassification?.contentType === 'presentation') {
        return 'presentation';
      }

      return 'tutorial';
    }

    return 'screen_recording';
  }

  if (contentType === 'video') {
    if (videoClassification?.contentType === 'camera_footage') {
      return 'camera_video';
    }
    if (videoClassification?.contentType === 'presentation') {
      return 'presentation';
    }
  }

  if (contentType === 'audio') {
    if (audioClassification?.audioType === 'voice') {
      return 'podcast';
    }
  }

  return 'unknown';
}

/**
 * Estimate processing cost in credits
 * (1 credit = $0.01 USD)
 */
export function estimateProcessingCost(
  category: ContentCategory,
  duration: number,
  fileSize: number
): number {
  // Base costs per minute
  const baseCostPerMin: Record<ContentCategory, number> = {
    tutorial: 0.15,       // Transcription + doc generation + embeddings
    presentation: 0.12,   // Full processing
    code_demo: 0.18,      // Higher quality transcription needed
    screen_recording: 0.10,
    camera_video: 0.20,   // Compression + transcription
    hybrid: 0.18,
    podcast: 0.08,        // Audio only, lighter processing
    webinar: 0.15,
    unknown: 0.12,
  };

  const durationMin = duration / 60;
  let cost = baseCostPerMin[category] * durationMin;

  // Add compression cost (based on file size)
  const fileSizeGB = fileSize / 1024 / 1024 / 1024;
  cost += fileSizeGB * 0.05; // $0.05 per GB for compression

  return Math.round(cost * 100) / 100; // Round to 2 decimals
}

/**
 * Determine processing priority
 * 1 = highest (process immediately)
 * 5 = lowest (can wait)
 */
export function determineProcessingPriority(
  category: ContentCategory,
  fileSize: number,
  orgPlan: 'free' | 'pro' | 'enterprise' = 'free'
): number {
  // Base priority by category
  const basePriority: Record<ContentCategory, number> = {
    tutorial: 2,
    presentation: 2,
    code_demo: 2,
    screen_recording: 3,
    camera_video: 3,
    hybrid: 3,
    podcast: 4,
    webinar: 2,
    unknown: 4,
  };

  let priority = basePriority[category];

  // Adjust based on org plan
  if (orgPlan === 'enterprise') {
    priority = Math.max(1, priority - 1); // Higher priority for enterprise
  } else if (orgPlan === 'free') {
    priority = Math.min(5, priority + 1); // Lower priority for free tier
  }

  // Adjust based on file size (larger files = lower priority)
  const fileSizeGB = fileSize / 1024 / 1024 / 1024;
  if (fileSizeGB > 5) {
    priority = Math.min(5, priority + 1);
  }

  return priority;
}

/**
 * Determine which processing steps to skip
 */
export function determineProcessingSteps(
  category: ContentCategory,
  duration: number,
  audioClassification?: AudioClassification
): ContentAnalysisResult['skipProcessing'] {
  return {
    compression: false, // Always compress (unless already H.265)
    transcription:
      category === 'unknown' ||
      duration < 5 || // Skip very short videos
      audioClassification?.audioType === 'silent' ||
      audioClassification?.audioType === 'ambient',
    docGeneration:
      category === 'unknown' ||
      duration < 10 ||
      audioClassification?.audioType === 'silent',
    embeddings:
      category === 'unknown' ||
      duration < 10 ||
      audioClassification?.audioType === 'silent',
  };
}

/**
 * Select optimal transcription provider
 */
export function selectTranscriptionProvider(
  category: ContentCategory,
  audioClassification?: AudioClassification
): ContentAnalysisResult['transcriptionProvider'] {
  // Skip transcription if no speech
  if (
    audioClassification?.audioType === 'silent' ||
    audioClassification?.audioType === 'ambient' ||
    audioClassification?.audioType === 'music'
  ) {
    return 'none';
  }

  // Use higher quality for code demos (need accuracy)
  if (category === 'code_demo' || category === 'tutorial') {
    return audioClassification.quality === 'low' ? 'assemblyai' : 'gemini';
  }

  // Use Gemini for video understanding
  if (category === 'presentation' || category === 'webinar') {
    return 'gemini';
  }

  // Default to Whisper for cost efficiency
  return 'whisper';
}

/**
 * Comprehensive content analysis
 * Main entry point for Phase 3 content-aware processing
 */
export async function analyzeContent(
  contentType: ContentType,
  metadata: any,
  fileSize: number,
  orgPlan: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<ContentAnalysisResult> {
  let videoClassification: VideoClassification | undefined;
  let audioClassification: AudioClassification | undefined;
  let sceneComplexity: SceneComplexity | undefined;

  // 1. Analyze video content (if video)
  if (contentType === 'recording' || contentType === 'video') {
    const videoFeatures = extractVideoFeatures(metadata);
    videoClassification = classifyVideoContent(videoFeatures);
    sceneComplexity = analyzeSceneComplexity(videoFeatures, videoClassification);
  }

  // 2. Analyze audio content (if has audio)
  const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');
  if (audioStream) {
    const audioFeatures: AudioContentFeatures = {
      codec: audioStream.codec_name,
      sampleRate: audioStream.sample_rate,
      bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) / 1000 : undefined,
      channels: audioStream.channels,
      duration: parseFloat(audioStream.duration || metadata.format?.duration || '0'),
    };
    audioClassification = analyzeAudioContent(audioFeatures);
  }

  // 3. Determine content category
  const category = determineContentCategory(
    contentType,
    videoClassification,
    audioClassification,
    metadata
  );

  // 4. Determine processing parameters
  const duration = parseFloat(metadata.format?.duration || '0');
  const processingPriority = determineProcessingPriority(category, fileSize, orgPlan);
  const estimatedCost = estimateProcessingCost(category, duration, fileSize);
  const skipProcessing = determineProcessingSteps(category, duration, audioClassification);
  const transcriptionProvider = selectTranscriptionProvider(category, audioClassification);

  // 5. Determine recommended compression profile
  const recommendedProfile: CompressionProfile =
    videoClassification?.profile ||
    (audioClassification?.audioType === 'voice' ? 'audioVoice' : 'audioMusic');

  // 6. Calculate overall confidence
  const confidence =
    (videoClassification?.confidence || 0.5) * 0.6 +
    (audioClassification?.confidence || 0.5) * 0.4;

  // 7. Generate reasoning
  const reasoning = [
    `Content category: ${category}`,
    videoClassification?.reasoning,
    audioClassification?.reasoning,
    `Processing priority: ${processingPriority}/5`,
    `Estimated cost: $${estimatedCost}`,
    `Transcription: ${transcriptionProvider}`,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    category,
    video: videoClassification,
    audio: audioClassification,
    sceneComplexity,
    recommendedProfile,
    processingPriority,
    estimatedCost,
    transcriptionProvider,
    skipProcessing,
    confidence,
    reasoning,
  };
}
