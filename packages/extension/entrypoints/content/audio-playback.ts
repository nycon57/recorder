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
  let currentObjectUrl: string | null = null;
  let currentSession: { cleanup: () => void } | null = null;
  // Session token: every call to speak()/playUrl() gets a fresh token so
  // later-starting awaits from earlier calls can detect that they've been
  // superseded and bail out before clobbering state. Prevents the race where
  // an old speak() completes its stream read after a newer speak() started.
  let activeToken = 0;

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
    if (currentObjectUrl) {
      // Revoke the blob URL synchronously. Previously this only happened on
      // audio.onended/onerror, which leaked the URL if a new speak() started
      // mid-playback or the stream was aborted.
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
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
      const token = ++activeToken;
      setState({ status: "requesting", text });

      try {
        const session = await streamTts(text);
        // If a newer speak()/playUrl()/stop() started while we were waiting
        // on the backend, abandon this stream entirely.
        if (token !== activeToken) {
          session.cleanup();
          return;
        }
        currentSession = session;

        // Collect the full stream into chunks, then build a Blob.
        // Phase 1 simplification: HTMLAudioElement requires a complete source.
        // Phase 2 enhancement: MediaSource API for true chunk-by-chunk playback.
        const reader = session.stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Stream read is the main async boundary — re-check the token on
          // every chunk so we can bail out promptly if we've been superseded.
          if (token !== activeToken) {
            try {
              await reader.cancel();
            } catch {
              // cancel() errors are non-fatal
            }
            session.cleanup();
            return;
          }
          if (value) chunks.push(value);
        }

        // Re-check one more time before we touch any shared state.
        if (token !== activeToken) {
          session.cleanup();
          return;
        }

        // Session stream is exhausted — cleanup the request handle
        currentSession.cleanup();
        currentSession = null;

        const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
        const objectUrl = URL.createObjectURL(blob);
        currentObjectUrl = objectUrl;

        const audio = new Audio(objectUrl);
        currentAudio = audio;

        audio.onended = () => {
          if (token !== activeToken) return;
          URL.revokeObjectURL(objectUrl);
          currentObjectUrl = null;
          currentAudio = null;
          setState({ status: "idle" });
        };

        audio.onerror = () => {
          if (token !== activeToken) return;
          URL.revokeObjectURL(objectUrl);
          currentObjectUrl = null;
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
        // Do not clobber state if a newer call has taken over.
        if (token !== activeToken) return;
        teardown();
        const message = (error as Error).message;
        console.error("[Tribora TTS]", message);
        setState({ status: "error", text, error: message });
      }
    },

    async playUrl(url: string): Promise<void> {
      teardown();
      const token = ++activeToken;
      setState({ status: "playing" });

      try {
        const audio = new Audio(url);
        currentAudio = audio;

        audio.onended = () => {
          if (token !== activeToken) return;
          currentAudio = null;
          setState({ status: "idle" });
        };

        audio.onerror = () => {
          if (token !== activeToken) return;
          currentAudio = null;
          setState({
            status: "error",
            error: "Audio element failed to play the provided URL.",
          });
        };

        await audio.play();
      } catch (error) {
        if (token !== activeToken) return;
        teardown();
        setState({
          status: "error",
          error: (error as Error).message,
        });
      }
    },

    stop(): void {
      // Bump the token so any in-flight awaits on the old session bail out.
      activeToken++;
      teardown();
      setState({ status: "idle" });
    },

    getState(): TtsState {
      return state;
    },
  };
}
