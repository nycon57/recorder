/* global chrome */

import type { SessionState } from '@tribora/shared';

import {
  apiFetch,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
} from './api-client.js';
import { TRIBORA_EXTENSION_THEME } from './tribora-theme.js';
import {
  EXTENSION_AUTH_PENDING_KEY,
  assertFreshSessionShape,
  buildExtensionSignInUrl,
  isTrustedExtensionAuthCallbackUrlForBase,
  readValidatedExtensionAuthCallbackToken,
  type PendingExtensionAuthState,
} from './auth-callback.js';

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  'http://localhost:3000';

const DEFAULT_AUTH_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_AUTH_POLL_INTERVAL_MS = 1200;
const DEFAULT_AUTH_STATE_TTL_MS = 5 * 60 * 1000;

export interface SignInLaunchResult {
  mode: 'popup-window' | 'tab';
  url: string;
  windowId?: number;
  tabId?: number | null;
}

export interface SignInWaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  closeAuthWindowOnSuccess?: boolean;
}

interface GetSessionResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  } | null;
  session: {
    token: string;
    expiresAt: string;
  } | null;
  // Better Auth's organization plugin exposes this as `activeOrganization`
  // on the /api/auth/get-session response. Keep `activeOrg` as an alias so
  // older web-side code doesn't break if it switches back mid-rollout.
  activeOrganization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  activeOrg?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ExtensionAuthCallbackInput {
  state: unknown;
  session: unknown;
  callbackUrl?: string | null;
  now?: number;
}

interface ExtensionAuthValidationResponse {
  session: SessionState;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function generateAuthState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function setPendingExtensionAuthState(
  pending: PendingExtensionAuthState,
): Promise<void> {
  await chrome.storage.session.set({ [EXTENSION_AUTH_PENDING_KEY]: pending });
}

async function getPendingExtensionAuthState(): Promise<PendingExtensionAuthState | null> {
  const result = await chrome.storage.session.get(EXTENSION_AUTH_PENDING_KEY);
  const pending = result[EXTENSION_AUTH_PENDING_KEY] as
    | PendingExtensionAuthState
    | undefined;

  if (
    !pending ||
    typeof pending.state !== 'string' ||
    typeof pending.expiresAt !== 'number'
  ) {
    return null;
  }

  return pending;
}

async function clearPendingExtensionAuthState(): Promise<void> {
  await chrome.storage.session.remove(EXTENSION_AUTH_PENDING_KEY);
}

export function isTrustedExtensionAuthCallbackRuntimeUrl(
  callbackUrl: string | null | undefined,
): boolean {
  return isTrustedExtensionAuthCallbackUrlForBase(callbackUrl, API_BASE_URL);
}

export async function validateAndPersistExtensionAuthCallback({
  state,
  session,
  callbackUrl,
  now = Date.now(),
}: ExtensionAuthCallbackInput): Promise<SessionState> {
  const pending = await getPendingExtensionAuthState();
  const token = readValidatedExtensionAuthCallbackToken({
    state,
    session,
    callbackUrl,
    pending,
    apiBaseUrl: API_BASE_URL,
    now,
  });

  const response = await apiFetch<ExtensionAuthValidationResponse>(
    '/api/extension/auth/callback',
    {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ token }),
    },
  );
  assertFreshSessionShape(response.session);
  await setStoredSession(response.session);
  await clearPendingExtensionAuthState();
  return response.session;
}

function isAuthenticated(
  session: SessionState | null,
): session is SessionState & { status: 'authenticated' } {
  return session?.status === 'authenticated';
}

async function createAuthPopupWindow(): Promise<SignInLaunchResult> {
  const width = TRIBORA_EXTENSION_THEME.authWindow.width;
  const height = TRIBORA_EXTENSION_THEME.authWindow.height;

  const currentWindow = await chrome.windows.getCurrent().catch(() => null);
  let left: number | undefined;
  let top: number | undefined;

  if (
    currentWindow &&
    typeof currentWindow.left === 'number' &&
    typeof currentWindow.top === 'number' &&
    typeof currentWindow.width === 'number' &&
    typeof currentWindow.height === 'number'
  ) {
    left = Math.max(
      0,
      currentWindow.left + Math.round((currentWindow.width - width) / 2),
    );
    top = Math.max(
      0,
      currentWindow.top + Math.round((currentWindow.height - height) / 2),
    );
  }

  const state = generateAuthState();
  const signInUrl = buildExtensionSignInUrl(API_BASE_URL, state);
  await setPendingExtensionAuthState({
    state,
    expiresAt: Date.now() + DEFAULT_AUTH_STATE_TTL_MS,
  });

  const created = await chrome.windows.create({
    url: signInUrl,
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true,
  });

  return {
    mode: 'popup-window',
    url: signInUrl,
    windowId: created.id,
    tabId: created.tabs?.[0]?.id ?? null,
  };
}

/**
 * Open the Tribora sign-in experience in an extension-owned popup window to
 * preserve the user's current tab context. Falls back to a new tab if the
 * popup window fails (policy/browser constraints).
 */
export async function initiateSignIn(): Promise<SignInLaunchResult> {
  try {
    return await createAuthPopupWindow();
  } catch {
    const state = generateAuthState();
    const signInUrl = buildExtensionSignInUrl(API_BASE_URL, state);
    await setPendingExtensionAuthState({
      state,
      expiresAt: Date.now() + DEFAULT_AUTH_STATE_TTL_MS,
    });
    const tab = await chrome.tabs.create({ url: signInUrl });
    return {
      mode: 'tab',
      url: signInUrl,
      tabId: tab.id,
    };
  }
}

/**
 * Launch sign-in and poll Better Auth until the session is authenticated or
 * the flow times out/gets closed.
 */
export async function initiateSignInAndWait(
  options: SignInWaitOptions = {},
): Promise<SessionState> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS;
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_AUTH_POLL_INTERVAL_MS;
  const closeAuthWindowOnSuccess = options.closeAuthWindowOnSuccess ?? true;

  const launch = await initiateSignIn();
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const session = await refreshSession();
    if (isAuthenticated(session)) {
      if (
        closeAuthWindowOnSuccess &&
        launch.mode === 'popup-window' &&
        typeof launch.windowId === 'number'
      ) {
        await chrome.windows.remove(launch.windowId).catch(() => undefined);
      }
      return session;
    }

    if (launch.mode === 'popup-window' && typeof launch.windowId === 'number') {
      const popupStillOpen = await chrome.windows
        .get(launch.windowId)
        .then(() => true)
        .catch(() => false);
      if (!popupStillOpen) break;
    }

    await wait(pollIntervalMs);
  }

  const stored = await getStoredSession();
  if (isAuthenticated(stored)) {
    return stored;
  }

  return {
    status: 'unauthenticated',
    lastError: 'Authentication was canceled or timed out.',
  };
}

/**
 * Fetches the current session from Better Auth via /api/auth/get-session.
 * Returns the SessionState shape expected by the popup.
 */
export async function refreshSession(): Promise<SessionState> {
  try {
    const data = await apiFetch<GetSessionResponse>('/api/auth/get-session', {
      skipAuth: false,
    });

    if (!data?.user) {
      const state: SessionState = { status: 'unauthenticated' };
      await setStoredSession(state);
      return state;
    }

    // Better Auth's org plugin uses `activeOrganization`; fall back to the
    // legacy `activeOrg` key if the backend is still on the old shape.
    const org = data.activeOrganization ?? data.activeOrg ?? null;
    const state: SessionState = {
      status: 'authenticated',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        image: data.user.image,
      },
      activeOrg: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
          }
        : undefined,
      token: data.session?.token,
      expiresAt: data.session?.expiresAt
        ? new Date(data.session.expiresAt).getTime()
        : undefined,
    };
    await setStoredSession(state);
    return state;
  } catch (error) {
    const state: SessionState = {
      status: 'unauthenticated',
      lastError: (error as Error).message,
    };
    await setStoredSession(state);
    return state;
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch('/api/auth/sign-out', { method: 'POST' });
  } catch {
    // ignore — clear local session regardless
  }
  await clearStoredSession();
}
