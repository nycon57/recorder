import type { SessionState } from '@tribora/shared';

const EXTENSION_AUTH_CALLBACK_PATH = '/extension/auth/callback';
const EXTENSION_AUTH_STATE_PARAM = 'extension_auth_state';
export const EXTENSION_AUTH_PENDING_KEY = 'tribora_extension_auth_pending';

export interface PendingExtensionAuthState {
  state: string;
  expiresAt: number;
}

export interface ExtensionAuthCallbackInput {
  state: unknown;
  session: unknown;
  callbackUrl?: string | null;
  pending: PendingExtensionAuthState | null;
  apiBaseUrl: string;
  now: number;
}

function buildExtensionCallbackUrl(
  apiBaseUrl: string,
  state: string,
): string {
  const url = new URL(EXTENSION_AUTH_CALLBACK_PATH, apiBaseUrl);
  url.searchParams.set(EXTENSION_AUTH_STATE_PARAM, state);
  return url.toString();
}

export function buildExtensionSignInUrl(
  apiBaseUrl: string,
  state: string,
): string {
  const url = new URL('/sign-in', apiBaseUrl);
  url.searchParams.set('source', 'extension');
  url.searchParams.set(EXTENSION_AUTH_STATE_PARAM, state);
  url.searchParams.set(
    'callbackURL',
    buildExtensionCallbackUrl(apiBaseUrl, state),
  );
  return url.toString();
}

export function isTrustedExtensionAuthCallbackUrlForBase(
  callbackUrl: string | null | undefined,
  apiBaseUrl: string,
): boolean {
  if (!callbackUrl) return false;

  try {
    const parsed = new URL(callbackUrl);
    return (
      parsed.origin === new URL(apiBaseUrl).origin &&
      parsed.pathname === EXTENSION_AUTH_CALLBACK_PATH
    );
  } catch {
    return false;
  }
}

function readSessionToken(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null;
  const token = (session as { token?: unknown }).token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export function readValidatedExtensionAuthCallbackToken({
  state,
  session,
  callbackUrl,
  pending,
  apiBaseUrl,
  now,
}: ExtensionAuthCallbackInput): string {
  if (!isTrustedExtensionAuthCallbackUrlForBase(callbackUrl, apiBaseUrl)) {
    throw new Error('Auth callback URL is not trusted');
  }
  if (typeof state !== 'string' || state.length === 0) {
    throw new Error('Auth callback state is missing');
  }
  if (!pending || pending.state !== state || pending.expiresAt <= now) {
    throw new Error('Auth callback state is invalid or expired');
  }

  const token = readSessionToken(session);
  if (!token) {
    throw new Error('Auth callback session token is missing');
  }

  return token;
}

export function assertFreshSessionShape(session: SessionState): void {
  if (session.status !== 'authenticated') {
    throw new Error('Auth callback session is not authenticated');
  }
  if (!session.user?.id || !session.user.email || !session.token) {
    throw new Error('Auth callback session is incomplete');
  }
  if (
    typeof session.expiresAt === 'number' &&
    session.expiresAt <= Date.now()
  ) {
    throw new Error('Auth callback session is expired');
  }
}
