/**
 * Storage Manager
 *
 * Unified storage interface supporting multi-tier strategy:
 * - Hot tier: Supabase Storage (fast access, recent files)
 * - Warm tier: Cloudflare R2 (cost-optimized, moderate access)
 * - Cold tier: Cloudflare R2 (archive, rare access)
 *
 * Handles intelligent routing, tier migration, and dual-write capabilities.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { r2Client } from '@/lib/cloudflare/r2-client';
import {
  getStorageTier,
  calculateAgeInDays,
  shouldMigrateFile,
  type StorageTierConfig,
} from '@/lib/cloudflare/r2-config';

/**
 * Storage provider type
 */
export type StorageProvider = 'supabase' | 'r2';

/**
 * Storage tier type
 */
export type StorageTier = 'hot' | 'warm' | 'cold';

/**
 * Upload options
 */
export interface StorageUploadOptions {
  /** Target storage tier (auto-detected if not specified) */
  tier?: StorageTier;
  /** Content type / MIME type */
  contentType?: string;
  /** Enable dual-write to both providers */
  dualWrite?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Cache control header */
  cacheControl?: string;
  /** File age in days (for tier selection) */
  ageInDays?: number;
}

/**
 * Download options
 */
export interface StorageDownloadOptions {
  /** Force download from specific provider */
  provider?: StorageProvider;
  /** Return as buffer (default: true) */
  asBuffer?: boolean;
  /** Byte range for partial download */
  range?: string;
}

/**
 * Upload result
 */
export interface StorageUploadResult {
  success: boolean;
  provider: StorageProvider;
  tier: StorageTier;
  path: string;
  pathR2?: string;
  size?: number;
  error?: string;
}

/**
 * Download result
 */
export interface StorageDownloadResult {
  success: boolean;
  data?: Buffer;
  metadata?: {
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
  };
  provider: StorageProvider;
  error?: string;
}

/**
 * Storage Manager class
 */
export class StorageManager {
  private supabase: ReturnType<typeof createSupabaseClient>;
  private bucketName: string;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createSupabaseClient(supabaseUrl, supabaseKey);
    this.bucketName = 'recordings';
  }

  /**
   * Upload file with intelligent tier selection
   *
   * @param path - File path (key)
   * @param data - File data
   * @param options - Upload options
   * @returns Upload result with provider and tier info
   */
  async upload(
    path: string,
    data: Buffer | Uint8Array,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    try {
      // Determine optimal storage tier
      const tier = this.determineTier(options);
      const provider = this.getTierProvider(tier);

      console.log(`[StorageManager] Uploading to ${provider} (${tier} tier): ${path}`);

      // Upload to primary provider
      let primaryResult: { success: boolean; error?: string; size?: number };
      let pathR2: string | undefined;

      if (provider === 'supabase') {
        primaryResult = await this.uploadToSupabase(path, data, options);
      } else {
        const r2Path = this.buildR2Path(path, tier);
        primaryResult = await this.uploadToR2(r2Path, data, options);
        pathR2 = r2Path;
      }

      if (!primaryResult.success) {
        return {
          success: false,
          provider,
          tier,
          path,
          error: primaryResult.error,
        };
      }

      // Optional: Dual-write to R2 for backup
      if (options.dualWrite && provider === 'supabase') {
        const r2Path = this.buildR2Path(path, tier);
        const r2Result = await this.uploadToR2(r2Path, data, options);
        if (r2Result.success) {
          pathR2 = r2Path;
        } else {
          // Log dual-write failure - do not fail the entire operation
          console.error('[StorageManager] Dual-write to R2 failed:', {
            r2Path,
            originalPath: path,
            provider,
            tier,
            error: r2Result.error,
          });
          // Note: pathR2 remains undefined, indicating R2 backup is not available
        }
      }

      return {
        success: true,
        provider,
        tier,
        path,
        pathR2,
        size: primaryResult.size,
      };
    } catch (error) {
      console.error('[StorageManager] Upload error:', error);
      // Use actual attempted values instead of hardcoded defaults
      const attemptedTier = options.tier || (options.ageInDays !== undefined ? this.getTierByAge(options.ageInDays).name : 'hot');
      const attemptedProvider = this.getTierProvider(attemptedTier);
      return {
        success: false,
        provider: attemptedProvider,
        tier: attemptedTier,
        path,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download file with intelligent provider routing
   *
   * @param path - File path (Supabase path)
   * @param pathR2 - R2 path (if available)
   * @param provider - Current storage provider
   * @param options - Download options
   * @returns Download result with data
   */
  async download(
    path: string,
    pathR2: string | null,
    provider: StorageProvider,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadResult> {
    try {
      // Use specified provider or default to recorded provider
      const targetProvider = options.provider || provider;

      console.log(`[StorageManager] Downloading from ${targetProvider}: ${path}`);

      if (targetProvider === 'supabase') {
        return await this.downloadFromSupabase(path, options);
      } else {
        if (!pathR2) {
          // Fallback to Supabase if R2 path not available
          console.warn('[StorageManager] R2 path missing, falling back to Supabase');
          return await this.downloadFromSupabase(path, options);
        }
        return await this.downloadFromR2(pathR2, options);
      }
    } catch (error) {
      console.error('[StorageManager] Download error:', error);
      return {
        success: false,
        provider,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * Delete file from all storage providers
   *
   * @param path - Supabase path
   * @param pathR2 - R2 path (if available)
   * @returns Deletion results
   */
  async delete(
    path: string,
    pathR2?: string | null
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Delete from Supabase
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).remove([path]);
      if (error) {
        errors.push(`Supabase: ${error.message}`);
      }
    } catch (error) {
      errors.push(`Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Delete from R2 if path exists
    if (pathR2) {
      try {
        const result = await r2Client.delete(pathR2);
        if (!result.success) {
          errors.push(`R2: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        errors.push(`R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Migrate file between storage tiers
   *
   * @param fromProvider - Source provider
   * @param fromPath - Source path
   * @param toTier - Target tier
   * @param recordingId - Recording ID for tracking
   * @returns Migration result
   */
  async migrateToTier(
    fromProvider: StorageProvider,
    fromPath: string,
    toTier: StorageTier,
    recordingId: string
  ): Promise<{
    success: boolean;
    toProvider: StorageProvider;
    toPath: string;
    error?: string;
  }> {
    try {
      const toProvider = this.getTierProvider(toTier);

      console.log(
        `[StorageManager] Migrating ${recordingId}: ${fromProvider} → ${toProvider} (${toTier} tier)`
      );

      // 1. Download from source
      const downloadResult =
        fromProvider === 'supabase'
          ? await this.downloadFromSupabase(fromPath)
          : await this.downloadFromR2(fromPath);

      if (!downloadResult.success || !downloadResult.data) {
        return {
          success: false,
          toProvider,
          toPath: '',
          error: `Download failed: ${downloadResult.error}`,
        };
      }

      // 2. Upload to destination
      const toPath =
        toProvider === 'r2'
          ? this.buildR2Path(fromPath, toTier)
          : fromPath;

      const uploadResult =
        toProvider === 'supabase'
          ? await this.uploadToSupabase(toPath, downloadResult.data, {
              contentType: downloadResult.metadata?.contentType,
            })
          : await this.uploadToR2(toPath, downloadResult.data, {
              contentType: downloadResult.metadata?.contentType,
            });

      if (!uploadResult.success) {
        return {
          success: false,
          toProvider,
          toPath,
          error: `Upload failed: ${uploadResult.error}`,
        };
      }

      // 3. Delete from source (optional - for now we keep both for safety)
      // await this.deleteFromProvider(fromProvider, fromPath);

      return {
        success: true,
        toProvider,
        toPath,
      };
    } catch (error) {
      console.error('[StorageManager] Migration error:', error);
      return {
        success: false,
        toProvider: this.getTierProvider(toTier),
        toPath: '',
        error: error instanceof Error ? error.message : 'Migration failed',
      };
    }
  }

  /**
   * Check if file should be migrated to different tier
   *
   * @param currentTier - Current storage tier
   * @param createdAt - File creation date
   * @returns Migration recommendation
   */
  shouldMigrate(
    currentTier: StorageTier,
    createdAt: Date | string
  ): { shouldMigrate: boolean; targetTier?: StorageTier; reason?: string } {
    const ageInDays = calculateAgeInDays(createdAt);
    const result = shouldMigrateFile(currentTier, ageInDays);

    if (result.shouldMigrate && result.targetTier) {
      return {
        shouldMigrate: true,
        targetTier: result.targetTier,
        reason: `File is ${ageInDays} days old and should move from ${currentTier} to ${result.targetTier}`,
      };
    }

    return { shouldMigrate: false };
  }

  /**
   * Get storage tier based on file age
   *
   * @param ageInDays - File age in days
   * @returns Storage tier configuration
   */
  getTierByAge(ageInDays: number): StorageTierConfig {
    return getStorageTier(ageInDays);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Determine optimal storage tier
   */
  private determineTier(options: StorageUploadOptions): StorageTier {
    // Use specified tier if provided
    if (options.tier) {
      return options.tier;
    }

    // Use age-based tier selection if age is provided
    if (options.ageInDays !== undefined) {
      const tierConfig = getStorageTier(options.ageInDays);
      return tierConfig.name;
    }

    // Default to hot tier for new uploads
    return 'hot';
  }

  /**
   * Get storage provider for tier
   */
  private getTierProvider(tier: StorageTier): StorageProvider {
    switch (tier) {
      case 'hot':
        return 'supabase';
      case 'warm':
      case 'cold':
        return 'r2';
      default:
        return 'supabase';
    }
  }

  /**
   * Build R2 path with tier prefix
   */
  private buildR2Path(supabasePath: string, tier: StorageTier): string {
    // Remove bucket prefix if present
    const cleanPath = supabasePath.replace(`${this.bucketName}/`, '');

    // Add tier prefix
    return `${tier}/${cleanPath}`;
  }

  /**
   * Upload to Supabase Storage
   */
  private async uploadToSupabase(
    path: string,
    data: Buffer | Uint8Array,
    options: StorageUploadOptions = {}
  ): Promise<{ success: boolean; error?: string; size?: number }> {
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).upload(path, data, {
        contentType: options.contentType || 'application/octet-stream',
        cacheControl: options.cacheControl || 'public, max-age=31536000',
        upsert: true,
      });

      if (error) {
        console.error('[StorageManager] Supabase upload error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        size: data.length,
      };
    } catch (error) {
      console.error('[StorageManager] Supabase upload exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload to R2
   */
  private async uploadToR2(
    path: string,
    data: Buffer | Uint8Array,
    options: StorageUploadOptions = {}
  ): Promise<{ success: boolean; error?: string; size?: number }> {
    const result = await r2Client.upload(path, data, {
      contentType: options.contentType,
      cacheControl: options.cacheControl,
      metadata: options.metadata,
    });

    return result;
  }

  /**
   * Download from Supabase Storage
   */
  private async downloadFromSupabase(
    path: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadResult> {
    try {
      const { data, error } = await this.supabase.storage.from(this.bucketName).download(path);

      if (error || !data) {
        return {
          success: false,
          provider: 'supabase',
          error: error?.message || 'No data received',
        };
      }

      // Convert Blob to Buffer
      const buffer = Buffer.from(await data.arrayBuffer());

      return {
        success: true,
        data: buffer,
        metadata: {
          contentType: data.type,
          contentLength: data.size,
        },
        provider: 'supabase',
      };
    } catch (error) {
      console.error('[StorageManager] Supabase download error:', error);
      return {
        success: false,
        provider: 'supabase',
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * Download from R2
   */
  private async downloadFromR2(
    path: string,
    options: StorageDownloadOptions = {}
  ): Promise<StorageDownloadResult> {
    const result = await r2Client.download(path, {
      asBuffer: options.asBuffer,
      range: options.range,
    });

    if (!result.success) {
      return {
        success: false,
        provider: 'r2',
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        contentType: result.metadata?.contentType,
        contentLength: result.metadata?.contentLength,
        lastModified: result.metadata?.lastModified,
      },
      provider: 'r2',
    };
  }
}

/**
 * Singleton instance
 */
let storageManager: StorageManager | null = null;

/**
 * Get storage manager instance
 */
export function getStorageManager(): StorageManager {
  if (!storageManager) {
    storageManager = new StorageManager();
  }
  return storageManager;
}
