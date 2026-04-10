import type { SessionState } from "@tribora/shared";

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  "http://localhost:3000";

const STORAGE_KEY = "tribora_session";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders as HeadersInit | undefined);
  headers.set("Content-Type", "application/json");

  if (!skipAuth) {
    const session = await getStoredSession();
    if (session?.token) {
      headers.set("Authorization", `Bearer ${session.token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getStoredSession(): Promise<SessionState | null> {
  try {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as SessionState) ?? null;
  } catch {
    return null;
  }
}

export async function setStoredSession(state: SessionState): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: state });
}

export async function clearStoredSession(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY);
}
