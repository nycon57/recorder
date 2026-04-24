import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
} from '@/lib/utils/status-helpers';
import {
  LEGACY_RECORDING_STORAGE_BUCKET,
  buildLegacyRecordingStoragePath,
  findExactStorageObject,
  inferRecordingStorageBucket,
  validateRecordingStoragePath,
} from '@/lib/recordings/storage-contract';
import type {
  ContentType,
  FileType,
} from '@/lib/types/content';
import type { Json } from '@/lib/types/database';

const finalizeSchema = z
  .object({
    storagePath: z.string().min(1).optional(),
    storageBucket: z.enum(['content', 'recordings']).optional(),
    startProcessing: z.boolean().optional().default(true),
  })
  .passthrough();

// POST /api/recordings/[id]/finalize - Finalize upload and start processing
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { orgId } = await requireOrg();
    // Use admin client to bypass RLS - auth already validated via requireOrg()
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Parse optional body parameters
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const bodyResult = finalizeSchema.safeParse(body);
    if (!bodyResult.success) {
      return errors.badRequest('Invalid request data', {
        errors: bodyResult.error.issues,
      });
    }

    const {
      storagePath: providedStoragePath,
      storageBucket: providedStorageBucket,
      startProcessing,
    } = bodyResult.data;

    // Verify content exists and belongs to org before accepting any storage path.
    const { data: existingRecording, error: fetchError } = await supabase
      .from('content')
      .select('id, org_id, metadata, content_type, file_type')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existingRecording) {
      return errors.notFound('Recording');
    }

    const storagePath =
      providedStoragePath || buildLegacyRecordingStoragePath(orgId, id);

    const storageBucket = providedStoragePath
      ? inferRecordingStorageBucket({
          storagePath,
          storageBucket: providedStorageBucket,
          orgId,
          recordingId: id,
        })
      : LEGACY_RECORDING_STORAGE_BUCKET;

    const storageValidation = validateRecordingStoragePath({
      storagePath,
      bucket: storageBucket,
      orgId,
      recordingId: id,
      contentType: existingRecording.content_type as ContentType | null,
      fileType: existingRecording.file_type as FileType | null,
      allowLegacyRecordingsBucket: true,
    });

    if (!storageValidation.valid) {
      return errors.badRequest(
        storageValidation.message,
        storageValidation.details,
      );
    }

    // Verify the file exists in storage
    const fileData = await findExactStorageObject(
      supabase,
      storageValidation.bucket,
      storageValidation.storagePath,
    );

    if (!fileData.exists) {
      return errors.badRequest('File not found in storage');
    }

    const existingMetadata =
      typeof existingRecording.metadata === 'object' &&
      existingRecording.metadata !== null &&
      !Array.isArray(existingRecording.metadata)
        ? (existingRecording.metadata as { [key: string]: Json | undefined })
        : {};
    const storageObjectSize = fileData.object?.metadata?.size;
    const sizeBytes =
      typeof storageObjectSize === 'number' ? storageObjectSize : 0;

    // Update content status and metadata
    const queuedStatus = startProcessing
      ? getQueuedSourceStatusForJob('transcribe')
      : null;

    const { data: recording, error: updateError } = await supabase
      .from('content')
      .update({
        storage_path_raw: storageValidation.storagePath,
        status: queuedStatus ?? SOURCE_STATUS.UPLOADED,
        metadata: {
          ...existingMetadata,
          sizeBytes,
          uploadedAt: new Date().toISOString(),
          storageBucket: storageValidation.bucket,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError || !recording) {
      console.error('Error finalizing recording:', updateError);
      return errors.internalError();
    }

    // Optionally enqueue transcription job
    if (startProcessing) {
      const { error: jobError } = await supabase.from('jobs').insert({
        type: 'transcribe',
        status: 'pending',
        payload: {
          recordingId: id,
          orgId,
          storagePath: storageValidation.storagePath,
          storageBucket: storageValidation.bucket,
          contentType: existingRecording.content_type,
          fileType: existingRecording.file_type,
        },
        dedupe_key: `transcribe:${id}`,
      });

      if (jobError) {
        console.error('Error enqueueing transcription job:', jobError);
        // Don't fail the request, job can be retried
      }
    }

    return successResponse({
      recording,
      message: startProcessing
        ? 'Upload finalized. Transcription will begin shortly.'
        : 'Upload finalized.',
    });
  },
);
