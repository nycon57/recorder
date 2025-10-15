import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseSearchParams, errors } from '@/lib/utils/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const sessionFiltersSchema = z.object({
  userId: z.string().optional(),
  deviceType: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type SessionFilters = z.infer<typeof sessionFiltersSchema>;

export type UserSession = {
  id: string;
  user_id: string;
  org_id: string;
  session_token: string;
  clerk_session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  location: any | null;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  revoked_at: string | null;
  user?: {
    name: string | null;
    email: string;
    avatar_url: string | null;
  };
  isActive?: boolean;
};

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const filters = parseSearchParams(request, sessionFiltersSchema);
  const supabase = createAdminClient();

  // Build base query
  let query = supabase
    .from('user_sessions')
    .select(`
      *,
      user:users!user_sessions_user_id_fkey(
        name,
        email,
        avatar_url
      )
    `)
    .eq('org_id', orgId)
    .order('last_active_at', { ascending: false });

  // Apply filters
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.deviceType) {
    query = query.eq('device_type', filters.deviceType);
  }

  if (filters.active === 'true') {
    // Active sessions: not revoked and not expired
    query = query
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString());
  } else if (filters.active === 'false') {
    // Inactive sessions: either revoked or expired
    query = query.or(`revoked_at.not.is.null,expires_at.lt.${new Date().toISOString()}`);
  }

  // Apply pagination
  const offset = (filters.page - 1) * filters.limit;
  query = query.range(offset, offset + filters.limit - 1);

  const { data: sessions, error: sessionsError, count } = await query;

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError);
    throw new Error('Failed to fetch sessions');
  }

  // Process sessions to add isActive flag
  const processedSessions = (sessions || []).map((session: any) => ({
    ...session,
    isActive: !session.revoked_at && new Date(session.expires_at) > new Date(),
  }));

  // Get session statistics
  const { data: stats } = await supabase
    .from('user_sessions')
    .select('id', { count: 'exact' })
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .gte('expires_at', new Date().toISOString());

  const activeSessionCount = stats?.length || 0;

  // Get unique device types for filters
  const { data: deviceTypes } = await supabase
    .from('user_sessions')
    .select('device_type')
    .eq('org_id', orgId)
    .not('device_type', 'is', null)
    .limit(1000);

  const uniqueDeviceTypes = [...new Set(deviceTypes?.map(d => d.device_type) || [])];

  return successResponse({
    sessions: processedSessions,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / filters.limit),
    },
    stats: {
      activeCount: activeSessionCount,
      totalCount: count || 0,
    },
    filters: {
      deviceTypes: uniqueDeviceTypes,
    },
  });
});

// Revoke a session
export const DELETE = apiHandler(async (request: NextRequest) => {
  const { orgId, userId: currentUserId, role } = await requireOrg();
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    throw errors.badRequest('Session ID is required');
  }

  const supabase = createAdminClient();

  // Get the session
  const { data: session, error: sessionError } = await supabase
    .from('user_sessions')
    .select('*, user:users!user_sessions_user_id_fkey(id, email)')
    .eq('id', sessionId)
    .eq('org_id', orgId)
    .single();

  if (sessionError || !session) {
    throw errors.notFound('Session not found');
  }

  // Check permissions
  // Users can revoke their own sessions
  // Admins and owners can revoke any session
  if (session.user_id !== currentUserId && role !== 'admin' && role !== 'owner') {
    throw errors.forbidden('Insufficient permissions to revoke this session');
  }

  // Revoke the session
  const { error: updateError } = await supabase
    .from('user_sessions')
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('Error revoking session:', updateError);
    throw new Error('Failed to revoke session');
  }

  // Log the action
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: currentUserId,
    action: 'session.revoked',
    resource_type: 'session',
    resource_id: sessionId,
    metadata: {
      revoked_user_id: session.user_id,
      revoked_user_email: session.user?.email,
    },
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent'),
  });

  return successResponse({ message: 'Session revoked successfully' });
});

// Bulk revoke sessions
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId: currentUserId, role } = await requireOrg();

  // Only admins and owners can bulk revoke sessions
  if (role !== 'admin' && role !== 'owner') {
    throw errors.forbidden('Insufficient permissions to bulk revoke sessions');
  }

  const body = await request.json();
  const { userId, all } = z.object({
    userId: z.string().optional(),
    all: z.boolean().optional(),
  }).parse(body);

  const supabase = createAdminClient();

  let query = supabase
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .is('revoked_at', null);

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (!all) {
    throw errors.badRequest('Either userId or all flag must be provided');
  }

  const { data, error } = await query.select('id');

  if (error) {
    console.error('Error bulk revoking sessions:', error);
    throw new Error('Failed to bulk revoke sessions');
  }

  const count = data?.length || 0;

  // Log the action
  await supabase.from('audit_logs').insert({
    org_id: orgId,
    user_id: currentUserId,
    action: 'sessions.bulk_revoked',
    resource_type: 'session',
    metadata: {
      count,
      target_user_id: userId,
      revoke_all: all,
    },
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent'),
  });

  return successResponse({
    message: `Successfully revoked ${count} session(s)`,
    count,
  });
});