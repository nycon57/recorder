import type { KnowledgeAvailability, KnowledgeMatchBasis } from './types.js';

export type ExtensionDebugSessionEventType =
  | 'session_start_requested'
  | 'session_started'
  | 'session_ended'
  | 'session_error'
  | 'mic_permission_opened'
  | 'mic_permission_granted'
  | 'mic_permission_denied'
  | 'mic_permission_resumed'
  | 'page_context_checked'
  | 'contextual_update_sent'
  | 'user_message'
  | 'assistant_message'
  | 'assistant_reply_watchdog_fired'
  | 'duplicate_assistant_reply'
  | 'tool_call_started'
  | 'tool_call_completed';

export type ExtensionDebugSessionKnowledgeMode =
  | KnowledgeAvailability['mode']
  | 'unknown';

export type ExtensionDebugSessionMatchBasis = KnowledgeMatchBasis | 'unknown';

export interface ExtensionDebugSessionEventInput {
  sessionId: string;
  seq: number;
  turnId?: string | null;
  eventType: ExtensionDebugSessionEventType;
  occurredAt: string;
  urlHost?: string | null;
  urlPath?: string | null;
  app?: string | null;
  screen?: string | null;
  knowledgeMode?: ExtensionDebugSessionKnowledgeMode;
  vendorMatchBasis?: ExtensionDebugSessionMatchBasis;
  orgMatchBasis?: ExtensionDebugSessionMatchBasis;
  messageText?: string | null;
  toolName?: string | null;
  selector?: string | null;
  label?: string | null;
  action?: string | null;
  inputTextPreview?: string | null;
  inputTextLength?: number | null;
  resultText?: string | null;
  error?: string | null;
  pageSummary?: string | null;
  selectedEntityTitle?: string | null;
  tabId?: number | null;
  windowId?: number | null;
  conversationId?: string | null;
  fingerprint?: string | null;
}

export interface ExtensionDebugSessionStoredEvent
  extends ExtensionDebugSessionEventInput {
  orgId: string;
  actorId: string | null;
  authMethod: 'session' | 'api_key';
}
