import { z } from 'zod';

import type { ContentType } from '@/lib/types/database';

/**
 * Library API Validation Schemas
 *
 * Validation schemas for multi-format content management endpoints.
 * Supports recordings, videos, audio, documents, and text notes.
 */

// ============================================================================
// File Upload Schemas
// ============================================================================

/**
 * Single file upload validation schema
 * Note: Files are handled via FormData, this schema validates metadata
 */
export const uploadFileSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

/**
 * Multiple file upload validation schema
 * For batch uploads (future enhancement)
 */
export const uploadMultipleFilesSchema = z.object({
  files: z.array(
    z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      metadata: z.record(z.any()).optional(),
    })
  ).min(1).max(10), // Max 10 files per batch
});

export type UploadMultipleFilesInput = z.infer<typeof uploadMultipleFilesSchema>;

// ============================================================================
// Text Note Creation Schemas
// ============================================================================

/**
 * Create text note schema
 * For direct text content creation
 */
export const createTextNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(500000), // 500KB max
  format: z.enum(['plain', 'markdown']).default('plain'),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateTextNoteInput = z.infer<typeof createTextNoteSchema>;

/**
 * Update text note schema
 */
export const updateTextNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(500000).optional(),
  format: z.enum(['plain', 'markdown']).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateTextNoteInput = z.infer<typeof updateTextNoteSchema>;

// ============================================================================
// Library Query Schemas
// ============================================================================

/**
 * Library list query parameters schema
 * For filtering and pagination
 */
export const libraryQuerySchema = z.object({
  type: z.enum(['recording', 'video', 'audio', 'document', 'text']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'oldest', 'name_asc', 'name_desc', 'size_desc', 'size_asc']).default('recent'),
  search: z.string().max(200).optional(),
  status: z.enum(['uploading', 'uploaded', 'transcribing', 'transcribed', 'doc_generating', 'completed', 'error']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type LibraryQueryInput = z.infer<typeof libraryQuerySchema>;

/**
 * Content type filter validation helper
 */
export function validateContentType(type: string): type is ContentType {
  return ['recording', 'video', 'audio', 'document', 'text'].includes(type);
}

// ============================================================================
// Library Item Update Schemas
// ============================================================================

/**
 * Update library item metadata
 * Generic update schema for any content type
 */
export const updateLibraryItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateLibraryItemInput = z.infer<typeof updateLibraryItemSchema>;

/**
 * Soft delete schema
 */
export const softDeleteSchema = z.object({
  permanent: z.boolean().optional().default(false),
});

export type SoftDeleteInput = z.infer<typeof softDeleteSchema>;

// ============================================================================
// Dashboard Schemas
// ============================================================================

/**
 * Dashboard recent items query schema
 */
export const dashboardRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(8),
  types: z.array(z.enum(['recording', 'video', 'audio', 'document', 'text'])).optional(),
});

export type DashboardRecentQueryInput = z.infer<typeof dashboardRecentQuerySchema>;

/**
 * Dashboard stats query schema
 */
export const dashboardStatsQuerySchema = z.object({
  period: z.enum(['week', 'month', 'year', 'all']).default('all'),
  includeStorage: z.boolean().default(true),
  includeBreakdown: z.boolean().default(true),
});

export type DashboardStatsQueryInput = z.infer<typeof dashboardStatsQuerySchema>;

// ============================================================================
// Batch Operations Schemas
// ============================================================================

/**
 * Batch delete schema
 */
export const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  permanent: z.boolean().optional().default(false),
});

export type BatchDeleteInput = z.infer<typeof batchDeleteSchema>;

/**
 * Batch update schema
 */
export const batchUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  updates: z.object({
    metadata: z.record(z.any()).optional(),
  }),
});

export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

// ============================================================================
// File Validation Helpers
// ============================================================================

/**
 * Validate file size against content type limits
 */
export function validateFileSize(sizeBytes: number, contentType: ContentType): boolean {
  const limits: Record<ContentType, number> = {
    recording: 500 * 1024 * 1024, // 500 MB
    video: 500 * 1024 * 1024,     // 500 MB
    audio: 100 * 1024 * 1024,     // 100 MB
    document: 50 * 1024 * 1024,   // 50 MB
    text: 1 * 1024 * 1024,        // 1 MB
  };

  return sizeBytes <= limits[contentType];
}

/**
 * Get human-readable size limit label
 */
export function getSizeLimitLabel(contentType: ContentType): string {
  const labels: Record<ContentType, string> = {
    recording: '500 MB',
    video: '500 MB',
    audio: '100 MB',
    document: '50 MB',
    text: '1 MB',
  };

  return labels[contentType];
}

// ============================================================================
// Storage Path Helpers
// ============================================================================

/**
 * Generate storage path for uploaded content
 */
export function generateStoragePath(
  orgId: string,
  contentType: ContentType,
  recordingId: string,
  fileExtension: string
): string {
  const basePath = `${orgId}`;

  switch (contentType) {
    case 'recording':
      return `${basePath}/recordings/${recordingId}/raw.${fileExtension}`;
    case 'video':
      return `${basePath}/videos/${recordingId}.${fileExtension}`;
    case 'audio':
      return `${basePath}/audio/${recordingId}.${fileExtension}`;
    case 'document':
      return `${basePath}/documents/${recordingId}.${fileExtension}`;
    case 'text':
      return `${basePath}/text/${recordingId}.${fileExtension}`;
    default:
      throw new Error(`Unknown content type: ${contentType}`);
  }
}

// ============================================================================
// Export all schemas
// ============================================================================

export const librarySchemas = {
  uploadFile: uploadFileSchema,
  uploadMultipleFiles: uploadMultipleFilesSchema,
  createTextNote: createTextNoteSchema,
  updateTextNote: updateTextNoteSchema,
  libraryQuery: libraryQuerySchema,
  updateLibraryItem: updateLibraryItemSchema,
  softDelete: softDeleteSchema,
  dashboardRecent: dashboardRecentQuerySchema,
  dashboardStats: dashboardStatsQuerySchema,
  batchDelete: batchDeleteSchema,
  batchUpdate: batchUpdateSchema,
} as const;
