import type { SessionState } from "@tribora/shared";
import {
  apiFetch,
  setStoredSession,
  clearStoredSession,
} from "./api-client.js";

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  "http://localhost:3000";

const SIGN_IN_URL = `${API_BASE_URL}/sign-in?source=extension`;

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

/**
 * Open the Tribora sign-in page in a new tab. On success, the web app posts
 * a message back to the extension (via chrome.runtime.sendMessage from a
 * helper page) to persist the session.
 */
export async function initiateSignIn(): Promise<void> {
  await chrome.tabs.create({ url: SIGN_IN_URL });
}

/**
 * Fetches the current session from Better Auth via /api/auth/get-session.
 * Returns the SessionState shape expected by the popup.
 */
export async function refreshSession(): Promise<SessionState> {
  try {
    const data = await apiFetch<GetSessionResponse>("/api/auth/get-session", {
      skipAuth: false,
    });

    if (!data?.user) {
      const state: SessionState = { status: "unauthenticated" };
      await setStoredSession(state);
      return state;
    }

    // Better Auth's org plugin uses `activeOrganization`; fall back to the
    // legacy `activeOrg` key if the backend is still on the old shape.
    const org = data.activeOrganization ?? data.activeOrg ?? null;
    const state: SessionState = {
      status: "authenticated",
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
      status: "unauthenticated",
      lastError: (error as Error).message,
    };
    await setStoredSession(state);
    return state;
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch("/api/auth/sign-out", { method: "POST" });
  } catch {
    // ignore — clear local session regardless
  }
  await clearStoredSession();
}
