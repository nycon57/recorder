import type { SessionState } from "@tribora/shared";
import {
  apiFetch,
  getStoredSession,
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
 * Open the Tribora sign-in page in a new tab.
 */
export async function initiateSignIn(): Promise<void> {
  await chrome.tabs.create({ url: SIGN_IN_URL });
}

/**
 * Read the website's cookies for the API base URL so we can include
 * them in fetch requests from the extension context. This lets the
 * extension detect sessions established via normal web sign-in.
 *
 * Requires the "cookies" permission in the manifest.
 */
async function getWebsiteCookieHeader(): Promise<string> {
  try {
    const cookies = await chrome.cookies.getAll({ url: API_BASE_URL });
    if (cookies.length === 0) return "";
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  } catch {
    return "";
  }
}

/**
 * Fetches the current session from Better Auth via /api/auth/get-session.
 *
 * Uses the website's cookies (via chrome.cookies API) so it works
 * regardless of how the user signed in — web, extension flow, or OAuth.
 */
export async function refreshSession(): Promise<SessionState> {
  try {
    // Try with website cookies first — this covers web sign-in
    const cookieHeader = await getWebsiteCookieHeader();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }

    // Also include stored bearer token if we have one (covers extension sign-in)
    const stored = await getStoredSession();
    if (stored?.token) {
      headers["Authorization"] = `Bearer ${stored.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as GetSessionResponse;

    if (!data?.user) {
      const state: SessionState = { status: "unauthenticated" };
      await setStoredSession(state);
      return state;
    }

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
