"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// Same-origin in the browser so the client works on any localhost port and
// in ephemeral preview URLs. The SSR pass gets undefined (auth client is
// client-only — the "use client" directive above guarantees it).
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_DOMAIN,
  plugins: [organizationClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
