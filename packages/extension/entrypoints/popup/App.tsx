import React, { useEffect, useState } from "react";
import type { SessionState, AssistantState } from "@tribora/shared";
import { ASSISTANT_STATE_KEY } from "@tribora/shared";
import { getStoredSession } from "../../utils/api-client.js";
import {
  initiateSignIn,
  refreshSession,
  signOut,
} from "../../utils/auth-session.js";

const VERSION = "0.0.1";

function statusLabel(status: AssistantState["status"]): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "listening":
      return "Listening...";
    case "transcribing":
      return "Processing...";
    case "answering":
      return "Thinking...";
    case "speaking":
      return "Speaking...";
    case "error":
      return "Error";
  }
}

function AssistantPanel() {
  const [assistantState, setAssistantState] = useState<AssistantState>({
    status: "idle",
  });
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const isMac = navigator.platform.toLowerCase().includes("mac");

  useEffect(() => {
    void (async () => {
      const result = await chrome.storage.session.get(ASSISTANT_STATE_KEY);
      if (result[ASSISTANT_STATE_KEY]) {
        setAssistantState(result[ASSISTANT_STATE_KEY] as AssistantState);
      }
      const micResult = await chrome.storage.local.get("micPermissionGranted");
      setMicPermission(micResult.micPermissionGranted ?? null);
    })();
  }, []);

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === "session" && changes[ASSISTANT_STATE_KEY]) {
        const newVal = changes[ASSISTANT_STATE_KEY].newValue as
          | AssistantState
          | undefined;
        if (newVal) setAssistantState(newVal);
      }
      if (area === "local" && changes.micPermissionGranted) {
        setMicPermission(changes.micPermissionGranted.newValue ?? null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div className="assistant-panel">
      <div className="assistant-hotkey">
        <span className="hotkey-icon">🎤</span>
        <span className="hotkey-label">
          Hold{" "}
          <kbd>{isMac ? "⌘" : "Ctrl"}+{isMac ? "⌥" : "Alt"}</kbd>{" "}
          to ask a question
        </span>
      </div>

      {micPermission === false && (
        <div className="assistant-warning">
          Microphone access denied. Allow mic access in your browser settings to
          use voice commands.
        </div>
      )}

      <div
        className={`assistant-status assistant-status-${assistantState.status}`}
      >
        <span className="assistant-status-dot" />
        <span className="assistant-status-label">
          {statusLabel(assistantState.status)}
        </span>
      </div>

      {assistantState.error && assistantState.status === "error" && (
        <p className="popup-error">{assistantState.error}</p>
      )}

      {assistantState.lastQuestion && (
        <div className="assistant-last-qa">
          <div className="qa-question">
            &ldquo;{assistantState.lastQuestion}&rdquo;
          </div>
          {assistantState.lastAnswerPreview && (
            <div className="qa-answer">{assistantState.lastAnswerPreview}</div>
          )}
        </div>
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

      // If we have a valid, non-expired session, use it immediately
      if (
        stored?.status === "authenticated" &&
        stored.expiresAt &&
        stored.expiresAt > Date.now()
      ) {
        setSession(stored);
        setLoading(false);
        return;
      }

      // Otherwise, always try to refresh — this detects sessions from
      // web sign-in, expired sessions, and first-time popup opens.
      // Uses chrome.cookies to read the website's session cookie.
      const refreshed = await refreshSession();
      setSession(refreshed);
      setLoading(false);
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
          <p className="popup-description">Loading...</p>
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
            Sign in to start using the AI assistant.
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
        <AssistantPanel />
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
