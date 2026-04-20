import type { SessionState } from '@tribora/shared';

import {
  apiFetch,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
} from './api-client.js';
import { TRIBORA_EXTENSION_THEME } from './tribora-theme.js';

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  'http://localhost:3000';

const SIGN_IN_URL = `${API_BASE_URL}/sign-in?source=extension`;

const DEFAULT_AUTH_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_AUTH_POLL_INTERVAL_MS = 1200;

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

  const created = await chrome.windows.create({
    url: SIGN_IN_URL,
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true,
  });

  return {
    mode: 'popup-window',
    url: SIGN_IN_URL,
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
    const tab = await chrome.tabs.create({ url: SIGN_IN_URL });
    return {
      mode: 'tab',
      url: SIGN_IN_URL,
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
