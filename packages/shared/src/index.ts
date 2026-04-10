export type {
  InteractiveElement,
  PageContext,
  ExtensionMessageType,
  ExtensionMessage,
} from "./types.js";

export type { SessionState, AuthMessage } from "./auth.js";

export type {
  OverlayAction,
  OverlayTarget,
  OverlayMessage,
  OverlayPointMessage,
  OverlayHighlightMessage,
  OverlayPulseMessage,
  OverlayClearMessage,
} from "./overlay.js";

// TRIB-25 — STT types and hotkey defaults
export type { SttStatus, SttState, SttMessage, HotkeyConfig } from "./stt.js";
export { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from "./stt.js";

// TRIB-26 — TTS types and ElevenLabs voice config
export type {
  TtsStatus,
  TtsState,
  TtsMessage,
  ElevenLabsVoiceConfig,
} from "./tts.js";
export { DEFAULT_VOICE_CONFIG } from "./tts.js";

// TRIB-48 — Recording types
export type {
  RecordingStatus,
  RecordingState,
  RecordingMessage,
  RecordingUploadInit,
} from "./recording.js";
