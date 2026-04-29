/**
 * POST /api/extension/auth/callback
 *
 * Validates the browser-extension callback session token before the extension
 * persists it in chrome.storage.session.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';
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

  const authHeaders = new Headers(request.headers);
  authHeaders.set('authorization', `Bearer ${token}`);

  const session = await auth.api.getSession({
    headers: authHeaders,
  });

  if (!session?.user?.id || !session.session?.token) {
    return errors.unauthorized();
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, org_id, email, name, avatar_url')
    .eq('id', session.user.id)
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

  const activeOrganization =
    (session as { activeOrganization?: unknown }).activeOrganization ??
    (session as { activeOrg?: unknown }).activeOrg;
  const activeOrg =
    activeOrganization &&
    typeof activeOrganization === 'object' &&
    typeof (activeOrganization as { id?: unknown }).id === 'string'
      ? {
          id: (activeOrganization as { id: string }).id,
          name:
            typeof (activeOrganization as { name?: unknown }).name === 'string'
              ? (activeOrganization as { name: string }).name
              : '',
          slug:
            typeof (activeOrganization as { slug?: unknown }).slug === 'string'
              ? (activeOrganization as { slug: string }).slug
              : '',
        }
      : undefined;

  return NextResponse.json(
    {
      session: {
        status: 'authenticated',
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? user.name ?? null,
          image: session.user.image ?? user.avatar_url ?? null,
        },
        activeOrg,
        token: session.session.token,
        expiresAt: session.session.expiresAt
          ? new Date(session.session.expiresAt).getTime()
          : undefined,
      },
    },
    { headers: CORS_HEADERS },
  );
}
