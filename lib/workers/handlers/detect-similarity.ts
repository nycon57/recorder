/**
 * Similarity Detection Job Handler
 *
 * Processes recordings for perceptual hashing and near-duplicate detection.
 * Can be triggered manually or automatically via scheduler.
 */

import { createClient } from '@/lib/supabase/admin';
import {
  calculatePerceptualHash,
  storePerceptualHash,
  findSimilarRecordings,
  batchProcessSimilarity,
  type SimilarityConfig,
} from '@/lib/services/similarity-detector';
import type { StorageProvider } from '@/lib/types/database';

/**
 * Job payload for single recording similarity detection
 */
export interface DetectSimilarityJobPayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
  storageProvider: StorageProvider;
  config?: SimilarityConfig;
}

/**
 * Job payload for batch similarity detection
 */
export interface BatchDetectSimilarityJobPayload {
  orgId: string;
  batchSize?: number;
  config?: SimilarityConfig;
}

/**
 * Handle single recording similarity detection
 */
export async function handleDetectSimilarity(
  payload: DetectSimilarityJobPayload
): Promise<{
  success: boolean;
  processed: boolean;
  matchesFound: number;
  error?: string;
}> {
  const { recordingId, orgId, storagePath, storageProvider, config } = payload;

  console.log(`[DetectSimilarity] Processing recording ${recordingId}`);

  try {
    // 1. Calculate perceptual hash
    const hash = await calculatePerceptualHash(recordingId, storagePath, storageProvider);

    if (!hash) {
      throw new Error('Failed to calculate perceptual hash');
    }

    // 2. Store hash in database
    const stored = await storePerceptualHash(hash);

    if (!stored) {
      throw new Error('Failed to store perceptual hash');
    }

    // 3. Find similar recordings
    const matches = await findSimilarRecordings(
      hash.videoHash,
      hash.audioHash,
      orgId,
      config,
      recordingId
    );

    // 4. Store similarity matches
    if (matches.length > 0) {
      const supabase = createClient();

      for (const match of matches) {
        await supabase.from('similarity_matches').insert({
          recording_id: recordingId,
          similar_recording_id: match.recordingId,
          video_similarity: match.videoSimilarity,
          audio_similarity: match.audioSimilarity,
          overall_similarity: match.overallSimilarity,
          hamming_distance: match.hammingDistance,
          detected_at: new Date().toISOString(),
        });
      }
    }

    console.log(
      `[DetectSimilarity] Completed: ${matches.length} similar recordings found for ${recordingId}`
    );

    return {
      success: true,
      processed: true,
      matchesFound: matches.length,
    };
  } catch (error) {
    console.error('[DetectSimilarity] Error:', error);
    return {
      success: false,
      processed: false,
      matchesFound: 0,
      error: error instanceof Error ? error.message : 'Similarity detection failed',
    };
  }
}

/**
 * Handle batch similarity detection for organization
 */
export async function handleBatchDetectSimilarity(
  payload: BatchDetectSimilarityJobPayload
): Promise<{
  success: boolean;
  processed: number;
  matches: number;
  errors: string[];
}> {
  const { orgId, batchSize = 50, config } = payload;

  console.log(`[BatchDetectSimilarity] Starting batch processing for org ${orgId}`);

  try {
    const result = await batchProcessSimilarity(orgId, batchSize);

    console.log(
      `[BatchDetectSimilarity] Processed ${result.processed} recordings, found ${result.matches} similar pairs`
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[BatchDetectSimilarity] Error:', error);
    return {
      success: false,
      processed: 0,
      matches: 0,
      errors: [error instanceof Error ? error.message : 'Batch similarity detection failed'],
    };
  }
}

/**
 * Schedule similarity detection for all organizations
 */
export async function scheduleSimilarityForAll(
  batchSizePerOrg: number = 50
): Promise<{
  success: boolean;
  organizations: number;
  totalProcessed: number;
  totalMatches: number;
  errors: string[];
}> {
  const supabase = createClient();

  console.log('[ScheduleSimilarity] Starting organization-wide similarity detection');

  try {
    // Get all active organizations
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    if (!organizations || organizations.length === 0) {
      return {
        success: true,
        organizations: 0,
        totalProcessed: 0,
        totalMatches: 0,
        errors: [],
      };
    }

    let totalProcessed = 0;
    let totalMatches = 0;
    const errors: string[] = [];

    // Process each organization
    for (const org of organizations) {
      try {
        const result = await batchProcessSimilarity(org.id, batchSizePerOrg);

        totalProcessed += result.processed;
        totalMatches += result.matches;

        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `${org.name}: ${e}`));
        }

        console.log(
          `[ScheduleSimilarity] ${org.name}: ${result.processed} processed, ${result.matches} matches found`
        );
      } catch (error) {
        const errorMsg = `${org.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('[ScheduleSimilarity]', errorMsg);
      }
    }

    console.log(
      `[ScheduleSimilarity] Completed: ${organizations.length} orgs, ${totalProcessed} recordings, ${totalMatches} similarity pairs found`
    );

    return {
      success: true,
      organizations: organizations.length,
      totalProcessed,
      totalMatches,
      errors,
    };
  } catch (error) {
    console.error('[ScheduleSimilarity] Fatal error:', error);
    return {
      success: false,
      organizations: 0,
      totalProcessed: 0,
      totalMatches: 0,
      errors: [error instanceof Error ? error.message : 'Scheduling failed'],
    };
  }
}

/**
 * Get similarity analytics for organization
 */
export async function getSimilarityAnalytics(orgId: string): Promise<{
  success: boolean;
  analytics?: {
    totalRecordings: number;
    processedRecordings: number;
    totalMatches: number;
    recordingsWithDuplicates: number;
    avgSimilarity: number;
    maxSimilarity: number;
    nearIdenticalMatches: number;
    highSimilarityMatches: number;
    mediumSimilarityMatches: number;
    processingProgress: number; // Percentage
    potentialStorageSavings: number; // Bytes
  };
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Get analytics from view
    const { data: analytics, error } = await supabase
      .from('similarity_analytics')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error) {
      throw error;
    }

    if (!analytics) {
      return {
        success: true,
        analytics: {
          totalRecordings: 0,
          processedRecordings: 0,
          totalMatches: 0,
          recordingsWithDuplicates: 0,
          avgSimilarity: 0,
          maxSimilarity: 0,
          nearIdenticalMatches: 0,
          highSimilarityMatches: 0,
          mediumSimilarityMatches: 0,
          processingProgress: 0,
          potentialStorageSavings: 0,
        },
      };
    }

    // Calculate processing progress
    const processingProgress =
      analytics.total_recordings > 0
        ? (analytics.processed_recordings / analytics.total_recordings) * 100
        : 0;

    // Estimate potential storage savings
    // Assume near-identical matches (95%+) could be deduplicated
    // Average file size: 100 MB (rough estimate)
    const avgFileSize = 100 * 1024 * 1024; // 100 MB in bytes
    const potentialStorageSavings = analytics.near_identical_matches * avgFileSize;

    return {
      success: true,
      analytics: {
        totalRecordings: analytics.total_recordings,
        processedRecordings: analytics.processed_recordings,
        totalMatches: analytics.total_matches,
        recordingsWithDuplicates: analytics.recordings_with_duplicates,
        avgSimilarity: Math.round((analytics.avg_similarity || 0) * 100) / 100,
        maxSimilarity: Math.round((analytics.max_similarity || 0) * 100) / 100,
        nearIdenticalMatches: analytics.near_identical_matches,
        highSimilarityMatches: analytics.high_similarity_matches,
        mediumSimilarityMatches: analytics.medium_similarity_matches,
        processingProgress: Math.round(processingProgress * 100) / 100,
        potentialStorageSavings,
      },
    };
  } catch (error) {
    console.error('[SimilarityAnalytics] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    };
  }
}
