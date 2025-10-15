import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createTextNoteSchema } from '@/lib/validations/library';
import type { JobType } from '@/lib/types/database';

/**
 * POST /api/library/text
 *
 * Create a new text note in the library.
 * Text notes are stored directly in the database and processed for embeddings.
 *
 * @route POST /api/library/text
 * @access Protected - Requires organization context
 *
 * @body {
 *   title: string;        // Note title (required, 1-200 chars)
 *   content: string;      // Note content (required, 1-500KB)
 *   format: 'plain' | 'markdown';  // Content format (default: 'plain')
 *   description?: string; // Optional description (max 2000 chars)
 *   metadata?: object;    // Optional metadata object
 * }
 *
 * @returns {
 *   id: string;
 *   title: string;
 *   content_type: 'text';
 *   file_type: 'txt' | 'md';
 *   status: string;
 *   created_at: string;
 * }
 *
 * @security
 *   - Validates input with Zod schema
 *   - Org-level data isolation via requireOrg()
 *   - Content size limited to 500KB
 *   - Rate limiting: Consider adding (50 notes/hour)
 *
 * @errors
 *   - 400: Validation error (invalid input)
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 500: Internal server error
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const requestId = generateRequestId();
  const { orgId, userId } = await requireOrg();

  // Parse and validate request body
  const body = await parseBody(request, createTextNoteSchema);

  try {
    const { title, content, format, description, metadata } = body;

    // Determine file type based on format
    const fileType = format === 'markdown' ? 'md' : 'txt';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/plain';

    // Calculate content size
    const contentSizeBytes = new TextEncoder().encode(content).length;

    // Create recording entry for the text note
    const { data: recording, error: dbError } = await supabaseAdmin
      .from('recordings')
      .insert({
        org_id: orgId,
        created_by: userId,
        title,
        description: description || null,
        status: 'uploaded', // Text notes skip upload phase
        content_type: 'text',
        file_type: fileType,
        original_filename: `${title}.${fileType}`,
        mime_type: mimeType,
        file_size: contentSizeBytes,
        metadata: {
          ...metadata,
          format,
          source: 'direct_creation',
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (dbError || !recording) {
      console.error('[Text Note] Database error:', dbError);
      return errors.internalError(requestId);
    }

    // Store content in transcript table (reusing existing structure)
    const { error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .insert({
        recording_id: recording.id,
        language: 'en', // Default to English for text notes
        text: content,
        confidence: 1.0, // Perfect confidence for user-created content
        provider: 'user_input',
      });

    if (transcriptError) {
      console.error('[Text Note] Transcript error:', transcriptError);

      // Clean up recording
      await supabaseAdmin
        .from('recordings')
        .delete()
        .eq('id', recording.id);

      return errors.internalError(requestId);
    }

    // Update recording status to transcribed
    await supabaseAdmin
      .from('recordings')
      .update({ status: 'transcribed' })
      .eq('id', recording.id);

    // Enqueue processing job for document generation
    await supabaseAdmin.from('jobs').insert({
      type: 'doc_generate' as JobType,
      status: 'pending',
      payload: {
        recordingId: recording.id,
        orgId,
        contentType: 'text',
        format,
      },
      run_at: new Date().toISOString(),
    });

    // Update status to indicate doc generation in progress
    await supabaseAdmin
      .from('recordings')
      .update({ status: 'doc_generating' })
      .eq('id', recording.id);

    return successResponse(
      {
        id: recording.id,
        title: recording.title,
        content_type: recording.content_type,
        file_type: recording.file_type,
        status: 'doc_generating',
        file_size: contentSizeBytes,
        created_at: recording.created_at,
      },
      requestId,
      201
    );
  } catch (error: any) {
    console.error('[Text Note] Request error:', error);

    // Check if it's a validation error
    if (error.message?.includes('Invalid request body')) {
      return errors.validationError(error.message, requestId);
    }

    return errors.internalError(requestId);
  }
});

/**
 * GET /api/library/text
 *
 * Not implemented - use /api/library to list all content including text notes
 */
export const GET = apiHandler(async () => {
  return errors.badRequest('Method not allowed. Use GET /api/library to list content.');
});
