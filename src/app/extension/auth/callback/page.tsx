'use client';

import { useEffect, useState } from 'react';

type CallbackStatus = 'working' | 'done' | 'error';

export default function ExtensionAuthCallbackPage() {
  const [status, setStatus] = useState<CallbackStatus>('working');

  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get(
      'extension_auth_state',
    );
    if (!state) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    async function completeExtensionAuth() {
      try {
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Unable to read signed-in session');
        }

        const data = await response.json();
        if (!data?.user || !data?.session?.token) {
          throw new Error('Signed-in session is missing');
        }

        const session = {
          status: 'authenticated',
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? null,
            image: data.user.image ?? null,
          },
          activeOrg: data.activeOrganization ?? data.activeOrg ?? undefined,
          token: data.session.token,
          expiresAt: data.session.expiresAt
            ? new Date(data.session.expiresAt).getTime()
            : undefined,
        };

        window.postMessage(
          {
            type: 'TRIBORA_AUTH_SUCCESS',
            state,
            session,
          },
          window.location.origin,
        );

        if (!cancelled) {
          setStatus('done');
          window.setTimeout(() => window.close(), 250);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void completeExtensionAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[rgb(3,14,16)] px-6 text-center text-[rgb(241,247,247)]">
      <div className="max-w-sm">
        <h1 className="mb-3 text-2xl font-light">
          {status === 'error' ? 'Extension sign-in failed' : 'Signing you in'}
        </h1>
        <p className="text-sm text-[rgb(170,203,196)]">
          {status === 'done'
            ? 'You can return to the Tribora extension.'
            : status === 'error'
              ? 'Close this window and try signing in from the extension again.'
              : 'Connecting your signed-in Tribora session to the extension.'}
        </p>
      </div>
    </main>
  );
}
