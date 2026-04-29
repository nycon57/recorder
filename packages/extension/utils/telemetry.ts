/* global chrome */

import type {
  ExtensionProductTelemetryEventInput,
  ExtensionProductTelemetryEventType,
  PageContext,
} from '@tribora/shared';
import {
  buildContextSemanticFingerprint,
  sanitizeExtensionProductTelemetryEvent,
  sanitizePageContextForNetwork,
  sanitizePageContextLocation,
} from '@tribora/shared';

import { apiFetch } from './api-client.js';

export const EXTENSION_TELEMETRY_QUEUE_KEY =
  'tribora_extension_telemetry_queue_v1';

const MAX_QUEUE_SIZE = 500;
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ActiveTelemetrySessionState {
  id: string;
  seq: number;
  turnSeq: number;
  currentTurnId: string | null;
  startedAt: string;
  tabId: number;
  windowId: number | null;
  conversationId: string | null;
}

type QueuedTelemetryEvent = ExtensionProductTelemetryEventInput & {
  queuedAt: string;
  attempts: number;
};

export function createTelemetrySessionState(args: {
  tabId: number;
  windowId: number | null;
}): ActiveTelemetrySessionState {
  return {
    id: `tel_${crypto.randomUUID()}`,
    seq: 0,
    turnSeq: 0,
    currentTurnId: null,
    startedAt: new Date().toISOString(),
    tabId: args.tabId,
    windowId: args.windowId,
    conversationId: null,
  };
}

export function advanceTelemetryTurn(
  session: ActiveTelemetrySessionState,
): string {
  session.turnSeq += 1;
  session.currentTurnId = `${session.id}:turn:${session.turnSeq}`;
  return session.currentTurnId;
}

export function buildTelemetryEventInput(
  session: ActiveTelemetrySessionState,
  event: Omit<
    ExtensionProductTelemetryEventInput,
    'eventId' | 'sessionId' | 'seq' | 'occurredAt'
  > & {
    eventId?: string;
    occurredAt?: string;
    turnId?: string | null;
  },
): ExtensionProductTelemetryEventInput {
  session.seq += 1;
  const occurredAt = event.occurredAt ?? new Date().toISOString();

  return {
    eventId:
      event.eventId ??
      `${session.id}:${session.seq}:${event.eventType}:${crypto.randomUUID()}`,
    sessionId: session.id,
    seq: session.seq,
    occurredAt,
    turnId: event.turnId === undefined ? session.currentTurnId : event.turnId,
    conversationId: session.conversationId,
    ...event,
  };
}

export function buildPageContextTelemetryFields(
  context: PageContext,
): Pick<
  ExtensionProductTelemetryEventInput,
  | 'urlHost'
  | 'urlPath'
  | 'app'
  | 'screen'
  | 'knowledgeMode'
  | 'vendorMatchBasis'
  | 'orgMatchBasis'
  | 'vendorMatchCategory'
  | 'orgMatchCategory'
  | 'fingerprint'
> {
  const sanitizedContext = sanitizePageContextForNetwork(context);
  const location = sanitizePageContextLocation(sanitizedContext.url);

  return {
    urlHost: location.host,
    urlPath: location.path,
    app: sanitizedContext.app,
    screen: sanitizedContext.screen,
    knowledgeMode: sanitizedContext.knowledgeAvailability?.mode ?? 'unknown',
    vendorMatchBasis: sanitizedContext.vendorKnowledgeMatch?.basis ?? 'unknown',
    orgMatchBasis: sanitizedContext.orgKnowledgeMatch?.basis ?? 'unknown',
    vendorMatchCategory:
      sanitizedContext.vendorKnowledgeMatch?.basisCategory ?? 'unknown',
    orgMatchCategory:
      sanitizedContext.orgKnowledgeMatch?.basisCategory ?? 'unknown',
    fingerprint: buildContextSemanticFingerprint(sanitizedContext),
  };
}

function isQueuedTelemetryEvent(value: unknown): value is QueuedTelemetryEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QueuedTelemetryEvent).queuedAt === 'string' &&
    typeof (value as QueuedTelemetryEvent).attempts === 'number' &&
    sanitizeExtensionProductTelemetryEvent(value) !== null
  );
}

async function readTelemetryQueue(): Promise<QueuedTelemetryEvent[]> {
  const stored = await chrome.storage.local.get(EXTENSION_TELEMETRY_QUEUE_KEY);
  const queue = stored[EXTENSION_TELEMETRY_QUEUE_KEY];
  if (!Array.isArray(queue)) return [];

  const cutoff = Date.now() - MAX_EVENT_AGE_MS;
  return queue
    .filter(isQueuedTelemetryEvent)
    .filter((event) => Date.parse(event.queuedAt) >= cutoff)
    .slice(-MAX_QUEUE_SIZE);
}

async function writeTelemetryQueue(
  queue: QueuedTelemetryEvent[],
): Promise<void> {
  await chrome.storage.local.set({
    [EXTENSION_TELEMETRY_QUEUE_KEY]: queue.slice(-MAX_QUEUE_SIZE),
  });
}

export async function enqueueExtensionTelemetryEvent(
  event: ExtensionProductTelemetryEventInput,
): Promise<boolean> {
  const sanitized = sanitizeExtensionProductTelemetryEvent(event);
  if (!sanitized) return false;

  const queue = await readTelemetryQueue();
  const deduped = queue.filter((item) => item.eventId !== sanitized.eventId);
  deduped.push({
    ...sanitized,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeTelemetryQueue(deduped);
  return true;
}

export async function flushExtensionTelemetryQueue(): Promise<void> {
  const queue = await readTelemetryQueue();
  if (queue.length === 0) return;

  const batch = queue.slice(0, 100);
  const remaining = queue.slice(batch.length);

  try {
    await apiFetch('/api/extension/telemetry/events', {
      method: 'POST',
      body: JSON.stringify({
        events: batch.map((queuedEvent) => {
          const event = { ...queuedEvent };
          delete (event as Partial<QueuedTelemetryEvent>).queuedAt;
          delete (event as Partial<QueuedTelemetryEvent>).attempts;
          return event;
        }),
      }),
    });
    await writeTelemetryQueue(remaining);
  } catch (error) {
    const failedIds = new Set(batch.map((event) => event.eventId));
    const retried = queue.map((event) =>
      failedIds.has(event.eventId)
        ? { ...event, attempts: event.attempts + 1 }
        : event,
    );
    await writeTelemetryQueue(retried);
    throw error;
  }
}

export function summarizeTelemetryToolArgs(args: {
  name: string;
  action?: string | null;
  selector?: string | null;
  inputTextLength?: number | null;
}): Pick<
  ExtensionProductTelemetryEventInput,
  'toolName' | 'action' | 'selectorPresent' | 'inputTextLength'
> {
  return {
    toolName: args.name,
    action: args.action ?? null,
    selectorPresent: Boolean(args.selector),
    inputTextLength: args.inputTextLength ?? null,
  };
}

export function telemetryOutcomeEventType(
  type: ExtensionProductTelemetryEventType,
): ExtensionProductTelemetryEventType {
  return type;
}
