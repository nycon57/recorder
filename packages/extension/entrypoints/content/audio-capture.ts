/**
 * audio-capture.ts — Push-to-talk audio pipeline orchestrator.
 *
 * Wires together the hotkey handler and the ElevenLabs STT session.
 * Manages microphone permission state in chrome.storage.local.
 *
 * Usage:
 *   const capture = createAudioCapture(onFinal, onError, onStateChange);
 *   capture.start(); // attach hotkey listeners
 *   // User holds Cmd+Option / Ctrl+Alt to record
 *   capture.stop();  // detach listeners, close any open session
 */

import { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from "@tribora/shared";
import type { SttState, AssistantState } from "@tribora/shared";
import { createHotkey } from "../../utils/hotkey.js";
import { createSttSession } from "../../utils/stt-client.js";

export interface AudioCapture {
  start(): void;
  stop(): void;
  getState(): SttState;
  /** Returns the mic AnalyserNode when recording, null otherwise. */
  getAnalyserNode(): AnalyserNode | null;
}

/**
 * Create the audio capture pipeline.
 *
 * @param onTranscript   Called with the finalized transcript when recording ends.
 * @param onError        Called with any pipeline error (mic denial, etc.).
 * @param onStateChange  Called at each assistant lifecycle transition so the
 *                       caller can broadcast state to the popup via storage.
 */
export function createAudioCapture(
  onTranscript: (final: string) => void,
  onError: (err: Error) => void,
  onStateChange?: (state: Pick<AssistantState, "status" | "error" | "updatedAt">) => void,
): AudioCapture {
  let state: SttState = { status: "idle" };
  let currentStream: MediaStream | null = null;
  let currentSession: ReturnType<typeof createSttSession> | null = null;
  let audioContext: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const hotkeyConfig = isMac ? DEFAULT_HOTKEY_MAC : DEFAULT_HOTKEY_WIN;

  const broadcast = (s: Pick<AssistantState, "status" | "error">) => {
    onStateChange?.({ ...s, updatedAt: Date.now() });
  };

  // ── Hotkey press handler — start recording ─────────────────────────────

  const handlePress = async (): Promise<void> => {
    if (state.status !== "idle" && state.status !== "error") return;

    try {
      state = { status: "requesting_mic" };
      currentStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      await chrome.storage.local.set({ micPermissionGranted: true });

      // Create AnalyserNode for waveform visualization
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(currentStream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 64;
      source.connect(analyserNode);

      state = { status: "listening" };
      broadcast({ status: "listening" });

      const session = createSttSession();

      session.onError((err) => {
        state = { status: "error", error: err.message };
        broadcast({ status: "error", error: err.message });
        onError(err);
        if (currentStream) {
          currentStream.getTracks().forEach((t) => t.stop());
          currentStream = null;
        }
        currentSession = null;
      });

      session.start(currentStream);
      currentSession = session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        await chrome.storage.local
          .set({ micPermissionGranted: false })
          .catch(() => {});
      }

      state = { status: "error", error: error.message };
      broadcast({ status: "error", error: error.message });
      onError(error);

      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
        currentStream = null;
      }
      currentSession = null;
    }
  };

  // ── Hotkey release handler — stop recording + transcribe ─────────────────

  const handleRelease = async (): Promise<void> => {
    if (!currentSession && !currentStream) {
      state = { status: "idle" };
      return;
    }

    let finalTranscript = "";

    try {
      if (currentSession) {
        state = { status: "transcribing" };
        broadcast({ status: "transcribing" });
        finalTranscript = await currentSession.stop();
        currentSession = null;
      }
    } catch {
      // stop() errors are non-fatal
    }

    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }

    // Clean up audio context
    analyserNode = null;
    if (audioContext) {
      void audioContext.close().catch(() => {});
      audioContext = null;
    }

    state = { status: "idle" };

    if (finalTranscript.trim()) {
      onTranscript(finalTranscript.trim());
      // Don't broadcast idle yet — background will take over with "answering"
    } else {
      broadcast({ status: "idle" });
    }
  };

  const hotkey = createHotkey(hotkeyConfig, () => {
    void handlePress();
  }, () => {
    void handleRelease();
  });

  return {
    start() {
      hotkey.start();
    },
    stop() {
      hotkey.stop();
    },
    getState() {
      return state;
    },
    getAnalyserNode() {
      return analyserNode;
    },
  };
}
