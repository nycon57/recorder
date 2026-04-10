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
