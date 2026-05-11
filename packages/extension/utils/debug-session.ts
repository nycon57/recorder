/* global chrome */

import type {
  ExtensionDebugSessionEventInput,
  PageContext,
} from '@tribora/shared';
import {
  buildContextSemanticFingerprint,
  sanitizePageContextForNetwork,
  sanitizePageContextLocation,
  sanitizePageContextSelector,
  sanitizePageContextText,
} from '@tribora/shared';

import { apiFetch } from './api-client.js';
import { isDebugSessionLoggingAlwaysOn } from './debug-session-policy.js';

const DEBUG_SESSION_LOGGING_KEY =
  'tribora_debug_session_logging_enabled';

export interface ActiveDebugSessionState {
  id: string;
  seq: number;
  turnSeq: number;
  currentTurnId: string | null;
  startedAt: string;
  tabId: number;
  windowId: number | null;
  conversationId: string | null;
}

export async function getDebugSessionLoggingEnabled(): Promise<boolean> {
  if (isDebugSessionLoggingAlwaysOn()) {
    return true;
  }
  const stored = await chrome.storage.local.get(DEBUG_SESSION_LOGGING_KEY);
  return stored[DEBUG_SESSION_LOGGING_KEY] === true;
}

async function setDebugSessionLoggingEnabled(
  enabled: boolean,
): Promise<void> {
  if (isDebugSessionLoggingAlwaysOn()) {
    return;
  }
  await chrome.storage.local.set({ [DEBUG_SESSION_LOGGING_KEY]: enabled });
}

export function createDebugSessionState(args: {
  tabId: number;
  windowId: number | null;
}): ActiveDebugSessionState {
  return {
    id: `dbg_${crypto.randomUUID()}`,
    seq: 0,
    turnSeq: 0,
    currentTurnId: null,
    startedAt: new Date().toISOString(),
    tabId: args.tabId,
    windowId: args.windowId,
    conversationId: null,
  };
}

export function advanceDebugTurn(session: ActiveDebugSessionState): string {
  session.turnSeq += 1;
  session.currentTurnId = `${session.id}:turn:${session.turnSeq}`;
  return session.currentTurnId;
}

export function buildDebugEventInput(
  session: ActiveDebugSessionState,
  event: Omit<
    ExtensionDebugSessionEventInput,
    'sessionId' | 'seq' | 'occurredAt'
  > & {
    occurredAt?: string;
    turnId?: string | null;
  },
): ExtensionDebugSessionEventInput {
  session.seq += 1;

  return {
    sessionId: session.id,
    seq: session.seq,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    turnId: event.turnId === undefined ? session.currentTurnId : event.turnId,
    knowledgeMode: event.knowledgeMode ?? 'unknown',
    vendorMatchBasis: event.vendorMatchBasis ?? 'unknown',
    orgMatchBasis: event.orgMatchBasis ?? 'unknown',
    ...event,
  };
}

export function buildPageContextDebugFields(
  context: PageContext,
): Pick<
  ExtensionDebugSessionEventInput,
  | 'urlHost'
  | 'urlPath'
  | 'app'
  | 'screen'
  | 'knowledgeMode'
  | 'vendorMatchBasis'
  | 'orgMatchBasis'
  | 'pageSummary'
  | 'selectedEntityTitle'
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
    pageSummary: sanitizePageContextText(sanitizedContext.pageSummary, 500),
    selectedEntityTitle: sanitizePageContextText(
      sanitizedContext.selectedEntity?.title,
      200,
    ),
    fingerprint: buildContextSemanticFingerprint(sanitizedContext),
  };
}

export function summarizeToolCallArgs(
  name: string,
  args: unknown,
): Pick<
  ExtensionDebugSessionEventInput,
  'selector' | 'label' | 'action' | 'inputTextPreview' | 'inputTextLength'
> {
  const payload =
    typeof args === 'object' && args !== null
      ? (args as Record<string, unknown>)
      : {};
  const targets = Array.isArray(payload.targets)
    ? payload.targets.filter(
        (value): value is Record<string, unknown> =>
          typeof value === 'object' && value !== null,
      )
    : [];
  const text =
    typeof payload.text === 'string'
      ? payload.text
      : typeof payload.value === 'string'
        ? payload.value
        : null;
  const key =
    typeof payload.key === 'string'
      ? payload.key
      : typeof payload.shortcut === 'string'
        ? payload.shortcut
        : null;
  const modifiers = Array.isArray(payload.modifiers)
    ? payload.modifiers.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      )
    : [];
  const keyCombo = key ? [...modifiers, key].join('+') : null;
  const firstTarget = targets[0];
  const firstTargetLabel =
    typeof firstTarget?.label === 'string' ? firstTarget.label : null;
  const firstTargetSelector =
    typeof firstTarget?.selector === 'string'
      ? sanitizePageContextSelector(firstTarget.selector)
      : null;

  return {
    selector:
      typeof payload.selector === 'string'
        ? (sanitizePageContextSelector(payload.selector) ?? null)
        : firstTargetSelector,
    label:
      typeof payload.label === 'string'
        ? (sanitizePageContextText(payload.label, 160) ?? null)
        : typeof payload.query === 'string'
          ? (sanitizePageContextText(payload.query, 160) ?? null)
          : typeof payload.regionId === 'string'
            ? (sanitizePageContextText(payload.regionId, 160) ?? null)
            : keyCombo
              ? (sanitizePageContextText(keyCombo, 160) ?? null)
              : firstTargetLabel
                ? (sanitizePageContextText(
                    targets.length > 1
                      ? `${firstTargetLabel} (+${targets.length - 1} more)`
                      : firstTargetLabel,
                    160,
                  ) ?? null)
                : typeof payload.elementLabel === 'string'
                  ? (sanitizePageContextText(payload.elementLabel, 160) ?? null)
                  : null,
    action:
      typeof payload.action === 'string'
        ? (sanitizePageContextText(payload.action, 80) ?? null)
        : typeof firstTarget?.action === 'string'
          ? (sanitizePageContextText(firstTarget.action, 80) ?? null)
          : name === 'click_element'
            ? 'click'
            : name === 'hover_element'
              ? 'hover'
              : name === 'type_in_element'
                ? 'type'
                : name === 'scroll_to_element'
                  ? 'scroll'
                  : name === 'highlight_element'
                    ? 'highlight'
                    : name === 'highlight_elements'
                      ? 'highlight'
                      : name === 'search_page_elements'
                        ? 'search'
                        : name === 'inspect_element'
                          ? 'inspect'
                          : name === 'inspect_page_region'
                            ? 'inspect_region'
                            : name === 'press_key'
                              ? 'keyboard'
                              : null,
    inputTextPreview: text ? '[input present]' : null,
    inputTextLength: text ? text.length : null,
  };
}

export function summarizeToolResult(args: {
  name: string;
  result?: string;
  error?: string;
}): Pick<ExtensionDebugSessionEventInput, 'resultText' | 'error'> {
  if (args.error) {
    return {
      resultText: null,
      error: sanitizePageContextText(args.error, 500) ?? null,
    };
  }

  if (!args.result) {
    return {
      resultText: null,
      error: null,
    };
  }

  if (args.name === 'capture_screenshot') {
    return {
      resultText: '[screenshot omitted]',
      error: null,
    };
  }

  if (args.name === 'get_page_context') {
    return {
      resultText: '[page context payload omitted]',
      error: null,
    };
  }

  return {
    resultText: sanitizePageContextText(args.result, 500) ?? null,
    error: null,
  };
}

function sanitizeDebugSessionEventForNetwork(
  event: ExtensionDebugSessionEventInput,
): ExtensionDebugSessionEventInput {
  const location =
    event.urlHost || event.urlPath
      ? sanitizePageContextLocation(
          `https://${event.urlHost ?? 'unknown'}${
            event.urlPath?.startsWith('/')
              ? event.urlPath
              : `/${event.urlPath ?? ''}`
          }`,
        )
      : null;

  return {
    sessionId: event.sessionId,
    seq: event.seq,
    turnId: sanitizePageContextText(event.turnId, 120) ?? null,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    urlHost: location ? location.host : null,
    urlPath: location ? location.path : null,
    app: sanitizePageContextText(event.app, 80) ?? null,
    screen: sanitizePageContextText(event.screen, 80) ?? null,
    knowledgeMode: event.knowledgeMode,
    vendorMatchBasis: event.vendorMatchBasis,
    orgMatchBasis: event.orgMatchBasis,
    messageText: sanitizePageContextText(event.messageText, 500) ?? null,
    toolName: sanitizePageContextText(event.toolName, 80) ?? null,
    selector: sanitizePageContextSelector(event.selector) ?? null,
    label: sanitizePageContextText(event.label, 140) ?? null,
    action: sanitizePageContextText(event.action, 80) ?? null,
    inputTextPreview: event.inputTextPreview ? '[input present]' : null,
    inputTextLength: event.inputTextLength ?? null,
    resultText: sanitizePageContextText(event.resultText, 500) ?? null,
    error: sanitizePageContextText(event.error, 260) ?? null,
    pageSummary: sanitizePageContextText(event.pageSummary, 500) ?? null,
    selectedEntityTitle:
      sanitizePageContextText(event.selectedEntityTitle, 200) ?? null,
    tabId: event.tabId ?? null,
    windowId: event.windowId ?? null,
    conversationId: sanitizePageContextText(event.conversationId, 120) ?? null,
    fingerprint: sanitizePageContextText(event.fingerprint, 120) ?? null,
    bindingEpoch: event.bindingEpoch ?? null,
    pageInstanceId: sanitizePageContextText(event.pageInstanceId, 120) ?? null,
    contentInstanceId:
      sanitizePageContextText(event.contentInstanceId, 120) ?? null,
    durationMs: event.durationMs ?? null,
  };
}

export async function postDebugSessionEvents(
  events: ExtensionDebugSessionEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  await apiFetch('/api/extension/debug-events', {
    method: 'POST',
    body: JSON.stringify({
      events: events.map(sanitizeDebugSessionEventForNetwork),
    }),
  });
}
