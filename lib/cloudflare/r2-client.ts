/**
 * Cloudflare R2 Client
 *
 * S3-compatible client for Cloudflare R2 storage.
 * Provides upload, download, delete, and listing operations.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandOutput,
  type DeleteObjectsCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Config, getR2Endpoint } from './r2-config';

/**
 * R2 upload options
 */
export interface R2UploadOptions {
  /** Content type / MIME type */
  contentType?: string;
  /** Cache control header */
  cacheControl?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** ACL (defaults to private) */
  acl?: 'private' | 'public-read';
}

/**
 * R2 download options
 */
export interface R2DownloadOptions {
  /** Return as buffer (default: true) */
  asBuffer?: boolean;
  /** Byte range for partial download */
  range?: string;
}

/**
 * R2 Client singleton
 */
export class R2Client {
  private static instance: R2Client | null = null;
  private client: S3Client;
  private bucketName: string;
  private accountId: string;

  private constructor() {
    const config = getR2Config();
    this.bucketName = config.bucketName;
    this.accountId = config.accountId;

    // Create S3 client configured for R2
    this.client = new S3Client({
      region: config.region || 'auto',
      endpoint: getR2Endpoint(config.accountId),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Get R2 client singleton instance
   */
  static getInstance(): R2Client {
    if (!R2Client.instance) {
      R2Client.instance = new R2Client();
    }
    return R2Client.instance;
  }

  /**
   * Upload file to R2
   *
   * @param key - Object key (path) in R2
   * @param data - File data (Buffer or stream)
   * @param options - Upload options
   * @returns Upload result
   */
  async upload(
    key: string,
    data: Buffer | Uint8Array | ReadableStream,
    options: R2UploadOptions = {}
  ): Promise<{ success: boolean; key: string; size?: number; error?: string }> {
    try {
      const uploadParams: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: key,
        Body: data,
        ContentType: options.contentType || 'application/octet-stream',
        CacheControl: options.cacheControl || 'public, max-age=31536000',
        Metadata: options.metadata,
        ACL: options.acl || 'private',
      };

      const command = new PutObjectCommand(uploadParams);
      await this.client.send(command);

      const size = Buffer.isBuffer(data) ? data.length : undefined;

      return {
        success: true,
        key,
        size,
      };
    } catch (error) {
      console.error('[R2Client] Upload error:', error);
      return {
        success: false,
        key,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download file from R2
   *
   * @param key - Object key (path) in R2
   * @param options - Download options
   * @returns File data
   */
  async download(
    key: string,
    options: R2DownloadOptions = {}
  ): Promise<{ success: boolean; data?: Buffer; metadata?: any; error?: string }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Range: options.range,
      });

      const response: GetObjectCommandOutput = await this.client.send(command);

      if (!response.Body) {
        return {
          success: false,
          error: 'No data received',
        };
      }

      // Convert stream to buffer if requested
      const data = options.asBuffer !== false
        ? Buffer.from(await response.Body.transformToByteArray())
        : undefined;

      return {
        success: true,
        data,
        metadata: {
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          metadata: response.Metadata,
        },
      };
    } catch (error) {
      console.error('[R2Client] Download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * Delete file from R2
   *
   * @param key - Object key (path) in R2
   * @returns Deletion result
   */
  async delete(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);

      return { success: true };
    } catch (error) {
      console.error('[R2Client] Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed',
      };
    }
  }

  /**
   * Delete multiple files from R2
   *
   * @param keys - Array of object keys to delete
   * @returns Deletion results
   */
  async deleteMultiple(
    keys: string[]
  ): Promise<{ success: boolean; deleted: string[]; errors: string[]; errorDetails?: string }> {
    try {
      const deleteParams: DeleteObjectsCommandInput = {
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: false,
        },
      };

      const command = new DeleteObjectsCommand(deleteParams);
      const response = await this.client.send(command);

      const deleted = response.Deleted?.map((obj) => obj.Key || '') || [];
      const errors = response.Errors?.map((err) => err.Key || '') || [];

      return {
        success: errors.length === 0,
        deleted,
        errors,
        errorDetails: errors.length > 0
          ? response.Errors?.map((e) => `${e.Key}: ${e.Message}`).join(', ')
          : undefined,
      };
    } catch (error) {
      console.error('[R2Client] Delete multiple error:', error);
      return {
        success: false,
        deleted: [],
        errors: keys,
        errorDetails: error instanceof Error ? error.message : 'Batch deletion failed',
      };
    }
  }

  /**
   * Check if file exists in R2
   *
   * @param key - Object key (path) in R2
   * @returns Existence check result
   */
  async exists(
    key: string
  ): Promise<{ exists: boolean; size?: number; lastModified?: Date; error?: string }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        exists: true,
        size: response.ContentLength,
        lastModified: response.LastModified,
      };
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }

      console.error('[R2Client] Exists check error:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Check failed',
      };
    }
  }

  /**
   * List files in R2 bucket
   *
   * @param prefix - Prefix filter (folder path)
   * @param maxKeys - Maximum number of keys to return
   * @returns List of objects
   */
  async list(
    prefix?: string,
    maxKeys: number = 1000
  ): Promise<{
    success: boolean;
    objects: Array<{ key: string; size: number; lastModified: Date }>;
    isTruncated: boolean;
    error?: string;
  }> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);

      const objects =
        response.Contents?.map((obj) => ({
          key: obj.Key || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
        })) || [];

      return {
        success: true,
        objects,
        isTruncated: response.IsTruncated || false,
      };
    } catch (error) {
      console.error('[R2Client] List error:', error);
      return {
        success: false,
        objects: [],
        isTruncated: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  }

  /**
   * Copy file within R2 (or between buckets)
   *
   * @param sourceKey - Source object key
   * @param destinationKey - Destination object key
   * @returns Copy result
   */
  async copy(
    sourceKey: string,
    destinationKey: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.client.send(command);

      return { success: true };
    } catch (error) {
      console.error('[R2Client] Copy error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed',
      };
    }
  }

  /**
   * Generate presigned URL for temporary access
   *
   * @param key - Object key (path) in R2
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      console.error('[R2Client] Signed URL generation error:', {
        bucket: this.bucketName,
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to generate signed URL for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Get account ID
   */
  getAccountId(): string {
    return this.accountId;
  }
}

/**
 * Get R2 client instance (convenience export)
 */
export const r2Client = R2Client.getInstance();
