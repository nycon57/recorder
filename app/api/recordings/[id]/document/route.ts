import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateDocumentMarkdownSchema } from '@/lib/validations/api';

/**
 * GET /api/recordings/[id]/document
 * Retrieves the document for a recording
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
      console.error('[GET /document] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Fetch document
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('recording_id', id)
      .eq('org_id', orgId)
      .single();

    if (documentError) {
      if (documentError.code === 'PGRST116') {
        // No document found - not an error if recording is still processing
        return successResponse({
          document: null,
          message: 'Document not yet available',
        });
      }
      console.error('[GET /document] Error fetching document:', documentError);
      return errors.internalError();
    }

    return successResponse({
      document: {
        id: document.id,
        recordingId: document.recording_id,
        orgId: document.org_id,
        markdown: document.markdown,
        html: document.html,
        summary: document.summary,
        version: document.version,
        model: document.model,
        isPublished: document.is_published,
        status: document.status,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      },
    });
  }
);

/**
 * PUT /api/recordings/[id]/document
 * Updates the document markdown for a recording
 * Used for manual edits to the AI-generated document
 *
 * Optional: Set refreshEmbeddings=true to automatically update vectors after edit
 */
export const PUT = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Validate request body
    const body = await parseBody(request, updateDocumentMarkdownSchema);
    const refreshEmbeddings = body.refreshEmbeddings ?? false;

    // Verify recording belongs to org
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      console.error('[PUT /document] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Check if document exists
    const { data: existingDocument, error: checkError } = await supabase
      .from('documents')
      .select('id, version')
      .eq('recording_id', id)
      .eq('org_id', orgId)
      .single();

    if (checkError || !existingDocument) {
      console.error('[PUT /document] Document not found:', checkError);
      return errors.notFound('Document');
    }

    // Increment version (format: v1, v2, v3, etc.)
    const currentVersion = existingDocument.version || 'v0';
    const versionNumber = parseInt(currentVersion.replace('v', '')) || 0;
    const newVersion = `v${versionNumber + 1}`;

    // Update document markdown and mark as edited
    const { data: document, error: updateError } = await supabase
      .from('documents')
      .update({
        markdown: body.markdown,
        html: null, // Clear HTML cache - can be regenerated if needed
        version: newVersion,
        status: 'edited',
        needs_embeddings_refresh: !refreshEmbeddings, // Mark stale if not auto-refreshing
        updated_at: new Date().toISOString(),
      })
      .eq('recording_id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError) {
      console.error('[PUT /document] Error updating document:', updateError);
      return errors.internalError();
    }

    console.log(`[PUT /document] Document updated for recording ${id} by user ${userId} (${newVersion})`);

    // If refreshEmbeddings=true, automatically enqueue embeddings refresh
    let jobId = null;
    if (refreshEmbeddings) {
      // Get transcript ID
      const { data: transcript } = await supabase
        .from('transcripts')
        .select('id')
        .eq('recording_id', id)
        .eq('superseded', false)
        .single();

      if (transcript) {
        // Delete existing chunks (they're now stale)
        await supabase
          .from('transcript_chunks')
          .delete()
          .eq('recording_id', id);

        // Enqueue embeddings job
        const { data: job } = await supabase
          .from('jobs')
          .insert({
            type: 'generate_embeddings',
            status: 'pending',
            payload: {
              recordingId: id,
              transcriptId: transcript.id,
              documentId: existingDocument.id,
              orgId,
            },
            dedupe_key: `generate_embeddings:${id}:${Date.now()}`,
          })
          .select('id')
          .single();

        jobId = job?.id;
        console.log(`[PUT /document] Auto-enqueued embeddings refresh job ${jobId} for recording ${id}`);
      }
    }

    return successResponse({
      document: {
        id: document.id,
        recordingId: document.recording_id,
        orgId: document.org_id,
        markdown: document.markdown,
        html: document.html,
        summary: document.summary,
        version: document.version,
        model: document.model,
        isPublished: document.is_published,
        status: document.status,
        needsEmbeddingsRefresh: document.needs_embeddings_refresh,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      },
      message: refreshEmbeddings
        ? 'Document updated and embeddings refresh queued'
        : 'Document updated successfully',
      embeddingsJobId: jobId,
    });
  }
);

/**
 * POST /api/recordings/[id]/document
 * Triggers regeneration of document with AI
 * Enqueues a new doc_generate job
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    // Verify recording belongs to org and has a transcript
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, org_id, status')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      console.error('[POST /document] Recording not found:', recordingError);
      return errors.notFound('Recording');
    }

    // Check if transcript exists (required for document generation)
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('id')
      .eq('recording_id', id)
      .single();

    if (transcriptError || !transcript) {
      return errors.badRequest(
        'Cannot regenerate document: Recording must be transcribed first'
      );
    }

    // Check if document already exists
    const { data: existingDocument } = await supabase
      .from('documents')
      .select('id')
      .eq('recording_id', id)
      .eq('org_id', orgId)
      .single();

    if (existingDocument) {
      // Update existing document status to generating
      await supabase
        .from('documents')
        .update({
          status: 'generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDocument.id);
    }

    // Enqueue document generation job
    const dedupeKey = `doc_generate:${id}:${Date.now()}`;
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        type: 'doc_generate',
        status: 'pending',
        payload: {
          recordingId: id,
          transcriptId: transcript.id,
          orgId,
        },
        dedupe_key: dedupeKey,
      })
      .select()
      .single();

    if (jobError) {
      console.error('[POST /document] Error creating job:', jobError);
      return errors.internalError();
    }

    console.log(`[POST /document] Document regeneration job created for recording ${id} by user ${userId}`);

    return successResponse(
      {
        message: 'Document regeneration started',
        jobId: job.id,
        status: 'Document will be regenerated shortly',
      },
      undefined,
      202 // Accepted
    );
  }
);
