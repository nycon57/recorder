/**
 * File Deduplication Service
 *
 * Implements content-based deduplication to reduce storage costs:
 * - SHA-256 hash-based duplicate detection
 * - Reference counting for shared files
 * - Automatic cleanup of duplicate files
 * - Storage savings tracking
 */

import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/admin';
import { StorageManager } from './storage-manager';
import type { StorageProvider, StorageTier } from '@/lib/types/database';

/**
 * File hash and metadata
 */
export interface FileHash {
  hash: string;
  fileSize: number;
  recordingId: string;
  storagePath: string;
  storageProvider: StorageProvider;
  storageTier: StorageTier;
  createdAt: Date;
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  recordingId: string;
  isDuplicate: boolean;
  originalRecordingId?: string;
  referenceCreated: boolean;
  spaceSaved: number;
  error?: string;
}

/**
 * Deduplication statistics
 */
export interface DeduplicationStats {
  orgId: string;
  totalFiles: number;
  uniqueFiles: number;
  duplicateFiles: number;
  totalStorageBytes: number;
  actualStorageBytes: number;
  spaceSavedBytes: number;
  spaceSavedPercent: number;
  deduplicationRatio: number;
}

/**
 * Calculate SHA-256 hash of file content
 */
export async function calculateFileHash(data: Buffer): Promise<string> {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Find duplicate files by hash
 */
export async function findDuplicateByHash(
  hash: string,
  orgId: string,
  excludeRecordingId?: string
): Promise<FileHash | null> {
  const supabase = createClient();

  let query = supabase
    .from('recordings')
    .select('id, file_hash, file_size, storage_path, storage_path_r2, storage_provider, storage_tier, created_at')
    .eq('org_id', orgId)
    .eq('file_hash', hash)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (excludeRecordingId) {
    query = query.neq('id', excludeRecordingId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  return {
    hash: data.file_hash,
    fileSize: data.file_size,
    recordingId: data.id,
    storagePath: data.storage_path_r2 || data.storage_path,
    storageProvider: data.storage_provider || 'supabase',
    storageTier: data.storage_tier || 'hot',
    createdAt: new Date(data.created_at),
  };
}

/**
 * Create file reference for duplicate
 */
export async function createFileReference(
  recordingId: string,
  originalRecordingId: string,
  fileSize: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // 1. Create reference record
    const { error: refError } = await supabase.from('file_references').insert({
      recording_id: recordingId,
      original_recording_id: originalRecordingId,
      file_size: fileSize,
      created_at: new Date().toISOString(),
    });

    if (refError) {
      throw refError;
    }

    // 2. Update reference count on original
    const { error: updateError } = await supabase.rpc('increment_reference_count', {
      recording_id: originalRecordingId,
    });

    if (updateError) {
      console.warn('[Deduplication] Failed to update reference count:', updateError);
    }

    // 3. Mark recording as deduplicated
    const { error: markError } = await supabase
      .from('recordings')
      .update({
        is_deduplicated: true,
        deduplicated_from: originalRecordingId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (markError) {
      throw markError;
    }

    return { success: true };
  } catch (error) {
    console.error('[Deduplication] Failed to create file reference:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create reference',
    };
  }
}

/**
 * Process file for deduplication
 */
export async function deduplicateFile(
  recordingId: string,
  orgId: string,
  fileData: Buffer,
  currentPath: string,
  currentProvider: StorageProvider
): Promise<DeduplicationResult> {
  try {
    // 1. Calculate file hash
    const hash = await calculateFileHash(fileData);
    const fileSize = fileData.length;

    // 2. Update recording with hash
    const supabase = createClient();
    await supabase
      .from('recordings')
      .update({
        file_hash: hash,
        file_size: fileSize,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    // 3. Check for existing file with same hash
    const duplicate = await findDuplicateByHash(hash, orgId, recordingId);

    if (!duplicate) {
      // No duplicate found - this is a unique file
      return {
        recordingId,
        isDuplicate: false,
        referenceCreated: false,
        spaceSaved: 0,
      };
    }

    // 4. Create reference to original file
    const refResult = await createFileReference(recordingId, duplicate.recordingId, fileSize);

    if (!refResult.success) {
      return {
        recordingId,
        isDuplicate: true,
        originalRecordingId: duplicate.recordingId,
        referenceCreated: false,
        spaceSaved: 0,
        error: refResult.error,
      };
    }

    // 5. Delete duplicate file from storage
    const storageManager = StorageManager.getInstance();
    await storageManager.delete(currentPath, currentProvider === 'r2' ? currentPath : null);

    console.log(
      `[Deduplication] Recording ${recordingId} is duplicate of ${duplicate.recordingId}. Saved ${(fileSize / 1024 / 1024).toFixed(2)} MB`
    );

    return {
      recordingId,
      isDuplicate: true,
      originalRecordingId: duplicate.recordingId,
      referenceCreated: true,
      spaceSaved: fileSize,
    };
  } catch (error) {
    console.error('[Deduplication] Error processing file:', error);
    return {
      recordingId,
      isDuplicate: false,
      referenceCreated: false,
      spaceSaved: 0,
      error: error instanceof Error ? error.message : 'Deduplication failed',
    };
  }
}

/**
 * Batch deduplication for organization
 */
export async function batchDeduplicateOrganization(
  orgId: string,
  batchSize: number = 100
): Promise<{
  processed: number;
  duplicatesFound: number;
  spaceSaved: number;
  errors: string[];
}> {
  const supabase = createClient();
  const storageManager = StorageManager.getInstance();

  // Get recordings without hashes
  const { data: recordings, error } = await supabase
    .from('recordings')
    .select('id, storage_path, storage_path_r2, storage_provider, file_size')
    .eq('org_id', orgId)
    .is('file_hash', null)
    .is('deleted_at', null)
    .is('is_deduplicated', false)
    .limit(batchSize);

  if (error || !recordings || recordings.length === 0) {
    return {
      processed: 0,
      duplicatesFound: 0,
      spaceSaved: 0,
      errors: error ? [error.message] : [],
    };
  }

  let processed = 0;
  let duplicatesFound = 0;
  let spaceSaved = 0;
  const errors: string[] = [];

  for (const recording of recordings) {
    try {
      // Download file to calculate hash
      const storagePath = recording.storage_path_r2 || recording.storage_path;
      const provider = recording.storage_provider || 'supabase';

      const downloadResult = await storageManager.download(
        recording.storage_path,
        recording.storage_path_r2,
        provider,
        { asBuffer: true }
      );

      if (!downloadResult.success || !downloadResult.data) {
        errors.push(`Failed to download ${recording.id}`);
        continue;
      }

      // Process deduplication
      const result = await deduplicateFile(
        recording.id,
        orgId,
        downloadResult.data,
        storagePath,
        provider
      );

      processed++;

      if (result.isDuplicate && result.referenceCreated) {
        duplicatesFound++;
        spaceSaved += result.spaceSaved;
      }

      if (result.error) {
        errors.push(`${recording.id}: ${result.error}`);
      }
    } catch (error) {
      errors.push(`${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    processed,
    duplicatesFound,
    spaceSaved,
    errors,
  };
}

/**
 * Get deduplication statistics for organization
 */
export async function getDeduplicationStats(orgId: string): Promise<DeduplicationStats> {
  const supabase = createClient();

  // Get all recordings
  const { data: recordings } = await supabase
    .from('recordings')
    .select('id, file_size, is_deduplicated, file_hash')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (!recordings || recordings.length === 0) {
    return {
      orgId,
      totalFiles: 0,
      uniqueFiles: 0,
      duplicateFiles: 0,
      totalStorageBytes: 0,
      actualStorageBytes: 0,
      spaceSavedBytes: 0,
      spaceSavedPercent: 0,
      deduplicationRatio: 1,
    };
  }

  const totalFiles = recordings.length;
  const duplicateFiles = recordings.filter((r) => r.is_deduplicated).length;
  const uniqueFiles = totalFiles - duplicateFiles;

  // Calculate storage
  const totalStorageBytes = recordings.reduce((sum, r) => sum + (r.file_size || 0), 0);

  // Actual storage = unique files only
  const uniqueRecordings = recordings.filter((r) => !r.is_deduplicated);
  const actualStorageBytes = uniqueRecordings.reduce((sum, r) => sum + (r.file_size || 0), 0);

  const spaceSavedBytes = totalStorageBytes - actualStorageBytes;
  const spaceSavedPercent = totalStorageBytes > 0 ? (spaceSavedBytes / totalStorageBytes) * 100 : 0;
  const deduplicationRatio = actualStorageBytes > 0 ? totalStorageBytes / actualStorageBytes : 1;

  return {
    orgId,
    totalFiles,
    uniqueFiles,
    duplicateFiles,
    totalStorageBytes,
    actualStorageBytes,
    spaceSavedBytes,
    spaceSavedPercent,
    deduplicationRatio,
  };
}

/**
 * Cleanup orphaned file references
 */
export async function cleanupOrphanedReferences(
  orgId: string
): Promise<{ cleaned: number; errors: string[] }> {
  const supabase = createClient();

  // Find references where original recording is deleted
  const { data: orphaned } = await supabase
    .from('file_references')
    .select('id, recording_id, original_recording_id')
    .eq('org_id', orgId);

  if (!orphaned || orphaned.length === 0) {
    return { cleaned: 0, errors: [] };
  }

  let cleaned = 0;
  const errors: string[] = [];

  for (const ref of orphaned) {
    try {
      // Check if original still exists
      const { data: original } = await supabase
        .from('recordings')
        .select('id')
        .eq('id', ref.original_recording_id)
        .is('deleted_at', null)
        .single();

      if (!original) {
        // Original deleted - need to promote this reference or delete
        await supabase.from('file_references').delete().eq('id', ref.id);
        cleaned++;
      }
    } catch (error) {
      errors.push(`Failed to cleanup reference ${ref.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  return { cleaned, errors };
}
