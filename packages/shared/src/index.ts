export type {
  InteractiveElement,
  FrameOwner,
  ContextRect,
  ViewportSnapshot,
  PageRegion,
  ContextSnippet,
  ElementInspection,
  PageElementSearchResult,
  PageRegionInspectionResult,
  PageContext,
  SurfaceKind,
  InteractiveGroup,
  DetectionConfidence,
  ContextHeading,
  NavigationItem,
  PageAction,
  SelectedEntity,
  WorkspaceContextItem,
  WorkspaceContext,
  FormField,
  FormSurface,
  TableSurface,
  DialogSurface,
  KnowledgeMatchBasis,
  KnowledgeMatchCategory,
  KnowledgeMatch,
  KnowledgeAvailability,
  KnowledgeResolvedFor,
  LiveContextSourceRef,
  LiveContextPack,
  ExtensionVoiceAnswerCitation,
  ExtensionVoiceAnswerElementRef,
  ExtensionVoiceAnswerRequest,
  ExtensionVoiceAnswerResponse,
  ExtensionMessageType,
  ExtensionMessage,
} from './types.js';
export type {
  ExtensionDebugSessionEventType,
  ExtensionDebugSessionKnowledgeMode,
  ExtensionDebugSessionMatchBasis,
  ExtensionDebugSessionEventInput,
  ExtensionDebugSessionStoredEvent,
} from './extension-debug.js';
export type {
  ExtensionProductTelemetryEventType,
  ExtensionTelemetryKnowledgeMode,
  ExtensionTelemetryMatchBasis,
  ExtensionTelemetryMatchCategory,
  ExtensionTelemetryAuthMethod,
  ExtensionTelemetryJson,
  ExtensionProductTelemetryEventInput,
  ExtensionProductTelemetryStoredEvent,
} from './extension-telemetry.js';
export {
  EXTENSION_PRODUCT_TELEMETRY_EVENT_TYPES,
  findUnsafeTelemetryField,
  isExtensionProductTelemetryEventType,
  isUnsafeTelemetryFieldName,
  sanitizeExtensionProductTelemetryEvent,
} from './extension-telemetry.js';
export {
  buildContextSemanticFingerprint,
  buildKnowledgeResolvedFor,
  knowledgeResolvedForContextMatches,
  knowledgeResolvedForEquals,
  sanitizePageContextLocation,
} from './context-telemetry.js';
export type { SanitizedPageContextLocation } from './context-telemetry.js';
export {
  PAGE_CONTEXT_SANITIZER_LIMITS,
  redactSensitiveText,
  sanitizePageContextLocator,
  sanitizePageContextForModel,
  sanitizePageContextForNetwork,
  sanitizePageContextSelector,
  sanitizePageContextText,
  sanitizePageContextUrl,
} from './page-context-sanitizer.js';

export type { SessionState, AuthMessage } from './auth.js';

export type {
  OverlayAction,
  OverlayTarget,
  OverlayMessage,
  OverlayPointMessage,
  OverlayHighlightMessage,
  OverlayPulseMessage,
  OverlayClearMessage,
} from './overlay.js';

// TRIB-25 — STT types and hotkey defaults
export type { SttStatus, SttState, SttMessage, HotkeyConfig } from './stt.js';
export { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from './stt.js';

// TRIB-26 — TTS types and ElevenLabs voice config
export type {
  TtsStatus,
  TtsState,
  TtsMessage,
  ElevenLabsVoiceConfig,
} from './tts.js';
export { DEFAULT_VOICE_CONFIG } from './tts.js';

// TRIB-48 — Recording types
export type {
  RecordingStatus,
  RecordingState,
  RecordingMessage,
  RecordingUploadInit,
} from './recording.js';
