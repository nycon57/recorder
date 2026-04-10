/**
 * stt.ts — Shared STT types for the Tribora Chrome extension audio pipeline.
 *
 * Used by both the content script (audio-capture.ts) and any downstream
 * consumers (TRIB-26 TTS pipeline, popup status display).
 *
 * Part of TRIB-25: Deepgram STT + push-to-talk.
 */

/** Lifecycle state of the STT session */
export type SttStatus =
  | "idle"
  | "requesting_mic"
  | "listening"
  | "transcribing"
  | "error";

/** Current state of the audio / transcription pipeline */
export interface SttState {
  status: SttStatus;
  /** Most recent partial (interim) transcript — updated in real-time */
  partialTranscript?: string;
  /** Finalized transcript, available after hotkey release */
  finalTranscript?: string;
  /** Human-readable error message when status === 'error' */
  error?: string;
}

/** Message types sent between content script and background service worker */
export interface SttMessage {
  type:
    | "STT_START"
    | "STT_STOP"
    | "STT_PARTIAL"
    | "STT_FINAL"
    | "STT_ERROR"
    | "STT_STATE_REQUEST";
  state?: SttState;
  transcript?: string;
}

/** Keyboard modifier combination that triggers push-to-talk */
export interface HotkeyConfig {
  modifiers: ("cmd" | "ctrl" | "alt" | "shift")[];
  /**
   * Optional additional non-modifier key (e.g. "k" for Cmd+K).
   * When absent, the modifier combination alone triggers the hotkey.
   */
  key?: string;
}

/** Mac default: Cmd+Option (Meta + Alt) */
export const DEFAULT_HOTKEY_MAC: HotkeyConfig = {
  modifiers: ["cmd", "alt"],
};

/** Windows/Linux default: Ctrl+Alt */
export const DEFAULT_HOTKEY_WIN: HotkeyConfig = {
  modifiers: ["ctrl", "alt"],
};
