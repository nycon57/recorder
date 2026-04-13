/**
 * stt-client.ts — ElevenLabs Scribe STT client for the Tribora Chrome extension.
 *
 * Records audio during push-to-talk, then sends the audio blob to the
 * Tribora backend (/api/extension/stt) which proxies to ElevenLabs
 * Scribe v2 for transcription.
 *
 * Replaces deepgram-client.ts — single-vendor approach using ElevenLabs
 * for both STT and TTS.
 */

import { getStoredSession } from "./api-client.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface SttSession {
  /** Start recording from the given MediaStream. */
  start(stream: MediaStream): void;
  /**
   * Stop recording and transcribe the captured audio.
   * Resolves with the final transcript (may be empty string).
   */
  stop(): Promise<string>;
  /** Register a callback for errors. */
  onError(handler: (error: Error) => void): void;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Create an STT session that records audio and transcribes via the backend.
 *
 * Unlike the old Deepgram WebSocket approach, this records audio locally
 * and sends the complete recording for batch transcription on release.
 */
export function createSttSession(): SttSession {
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let errorHandler: ((e: Error) => void) | null = null;

  return {
    onError(handler) {
      errorHandler = handler;
    },

    start(stream: MediaStream) {
      chunks = [];
      try {
        const mr = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });

        mr.addEventListener("dataavailable", (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        });

        mr.addEventListener("error", () => {
          const err = new Error("MediaRecorder error during audio capture");
          errorHandler?.(err);
        });

        // Collect chunks every 250ms
        mr.start(250);
        recorder = mr;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errorHandler?.(error);
      }
    },

    async stop(): Promise<string> {
      if (!recorder || recorder.state === "inactive") {
        return "";
      }

      // Stop the recorder and wait for the final dataavailable event
      const audioBlob = await new Promise<Blob>((resolve) => {
        recorder!.addEventListener(
          "stop",
          () => {
            resolve(new Blob(chunks, { type: "audio/webm;codecs=opus" }));
            chunks = [];
          },
          { once: true },
        );
        recorder!.stop();
        recorder = null;
      });

      if (audioBlob.size === 0) {
        return "";
      }

      // Send to backend for transcription
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const session = await getStoredSession();

        const API_BASE_URL =
          (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
          "http://localhost:3000";

        const headers: Record<string, string> = {};
        if (session?.token) {
          headers["Authorization"] = `Bearer ${session.token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/extension/stt`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`STT request failed: HTTP ${response.status}`);
        }

        const data = (await response.json()) as { text: string };
        return data.text ?? "";
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errorHandler?.(error);
        return "";
      }
    },
  };
}
