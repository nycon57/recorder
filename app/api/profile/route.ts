import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { updateProfileSchema } from '@/lib/validations/api';
import { rateLimit, RateLimitTier, extractUserIdFromAuth } from '@/lib/middleware/rate-limit';

/**
 * GET /api/profile
 *
 * Fetch current user profile from Supabase users table
 *
 * @returns User profile data excluding sensitive fields
 *
 * @security Rate limited to 100 requests per minute per user
 */
export const GET = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Use admin client to bypass RLS - auth already validated
  const supabase = supabaseAdmin;

  // Fetch user profile by Clerk ID
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      email,
      name,
      avatar_url,
      title,
      bio,
      phone,
      timezone,
      org_id,
      role,
      status,
      last_login_at,
      last_active_at,
      login_count,
      notification_preferences,
      ui_preferences,
      created_at,
      updated_at,
      onboarded_at
    `)
    .eq('clerk_id', userId)
    .single();

  if (error || !user) {
    console.error('[GET /api/profile] Error fetching user:', error);
    return errors.notFound('User profile');
  }

  return successResponse(user);
}));

/**
 * PATCH /api/profile
 *
 * Update current user profile
 *
 * @body name - User's full name
 * @body title - Job title/position
 * @body bio - User biography/description
 * @body phone - Phone number
 * @body timezone - User timezone
 * @body notification_preferences - Notification settings
 * @body ui_preferences - UI preferences
 *
 * @returns Updated user profile
 *
 * @security Rate limited to 100 requests per minute per user
 */
export const PATCH = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Validate request body
  const body = await parseBody(request, updateProfileSchema);

  // Use admin client to bypass RLS
  const supabase = supabaseAdmin;

  // Update user profile with timestamp
  const { data: updatedUser, error } = await supabase
    .from('users')
    .update({
      ...(body as Record<string, any>),
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_id', userId)
    .select(`
      id,
      email,
      name,
      avatar_url,
      title,
      bio,
      phone,
      timezone,
      org_id,
      role,
      status,
      last_login_at,
      last_active_at,
      login_count,
      notification_preferences,
      ui_preferences,
      created_at,
      updated_at,
      onboarded_at
    `)
    .single();

  if (error) {
    console.error('[PATCH /api/profile] Error updating user:', error);
    return errors.internalError();
  }

  if (!updatedUser) {
    return errors.notFound('User profile');
  }

  return successResponse(updatedUser);
}));
