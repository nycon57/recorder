/**
 * File Deduplication Job Handler
 *
 * Processes files for deduplication to reduce storage costs.
 * Can be triggered manually or automatically via scheduler.
 */

import { createClient } from '@/lib/supabase/admin';
import {
  deduplicateFile,
  batchDeduplicateOrganization,
  getDeduplicationStats,
} from '@/lib/services/deduplication-service';
import { StorageManager } from '@/lib/services/storage-manager';
import type { StorageProvider } from '@/lib/types/database';

/**
 * Job payload for single file deduplication
 */
export interface DeduplicateFileJobPayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
  storageProvider: StorageProvider;
}

/**
 * Job payload for batch deduplication
 */
export interface BatchDeduplicateJobPayload {
  orgId: string;
  batchSize?: number;
}

/**
 * Handle single file deduplication
 */
export async function handleDeduplicateFile(
  payload: DeduplicateFileJobPayload
): Promise<{
  success: boolean;
  isDuplicate: boolean;
  spaceSaved: number;
  error?: string;
}> {
  const { recordingId, orgId, storagePath, storageProvider } = payload;

  console.log(`[DeduplicateFile] Processing recording ${recordingId}`);

  try {
    // 1. Download file from storage
    const storageManager = new StorageManager();
    const supabase = createClient();

    const { data: recording } = await supabase
      .from('recordings')
      .select('storage_path, storage_path_r2')
      .eq('id', recordingId)
      .single();

    if (!recording) {
      throw new Error('Recording not found');
    }

    const downloadResult = await storageManager.download(
      recording.storage_path,
      recording.storage_path_r2,
      storageProvider,
      { asBuffer: true }
    );

    if (!downloadResult.success || !downloadResult.data) {
      throw new Error(downloadResult.error || 'Failed to download file');
    }

    // 2. Process deduplication
    const result = await deduplicateFile(
      recordingId,
      orgId,
      downloadResult.data,
      storagePath,
      storageProvider
    );

    if (result.error) {
      throw new Error(result.error);
    }

    console.log(
      `[DeduplicateFile] Completed: ${result.isDuplicate ? 'Duplicate found' : 'Unique file'}, saved ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`
    );

    return {
      success: true,
      isDuplicate: result.isDuplicate,
      spaceSaved: result.spaceSaved,
    };
  } catch (error) {
    console.error('[DeduplicateFile] Error:', error);
    return {
      success: false,
      isDuplicate: false,
      spaceSaved: 0,
      error: error instanceof Error ? error.message : 'Deduplication failed',
    };
  }
}

/**
 * Handle batch deduplication for organization
 */
export async function handleBatchDeduplicate(
  payload: BatchDeduplicateJobPayload
): Promise<{
  success: boolean;
  processed: number;
  duplicatesFound: number;
  spaceSaved: number;
  errors: string[];
}> {
  const { orgId, batchSize = 100 } = payload;

  console.log(`[BatchDeduplicate] Starting batch deduplication for org ${orgId}`);

  try {
    const result = await batchDeduplicateOrganization(orgId, batchSize);

    console.log(
      `[BatchDeduplicate] Processed ${result.processed} files, found ${result.duplicatesFound} duplicates, saved ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB`
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('[BatchDeduplicate] Error:', error);
    return {
      success: false,
      processed: 0,
      duplicatesFound: 0,
      spaceSaved: 0,
      errors: [error instanceof Error ? error.message : 'Batch deduplication failed'],
    };
  }
}

/**
 * Schedule deduplication for all organizations
 */
export async function scheduleDeduplicationForAll(
  batchSizePerOrg: number = 100
): Promise<{
  success: boolean;
  organizations: number;
  totalProcessed: number;
  totalDuplicates: number;
  totalSpaceSaved: number;
  errors: string[];
}> {
  const supabase = createClient();

  console.log('[ScheduleDeduplication] Starting organization-wide deduplication');

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
        totalDuplicates: 0,
        totalSpaceSaved: 0,
        errors: [],
      };
    }

    let totalProcessed = 0;
    let totalDuplicates = 0;
    let totalSpaceSaved = 0;
    const errors: string[] = [];

    // Process each organization
    for (const org of organizations) {
      try {
        const result = await batchDeduplicateOrganization(org.id, batchSizePerOrg);

        totalProcessed += result.processed;
        totalDuplicates += result.duplicatesFound;
        totalSpaceSaved += result.spaceSaved;

        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `${org.name}: ${e}`));
        }

        console.log(
          `[ScheduleDeduplication] ${org.name}: ${result.processed} processed, ${result.duplicatesFound} duplicates, ${(result.spaceSaved / 1024 / 1024).toFixed(2)} MB saved`
        );
      } catch (error) {
        const errorMsg = `${org.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('[ScheduleDeduplication]', errorMsg);
      }
    }

    console.log(
      `[ScheduleDeduplication] Completed: ${organizations.length} orgs, ${totalProcessed} files, ${totalDuplicates} duplicates, ${(totalSpaceSaved / 1024 / 1024).toFixed(2)} MB saved`
    );

    return {
      success: true,
      organizations: organizations.length,
      totalProcessed,
      totalDuplicates,
      totalSpaceSaved,
      errors,
    };
  } catch (error) {
    console.error('[ScheduleDeduplication] Fatal error:', error);
    return {
      success: false,
      organizations: 0,
      totalProcessed: 0,
      totalDuplicates: 0,
      totalSpaceSaved: 0,
      errors: [error instanceof Error ? error.message : 'Scheduling failed'],
    };
  }
}

/**
 * Get deduplication analytics
 */
export async function getDeduplicationAnalytics(orgId: string): Promise<{
  success: boolean;
  stats?: {
    totalFiles: number;
    uniqueFiles: number;
    duplicateFiles: number;
    totalStorageBytes: number;
    actualStorageBytes: number;
    spaceSavedBytes: number;
    spaceSavedPercent: number;
    deduplicationRatio: number;
    potentialSavingsPerMonth: number;
  };
  error?: string;
}> {
  try {
    const stats = await getDeduplicationStats(orgId);

    // Calculate cost savings
    // Assuming $0.021/GB/month for storage
    const spaceSavedGB = stats.spaceSavedBytes / 1024 / 1024 / 1024;
    const potentialSavingsPerMonth = spaceSavedGB * 0.021;

    return {
      success: true,
      stats: {
        ...stats,
        potentialSavingsPerMonth: Math.round(potentialSavingsPerMonth * 100) / 100,
      },
    };
  } catch (error) {
    console.error('[DeduplicationAnalytics] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    };
  }
}
