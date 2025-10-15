import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reprocessRecordingSchema } from '@/lib/validations/api';

/**
 * POST /api/recordings/[id]/reprocess
 * Triggers reprocessing of a recording at various stages
 * Supports: transcribe, document, embeddings, or all
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Validate request body
    const body = await parseBody(request, reprocessRecordingSchema);
    const { step } = body;

    // Verify recording belongs to org
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id, status, storage_path_raw')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      console.error('[POST /reprocess] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Verify recording has been uploaded
    if (!recording.storage_path_raw) {
      return errors.badRequest('Recording has not been uploaded yet');
    }

    const jobs: { type: string; payload: any; dedupe_key: string }[] = [];
    const timestamp = Date.now();

    // Determine which jobs to enqueue based on step
    if (step === 'transcribe' || step === 'all') {
      // Delete existing transcript if reprocessing transcription
      const { error: deleteTranscriptError } = await supabase
        .from('transcripts')
        .delete()
        .eq('recording_id', id);

      if (deleteTranscriptError) {
        console.error('[POST /reprocess] Error deleting transcript:', deleteTranscriptError);
        // Non-fatal, continue with job creation
      }

      jobs.push({
        type: 'transcribe',
        payload: {
          recordingId: id,
          orgId,
          storagePath: recording.storage_path_raw,
          userId,
        },
        dedupe_key: `transcribe:${id}:${timestamp}`,
      });

      // Update recording status
      await supabase
        .from('recordings')
        .update({
          status: 'uploaded',
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    if (step === 'document' || step === 'all') {
      // Verify transcript exists (required for document generation)
      const { data: transcript } = await supabase
        .from('transcripts')
        .select('id')
        .eq('recording_id', id)
        .single();

      if (!transcript && step === 'document') {
        return errors.badRequest(
          'Cannot regenerate document: Recording must be transcribed first'
        );
      }

      if (transcript) {
        // Update existing document status if it exists
        await supabase
          .from('documents')
          .update({
            status: 'generating',
            updated_at: new Date().toISOString(),
          })
          .eq('recording_id', id);

        jobs.push({
          type: 'doc_generate',
          payload: {
            recordingId: id,
            transcriptId: transcript.id,
            orgId,
          },
          dedupe_key: `doc_generate:${id}:${timestamp}`,
        });
      }
    }

    if (step === 'embeddings' || step === 'all') {
      // Verify transcript and document exist (both required for embeddings)
      const { data: transcript } = await supabase
        .from('transcripts')
        .select('id')
        .eq('recording_id', id)
        .single();

      const { data: document } = await supabase
        .from('documents')
        .select('id')
        .eq('recording_id', id)
        .eq('org_id', orgId)
        .single();

      if (!transcript && step === 'embeddings') {
        return errors.badRequest(
          'Cannot regenerate embeddings: Recording must be transcribed first'
        );
      }

      if (!document && step === 'embeddings') {
        return errors.badRequest(
          'Cannot regenerate embeddings: Document must be generated first'
        );
      }

      if (transcript && document) {
        // Delete existing embeddings
        const { error: deleteChunksError } = await supabase
          .from('transcript_chunks')
          .delete()
          .eq('recording_id', id);

        if (deleteChunksError) {
          console.error('[POST /reprocess] Error deleting chunks:', deleteChunksError);
          // Non-fatal, continue with job creation
        }

        jobs.push({
          type: 'generate_embeddings',
          payload: {
            recordingId: id,
            transcriptId: transcript.id,
            documentId: document.id,
            orgId,
          },
          dedupe_key: `generate_embeddings:${id}:${timestamp}`,
        });
      }
    }

    // Enqueue all jobs
    if (jobs.length === 0) {
      return errors.badRequest('No jobs to enqueue. Recording may not be ready for reprocessing.');
    }

    const { data: createdJobs, error: jobError } = await supabase
      .from('jobs')
      .insert(
        jobs.map(job => ({
          type: job.type,
          status: 'pending' as const,
          payload: job.payload,
          dedupe_key: job.dedupe_key,
        }))
      )
      .select();

    if (jobError) {
      console.error('[POST /reprocess] Error creating jobs:', jobError);
      return errors.internalError();
    }

    console.log(
      `[POST /reprocess] Reprocessing ${step} for recording ${id} by user ${userId}. Created ${createdJobs?.length} job(s).`
    );

    return successResponse(
      {
        message: `Reprocessing started: ${step}`,
        jobs: createdJobs?.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
        })),
        step,
        recordingId: id,
      },
      undefined,
      202 // Accepted
    );
  }
);
