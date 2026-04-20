import { useEffect, useState } from 'react';
import type { SessionState, RecordingState } from '@tribora/shared';

import { getStoredSession } from '../../utils/api-client.js';
import {
  initiateSignInAndWait,
  refreshSession,
  signOut,
} from '../../utils/auth-session.js';

const VERSION = '0.0.1';

const UPLOAD_STATE_KEY = 'tribora_upload_state';

function RecordingSection() {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    status: 'idle',
  });

  // TRIB-49: listen for upload progress from the background service worker
  useEffect(() => {
    if (recordingState.status !== 'uploading') return;

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'session' || !changes[UPLOAD_STATE_KEY]) return;
      const newVal = changes[UPLOAD_STATE_KEY].newValue as
        | RecordingState
        | undefined;
      if (newVal) {
        setRecordingState((prev) => ({ ...prev, ...newVal }));
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [recordingState.status]);

  const startRecording = () => {
    setRecordingState({ status: 'requesting_capture' });
    chrome.runtime.sendMessage(
      { type: 'RECORDING_START' },
      (response: { ok: boolean; state?: RecordingState; error?: string }) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setRecordingState({
            status: 'error',
            error:
              chrome.runtime.lastError?.message ??
              response?.error ??
              'Failed to start',
          });
          return;
        }
        setRecordingState(
          response.state ?? { status: 'recording', startedAt: Date.now() },
        );
      },
    );
  };

  const stopRecording = () => {
    setRecordingState({ status: 'uploading', uploadProgress: 0 });
    chrome.runtime.sendMessage(
      { type: 'RECORDING_STOP' },
      (response: { ok: boolean; recordingId?: string; error?: string }) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setRecordingState({
            status: 'error',
            error:
              chrome.runtime.lastError?.message ??
              response?.error ??
              'Failed to stop',
          });
          return;
        }
        setRecordingState({
          status: 'idle',
          recordingId: response.recordingId,
        });
      },
    );
  };

  const { status, error, recordingId, uploadProgress, retryAttempt, retryMax } =
    recordingState;

  return (
    <div className="recording-section">
      {status === 'idle' && (
        <>
          {recordingId && <p className="recording-success">Recording saved!</p>}
          <button
            className="popup-btn popup-btn-record"
            onClick={startRecording}
          >
            Start Recording
          </button>
        </>
      )}
      {status === 'requesting_capture' && (
        <button className="popup-btn popup-btn-record" disabled>
          Requesting capture…
        </button>
      )}
      {status === 'recording' && (
        <button className="popup-btn popup-btn-stop" onClick={stopRecording}>
          Stop Recording
        </button>
      )}
      {status === 'uploading' && (
        <div className="upload-progress-section">
          <div className="upload-progress-bar-track">
            <div
              className="upload-progress-bar-fill"
              style={{ width: `${uploadProgress ?? 0}%` }}
            />
          </div>
          <p className="upload-progress-label">
            {retryAttempt
              ? `Retrying upload (attempt ${retryAttempt}/${retryMax ?? 3})…`
              : `Uploading… ${uploadProgress ?? 0}%`}
          </p>
        </div>
      )}
      {status === 'error' && (
        <>
          <p className="popup-error">{error}</p>
          <button
            className="popup-btn popup-btn-record"
            onClick={() => setRecordingState({ status: 'idle' })}
          >
            Start Recording
          </button>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredSession();
      setSession(stored);
      const refreshed = await refreshSession().catch(() => stored);
      setSession(refreshed);
      setLoading(false);
    })();
  }, []);

  const handleSignIn = () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    setAuthHint(
      'Secure sign-in window opened. Your current tab stays in place.',
    );

    void initiateSignInAndWait({
      timeoutMs: 2 * 60 * 1000,
      pollIntervalMs: 1200,
    })
      .then((nextSession) => {
        setSession(nextSession);
        if (nextSession.status === 'authenticated') {
          setAuthHint('Connected. You can start recording.');
          return;
        }

        setAuthHint(nextSession.lastError ?? 'Sign-in was not completed.');
      })
      .finally(() => {
        setIsSigningIn(false);
      });
  };

  const handleSignOut = () => {
    void signOut().then(() => setSession({ status: 'unauthenticated' }));
  };

  if (loading) {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <div className="popup-brand">
            <span className="popup-mark">T</span>
            <div>
              <h1 className="popup-title">Tribora</h1>
              <p className="popup-kicker">Extension Console</p>
            </div>
          </div>
          <span className="popup-version">v{VERSION}</span>
        </header>
        <main className="popup-main">
          <div className="popup-panel">
            <p className="popup-description">Loading session state…</p>
          </div>
        </main>
      </div>
    );
  }

  if (
    !session ||
    session.status === 'unauthenticated' ||
    session.status === 'expired'
  ) {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <div className="popup-brand">
            <span className="popup-mark">T</span>
            <div>
              <h1 className="popup-title">Tribora</h1>
              <p className="popup-kicker">Extension Console</p>
            </div>
          </div>
          <span className="popup-version">v{VERSION}</span>
        </header>
        <main className="popup-main">
          <div className="popup-panel">
            <div className="status-indicator status-disconnected">
              <span className="status-dot" />
              <span className="status-label">Disconnected</span>
            </div>
            <h2 className="popup-section-title">Authenticate this browser</h2>
            <p className="popup-description">
              Sign-in opens in a dedicated Tribora window so your current tab
              position stays untouched.
            </p>
            {session?.lastError && (
              <p className="popup-error">{session.lastError}</p>
            )}
            {authHint && (
              <p className="popup-description popup-auth-hint">{authHint}</p>
            )}
          </div>
        </main>
        <footer className="popup-footer">
          <button
            className="popup-btn popup-btn-primary"
            onClick={handleSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? 'Waiting for sign-in…' : 'Sign in'}
          </button>
        </footer>
      </div>
    );
  }

  const displayName = session.user?.name ?? session.user?.email ?? 'Unknown';

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="popup-brand">
          <span className="popup-mark">T</span>
          <div>
            <h1 className="popup-title">Tribora</h1>
            <p className="popup-kicker">Extension Console</p>
          </div>
        </div>
        <span className="popup-version">v{VERSION}</span>
      </header>
      <main className="popup-main">
        <div className="popup-panel">
          <div className="status-indicator status-connected">
            <span className="status-dot" />
            <span className="status-label">Connected</span>
          </div>
          <div className="user-info">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                className="user-avatar"
                width={32}
                height={32}
              />
            )}
            <div className="user-details">
              <div className="user-name">{displayName}</div>
              {session.activeOrg && (
                <div className="user-org">{session.activeOrg.name}</div>
              )}
            </div>
          </div>
        </div>

        <div className="popup-panel">
          <div className="popup-section-copy">
            <div className="popup-section-title">Capture</div>
            <p className="popup-description">
              Record in place and upload directly into your workspace library.
            </p>
          </div>
          <RecordingSection />
        </div>

        <div className="popup-panel popup-debug-section">
          <div className="popup-section-copy">
            <div className="popup-section-title">Session Diagnostics</div>
            <p className="popup-description">
              Prelaunch builds now store verbatim transcripts, tool activity,
              and session events for every new Tribora voice session.
            </p>
          </div>
          <div className="status-indicator status-connected">
            <span className="status-dot" />
            <span className="status-label">Always on</span>
          </div>
        </div>
      </main>
      <footer className="popup-footer">
        <button
          className="popup-btn popup-btn-secondary"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </footer>
    </div>
  );
}
