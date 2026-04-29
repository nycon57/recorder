import type {
  KnowledgeAvailability,
  KnowledgeMatchBasis,
  KnowledgeMatchCategory,
} from './types.js';
import { sanitizePageContextLocation } from './context-telemetry.js';
import { sanitizePageContextText } from './page-context-sanitizer.js';

export type ExtensionProductTelemetryEventType =
  | 'sdk_init'
  | 'session_start_requested'
  | 'session_started'
  | 'session_ended'
  | 'session_error'
  | 'turn_started'
  | 'turn_completed'
  | 'message_observed'
  | 'assistant_answer_outcome'
  | 'assistant_reply_watchdog_fired'
  | 'duplicate_assistant_reply_detected'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'context_lookup'
  | 'live_context_update'
  | 'query'
  | 'voice_usage'
  | 'tts_usage';

export type ExtensionTelemetryKnowledgeMode =
  | KnowledgeAvailability['mode']
  | 'unknown';

export type ExtensionTelemetryMatchBasis = KnowledgeMatchBasis | 'unknown';
export type ExtensionTelemetryMatchCategory =
  | KnowledgeMatchCategory
  | 'unknown';

export type ExtensionTelemetryAuthMethod = 'session' | 'api_key';

export type ExtensionTelemetryJson =
  | string
  | number
  | boolean
  | null
  | ExtensionTelemetryJson[]
  | { [key: string]: ExtensionTelemetryJson | undefined };

export interface ExtensionProductTelemetryEventInput {
  eventId: string;
  eventType: ExtensionProductTelemetryEventType;
  occurredAt: string;
  seq?: number | null;
  sessionId?: string | null;
  conversationId?: string | null;
  turnId?: string | null;
  urlHost?: string | null;
  urlPath?: string | null;
  app?: string | null;
  screen?: string | null;
  knowledgeMode?: ExtensionTelemetryKnowledgeMode | null;
  vendorMatchBasis?: ExtensionTelemetryMatchBasis | null;
  orgMatchBasis?: ExtensionTelemetryMatchBasis | null;
  vendorMatchCategory?: ExtensionTelemetryMatchCategory | null;
  orgMatchCategory?: ExtensionTelemetryMatchCategory | null;
  latencyMs?: number | null;
  sourceCount?: number | null;
  sourceKinds?: string[] | null;
  outcome?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  messageDirection?: 'user' | 'assistant' | 'system' | null;
  messageLength?: number | null;
  toolName?: string | null;
  action?: string | null;
  selectorPresent?: boolean | null;
  inputTextLength?: number | null;
  outputTextLength?: number | null;
  fingerprint?: string | null;
  metadata?: Record<string, ExtensionTelemetryJson | undefined> | null;
}

export interface ExtensionProductTelemetryStoredEvent
  extends ExtensionProductTelemetryEventInput {
  orgId: string;
  actorId: string | null;
  authMethod: ExtensionTelemetryAuthMethod;
}

export const EXTENSION_PRODUCT_TELEMETRY_EVENT_TYPES: readonly ExtensionProductTelemetryEventType[] =
  [
    'sdk_init',
    'session_start_requested',
    'session_started',
    'session_ended',
    'session_error',
    'turn_started',
    'turn_completed',
    'message_observed',
    'assistant_answer_outcome',
    'assistant_reply_watchdog_fired',
    'duplicate_assistant_reply_detected',
    'tool_call_started',
    'tool_call_completed',
    'context_lookup',
    'live_context_update',
    'query',
    'voice_usage',
    'tts_usage',
  ];

const EVENT_TYPE_SET = new Set<string>(
  EXTENSION_PRODUCT_TELEMETRY_EVENT_TYPES,
);

const UNSAFE_FIELD_NAMES = new Set([
  'answer',
  'answerText',
  'actorId',
  'assistantAnswer',
  'assistantMessage',
  'assistantText',
  'authMethod',
  'bodyText',
  'content',
  'html',
  'image',
  'message',
  'messageText',
  'orgId',
  'pageContent',
  'pageHtml',
  'pageSummary',
  'pageText',
  'question',
  'raw',
  'rawContext',
  'rawText',
  'result',
  'resultText',
  'screenshot',
  'screenshotDataUrl',
  'summary',
  'text',
  'toolResult',
  'transcript',
  'visibleText',
]);

const ALLOWED_METADATA_KEYS = new Set([
  'authState',
  'bindingEpoch',
  'contentInstancePresent',
  'durationMs',
  'hadOrgKnowledge',
  'hadVendorKnowledge',
  'inputPresent',
  'knowledgeMode',
  'lowConfidence',
  'messageCount',
  'orgSourcesCount',
  'pageInstancePresent',
  'reason',
  'repeatedPageContext',
  'route',
  'sourceCount',
  'stale',
  'surfaceCounts',
  'tabId',
  'targetAvailable',
  'toolCallCount',
  'vendorSourcesCount',
  'windowId',
]);

const MAX_EVENT_ID_LENGTH = 160;
const MAX_ID_LENGTH = 160;
const MAX_SMALL_TEXT_LENGTH = 120;
const MAX_METADATA_BYTES = 4096;

export function isExtensionProductTelemetryEventType(
  value: unknown,
): value is ExtensionProductTelemetryEventType {
  return typeof value === 'string' && EVENT_TYPE_SET.has(value);
}

export function isUnsafeTelemetryFieldName(key: string): boolean {
  return UNSAFE_FIELD_NAMES.has(key);
}

export function findUnsafeTelemetryField(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const unsafe = findUnsafeTelemetryField(item);
      if (unsafe) return unsafe;
    }
    return null;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (isUnsafeTelemetryFieldName(key)) return key;
    const unsafe = findUnsafeTelemetryField(nested);
    if (unsafe) return unsafe;
  }
  return null;
}

function normalizeString(
  value: unknown,
  limit = MAX_SMALL_TEXT_LENGTH,
): string | null {
  if (typeof value !== 'string') return null;
  return sanitizePageContextText(value, limit) ?? null;
}

function normalizeId(value: unknown, limit = MAX_ID_LENGTH): string | null {
  return normalizeString(value, limit);
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeOccurredAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeStringArray(value: unknown, limit = 8): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value
    .map((item) => normalizeString(item, 60))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
  return values.length ? values : null;
}

function normalizeUrlFields(input: {
  urlHost?: unknown;
  urlPath?: unknown;
}): { urlHost: string | null; urlPath: string | null } {
  const host = normalizeString(input.urlHost, 180);
  const path = normalizeString(input.urlPath, 240);
  if (!host && !path) return { urlHost: null, urlPath: null };

  const normalizedPath = path?.startsWith('/') ? path : `/${path ?? ''}`;
  const location = sanitizePageContextLocation(
    `https://${host ?? 'unknown'}${normalizedPath}`,
  );
  return {
    urlHost: host ? location.host : null,
    urlPath: path ? location.path : null,
  };
}

function normalizeMetadataValue(
  value: unknown,
  depth = 0,
): ExtensionTelemetryJson | undefined {
  if (depth > 3) return undefined;
  if (value === null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
    return typeof value === 'string'
      ? (sanitizePageContextText(value, MAX_SMALL_TEXT_LENGTH) ?? undefined)
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 12)
      .map((item) => normalizeMetadataValue(item, depth + 1))
      .filter((item): item is ExtensionTelemetryJson => item !== undefined);
  }
  if (typeof value === 'object' && value) {
    const result: Record<string, ExtensionTelemetryJson | undefined> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isUnsafeTelemetryFieldName(key)) continue;
      const normalized = normalizeMetadataValue(nested, depth + 1);
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  return undefined;
}

function normalizeMetadata(
  value: unknown,
): Record<string, ExtensionTelemetryJson | undefined> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const metadata: Record<string, ExtensionTelemetryJson | undefined> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!ALLOWED_METADATA_KEYS.has(key) || isUnsafeTelemetryFieldName(key)) {
      continue;
    }
    const normalized = normalizeMetadataValue(nested);
    if (normalized !== undefined) metadata[key] = normalized;
  }

  if (Object.keys(metadata).length === 0) return null;
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) return null;
  return metadata;
}

export function sanitizeExtensionProductTelemetryEvent(
  value: unknown,
): ExtensionProductTelemetryEventInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const unsafeField = findUnsafeTelemetryField(value);
  if (unsafeField) return null;

  const input = value as Record<string, unknown>;
  const occurredAt = normalizeOccurredAt(input.occurredAt);
  if (
    !isExtensionProductTelemetryEventType(input.eventType) ||
    !occurredAt
  ) {
    return null;
  }

  const eventId = normalizeId(input.eventId, MAX_EVENT_ID_LENGTH);
  if (!eventId) return null;
  const { urlHost, urlPath } = normalizeUrlFields(input);
  const messageDirection =
    input.messageDirection === 'user' ||
    input.messageDirection === 'assistant' ||
    input.messageDirection === 'system'
      ? input.messageDirection
      : null;

  return {
    eventId,
    eventType: input.eventType,
    occurredAt,
    seq: normalizeNonNegativeInteger(input.seq),
    sessionId: normalizeId(input.sessionId),
    conversationId: normalizeId(input.conversationId),
    turnId: normalizeId(input.turnId),
    urlHost,
    urlPath,
    app: normalizeString(input.app, 80),
    screen: normalizeString(input.screen, 80),
    knowledgeMode: normalizeString(input.knowledgeMode, 60) as
      | ExtensionTelemetryKnowledgeMode
      | null,
    vendorMatchBasis: normalizeString(input.vendorMatchBasis, 60) as
      | ExtensionTelemetryMatchBasis
      | null,
    orgMatchBasis: normalizeString(input.orgMatchBasis, 60) as
      | ExtensionTelemetryMatchBasis
      | null,
    vendorMatchCategory: normalizeString(input.vendorMatchCategory, 60) as
      | ExtensionTelemetryMatchCategory
      | null,
    orgMatchCategory: normalizeString(input.orgMatchCategory, 60) as
      | ExtensionTelemetryMatchCategory
      | null,
    latencyMs: normalizeNonNegativeNumber(input.latencyMs),
    sourceCount: normalizeNonNegativeInteger(input.sourceCount),
    sourceKinds: normalizeStringArray(input.sourceKinds),
    outcome: normalizeString(input.outcome, 80),
    errorCode: normalizeString(input.errorCode, 80),
    errorCategory: normalizeString(input.errorCategory, 80),
    messageDirection,
    messageLength: normalizeNonNegativeInteger(input.messageLength),
    toolName: normalizeString(input.toolName, 80),
    action: normalizeString(input.action, 80),
    selectorPresent:
      typeof input.selectorPresent === 'boolean' ? input.selectorPresent : null,
    inputTextLength: normalizeNonNegativeInteger(input.inputTextLength),
    outputTextLength: normalizeNonNegativeInteger(input.outputTextLength),
    fingerprint: normalizeId(input.fingerprint),
    metadata: normalizeMetadata(input.metadata),
  };
}
