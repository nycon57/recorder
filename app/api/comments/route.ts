import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  parseSearchParams,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';
import type { CommentWithUser } from '@/lib/types/database';

// ============================================================================
// Validation Schemas
// ============================================================================

const createCommentSchema = z.object({
  recording_id: z.string().uuid('Invalid recording ID'),
  text: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment is too long (max 5000 characters)'),
  timestamp_sec: z.number().min(0, 'Timestamp must be >= 0').optional(),
  parent_id: z.string().uuid('Invalid parent comment ID').optional(),
});

const listCommentsQuerySchema = z.object({
  recording_id: z.string().uuid('Invalid recording ID'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type CreateCommentInput = z.infer<typeof createCommentSchema>;
type ListCommentsQueryInput = z.infer<typeof listCommentsQuerySchema>;

// ============================================================================
// GET /api/comments - List comments for a recording
// ============================================================================

/**
 * GET /api/comments
 *
 * Query params:
 * - recording_id: UUID of the recording
 * - limit: Number of results (default 100, max 200)
 * - offset: Pagination offset (default 0)
 *
 * Returns:
 * - comments: Array of comments with user details
 * - pagination: { limit, offset, total }
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const query = parseSearchParams<ListCommentsQueryInput>(
    request,
    listCommentsQuerySchema
  );

  const supabase = await createClient();

  // Verify user has access to the recording
  const { data: recording, error: recordingError } = await supabase
    .from('content')
    .select('id')
    .eq('id', query.recording_id)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw errors.notFound('Recording not found');
  }

  // Fetch comments using the database function (includes user details)
  const { data: comments, error: commentsError } = await supabase.rpc(
    'get_comments_with_users',
    {
      p_recording_id: query.recording_id,
      p_org_id: orgId,
      p_limit: query.limit,
      p_offset: query.offset,
    }
  );

  if (commentsError) {
    console.error('[GET /api/comments] Database error:', commentsError);
    return errors.internalError();
  }

  // Get total count for pagination
  const { count, error: countError } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('content_id', query.recording_id)
    .is('deleted_at', null);

  if (countError) {
    console.error('[GET /api/comments] Count error:', countError);
    return errors.internalError();
  }

  return successResponse({
    comments: (comments || []) as CommentWithUser[],
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count || 0,
    },
  });
});

// ============================================================================
// POST /api/comments - Create a new comment
// ============================================================================

/**
 * POST /api/comments
 *
 * Body:
 * - recording_id: UUID of the recording
 * - text: Comment text (1-5000 characters)
 * - timestamp_sec: Optional timestamp in seconds (for video/audio)
 * - parent_id: Optional parent comment ID (for threaded replies)
 *
 * Returns:
 * - comment: Created comment with user details
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId, orgId } = await requireOrg();
  const body = await parseBody<CreateCommentInput>(request, createCommentSchema);

  const supabase = await createClient();

  // Verify user has access to the recording
  const { data: recording, error: recordingError } = await supabase
    .from('content')
    .select('id, content_type')
    .eq('id', body.recording_id)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw errors.notFound('Recording not found');
  }

  // Validate timestamp only for video/audio content
  const isMediaContent = ['recording', 'video', 'audio'].includes(
    recording.content_type || ''
  );

  if (body.timestamp_sec !== undefined && !isMediaContent) {
    throw errors.badRequest(
      'Timestamps are only supported for video and audio content'
    );
  }

  // If parent_id is provided, verify the parent comment exists
  if (body.parent_id) {
    const { data: parentComment, error: parentError } = await supabase
      .from('comments')
      .select('id, recording_id')
      .eq('id', body.parent_id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (parentError || !parentComment) {
      throw errors.notFound('Parent comment not found');
    }

    if (parentComment.recording_id !== body.recording_id) {
      throw errors.badRequest('Parent comment must be on the same recording');
    }
  }

  // Create the comment
  const { data: newComment, error: insertError } = await supabase
    .from('comments')
    .insert({
      recording_id: body.recording_id,
      user_id: userId,
      org_id: orgId,
      text: body.text,
      timestamp_sec: body.timestamp_sec || null,
      parent_id: body.parent_id || null,
    })
    .select('*')
    .single();

  if (insertError || !newComment) {
    console.error('[POST /api/comments] Insert error:', insertError);
    return errors.internalError();
  }

  // Fetch the comment with user details
  const { data: commentWithUser, error: fetchError } = await supabase.rpc(
    'get_comments_with_users',
    {
      p_recording_id: body.recording_id,
      p_org_id: orgId,
      p_limit: 1,
      p_offset: 0,
    }
  );

  if (fetchError || !commentWithUser || commentWithUser.length === 0) {
    console.error('[POST /api/comments] Fetch error:', fetchError);
    // Return the comment without user details as fallback
    return successResponse({ comment: newComment }, undefined, 201);
  }

  // Find the created comment in the results
  const createdComment = (commentWithUser as CommentWithUser[]).find(
    (c) => c.id === newComment.id
  );

  return successResponse(
    { comment: createdComment || newComment },
    undefined,
    201
  );
});
