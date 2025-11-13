/**
 * POST /api/recordings/upload/init
 *
 * Initialize a new upload - creates a recording entry and generates presigned upload URLs.
 * This is Step 1 of the 2-step upload process (before metadata collection).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { createLogger } from '@/lib/utils/logger';
import {
  getContentTypeFromMimeType,
  getFileTypeFromMimeType,
  isValidFileSize,
  FILE_SIZE_LIMITS,
  type ContentType,
  type FileType,
} from '@/lib/types/content';

const logger = createLogger({ service: 'upload-init' });

/**
 * Request validation schema
 */
const initUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  durationSec: z.number().positive().optional(),
});

type InitUploadRequest = z.infer<typeof initUploadSchema>;

/**
 * POST /api/recordings/upload/init
 *
 * Initialize upload and get presigned URLs
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const requestId = generateRequestId();
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;

    try {
      // Parse and validate request body
      const body = await request.json();
      const validationResult = initUploadSchema.safeParse(body);

      if (!validationResult.success) {
        logger.warn('Invalid init upload request', {
          context: { requestId, orgId, userId },
          data: { errors: validationResult.error.errors },
        });
        return errors.badRequest(
          'Invalid request data',
          { errors: validationResult.error.errors },
          requestId
        );
      }

      const { filename, mimeType, fileSize, durationSec } = validationResult.data;

      logger.info('Initializing upload', {
        context: { requestId, orgId, userId },
        data: {
          filename,
          mimeType,
          fileSizeMB: parseFloat((fileSize / 1024 / 1024).toFixed(2)),
          durationSec,
        },
      });

      // Determine content type and file type from MIME type
      const fileType = getFileTypeFromMimeType(mimeType);
      const contentType = fileType ? getContentTypeFromMimeType(mimeType) : null;

      if (!fileType || !contentType) {
        return errors.badRequest(
          `Unsupported file type: ${mimeType}`,
          { supportedTypes: ['video/*', 'audio/*', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/*'] },
          requestId
        );
      }

      // Validate file size for content type
      if (!isValidFileSize(fileSize, contentType)) {
        const maxSizeBytes = FILE_SIZE_LIMITS[contentType];
        return errors.badRequest(
          `File size (${fileSize} bytes) exceeds limit for ${contentType} files`,
          { maxSize: maxSizeBytes },
          requestId
        );
      }

      // SECURITY: Atomically check and consume quota to prevent race conditions
      // This prevents multiple concurrent requests from exceeding quota limits
      const quotaCheck = await QuotaManager.checkAndConsumeQuota(orgId, 'recording');
      if (!quotaCheck.allowed) {
        logger.warn('Quota exceeded', {
          context: { requestId, orgId },
          data: { remaining: quotaCheck.remaining, limit: quotaCheck.limit },
        });
        return errors.quotaExceeded({
          remaining: quotaCheck.remaining,
          limit: quotaCheck.limit,
          resetAt: quotaCheck.resetAt.toISOString(),
          message: quotaCheck.message,
        });
      }

      // Quota has been consumed - track this for potential rollback
      let quotaConsumed = true;

      // Sanitize filename (prevent path traversal)
      const sanitizedFilename = filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 255);

      // Create recording entry with uploading status
      const { data: recording, error: dbError } = await supabase
        .from('recordings')
        .insert({
          org_id: orgId,
          created_by: userId,
          title: sanitizedFilename, // Pre-fill title, user can edit in step 2
          status: 'uploading', // Initial state - waiting for file upload and metadata
          content_type: contentType,
          file_type: fileType,
          original_filename: sanitizedFilename,
          mime_type: mimeType,
          file_size: fileSize,
          duration_sec: durationSec || null,
          metadata: {
            source: 'upload_wizard',
            initialized_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (dbError || !recording) {
        logger.error('Failed to create recording', {
          context: { requestId, orgId, userId },
          error: dbError as Error,
        });

        // Rollback consumed quota since DB insert failed
        try {
          await QuotaManager.releaseQuota(orgId, 'recording');
          logger.info('Rolled back quota after DB insert failure', {
            context: { requestId, orgId },
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback quota', {
            context: { requestId, orgId },
            error: rollbackError as Error,
          });
        }

        return errors.internalError(requestId);
      }

      logger.info('Recording created', {
        context: { requestId, orgId, recordingId: recording.id },
        data: { contentType, fileType },
      });

      // Generate storage paths
      const fileExtension = `.${fileType}`;
      const filePath = `${orgId}/uploads/${recording.id}/file${fileExtension}`;
      const thumbnailPath = `${orgId}/uploads/${recording.id}/thumbnail.jpg`;

      // Generate presigned upload URL for main file
      const { data: fileUploadData, error: fileUploadError } = await supabase.storage
        .from('recordings')
        .createSignedUploadUrl(filePath, {
          upsert: false,
        });

      if (fileUploadError || !fileUploadData) {
        logger.error('Failed to generate file upload URL', {
          context: { requestId, recordingId: recording.id },
          error: fileUploadError as Error,
        });

        // CRITICAL: Rollback consumed quota before cleanup
        try {
          await QuotaManager.releaseQuota(orgId, 'recording');
          logger.info('Rolled back quota after upload URL generation failure', {
            context: { requestId, orgId, recordingId: recording.id },
          });
        } catch (rollbackError) {
          logger.error('Failed to rollback quota', {
            context: { requestId, orgId, recordingId: recording.id },
            error: rollbackError as Error,
          });
          // Continue with cleanup even if rollback fails
        }

        // Cleanup: delete the recording
        await supabase.from('recordings').delete().eq('id', recording.id);

        return errors.internalError(requestId);
      }

      // Generate presigned upload URL for thumbnail (optional)
      const { data: thumbnailUploadData } = await supabase.storage
        .from('recordings')
        .createSignedUploadUrl(thumbnailPath, {
          upsert: true, // Allow override
        });

      logger.info('Upload URLs generated', {
        context: { requestId, recordingId: recording.id },
        data: {
          filePath,
          thumbnailPath: thumbnailUploadData ? thumbnailPath : null,
        },
      });

      // Return response
      return successResponse(
        {
          recordingId: recording.id,
          uploadUrl: fileUploadData.signedUrl,
          uploadPath: filePath,
          thumbnailUploadUrl: thumbnailUploadData?.signedUrl || null,
          thumbnailPath: thumbnailUploadData ? thumbnailPath : null,
          token: fileUploadData.token,
        },
        requestId,
        201
      );
    } catch (error: any) {
      logger.error('Upload init request error', {
        context: { requestId, orgId, userId },
        error: error as Error,
      });
      return errors.internalError(requestId);
    }
  }),
  {
    limiter: 'upload',
    identifier: async (req) => {
      const { orgId } = await requireOrg();
      return orgId;
    },
  }
);

/**
 * GET not supported
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to initialize upload.');
});
