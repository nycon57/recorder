/**
 * elevenlabs-client.ts — Streaming TTS client for the Tribora Chrome extension.
 *
 * Fetches a streaming audio response from the Tribora backend proxy
 * (POST /api/extension/tts), which in turn calls ElevenLabs. This ensures
 * the ElevenLabs API key is never bundled in the extension.
 *
 * For Phase 1 MVP the backend endpoint is not yet implemented. If it returns
 * 404 a descriptive error is thrown so the caller can log it and degrade
 * gracefully rather than crashing silently.
 *
 * Security: session token is forwarded by api-client via Authorization header.
 *
 * Part of TRIB-26: ElevenLabs streaming TTS.
 */

import { getStoredSession } from "./api-client.js";
import type { ElevenLabsVoiceConfig } from "@tribora/shared";
import { DEFAULT_VOICE_CONFIG } from "@tribora/shared";

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  "http://localhost:3000";

/**
 * Timeout (ms) for the initial backend TTS request. The stream itself has
 * no total-duration ceiling — only the request/connect phase is bounded so
 * a dead backend doesn't leave a pending fetch forever.
 */
const TTS_REQUEST_TIMEOUT_MS = 15_000;

// ─── Public types ────────────────────────────────────────────────────────────

/** A live TTS streaming session — callers read from `stream` and call
 *  `cleanup()` when done or on early abort. */
export interface TtsStreamSession {
  /** Raw audio bytes (MP3) from ElevenLabs, streamed via the backend proxy. */
  stream: ReadableStream<Uint8Array>;
  /** Abort the underlying request and release resources. */
  cleanup: () => void;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Request a streaming TTS audio response from the Tribora backend proxy.
 *
 * The backend is expected to:
 *  1. Validate the session token
 *  2. Call ElevenLabs `/v1/text-to-speech/{voiceId}/stream` with the voice config
 *  3. Pipe the MP3 audio stream back as `application/octet-stream`
 *
 * @param text  Text to synthesize.
 * @param voice Voice config (defaults to `DEFAULT_VOICE_CONFIG` from PRD).
 * @throws If the backend endpoint is unavailable or returns an error.
 */
export async function streamTts(
  text: string,
  voice: ElevenLabsVoiceConfig = DEFAULT_VOICE_CONFIG,
): Promise<TtsStreamSession> {
  const headers = new Headers({ "Content-Type": "application/json" });

  // Attach auth token if available
  const session = await getStoredSession();
  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  // AbortController bounds the request/connect phase with an explicit timeout
  // and gives callers a handle to cancel in-flight streams cleanly.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort(new Error(`[Tribora TTS] Request timed out after ${TTS_REQUEST_TIMEOUT_MS}ms`));
  }, TTS_REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/extension/tts`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ text, voice }),
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutHandle);
    if ((networkErr as Error).name === "AbortError") {
      throw new Error(
        `[Tribora TTS] Request aborted: ${(networkErr as Error).message}`,
      );
    }
    throw new Error(
      `[Tribora TTS] Network error reaching /api/extension/tts: ${(networkErr as Error).message}`,
    );
  }

  // Headers are in — the connect-phase timeout has fired its job. Streaming
  // the body has no further ceiling; cleanup() below still aborts on demand.
  clearTimeout(timeoutHandle);

  if (!response.ok) {
    if (response.status === 404) {
      // Backend TTS endpoint is not yet deployed — Phase 1 stub.
      throw new Error(
        "[Tribora TTS] Backend endpoint POST /api/extension/tts not yet implemented. " +
          "Audio playback requires the TTS proxy backend to be deployed. " +
          "This will be resolved in a follow-up issue.",
      );
    }
    throw new Error(
      `[Tribora TTS] TTS request failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error(
      "[Tribora TTS] TTS response has no body — backend must stream audio bytes.",
    );
  }

  return {
    stream: response.body,
    cleanup: () => {
      try {
        // Aborting the controller cancels both the fetch and any reader
        // reads from response.body, guaranteeing cleanup under all states.
        controller.abort();
      } catch {
        // abort() errors are non-fatal
      }
      try {
        void response.body?.cancel();
      } catch {
        // cancel() errors are non-fatal
      }
    },
  };
}
