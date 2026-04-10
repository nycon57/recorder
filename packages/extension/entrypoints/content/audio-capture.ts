/**
 * audio-capture.ts — Push-to-talk audio pipeline orchestrator.
 *
 * Wires together the hotkey handler and the Deepgram streaming session.
 * Manages microphone permission state in chrome.storage.local.
 *
 * Usage:
 *   const capture = createAudioCapture(onFinal, onError);
 *   capture.start(); // attach hotkey listeners
 *   // User holds Cmd+Option / Ctrl+Alt to record
 *   capture.stop();  // detach listeners, close any open session
 *
 * Part of TRIB-25: Deepgram STT + push-to-talk.
 */

import { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from "@tribora/shared";
import type { SttState } from "@tribora/shared";
import { createHotkey } from "../../utils/hotkey.js";
import { createDeepgramSession } from "../../utils/deepgram-client.js";

export interface AudioCapture {
  /** Attach keyboard listeners to begin listening for the hotkey. */
  start(): void;
  /** Detach listeners and tear down any in-progress recording session. */
  stop(): void;
  /** Snapshot of the current pipeline state. */
  getState(): SttState;
}

/**
 * Create the audio capture pipeline.
 *
 * @param onTranscript Called with the finalized transcript when recording ends.
 * @param onError      Called with any pipeline error (mic denial, WS failure, etc.).
 */
export function createAudioCapture(
  onTranscript: (final: string) => void,
  onError: (err: Error) => void,
): AudioCapture {
  let state: SttState = { status: "idle" };
  let currentStream: MediaStream | null = null;
  let currentSession: ReturnType<typeof createDeepgramSession> | null = null;

  // Detect platform for default hotkey
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const hotkeyConfig = isMac ? DEFAULT_HOTKEY_MAC : DEFAULT_HOTKEY_WIN;

  // ── Hotkey press handler — start recording ─────────────────────────────

  const handlePress = async (): Promise<void> => {
    // Guard against double-press while already active
    if (state.status !== "idle" && state.status !== "error") return;

    try {
      // 1. Request microphone
      state = { status: "requesting_mic" };
      currentStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Persist permission grant so the popup can show the correct icon
      await chrome.storage.local.set({ micPermissionGranted: true });

      // 2. Create Deepgram session
      state = { status: "listening" };
      const session = createDeepgramSession();

      session.onPartial((t) => {
        state = {
          ...state,
          status: "transcribing",
          partialTranscript: t,
        };
      });

      session.onFinal((t) => {
        state = {
          ...state,
          status: "transcribing",
          finalTranscript: t,
          partialTranscript: undefined,
        };
        // Do NOT call onTranscript here — wait for hotkey release so the
        // user can complete their sentence before we process.
      });

      session.onError((err) => {
        state = { status: "error", error: err.message };
        onError(err);
        // Clean up mic if the session errored
        if (currentStream) {
          currentStream.getTracks().forEach((t) => t.stop());
          currentStream = null;
        }
        currentSession = null;
      });

      // 3. Start streaming
      await session.start(currentStream);
      currentSession = session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Persist mic denial so the popup can show an appropriate message
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        await chrome.storage.local
          .set({ micPermissionGranted: false })
          .catch(() => {
            // storage errors are non-fatal
          });
      }

      state = { status: "error", error: error.message };
      onError(error);

      // Clean up any partially-opened stream
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }
      currentSession = null;
    }
  };

  // ── Hotkey release handler — stop recording + finalize ─────────────────

  const handleRelease = async (): Promise<void> => {
    if (!currentSession && !currentStream) {
      state = { status: "idle" };
      return;
    }

    let finalTranscript = "";

    try {
      if (currentSession) {
        finalTranscript = await currentSession.stop();
        currentSession = null;
      }
    } catch {
      // stop() errors are non-fatal — we still clean up below
    }

    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }

    state = { status: "idle" };

    // Only deliver a transcript if we got meaningful content
    if (finalTranscript.trim()) {
      onTranscript(finalTranscript.trim());
    }
  };

  // ── Hotkey handler ──────────────────────────────────────────────────────

  const hotkey = createHotkey(hotkeyConfig, () => {
    void handlePress();
  }, () => {
    void handleRelease();
  });

  // ── Public interface ────────────────────────────────────────────────────

  return {
    start() {
      hotkey.start();
    },

    stop() {
      hotkey.stop(); // fires handleRelease if currently active
    },

    getState() {
      return state;
    },
  };
}
