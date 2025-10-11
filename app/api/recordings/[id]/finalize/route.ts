import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/recordings/[id]/finalize - Finalize upload and start processing
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    // Use admin client to bypass RLS - auth already validated via requireOrg()
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Parse optional body parameters
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }
    const { startProcessing = true } = body;

    // Construct expected storage path
    const storagePath = `org_${orgId}/recordings/${id}/raw.webm`;

    // Verify the file exists in storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('recordings')
      .list(`org_${orgId}/recordings/${id}`);

    if (fileError || !fileData || fileData.length === 0) {
      return errors.badRequest('File not found in storage');
    }

    // Get file info
    const file = fileData.find(f => f.name === 'raw.webm');
    if (!file) {
      return errors.badRequest('raw.webm file not found');
    }

    // Update recording status and metadata
    const { data: recording, error: updateError } = await supabase
      .from('recordings')
      .update({
        storage_path_raw: storagePath,
        status: startProcessing ? 'uploaded' : 'uploaded',
        metadata: {
          sizeBytes: file.metadata?.size || 0,
          uploadedAt: new Date().toISOString(),
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
          storagePath,
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
  }
);
