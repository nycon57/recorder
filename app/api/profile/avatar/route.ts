import { NextRequest } from 'next/server';
import sharp from 'sharp';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/profile/avatar
 *
 * Upload and set user avatar image
 *
 * Flow:
 * 1. Accept multipart/form-data with image file
 * 2. Validate file type and size
 * 3. Resize and optimize image to max 500x500px
 * 4. Upload to Supabase Storage (avatars bucket)
 * 5. Update users.avatar_url
 * 6. Return new avatar URL
 *
 * @formdata file - Avatar image file (JPEG, PNG, WebP, or GIF)
 *
 * @returns { avatarUrl: string }
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Use admin client to bypass RLS
  const supabase = supabaseAdmin;

  // Get user to retrieve org_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[POST /api/profile/avatar] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return errors.badRequest('No file provided');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return errors.badRequest('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return errors.badRequest('File size exceeds 5MB limit');
  }

  try {
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Resize and optimize image to 500x500px, convert to WebP for better compression
    const processedImage = await sharp(buffer)
      .resize(500, 500, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate storage path
    const fileName = `${user.id}-${Date.now()}.webp`;
    const storagePath = `org_${user.org_id}/avatars/${fileName}`;

    // Upload to Supabase Storage (avatars bucket)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, processedImage, {
        contentType: 'image/webp',
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error('[POST /api/profile/avatar] Upload error:', uploadError);
      return errors.internalError();
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Update user's avatar_url in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[POST /api/profile/avatar] Error updating avatar_url:', updateError);
      return errors.internalError();
    }

    return successResponse({ avatarUrl }, undefined, 201);
  } catch (error) {
    console.error('[POST /api/profile/avatar] Processing error:', error);
    return errors.internalError();
  }
});

/**
 * DELETE /api/profile/avatar
 *
 * Remove user avatar
 *
 * @returns { success: boolean }
 */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Use admin client to bypass RLS
  const supabase = supabaseAdmin;

  // Update user's avatar_url to null
  const { error: updateError } = await supabase
    .from('users')
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_id', userId);

  if (updateError) {
    console.error('[DELETE /api/profile/avatar] Error removing avatar:', updateError);
    return errors.internalError();
  }

  return successResponse({ success: true });
});
