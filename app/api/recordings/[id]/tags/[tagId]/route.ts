import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * DELETE /api/recordings/[id]/tags/[tagId]
 * Remove a tag from a recording
 */
export const DELETE = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; tagId: string }> }
  ) => {
    const { orgId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id: recordingId, tagId } = await params;

    // Verify recording belongs to org
    const { data: recording } = await supabase
      .from('recordings')
      .select('id')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      return errors.notFound('Recording');
    }

    // Verify tag belongs to org
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tagId)
      .eq('org_id', orgId)
      .single();

    if (!tag) {
      return errors.notFound('Tag');
    }

    // Remove association
    const { error: deleteError } = await supabase
      .from('recording_tags')
      .delete()
      .eq('recording_id', recordingId)
      .eq('tag_id', tagId);

    if (deleteError) {
      console.error('[DELETE /tags] Error removing tag:', deleteError);
      return errors.internalError();
    }

    return successResponse({ success: true });
  }
);
