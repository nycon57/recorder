/**
 * tts.ts — Shared TTS types for the Tribora Chrome extension audio pipeline.
 *
 * Used by the content script (audio-playback.ts) and any downstream consumers
 * (background service worker, popup status display).
 *
 * Part of TRIB-26: ElevenLabs streaming TTS.
 */

/** Lifecycle state of the TTS session */
export type TtsStatus = "idle" | "requesting" | "playing" | "error";

/** Current state of the TTS playback pipeline */
export interface TtsState {
  status: TtsStatus;
  /** Text being spoken (when status is 'requesting' or 'playing') */
  text?: string;
  /** Human-readable error message when status === 'error' */
  error?: string;
  /**
   * CSS selector of the element currently being pointed at during speech.
   * Placeholder for Phase 2 cursor sync — populated by element_ref events.
   */
  currentElementRef?: string;
}

/** Message types sent between content script / background service worker for TTS */
export interface TtsMessage {
  type: "TTS_SPEAK" | "TTS_STOP" | "TTS_STATE_REQUEST" | "TTS_STATE_UPDATE";
  /** Text to synthesize via ElevenLabs (TTS_SPEAK) */
  text?: string;
  /** Fallback: pre-generated audio URL to play directly (TTS_SPEAK) */
  audioUrl?: string;
  /** State snapshot (TTS_STATE_UPDATE) */
  state?: TtsState;
}

/** ElevenLabs voice configuration */
export interface ElevenLabsVoiceConfig {
  /** ElevenLabs voice ID */
  voiceId: string;
  /** Model ID — `eleven_flash_v2_5` for low-latency streaming */
  modelId: string;
  /**
   * Voice stability (0–1). Lower values increase expressiveness.
   * PRD default: 0.5
   */
  stability: number;
  /**
   * Similarity boost (0–1). Higher values match the original voice more closely.
   * PRD default: 0.75
   */
  similarityBoost: number;
}

/**
 * Default voice config per PRD (product-architecture-v2.md Part 3 + Part 11).
 *
 * Model: eleven_flash_v2_5 — optimised for streaming latency.
 * Voice: Bella (EXAVITQu4vr4xnSDxMaL) — consistent clicky-style persona.
 * Stability 0.5 / similarity boost 0.75 — same as Clicky's settings.
 */
export const DEFAULT_VOICE_CONFIG: ElevenLabsVoiceConfig = {
  voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella
  modelId: "eleven_flash_v2_5",
  stability: 0.5,
  similarityBoost: 0.75,
};
