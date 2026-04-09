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
import { getProcessingJobs } from '@/lib/types/content';

const logger = createLogger({ service: 'upload-metadata' });

/**
 * Request validation schema
 */
const metadataSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(20).optional(),
  metadata: z.record(z.any()).optional(),
  thumbnailUploaded: z.boolean().optional(),
  thumbnailPath: z.string().optional(), // Path to uploaded thumbnail (if custom extension)
  storagePath: z.string().min(1), // Path where file was uploaded
});

type MetadataRequest = z.infer<typeof metadataSchema>;

/**
 * POST /api/recordings/[id]/metadata
 *
 * Save metadata and start processing
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const requestId = generateRequestId();
  const { orgId, userId } = await requireOrg();
  const supabase = supabaseAdmin;
  const { id: recordingId } = await params;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = metadataSchema.safeParse(body);

    if (!validationResult.success) {
      logger.warn('Invalid metadata request', {
        context: { requestId, orgId, userId, recordingId },
        data: { errors: validationResult.error.errors },
      });
      return errors.badRequest(
        'Invalid request data',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { title, description, tags, metadata, thumbnailUploaded, thumbnailPath: providedThumbnailPath, storagePath } =
      validationResult.data;

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
      .select('id, org_id, status, content_type, file_type, metadata')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !recording) {
      logger.warn('Recording not found', {
        context: { requestId, recordingId, orgId },
      });
      return errors.notFound('Recording not found', requestId);
    }

    // Verify recording is in uploading status (ready for metadata)
    if (recording.status !== 'uploading') {
      logger.warn('Recording not in uploading status', {
        context: { requestId, recordingId, status: recording.status },
      });
      return errors.badRequest(
        `Recording is not ready for metadata. Current status: ${recording.status}`,
        { currentStatus: recording.status },
        requestId
      );
    }

    // Generate thumbnail URL if thumbnail was uploaded
    let thumbnailUrl: string | null = null;

    if (thumbnailUploaded) {
      // Use provided path if available, otherwise default to .jpg extension
      // Thumbnails are stored in the 'thumbnails' bucket with path pattern: org_{orgId}/recordings/{recordingId}/thumbnail.{ext}
      const thumbnailPath = providedThumbnailPath || `org_${orgId}/recordings/${recordingId}/thumbnail.jpg`;

      const { data: publicUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailPath);
      thumbnailUrl = publicUrlData?.publicUrl || null;

      logger.info('Thumbnail URL generated', {
        context: { requestId, recordingId },
        data: { thumbnailPath, thumbnailUrl, usedProvidedPath: !!providedThumbnailPath },
      });
    } else {
    }

    // Update content with metadata
    const updatePayload = {
      title,
      description: description || null,
      status: 'uploaded', // Move to uploaded status
      storage_path_raw: storagePath,
      thumbnail_url: thumbnailUrl, // Set thumbnail URL if uploaded
      metadata: {
        ...(recording.metadata as any),
        ...metadata,
        metadata_submitted_at: new Date().toISOString(),
        thumbnail_uploaded: thumbnailUploaded || false,
      },
      updated_at: new Date().toISOString(),
    };

    console.log('[Metadata Route] Updating content with payload:', {
      recordingId,
      thumbnail_url: updatePayload.thumbnail_url,
      thumbnail_uploaded_in_metadata: updatePayload.metadata.thumbnail_uploaded,
    });

    const { error: updateError } = await supabase
      .from('content')
      .update(updatePayload)
      .eq('id', recordingId);

    if (updateError) {
      console.error('[Metadata Route] Database update error:', updateError);
      logger.error('Failed to update recording', {
        context: { requestId, recordingId },
        error: updateError as Error,
      });
      return errors.internalError(requestId);
    }

    console.log('[Metadata Route] Successfully updated content with thumbnail_url:', thumbnailUrl);

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
    const jobTypes = getProcessingJobs(recording.content_type as any, recording.file_type as any);
    const firstJobType = jobTypes[0];

    if (firstJobType) {
      // Build job payload with correct path field based on job type
      const jobPayload: any = {
        recordingId,
        orgId,
        contentType: recording.content_type,
        fileType: recording.file_type,
      };

      // Add storage path with correct field name for each job type
      if (firstJobType === 'extract_audio') {
        jobPayload.videoPath = storagePath;
      } else if (firstJobType === 'transcribe') {
        jobPayload.audioPath = storagePath;
      } else if (firstJobType === 'extract_text_pdf') {
        jobPayload.pdfPath = storagePath;
      } else if (firstJobType === 'extract_text_docx') {
        jobPayload.docxPath = storagePath;
      } else if (firstJobType === 'process_text_note') {
        jobPayload.textPath = storagePath;
      }

      const { error: jobError } = await supabase.from('jobs').insert({
        type: firstJobType as any,
        status: 'pending',
        payload: jobPayload,
        run_at: new Date().toISOString(),
        dedupe_key: `${firstJobType}:${recordingId}`,
      });

      if (jobError) {
        logger.error('Failed to enqueue processing job', {
          context: { requestId, recordingId, jobType: firstJobType },
          error: jobError as Error,
        });
        return errors.internalError(requestId);
      }

      logger.info('Processing job enqueued', {
        context: { requestId, recordingId },
        data: { jobType: firstJobType },
      });

      // Update recording status based on job type
      let newStatus = 'uploaded';
      if (firstJobType === 'transcribe' || firstJobType === 'extract_audio' || firstJobType.startsWith('extract_text') || firstJobType === 'process_text_note') {
        newStatus = 'transcribing';
      }

      const { error: statusUpdateError } = await supabase
        .from('content')
        .update({ status: newStatus })
        .eq('id', recordingId);

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
      requestId
    );
  } catch (error: any) {
    logger.error('Metadata submission error', {
      context: { requestId, orgId, userId, recordingId },
      error: error as Error,
    });
    return errors.internalError(requestId);
  }
});

/**
 * GET not supported
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to submit metadata.');
});
