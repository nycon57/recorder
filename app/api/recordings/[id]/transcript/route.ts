import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateTranscriptSchema } from '@/lib/validations/api';

/**
 * GET /api/recordings/[id]/transcript
 * Retrieves the transcript for a recording
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Verify recording belongs to org
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id, status')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      console.error('[GET /transcript] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('recording_id', id)
      .single();

    if (transcriptError) {
      if (transcriptError.code === 'PGRST116') {
        // No transcript found - not an error if recording is still processing
        return successResponse({
          transcript: null,
          message: 'Transcript not yet available',
        });
      }
      console.error('[GET /transcript] Error fetching transcript:', transcriptError);
      return errors.internalError();
    }

    return successResponse({
      transcript: {
        id: transcript.id,
        recordingId: transcript.recording_id,
        text: transcript.text,
        language: transcript.language,
        wordsJson: transcript.words_json,
        confidence: transcript.confidence,
        provider: transcript.provider,
        createdAt: transcript.created_at,
        updatedAt: transcript.updated_at,
      },
    });
  }
);

/**
 * PUT /api/recordings/[id]/transcript
 * Updates the transcript text for a recording
 * Used for manual corrections to the AI-generated transcript
 */
export const PUT = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Validate request body
    const body = await parseBody(request, updateTranscriptSchema);

    // Verify recording belongs to org
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      console.error('[PUT /transcript] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Check if transcript exists
    const { data: existingTranscript, error: checkError } = await supabase
      .from('transcripts')
      .select('id')
      .eq('recording_id', id)
      .single();

    if (checkError || !existingTranscript) {
      console.error('[PUT /transcript] Transcript not found:', checkError);
      return errors.notFound('Transcript');
    }

    // Update transcript text
    const { data: transcript, error: updateError } = await supabase
      .from('transcripts')
      .update({
        text: body.text,
        updated_at: new Date().toISOString(),
      })
      .eq('recording_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PUT /transcript] Error updating transcript:', updateError);
      return errors.internalError();
    }

    console.log(`[PUT /transcript] Transcript updated for recording ${id} by user ${userId}`);

    return successResponse({
      transcript: {
        id: transcript.id,
        recordingId: transcript.recording_id,
        text: transcript.text,
        language: transcript.language,
        wordsJson: transcript.words_json,
        confidence: transcript.confidence,
        provider: transcript.provider,
        createdAt: transcript.created_at,
        updatedAt: transcript.updated_at,
      },
      message: 'Transcript updated successfully',
    });
  }
);
