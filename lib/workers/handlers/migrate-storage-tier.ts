/**
 * Storage Tier Migration Job Handler
 *
 * Migrates recordings between storage tiers (hot → warm → cold)
 * Handles data transfer between Supabase Storage and Cloudflare R2
 */

import { getStorageManager } from '@/lib/services/storage-manager';
import { createClient } from '@/lib/supabase/admin';
import type {
  MigrateStorageTierJobPayload,
  StorageTier,
  StorageProvider,
} from '@/lib/types/database';

/**
 * Handle storage tier migration job
 *
 * @param payload - Job payload with migration details
 * @returns Job result
 */
export async function handleMigrateStorageTier(
  payload: MigrateStorageTierJobPayload
): Promise<{ success: boolean; result?: any; error?: string }> {
  const { recordingId, orgId, fromProvider, fromTier, toTier, sourcePath, fileSize } = payload;

  console.log(
    `[migrate-storage-tier] Starting migration for ${recordingId}: ${fromTier} → ${toTier}`
  );
  console.log(`[migrate-storage-tier] Source: ${fromProvider}:${sourcePath}`);

  const startTime = Date.now();
  const supabase = createClient();
  const storageManager = getStorageManager();

  try {
    // 1. Verify recording exists and get current state
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error(`Recording not found: ${recordingError?.message || 'Unknown error'}`);
    }

    // 2. Create storage migration tracking record
    const { data: migration, error: migrationInsertError } = await supabase
      .from('storage_migrations')
      .insert({
        recording_id: recordingId,
        org_id: orgId,
        from_tier: fromTier,
        to_tier: toTier,
        from_provider: fromProvider,
        to_provider: toTier === 'hot' ? 'supabase' : 'r2',
        file_size: fileSize,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (migrationInsertError || !migration) {
      throw new Error(
        `Failed to create migration record: ${migrationInsertError?.message || 'Unknown error'}`
      );
    }

    const migrationId = migration.id;

    try {
      // 3. Perform migration using StorageManager
      console.log(`[migrate-storage-tier] Migrating file...`);

      const migrationResult = await storageManager.migrateToTier(
        fromProvider,
        sourcePath,
        toTier,
        recordingId
      );

      if (!migrationResult.success) {
        throw new Error(migrationResult.error || 'Migration failed');
      }

      console.log(
        `[migrate-storage-tier] Migration successful: ${migrationResult.toProvider}:${migrationResult.toPath}`
      );

      // 4. Update recording with new tier and provider
      const updateData: any = {
        storage_tier: toTier,
        storage_provider: migrationResult.toProvider,
        tier_migrated_at: new Date().toISOString(),
        tier_migration_scheduled: false,
      };

      // Update R2 path if migrated to R2
      if (migrationResult.toProvider === 'r2') {
        updateData.storage_path_r2 = migrationResult.toPath;
      } else {
        // Migrated back to Supabase (hot tier)
        updateData.storage_path_r2 = null;
      }

      const { error: updateError } = await supabase
        .from('recordings')
        .update(updateData)
        .eq('id', recordingId);

      if (updateError) {
        throw new Error(`Failed to update recording: ${updateError.message}`);
      }

      // 5. Mark migration as completed
      const completedAt = new Date().toISOString();
      await supabase
        .from('storage_migrations')
        .update({
          status: 'completed',
          completed_at: completedAt,
        })
        .eq('id', migrationId);

      const durationMs = Date.now() - startTime;

      console.log(
        `[migrate-storage-tier] Migration completed in ${durationMs}ms (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
      );

      return {
        success: true,
        result: {
          recordingId,
          fromTier,
          toTier,
          fromProvider,
          toProvider: migrationResult.toProvider,
          toPath: migrationResult.toPath,
          fileSize,
          durationMs,
        },
      };
    } catch (migrationError) {
      // Update migration record with error
      await supabase
        .from('storage_migrations')
        .update({
          status: 'failed',
          error: migrationError instanceof Error ? migrationError.message : 'Migration failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', migrationId);

      throw migrationError;
    }
  } catch (error) {
    console.error('[migrate-storage-tier] Migration failed:', error);

    // Clear migration scheduled flag on error
    await supabase
      .from('recordings')
      .update({ tier_migration_scheduled: false })
      .eq('id', recordingId);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}

/**
 * Batch migrate files based on age criteria
 *
 * @param orgId - Organization ID
 * @param batchSize - Number of files to migrate
 * @param minAgeDays - Minimum file age in days
 * @returns Migration results
 */
export async function batchMigrateTier(
  orgId: string,
  batchSize: number = 100,
  minAgeDays: number = 30
): Promise<{
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
}> {
  console.log(
    `[batch-migrate-tier] Starting batch migration for org ${orgId} (batch size: ${batchSize}, min age: ${minAgeDays} days)`
  );

  const supabase = createClient();
  const errors: string[] = [];
  let migratedCount = 0;
  let failedCount = 0;

  try {
    // 1. Find files ready for migration using database function
    const { data: filesToMigrate, error: findError } = await supabase.rpc(
      'find_files_for_tier_migration',
      {
        p_batch_size: batchSize,
        p_min_age_days: minAgeDays,
      }
    );

    if (findError) {
      throw new Error(`Failed to find files for migration: ${findError.message}`);
    }

    if (!filesToMigrate || filesToMigrate.length === 0) {
      console.log('[batch-migrate-tier] No files ready for migration');
      return { success: true, migrated: 0, failed: 0, errors: [] };
    }

    console.log(`[batch-migrate-tier] Found ${filesToMigrate.length} files ready for migration`);

    // 2. Create migration jobs for each file
    const jobs = filesToMigrate.map((file: any) => ({
      type: 'migrate_storage_tier' as const,
      status: 'pending' as const,
      payload: {
        recordingId: file.recording_id,
        orgId: file.org_id,
        fromProvider: 'supabase' as const,
        fromTier: file.current_tier,
        toTier: file.target_tier,
        sourcePath: file.storage_path,
        fileSize: file.file_size,
      },
      dedupe_key: `migrate_tier:${file.recording_id}:${file.target_tier}`,
    }));

    // 3. Insert jobs in batches
    const { data: insertedJobs, error: insertError } = await supabase.from('jobs').insert(jobs);

    if (insertError) {
      throw new Error(`Failed to create migration jobs: ${insertError.message}`);
    }

    // 4. Mark recordings as having scheduled migration
    const recordingIds = filesToMigrate.map((f: any) => f.recording_id);
    await supabase
      .from('recordings')
      .update({ tier_migration_scheduled: true })
      .in('id', recordingIds);

    migratedCount = filesToMigrate.length;

    console.log(`[batch-migrate-tier] Created ${migratedCount} migration jobs`);

    return {
      success: true,
      migrated: migratedCount,
      failed: failedCount,
      errors,
    };
  } catch (error) {
    console.error('[batch-migrate-tier] Batch migration failed:', error);
    return {
      success: false,
      migrated: migratedCount,
      failed: failedCount,
      errors: [error instanceof Error ? error.message : 'Batch migration failed'],
    };
  }
}

/**
 * Get migration statistics for an organization
 *
 * @param orgId - Organization ID
 * @returns Migration statistics
 */
export async function getMigrationStats(orgId: string): Promise<{
  totalFiles: number;
  byTier: Record<string, number>;
  byProvider: Record<string, number>;
  pendingMigrations: number;
  recentMigrations: number;
  estimatedSavings: any;
}> {
  const supabase = createClient();

  try {
    // Get file counts by tier and provider
    const { data: recordings } = await supabase
      .from('recordings')
      .select('storage_tier, storage_provider')
      .eq('org_id', orgId)
      .is('deleted_at', null);

    const byTier: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    recordings?.forEach((rec) => {
      const tier = rec.storage_tier || 'hot';
      const provider = rec.storage_provider || 'supabase';
      byTier[tier] = (byTier[tier] || 0) + 1;
      byProvider[provider] = (byProvider[provider] || 0) + 1;
    });

    // Get pending migrations
    const { data: pendingMigrations } = await supabase
      .from('recordings')
      .select('id')
      .eq('org_id', orgId)
      .eq('tier_migration_scheduled', true)
      .is('deleted_at', null);

    // Get recent migrations (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMigrations } = await supabase
      .from('storage_migrations')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgo);

    // Get estimated savings using database function
    const { data: savings } = await supabase.rpc('estimate_tier_migration_savings', {
      p_org_id: orgId,
    });

    return {
      totalFiles: recordings?.length || 0,
      byTier,
      byProvider,
      pendingMigrations: pendingMigrations?.length || 0,
      recentMigrations: recentMigrations?.length || 0,
      estimatedSavings: savings?.[0] || null,
    };
  } catch (error) {
    console.error('[migration-stats] Failed to get migration stats:', error);
    throw error;
  }
}
