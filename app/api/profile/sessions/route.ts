import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revokeSessionSchema } from '@/lib/validations/api';

/**
 * GET /api/profile/sessions
 *
 * List all active sessions for the current user
 *
 * Returns sessions with device info, location, and last active timestamp
 * Excludes revoked and expired sessions
 *
 * @returns Array of active user sessions
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Use admin client to bypass RLS
  const supabase = supabaseAdmin;

  // Get user's internal UUID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[GET /api/profile/sessions] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Fetch active sessions for the user
  const { data: sessions, error } = await supabase
    .from('user_sessions')
    .select(`
      id,
      session_token,
      clerk_session_id,
      ip_address,
      user_agent,
      device_type,
      browser,
      os,
      location,
      created_at,
      last_active_at,
      expires_at
    `)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_active_at', { ascending: false });

  if (error) {
    console.error('[GET /api/profile/sessions] Error fetching sessions:', error);
    return errors.internalError();
  }

  // Format sessions for response (exclude sensitive session_token)
  const formattedSessions = (sessions || []).map((session) => ({
    id: session.id,
    clerkSessionId: session.clerk_session_id,
    ipAddress: session.ip_address,
    userAgent: session.user_agent,
    deviceType: session.device_type,
    browser: session.browser,
    os: session.os,
    location: session.location,
    createdAt: session.created_at,
    lastActiveAt: session.last_active_at,
    expiresAt: session.expires_at,
  }));

  return successResponse({
    sessions: formattedSessions,
    total: formattedSessions.length,
  });
});

/**
 * DELETE /api/profile/sessions
 *
 * Revoke a specific session by ID
 *
 * Users can only revoke their own sessions
 * Validates that the session belongs to the authenticated user
 *
 * @body sessionId - UUID of the session to revoke
 *
 * @returns { success: boolean, sessionId: string }
 */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { userId } = await requireAuth();

  // Validate request body
  const body = await parseBody(request, revokeSessionSchema);
  const { sessionId } = body;

  // Use admin client to bypass RLS
  const supabase = supabaseAdmin;

  // Get user's internal UUID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single();

  if (userError || !user) {
    console.error('[DELETE /api/profile/sessions] Error fetching user:', userError);
    return errors.notFound('User');
  }

  // Verify the session belongs to the user
  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return errors.notFound('Session');
  }

  if (session.user_id !== user.id) {
    return errors.forbidden();
  }

  // Revoke the session by setting revoked_at timestamp
  const { error: revokeError } = await supabase
    .from('user_sessions')
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (revokeError) {
    console.error('[DELETE /api/profile/sessions] Error revoking session:', revokeError);
    return errors.internalError();
  }

  return successResponse({
    success: true,
    sessionId,
  });
});
