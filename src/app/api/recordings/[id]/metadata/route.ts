/**
 * POST /api/recordings/[id]/metadata
 *
 * Save metadata and trigger processing for a recording.
 * This is Step 2 of the 2-step upload process (after file upload, before processing).
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
import { createLogger } from '@/lib/utils/logger';
import { hasPermission, type OrganizationRole } from '@/lib/security/rbac';
import { getProcessingJobs } from '@/lib/types/content';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';
import {
  CURRENT_RECORDING_STORAGE_BUCKET,
  findExactStorageObject,
  validateRecordingStoragePath,
  validateThumbnailStoragePath,
} from '@/lib/recordings/storage-contract';
import type { ContentType, FileType } from '@/lib/types/content';
import type { Json } from '@/lib/types/database';

const logger = createLogger({ service: 'upload-metadata' });

/**
 * Request validation schema
 */
const metadataSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  thumbnailUploaded: z.boolean().optional(),
  thumbnailPath: z.string().optional(), // Path to uploaded thumbnail (if custom extension)
  storagePath: z.string().min(1), // Path where file was uploaded
  storageBucket: z.literal('content').optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

type MetadataRequest = z.infer<typeof metadataSchema>;
type ProcessingJobType = ReturnType<typeof getProcessingJobs>[number];

function getIdempotencyKey(
  request: NextRequest,
  body: MetadataRequest,
): string | undefined {
  return (
    body.idempotencyKey ||
    request.headers.get('Idempotency-Key') ||
    undefined
  );
}

function isDuplicateKeyError(error: { code?: string } | null | undefined) {
  return error?.code === '23505';
}

function buildProcessingJobPayload(args: {
  firstJobType: ProcessingJobType;
  recordingId: string;
  orgId: string;
  contentType: ContentType;
  fileType: FileType;
  storagePath: string;
}): Record<string, Json | undefined> {
  const {
    firstJobType,
    recordingId,
    orgId,
    contentType,
    fileType,
    storagePath,
  } = args;
  const jobPayload: Record<string, Json | undefined> = {
    recordingId,
    orgId,
    contentType,
    fileType,
  };

  if (firstJobType === 'extract_audio') {
    jobPayload.videoPath = storagePath;
  } else if (firstJobType === 'transcribe') {
    jobPayload.storagePath = storagePath;
    jobPayload.storageBucket = CURRENT_RECORDING_STORAGE_BUCKET;
  } else if (firstJobType === 'extract_text_pdf') {
    jobPayload.pdfPath = storagePath;
  } else if (firstJobType === 'extract_text_docx') {
    jobPayload.docxPath = storagePath;
  } else if (firstJobType === 'process_text_note') {
    jobPayload.textPath = storagePath;
  }

  return jobPayload;
}

/**
 * POST /api/recordings/[id]/metadata
 *
 * Save metadata and start processing
 */
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const requestId = generateRequestId();
    const { orgId, userId, role } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id: recordingId } = await params;

    try {
      if (!hasPermission(role as OrganizationRole, 'recording:create')) {
        logger.warn('Metadata submission denied for non-writer role', {
          context: { requestId, orgId, userId, recordingId },
          data: { role },
        });
        return errors.forbidden(requestId);
      }

      // Parse and validate request body
      const body = await request.json();
      const validationResult = metadataSchema.safeParse(body);

      if (!validationResult.success) {
        logger.warn('Invalid metadata request', {
          context: { requestId, orgId, userId, recordingId },
          data: { errors: validationResult.error.issues },
        });
        return errors.badRequest(
          'Invalid request data',
          { errors: validationResult.error.issues },
          requestId,
        );
      }

      const {
        title,
        description,
        tags,
        metadata,
        thumbnailUploaded,
        thumbnailPath: providedThumbnailPath,
        storagePath,
        storageBucket = CURRENT_RECORDING_STORAGE_BUCKET,
      } = validationResult.data;
      const idempotencyKey = getIdempotencyKey(request, validationResult.data);

      logger.info('Saving metadata and starting processing', {
        context: { requestId, orgId, userId, recordingId },
        data: {
          title,
          hasDescription: !!description,
          tagCount: tags?.length || 0,
          thumbnailUploaded,
          providedThumbnailPath: providedThumbnailPath || null,
        },
      });

      // Verify content exists and belongs to org
      const { data: recording, error: fetchError } = await supabase
        .from('content')
        .select(
          'id, org_id, created_by, status, content_type, file_type, storage_path_raw, metadata',
        )
        .eq('id', recordingId)
        .eq('org_id', orgId)
        .single();

      if (fetchError || !recording) {
        logger.warn('Recording not found', {
          context: { requestId, recordingId, orgId },
        });
        return errors.notFound('Recording not found', requestId);
      }

      const canSubmitMetadata =
        recording.created_by === userId || role === 'owner' || role === 'admin';

      if (!canSubmitMetadata) {
        logger.warn('Metadata submission denied for non-owner recording', {
          context: { requestId, recordingId, orgId, userId },
          data: { role, createdBy: recording.created_by },
        });
        return errors.forbidden(requestId);
      }

      // Verify recording is in uploading status (ready for metadata)
      if (recording.status !== SOURCE_STATUS.UPLOADING) {
        const existingMetadata =
          typeof recording.metadata === 'object' &&
          recording.metadata !== null &&
          !Array.isArray(recording.metadata)
            ? (recording.metadata as Record<string, unknown>)
            : {};

        if (
          idempotencyKey &&
          existingMetadata.upload_idempotency_key === idempotencyKey &&
          recording.storage_path_raw === storagePath
        ) {
          const jobTypes = getProcessingJobs(
            recording.content_type as ContentType,
            recording.file_type as FileType,
          );
          const firstJobType = jobTypes[0];

          if (firstJobType) {
            const { error: jobError } = await supabase.from('jobs').insert({
              type: firstJobType,
              status: 'pending',
              payload: buildProcessingJobPayload({
                firstJobType,
                recordingId,
                orgId,
                contentType: recording.content_type as ContentType,
                fileType: recording.file_type as FileType,
                storagePath,
              }),
              run_at: new Date().toISOString(),
              dedupe_key: `${firstJobType}:${recordingId}`,
            });

            if (jobError && !isDuplicateKeyError(jobError)) {
              logger.error('Failed to recover idempotent processing job', {
                context: { requestId, recordingId, jobType: firstJobType },
                error: jobError as Error,
              });
              return errors.internalError(requestId);
            }
          }

          return successResponse(
            {
              success: true,
              streamUrl: `/api/recordings/${recordingId}/upload/stream`,
              recordingId,
              recovered: true,
            },
            requestId,
          );
        }

        logger.warn('Recording not in uploading status', {
          context: { requestId, recordingId, status: recording.status },
        });
        return errors.badRequest(
          `Recording is not ready for metadata. Current status: ${recording.status}`,
          { currentStatus: recording.status },
          requestId,
        );
      }

      const storageValidation = validateRecordingStoragePath({
        storagePath,
        bucket: storageBucket,
        orgId,
        recordingId,
        contentType: recording.content_type as ContentType | null,
        fileType: recording.file_type as FileType | null,
        allowLegacyRecordingsBucket: false,
      });

      if (!storageValidation.valid) {
        logger.warn('Invalid metadata storage path', {
          context: { requestId, recordingId, orgId },
          data: storageValidation.details,
        });
        return errors.badRequest(
          storageValidation.message,
          storageValidation.details,
          requestId,
        );
      }

      const storageObject = await findExactStorageObject(
        supabase,
        CURRENT_RECORDING_STORAGE_BUCKET,
        storageValidation.storagePath,
      );

      if (!storageObject.exists) {
        const storageError =
          storageObject.error instanceof Error
            ? storageObject.error.message
            : undefined;

        logger.warn('Uploaded file not found in content storage', {
          context: { requestId, recordingId, orgId },
          data: {
            storagePath: storageValidation.storagePath,
            storageBucket: CURRENT_RECORDING_STORAGE_BUCKET,
            storageError,
          },
        });
        return errors.badRequest(
          'Uploaded file not found in storage',
          undefined,
          requestId,
        );
      }

      // Generate thumbnail URL if thumbnail was uploaded
      let thumbnailUrl: string | null = null;

      if (thumbnailUploaded) {
        // Use provided path if available, otherwise default to .jpg extension
        // Thumbnails are stored in the 'thumbnails' bucket with path pattern: org_{orgId}/recordings/{recordingId}/thumbnail.{ext}
        const thumbnailPath =
          providedThumbnailPath ||
          `org_${orgId}/recordings/${recordingId}/thumbnail.jpg`;

        const thumbnailValidation = validateThumbnailStoragePath({
          thumbnailPath,
          orgId,
          recordingId,
        });

        if (!thumbnailValidation.valid) {
          logger.warn('Invalid thumbnail path', {
            context: { requestId, recordingId, orgId },
            data: thumbnailValidation.details,
          });
          return errors.badRequest(
            thumbnailValidation.message,
            thumbnailValidation.details,
            requestId,
          );
        }

        const { data: publicUrlData } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(thumbnailPath);
        thumbnailUrl = publicUrlData?.publicUrl || null;

        logger.info('Thumbnail URL generated', {
          context: { requestId, recordingId },
          data: {
            thumbnailPath,
            thumbnailUrl,
            usedProvidedPath: !!providedThumbnailPath,
          },
        });
      }

      const recordingMetadata =
        typeof recording.metadata === 'object' &&
        recording.metadata !== null &&
        !Array.isArray(recording.metadata)
          ? (recording.metadata as Record<string, Json | undefined>)
          : {};
      const submittedMetadata = (metadata ?? {}) as Record<
        string,
        Json | undefined
      >;

      // Update content with metadata
      const updatePayload = {
        title,
        description: description || null,
        status: SOURCE_STATUS.UPLOADED, // Move to uploaded status
        storage_path_raw: storageValidation.storagePath,
        thumbnail_url: thumbnailUrl, // Set thumbnail URL if uploaded
        metadata: {
          ...recordingMetadata,
          ...submittedMetadata,
          ...(idempotencyKey
            ? { upload_idempotency_key: idempotencyKey }
            : {}),
          metadata_submitted_at: new Date().toISOString(),
          thumbnail_uploaded: thumbnailUploaded || false,
        },
        updated_at: new Date().toISOString(),
      };

      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Updating content with payload', {
          context: { requestId, recordingId },
          data: {
            thumbnail_url: updatePayload.thumbnail_url,
            thumbnail_uploaded: updatePayload.metadata.thumbnail_uploaded,
          },
        });
      }

      const { error: updateError } = await supabase
        .from('content')
        .update(updatePayload)
        .eq('id', recordingId)
        .eq('org_id', orgId)
        .eq('status', SOURCE_STATUS.UPLOADING);

      if (updateError) {
        console.error('[Metadata Route] Database update error:', updateError);
        logger.error('Failed to update recording', {
          context: { requestId, recordingId },
          error: updateError as Error,
        });
        return errors.internalError(requestId);
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Successfully updated content with thumbnail_url', {
          context: { requestId, recordingId },
          data: { thumbnailUrl },
        });
      }

      logger.info('Recording updated', {
        context: { requestId, recordingId },
      });

      // Handle tags
      if (tags && tags.length > 0) {
        logger.info('Processing tags', {
          context: { requestId, recordingId },
          data: { tagCount: tags.length, tags },
        });

        // For each tag, check if it exists or create it
        const tagIds: string[] = [];

        for (const tagName of tags) {
          // Check if tag exists
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('org_id', orgId)
            .eq('name', tagName)
            .maybeSingle();

          if (existingTag) {
            tagIds.push(existingTag.id);
          } else {
            // Create new tag
            const { data: newTag, error: tagError } = await supabase
              .from('tags')
              .insert({
                org_id: orgId,
                name: tagName,
                created_by: userId,
              })
              .select('id')
              .single();

            if (tagError) {
              logger.error('Failed to create tag', {
                context: { requestId, recordingId, tagName },
                error: tagError as Error,
              });
              // Continue with other tags
              continue;
            }

            if (newTag) {
              tagIds.push(newTag.id);
              logger.info('Tag created', {
                context: { requestId, tagName, tagId: newTag.id },
              });
            }
          }
        }

        // Associate tags with recording
        if (tagIds.length > 0) {
          const tagAssociations = tagIds.map((tagId) => ({
            content_id: recordingId,
            tag_id: tagId,
            created_by: userId,
          }));

          const { error: assocError } = await supabase
            .from('content_tags')
            .insert(tagAssociations);

          if (assocError) {
            logger.error('Failed to associate tags', {
              context: { requestId, recordingId },
              error: assocError as Error,
            });
            // Non-fatal, continue with processing
          } else {
            logger.info('Tags associated', {
              context: { requestId, recordingId },
              data: { tagCount: tagIds.length },
            });
          }
        }
      }

      // Determine and enqueue first processing job
      const jobTypes = getProcessingJobs(
        recording.content_type as ContentType,
        recording.file_type as FileType,
      );
      const firstJobType = jobTypes[0];

      if (firstJobType) {
        const { error: jobError } = await supabase.from('jobs').insert({
          type: firstJobType,
          status: 'pending',
          payload: buildProcessingJobPayload({
            firstJobType,
            recordingId,
            orgId,
            contentType: recording.content_type as ContentType,
            fileType: recording.file_type as FileType,
            storagePath: storageValidation.storagePath,
          }),
          run_at: new Date().toISOString(),
          dedupe_key: `${firstJobType}:${recordingId}`,
        });

        if (jobError) {
          if (isDuplicateKeyError(jobError)) {
            logger.info('Processing job already enqueued', {
              context: { requestId, recordingId, jobType: firstJobType },
            });
          } else {
            logger.error('Failed to enqueue processing job', {
              context: { requestId, recordingId, jobType: firstJobType },
              error: jobError as Error,
            });
            await supabase
              .from('content')
              .update({
                status: SOURCE_STATUS.UPLOADING,
                updated_at: new Date().toISOString(),
              })
              .eq('id', recordingId)
              .eq('org_id', orgId);
            return errors.internalError(requestId);
          }
        }

        logger.info('Processing job enqueued', {
          context: { requestId, recordingId },
          data: { jobType: firstJobType },
        });

        // Update recording status based on job type
        const newStatus =
          getQueuedSourceStatusForJob(firstJobType) ?? SOURCE_STATUS.UPLOADED;

        const { error: statusUpdateError } = await supabase
          .from('content')
          .update({ status: newStatus })
          .eq('id', recordingId)
          .eq('org_id', orgId);

        if (statusUpdateError) {
          console.error('[Metadata Route] Failed to update recording status:', {
            recordingId,
            attemptedStatus: newStatus,
            error: statusUpdateError,
          });
          // Non-blocking: Continue even if status update fails
        }
      }

      // Create event for notifications
      await supabase.from('events').insert({
        type: 'recording.metadata_submitted',
        payload: {
          recordingId,
          orgId,
          userId,
          title,
          tagCount: tags?.length || 0,
        },
      });

      // Return SSE stream URL for progress tracking
      const streamUrl = `/api/recordings/${recordingId}/upload/stream`;

      logger.info('Metadata saved and processing started', {
        context: { requestId, recordingId },
      });

      return successResponse(
        {
          success: true,
          streamUrl,
          recordingId,
        },
        requestId,
      );
    } catch (error: unknown) {
      logger.error('Metadata submission error', {
        context: { requestId, orgId, userId, recordingId },
        error: error as Error,
      });
      return errors.internalError(requestId);
    }
  },
);

/**
 * GET not supported
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to submit metadata.');
});
