import crypto from 'crypto';

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  listMembersQuerySchema,
  inviteMemberSchema,
} from '@/lib/validations/organizations';
import { rateLimit, RateLimitTier, extractUserIdFromAuth } from '@/lib/middleware/rate-limit';

/**
 * GET /api/organizations/members
 * List organization members with filters (admin+ only)
 *
 * @security Rate limited to 100 requests per minute per user
 */
export const GET = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    role: searchParams.get('role'),
    department_id: searchParams.get('department_id'),
    status: searchParams.get('status'),
    search: searchParams.get('search'),
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  };

  const validatedParams = listMembersQuerySchema.parse(queryParams);

  // Build query
  let query = supabaseAdmin
    .from('users')
    .select(
      `
      id,
      clerk_id,
      email,
      name,
      avatar_url,
      role,
      title,
      department_id,
      bio,
      phone,
      timezone,
      status,
      last_login_at,
      last_active_at,
      login_count,
      onboarded_at,
      invited_by,
      created_at,
      updated_at
    `,
      { count: 'exact' }
    )
    .eq('org_id', orgId)
    .is('deleted_at', null);

  // Apply filters
  if (validatedParams.role) {
    query = query.eq('role', validatedParams.role);
  }

  if (validatedParams.department_id) {
    query = query.eq('department_id', validatedParams.department_id);
  }

  if (validatedParams.status) {
    query = query.eq('status', validatedParams.status);
  }

  // Search by name or email
  if (validatedParams.search) {
    query = query.or(
      `name.ilike.%${validatedParams.search}%,email.ilike.%${validatedParams.search}%`
    );
  }

  // Pagination
  const offset = (validatedParams.page - 1) * validatedParams.limit;
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + validatedParams.limit - 1);

  const { data: members, count, error } = await query;

  if (error) {
    console.error('[GET /api/organizations/members] Error fetching members:', error);
    return errors.internalError();
  }

  return successResponse({
    members: members || [],
    pagination: {
      total: count || 0,
      page: validatedParams.page,
      limit: validatedParams.limit,
      total_pages: Math.ceil((count || 0) / validatedParams.limit),
    },
  });
}));

/**
 * POST /api/organizations/members
 * Invite a new member to the organization (admin+ only)
 *
 * @security Rate limited to 100 requests per minute per user
 */
export const POST = rateLimit(RateLimitTier.API, extractUserIdFromAuth)(
  apiHandler(async (request: NextRequest) => {
  const { orgId, userId: inviterId } = await requireAdmin();

  // Parse and validate request body
  const body = await parseBody(request, inviteMemberSchema);

  // Check if email is already a member
  const { data: existingUser, error: existingUserError } = await supabaseAdmin
    .from('users')
    .select('id, email, status')
    .eq('org_id', orgId)
    .eq('email', body.email)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingUserError) {
    console.error('[POST /api/organizations/members] Error checking existing user:', existingUserError);
    return errors.internalError();
  }

  if (existingUser) {
    if (existingUser.status === 'active') {
      return errors.badRequest('User is already a member of this organization');
    } else if (existingUser.status === 'pending') {
      return errors.badRequest('User already has a pending invitation');
    }
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvitation, error: invitationCheckError } = await supabaseAdmin
    .from('user_invitations')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('email', body.email)
    .eq('status', 'pending')
    .maybeSingle();

  if (invitationCheckError) {
    console.error('[POST /api/organizations/members] Error checking existing invitation:', invitationCheckError);
    return errors.internalError();
  }

  if (existingInvitation) {
    return errors.badRequest('A pending invitation already exists for this email');
  }

  // Check if organization has reached max users limit
  const { data: organization, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('max_users')
    .eq('id', orgId)
    .single();

  if (orgError) {
    console.error('[POST /api/organizations/members] Error fetching organization:', orgError);
    return errors.internalError();
  }

  const { count: currentMemberCount, error: countError } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (countError) {
    console.error('[POST /api/organizations/members] Error counting members:', countError);
    return errors.internalError();
  }

  if (organization.max_users && currentMemberCount && currentMemberCount >= organization.max_users) {
    return errors.quotaExceeded({
      message: 'Organization has reached maximum user limit',
      current: currentMemberCount,
      max: organization.max_users,
    });
  }

  // Generate invitation token
  const token = crypto.randomBytes(32).toString('base64url');

  // Create invitation
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

  const { data: invitation, error: createError } = await supabaseAdmin
    .from('user_invitations')
    .insert({
      org_id: orgId,
      email: body.email,
      role: body.role,
      token,
      invited_by: inviterId,
      department_ids: body.department_ids || [],
      custom_message: body.custom_message,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
      sent_at: new Date().toISOString(),
    })
    .select(
      `
      id,
      email,
      role,
      token,
      department_ids,
      custom_message,
      status,
      sent_at,
      expires_at,
      created_at
    `
    )
    .single();

  if (createError || !invitation) {
    console.error('[POST /api/organizations/members] Error creating invitation:', createError);
    return errors.internalError();
  }

  // TODO: Send invitation email via your email service
  // Example: await sendInvitationEmail(body.email, token, body.custom_message);

  return successResponse(
    {
      invitation: {
        ...invitation,
        // Include invitation link for development/testing
        invitation_url: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
      },
      message: 'Invitation sent successfully',
    },
    undefined,
    201
  );
}));
