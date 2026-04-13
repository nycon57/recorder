'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/auth-client';
import { Loader2, CheckCircle } from 'lucide-react';

/**
 * Extension Auth Callback
 *
 * Bridges the web session to the Chrome extension after OAuth sign-in.
 * Fetches the current session (cookies are available in this page context),
 * posts it to the content script via window.postMessage, and the content
 * script relays it to the extension's background service worker.
 */
export default function ExtensionCallbackPage() {
  const [status, setStatus] = useState<'bridging' | 'done' | 'error'>('bridging');

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.session && data?.user) {
          window.postMessage({
            type: 'TRIBORA_AUTH_SUCCESS',
            session: {
              status: 'authenticated',
              user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                image: data.user.image,
              },
              token: data.session.token,
              expiresAt: new Date(data.session.expiresAt).getTime(),
            },
          }, window.location.origin);
          // Give the content script time to relay to background
          await new Promise((r) => setTimeout(r, 500));
          setStatus('done');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div
        className="rounded-2xl p-8 text-center max-w-sm"
        style={{
          background: 'rgba(4, 34, 34, 0.6)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 223, 130, 0.1)',
          boxShadow: '0 0 60px rgba(0, 223, 130, 0.08)',
        }}
      >
        {status === 'bridging' && (
          <>
            <Loader2 className="size-8 animate-spin mx-auto mb-4" style={{ color: '#00df82' }} />
            <p style={{ color: 'rgb(170, 203, 196)' }}>Connecting to extension...</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle className="size-8 mx-auto mb-4" style={{ color: '#00df82' }} />
            <p className="font-medium mb-2" style={{ color: 'rgb(241, 247, 247)' }}>Connected!</p>
            <p className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>
              You can close this tab and use the extension.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="font-medium mb-2" style={{ color: 'rgb(241, 247, 247)' }}>
              Could not connect to extension
            </p>
            <p className="text-sm" style={{ color: 'rgb(170, 203, 196)' }}>
              Please sign in again from the extension popup.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
