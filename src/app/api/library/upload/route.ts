import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { hasPermission, type OrganizationRole } from '@/lib/security/rbac';
import {
  validateFileForUpload,
  getProcessingJobs,
  formatFileSize,
  FILE_SIZE_LIMIT_LABELS,
  FILE_SIZE_LIMITS,
} from '@/lib/types/content';
import { generateStoragePath } from '@/lib/validations/library';
import { createLogger } from '@/lib/utils/logger';
import { mapSequentially } from '@/lib/utils/async';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';
import type { ContentType, FileType, JobType } from '@/lib/types/database';

const logger = createLogger({ service: 'library-upload' });
const MAX_BATCH_FILES = 10;
const MAX_LIBRARY_SERVER_UPLOAD_BYTES = Math.min(
  FILE_SIZE_LIMITS.video,
  100 * 1024 * 1024,
);

interface UploadFormOptions {
  analysisType: string;
  skipAnalysis: boolean;
}

interface ValidatedUploadFile {
  file: File;
  index: number;
  contentType: ContentType;
  fileType: FileType;
}

type UploadResult =
  | {
      index: number;
      status: 'error';
      title: string;
      error: string | undefined;
    }
  | {
      index: number;
      status: 'success';
      id: string;
      title: string;
      contentType: ContentType;
      fileType: FileType;
      fileSize: number;
      uploadUrl?: string;
    };

type JobPayload = {
  recordingId: string;
  orgId: string;
  contentType: ContentType;
  fileType: FileType;
  transcriptId?: string;
  videoPath?: string;
  pdfPath?: string;
  docxPath?: string;
};

function payloadTooLargeResponse(requestId: string, details: unknown) {
  return Response.json(
    {
      error: 'Payload too large',
      details,
      requestId,
    },
    { status: 413 },
  );
}

function lengthRequiredResponse(requestId: string, details: unknown) {
  return Response.json(
    {
      error: 'Content-Length required',
      details,
      requestId,
    },
    { status: 411 },
  );
}

function parseUploadOptions(formData: FormData): UploadFormOptions {
  const rawAnalysisType = formData.get('analysisType');
  const rawSkipAnalysis = formData.get('skipAnalysis');

  return {
    analysisType:
      typeof rawAnalysisType === 'string' && rawAnalysisType.length > 0
        ? rawAnalysisType
        : 'general',
    skipAnalysis:
      typeof rawSkipAnalysis === 'string' ? rawSkipAnalysis === 'true' : false,
  };
}

async function rollbackContent(
  contentId: string,
  storagePath?: string,
): Promise<boolean> {
  if (storagePath) {
    const { error } = await supabaseAdmin.storage
      .from('content')
      .remove([storagePath]);
    if (error) {
      logger.error('Failed to remove uploaded storage during rollback', {
        context: { contentId, storagePath },
        error,
      });
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('content')
    .delete()
    .eq('id', contentId);
  if (deleteError) {
    logger.error('Failed to remove content row during upload rollback', {
      context: { contentId, storagePath },
      error: deleteError,
    });
    return false;
  }

  return true;
}

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
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const requestId = generateRequestId();
    const { orgId, userId, role } = await requireOrg();
    let reservedQuota = 0;

    try {
      if (!hasPermission(role as OrganizationRole, 'recording:create')) {
        logger.warn('Library upload denied for non-writer role', {
          context: { requestId, orgId, userId },
          data: { role },
        });
        return errors.forbidden(requestId);
      }

      const contentLength = request.headers.get('content-length');
      const declaredContentLength = contentLength
        ? Number.parseInt(contentLength, 10)
        : Number.NaN;

      if (
        !Number.isFinite(declaredContentLength) ||
        declaredContentLength < 0
      ) {
        logger.warn('Library upload rejected without a valid content-length', {
          context: { requestId, orgId, userId },
          data: { contentLength },
        });
        return lengthRequiredResponse(requestId, {
          maxBytes: MAX_LIBRARY_SERVER_UPLOAD_BYTES,
          message:
            'Library uploads through this endpoint require Content-Length so oversized multipart bodies are rejected before parsing.',
        });
      }

      if (declaredContentLength > MAX_LIBRARY_SERVER_UPLOAD_BYTES) {
        logger.warn('Library upload rejected by content-length cap', {
          context: { requestId, orgId, userId },
          data: {
            declaredContentLength,
            maxBytes: MAX_LIBRARY_SERVER_UPLOAD_BYTES,
          },
        });
        return payloadTooLargeResponse(requestId, {
          maxBytes: MAX_LIBRARY_SERVER_UPLOAD_BYTES,
          declaredBytes: declaredContentLength,
        });
      }

      // Parse multipart form data
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      const uploadOptions = parseUploadOptions(formData);

      if (!files || files.length === 0) {
        logger.info('No files provided in upload request', {
          context: { requestId, orgId, userId },
        });
        return errors.badRequest('No files provided', undefined, requestId);
      }

      if (files.length > MAX_BATCH_FILES) {
        logger.warn('Too many files in upload request', {
          context: { requestId, orgId, userId },
          data: { fileCount: files.length, maxFiles: 10 },
        });
        return errors.badRequest(
          'Too many files. Maximum 10 files per request.',
          { maxFiles: MAX_BATCH_FILES },
          requestId,
        );
      }

      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_LIBRARY_SERVER_UPLOAD_BYTES) {
        logger.warn('Library upload rejected by aggregate file-size cap', {
          context: { requestId, orgId, userId },
          data: {
            fileCount: files.length,
            totalSizeBytes: totalSize,
            maxBytes: MAX_LIBRARY_SERVER_UPLOAD_BYTES,
          },
        });
        return payloadTooLargeResponse(requestId, {
          maxBytes: MAX_LIBRARY_SERVER_UPLOAD_BYTES,
          totalBytes: totalSize,
        });
      }

      const validatedFiles: ValidatedUploadFile[] = [];
      const validationFailures: UploadResult[] = [];

      files.forEach((file, index) => {
        const validation = validateFileForUpload(file, undefined, {
          uploadContext: 'library',
        });
        if (
          !validation.valid ||
          !validation.contentType ||
          !validation.fileType
        ) {
          validationFailures.push({
            index,
            status: 'error',
            title: file.name,
            error: validation.error,
          });
          return;
        }

        if (validation.contentType === 'recording') {
          validationFailures.push({
            index,
            status: 'error',
            title: file.name,
            error:
              'Screen recordings must be created via /api/recordings endpoint',
          });
          return;
        }

        validatedFiles.push({
          file,
          index,
          contentType: validation.contentType,
          fileType: validation.fileType,
        });
      });

      if (validatedFiles.length === 0) {
        return successResponse(
          {
            uploads: validationFailures,
            summary: {
              total: files.length,
              successful: 0,
              failed: validationFailures.length,
            },
          },
          requestId,
          400,
        );
      }

      const quotaCheck = await QuotaManager.checkAndConsumeQuota(
        orgId,
        'recording',
        validatedFiles.length,
      );
      if (!quotaCheck.allowed) {
        return errors.quotaExceeded({
          remaining: quotaCheck.remaining,
          limit: quotaCheck.limit,
          resetAt: quotaCheck.resetAt.toISOString(),
          message: quotaCheck.message,
        });
      }
      reservedQuota = validatedFiles.length;

      // Log request start
      logger.info('Starting file upload request', {
        context: { requestId, orgId, userId },
        data: {
          fileCount: files.length,
          totalSizeBytes: totalSize,
          totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2)),
          filenames: files.map((f) => f.name),
        },
      });

      const uploadResults: UploadResult[] = [...validationFailures];

      // Process files sequentially to avoid buffering large multipart batches concurrently.
      await mapSequentially(
        validatedFiles,
        async ({ file, index, contentType, fileType }) => {
          let activeContentId: string | undefined;
          let activeStoragePath: string | undefined;
          try {
            // Sanitize filename to prevent path traversal
            const sanitizedFilename = file.name
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .substring(0, 255);

            // Create recording entry in database
            const { data: recording, error: dbError } = await supabaseAdmin
              .from('content')
              .insert({
                org_id: orgId,
                created_by: userId,
                title: sanitizedFilename,
                status: SOURCE_STATUS.UPLOADING,
                content_type: contentType,
                file_type: fileType,
                original_filename: sanitizedFilename,
                mime_type: file.type,
                file_size: file.size,
                analysis_type: uploadOptions.analysisType,
                skip_analysis: uploadOptions.skipAnalysis,
                metadata: {
                  source: 'library_upload',
                  uploaded_at: new Date().toISOString(),
                  analysisType: uploadOptions.analysisType,
                  skipAnalysis: uploadOptions.skipAnalysis,
                },
              })
              .select()
              .single();

            if (dbError || !recording) {
              logger.error('Database record creation failed', {
                context: { requestId, orgId, userId, filename: file.name },
                error: dbError as Error,
              });
              await QuotaManager.releaseQuota(orgId, 'recording');
              reservedQuota = Math.max(0, reservedQuota - 1);
              uploadResults.push({
                index,
                status: 'error' as const,
                title: file.name,
                error: 'Failed to create database record',
              });
              return;
            }
            activeContentId = recording.id;

            logger.info('Database record created', {
              context: { requestId, orgId, recordingId: recording.id },
              data: {
                filename: sanitizedFilename,
                contentType,
                fileType,
                fileSizeBytes: file.size,
              },
            });

            // Generate storage path
            const storagePath = generateStoragePath(
              orgId,
              contentType,
              recording.id,
              fileType,
            );
            activeStoragePath = storagePath;

            // Upload file to Supabase Storage
            const fileBuffer = await file.arrayBuffer();
            const { error: uploadError } = await supabaseAdmin.storage
              .from('content')
              .upload(storagePath, fileBuffer, {
                contentType: file.type,
                upsert: false,
              });

            if (uploadError) {
              logger.error('Storage upload failed', {
                context: {
                  requestId,
                  orgId,
                  recordingId: recording.id,
                  storagePath,
                },
                error: uploadError as Error,
              });

              const rolledBack = await rollbackContent(recording.id);
              if (rolledBack) {
                await QuotaManager.releaseQuota(orgId, 'recording');
                reservedQuota = Math.max(0, reservedQuota - 1);
              }

              // Provide more specific error messages
              let errorMessage = `Storage upload failed: ${uploadError.message}`;

              // Check for common error scenarios
              // Handle statusCode as both string and number (if it exists on the error object)
              const statusCode =
                'statusCode' in uploadError &&
                typeof uploadError.statusCode === 'number'
                  ? uploadError.statusCode
                  : undefined;
              const uploadMessageIncludes = uploadError.message?.includes.bind(
                uploadError.message,
              );

              if (uploadMessageIncludes?.('exceeded') || statusCode === 413) {
                // Use shared constants for file size limits
                const videoLimit = FILE_SIZE_LIMIT_LABELS.video;
                const audioLimit = FILE_SIZE_LIMIT_LABELS.audio;
                const documentLimit = FILE_SIZE_LIMIT_LABELS.document;
                errorMessage = `File too large. Your file (${formatFileSize(file.size)}) exceeds the storage limit. Maximum: ${videoLimit} for videos, ${audioLimit} for audio, ${documentLimit} for documents.`;
              } else if (
                uploadMessageIncludes?.('mime') ||
                uploadMessageIncludes?.('type')
              ) {
                errorMessage = `File type not supported. Supported formats: MP4, MOV, WEBM, AVI (video), MP3, WAV, M4A, OGG (audio), PDF, DOCX (documents), TXT, MD (text).`;
              }

              uploadResults.push({
                index,
                status: 'error' as const,
                title: file.name,
                error: errorMessage,
              });
              return;
            }

            // Update recording with storage path
            await supabaseAdmin
              .from('content')
              .update({
                storage_path_raw: storagePath,
                status: SOURCE_STATUS.UPLOADED,
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
              let transcriptId: string | undefined;

              if (firstJobType === 'process_text_note') {
                const textContent = Buffer.from(fileBuffer).toString('utf-8');
                const { data: transcript, error: transcriptError } =
                  await supabaseAdmin
                    .from('transcripts')
                    .insert({
                      content_id: recording.id,
                      text: textContent,
                      language: 'en',
                      provider: 'library_upload',
                      words_json: {
                        source: 'library_upload',
                        originalFilename: sanitizedFilename,
                      },
                    })
                    .select('id')
                    .single();

                if (transcriptError || !transcript) {
                  logger.error('Text transcript creation failed', {
                    context: { requestId, orgId, recordingId: recording.id },
                    error: transcriptError as Error,
                  });
                  const rolledBack = await rollbackContent(
                    recording.id,
                    storagePath,
                  );
                  if (rolledBack) {
                    await QuotaManager.releaseQuota(orgId, 'recording');
                    reservedQuota = Math.max(0, reservedQuota - 1);
                  }
                  uploadResults.push({
                    index,
                    status: 'error' as const,
                    title: file.name,
                    error: 'Failed to create text transcript',
                  });
                  return;
                }

                transcriptId = transcript.id;
              }

              // Build job payload with correct path field based on job type
              const jobPayload: JobPayload = {
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
              } else if (firstJobType === 'process_text_note') {
                jobPayload.transcriptId = transcriptId;
              }

              const { error: jobError } = await supabaseAdmin
                .from('jobs')
                .insert({
                  type: firstJobType as JobType,
                  status: 'pending',
                  content_id: recording.id,
                  payload: jobPayload,
                  dedupe_key: `${firstJobType}:${recording.id}`,
                  run_at: new Date().toISOString(),
                });

              if (jobError) {
                logger.error('Processing job enqueue failed', {
                  context: { requestId, orgId, recordingId: recording.id },
                  error: jobError as Error,
                });
                const rolledBack = await rollbackContent(
                  recording.id,
                  storagePath,
                );
                if (rolledBack) {
                  await QuotaManager.releaseQuota(orgId, 'recording');
                  reservedQuota = Math.max(0, reservedQuota - 1);
                }
                uploadResults.push({
                  index,
                  status: 'error' as const,
                  title: file.name,
                  error: 'Failed to enqueue processing job',
                });
                return;
              }

              // Update recording status based on first job
              const newStatus =
                getQueuedSourceStatusForJob(firstJobType) ??
                SOURCE_STATUS.UPLOADED;

              await supabaseAdmin
                .from('content')
                .update({ status: newStatus })
                .eq('id', recording.id);

              logger.info('Processing job enqueued', {
                context: { requestId, orgId, recordingId: recording.id },
                data: { jobType: firstJobType, newStatus },
              });
            }

            // Generate signed URL for immediate access
            const { data: signedUrlData } = await supabaseAdmin.storage
              .from('content')
              .createSignedUrl(storagePath, 3600); // 1 hour expiry

            uploadResults.push({
              index,
              status: 'success' as const,
              id: recording.id,
              title: sanitizedFilename,
              contentType,
              fileType,
              fileSize: file.size,
              uploadUrl: signedUrlData?.signedUrl,
            });
            reservedQuota = Math.max(0, reservedQuota - 1);
          } catch (error: unknown) {
            logger.error('File processing error', {
              context: { requestId, orgId, userId, filename: file.name, index },
              error: error as Error,
            });
            const rolledBack = activeContentId
              ? await rollbackContent(activeContentId, activeStoragePath)
              : true;
            if (rolledBack) {
              await QuotaManager.releaseQuota(orgId, 'recording');
              reservedQuota = Math.max(0, reservedQuota - 1);
            }
            uploadResults.push({
              index,
              status: 'error' as const,
              title: file.name,
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown error occurred',
            });
          }
        },
      );

      uploadResults.sort((a, b) => a.index - b.index);

      // Calculate summary
      const successful = uploadResults.filter(
        (r) => r.status === 'success',
      ).length;
      const failed = uploadResults.filter((r) => r.status === 'error').length;

      logger.info('Upload request completed', {
        context: { requestId, orgId, userId },
        data: {
          total: uploadResults.length,
          successful,
          failed,
          successRate: parseFloat(
            ((successful / uploadResults.length) * 100).toFixed(2),
          ),
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
        successful > 0 ? 201 : 400,
      );
    } catch (error: unknown) {
      if (reservedQuota > 0) {
        await QuotaManager.releaseQuota(orgId, 'recording', reservedQuota);
      }
      logger.error('Upload request error', {
        context: { requestId, orgId, userId },
        error: error as Error,
      });
      return errors.internalError(requestId);
    }
  }),
  {
    limiter: 'upload',
    identifier: async () => {
      const { orgId } = await requireOrg();
      return orgId;
    },
  },
);

/**
 * GET /api/library/upload
 *
 * Not implemented - use POST for uploads
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to upload files.');
});
