import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';

// POST /api/recordings/[id]/finalize - Finalize upload and start processing
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { orgId } = await requireOrg();
    const supabase = await createClient();
    const { id } = params;

    const body = await request.json();
    const { storagePath, sizeBytes, sha256, durationSec } = body;

    // Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('recordings')
      .list(`org_${orgId}/recordings/${id}`);

    if (fileError || !fileData || fileData.length === 0) {
      return errors.badRequest('File not found in storage');
    }

    // Update recording status and metadata
    const { data: recording, error: updateError } = await supabase
      .from('recordings')
      .update({
        storage_path_raw: storagePath,
        status: 'uploaded',
        duration_sec: durationSec || null,
        metadata: {
          sizeBytes,
          sha256,
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

    // Enqueue transcription job
    const { error: jobError } = await supabase.from('jobs').insert({
      type: 'transcribe',
      status: 'queued',
      payload: {
        recordingId: id,
        orgId,
        storagePath,
      },
      dedupe_key: `transcribe:${id}`,
    });

    if (jobError) {
      console.error('Error enqueueing transcription job:', jobError);
      // Don't fail the request, job can be retried
    }

    return successResponse({
      recording,
      message: 'Upload finalized. Transcription will begin shortly.',
    });
  }
);
