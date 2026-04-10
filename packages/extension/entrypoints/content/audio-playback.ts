/**
 * audio-playback.ts — TTS audio playback orchestrator for the Tribora extension.
 *
 * Provides a `createAudioPlayer()` factory that handles:
 *   - Streaming audio from ElevenLabs via the Tribora backend proxy
 *   - Direct URL playback (fallback when backend returns a pre-generated URL)
 *   - Lifecycle state management (idle → requesting → playing → idle/error)
 *   - Clean teardown on stop or error
 *
 * Phase 1 notes:
 *   - Streaming is collected into a Blob before playback (HTMLAudioElement).
 *     True chunk-by-chunk playback via MediaSource API is a Phase 2 enhancement.
 *   - Element reference sync (cursor animations) is a Phase 2 feature.
 *     `currentElementRef` in TtsState is a placeholder for that wiring.
 *
 * Part of TRIB-26: ElevenLabs streaming TTS.
 */

import { streamTts } from "../../utils/elevenlabs-client.js";
import type { TtsState } from "@tribora/shared";

// ─── Public types ────────────────────────────────────────────────────────────

export interface AudioPlayer {
  /**
   * Synthesize `text` via ElevenLabs and play the resulting audio.
   * Collects the full stream before playback starts (Phase 1 approach).
   * Rejects if the backend endpoint is unavailable — caller should handle.
   */
  speak(text: string): Promise<void>;

  /**
   * Play audio directly from a URL (fallback when the backend returns a
   * pre-generated audio URL rather than a live stream).
   */
  playUrl(url: string): Promise<void>;

  /** Stop any currently playing audio and reset to idle state. */
  stop(): void;

  /** Snapshot of the current playback state. */
  getState(): TtsState;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a TTS audio player.
 *
 * @param onStateChange Optional callback invoked on every state transition.
 *                      Useful for syncing UI or logging without coupling to
 *                      a specific framework.
 */
export function createAudioPlayer(
  onStateChange?: (state: TtsState) => void,
): AudioPlayer {
  let state: TtsState = { status: "idle" };
  let currentAudio: HTMLAudioElement | null = null;
  let currentSession: { cleanup: () => void } | null = null;

  // ── Internal helpers ────────────────────────────────────────────────────

  const setState = (next: TtsState): void => {
    state = next;
    onStateChange?.(state);
  };

  const teardown = (): void => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }
    if (currentSession) {
      currentSession.cleanup();
      currentSession = null;
    }
  };

  // ── Public interface ────────────────────────────────────────────────────

  return {
    async speak(text: string): Promise<void> {
      teardown();
      setState({ status: "requesting", text });

      try {
        const session = await streamTts(text);
        currentSession = session;

        // Collect the full stream into chunks, then build a Blob.
        // Phase 1 simplification: HTMLAudioElement requires a complete source.
        // Phase 2 enhancement: MediaSource API for true chunk-by-chunk playback.
        const reader = session.stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }

        // Session stream is exhausted — cleanup the request handle
        currentSession.cleanup();
        currentSession = null;

        const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
        const objectUrl = URL.createObjectURL(blob);

        const audio = new Audio(objectUrl);
        currentAudio = audio;

        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          currentAudio = null;
          setState({ status: "idle" });
        };

        audio.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          currentAudio = null;
          setState({
            status: "error",
            text,
            error: "Audio element failed to play the TTS response.",
          });
        };

        setState({ status: "playing", text });
        await audio.play();
      } catch (error) {
        teardown();
        const message = (error as Error).message;
        console.error("[Tribora TTS]", message);
        setState({ status: "error", text, error: message });
      }
    },

    async playUrl(url: string): Promise<void> {
      teardown();
      setState({ status: "playing" });

      try {
        const audio = new Audio(url);
        currentAudio = audio;

        audio.onended = () => {
          currentAudio = null;
          setState({ status: "idle" });
        };

        audio.onerror = () => {
          currentAudio = null;
          setState({
            status: "error",
            error: "Audio element failed to play the provided URL.",
          });
        };

        await audio.play();
      } catch (error) {
        teardown();
        setState({
          status: "error",
          error: (error as Error).message,
        });
      }
    },

    stop(): void {
      teardown();
      setState({ status: "idle" });
    },

    getState(): TtsState {
      return state;
    },
  };
}
