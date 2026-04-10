import { getStoredSession } from "./api-client.js";
import { refreshSession } from "./auth-session.js";

/** Refresh 5 minutes before expiry */
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Schedules a token refresh before the stored session expires.
 * Returns a cleanup function to cancel the scheduled refresh.
 */
export function scheduleTokenRefresh(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = async (): Promise<void> => {
    const session = await getStoredSession();
    if (!session?.expiresAt) return;

    const delay = Math.max(
      0,
      session.expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS,
    );

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void refreshSession().then(() => schedule());
    }, delay);
  };

  void schedule();

  return () => {
    if (timer) clearTimeout(timer);
  };
}
