/**
 * File Upload Connector
 *
 * Handles direct file uploads from users with validation and storage
 * Supports multiple file types: PDF, DOCX, TXT, MD, images
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import mime from 'mime-types';
import {
  Connector,
  ConnectorType,
  ConnectorCredentials,
  AuthResult,
  TestResult,
  SyncOptions,
  SyncResult,
  ListOptions,
  ConnectorFile,
  FileContent,
  SyncError,
} from './base';

// Supported file types and their MIME types
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf', // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword', // DOC
  'text/plain', // TXT
  'text/markdown', // MD
  'image/png', // PNG
  'image/jpeg', // JPEG/JPG
  'image/gif', // GIF
  'image/webp', // WEBP
  'application/json', // JSON
  'text/csv', // CSV
  'application/vnd.ms-excel', // XLS
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
]);

// File type categories for easier filtering
const FILE_CATEGORIES = {
  documents: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
  ],
  images: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
  data: ['application/json', 'text/csv'],
};

// Max file size: 50MB (Supabase limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface FileUploadOptions {
  orgId: string;
  userId?: string;
  batchId?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
  metadata?: Record<string, any>;
}

export class FileUploadConnector implements Connector {
  readonly type = ConnectorType.FILE_UPLOAD;
  readonly name = 'File Upload';
  readonly description =
    'Direct file upload connector supporting PDFs, documents, images, and more';

  private orgId: string;
  private userId?: string;
  private batchId?: string;
  private uploadedFiles: Map<string, UploadedFile> = new Map();

  constructor(options: FileUploadOptions) {
    this.orgId = options.orgId;
    this.userId = options.userId;
    this.batchId = options.batchId;
  }

  /**
   * No authentication needed for file uploads (handled at API level)
   */
  async authenticate(credentials: ConnectorCredentials): Promise<AuthResult> {
    return {
      success: true,
      userId: this.userId,
      userName: 'File Upload User',
    };
  }

  /**
   * Test if we can access Supabase storage
   */
  async testConnection(): Promise<TestResult> {
    try {
      // Test if we can list buckets
      const { data, error } = await supabaseAdmin.storage.listBuckets();

      if (error) {
        return {
          success: false,
          message: `Storage connection failed: ${error.message}`,
        };
      }

      // Check if recordings bucket exists
      const recordingsBucket = data?.find((b) => b.name === 'recordings');
      if (!recordingsBucket) {
        return {
          success: false,
          message: 'Recordings bucket not found',
        };
      }

      return {
        success: true,
        message: 'Storage connection successful',
        metadata: {
          bucketsAvailable: data?.length || 0,
          recordingsBucket: recordingsBucket.name,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add files to the connector for processing
   * Call this before sync()
   */
  async addFile(
    name: string,
    buffer: Buffer,
    mimeType?: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      // Validate file size
      if (buffer.length > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      }

      // Determine MIME type from filename if not provided
      const detectedMimeType =
        mimeType || mime.lookup(name) || 'application/octet-stream';

      // Validate MIME type
      if (!SUPPORTED_MIME_TYPES.has(detectedMimeType)) {
        return {
          success: false,
          error: `Unsupported file type: ${detectedMimeType}`,
        };
      }

      // Generate unique file ID
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Store file in memory for processing
      this.uploadedFiles.set(fileId, {
        id: fileId,
        name,
        buffer,
        mimeType: detectedMimeType,
        size: buffer.length,
        metadata,
      });

      return {
        success: true,
        fileId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Sync uploaded files to Supabase storage
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let filesProcessed = 0;
    let filesUpdated = 0;
    let filesFailed = 0;

    try {
      // Apply filters if provided
      let filesToProcess = Array.from(this.uploadedFiles.values());

      // Filter by file types if specified
      if (options?.fileTypes && options.fileTypes.length > 0) {
        const allowedTypes = new Set(options.fileTypes);
        filesToProcess = filesToProcess.filter((f) =>
          allowedTypes.has(f.mimeType),
        );
      }

      // Apply limit if specified
      if (options?.limit) {
        filesToProcess = filesToProcess.slice(0, options.limit);
      }

      // Process each file
      for (const file of filesToProcess) {
        try {
          filesProcessed++;

          // Generate storage path
          const storagePath = this.batchId
            ? `org_${this.orgId}/uploads/${this.batchId}/${file.id}-${file.name}`
            : `org_${this.orgId}/uploads/${file.id}-${file.name}`;

          // Upload to Supabase storage
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

          filesUpdated++;

          // Remove from memory after successful upload
          this.uploadedFiles.delete(file.id);
        } catch (error) {
          filesFailed++;
          errors.push({
            fileId: file.id,
            fileName: file.name,
            error:
              error instanceof Error ? error.message : 'Unknown upload error',
            retryable: true,
          });
        }
      }

      return {
        success: filesFailed === 0,
        filesProcessed,
        filesUpdated,
        filesFailed,
        filesDeleted: 0,
        errors,
        metadata: {
          batchId: this.batchId,
          remainingFiles: this.uploadedFiles.size,
        },
      };
    } catch (error) {
      return {
        success: false,
        filesProcessed,
        filesUpdated,
        filesFailed,
        filesDeleted: 0,
        errors: [
          {
            fileId: 'batch',
            fileName: 'batch-operation',
            error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * List files in the upload queue
   */
  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    const files = Array.from(this.uploadedFiles.values());

    // Apply limit and offset
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    return files.slice(offset, offset + limit).map((file) => ({
      id: file.id,
      name: file.name,
      type: this.getFileCategory(file.mimeType),
      mimeType: file.mimeType,
      size: file.size,
      modifiedAt: new Date(),
      createdAt: new Date(),
      metadata: file.metadata,
    }));
  }

  /**
   * Download/retrieve a specific file from the queue
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    const file = this.uploadedFiles.get(fileId);

    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    return {
      id: file.id,
      title: file.name,
      content: file.buffer,
      mimeType: file.mimeType,
      size: file.size,
      metadata: file.metadata || {},
    };
  }

  /**
   * Helper: Determine file category from MIME type
   */
  private getFileCategory(mimeType: string): string {
    for (const [category, types] of Object.entries(FILE_CATEGORIES)) {
      if (types.includes(mimeType)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Helper: Get supported file types
   */
  static getSupportedTypes(): string[] {
    return Array.from(SUPPORTED_MIME_TYPES);
  }

  /**
   * Helper: Check if file type is supported
   */
  static isSupported(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType);
  }

  /**
   * Helper: Get file extensions for a category
   */
  static getExtensions(category?: keyof typeof FILE_CATEGORIES): string[] {
    if (!category) {
      // Return all extensions
      return Array.from(SUPPORTED_MIME_TYPES)
        .map((type) => mime.extension(type))
        .filter((ext): ext is string => ext !== false);
    }

    const types = FILE_CATEGORIES[category];
    return types
      .map((type) => mime.extension(type))
      .filter((ext): ext is string => ext !== false);
  }

  /**
   * Clear all files from memory
   */
  clearQueue(): void {
    this.uploadedFiles.clear();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.uploadedFiles.size;
  }
}
