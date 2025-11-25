import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import type { ApiError, ApiSuccess } from '@/lib/validations/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UserCache } from '@/lib/services/cache';

// Generate request ID for tracing
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Success response helper
export function successResponse<T>(
  data: T,
  requestId?: string,
  status = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      data,
      requestId,
    },
    { status }
  );
}

// Error response helper
export function errorResponse(
  message: string,
  code: string,
  status = 400,
  details?: any,
  requestId?: string
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      code,
      message,
      details,
      requestId,
    },
    { status }
  );
}

// Common error responses
export const errors = {
  unauthorized: (requestId?: string) =>
    errorResponse('Unauthorized', 'UNAUTHORIZED', 401, undefined, requestId),

  forbidden: (requestId?: string) =>
    errorResponse(
      'You do not have permission to perform this action',
      'FORBIDDEN',
      403,
      undefined,
      requestId
    ),

  notFound: (resource: string, requestId?: string) =>
    errorResponse(
      `${resource} not found`,
      'NOT_FOUND',
      404,
      undefined,
      requestId
    ),

  badRequest: (message: string, details?: any, requestId?: string) =>
    errorResponse(message, 'BAD_REQUEST', 400, details, requestId),

  validationError: (details: any, requestId?: string) =>
    errorResponse(
      'Validation failed',
      'VALIDATION_ERROR',
      400,
      details,
      requestId
    ),

  internalError: (requestId?: string) =>
    errorResponse(
      'An internal server error occurred',
      'INTERNAL_ERROR',
      500,
      undefined,
      requestId
    ),

  rateLimitExceeded: (details?: any, requestId?: string) =>
    errorResponse(
      'Rate limit exceeded. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429,
      details,
      requestId
    ),

  quotaExceeded: (details?: any, requestId?: string) =>
    errorResponse(
      'Quota exceeded. Please upgrade your plan or wait for quota reset.',
      'QUOTA_EXCEEDED',
      402,
      details,
      requestId
    ),
};

// Get authenticated user from Clerk
export async function getAuthUser() {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  return {
    userId,
    orgId: orgId || null,
  };
}

// Require authentication
export async function requireAuth() {
  const user = await getAuthUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// Require organization context
export async function requireOrg() {
  const user = await requireAuth();

  if (!user.orgId) {
    throw new Error('Organization context required');
  }

  // PERFORMANCE OPTIMIZATION: Check cache first to avoid an extra DB query
  // MULTI-TENANT: Include orgId in cache key for proper isolation
  const cacheKey = `${user.userId}:${user.orgId}`;
  let cachedUser;
  try {
    cachedUser = await UserCache.get(cacheKey);
  } catch (error) {
    // Log cache read error but continue to DB fallback
    console.warn('[requireOrg] Cache read error:', error);
  }

  if (cachedUser) {
    // Cache hit - return cached user data
    return {
      userId: cachedUser.id,
      clerkUserId: cachedUser.clerkUserId,
      orgId: cachedUser.orgId,
      role: cachedUser.role,
      clerkOrgId: user.orgId,
    };
  }

  // Cache miss - fetch from database
  const supabase = supabaseAdmin;

  // Look up the user by clerk_id (users.clerk_id = Clerk user ID)
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, org_id, role, email, name')
    .eq('clerk_id', user.userId)
    .single();

  // If user doesn't exist, throw a clear error
  if (error?.code === 'PGRST116') {
    throw new Error(`User ${user.userId} not found in database. Please ensure user is synced from Clerk.`);
  } else if (error) {
    console.error('[requireOrg] Error fetching user org:', error);
    throw new Error('User organization not found');
  }

  // Cache the user data for 5 minutes (best effort - don't fail request on cache errors)
  // MULTI-TENANT: Use composite cache key with orgId for isolation
  try {
    await UserCache.set(cacheKey, {
      id: userData!.id,
      clerkUserId: user.userId,
      orgId: userData!.org_id,
      role: userData!.role,
      email: userData!.email,
      name: userData!.name,
    });
  } catch (error) {
    // Log cache write error but don't fail the request
    console.warn('[requireOrg] Cache write error:', error);
  }

  return {
    userId: userData!.id, // Internal UUID
    clerkUserId: user.userId, // Clerk user ID
    orgId: userData!.org_id, // Internal org UUID
    role: userData!.role,
    clerkOrgId: user.orgId, // Clerk org ID for reference
  };
}

// Require admin role (owner or admin) - For organization-level admin functions
export async function requireAdmin() {
  const orgContext = await requireOrg();

  if (orgContext.role !== 'owner' && orgContext.role !== 'admin') {
    throw new Error('Admin privileges required');
  }

  return orgContext;
}

// SECURITY: Require system admin role - For system-wide admin endpoints
// Only specific users with is_system_admin flag can access these endpoints
export async function requireSystemAdmin() {
  const user = await requireAuth();

  if (!user.userId) {
    throw new Error('Unauthorized');
  }

  // Use admin client to bypass RLS for user lookup
  const supabase = supabaseAdmin;

  // Check for system admin flag
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, clerk_id, is_system_admin, email, role')
    .eq('clerk_id', user.userId)
    .single();

  if (error || !userData) {
    console.error('[requireSystemAdmin] Error fetching user:', error);
    throw new Error('System admin privileges required');
  }

  // SECURITY: Strict check for system admin flag
  if (userData.is_system_admin !== true) {
    // Log potential unauthorized access attempt
    console.warn(`[SECURITY] Non-system-admin user ${userData.email} (role: ${userData.role}) attempted to access system admin endpoint`);
    throw new Error('System admin privileges required');
  }

  return {
    userId: userData.id,
    clerkUserId: user.userId,
    email: userData.email,
    role: userData.role,
    isSystemAdmin: true,
  };
}

// Parse and validate request body with Zod
export async function parseBody<T>(
  request: NextRequest,
  schema: any
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error: any) {
    throw new Error(`Invalid request body: ${error.message}`);
  }
}

// Parse and validate URL search params with Zod
export function parseSearchParams<T>(
  request: NextRequest,
  schema: any
): T {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    return schema.parse(params);
  } catch (error: any) {
    throw new Error(`Invalid search params: ${error.message}`);
  }
}

// Handle API route with error handling
export function apiHandler<T = any>(
  handler: (
    request: NextRequest,
    context?: any
  ) => Promise<NextResponse<ApiSuccess<T>> | NextResponse<ApiError> | Response>
) {
  return async (request: NextRequest, context?: any) => {
    const requestId = generateRequestId();

    try {
      return await handler(request, context);
    } catch (error: any) {
      console.error(`[${requestId}] API Error:`, error);

      if (error.message === 'Unauthorized') {
        return errors.unauthorized(requestId);
      }

      if (
        error.message === 'Organization context required' ||
        error.message === 'User organization not found' ||
        error.message === 'Admin privileges required' ||
        error.message.includes('not found in database')
      ) {
        return errors.forbidden(requestId);
      }

      if (error.message.startsWith('Invalid request body')) {
        return errors.validationError(error.message, requestId);
      }

      return errors.internalError(requestId);
    }
  };
}
