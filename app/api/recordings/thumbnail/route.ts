import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

const thumbnailSchema = z.object({
  recordingId: z.string().uuid(),
  thumbnailData: z.string(), // Base64 encoded image data
  mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

/**
 * POST /api/recordings/thumbnail
 * Upload a thumbnail for a recording
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const supabase = supabaseAdmin;

  // Parse and validate request body
  let body;
  try {
    const rawBody = await request.json();
    body = thumbnailSchema.parse(rawBody);
  } catch (error: any) {
    return errors.validationError(error.message);
  }

  const { recordingId, thumbnailData, mimeType } = body;

  // Verify recording exists and belongs to the user's organization
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('id, org_id')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    return errors.notFound('Recording', undefined);
  }

  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(thumbnailData, 'base64');

    // Determine file extension from mime type
    const ext = mimeType.split('/')[1];
    const filename = `thumbnail.${ext}`;
    const storagePath = `org_${orgId}/recordings/${recordingId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true, // Allow overwriting existing thumbnails
      });

    if (uploadError) {
      console.error('[Thumbnail Upload] Storage error:', uploadError);
      return errors.internalError();
    }

    // Get the public URL for the thumbnail
    const { data: urlData } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(storagePath);

    const thumbnailUrl = urlData.publicUrl;

    // Update the recording with the thumbnail URL
    const { error: updateError } = await supabase
      .from('recordings')
      .update({
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('[Thumbnail Upload] Database update error:', updateError);
      // Don't fail the request - thumbnail was uploaded successfully
    }

    console.log('[Thumbnail Upload] Success:', {
      recordingId,
      storagePath,
      thumbnailUrl,
    });

    return successResponse({
      thumbnailUrl,
      storagePath,
    });
  } catch (error) {
    console.error('[Thumbnail Upload] Unexpected error:', error);
    return errors.internalError();
  }
});
