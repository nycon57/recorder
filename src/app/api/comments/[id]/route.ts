import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment is too long (max 5000 characters)'),
});

type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

interface RouteParams {
  params: {
    id: string;
  };
}

// ============================================================================
// PATCH /api/comments/[id] - Update a comment
// ============================================================================

/**
 * PATCH /api/comments/[id]
 *
 * Body:
 * - text: Updated comment text (1-5000 characters)
 *
 * Returns:
 * - comment: Updated comment
 */
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const { userId, orgId } = await requireOrg();
    const commentId = params.id;

    // Validate UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commentId)) {
      throw errors.badRequest('Invalid comment ID');
    }

    const body = await parseBody<UpdateCommentInput>(request, updateCommentSchema);
    const supabase = await createClient();

    // Fetch the comment and verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('id, user_id, org_id, text')
      .eq('id', commentId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingComment) {
      throw errors.notFound('Comment not found');
    }

    // Verify the user owns this comment
    if (existingComment.user_id !== userId) {
      throw errors.forbidden('You can only edit your own comments');
    }

    // Check if text actually changed
    if (existingComment.text === body.text) {
      return successResponse({ comment: existingComment });
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({
        text: body.text,
        edited: true,
      })
      .eq('id', commentId)
      .select('*')
      .single();

    if (updateError || !updatedComment) {
      console.error('[PATCH /api/comments/[id]] Update error:', updateError);
      return errors.internalError();
    }

    return successResponse({ comment: updatedComment });
  }
);

// ============================================================================
// DELETE /api/comments/[id] - Soft-delete a comment
// ============================================================================

/**
 * DELETE /api/comments/[id]
 *
 * Soft-deletes a comment by setting deleted_at timestamp.
 * Only the comment author can delete their own comment.
 *
 * Returns:
 * - success: true
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: RouteParams) => {
    const { userId, orgId } = await requireOrg();
    const commentId = params.id;

    // Validate UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(commentId)) {
      throw errors.badRequest('Invalid comment ID');
    }

    const supabase = await createClient();

    // Fetch the comment and verify ownership
    const { data: existingComment, error: fetchError } = await supabase
      .from('comments')
      .select('id, user_id, org_id')
      .eq('id', commentId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingComment) {
      throw errors.notFound('Comment not found');
    }

    // Verify the user owns this comment
    if (existingComment.user_id !== userId) {
      throw errors.forbidden('You can only delete your own comments');
    }

    // Soft-delete the comment
    const { error: deleteError } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);

    if (deleteError) {
      console.error('[DELETE /api/comments/[id]] Delete error:', deleteError);
      return errors.internalError();
    }

    return successResponse({ success: true });
  }
);
