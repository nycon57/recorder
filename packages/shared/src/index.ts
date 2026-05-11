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
} from './types';
export type {
  ExtensionDebugSessionEventType,
  ExtensionDebugSessionKnowledgeMode,
  ExtensionDebugSessionMatchBasis,
  ExtensionDebugSessionEventInput,
  ExtensionDebugSessionStoredEvent,
} from './extension-debug';
export type {
  ExtensionProductTelemetryEventType,
  ExtensionTelemetryKnowledgeMode,
  ExtensionTelemetryMatchBasis,
  ExtensionTelemetryMatchCategory,
  ExtensionTelemetryAuthMethod,
  ExtensionTelemetryJson,
  ExtensionProductTelemetryEventInput,
  ExtensionProductTelemetryStoredEvent,
} from './extension-telemetry';
export {
  EXTENSION_PRODUCT_TELEMETRY_EVENT_TYPES,
  findUnsafeTelemetryField,
  isExtensionProductTelemetryEventType,
  isUnsafeTelemetryFieldName,
  sanitizeExtensionProductTelemetryEvent,
} from './extension-telemetry';
export {
  buildContextSemanticFingerprint,
  buildKnowledgeResolvedFor,
  knowledgeResolvedForContextMatches,
  knowledgeResolvedForEquals,
  sanitizePageContextLocation,
} from './context-telemetry';
export type { SanitizedPageContextLocation } from './context-telemetry';
export {
  PAGE_CONTEXT_SANITIZER_LIMITS,
  redactSensitiveText,
  sanitizePageContextForModel,
  sanitizePageContextForNetwork,
  sanitizePageContextSelector,
  sanitizePageContextText,
  sanitizePageContextUrl,
} from './page-context-sanitizer';

export type { SessionState, AuthMessage } from './auth';

export type {
  OverlayAction,
  OverlayTarget,
  OverlayMessage,
  OverlayPointMessage,
  OverlayHighlightMessage,
  OverlayPulseMessage,
  OverlayClearMessage,
} from './overlay';

// TRIB-25 — STT types and hotkey defaults
export type { SttStatus, SttState, SttMessage, HotkeyConfig } from './stt';
export { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from './stt';

// TRIB-26 — TTS types and ElevenLabs voice config
export type {
  TtsStatus,
  TtsState,
  TtsMessage,
  ElevenLabsVoiceConfig,
} from './tts';
export { DEFAULT_VOICE_CONFIG } from './tts';

export type {
  ExtensionVoiceRuntime,
  OpenAIRealtimeReasoningEffort,
  OpenAIRealtimeToolName,
  OpenAIRealtimeToolCall,
  OpenAIRealtimeFunctionTool,
  ElevenLabsVoiceSessionPayload,
  OpenAIRealtimeVoiceSessionPayload,
  ExtensionVoiceSessionPayload,
} from './voice-runtime';
export {
  EXTENSION_VOICE_RUNTIMES,
  DEFAULT_EXTENSION_VOICE_RUNTIME,
  DEFAULT_OPENAI_REALTIME_MODEL,
  DEFAULT_OPENAI_REALTIME_VOICE,
  DEFAULT_OPENAI_REALTIME_REASONING_EFFORT,
  parseExtensionVoiceRuntime,
  normalizeExtensionVoiceRuntime,
  normalizeOpenAIRealtimeReasoningEffort,
  buildTriboraVoiceAgentInstructions,
  buildOpenAIRealtimeToolDefinitions,
  buildOpenAIRealtimeSessionConfig,
  extractOpenAIRealtimeToolCalls,
  buildOpenAIRealtimeFunctionOutputEvent,
  buildOpenAIRealtimeContextUpdateEvent,
} from './voice-runtime';

// TRIB-48 — Recording types
export type {
  RecordingStatus,
  RecordingState,
  RecordingMessage,
  RecordingUploadInit,
} from './recording';
