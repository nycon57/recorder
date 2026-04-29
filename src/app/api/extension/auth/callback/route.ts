/**
 * POST /api/extension/auth/callback
 *
 * Validates the browser-extension callback session token before the extension
 * persists it in chrome.storage.session.
 */

import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { errors } from '@/lib/utils/api';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest) {
  let token: unknown;

  try {
    ({ token } = (await request.json()) as { token?: unknown });
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  if (typeof token !== 'string' || token.length === 0) {
    return errors.badRequest('token is required');
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('session')
    .select('userId, token, expiresAt, activeOrganizationId')
    .eq('token', token)
    .single();

  if (sessionError?.code === 'PGRST116' || !session?.userId) {
    return errors.unauthorized();
  }
  if (sessionError) {
    console.error(
      '[extension/auth/callback] Session lookup error:',
      sessionError,
    );
    return errors.internalError();
  }
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return errors.unauthorized();
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, org_id, email, name, avatar_url')
    .eq('id', session.userId)
    .single();

  if (error?.code === 'PGRST116') {
    return errors.forbidden();
  }
  if (error) {
    console.error('[extension/auth/callback] User lookup error:', error);
    return errors.internalError();
  }
  if (!user) {
    return errors.forbidden();
  }
  if (!user.org_id) {
    return errors.forbidden();
  }

  const activeOrgId = session.activeOrganizationId ?? user.org_id;
  const { data: organization, error: organizationError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug')
    .eq('id', activeOrgId)
    .single();

  if (organizationError && organizationError.code !== 'PGRST116') {
    console.error(
      '[extension/auth/callback] Organization lookup error:',
      organizationError,
    );
    return errors.internalError();
  }

  const activeOrg = organization
    ? {
        id: organization.id,
        name: organization.name ?? '',
        slug: organization.slug ?? '',
      }
    : undefined;

  return NextResponse.json(
    {
      session: {
        status: 'authenticated',
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.avatar_url ?? null,
        },
        activeOrg,
        token: session.token,
        expiresAt: new Date(session.expiresAt).getTime(),
      },
    },
    { headers: CORS_HEADERS },
  );
}
