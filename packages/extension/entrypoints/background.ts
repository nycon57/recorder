/**
 * background.ts — Service worker for the Tribora extension.
 *
 * Responsibilities:
 *   - Widget toggle via extension icon click
 *   - Offscreen document lifecycle (one per extension)
 *   - Signed URL fetch for agent sessions (attaches website cookies)
 *   - Message routing between content script ↔ offscreen document
 *   - Screenshot capture via chrome.tabs.captureVisibleTab
 *   - Recording (tab capture + R2 upload)
 *   - Token refresh + auth state
 */

/* global chrome, defineBackground */

import type { LiveContextPack, PageContext } from '@tribora/shared';
import {
  sanitizePageContextForModel,
  sanitizePageContextForNetwork,
  sanitizePageContextLocation,
} from '@tribora/shared';

import { scheduleTokenRefresh } from '../utils/token-refresh.js';
import { createTabRecorder } from '../utils/tab-recorder.js';
import { uploadRecording } from '../utils/recording-uploader.js';
import type { TabRecorder } from '../utils/tab-recorder.js';
import { apiFetch, getStoredSession } from '../utils/api-client.js';
import {
  advanceDebugTurn,
  buildDebugEventInput,
  buildPageContextDebugFields,
  createDebugSessionState,
  getDebugSessionLoggingEnabled,
  postDebugSessionEvents,
  summarizeToolCallArgs,
  summarizeToolResult,
} from '../utils/debug-session.js';
import type { ActiveDebugSessionState } from '../utils/debug-session.js';
import {
  advanceTelemetryTurn,
  buildPageContextTelemetryFields,
  buildTelemetryEventInput,
  createTelemetrySessionState,
  enqueueExtensionTelemetryEvent,
  flushExtensionTelemetryQueue,
  summarizeTelemetryToolArgs,
} from '../utils/telemetry.js';
import type { ActiveTelemetrySessionState } from '../utils/telemetry.js';
import {
  buildUnavailableVoiceTargetToolResult,
  isSupportedVoiceTargetUrl,
  shouldCollectPageContext,
  shouldOpenMicPermissionBootstrap,
  shouldRegisterVoiceTarget,
} from '../utils/session-startup.js';
import {
  buildLoadingVoiceTargetToolResult,
  buildToolRouteMeta,
  isToolResultCurrent,
  parseToolResultMeta,
  type VoiceTargetInstanceState,
  type VoiceToolRouteMeta,
} from '../utils/voice-tool-routing.js';
import { createTurnGuards } from '../utils/turn-guards.js';
import { buildContextSemanticFingerprint } from '../utils/context-telemetry.js';
import {
  mergePageContextWithPreviousKnowledge,
  pageContextKnowledgeIdentityChanged,
} from '../utils/context-knowledge.js';
import { buildPageContextToolPayload } from '../utils/page-context-payload.js';
import { classifyTranscriptConfidence } from '../utils/voice-agent-policy.js';
import { validateAndPersistExtensionAuthCallback } from '../utils/auth-session.js';

const BG = '[Tribora bg]';
const EXTENSION_ENABLED_KEY = 'tribora_extension_enabled';
const LEGACY_WIDGET_VISIBLE_KEY = 'tribora_widget_visible';
const MIC_PERMISSION_GRANTED_KEY = 'micPermissionGranted';
const VOICE_TARGET_STATE_KEY = 'tribora_voice_target_state';
const OFFSCREEN_URL = 'offscreen.html';
const MIC_PERMISSION_URL = 'mic-permission.html';
const TOOL_TARGET_LOADING_GRACE_MS = 1200;
const TOOL_TARGET_LOADING_POLL_MS = 100;

const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  'http://localhost:3000';

type VoiceTargetState = {
  sessionActive: boolean;
  activeTargetTabId: number | null;
  windowId: number | null;
  urlHost: string | null;
  urlPath: string | null;
  updatedAt: number;
};

type OffscreenSessionState = {
  active?: boolean;
  tabId?: number | null;
};

// ─── Offscreen document lifecycle ─────────────────────────────────────────────

let offscreenCreating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  // @ts-expect-error — chrome.offscreen is MV3; types may lag
  if (await chrome.offscreen.hasDocument?.()) return;
  if (offscreenCreating) return offscreenCreating;

  offscreenCreating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [
        chrome.offscreen.Reason.USER_MEDIA,
        chrome.offscreen.Reason.AUDIO_PLAYBACK,
      ],
      justification:
        'Maintain a persistent ElevenLabs voice session across page navigations.',
    })
    .finally(() => {
      offscreenCreating = null;
    });

  await offscreenCreating;
  console.log(`${BG} Offscreen document created`);
}

async function closeOffscreen(): Promise<void> {
  try {
    // @ts-expect-error — chrome.offscreen is MV3; types may lag
    if (await chrome.offscreen.hasDocument?.()) {
      await chrome.offscreen.closeDocument();
      console.log(`${BG} Offscreen document closed`);
    }
  } catch (err) {
    console.warn(`${BG} closeOffscreen error:`, (err as Error).message);
  }
}

// ─── Signed URL fetch ─────────────────────────────────────────────────────────

async function fetchSignedUrl(): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const cookies = await chrome.cookies.getAll({ url: API_BASE_URL });
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    }
  } catch {
    // cookies API unavailable — try bearer-only
  }

  const session = await getStoredSession();
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/extension/agent-session`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as { signedUrl?: string };
  if (!data.signedUrl) throw new Error('No signedUrl in response');
  return data.signedUrl;
}

// ─── Extension state + session bootstrap ─────────────────────────────────────

let pendingSessionStartTabId: number | null = null;
let pendingMicPermissionPageTabId: number | null = null;
let activeDebugSession: ActiveDebugSessionState | null = null;
let activeTelemetrySession: ActiveTelemetrySessionState | null = null;
let debugEventQueue: Promise<void> = Promise.resolve();
let telemetryEventQueue: Promise<void> = Promise.resolve();
const pendingDebugToolCalls = new Map<
  string,
  {
    turnId: string | null;
    name: string;
    selector: string | null;
    label: string | null;
    action: string | null;
    inputTextPreview: string | null;
    inputTextLength: number | null;
    urlHost: string | null;
    urlPath: string | null;
    app: string | null;
    screen: string | null;
    knowledgeMode: 'dom_only' | 'vendor_backed' | 'org_backed' | 'unknown';
    vendorMatchBasis:
      | 'exact'
      | 'screen_alias'
      | 'app_only'
      | 'domain_alias'
      | 'none'
      | 'unknown';
    orgMatchBasis:
      | 'exact'
      | 'screen_alias'
      | 'app_only'
      | 'domain_alias'
      | 'none'
      | 'unknown';
    pageSummary: string | null;
    selectedEntityTitle: string | null;
    fingerprint: string | null;
    tabId: number | null;
    windowId: number | null;
    bindingEpoch: number;
    pageInstanceId: string | null;
    contentInstanceId: string | null;
    startedAtMs: number;
    routeMeta: VoiceToolRouteMeta | null;
  }
>();
const pendingToolRoutes = new Map<
  string,
  { name: string; routeMeta: VoiceToolRouteMeta; startedAtMs: number }
>();

const latestContexts = new Map<number, PageContext>();
const contextUpdateSeq = new Map<number, number>();
const contextFingerprints = new Map<number, string>();
const liveContextHashes = new Map<number, string>();
const contentInstanceIds = new Map<number, string>();
const pageInstanceIds = new Map<number, string>();
const targetLoadingTabs = new Map<number, number>();
let activeTargetBindingEpoch = 0;

async function getExtensionEnabled(): Promise<boolean> {
  const stored = await chrome.storage.session.get([
    EXTENSION_ENABLED_KEY,
    LEGACY_WIDGET_VISIBLE_KEY,
  ]);

  if (typeof stored[EXTENSION_ENABLED_KEY] === 'boolean') {
    return stored[EXTENSION_ENABLED_KEY] === true;
  }

  return stored[LEGACY_WIDGET_VISIBLE_KEY] === true;
}

async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.session.set({
    [EXTENSION_ENABLED_KEY]: enabled,
    [LEGACY_WIDGET_VISIBLE_KEY]: enabled,
  });
}

async function getMicPermissionGranted(): Promise<boolean> {
  const stored = await chrome.storage.local.get(MIC_PERMISSION_GRANTED_KEY);
  return stored[MIC_PERMISSION_GRANTED_KEY] === true;
}

async function setMicPermissionGranted(granted: boolean): Promise<void> {
  await chrome.storage.local.set({ [MIC_PERMISSION_GRANTED_KEY]: granted });
}

function clearPendingMicPermissionFlow(): {
  resumeTabId: number | null;
  permissionTabId: number | null;
} {
  const resumeTabId = pendingSessionStartTabId;
  const permissionTabId = pendingMicPermissionPageTabId;
  pendingSessionStartTabId = null;
  pendingMicPermissionPageTabId = null;
  return { resumeTabId, permissionTabId };
}

function buildFallbackDebugLocation(url?: string | null): {
  urlHost: string;
  urlPath: string;
} {
  if (!url) {
    return {
      urlHost: 'unknown',
      urlPath: '/',
    };
  }

  const location = sanitizePageContextLocation(url);
  return {
    urlHost: location.host,
    urlPath: location.path,
  };
}

function getDebugContextFields(tabId: number):
  | ReturnType<typeof buildPageContextDebugFields>
  | {
      urlHost: string;
      urlPath: string;
      app?: null;
      screen?: null;
      knowledgeMode?: 'unknown';
      vendorMatchBasis?: 'unknown';
      orgMatchBasis?: 'unknown';
      pageSummary?: null;
      selectedEntityTitle?: null;
      fingerprint?: null;
    } {
  const context = latestContexts.get(tabId);
  if (context) {
    return buildPageContextDebugFields(context);
  }

  return {
    ...buildFallbackDebugLocation(null),
    app: null,
    screen: null,
    knowledgeMode: 'unknown',
    vendorMatchBasis: 'unknown',
    orgMatchBasis: 'unknown',
    pageSummary: null,
    selectedEntityTitle: null,
    fingerprint: null,
  };
}

function getTelemetryContextFields(tabId: number):
  | ReturnType<typeof buildPageContextTelemetryFields>
  | {
      urlHost: string;
      urlPath: string;
      app?: null;
      screen?: null;
      knowledgeMode?: 'unknown';
      vendorMatchBasis?: 'unknown';
      orgMatchBasis?: 'unknown';
      vendorMatchCategory?: 'unknown';
      orgMatchCategory?: 'unknown';
      fingerprint?: null;
    } {
  const context = latestContexts.get(tabId);
  if (context) {
    return buildPageContextTelemetryFields(context);
  }

  return {
    ...buildFallbackDebugLocation(null),
    app: null,
    screen: null,
    knowledgeMode: 'unknown',
    vendorMatchBasis: 'unknown',
    orgMatchBasis: 'unknown',
    vendorMatchCategory: 'unknown',
    orgMatchCategory: 'unknown',
    fingerprint: null,
  };
}

function queueProductTelemetryEvent(
  event: Parameters<typeof buildTelemetryEventInput>[1],
): void {
  if (!activeTelemetrySession) return;

  const payload = buildTelemetryEventInput(activeTelemetrySession, event);
  telemetryEventQueue = telemetryEventQueue
    .catch(() => undefined)
    .then(async () => {
      const queued = await enqueueExtensionTelemetryEvent(payload);
      if (queued) {
        await flushExtensionTelemetryQueue();
      }
    })
    .catch((err) => {
      console.warn(
        `${BG} Product telemetry event queued for retry:`,
        (err as Error).message,
      );
    });
}

function queueDebugSessionEvent(
  event: Parameters<typeof buildDebugEventInput>[1],
): void {
  if (!activeDebugSession) return;

  const payload = buildDebugEventInput(activeDebugSession, event);
  debugEventQueue = debugEventQueue
    .catch(() => undefined)
    .then(() => postDebugSessionEvents([payload]))
    .catch((err) => {
      console.warn(`${BG} Debug session event failed:`, (err as Error).message);
    });
}

function finalizeDebugSession(
  event?: Parameters<typeof buildDebugEventInput>[1],
): void {
  if (event) {
    queueDebugSessionEvent(event);
  }
  activeDebugSession = null;
  turnGuards.clear();
}

async function sendOffscreenContextualUpdate(payload: {
  text: string;
  hash?: string | null;
  knowledgeMode?: string | null;
  sourceCount?: number | null;
  source?: 'live_context' | 'watchdog';
  reason?: string | null;
}): Promise<{ ok?: boolean; error?: string } | undefined> {
  return (await chrome.runtime.sendMessage({
    target: 'offscreen',
    kind: 'CONTEXTUAL_UPDATE',
    payload,
  })) as { ok?: boolean; error?: string } | undefined;
}

function buildWatchdogNudge(
  reason: 'user_message_timeout' | 'post_tool_timeout',
): string {
  if (reason === 'post_tool_timeout') {
    return 'You have current tool results for this turn. Respond to the user now in one answer. Do not repeat earlier wording unless the page changed materially.';
  }

  return 'The user is still waiting for a response. Use the current page context and latest tool results to answer clearly once, without repeating yourself.';
}

const turnGuards = createTurnGuards({
  onNoReplyWatchdog: ({ turnId, reason }) => {
    const telemetryTurnMatches =
      activeTelemetrySession?.currentTurnId === turnId;
    const debugTurnMatches = activeDebugSession?.currentTurnId === turnId;

    if (!telemetryTurnMatches && !debugTurnMatches) {
      return;
    }

    if (activeTelemetrySession && telemetryTurnMatches) {
      queueProductTelemetryEvent({
        eventType: 'assistant_reply_watchdog_fired',
        turnId,
        outcome: reason,
        metadata: {
          reason,
        },
        ...getTelemetryContextFields(activeTelemetrySession.tabId),
      });
    }

    if (activeDebugSession && debugTurnMatches) {
      queueDebugSessionEvent({
        eventType: 'assistant_reply_watchdog_fired',
        turnId,
        tabId: activeDebugSession.tabId,
        windowId: activeDebugSession.windowId,
        conversationId: activeDebugSession.conversationId,
        resultText:
          reason === 'post_tool_timeout'
            ? 'Tool completed but no assistant reply was observed.'
            : 'User turn timed out before any assistant reply was observed.',
        ...getDebugContextFields(activeDebugSession.tabId),
      });
    }

    void sendOffscreenContextualUpdate({
      text: buildWatchdogNudge(reason),
      source: 'watchdog',
      reason,
    }).catch((err) => {
      console.warn(`${BG} Watchdog nudge failed:`, (err as Error).message);
    });
  },
});

function mergePageContextWithPrevious(
  previous: PageContext | undefined,
  next: PageContext,
): PageContext {
  return mergePageContextWithPreviousKnowledge(previous, next);
}

async function sendWidgetVisibility(
  tabId: number,
  visible: boolean,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'TOGGLE_WIDGET',
      visible,
    });
  } catch {
    // Ignore unsupported pages or tabs without a loaded content script.
  }
}

async function sendPageContextCollectionState(
  tabId: number,
  collect: boolean,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: collect
        ? 'PAGE_CONTEXT_COLLECTION_START'
        : 'PAGE_CONTEXT_COLLECTION_STOP',
    });
  } catch {
    // Ignore unsupported pages or tabs without a loaded content script.
  }
}

async function stopPageContextCollectionEverywhere(): Promise<void> {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      await sendPageContextCollectionState(tab.id, false);
    }),
  );
}

async function hideWidgetsEverywhere(): Promise<void> {
  const tabs = await chrome.tabs.query({});

  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      await sendWidgetVisibility(tab.id, false);
    }),
  );
}

async function setExtensionEnabledForTab(
  enabled: boolean,
  tabId?: number | null,
): Promise<void> {
  await setExtensionEnabled(enabled);
  console.log(`${BG} Extension toggled: ${enabled ? 'ON' : 'OFF'}`);

  if (enabled) {
    if (tabId) {
      await sendWidgetVisibility(tabId, true);
    }
    return;
  }

  const { permissionTabId } = clearPendingMicPermissionFlow();
  if (permissionTabId !== null) {
    try {
      await chrome.tabs.remove(permissionTabId);
    } catch {
      // Ignore if the permission page is already gone.
    }
  }
  await endAgentSession();
  await closeOffscreen();
  await stopPageContextCollectionEverywhere();
  latestContexts.clear();
  contextUpdateSeq.clear();
  contextFingerprints.clear();
  liveContextHashes.clear();
  contentInstanceIds.clear();
  pageInstanceIds.clear();
  await hideWidgetsEverywhere();
  if (tabId) {
    await sendWidgetVisibility(tabId, false);
  }
}

function emitSessionErrorToTab(tabId: number, error: string): void {
  chrome.tabs.sendMessage(
    tabId,
    {
      type: 'SESSION_EVENT',
      kind: 'error',
      payload: { error },
    },
    () => void chrome.runtime.lastError,
  );
}

async function openMicPermissionPage(tabId: number): Promise<void> {
  pendingSessionStartTabId = tabId;

  const url = chrome.runtime.getURL(
    `${MIC_PERMISSION_URL}?resumeTabId=${encodeURIComponent(String(tabId))}`,
  );

  if (pendingMicPermissionPageTabId !== null) {
    try {
      await chrome.tabs.update(pendingMicPermissionPageTabId, {
        active: true,
        url,
      });
      return;
    } catch {
      pendingMicPermissionPageTabId = null;
    }
  }

  const permissionTab = await chrome.tabs.create({ url, active: true });
  pendingMicPermissionPageTabId = permissionTab.id ?? null;

  if (activeDebugSession && activeDebugSession.tabId === tabId) {
    queueDebugSessionEvent({
      eventType: 'mic_permission_opened',
      turnId: null,
      tabId,
      windowId: permissionTab.windowId ?? activeDebugSession.windowId,
      ...getDebugContextFields(tabId),
    });
  }
}

// ─── Active voice target tracking ─────────────────────────────────────────────
// Offscreen owns the long-lived audio session. Background owns the movable page
// target that receives events/tools while the voice session remains alive.

let voiceSessionActive = false;
let activeTargetTabId: number | null = null;
let activeTargetWindowId: number | null = null;

function getVoiceTargetInstanceState(): VoiceTargetInstanceState {
  return {
    bindingEpoch: activeTargetBindingEpoch,
    targetTabId: activeTargetTabId,
    pageInstanceId:
      activeTargetTabId === null
        ? null
        : (pageInstanceIds.get(activeTargetTabId) ?? null),
    contentInstanceId:
      activeTargetTabId === null
        ? null
        : (contentInstanceIds.get(activeTargetTabId) ?? null),
  };
}

function resetTargetFreshness(tabId: number, reason: string): void {
  contextFingerprints.delete(tabId);
  liveContextHashes.delete(tabId);
  activeTargetBindingEpoch += 1;
  console.log(
    `${BG} Voice target freshness reset tab=${tabId} epoch=${activeTargetBindingEpoch} reason=${reason}`,
  );
}

function updateContentInstance(args: {
  tabId: number;
  contentInstanceId?: string | null;
  pageInstanceId?: string | null;
}): void {
  if (args.contentInstanceId) {
    contentInstanceIds.set(args.tabId, args.contentInstanceId);
  }
  if (args.pageInstanceId) {
    pageInstanceIds.set(args.tabId, args.pageInstanceId);
  }
}

function updateContentInstanceFromMessage(args: {
  tabId: number;
  contentInstanceId?: unknown;
  pageInstanceId?: unknown;
}): void {
  const nextContentInstanceId =
    typeof args.contentInstanceId === 'string' && args.contentInstanceId.length
      ? args.contentInstanceId
      : null;
  const nextPageInstanceId =
    typeof args.pageInstanceId === 'string' && args.pageInstanceId.length
      ? args.pageInstanceId
      : null;
  const previousPageInstanceId = pageInstanceIds.get(args.tabId) ?? null;

  if (
    activeTargetTabId === args.tabId &&
    previousPageInstanceId &&
    nextPageInstanceId &&
    previousPageInstanceId !== nextPageInstanceId
  ) {
    resetTargetFreshness(args.tabId, 'page_instance_changed');
  }

  updateContentInstance({
    tabId: args.tabId,
    contentInstanceId: nextContentInstanceId,
    pageInstanceId: nextPageInstanceId,
  });
}

function clearTabInstanceState(tabId: number): void {
  latestContexts.delete(tabId);
  contextUpdateSeq.delete(tabId);
  contextFingerprints.delete(tabId);
  liveContextHashes.delete(tabId);
  contentInstanceIds.delete(tabId);
  pageInstanceIds.delete(tabId);
  targetLoadingTabs.delete(tabId);
}

async function waitForTargetReady(
  tabId: number,
): Promise<'ready' | 'loading' | 'unavailable'> {
  const deadline = Date.now() + TOOL_TARGET_LOADING_GRACE_MS;

  while (Date.now() <= deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!isSupportedPageTargetUrl(tab.url)) return 'unavailable';
      if (tab.status !== 'loading' && !targetLoadingTabs.has(tabId)) {
        return 'ready';
      }
    } catch {
      return 'unavailable';
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, TOOL_TARGET_LOADING_POLL_MS);
    });
  }

  return 'loading';
}

function isSupportedPageTargetUrl(url?: string | null): boolean {
  return isSupportedVoiceTargetUrl(url);
}

async function queryOffscreenSessionState(): Promise<OffscreenSessionState> {
  try {
    // @ts-expect-error — chrome.offscreen is MV3; types may lag
    if (!(await chrome.offscreen.hasDocument?.())) {
      return {};
    }
    return ((await chrome.runtime.sendMessage({
      target: 'offscreen',
      kind: 'QUERY_STATE',
    })) ?? {}) as OffscreenSessionState;
  } catch {
    return {};
  }
}

async function persistVoiceTargetState(): Promise<void> {
  let location: { urlHost: string | null; urlPath: string | null } = {
    urlHost: null,
    urlPath: null,
  };

  if (activeTargetTabId !== null) {
    try {
      const tab = await chrome.tabs.get(activeTargetTabId);
      const fallback = buildFallbackDebugLocation(tab.url);
      location = {
        urlHost: fallback.urlHost,
        urlPath: fallback.urlPath,
      };
      activeTargetWindowId = tab.windowId ?? activeTargetWindowId;
    } catch {
      activeTargetTabId = null;
      activeTargetWindowId = null;
    }
  }

  await chrome.storage.session.set({
    [VOICE_TARGET_STATE_KEY]: {
      sessionActive: voiceSessionActive,
      activeTargetTabId,
      windowId: activeTargetWindowId,
      ...location,
      updatedAt: Date.now(),
    } satisfies VoiceTargetState,
  });
}

async function clearVoiceTargetState(): Promise<void> {
  if (activeTargetTabId !== null) {
    await sendPageContextCollectionState(activeTargetTabId, false);
    clearTabInstanceState(activeTargetTabId);
  }
  activeTargetTabId = null;
  activeTargetWindowId = null;
  voiceSessionActive = false;
  await chrome.storage.session.remove(VOICE_TARGET_STATE_KEY);
}

async function setActiveVoiceTarget(
  tabId: number,
  reason: string,
): Promise<boolean> {
  try {
    const previousTargetTabId = activeTargetTabId;
    const tab = await chrome.tabs.get(tabId);
    if (!isSupportedPageTargetUrl(tab.url)) {
      console.log(`${BG} Voice target unavailable (${reason}) for ${tab.url}`);
      return false;
    }
    activeTargetTabId = tabId;
    activeTargetWindowId = tab.windowId ?? null;
    if (previousTargetTabId !== tabId || reason === 'session_start_rebind') {
      resetTargetFreshness(tabId, reason);
    }
    if (previousTargetTabId !== null && previousTargetTabId !== tabId) {
      await sendPageContextCollectionState(previousTargetTabId, false);
      clearTabInstanceState(previousTargetTabId);
    }
    if (activeDebugSession) {
      activeDebugSession.tabId = tabId;
      activeDebugSession.windowId = activeTargetWindowId;
    }
    await persistVoiceTargetState();
    await sendPageContextCollectionState(tabId, true);
    console.log(
      `${BG} Voice target set to tab=${tabId} epoch=${activeTargetBindingEpoch} pageInstance=${
        pageInstanceIds.get(tabId) ?? 'unknown'
      } (${reason})`,
    );
    return true;
  } catch (err) {
    console.warn(`${BG} Voice target set failed:`, (err as Error).message);
    return false;
  }
}

async function clearActiveVoiceTarget(
  tabId: number,
  reason: string,
): Promise<void> {
  if (activeTargetTabId !== tabId) return;
  await sendPageContextCollectionState(tabId, false);
  clearTabInstanceState(tabId);
  activeTargetTabId = null;
  activeTargetWindowId = null;
  resetTargetFreshness(tabId, reason);
  await persistVoiceTargetState();
  console.log(
    `${BG} Voice target tab=${tabId} cleared epoch=${activeTargetBindingEpoch} (${reason})`,
  );
}

async function restoreVoiceSessionState(): Promise<void> {
  const [stored, offscreenState] = await Promise.all([
    chrome.storage.session.get(VOICE_TARGET_STATE_KEY),
    queryOffscreenSessionState(),
  ]);
  const targetState = stored[VOICE_TARGET_STATE_KEY] as
    | VoiceTargetState
    | undefined;

  voiceSessionActive = offscreenState.active === true;
  activeTargetTabId =
    voiceSessionActive && typeof targetState?.activeTargetTabId === 'number'
      ? targetState.activeTargetTabId
      : null;
  activeTargetWindowId =
    voiceSessionActive && typeof targetState?.windowId === 'number'
      ? targetState.windowId
      : null;

  if (activeTargetTabId !== null) {
    try {
      const tab = await chrome.tabs.get(activeTargetTabId);
      if (!isSupportedPageTargetUrl(tab.url)) {
        activeTargetTabId = null;
        activeTargetWindowId = null;
      }
    } catch {
      activeTargetTabId = null;
      activeTargetWindowId = null;
    }
  }

  if (!voiceSessionActive) {
    activeTargetTabId = null;
    activeTargetWindowId = null;
  }

  await persistVoiceTargetState();
}

async function hasActiveVoiceSession(): Promise<boolean> {
  if (voiceSessionActive) return true;
  await restoreVoiceSessionState();
  return voiceSessionActive;
}

async function getActiveVoiceTargetTabId(): Promise<number | null> {
  if (activeTargetTabId === null) return null;

  try {
    const tab = await chrome.tabs.get(activeTargetTabId);
    if (!isSupportedPageTargetUrl(tab.url)) {
      await clearActiveVoiceTarget(activeTargetTabId, 'unsupported_page');
      return null;
    }
    return activeTargetTabId;
  } catch {
    const staleTabId = activeTargetTabId;
    if (staleTabId !== null) {
      await clearActiveVoiceTarget(staleTabId, 'missing_tab');
    }
    return null;
  }
}

function buildUnavailableToolResult(toolName: string): string {
  return buildUnavailableVoiceTargetToolResult(toolName);
}

async function maybeRegisterVoiceTarget(
  tabId: number,
  reason: string,
): Promise<boolean> {
  const [extensionEnabled, sessionActive] = await Promise.all([
    getExtensionEnabled(),
    hasActiveVoiceSession(),
  ]);

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return false;
  }

  if (
    !shouldRegisterVoiceTarget({
      extensionEnabled,
      sessionActive,
      activeTargetTabId,
      candidateTabId: tabId,
      candidateTabActive: tab.active === true,
      candidateUrl: tab.url,
    })
  ) {
    return false;
  }

  return setActiveVoiceTarget(tabId, reason);
}

async function startAgentSession(
  tabId: number,
  options: { skipMicBootstrap?: boolean } = {},
): Promise<{ pendingPermission?: boolean }> {
  const sourceTab = await chrome.tabs.get(tabId);
  const debugContextFields = {
    ...getDebugContextFields(tabId),
    ...buildFallbackDebugLocation(sourceTab.url),
  };

  if (await hasActiveVoiceSession()) {
    console.log(`${BG} Voice session already active; rebinding tab ${tabId}`);
    await setActiveVoiceTarget(tabId, 'session_start_rebind');
    chrome.tabs.sendMessage(
      tabId,
      {
        type: 'SESSION_EVENT',
        kind: 'connected',
        payload: { rebound: true, bindingEpoch: activeTargetBindingEpoch },
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            `${BG} Rebind session event failed tab=${tabId} epoch=${activeTargetBindingEpoch}:`,
            chrome.runtime.lastError.message,
          );
        }
      },
    );
    const context = latestContexts.get(tabId);
    if (context) {
      void sendLiveContextUpdate(tabId, context);
    } else {
      void handleGetPageContextTool(`rebind_context_${Date.now()}`, null, {
        forwardToOffscreen: false,
      });
    }
    return {};
  }

  if (pendingSessionStartTabId !== null) {
    if (pendingSessionStartTabId !== tabId) {
      console.log(
        `${BG} Session start already pending for tab ${pendingSessionStartTabId}`,
      );
    }
    return { pendingPermission: true };
  }

  if (activeDebugSession === null && (await getDebugSessionLoggingEnabled())) {
    activeDebugSession = createDebugSessionState({
      tabId,
      windowId: sourceTab.windowId ?? null,
    });
    queueDebugSessionEvent({
      eventType: 'session_start_requested',
      turnId: null,
      tabId,
      windowId: sourceTab.windowId ?? null,
      ...debugContextFields,
    });
  }
  if (activeTelemetrySession === null) {
    activeTelemetrySession = createTelemetrySessionState({
      tabId,
      windowId: sourceTab.windowId ?? null,
    });
    queueProductTelemetryEvent({
      eventType: 'session_start_requested',
      turnId: null,
      metadata: {
        tabId,
        windowId: sourceTab.windowId ?? null,
        route: 'agent_session',
      },
      ...getTelemetryContextFields(tabId),
    });
  }

  const micPermissionGranted = await getMicPermissionGranted();
  if (
    !options.skipMicBootstrap &&
    shouldOpenMicPermissionBootstrap({ micPermissionGranted })
  ) {
    await openMicPermissionPage(tabId);
    return { pendingPermission: true };
  }

  const signedUrl = await fetchSignedUrl();
  await ensureOffscreen();
  voiceSessionActive = true;
  await setActiveVoiceTarget(tabId, 'session_start');
  liveContextHashes.delete(tabId);

  const response = (await chrome.runtime.sendMessage({
    target: 'offscreen',
    kind: 'START_SESSION',
    payload: { signedUrl, tabId },
  })) as { ok: boolean; error?: string } | undefined;

  if (!response?.ok) {
    await clearVoiceTargetState();
    if (
      !options.skipMicBootstrap &&
      shouldOpenMicPermissionBootstrap({
        micPermissionGranted,
        errorMessage: response?.error,
      })
    ) {
      await setMicPermissionGranted(false);
      await openMicPermissionPage(tabId);
      return { pendingPermission: true };
    }

    finalizeDebugSession({
      eventType: 'session_error',
      turnId: null,
      tabId,
      windowId: sourceTab.windowId ?? null,
      error: response?.error ?? 'Offscreen failed to start session',
      ...debugContextFields,
    });
    queueProductTelemetryEvent({
      eventType: 'session_error',
      turnId: null,
      errorCategory: 'offscreen_start_failed',
      outcome: 'failed',
      metadata: {
        tabId,
        route: 'agent_session',
        windowId: sourceTab.windowId ?? null,
      },
      ...getTelemetryContextFields(tabId),
    });
    throw new Error(response?.error ?? 'Offscreen failed to start session');
  }

  return {};
}

async function endAgentSession(): Promise<void> {
  turnGuards.clear();
  try {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      kind: 'END_SESSION',
    });
  } catch (err) {
    console.warn(`${BG} END_SESSION error:`, (err as Error).message);
  }
  if (activeTargetTabId !== null) {
    liveContextHashes.delete(activeTargetTabId);
  }
  if (activeTelemetrySession) {
    queueProductTelemetryEvent({
      eventType: 'session_ended',
      turnId: null,
      outcome: 'ended',
      ...getTelemetryContextFields(activeTelemetrySession.tabId),
    });
  }
  activeTelemetrySession = null;
  await clearVoiceTargetState();
}

async function sendLiveContextUpdate(
  tabId: number,
  context: PageContext,
): Promise<void> {
  if (!voiceSessionActive || activeTargetTabId !== tabId) return;
  const sanitizedContext = sanitizePageContextForNetwork(context);

  try {
    const startedAtMs = Date.now();
    const pack = await apiFetch<LiveContextPack>(
      '/api/extension/live-context',
      {
        method: 'POST',
        body: JSON.stringify({ context: sanitizedContext }),
      },
    );

    if (!pack.text) return;
    queueProductTelemetryEvent({
      eventType: 'live_context_update',
      turnId: activeTelemetrySession?.currentTurnId ?? null,
      latencyMs: Date.now() - startedAtMs,
      sourceCount: pack.sources.length,
      sourceKinds: pack.sources.map((source) => source.kind),
      outcome: 'sent',
      metadata: {
        knowledgeMode: pack.knowledgeMode,
        sourceCount: pack.sources.length,
      },
      ...getTelemetryContextFields(tabId),
    });
    if (liveContextHashes.get(tabId) === pack.hash) return;

    const response = await sendOffscreenContextualUpdate({
      text: pack.text,
      hash: pack.hash,
      knowledgeMode: pack.knowledgeMode,
      sourceCount: pack.sources.length,
      source: 'live_context',
    });

    if (!response?.ok) {
      console.warn(
        `${BG} Contextual update failed:`,
        response?.error ?? 'offscreen rejected update',
      );
      return;
    }

    liveContextHashes.set(tabId, pack.hash);
  } catch (err) {
    console.warn(`${BG} Live context update failed:`, (err as Error).message);
  }
}

async function handleMicPermissionResult(args: {
  ok: boolean;
  resumeTabId?: number;
  error?: string;
  permissionTabId?: number;
}): Promise<void> {
  const resumeTabId = args.resumeTabId ?? pendingSessionStartTabId;

  if (args.ok) {
    await setMicPermissionGranted(true);
    if (resumeTabId !== null) {
      queueDebugSessionEvent({
        eventType: 'mic_permission_granted',
        turnId: null,
        tabId: resumeTabId,
        windowId: activeDebugSession?.windowId ?? null,
        ...getDebugContextFields(resumeTabId),
      });
    }

    const { permissionTabId } = clearPendingMicPermissionFlow();
    if (permissionTabId !== null) {
      try {
        await chrome.tabs.remove(permissionTabId);
      } catch {
        // Ignore if the page already closed.
      }
    }

    if (resumeTabId === null) return;

    try {
      queueDebugSessionEvent({
        eventType: 'mic_permission_resumed',
        turnId: null,
        tabId: resumeTabId,
        windowId: activeDebugSession?.windowId ?? null,
        ...getDebugContextFields(resumeTabId),
      });
      await startAgentSession(resumeTabId, { skipMicBootstrap: true });
    } catch (err) {
      emitSessionErrorToTab(resumeTabId, (err as Error).message);
    }
    return;
  }

  await setMicPermissionGranted(false);

  if (resumeTabId !== null) {
    emitSessionErrorToTab(
      resumeTabId,
      args.error ?? 'Microphone permission is required to start Tribora.',
    );
  }

  if (resumeTabId !== null) {
    const errorMessage =
      args.error ?? 'Microphone permission is required to start Tribora.';
    queueDebugSessionEvent({
      eventType: 'mic_permission_denied',
      turnId: null,
      tabId: resumeTabId,
      windowId: activeDebugSession?.windowId ?? null,
      error: errorMessage,
      ...getDebugContextFields(resumeTabId),
    });
    finalizeDebugSession({
      eventType: 'session_error',
      turnId: null,
      tabId: resumeTabId,
      windowId: activeDebugSession?.windowId ?? null,
      error: errorMessage,
      ...getDebugContextFields(resumeTabId),
    });
  }

  if (args.permissionTabId !== undefined && args.permissionTabId !== null) {
    pendingMicPermissionPageTabId = args.permissionTabId;
  }
}

// ─── Message routing ──────────────────────────────────────────────────────────

// Offscreen → background: emit session events and tool calls.
// Route events/tools to the current active page target and wait for TOOL_RESULT
// from the content script, forwarding to offscreen.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'background') return false;

  if (message.kind === 'SESSION_EVENT') {
    const { kind, payload } = message.payload as {
      kind: string;
      payload: unknown;
    };

    if (kind === 'connected') {
      voiceSessionActive = true;
      void persistVoiceTargetState();
      const conversationId =
        typeof (payload as { conversationId?: unknown })?.conversationId ===
        'string'
          ? ((payload as { conversationId?: string }).conversationId ?? null)
          : null;
      if (conversationId && activeDebugSession) {
        activeDebugSession.conversationId = conversationId;
      }
      if (conversationId && activeTelemetrySession) {
        activeTelemetrySession.conversationId = conversationId;
      }
      if (activeDebugSession) {
        queueDebugSessionEvent({
          eventType: 'session_started',
          turnId: null,
          tabId: activeDebugSession.tabId,
          windowId: activeDebugSession.windowId,
          conversationId: activeDebugSession.conversationId,
          ...getDebugContextFields(activeDebugSession.tabId),
        });
      }
      if (activeTelemetrySession) {
        queueProductTelemetryEvent({
          eventType: 'session_started',
          turnId: null,
          conversationId: activeTelemetrySession.conversationId,
          outcome: 'connected',
          ...getTelemetryContextFields(activeTelemetrySession.tabId),
        });
      }

      const connectedTabId =
        activeTelemetrySession?.tabId ?? activeDebugSession?.tabId ?? null;
      const connectedContext =
        connectedTabId === null ? null : latestContexts.get(connectedTabId);
      if (connectedContext) {
        void sendLiveContextUpdate(connectedTabId, connectedContext);
      }
    }

    if (kind === 'contextual_update' && activeDebugSession) {
      const updatePayload =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      queueDebugSessionEvent({
        eventType: 'contextual_update_sent',
        turnId: activeDebugSession.currentTurnId,
        tabId: activeDebugSession.tabId,
        windowId: activeDebugSession.windowId,
        conversationId: activeDebugSession.conversationId,
        resultText:
          typeof updatePayload.knowledgeMode === 'string'
            ? `knowledge=${updatePayload.knowledgeMode}; sources=${
                typeof updatePayload.sourceCount === 'number'
                  ? updatePayload.sourceCount
                  : 0
              }`
            : 'contextual update sent',
        ...getDebugContextFields(activeDebugSession.tabId),
      });
    }

    if (kind === 'message' && (activeDebugSession || activeTelemetrySession)) {
      const transcript = (payload as { message?: Record<string, unknown> })
        ?.message as Record<string, unknown> | undefined;
      const source =
        typeof transcript?.source === 'string' ? transcript.source : null;
      const messageText =
        typeof transcript?.message === 'string' ? transcript.message : null;

      if (messageText) {
        const transcriptConfidence =
          source === 'user'
            ? classifyTranscriptConfidence(messageText)
            : { lowConfidence: false, reason: null };

        const turnId =
          activeDebugSession &&
          source === 'user' &&
          !transcriptConfidence.lowConfidence
            ? advanceDebugTurn(activeDebugSession)
            : activeDebugSession?.currentTurnId ?? null;
        const telemetryTurnId =
          activeTelemetrySession &&
          source === 'user' &&
          !transcriptConfidence.lowConfidence
            ? advanceTelemetryTurn(activeTelemetrySession)
            : activeTelemetrySession?.currentTurnId ?? null;

        if (activeTelemetrySession) {
          if (
            source === 'user' &&
            telemetryTurnId &&
            !transcriptConfidence.lowConfidence
          ) {
            queueProductTelemetryEvent({
              eventType: 'turn_started',
              turnId: telemetryTurnId,
              messageDirection: 'user',
              messageLength: messageText.length,
              ...getTelemetryContextFields(activeTelemetrySession.tabId),
            });
          }

          queueProductTelemetryEvent({
            eventType: 'message_observed',
            turnId: telemetryTurnId,
            messageDirection:
              source === 'user' || source === 'assistant' ? source : 'system',
            messageLength: messageText.length,
            outcome:
              source === 'user' && transcriptConfidence.lowConfidence
                ? 'ignored_low_confidence'
                : 'observed',
            metadata: {
              lowConfidence:
                source === 'user' ? transcriptConfidence.lowConfidence : false,
              reason: transcriptConfidence.reason ?? null,
            },
            ...getTelemetryContextFields(activeTelemetrySession.tabId),
          });
        }

        if (
          activeDebugSession &&
          source === 'user' &&
          transcriptConfidence.lowConfidence
        ) {
          queueDebugSessionEvent({
            eventType: 'low_confidence_user_message',
            turnId,
            tabId: activeDebugSession.tabId,
            windowId: activeDebugSession.windowId,
            conversationId: activeDebugSession.conversationId,
            messageText,
            resultText: `Ignored low-confidence transcript: ${transcriptConfidence.reason ?? 'unknown'}`,
            ...getDebugContextFields(activeDebugSession.tabId),
          });
        }

        if (
          source === 'user' &&
          (turnId || telemetryTurnId) &&
          !transcriptConfidence.lowConfidence
        ) {
          turnGuards.startTurn(turnId ?? telemetryTurnId ?? '');
        }

        if (source === 'assistant' && (turnId || telemetryTurnId)) {
          const guardTurnId = turnId ?? telemetryTurnId ?? '';
          const assistantOutcome = turnGuards.recordAssistantMessage(guardTurnId);
          if (activeTelemetrySession) {
            queueProductTelemetryEvent({
              eventType: 'assistant_answer_outcome',
              turnId: telemetryTurnId,
              messageDirection: 'assistant',
              messageLength: messageText.length,
              outcome: assistantOutcome.duplicateWithoutMaterialChange
                ? 'duplicate_without_material_change'
                : 'observed',
              ...getTelemetryContextFields(activeTelemetrySession.tabId),
            });
            queueProductTelemetryEvent({
              eventType: 'turn_completed',
              turnId: telemetryTurnId,
              outcome: assistantOutcome.duplicateWithoutMaterialChange
                ? 'duplicate_without_material_change'
                : 'assistant_observed',
              ...getTelemetryContextFields(activeTelemetrySession.tabId),
            });
          }
          if (assistantOutcome.duplicateWithoutMaterialChange) {
            if (activeTelemetrySession) {
              queueProductTelemetryEvent({
                eventType: 'duplicate_assistant_reply_detected',
                turnId: telemetryTurnId,
                messageDirection: 'assistant',
                messageLength: messageText.length,
                outcome: 'duplicate_without_material_change',
                ...getTelemetryContextFields(activeTelemetrySession.tabId),
              });
            }
            if (activeDebugSession) {
              queueDebugSessionEvent({
                eventType: 'duplicate_assistant_reply',
                turnId,
                tabId: activeDebugSession.tabId,
                windowId: activeDebugSession.windowId,
                conversationId: activeDebugSession.conversationId,
                messageText,
                resultText:
                  'Assistant replied again in the same turn without a new material page or tool change.',
                ...getDebugContextFields(activeDebugSession.tabId),
              });
            }

            void sendOffscreenContextualUpdate({
              text: 'You already answered this user turn and the page state has not changed materially. Do not repeat the same answer again unless a new tool result or page change occurs.',
              source: 'watchdog',
              reason: 'duplicate_assistant_reply',
            }).catch((err) => {
              console.warn(
                `${BG} Duplicate-reply nudge failed:`,
                (err as Error).message,
              );
            });
          }
        }

        if (activeDebugSession) {
          queueDebugSessionEvent({
            eventType: source === 'user' ? 'user_message' : 'assistant_message',
            turnId,
            tabId: activeDebugSession.tabId,
            windowId: activeDebugSession.windowId,
            conversationId: activeDebugSession.conversationId,
            messageText,
            ...getDebugContextFields(activeDebugSession.tabId),
          });
        }
      }
    }

    if (kind === 'error' && activeDebugSession) {
      queueDebugSessionEvent({
        eventType: 'session_error',
        turnId: null,
        tabId: activeDebugSession.tabId,
        windowId: activeDebugSession.windowId,
        conversationId: activeDebugSession.conversationId,
        error:
          typeof (payload as { error?: unknown })?.error === 'string'
            ? ((payload as { error?: string }).error ?? 'Unknown session error')
            : 'Unknown session error',
        ...getDebugContextFields(activeDebugSession.tabId),
      });
    }

    if (kind === 'disconnected' && activeDebugSession) {
      finalizeDebugSession({
        eventType: 'session_ended',
        turnId: null,
        tabId: activeDebugSession.tabId,
        windowId: activeDebugSession.windowId,
        conversationId: activeDebugSession.conversationId,
        resultText:
          typeof (payload as { reason?: unknown })?.reason === 'string'
            ? `disconnected:${(payload as { reason?: string }).reason}`
            : 'disconnected',
        ...getDebugContextFields(activeDebugSession.tabId),
      });
    }
    if (kind === 'disconnected' && activeTelemetrySession) {
      queueProductTelemetryEvent({
        eventType: 'session_ended',
        turnId: null,
        outcome: 'disconnected',
        metadata: {
          reason:
            typeof (payload as { reason?: unknown })?.reason === 'string'
              ? (payload as { reason?: string }).reason
              : null,
        },
        ...getTelemetryContextFields(activeTelemetrySession.tabId),
      });
      activeTelemetrySession = null;
    }

    if (activeTargetTabId !== null) {
      const payloadRecord =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : { value: payload };
      chrome.tabs.sendMessage(
        activeTargetTabId,
        {
          type: 'SESSION_EVENT',
          kind,
          payload: {
            ...payloadRecord,
            bindingEpoch: activeTargetBindingEpoch,
          },
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              `${BG} Session event delivery failed tab=${activeTargetTabId} epoch=${activeTargetBindingEpoch}:`,
              chrome.runtime.lastError.message,
            );
          }
        },
      );
    }
    if (kind === 'disconnected' || kind === 'error') {
      if (activeTargetTabId !== null) {
        liveContextHashes.delete(activeTargetTabId);
      }
      void clearVoiceTargetState();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.kind === 'TOOL_CALL') {
    const { callId, name, args } = message.payload as {
      callId: string;
      name: string;
      args: unknown;
    };
    void routeToolCall(callId, name, args);
    sendResponse({ ok: true });
    return false;
  }

  // Filter: ignore unrelated background-targeted messages
  return false;
});

async function routeToolCall(
  callId: string,
  name: string,
  args: unknown,
): Promise<void> {
  const turnId = activeDebugSession?.currentTurnId ?? null;

  if (name === 'capture_screenshot') {
    await handleScreenshot(callId);
    return;
  }

  if (name === 'get_page_context') {
    await handleGetPageContextTool(callId, turnId);
    return;
  }

  const targetTabId = await getActiveVoiceTargetTabId();
  if (targetTabId === null) {
    await replyToolResult(callId, {
      result: buildUnavailableToolResult(name),
    });
    return;
  }

  const readyState = await waitForTargetReady(targetTabId);
  if (readyState === 'loading') {
    await replyToolResult(callId, {
      result: buildLoadingVoiceTargetToolResult(name),
    });
    return;
  }
  if (readyState === 'unavailable') {
    await replyToolResult(callId, {
      result: buildUnavailableToolResult(name),
    });
    return;
  }

  const routeMeta = buildToolRouteMeta(getVoiceTargetInstanceState());
  if (!routeMeta) {
    await replyToolResult(callId, {
      result: buildUnavailableToolResult(name),
    });
    return;
  }

  pendingToolRoutes.set(callId, {
    name,
    routeMeta,
    startedAtMs: Date.now(),
  });

  if (activeDebugSession) {
    const contextFields = getDebugContextFields(targetTabId);
    const toolArgs = summarizeToolCallArgs(name, args);
    pendingDebugToolCalls.set(callId, {
      turnId,
      name,
      ...toolArgs,
      ...contextFields,
      tabId: targetTabId,
      windowId: activeDebugSession.windowId,
      bindingEpoch: routeMeta.bindingEpoch,
      pageInstanceId: routeMeta.pageInstanceId,
      contentInstanceId: routeMeta.contentInstanceId,
      startedAtMs: Date.now(),
      routeMeta,
    });
    queueDebugSessionEvent({
      eventType: 'tool_call_started',
      turnId,
      toolName: name,
      tabId: targetTabId,
      windowId: activeDebugSession.windowId,
      conversationId: activeDebugSession.conversationId,
      bindingEpoch: routeMeta.bindingEpoch,
      pageInstanceId: routeMeta.pageInstanceId,
      contentInstanceId: routeMeta.contentInstanceId,
      ...toolArgs,
      ...contextFields,
    });
  }
  if (activeTelemetrySession) {
    const toolArgs = summarizeToolCallArgs(name, args);
    queueProductTelemetryEvent({
      eventType: 'tool_call_started',
      turnId: activeTelemetrySession.currentTurnId,
      ...summarizeTelemetryToolArgs({
        name,
        action: toolArgs.action,
        selector: toolArgs.selector,
        inputTextLength: toolArgs.inputTextLength,
      }),
      metadata: {
        bindingEpoch: routeMeta.bindingEpoch,
        pageInstancePresent: Boolean(routeMeta.pageInstanceId),
        contentInstancePresent: Boolean(routeMeta.contentInstanceId),
      },
      ...getTelemetryContextFields(targetTabId),
    });
  }

  console.log(
    `${BG} Tool call start id=${callId} tool=${name} tab=${targetTabId} epoch=${routeMeta.bindingEpoch} pageInstance=${
      routeMeta.pageInstanceId ?? 'unknown'
    } contentInstance=${routeMeta.contentInstanceId ?? 'unknown'}`,
  );

  chrome.tabs.sendMessage(
    targetTabId,
    { type: 'TOOL_CALL', callId, name, args, route: routeMeta },
    () => {
      if (chrome.runtime.lastError) {
        const errorMessage =
          chrome.runtime.lastError.message ?? 'Content script unavailable';
        console.warn(
          `${BG} Tool delivery failed id=${callId} tool=${name} tab=${targetTabId} epoch=${routeMeta.bindingEpoch}:`,
          errorMessage,
        );
        void clearActiveVoiceTarget(targetTabId, 'tool_send_failed').then(() =>
          replyToolResult(
            callId,
            {
              result: buildUnavailableToolResult(name),
              error: errorMessage,
            },
            { skipStaleCheck: true },
          ),
        );
      }
    },
  );
}

async function handleScreenshot(callId: string): Promise<void> {
  let targetTabId: number | null = null;
  try {
    targetTabId = await getActiveVoiceTargetTabId();
    if (targetTabId === null) {
      return replyToolResult(callId, {
        result: buildUnavailableToolResult('capture_screenshot'),
      });
    }
    const readyState = await waitForTargetReady(targetTabId);
    if (readyState === 'loading') {
      return replyToolResult(callId, {
        result: buildLoadingVoiceTargetToolResult('capture_screenshot'),
      });
    }
    if (readyState === 'unavailable') {
      return replyToolResult(callId, {
        result: buildUnavailableToolResult('capture_screenshot'),
      });
    }
    const routeMeta = buildToolRouteMeta(getVoiceTargetInstanceState());
    if (!routeMeta) {
      return replyToolResult(callId, {
        result: buildUnavailableToolResult('capture_screenshot'),
      });
    }
    pendingToolRoutes.set(callId, {
      name: 'capture_screenshot',
      routeMeta,
      startedAtMs: Date.now(),
    });
    const tab = await chrome.tabs.get(targetTabId);
    if (activeDebugSession) {
      const contextFields = getDebugContextFields(targetTabId);
      const toolArgs = summarizeToolCallArgs('capture_screenshot', {});
      pendingDebugToolCalls.set(callId, {
        turnId: activeDebugSession.currentTurnId,
        name: 'capture_screenshot',
        ...toolArgs,
        ...contextFields,
        tabId: targetTabId,
        windowId: tab.windowId ?? activeDebugSession.windowId,
        bindingEpoch: routeMeta.bindingEpoch,
        pageInstanceId: routeMeta.pageInstanceId,
        contentInstanceId: routeMeta.contentInstanceId,
        startedAtMs: Date.now(),
        routeMeta,
      });
      queueDebugSessionEvent({
        eventType: 'tool_call_started',
        turnId: activeDebugSession.currentTurnId,
        toolName: 'capture_screenshot',
        tabId: targetTabId,
        windowId: tab.windowId ?? activeDebugSession.windowId,
        conversationId: activeDebugSession.conversationId,
        bindingEpoch: routeMeta.bindingEpoch,
        pageInstanceId: routeMeta.pageInstanceId,
        contentInstanceId: routeMeta.contentInstanceId,
        ...toolArgs,
        ...contextFields,
      });
    }
    if (activeTelemetrySession) {
      queueProductTelemetryEvent({
        eventType: 'tool_call_started',
        turnId: activeTelemetrySession.currentTurnId,
        toolName: 'capture_screenshot',
        action: 'capture',
        selectorPresent: false,
        metadata: {
          bindingEpoch: routeMeta.bindingEpoch,
          pageInstancePresent: Boolean(routeMeta.pageInstanceId),
          contentInstancePresent: Boolean(routeMeta.contentInstanceId),
        },
        ...getTelemetryContextFields(targetTabId),
      });
    }
    console.log(
      `${BG} Tool call start id=${callId} tool=capture_screenshot tab=${targetTabId} epoch=${routeMeta.bindingEpoch} pageInstance=${
        routeMeta.pageInstanceId ?? 'unknown'
      } contentInstance=${routeMeta.contentInstanceId ?? 'unknown'}`,
    );
    const windowId = tab.windowId;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: 70,
    });
    if (
      !isToolResultCurrent({
        route: routeMeta,
        current: getVoiceTargetInstanceState(),
        result: {
          bindingEpoch: routeMeta.bindingEpoch,
          pageInstanceId: routeMeta.pageInstanceId,
          contentInstanceId: routeMeta.contentInstanceId,
        },
      })
    ) {
      return replyToolResult(callId, {
        result: buildLoadingVoiceTargetToolResult('capture_screenshot'),
      });
    }
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await replyToolResult(callId, { result: base64 });
  } catch (err) {
    if (targetTabId !== null) {
      await clearActiveVoiceTarget(targetTabId, 'screenshot_failed');
    }
    await replyToolResult(callId, {
      result: buildUnavailableToolResult('capture_screenshot'),
    });
    console.warn(`${BG} Screenshot failed:`, (err as Error).message);
  }
}

async function handleGetPageContextTool(
  callId: string,
  turnId: string | null,
  options: { forwardToOffscreen?: boolean } = {},
): Promise<void> {
  const forwardToOffscreen = options.forwardToOffscreen !== false;
  let targetTabId: number | null = null;
  try {
    targetTabId = await getActiveVoiceTargetTabId();
    if (targetTabId === null) {
      return await replyToolResult(
        callId,
        {
          result: buildUnavailableToolResult('get_page_context'),
        },
        { forwardToOffscreen },
      );
    }

    const readyState = await waitForTargetReady(targetTabId);
    if (readyState === 'loading') {
      return await replyToolResult(
        callId,
        {
          result: buildLoadingVoiceTargetToolResult('get_page_context'),
        },
        { forwardToOffscreen },
      );
    }
    if (readyState === 'unavailable') {
      return await replyToolResult(
        callId,
        {
          result: buildUnavailableToolResult('get_page_context'),
        },
        { forwardToOffscreen },
      );
    }

    const routeMeta = buildToolRouteMeta(getVoiceTargetInstanceState());
    if (!routeMeta) {
      return await replyToolResult(
        callId,
        {
          result: buildUnavailableToolResult('get_page_context'),
        },
        { forwardToOffscreen },
      );
    }

    if (forwardToOffscreen) {
      pendingToolRoutes.set(callId, {
        name: 'get_page_context',
        routeMeta,
        startedAtMs: Date.now(),
      });

      if (activeDebugSession) {
        const contextFields = getDebugContextFields(targetTabId);
        const toolArgs = summarizeToolCallArgs('get_page_context', {});
        pendingDebugToolCalls.set(callId, {
          turnId,
          name: 'get_page_context',
          ...toolArgs,
          ...contextFields,
          tabId: targetTabId,
          windowId: activeDebugSession.windowId,
          bindingEpoch: routeMeta.bindingEpoch,
          pageInstanceId: routeMeta.pageInstanceId,
          contentInstanceId: routeMeta.contentInstanceId,
          startedAtMs: Date.now(),
          routeMeta,
        });
        queueDebugSessionEvent({
          eventType: 'tool_call_started',
          turnId,
          toolName: 'get_page_context',
          tabId: targetTabId,
          windowId: activeDebugSession.windowId,
          conversationId: activeDebugSession.conversationId,
          bindingEpoch: routeMeta.bindingEpoch,
          pageInstanceId: routeMeta.pageInstanceId,
          contentInstanceId: routeMeta.contentInstanceId,
          ...toolArgs,
          ...contextFields,
        });
      }
      if (activeTelemetrySession) {
        queueProductTelemetryEvent({
          eventType: 'tool_call_started',
          turnId: activeTelemetrySession.currentTurnId,
          toolName: 'get_page_context',
          action: 'inspect',
          selectorPresent: false,
          metadata: {
            bindingEpoch: routeMeta.bindingEpoch,
            pageInstancePresent: Boolean(routeMeta.pageInstanceId),
            contentInstancePresent: Boolean(routeMeta.contentInstanceId),
          },
          ...getTelemetryContextFields(targetTabId),
        });
      }
      console.log(
        `${BG} Tool call start id=${callId} tool=get_page_context tab=${targetTabId} epoch=${routeMeta.bindingEpoch} pageInstance=${
          routeMeta.pageInstanceId ?? 'unknown'
        } contentInstance=${routeMeta.contentInstanceId ?? 'unknown'}`,
      );
    }

    const response = (await chrome.tabs.sendMessage(targetTabId, {
      type: 'GET_PAGE_CONTEXT',
      route: routeMeta,
    })) as
      | {
          type?: 'PAGE_CONTEXT_RESPONSE';
          payload?: PageContext | null;
          bindingEpoch?: number | null;
          pageInstanceId?: string | null;
          contentInstanceId?: string | null;
        }
      | undefined;

    const resultMeta = parseToolResultMeta(
      (response ?? {}) as Record<string, unknown>,
    );
    if (
      !isToolResultCurrent({
        route: routeMeta,
        current: getVoiceTargetInstanceState(),
        result: resultMeta,
      })
    ) {
      return await replyToolResult(
        callId,
        {
          result: buildLoadingVoiceTargetToolResult('get_page_context'),
        },
        { forwardToOffscreen },
      );
    }

    const rawContext = response?.payload
      ? sanitizePageContextForNetwork(response.payload)
      : null;
    if (!rawContext) {
      return await replyToolResult(
        callId,
        {
          error: 'No page context available',
        },
        { forwardToOffscreen },
      );
    }

    const previousContext = latestContexts.get(targetTabId);
    if (pageContextKnowledgeIdentityChanged(previousContext, rawContext)) {
      liveContextHashes.delete(targetTabId);
    }
    const mergedContext = mergePageContextWithPrevious(
      previousContext,
      rawContext,
    );
    latestContexts.set(targetTabId, mergedContext);
    updateContentInstance({
      tabId: targetTabId,
      contentInstanceId: resultMeta.contentInstanceId,
      pageInstanceId: resultMeta.pageInstanceId,
    });

    const modelContext = sanitizePageContextForModel(mergedContext);
    const fingerprint = buildContextSemanticFingerprint(modelContext);
    const pageContextOutcome = turnId
      ? turnGuards.recordToolCompletion({
          turnId,
          toolName: 'get_page_context',
          pageContextFingerprint: fingerprint,
        })
      : {
          repeatedPageContext: false,
          unchangedPageContext: false,
        };

    const { result } = buildPageContextToolPayload({
      context: modelContext,
      meta: {
        repeatedPageContext: pageContextOutcome.repeatedPageContext,
        unchangedPageContext: pageContextOutcome.unchangedPageContext,
        bindingEpoch: routeMeta.bindingEpoch,
        pageInstanceId: resultMeta.pageInstanceId,
        contentInstanceId: resultMeta.contentInstanceId,
      },
    });

    await replyToolResult(callId, { result }, { forwardToOffscreen });
    if (!forwardToOffscreen) {
      await sendLiveContextUpdate(targetTabId, mergedContext);
    }
  } catch (err) {
    if (targetTabId !== null) {
      await clearActiveVoiceTarget(targetTabId, 'page_context_failed');
    }
    await replyToolResult(
      callId,
      {
        result: buildUnavailableToolResult('get_page_context'),
      },
      { forwardToOffscreen },
    );
    console.warn(`${BG} Page context failed:`, (err as Error).message);
  }
}

async function replyToolResult(
  callId: string,
  body: { result?: string; error?: string },
  options: {
    forwardToOffscreen?: boolean;
    resultMeta?: ReturnType<typeof parseToolResultMeta>;
    skipStaleCheck?: boolean;
  } = {},
): Promise<void> {
  const route = pendingToolRoutes.get(callId);
  const stale =
    !options.skipStaleCheck &&
    route &&
    options.resultMeta &&
    !isToolResultCurrent({
      route: route.routeMeta,
      current: getVoiceTargetInstanceState(),
      result: options.resultMeta,
    });
  const finalBody = stale
    ? {
        result: buildLoadingVoiceTargetToolResult(route.name),
        error: undefined,
      }
    : body;
  const pendingTool = pendingDebugToolCalls.get(callId);
  if (pendingTool && activeDebugSession) {
    if (pendingTool.turnId) {
      if (pendingTool.name === 'get_page_context') {
        // get_page_context is recorded when we build the special tool payload,
        // so we do not advance the turn guard a second time here.
      } else {
        turnGuards.recordToolCompletion({
          turnId: pendingTool.turnId,
          toolName: pendingTool.name,
        });
      }
    }

    pendingDebugToolCalls.delete(callId);
    const durationMs = Date.now() - pendingTool.startedAtMs;
    queueDebugSessionEvent({
      eventType: 'tool_call_completed',
      turnId: pendingTool.turnId,
      toolName: pendingTool.name,
      selector: pendingTool.selector,
      label: pendingTool.label,
      action: pendingTool.action,
      inputTextPreview: pendingTool.inputTextPreview,
      inputTextLength: pendingTool.inputTextLength,
      tabId: pendingTool.tabId,
      windowId: pendingTool.windowId,
      conversationId: activeDebugSession.conversationId,
      urlHost: pendingTool.urlHost,
      urlPath: pendingTool.urlPath,
      app: pendingTool.app,
      screen: pendingTool.screen,
      knowledgeMode: pendingTool.knowledgeMode,
      vendorMatchBasis: pendingTool.vendorMatchBasis,
      orgMatchBasis: pendingTool.orgMatchBasis,
      pageSummary: pendingTool.pageSummary,
      selectedEntityTitle: pendingTool.selectedEntityTitle,
      fingerprint: pendingTool.fingerprint,
      bindingEpoch: pendingTool.bindingEpoch,
      pageInstanceId:
        options.resultMeta?.pageInstanceId ?? pendingTool.pageInstanceId,
      contentInstanceId:
        options.resultMeta?.contentInstanceId ?? pendingTool.contentInstanceId,
      durationMs,
      ...summarizeToolResult({
        name: pendingTool.name,
        result: finalBody.result,
        error: stale ? 'Stale tool result discarded' : finalBody.error,
      }),
    });
  }

  if (route) {
    const durationMs = Date.now() - route.startedAtMs;
    if (activeTelemetrySession) {
      queueProductTelemetryEvent({
        eventType: 'tool_call_completed',
        turnId: activeTelemetrySession.currentTurnId,
        toolName: route.name,
        latencyMs: durationMs,
        outcome: stale ? 'stale' : finalBody.error ? 'error' : 'ok',
        errorCategory: stale
          ? 'stale_result'
          : finalBody.error
            ? 'tool_error'
            : null,
        outputTextLength: finalBody.result?.length ?? null,
        metadata: {
          stale: Boolean(stale),
          bindingEpoch: route.routeMeta.bindingEpoch,
          pageInstancePresent: Boolean(
            options.resultMeta?.pageInstanceId ?? route.routeMeta.pageInstanceId,
          ),
          contentInstancePresent: Boolean(
            options.resultMeta?.contentInstanceId ??
              route.routeMeta.contentInstanceId,
          ),
        },
        ...getTelemetryContextFields(activeTelemetrySession.tabId),
      });
    }
    console.log(
      `${BG} Tool call complete id=${callId} tool=${route.name} epoch=${route.routeMeta.bindingEpoch} pageInstance=${
        options.resultMeta?.pageInstanceId ??
        route.routeMeta.pageInstanceId ??
        'unknown'
      } durationMs=${durationMs} stale=${stale ? 'true' : 'false'} error=${
        finalBody.error ? 'true' : 'false'
      }`,
    );
    pendingToolRoutes.delete(callId);
  }

  if (options.forwardToOffscreen === false) return;

  try {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      kind: 'TOOL_RESULT',
      payload: { callId, ...finalBody },
    });
  } catch (err) {
    console.warn(`${BG} replyToolResult error:`, (err as Error).message);
  }
}

// Content script → background: session control + tool results.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'START_AGENT_SESSION') {
    const requestedTabId =
      typeof message.tabId === 'number' ? message.tabId : null;
    const tabId = sender.tab?.id ?? requestedTabId;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No sender tab' });
      return false;
    }
    void startAgentSession(tabId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(async (err) => {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const fallbackLocation = buildFallbackDebugLocation(tab?.url);
        finalizeDebugSession({
          eventType: 'session_error',
          turnId: null,
          tabId,
          windowId: tab?.windowId ?? activeDebugSession?.windowId ?? null,
          error: (err as Error).message,
          ...getDebugContextFields(tabId),
          ...fallbackLocation,
        });
        sendResponse({ ok: false, error: (err as Error).message });
      });
    return true;
  }

  if (message?.type === 'END_AGENT_SESSION') {
    void endAgentSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === 'SET_EXTENSION_ENABLED') {
    const requestedTabId =
      typeof message.tabId === 'number' ? message.tabId : null;
    const tabId = sender.tab?.id ?? requestedTabId;
    void setExtensionEnabledForTab(message.enabled === true, tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) =>
        sendResponse({ ok: false, error: (err as Error).message }),
      );
    return true;
  }

  if (message?.type === 'WHICH_SESSION_ACTIVE') {
    const requestedTabId =
      typeof message.tabId === 'number' ? message.tabId : null;
    const tabId = sender.tab?.id ?? requestedTabId;
    void hasActiveVoiceSession()
      .then((active) =>
        sendResponse({
          active,
          isActiveTarget: tabId !== undefined && tabId === activeTargetTabId,
          activeTargetTabId,
        }),
      )
      .catch((err) =>
        sendResponse({ ok: false, error: (err as Error).message }),
      );
    return true;
  }

  if (message?.type === 'GET_EXTENSION_STATE') {
    const requestedTabId =
      typeof message.tabId === 'number' ? message.tabId : null;
    const tabId = sender.tab?.id ?? requestedTabId;
    void (async () => {
      const [enabled, active] = await Promise.all([
        getExtensionEnabled(),
        hasActiveVoiceSession(),
      ]);
      if (enabled && active && tabId !== undefined) {
        await maybeRegisterVoiceTarget(tabId, 'content_state_request');
      }
      const isActiveTarget = tabId !== undefined && tabId === activeTargetTabId;
      return {
        enabled,
        active,
        isActiveTarget,
        activeTargetTabId,
        canCollectPageContext: shouldCollectPageContext({
          extensionEnabled: enabled,
          sessionActive: active,
          isHomeTab: isActiveTarget,
        }),
      };
    })()
      .then((state) =>
        sendResponse({
          enabled: state.enabled,
          active: state.active,
          isActiveTarget: state.isActiveTarget,
          activeTargetTabId: state.activeTargetTabId,
          canCollectPageContext: state.canCollectPageContext,
        }),
      )
      .catch((err) =>
        sendResponse({ ok: false, error: (err as Error).message }),
      );
    return true;
  }

  if (message?.type === 'TOOL_RESULT') {
    const { callId, result, error } = message as {
      callId: string;
      result?: string;
      error?: string;
    };
    const resultMeta = parseToolResultMeta(message as Record<string, unknown>);
    void replyToolResult(callId, { result, error }, { resultMeta });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// ─── Widget toggle (extension icon) ───────────────────────────────────────────

export default defineBackground(() => {
  console.log(`${BG} Service worker started`);
  scheduleTokenRefresh();
  void restoreVoiceSessionState();

  void chrome.action.setPopup({ popup: 'popup.html' });

  // ── Recording (tab capture) ─────────────────────────────────────────────────
  let activeRecorder: TabRecorder | null = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RECORDING_START') {
      void (async () => {
        try {
          activeRecorder = createTabRecorder();
          await activeRecorder.start();
          sendResponse({
            ok: true,
            state: { status: 'recording', startedAt: Date.now() },
          });
        } catch (err) {
          sendResponse({ ok: false, error: (err as Error).message });
        }
      })();
      return true;
    }
    if (message?.type === 'RECORDING_STOP') {
      void (async () => {
        try {
          if (!activeRecorder) {
            return sendResponse({ ok: false, error: 'Not recording' });
          }
          const blob = await activeRecorder.stop();
          activeRecorder = null;

          const UPLOAD_STATE_KEY = 'tribora_upload_state';
          const broadcastUploadState = (patch: Record<string, unknown>) => {
            void chrome.storage.session.set({
              [UPLOAD_STATE_KEY]: { status: 'uploading', ...patch },
            });
          };

          const { recordingId } = await uploadRecording(
            blob,
            {
              filename: `extension-${Date.now()}.webm`,
              mimeType: 'video/webm',
              source: 'extension',
            },
            {
              onProgress: (progress) => {
                broadcastUploadState({
                  uploadProgress: progress.percent,
                  uploadedBytes: progress.uploaded,
                  totalBytes: progress.total,
                });
              },
              onRetry: (info) => {
                broadcastUploadState({
                  retryAttempt: info.attempt,
                  retryMax: info.maxAttempts,
                });
              },
            },
          );

          void chrome.storage.session.remove(UPLOAD_STATE_KEY);
          sendResponse({ ok: true, recordingId });
        } catch (err) {
          void chrome.storage.session.remove('tribora_upload_state');
          sendResponse({ ok: false, error: (err as Error).message });
        }
      })();
      return true;
    }
    return false;
  });

  // ── Page context + auth listeners ───────────────────────────────────────────
  async function enrichPageContext(
    tabId: number,
    context: PageContext,
  ): Promise<void> {
    const sanitizedContext = sanitizePageContextForNetwork(context);
    const nextSeq = (contextUpdateSeq.get(tabId) ?? 0) + 1;
    contextUpdateSeq.set(tabId, nextSeq);
    const startedAt = Date.now();

    try {
      const enrichment = await apiFetch<{
        app: string;
        screen: string;
        relevantWikiPages: string[];
        vendorKnowledgeMatch?: PageContext['vendorKnowledgeMatch'];
        orgKnowledgeMatch?: PageContext['orgKnowledgeMatch'];
        knowledgeAvailability?: PageContext['knowledgeAvailability'];
        knowledgeResolvedFor?: PageContext['knowledgeResolvedFor'];
      }>('/api/extension/context', {
        method: 'POST',
        body: JSON.stringify({ context: sanitizedContext }),
      });

      if (contextUpdateSeq.get(tabId) !== nextSeq) return;

      const mergedContext: PageContext = {
        ...sanitizedContext,
        app: enrichment.app ?? sanitizedContext.app,
        screen: enrichment.screen ?? sanitizedContext.screen,
        appSignature: `${enrichment.app ?? sanitizedContext.app}:${
          enrichment.screen ?? sanitizedContext.screen
        }`,
        vendorKnowledgeMatch:
          enrichment.vendorKnowledgeMatch ??
          sanitizedContext.vendorKnowledgeMatch ??
          null,
        orgKnowledgeMatch:
          enrichment.orgKnowledgeMatch ??
          sanitizedContext.orgKnowledgeMatch ??
          null,
        knowledgeAvailability:
          enrichment.knowledgeAvailability ??
          sanitizedContext.knowledgeAvailability,
        relevantWikiPages:
          enrichment.relevantWikiPages ?? sanitizedContext.relevantWikiPages,
        knowledgeResolvedFor:
          enrichment.knowledgeResolvedFor ??
          sanitizedContext.knowledgeResolvedFor,
      };

      latestContexts.set(tabId, mergedContext);
      console.log(
        `${BG} Context check app=${mergedContext.app} screen=${mergedContext.screen} mode=${
          mergedContext.knowledgeAvailability?.mode ?? 'unknown'
        } vendor=${mergedContext.vendorKnowledgeMatch?.basis ?? 'none'} org=${
          mergedContext.orgKnowledgeMatch?.basis ?? 'none'
        } latencyMs=${Date.now() - startedAt}`,
      );

      if (activeDebugSession && activeDebugSession.tabId === tabId) {
        queueDebugSessionEvent({
          eventType: 'page_context_checked',
          turnId: null,
          tabId,
          windowId: activeDebugSession.windowId,
          conversationId: activeDebugSession.conversationId,
          ...buildPageContextDebugFields(mergedContext),
        });
      }
      if (activeTelemetrySession && activeTelemetrySession.tabId === tabId) {
        queueProductTelemetryEvent({
          eventType: 'context_lookup',
          turnId: activeTelemetrySession.currentTurnId,
          latencyMs: Date.now() - startedAt,
          outcome: 'ok',
          sourceCount: enrichment.relevantWikiPages?.length ?? 0,
          ...buildPageContextTelemetryFields(mergedContext),
        });
      }

      chrome.tabs.sendMessage(
        tabId,
        { type: 'PAGE_CONTEXT_ENRICHED', context: mergedContext },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              `${BG} Context enrichment delivery failed tab=${tabId} epoch=${activeTargetBindingEpoch}:`,
              chrome.runtime.lastError.message,
            );
          }
        },
      );

      if (activeTargetTabId === tabId) {
        void sendLiveContextUpdate(tabId, mergedContext);
      }
    } catch (err) {
      // If enrichment fails, keep the local DOM context and let the agent
      // answer from the page alone.
      console.warn(`${BG} Context enrichment failed:`, (err as Error).message);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message?.type) {
      case 'PAGE_CONTEXT_UPDATED': {
        const tabId = sender.tab?.id;
        if (tabId !== undefined && message.context) {
          void (async () => {
            const [extensionEnabled, sessionActive] = await Promise.all([
              getExtensionEnabled(),
              hasActiveVoiceSession(),
            ]);
            const canCollect = shouldCollectPageContext({
              extensionEnabled,
              sessionActive,
              isHomeTab: tabId === activeTargetTabId,
            });

            if (!canCollect) {
              clearTabInstanceState(tabId);
              await sendPageContextCollectionState(tabId, false);
              return;
            }

            try {
              const tab = await chrome.tabs.get(tabId);
              if (!isSupportedPageTargetUrl(tab.url)) {
                clearTabInstanceState(tabId);
                await sendPageContextCollectionState(tabId, false);
                return;
              }
            } catch {
              clearTabInstanceState(tabId);
              return;
            }

            updateContentInstanceFromMessage({
              tabId,
              contentInstanceId: message.contentInstanceId,
              pageInstanceId: message.pageInstanceId,
            });
            targetLoadingTabs.delete(tabId);
            const previous = latestContexts.get(tabId);
            const rawContext = sanitizePageContextForNetwork(
              message.context as PageContext,
            );
            if (pageContextKnowledgeIdentityChanged(previous, rawContext)) {
              liveContextHashes.delete(tabId);
            }
            const context = mergePageContextWithPrevious(previous, rawContext);
            latestContexts.set(tabId, context);

            const fingerprint = buildContextSemanticFingerprint(context);
            if (contextFingerprints.get(tabId) === fingerprint) {
              return;
            }
            contextFingerprints.set(tabId, fingerprint);
            void enrichPageContext(tabId, context);
            void sendLiveContextUpdate(tabId, context);
          })();
        }
        return false;
      }

      case 'GET_PAGE_CONTEXT': {
        const tabId = sender.tab?.id;
        const ctx = tabId !== undefined ? latestContexts.get(tabId) : null;
        sendResponse({
          type: 'PAGE_CONTEXT_RESPONSE',
          payload: ctx ?? null,
          bindingEpoch: activeTargetBindingEpoch,
          pageInstanceId:
            tabId !== undefined ? (pageInstanceIds.get(tabId) ?? null) : null,
          contentInstanceId:
            tabId !== undefined
              ? (contentInstanceIds.get(tabId) ?? null)
              : null,
        });
        return false;
      }

      case 'AUTH_CALLBACK':
        void (async () => {
          try {
            await validateAndPersistExtensionAuthCallback({
              state: message.state,
              session: message.session,
              callbackUrl: message.callbackUrl ?? sender.url ?? sender.tab?.url,
            });
            sendResponse({ ok: true });
          } catch (error) {
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Auth callback rejected',
            });
          }
        })();
        return true;

      case 'AUTH_STATE_REQUEST':
        void (async () => {
          const session = await getStoredSession();
          sendResponse(session);
        })();
        return true;

      case 'MIC_PERMISSION_RESULT':
        void handleMicPermissionResult({
          ok: message.ok === true,
          resumeTabId:
            typeof message.resumeTabId === 'number'
              ? message.resumeTabId
              : undefined,
          error: typeof message.error === 'string' ? message.error : undefined,
          permissionTabId: sender.tab?.id,
        })
          .then(() => sendResponse({ ok: true }))
          .catch((err) =>
            sendResponse({ ok: false, error: (err as Error).message }),
          );
        return true;

      default:
        return false;
    }
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void (async () => {
      const rebound = await maybeRegisterVoiceTarget(tabId, 'tab_activated');
      if (!rebound && activeTargetTabId !== null) {
        await clearActiveVoiceTarget(
          activeTargetTabId,
          'tab_activated_unsupported',
        );
      }
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
      targetLoadingTabs.set(tabId, Date.now());
      if (voiceSessionActive && activeTargetTabId === tabId) {
        resetTargetFreshness(
          tabId,
          changeInfo.url ? 'target_url_changed' : 'target_loading',
        );
        latestContexts.delete(tabId);
        pageInstanceIds.delete(tabId);
      }
    }

    if (changeInfo.status === 'complete') {
      targetLoadingTabs.delete(tabId);
    }

    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    if (!voiceSessionActive || activeTargetTabId !== tabId) return;
    if (!isSupportedPageTargetUrl(tab.url)) {
      void clearActiveVoiceTarget(tabId, 'navigation_unsupported');
    }
  });

  // ── Target cleanup. Closing the target pauses tools; it does not end voice. ─
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabInstanceState(tabId);
    if (activeTargetTabId === tabId) {
      turnGuards.clear();
    }

    if (pendingMicPermissionPageTabId === tabId) {
      const resumeTabId = pendingSessionStartTabId;
      clearPendingMicPermissionFlow();
      if (resumeTabId !== null) {
        queueDebugSessionEvent({
          eventType: 'mic_permission_denied',
          turnId: null,
          tabId: resumeTabId,
          windowId: activeDebugSession?.windowId ?? null,
          error:
            'Microphone permission flow was closed before Tribora could start.',
          ...getDebugContextFields(resumeTabId),
        });
        finalizeDebugSession({
          eventType: 'session_error',
          turnId: null,
          tabId: resumeTabId,
          windowId: activeDebugSession?.windowId ?? null,
          error:
            'Microphone permission flow was closed before Tribora could start.',
          ...getDebugContextFields(resumeTabId),
        });
        emitSessionErrorToTab(
          resumeTabId,
          'Microphone permission flow was closed before Tribora could start.',
        );
      }
    }

    void clearActiveVoiceTarget(tabId, 'tab_closed');
  });
});
