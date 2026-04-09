/**
 * POST /api/recordings/[id]/restore
 *
 * Restore a soft-deleted recording from trash
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/recordings/[id]/restore - Restore a soft-deleted recording
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId, userId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id } = await params;

    console.log('[RESTORE Recording] Attempting to restore:', { id, orgId, userId });

    // Check if recording exists, belongs to org, and is soft-deleted
    const { data: recording, error: fetchError } = await supabase
      .from('content')
      .select('id, deleted_at, title')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      console.log('[RESTORE Recording] Recording not found');
      return errors.notFound('Recording');
    }

    // Check if recording is actually deleted
    if (!recording.deleted_at) {
      return errors.badRequest('Recording is not deleted and cannot be restored');
    }

    // Restore the recording by clearing soft delete fields
    const { error } = await supabase
      .from('content')
      .update({
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      })
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[RESTORE Recording] Error restoring:', error);
      return errors.internalError();
    }

    console.log('[RESTORE Recording] Successfully restored:', id);
    return successResponse({
      success: true,
      message: `"${recording.title}" has been restored`,
      recordingId: id
    });
  }
);

/**
 * GET not supported
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use POST to restore a recording.');
});
