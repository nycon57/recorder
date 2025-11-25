/**
 * Adaptive Transcription Router
 *
 * Intelligently routes transcription jobs to optimal providers:
 * - Gemini AI: Video understanding, visual context, cost-effective
 * - OpenAI Whisper: High accuracy, general purpose
 * - AssemblyAI: Low quality audio, speaker diarization, advanced features
 *
 * Selection criteria:
 * - Audio quality
 * - Content type (code demos need higher accuracy)
 * - Video availability (Gemini can use visual context)
 * - Cost vs quality tradeoffs
 * - Organization budget
 */

import type { ContentCategory } from './content-analyzer';
import type { OrganizationPlan } from '@/lib/types/database';

/**
 * Transcription provider options
 */
export type TranscriptionProvider = 'gemini' | 'whisper' | 'assemblyai' | 'none';

/**
 * Transcription routing decision
 */
export interface TranscriptionRoutingDecision {
  /** Selected provider */
  provider: TranscriptionProvider;
  /** Confidence in provider choice (0-1) */
  confidence: number;
  /** Estimated cost in credits (1 credit = $0.01) */
  estimatedCost: number;
  /** Estimated accuracy (0-100%) */
  estimatedAccuracy: number;
  /** Features to enable */
  features: {
    speakerDiarization: boolean;
    punctuation: boolean;
    timestamps: boolean;
    visualContext: boolean;
  };
  /** Reasoning for selection */
  reasoning: string;
}

/**
 * Provider capabilities and costs
 */
const PROVIDER_CONFIG = {
  gemini: {
    costPerMinute: 0.06, // $0.06/min (cheaper due to multimodal)
    avgAccuracy: 90,
    maxDuration: 3600,  // 1 hour
    supportsVideo: true,
    supportsSpeakerDiarization: false,
    bestFor: ['tutorial', 'presentation', 'webinar', 'code_demo'],
  },
  whisper: {
    costPerMinute: 0.10, // $0.10/min
    avgAccuracy: 92,
    maxDuration: 7200,  // 2 hours
    supportsVideo: false,
    supportsSpeakerDiarization: false,
    bestFor: ['podcast', 'screen_recording', 'camera_video'],
  },
  assemblyai: {
    costPerMinute: 0.15, // $0.15/min (more expensive but better features)
    avgAccuracy: 94,
    maxDuration: 10800, // 3 hours
    supportsVideo: false,
    supportsSpeakerDiarization: true,
    bestFor: ['webinar', 'podcast', 'hybrid'],
  },
};

/**
 * Route transcription to optimal provider
 */
export function routeTranscription(params: {
  category: ContentCategory;
  audioQuality: 'high' | 'medium' | 'low';
  duration: number; // in seconds
  hasVideo: boolean;
  orgPlan: OrganizationPlan;
  needsSpeakerDiarization?: boolean;
  budget?: number; // remaining budget in credits
}): TranscriptionRoutingDecision {
  const {
    category,
    audioQuality,
    duration,
    hasVideo,
    orgPlan,
    needsSpeakerDiarization = false,
    budget,
  } = params;

  const durationMin = duration / 60;
  let selectedProvider: TranscriptionProvider = 'whisper'; // Default
  let confidence = 0.5;
  let reasoning: string[] = [];

  // Calculate costs for each provider
  const costs = {
    gemini: Math.round(durationMin * PROVIDER_CONFIG.gemini.costPerMinute * 100),
    whisper: Math.round(durationMin * PROVIDER_CONFIG.whisper.costPerMinute * 100),
    assemblyai: Math.round(durationMin * PROVIDER_CONFIG.assemblyai.costPerMinute * 100),
  };

  // 1. Check duration limits
  type ValidProvider = keyof typeof PROVIDER_CONFIG;
  const viableProviders = (Object.keys(PROVIDER_CONFIG) as ValidProvider[]).filter(
    (provider) => {
      const config = PROVIDER_CONFIG[provider];
      return duration <= config.maxDuration;
    }
  );

  if (viableProviders.length === 0) {
    return {
      provider: 'none',
      confidence: 1,
      estimatedCost: 0,
      estimatedAccuracy: 0,
      features: {
        speakerDiarization: false,
        punctuation: false,
        timestamps: false,
        visualContext: false,
      },
      reasoning: `Duration (${durationMin.toFixed(1)} min) exceeds all provider limits`,
    };
  }

  // 2. Check budget constraints
  if (budget !== undefined) {
    const affordableProviders = viableProviders.filter((p: ValidProvider) => costs[p] <= budget);
    if (affordableProviders.length === 0) {
      return {
        provider: 'none',
        confidence: 1,
        estimatedCost: 0,
        estimatedAccuracy: 0,
        features: {
          speakerDiarization: false,
          punctuation: false,
          timestamps: false,
          visualContext: false,
        },
        reasoning: `Cost exceeds budget. Cheapest option: $${(Math.min(...Object.values(costs)) / 100).toFixed(2)}`,
      };
    }
    // Apply budget filter: narrow down to affordable providers only
    viableProviders.length = 0;
    viableProviders.push(...affordableProviders);
  }

  // 3. Check for speaker diarization requirement
  if (needsSpeakerDiarization) {
    if (viableProviders.includes('assemblyai')) {
      selectedProvider = 'assemblyai';
      confidence = 0.9;
      reasoning.push('Speaker diarization required → AssemblyAI');
    } else {
      // AssemblyAI not viable, fall back to best available provider
      reasoning.push('Speaker diarization requested but AssemblyAI not viable (duration/budget constraints)');
      // Continue to next selection logic below
    }
  }
  // 4. Use Gemini for video content with visual context
  if (
    selectedProvider === 'whisper' && // Only apply if no provider selected yet
    hasVideo &&
    viableProviders.includes('gemini') &&
    (category === 'tutorial' ||
      category === 'presentation' ||
      category === 'code_demo' ||
      category === 'webinar')
  ) {
    selectedProvider = 'gemini';
    confidence = 0.85;
    reasoning.push('Video content with visual context → Gemini multimodal');
    reasoning.push(`Cost-effective: $${(costs.gemini / 100).toFixed(2)} vs Whisper $${(costs.whisper / 100).toFixed(2)}`);
  }
  // 5. Use AssemblyAI for low quality audio
  if (selectedProvider === 'whisper' && audioQuality === 'low' && viableProviders.includes('assemblyai')) {
    selectedProvider = 'assemblyai';
    confidence = 0.8;
    reasoning.push('Low audio quality → AssemblyAI (highest accuracy)');
  }
  // 6. Use AssemblyAI for enterprise with budget
  if (selectedProvider === 'whisper' && orgPlan === 'enterprise' && viableProviders.includes('assemblyai')) {
    selectedProvider = 'assemblyai';
    confidence = 0.7;
    reasoning.push('Enterprise plan → AssemblyAI (premium features)');
  }
  // 7. Use Gemini for cost-conscious plans
  if (
    selectedProvider === 'whisper' &&
    (orgPlan === 'free' || orgPlan === 'pro') &&
    hasVideo &&
    viableProviders.includes('gemini')
  ) {
    selectedProvider = 'gemini';
    confidence = 0.75;
    reasoning.push(`Budget-conscious (${orgPlan}) → Gemini (lower cost)`);
  }
  // 8. Default to Whisper for reliability
  if (selectedProvider === 'whisper' && viableProviders.includes('whisper')) {
    // Already set to whisper
    confidence = 0.7;
    reasoning.push('Default → Whisper (reliable, balanced cost/quality)');
  }
  // 9. Fallback to cheapest available
  if (selectedProvider === 'whisper' && !viableProviders.includes('whisper')) {
    selectedProvider = viableProviders.sort((a: ValidProvider, b: ValidProvider) => costs[a] - costs[b])[0] as TranscriptionProvider;
    confidence = 0.5;
    reasoning.push('Fallback to cheapest available provider');
  }

  // Determine features - ensure selectedProvider is valid
  if (selectedProvider === 'none') {
    return {
      provider: 'none',
      confidence: 0,
      estimatedCost: 0,
      estimatedAccuracy: 0,
      features: {
        speakerDiarization: false,
        punctuation: false,
        timestamps: false,
        visualContext: false,
      },
      reasoning: 'No viable provider available',
    };
  }

  const providerConfig = PROVIDER_CONFIG[selectedProvider as ValidProvider];
  const features = {
    speakerDiarization: needsSpeakerDiarization && providerConfig.supportsSpeakerDiarization,
    punctuation: true, // All providers support this
    timestamps: true,  // All providers support this
    visualContext: hasVideo && providerConfig.supportsVideo,
  };

  // Calculate estimated accuracy
  let estimatedAccuracy = providerConfig.avgAccuracy;
  if (audioQuality === 'low') estimatedAccuracy -= 10;
  else if (audioQuality === 'high') estimatedAccuracy += 5;
  if (features.visualContext) estimatedAccuracy += 3;
  estimatedAccuracy = Math.min(100, Math.max(60, estimatedAccuracy));

  return {
    provider: selectedProvider,
    confidence,
    estimatedCost: costs[selectedProvider as ValidProvider],
    estimatedAccuracy,
    features,
    reasoning: reasoning.join('. '),
  };
}

/**
 * Get provider comparison for user display
 */
export function compareProviders(params: {
  category: ContentCategory;
  duration: number;
  hasVideo: boolean;
}): Array<{
  provider: TranscriptionProvider;
  cost: number;
  accuracy: number;
  features: string[];
  recommended: boolean;
}> {
  const { category, duration, hasVideo } = params;
  const durationMin = duration / 60;

  return (Object.keys(PROVIDER_CONFIG) as Array<keyof typeof PROVIDER_CONFIG>).map(
    (provider) => {
      const config = PROVIDER_CONFIG[provider];
      const cost = Math.round(durationMin * config.costPerMinute * 100);
      const features: string[] = [];

      if (config.supportsVideo && hasVideo) features.push('Visual context');
      if (config.supportsSpeakerDiarization) features.push('Speaker diarization');
      features.push('Timestamps');
      features.push('Punctuation');

      const recommended = config.bestFor.includes(category);

      return {
        provider,
        cost,
        accuracy: config.avgAccuracy,
        features,
        recommended,
      };
    }
  );
}

/**
 * Estimate transcription quality based on audio features
 */
export function estimateTranscriptionQuality(params: {
  provider: TranscriptionProvider;
  audioQuality: 'high' | 'medium' | 'low';
  hasBackgroundNoise: boolean;
  speechClarity: number; // 0-1
  hasAccent: boolean;
}): {
  expectedAccuracy: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  warnings: string[];
} {
  const { provider, audioQuality, hasBackgroundNoise, speechClarity, hasAccent } = params;

  if (provider === 'none') {
    return {
      expectedAccuracy: 0,
      confidenceLevel: 'low',
      warnings: ['No transcription will be performed'],
    };
  }

  let accuracy = PROVIDER_CONFIG[provider].avgAccuracy;
  const warnings: string[] = [];

  // Adjust for audio quality
  if (audioQuality === 'low') {
    accuracy -= 15;
    warnings.push('Low audio quality may reduce accuracy by ~15%');
  } else if (audioQuality === 'medium') {
    accuracy -= 5;
  }

  // Adjust for background noise
  if (hasBackgroundNoise) {
    accuracy -= 8;
    warnings.push('Background noise detected');
  }

  // Adjust for speech clarity
  accuracy += (speechClarity - 0.5) * 20; // -10 to +10 adjustment

  // Adjust for accent
  if (hasAccent) {
    accuracy -= 5;
    warnings.push('Non-native accent may slightly reduce accuracy');
  }

  // Normalize
  accuracy = Math.min(100, Math.max(40, accuracy));

  const confidenceLevel: 'high' | 'medium' | 'low' =
    accuracy >= 85 ? 'high' : accuracy >= 70 ? 'medium' : 'low';

  return {
    expectedAccuracy: Math.round(accuracy),
    confidenceLevel,
    warnings,
  };
}
