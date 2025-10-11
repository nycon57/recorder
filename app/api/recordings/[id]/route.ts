import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/recordings/[id] - Get a specific recording
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = await createClient();
    const { id } = await params;

    // Fetch recording with related data
    const { data: recording, error } = await supabase
      .from('recordings')
      .select(
        `
      *,
      transcripts (*),
      documents (*)
    `
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !recording) {
      return errors.notFound('Recording');
    }

    // Generate signed video URLs if available
    // Prefer processed (MP4) for playback, fallback to raw (WEBM)
    let videoUrl = null;
    let downloadUrl = null;

    // Use processed version if available (MP4)
    if (recording.storage_path_processed) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(recording.storage_path_processed, 3600); // 1 hour expiry

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl; // Prefer MP4 for download
    }

    // Fallback to raw version (WEBM)
    if (!videoUrl && recording.storage_path_raw) {
      const { data: urlData } = await supabase.storage
        .from('recordings')
        .createSignedUrl(recording.storage_path_raw, 3600); // 1 hour expiry

      videoUrl = urlData?.signedUrl || null;
      downloadUrl = videoUrl;
    }

    return successResponse({
      ...recording,
      videoUrl,
      downloadUrl,
    });
  }
);

// PUT /api/recordings/[id] - Update a recording
export const PUT = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = await createClient();
    const { id } = await params;

    const body = await request.json();
    const { title, description, metadata } = body;

    // Update recording
    const { data: recording, error } = await supabase
      .from('recordings')
      .update({
        title,
        description,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !recording) {
      return errors.notFound('Recording');
    }

    return successResponse(recording);
  }
);

// DELETE /api/recordings/[id] - Delete a recording
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    // Use admin client to bypass RLS - auth already validated via requireOrg()
    const supabase = supabaseAdmin;
    const { id } = await params;

    console.log('[DELETE Recording] Attempting to delete:', { id, orgId });

    // Check if recording exists and belongs to org
    const { data: recording, error: fetchError } = await supabase
      .from('recordings')
      .select('storage_path_raw, storage_path_processed')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    console.log('[DELETE Recording] Query result:', { recording, fetchError });

    if (!recording) {
      console.log('[DELETE Recording] Recording not found');
      return errors.notFound('Recording');
    }

    // Delete storage files
    const filesToDelete = [
      recording.storage_path_raw,
      recording.storage_path_processed,
    ].filter(Boolean);

    if (filesToDelete.length > 0) {
      await supabase.storage.from('recordings').remove(filesToDelete);
    }

    // Delete database record (cascades to transcripts, documents, chunks)
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('Error deleting recording:', error);
      return errors.internalError();
    }

    console.log('[DELETE Recording] Successfully deleted recording:', id);
    return successResponse({ success: true, message: 'Recording deleted successfully' });
  }
);
