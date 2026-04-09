import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/recordings/[id]/tags
 * Get all tags for a recording
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id: recordingId } = await params;

    // Verify recording belongs to org
    const { data: recording } = await supabase
      .from('content')
      .select('id')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      return errors.notFound('Recording');
    }

    // Fetch tags for this content
    const { data: recordingTags, error: fetchError } = await supabase
      .from('content_tags')
      .select(`
        tag_id,
        tags (
          id,
          name,
          color,
          created_at,
          updated_at
        )
      `)
      .eq('content_id', recordingId);

    if (fetchError) {
      console.error('[GET /tags] Error fetching tags:', fetchError);
      return errors.internalError();
    }

    // Extract tags from the joined data
    const tags = recordingTags
      .map((rt: any) => rt.tags)
      .filter(Boolean);

    return successResponse({ tags });
  }
);

/**
 * POST /api/recordings/[id]/tags
 * Add a tag to a recording (creates tag if doesn't exist)
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const supabase = supabaseAdmin;
    const { id: recordingId } = await params;

    const body = await request.json();
    const { name, color = '#3b82f6' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errors.badRequest('Tag name is required');
    }

    const tagName = name.trim();

    // Verify content belongs to org
    const { data: recording } = await supabase
      .from('content')
      .select('id')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (!recording) {
      return errors.notFound('Recording');
    }

    // Check if tag already exists for this org
    const { data: existingTag } = await supabase
      .from('tags')
      .select('*')
      .eq('org_id', orgId)
      .eq('name', tagName)
      .single();

    let tag = existingTag;

    // Create tag if it doesn't exist
    if (!existingTag) {
      const { data: newTag, error: createError } = await supabase
        .from('tags')
        .insert({
          org_id: orgId,
          name: tagName,
          color: color,
        })
        .select()
        .single();

      if (createError) {
        console.error('[POST /tags] Error creating tag:', createError);
        return errors.internalError();
      }

      tag = newTag;
    }

    // Check if tag is already associated with content
    const { data: existingAssociation } = await supabase
      .from('content_tags')
      .select('*')
      .eq('content_id', recordingId)
      .eq('tag_id', tag!.id)
      .single();

    if (existingAssociation) {
      return successResponse({ tag });
    }

    // Associate tag with content
    const { error: associateError } = await supabase
      .from('content_tags')
      .insert({
        content_id: recordingId,
        tag_id: tag!.id,
      });

    if (associateError) {
      console.error('[POST /tags] Error associating tag:', associateError);
      return errors.internalError();
    }

    return successResponse({ tag });
  }
);
