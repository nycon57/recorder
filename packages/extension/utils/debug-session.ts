/* global chrome */

import type {
  ExtensionDebugSessionEventInput,
  PageContext,
} from '@tribora/shared';
import {
  buildContextSemanticFingerprint,
  sanitizePageContextForNetwork,
  sanitizePageContextLocation,
} from '@tribora/shared';

import { apiFetch } from './api-client.js';
import { isDebugSessionLoggingAlwaysOn } from './debug-session-policy.js';

export const DEBUG_SESSION_LOGGING_KEY =
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

function clipText(
  value: string | null | undefined,
  limit = 400,
): string | null {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

export async function getDebugSessionLoggingEnabled(): Promise<boolean> {
  if (isDebugSessionLoggingAlwaysOn()) {
    return true;
  }
  const stored = await chrome.storage.local.get(DEBUG_SESSION_LOGGING_KEY);
  return stored[DEBUG_SESSION_LOGGING_KEY] === true;
}

export async function setDebugSessionLoggingEnabled(
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
    pageSummary: clipText(sanitizedContext.pageSummary, 500),
    selectedEntityTitle: clipText(sanitizedContext.selectedEntity?.title, 200),
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
    typeof firstTarget?.selector === 'string' ? firstTarget.selector : null;

  return {
    selector:
      typeof payload.selector === 'string'
        ? payload.selector
        : firstTargetSelector,
    label:
      typeof payload.label === 'string'
        ? clipText(payload.label, 160)
        : typeof payload.query === 'string'
          ? clipText(payload.query, 160)
          : typeof payload.regionId === 'string'
            ? clipText(payload.regionId, 160)
            : keyCombo
              ? clipText(keyCombo, 160)
              : firstTargetLabel
                ? clipText(
                    targets.length > 1
                      ? `${firstTargetLabel} (+${targets.length - 1} more)`
                      : firstTargetLabel,
                    160,
                  )
                : typeof payload.elementLabel === 'string'
                  ? clipText(payload.elementLabel, 160)
                  : null,
    action:
      typeof payload.action === 'string'
        ? payload.action
        : typeof firstTarget?.action === 'string'
          ? firstTarget.action
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
      error: clipText(args.error, 500),
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
    resultText: clipText(args.result, 500),
    error: null,
  };
}

export async function postDebugSessionEvents(
  events: ExtensionDebugSessionEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  await apiFetch('/api/extension/debug-events', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
}
