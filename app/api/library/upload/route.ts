import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  validateFileForUpload,
  getFileTypeFromMimeType,
  FILE_EXTENSION_TO_CONTENT_TYPE,
  getProcessingJobs,
  formatFileSize,
  FILE_SIZE_LIMIT_LABELS,
} from '@/lib/types/content';
import { generateStoragePath } from '@/lib/validations/library';
import { createLogger } from '@/lib/utils/logger';
import type { ContentType, FileType, JobType } from '@/lib/types/database';

const logger = createLogger({ service: 'library-upload' });

/**
 * POST /api/library/upload
 *
 * Upload one or more files to the library (videos, audio, documents).
 * Creates database records, uploads to Supabase Storage, and enqueues processing jobs.
 *
 * @route POST /api/library/upload
 * @access Protected - Requires organization context
 *
 * @body FormData with:
 *   - files: File[] (1-10 files)
 *   - metadata: string (optional JSON stringified metadata per file)
 *
 * @returns {
 *   uploads: Array<{
 *     id: string;
 *     status: 'success' | 'error';
 *     title: string;
 *     contentType: ContentType;
 *     fileType: FileType;
 *     fileSize: number;
 *     uploadUrl?: string;
 *     error?: string;
 *   }>;
 *   summary: {
 *     total: number;
 *     successful: number;
 *     failed: number;
 *   };
 * }
 *
 * @security
 *   - Validates file types and sizes
 *   - Prevents path traversal in filenames
 *   - Org-level data isolation via requireOrg()
 *   - Rate limiting: Consider wrapping with withRateLimit (10 uploads/min)
 *
 * @errors
 *   - 400: Invalid file type or size
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 413: Payload too large (handled by Next.js)
 *   - 500: Internal server error
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const requestId = generateRequestId();
  const { orgId, userId } = await requireOrg();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      logger.info('No files provided in upload request', {
        context: { requestId, orgId, userId },
      });
      return errors.badRequest('No files provided', undefined, requestId);
    }

    if (files.length > 10) {
      logger.warn('Too many files in upload request', {
        context: { requestId, orgId, userId },
        data: { fileCount: files.length, maxFiles: 10 },
      });
      return errors.badRequest(
        'Too many files. Maximum 10 files per request.',
        { maxFiles: 10 },
        requestId
      );
    }

    // Log request start
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    logger.info('Starting file upload request', {
      context: { requestId, orgId, userId },
      data: {
        fileCount: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2)),
        filenames: files.map(f => f.name),
      },
    });

    // Process each file
    const uploadResults = await Promise.all(
      files.map(async (file, index) => {
        try {
          // Validate file
          const validation = validateFileForUpload(file);
          if (!validation.valid) {
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: validation.error,
            };
          }

          const contentType = validation.contentType!;
          const fileType = validation.fileType!;

          // Prevent recordings from being uploaded via this endpoint
          if (contentType === 'recording') {
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: 'Screen recordings must be created via /api/recordings endpoint',
            };
          }

          // Sanitize filename to prevent path traversal
          const sanitizedFilename = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 255);

          // Create recording entry in database
          const { data: recording, error: dbError } = await supabaseAdmin
            .from('recordings')
            .insert({
              org_id: orgId,
              created_by: userId,
              title: sanitizedFilename,
              status: 'uploading',
              content_type: contentType,
              file_type: fileType,
              original_filename: sanitizedFilename,
              mime_type: file.type,
              file_size: file.size,
              metadata: {
                source: 'library_upload',
                uploaded_at: new Date().toISOString(),
              },
            })
            .select()
            .single();

          if (dbError || !recording) {
            logger.error('Database record creation failed', {
              context: { requestId, orgId, userId, filename: file.name },
              error: dbError as Error,
            });
            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: 'Failed to create database record',
            };
          }

          logger.info('Database record created', {
            context: { requestId, orgId, recordingId: recording.id },
            data: { filename: sanitizedFilename, contentType, fileType, fileSizeBytes: file.size },
          });

          // Generate storage path
          const storagePath = generateStoragePath(
            orgId,
            contentType,
            recording.id,
            fileType
          );

          // Upload file to Supabase Storage
          const fileBuffer = await file.arrayBuffer();
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('recordings')
            .upload(storagePath, fileBuffer, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            logger.error('Storage upload failed', {
              context: { requestId, orgId, recordingId: recording.id, storagePath },
              error: uploadError as Error,
            });

            // Clean up database record
            await supabaseAdmin
              .from('recordings')
              .delete()
              .eq('id', recording.id);

            // Provide more specific error messages
            let errorMessage = `Storage upload failed: ${uploadError.message}`;

            // Check for common error scenarios
            // Handle statusCode as both string and number
            const statusCode = typeof uploadError.statusCode === 'string'
              ? parseInt(uploadError.statusCode, 10)
              : uploadError.statusCode;

            if (uploadError.message?.includes('exceeded') || statusCode === 413) {
              // Use shared constants for file size limits
              const videoLimit = FILE_SIZE_LIMIT_LABELS.video;
              const audioLimit = FILE_SIZE_LIMIT_LABELS.audio;
              const documentLimit = FILE_SIZE_LIMIT_LABELS.document;
              errorMessage = `File too large. Your file (${formatFileSize(file.size)}) exceeds the storage limit. Maximum: ${videoLimit} for videos, ${audioLimit} for audio, ${documentLimit} for documents.`;
            } else if (uploadError.message?.includes('mime') || uploadError.message?.includes('type')) {
              errorMessage = `File type not supported. Supported formats: MP4, MOV, WEBM, AVI (video), MP3, WAV, M4A, OGG (audio), PDF, DOCX (documents), TXT, MD (text).`;
            }

            return {
              index,
              status: 'error' as const,
              title: file.name,
              error: errorMessage,
            };
          }

          // Update recording with storage path
          await supabaseAdmin
            .from('recordings')
            .update({
              storage_path_raw: storagePath,
              status: 'uploaded',
            })
            .eq('id', recording.id);

          logger.info('File uploaded to storage', {
            context: { requestId, orgId, recordingId: recording.id },
            data: { storagePath, fileSizeBytes: file.size },
          });

          // Enqueue processing jobs based on content type
          const jobTypes = getProcessingJobs(contentType, fileType);
          const firstJobType = jobTypes[0];

          if (firstJobType) {
            // Build job payload with correct path field based on job type
            const jobPayload: any = {
              recordingId: recording.id,
              orgId,
              contentType,
              fileType,
            };

            // Add storage path with correct field name for each job type
            if (firstJobType === 'extract_audio') {
              jobPayload.videoPath = storagePath;
            } else if (firstJobType === 'extract_text_pdf') {
              jobPayload.pdfPath = storagePath;
            } else if (firstJobType === 'extract_text_docx') {
              jobPayload.docxPath = storagePath;
            }

            await supabaseAdmin.from('jobs').insert({
              type: firstJobType as JobType,
              status: 'pending',
              payload: jobPayload,
              run_at: new Date().toISOString(),
            });

            // Update recording status based on first job
            let newStatus: typeof recording.status = 'uploaded';
            if (firstJobType === 'transcribe') {
              newStatus = 'transcribing';
            } else if (firstJobType === 'extract_audio') {
              newStatus = 'transcribing';
            } else if (firstJobType.startsWith('extract_text')) {
              newStatus = 'transcribing';
            } else if (firstJobType === 'process_text_note') {
              newStatus = 'transcribing';
            }

            await supabaseAdmin
              .from('recordings')
              .update({ status: newStatus })
              .eq('id', recording.id);

            logger.info('Processing job enqueued', {
              context: { requestId, orgId, recordingId: recording.id },
              data: { jobType: firstJobType, newStatus },
            });
          }

          // Generate signed URL for immediate access
          const { data: signedUrlData } = await supabaseAdmin.storage
            .from('recordings')
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

          return {
            index,
            status: 'success' as const,
            id: recording.id,
            title: sanitizedFilename,
            contentType,
            fileType,
            fileSize: file.size,
            uploadUrl: signedUrlData?.signedUrl,
          };
        } catch (error: any) {
          logger.error('File processing error', {
            context: { requestId, orgId, userId, filename: file.name, index },
            error: error as Error,
          });
          return {
            index,
            status: 'error' as const,
            title: file.name,
            error: error.message || 'Unknown error occurred',
          };
        }
      })
    );

    // Calculate summary
    const successful = uploadResults.filter((r) => r.status === 'success').length;
    const failed = uploadResults.filter((r) => r.status === 'error').length;

    logger.info('Upload request completed', {
      context: { requestId, orgId, userId },
      data: {
        total: uploadResults.length,
        successful,
        failed,
        successRate: parseFloat(((successful / uploadResults.length) * 100).toFixed(2)),
      },
    });

    return successResponse(
      {
        uploads: uploadResults,
        summary: {
          total: uploadResults.length,
          successful,
          failed,
        },
      },
      requestId,
      successful > 0 ? 201 : 400
    );
  } catch (error: any) {
    logger.error('Upload request error', {
      context: { requestId, orgId, userId },
      error: error as Error,
    });
    return errors.internalError(requestId);
  }
});

/**
 * GET /api/library/upload
 *
 * Not implemented - use POST for uploads
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to upload files.');
});
