/**
 * deepgram-client.ts — Native WebSocket streaming client for Deepgram STT.
 *
 * Uses the browser WebSocket API directly (NOT @deepgram/sdk which is
 * Node.js only). Audio is streamed via MediaRecorder chunks over the
 * WebSocket connection.
 *
 * Security: short-lived tokens are fetched from the Tribora backend
 * (/api/extension/deepgram-token) — raw API keys are never bundled.
 *
 * Part of TRIB-25: Deepgram STT + push-to-talk.
 */

import { apiFetch } from "./api-client.js";

// ─── Public types ────────────────────────────────────────────────────────────

export interface DeepgramClientOptions {
  /** Deepgram model name. Defaults to 'nova-2'. */
  model?: string;
  /** BCP-47 language code. Defaults to 'en-US'. */
  language?: string;
  /** Whether to emit interim (partial) results. Defaults to true. */
  interim_results?: boolean;
  /**
   * Seconds of silence before Deepgram sends a final transcript with
   * is_final=true. Defaults to 0.3.
   */
  endpointing?: number;
}

export interface DeepgramToken {
  token: string;
  /** Unix ms timestamp when the token expires */
  expiresAt: number;
}

export interface DeepgramStreamingSession {
  /**
   * Open the WebSocket and start streaming audio from the given MediaStream.
   * Resolves once the connection is open and recording has begun.
   */
  start(stream: MediaStream): Promise<void>;
  /**
   * Stop recording and close the WebSocket.
   * Resolves with the last received final transcript (may be empty string).
   */
  stop(): Promise<string>;
  /** Register a callback for interim (partial) transcript updates. */
  onPartial(handler: (transcript: string) => void): void;
  /** Register a callback for final (is_final=true) transcript segments. */
  onFinal(handler: (transcript: string) => void): void;
  /** Register a callback for connection / transcription errors. */
  onError(handler: (error: Error) => void): void;
}

// ─── Deepgram token fetch ────────────────────────────────────────────────────

/**
 * Fetch a short-lived Deepgram token from the Tribora backend.
 *
 * TODO(TRIB-28): The backend endpoint POST /api/extension/deepgram-token
 * must be implemented before this function can work in production.
 */
export async function getDeepgramToken(): Promise<DeepgramToken> {
  try {
    return await apiFetch<DeepgramToken>("/api/extension/deepgram-token", {
      method: "POST",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404") || message.includes("API 404")) {
      throw new Error(
        "Deepgram token endpoint not yet implemented (waiting for TRIB-28). " +
          "STT will not function until backend routes are deployed. " +
          `Original error: ${message}`,
      );
    }
    throw err;
  }
}

// ─── Deepgram message shape (subset we care about) ───────────────────────────

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramTranscriptMessage {
  type: "Results";
  is_final: boolean;
  speech_final?: boolean;
  channel: DeepgramChannel;
}

// ─── WebSocket session ───────────────────────────────────────────────────────

const DEEPGRAM_WSS_BASE = "wss://api.deepgram.com/v1/listen";
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Build the Deepgram WebSocket URL with query parameters.
 */
function buildUrl(opts: Required<DeepgramClientOptions>): string {
  const params = new URLSearchParams({
    model: opts.model,
    language: opts.language,
    interim_results: String(opts.interim_results),
    endpointing: String(opts.endpointing),
    // Match the MediaRecorder mimeType below. Chrome only supports opus
    // inside webm for MediaRecorder; linear16 PCM would require an
    // AudioWorklet-based encoder path instead. Deepgram accepts opus
    // natively — no explicit sample_rate needed (Deepgram reads the
    // container header).
  });
  return `${DEEPGRAM_WSS_BASE}?${params.toString()}`;
}

/**
 * Create a Deepgram streaming session using the browser WebSocket API.
 * Call `onPartial`, `onFinal`, `onError` before `start()`.
 */
export function createDeepgramSession(
  options: DeepgramClientOptions = {},
): DeepgramStreamingSession {
  const opts: Required<DeepgramClientOptions> = {
    model: options.model ?? "nova-2",
    language: options.language ?? "en-US",
    interim_results: options.interim_results ?? true,
    endpointing: options.endpointing ?? 0.3,
  };

  let partialHandler: ((t: string) => void) | null = null;
  let finalHandler: ((t: string) => void) | null = null;
  let errorHandler: ((e: Error) => void) | null = null;

  let ws: WebSocket | null = null;
  let recorder: MediaRecorder | null = null;
  let lastFinalTranscript = "";
  let resolveStop: ((transcript: string) => void) | null = null;
  let stopped = false;

  // ── Message parser ────────────────────────────────────────────────────────

  function handleMessage(event: MessageEvent): void {
    let msg: DeepgramTranscriptMessage;
    try {
      msg = JSON.parse(event.data as string) as DeepgramTranscriptMessage;
    } catch {
      return; // ignore non-JSON frames (keepalives, metadata)
    }

    if (msg.type !== "Results") return;

    const transcript = msg.channel?.alternatives?.[0]?.transcript ?? "";
    if (!transcript) return;

    if (msg.is_final) {
      lastFinalTranscript = transcript;
      finalHandler?.(transcript);
    } else {
      partialHandler?.(transcript);
    }
  }

  // ── Core connection with retry ────────────────────────────────────────────

  async function connectWithRetry(
    stream: MediaStream,
    attempt: number,
  ): Promise<void> {
    let token: DeepgramToken;
    try {
      token = await getDeepgramToken();
    } catch (err) {
      errorHandler?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    return new Promise<void>((resolve, reject) => {
      const url = buildUrl(opts);
      // Deepgram accepts token auth via the "token" subprotocol.
      // The value is passed as the second element of the subprotocol list.
      const socket = new WebSocket(url, ["token", token.token]);
      socket.binaryType = "arraybuffer";
      ws = socket;

      socket.addEventListener("open", () => {
        // Start MediaRecorder piping audio chunks into the WebSocket
        try {
          // Chrome supports `audio/webm;codecs=opus` natively for MediaRecorder.
          // Deepgram reads the WebM/Opus container and transcribes in real time.
          // (TRIB-59 fix: `codecs=pcm` is not supported by Chrome's MediaRecorder
          // and would throw NotSupportedError at runtime.)
          const mr = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
          });

          mr.addEventListener("dataavailable", (e: BlobEvent) => {
            if (
              socket.readyState === WebSocket.OPEN &&
              e.data &&
              e.data.size > 0
            ) {
              e.data
                .arrayBuffer()
                .then((buf) => {
                  if (socket.readyState === WebSocket.OPEN) {
                    socket.send(buf);
                  }
                })
                .catch(() => {
                  // Ignore — socket may have closed between checks
                });
            }
          });

          mr.start(100); // emit chunks every 100ms for low latency
          recorder = mr;
          resolve();
        } catch (recorderErr) {
          reject(
            recorderErr instanceof Error
              ? recorderErr
              : new Error(String(recorderErr)),
          );
        }
      });

      socket.addEventListener("message", handleMessage);

      socket.addEventListener("close", (event) => {
        if (!stopped && !event.wasClean && attempt < MAX_RETRY_ATTEMPTS) {
          // Exponential backoff retry
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(
            `[Tribora STT] WebSocket closed unexpectedly (code ${event.code}), ` +
              `retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`,
          );
          setTimeout(() => {
            connectWithRetry(stream, attempt + 1).catch((e: unknown) => {
              errorHandler?.(
                e instanceof Error ? e : new Error(String(e)),
              );
            });
          }, delay);
        } else if (stopped) {
          // Normal close after stop() was called
          resolveStop?.(lastFinalTranscript);
          resolveStop = null;
        } else {
          // Max retries exhausted
          const err = new Error(
            `Deepgram WebSocket closed after ${MAX_RETRY_ATTEMPTS} attempts ` +
              `(code ${event.code}: ${event.reason || "unknown"})`,
          );
          errorHandler?.(err);
          resolveStop?.(lastFinalTranscript);
          resolveStop = null;
        }
      });

      socket.addEventListener("error", () => {
        if (attempt < MAX_RETRY_ATTEMPTS && !stopped) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          setTimeout(() => {
            connectWithRetry(stream, attempt + 1).catch((e: unknown) => {
              errorHandler?.(
                e instanceof Error ? e : new Error(String(e)),
              );
            });
          }, delay);
          // Don't reject here — retry will handle it
        } else {
          const err = new Error(
            "Deepgram WebSocket connection error after maximum retries",
          );
          errorHandler?.(err);
          reject(err);
        }
      });
    });
  }

  // ── Public interface ──────────────────────────────────────────────────────

  return {
    onPartial(handler) {
      partialHandler = handler;
    },
    onFinal(handler) {
      finalHandler = handler;
    },
    onError(handler) {
      errorHandler = handler;
    },

    async start(stream: MediaStream): Promise<void> {
      stopped = false;
      lastFinalTranscript = "";
      await connectWithRetry(stream, 1);
    },

    stop(): Promise<string> {
      stopped = true;

      return new Promise<string>((resolve) => {
        resolveStop = resolve;

        // Stop the MediaRecorder first to flush any buffered audio
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
          recorder = null;
        }

        if (!ws || ws.readyState === WebSocket.CLOSED) {
          // Nothing to close — resolve immediately
          const final = lastFinalTranscript;
          resolveStop = null;
          resolve(final);
          return;
        }

        if (ws.readyState === WebSocket.OPEN) {
          // Send Deepgram's close-stream signal, then close the socket
          try {
            ws.send(JSON.stringify({ type: "CloseStream" }));
          } catch {
            // Ignore — socket may already be closing
          }
          // Give Deepgram ~300ms to send its final transcript before we
          // force-close the socket
          setTimeout(() => {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
              ws.close(1000, "recording stopped");
            }
          }, 300);
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
    },
  };
}
