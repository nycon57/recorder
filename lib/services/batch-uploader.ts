/**
 * Batch Uploader Service
 *
 * Batch file upload service using busboy for multi-file handling.
 * Manages concurrent uploads, progress tracking, and error handling.
 */

import { IncomingMessage } from 'http';
import { createHash, randomBytes } from 'crypto';

import busboy from 'busboy';

import { supabaseAdmin } from '@/lib/supabase/admin';

import { DocumentParser } from './document-parser';
import { MediaProcessor } from './media-processor';

export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  fieldname: string;
  encoding: string;
}

export interface BatchUploadOptions {
  orgId: string;
  userId?: string;
  batchId?: string;
  maxFileSize?: number;
  maxFiles?: number;
  allowedMimeTypes?: string[];
  autoProcess?: boolean;
}

export interface BatchUploadResult {
  success: boolean;
  batchId: string;
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;
  files: UploadFileResult[];
  errors: UploadError[];
}

export interface UploadFileResult {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  url?: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface UploadError {
  filename: string;
  error: string;
  code: string;
}

export interface BatchProgress {
  batchId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  progressPercent: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
}

// Default limits
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_FILES = 50;

/**
 * Batch Uploader - Main upload service
 */
export class BatchUploader {
  private orgId: string;
  private userId?: string;
  private batchId: string;
  private maxFileSize: number;
  private maxFiles: number;
  private allowedMimeTypes?: Set<string>;
  private autoProcess: boolean;
  private uploadedFiles: UploadedFile[] = [];
  private errors: UploadError[] = [];

  constructor(options: BatchUploadOptions) {
    this.orgId = options.orgId;
    this.userId = options.userId;
    this.batchId = options.batchId || this.generateBatchId();
    this.maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = options.maxFiles || DEFAULT_MAX_FILES;
    this.allowedMimeTypes = options.allowedMimeTypes
      ? new Set(options.allowedMimeTypes)
      : undefined;
    this.autoProcess = options.autoProcess ?? true;
  }

  /**
   * Process multipart form upload from HTTP request
   */
  async processRequest(
    req: IncomingMessage,
    options?: {
      onFileStart?: (filename: string) => void;
      onFileComplete?: (file: UploadedFile) => void;
      onProgress?: (progress: BatchProgress) => void;
    }
  ): Promise<BatchUploadResult> {
    return new Promise((resolve, reject) => {
      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: this.maxFileSize,
          files: this.maxFiles,
        },
      });

      let fileCount = 0;

      bb.on('file', (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;

        // Validate MIME type
        if (this.allowedMimeTypes && !this.allowedMimeTypes.has(mimeType)) {
          this.errors.push({
            filename,
            error: `Unsupported file type: ${mimeType}`,
            code: 'UNSUPPORTED_MIME_TYPE',
          });
          file.resume();
          return;
        }

        // Check file limit
        if (fileCount >= this.maxFiles) {
          this.errors.push({
            filename,
            error: `Maximum file limit exceeded: ${this.maxFiles}`,
            code: 'FILE_LIMIT_EXCEEDED',
          });
          file.resume();
          return;
        }

        fileCount++;
        options?.onFileStart?.(filename);

        const chunks: Buffer[] = [];
        let fileSize = 0;

        file.on('data', (chunk: Buffer) => {
          fileSize += chunk.length;
          if (fileSize > this.maxFileSize) {
            file.resume();
            this.errors.push({
              filename,
              error: `File too large: ${this.formatBytes(fileSize)} (max ${this.formatBytes(this.maxFileSize)})`,
              code: 'FILE_SIZE_EXCEEDED',
            });
          } else {
            chunks.push(chunk);
          }
        });

        file.on('end', () => {
          if (fileSize <= this.maxFileSize) {
            const buffer = Buffer.concat(chunks);
            const uploadedFile: UploadedFile = {
              id: this.generateFileId(),
              filename,
              mimeType,
              size: fileSize,
              buffer,
              fieldname,
              encoding,
            };

            this.uploadedFiles.push(uploadedFile);
            options?.onFileComplete?.(uploadedFile);

            // Update progress
            const progress = this.getProgress();
            options?.onProgress?.(progress);
          }
        });

        file.on('error', (error) => {
          this.errors.push({
            filename,
            error: error.message,
            code: 'FILE_READ_ERROR',
          });
        });
      });

      bb.on('field', (fieldname, value) => {
        // Handle form fields if needed
        console.log(`[BatchUploader] Form field: ${fieldname} = ${value}`);
      });

      bb.on('error', (error) => {
        reject(new Error(`Busboy error: ${error.message}`));
      });

      bb.on('finish', async () => {
        try {
          // Process uploaded files
          const result = await this.processUploadedFiles();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      req.pipe(bb);
    });
  }

  /**
   * Process uploaded files to storage
   */
  private async processUploadedFiles(): Promise<BatchUploadResult> {
    const results: UploadFileResult[] = [];
    let successfulUploads = 0;
    let failedUploads = 0;

    // Create batch record in database
    await this.createBatchRecord();

    // Process each file
    for (const file of this.uploadedFiles) {
      try {
        // Generate storage path
        const storagePath = `org_${this.orgId}/batch_${this.batchId}/${file.id}-${file.filename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('recordings')
          .upload(storagePath, file.buffer, {
            contentType: file.mimeType,
            upsert: false,
            cacheControl: '3600',
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from('recordings').getPublicUrl(storagePath);

        // Create imported document record
        await this.createDocumentRecord(file, storagePath);

        results.push({
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          storagePath,
          url: publicUrl,
          status: 'success',
        });

        successfulUploads++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          status: 'failed',
          error: errorMessage,
        });

        this.errors.push({
          filename: file.filename,
          error: errorMessage,
          code: 'UPLOAD_FAILED',
        });

        failedUploads++;
      }
    }

    // Update batch record
    await this.updateBatchRecord(successfulUploads, failedUploads);

    return {
      success: failedUploads === 0,
      batchId: this.batchId,
      totalFiles: this.uploadedFiles.length,
      successfulUploads,
      failedUploads,
      files: results,
      errors: this.errors,
    };
  }

  /**
   * Create batch record in database
   */
  private async createBatchRecord(): Promise<void> {
    try {
      await supabaseAdmin.from('file_upload_batches').insert({
        id: this.batchId,
        org_id: this.orgId,
        user_id: this.userId,
        batch_name: `Batch Upload ${new Date().toISOString()}`,
        total_files: this.uploadedFiles.length,
        processed_files: 0,
        failed_files: 0,
        status: 'uploading',
        progress_percent: 0,
        metadata: {},
      });
    } catch (error) {
      console.error('[BatchUploader] Failed to create batch record:', error);
    }
  }

  /**
   * Update batch record in database
   */
  private async updateBatchRecord(
    successfulUploads: number,
    failedUploads: number
  ): Promise<void> {
    try {
      const totalFiles = this.uploadedFiles.length;
      const processedFiles = successfulUploads + failedUploads;
      const progressPercent = Math.round((processedFiles / totalFiles) * 100);
      const status = failedUploads > 0 ? 'completed' : 'completed';

      await supabaseAdmin
        .from('file_upload_batches')
        .update({
          processed_files: processedFiles,
          failed_files: failedUploads,
          status,
          progress_percent: progressPercent,
          completed_at: new Date().toISOString(),
        })
        .eq('id', this.batchId);
    } catch (error) {
      console.error('[BatchUploader] Failed to update batch record:', error);
    }
  }

  /**
   * Create imported document record
   */
  private async createDocumentRecord(
    file: UploadedFile,
    storagePath: string
  ): Promise<void> {
    try {
      // Parse document content if it's a supported format
      let content: string | null = null;
      let metadata: any = {};

      if (DocumentParser.isSupported(file.mimeType)) {
        try {
          const parsed = await DocumentParser.parseBuffer(file.buffer, file.mimeType, {
            extractMetadata: true,
            cleanText: true,
          });
          content = parsed.content;
          metadata = { ...parsed.metadata, format: parsed.format };
        } catch (error) {
          console.warn(`[BatchUploader] Failed to parse ${file.filename}:`, error);
        }
      }

      // Generate content hash
      const contentHash = createHash('sha256')
        .update(file.buffer)
        .digest('hex');

      await supabaseAdmin.from('imported_documents').insert({
        connector_id: null, // No connector for direct uploads
        org_id: this.orgId,
        external_id: file.id,
        title: file.filename,
        content,
        content_hash: contentHash,
        file_type: file.mimeType,
        file_size_bytes: file.size,
        source_url: storagePath,
        sync_status: this.autoProcess ? 'pending' : 'completed',
        metadata: {
          ...metadata,
          batchId: this.batchId,
          originalFilename: file.filename,
          uploadedAt: new Date().toISOString(),
        },
      });

      // If auto-process is enabled, create a job to process the document
      if (this.autoProcess && content) {
        await supabaseAdmin.from('jobs').insert({
          type: 'process_imported_doc',
          status: 'pending',
          payload: {
            documentId: file.id,
            orgId: this.orgId,
            batchId: this.batchId,
          },
          org_id: this.orgId,
        });
      }
    } catch (error) {
      console.error('[BatchUploader] Failed to create document record:', error);
      throw error;
    }
  }

  /**
   * Get current progress
   */
  getProgress(): BatchProgress {
    const totalFiles = this.uploadedFiles.length;
    const processedFiles = totalFiles; // All uploaded files are processed
    const failedFiles = this.errors.length;
    const progressPercent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

    return {
      batchId: this.batchId,
      totalFiles,
      processedFiles,
      failedFiles,
      progressPercent,
      status: 'uploading',
    };
  }

  /**
   * Get batch statistics
   */
  static async getBatchStats(batchId: string): Promise<BatchProgress | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('file_upload_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        batchId: data.id,
        totalFiles: data.total_files,
        processedFiles: data.processed_files,
        failedFiles: data.failed_files,
        progressPercent: data.progress_percent,
        status: data.status,
      };
    } catch (error) {
      console.error('[BatchUploader] Failed to get batch stats:', error);
      return null;
    }
  }

  /**
   * List batches for organization
   */
  static async listBatches(
    orgId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: 'uploading' | 'processing' | 'completed' | 'failed';
    }
  ): Promise<BatchProgress[]> {
    try {
      let query = supabaseAdmin
        .from('file_upload_batches')
        .select('*')
        .eq('org_id', orgId);

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((batch) => ({
        batchId: batch.id,
        totalFiles: batch.total_files,
        processedFiles: batch.processed_files,
        failedFiles: batch.failed_files,
        progressPercent: batch.progress_percent,
        status: batch.status,
      }));
    } catch (error) {
      console.error('[BatchUploader] Failed to list batches:', error);
      return [];
    }
  }

  /**
   * Delete batch and associated files
   */
  static async deleteBatch(
    batchId: string,
    deleteFiles = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get batch info
      const { data: batch } = await supabaseAdmin
        .from('file_upload_batches')
        .select('org_id')
        .eq('id', batchId)
        .single();

      if (!batch) {
        return { success: false, error: 'Batch not found' };
      }

      // Delete files from storage if requested
      if (deleteFiles) {
        const storagePath = `org_${batch.org_id}/batch_${batchId}`;
        await supabaseAdmin.storage.from('recordings').remove([storagePath]);
      }

      // Delete imported documents
      await supabaseAdmin
        .from('imported_documents')
        .delete()
        .eq('metadata->batchId', batchId);

      // Delete batch record
      await supabaseAdmin.from('file_upload_batches').delete().eq('id', batchId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Get supported MIME types
   */
  static getSupportedMimeTypes(): string[] {
    return [
      // Documents
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      // Images
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      // Data
      'application/json',
      'text/csv',
      'application/xml',
      // Media
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
    ];
  }
}
