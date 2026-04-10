import React, { useEffect, useState } from "react";
import type { SessionState, RecordingState } from "@tribora/shared";
import { getStoredSession } from "../../utils/api-client.js";
import {
  initiateSignIn,
  refreshSession,
  signOut,
} from "../../utils/auth-session.js";

const VERSION = "0.0.1";

function RecordingSection() {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    status: "idle",
  });

  const startRecording = () => {
    setRecordingState({ status: "requesting_capture" });
    chrome.runtime.sendMessage(
      { type: "RECORDING_START" },
      (response: { ok: boolean; state?: RecordingState; error?: string }) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setRecordingState({
            status: "error",
            error: chrome.runtime.lastError?.message ?? response?.error ?? "Failed to start",
          });
          return;
        }
        setRecordingState(response.state ?? { status: "recording", startedAt: Date.now() });
      },
    );
  };

  const stopRecording = () => {
    setRecordingState((prev) => ({ ...prev, status: "uploading" }));
    chrome.runtime.sendMessage(
      { type: "RECORDING_STOP" },
      (response: { ok: boolean; recordingId?: string; error?: string }) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setRecordingState({
            status: "error",
            error: chrome.runtime.lastError?.message ?? response?.error ?? "Failed to stop",
          });
          return;
        }
        setRecordingState({ status: "idle", recordingId: response.recordingId });
      },
    );
  };

  const { status, error, recordingId } = recordingState;

  return (
    <div className="recording-section">
      {status === "idle" && (
        <>
          {recordingId && (
            <p className="recording-success">Recording saved!</p>
          )}
          <button
            className="popup-btn popup-btn-record"
            onClick={startRecording}
          >
            Start Recording
          </button>
        </>
      )}
      {status === "requesting_capture" && (
        <button className="popup-btn popup-btn-record" disabled>
          Requesting capture…
        </button>
      )}
      {status === "recording" && (
        <button
          className="popup-btn popup-btn-stop"
          onClick={stopRecording}
        >
          Stop Recording
        </button>
      )}
      {status === "uploading" && (
        <button className="popup-btn popup-btn-record" disabled>
          Uploading…
        </button>
      )}
      {status === "error" && (
        <>
          <p className="popup-error">{error}</p>
          <button
            className="popup-btn popup-btn-record"
            onClick={() => setRecordingState({ status: "idle" })}
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

  useEffect(() => {
    void (async () => {
      const stored = await getStoredSession();
      setSession(stored);
      setLoading(false);

      // If stored but expired, refresh immediately
      if (
        stored?.status === "authenticated" &&
        stored.expiresAt &&
        stored.expiresAt < Date.now()
      ) {
        const refreshed = await refreshSession();
        setSession(refreshed);
      }
    })();
  }, []);

  const handleSignOut = () => {
    void signOut().then(() => setSession({ status: "unauthenticated" }));
  };

  if (loading) {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <h1 className="popup-title">Tribora</h1>
          <span className="popup-version">v{VERSION}</span>
        </header>
        <main className="popup-main">
          <p className="popup-description">Loading…</p>
        </main>
      </div>
    );
  }

  if (
    !session ||
    session.status === "unauthenticated" ||
    session.status === "expired"
  ) {
    return (
      <div className="popup-container">
        <header className="popup-header">
          <h1 className="popup-title">Tribora</h1>
          <span className="popup-version">v{VERSION}</span>
        </header>
        <main className="popup-main">
          <div className="status-indicator status-disconnected">
            <span className="status-dot" />
            <span className="status-label">Not connected</span>
          </div>
          <p className="popup-description">
            Sign in to start capturing knowledge.
          </p>
          {session?.lastError && (
            <p className="popup-error">{session.lastError}</p>
          )}
        </main>
        <footer className="popup-footer">
          <button
            className="popup-btn popup-btn-primary"
            onClick={initiateSignIn}
          >
            Sign in
          </button>
        </footer>
      </div>
    );
  }

  const displayName = session.user?.name ?? session.user?.email ?? "Unknown";

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">Tribora</h1>
        <span className="popup-version">v{VERSION}</span>
      </header>
      <main className="popup-main">
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
        <RecordingSection />
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
