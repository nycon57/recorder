/**
 * offscreen/main.ts — Persistent audio + agent runtime for the Tribora extension.
 *
 * Owns the active voice runtime so the session survives page navigations in
 * the content script's tab.
 *
 * Message protocol with the background service worker:
 *
 *   Inbox  (target === "offscreen"):
 *     START_SESSION  { session, tabId }
 *     END_SESSION    {}
 *     TOOL_RESULT    { callId, result }
 *     QUERY_STATE    {}
 *
 *   Outbox (target === "background"):
 *     SESSION_EVENT  { kind: "connected" | "disconnected" | "error"
 *                          | "mode_change" | "message" | "status"
 *                    , payload }
 *     TOOL_CALL      { callId, name, args }
 */

/* global chrome, RTCPeerConnection, RTCDataChannel, MediaStream, HTMLAudioElement */

import { Conversation } from '@elevenlabs/client';
import type { VoiceConversation } from '@elevenlabs/client';
import type {
  ElevenLabsVoiceSessionPayload,
  ExtensionVoiceSessionPayload,
  OpenAIRealtimeToolCall,
  OpenAIRealtimeVoiceSessionPayload,
} from '@tribora/shared';
import {
  buildOpenAIRealtimeContextUpdateEvent,
  buildOpenAIRealtimeFunctionOutputEvent,
  buildOpenAIRealtimeSessionConfig,
  buildTriboraVoiceAgentInstructions,
  extractOpenAIRealtimeToolCalls,
} from '@tribora/shared';

import { getElevenLabsWorkletPaths } from '../../utils/elevenlabs-worklets.js';
import {
  primeConversationAudio,
  startConversationAudioPrimingWindow,
} from '../../utils/conversation-audio.js';

type PendingToolCall = {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
};

type ActiveOpenAIRealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  localStream: MediaStream;
  audioElement: HTMLAudioElement;
  session: OpenAIRealtimeVoiceSessionPayload;
  sessionId: string | null;
};

const LOG = '[Tribora offscreen]';
const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const OPENAI_DATA_CHANNEL_LABEL = 'oai-events';
const OPENAI_DATA_CHANNEL_TIMEOUT_MS = 10000;

let activeElevenLabsConversation: VoiceConversation | null = null;
let activeOpenAIConnection: ActiveOpenAIRealtimeConnection | null = null;
let activeTabId: number | null = null;
let startingPromise: Promise<void> | null = null;
let stopAudioPriming: (() => void) | null = null;
const pendingToolCalls = new Map<string, PendingToolCall>();
const handledOpenAIToolCallIds = new Set<string>();
let toolCallSeq = 0;

function nextCallId(): string {
  toolCallSeq += 1;
  return `tc_${Date.now()}_${toolCallSeq}`;
}

function send(kind: string, payload: unknown = {}): void {
  chrome.runtime.sendMessage({ target: 'background', kind, payload }, () => {
    // Swallow "Receiving end does not exist"; background may be dormant briefly.
    void chrome.runtime.lastError;
  });
}

function emit(kind: string, payload: unknown = {}): void {
  send('SESSION_EVENT', { kind, payload });
}

function hasActiveSession(): boolean {
  return Boolean(activeElevenLabsConversation || activeOpenAIConnection);
}

/** Ask the content script (via background) to execute a tool and wait for the result. */
function callTool(name: string, args: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const callId = nextCallId();
    pendingToolCalls.set(callId, { resolve, reject });

    // Knowledge answers make a backend model call, so give them a little more room.
    const timeoutMs = name === 'answer_with_knowledge' ? 30000 : 15000;
    setTimeout(() => {
      if (pendingToolCalls.delete(callId)) {
        reject(new Error(`Tool "${name}" timed out`));
      }
    }, timeoutMs);

    send('TOOL_CALL', { callId, name, args });
  });
}

function isExtensionVoiceSessionPayload(
  value: unknown,
): value is ExtensionVoiceSessionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.runtime === 'elevenlabs') {
    return typeof payload.signedUrl === 'string' && payload.signedUrl.length > 0;
  }
  if (payload.runtime === 'openai-realtime') {
    return (
      typeof payload.clientSecret === 'string' &&
      payload.clientSecret.length > 0 &&
      typeof payload.model === 'string' &&
      typeof payload.voice === 'string' &&
      typeof payload.reasoningEffort === 'string'
    );
  }
  return false;
}

function parseStartSessionPayload(payload: unknown): {
  session: ExtensionVoiceSessionPayload;
  tabId: number;
} {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid START_SESSION payload');
  }

  const record = payload as Record<string, unknown>;
  const tabId = typeof record.tabId === 'number' ? record.tabId : null;
  if (tabId === null) throw new Error('START_SESSION missing tabId');

  if (isExtensionVoiceSessionPayload(record.session)) {
    return { session: record.session, tabId };
  }

  // Backward compatibility for older background workers during hot reload.
  if (typeof record.signedUrl === 'string' && record.signedUrl.length > 0) {
    return {
      session: { runtime: 'elevenlabs', signedUrl: record.signedUrl },
      tabId,
    };
  }

  throw new Error('START_SESSION missing voice session');
}

async function startSession(
  session: ExtensionVoiceSessionPayload,
  tabId: number,
): Promise<void> {
  if (hasActiveSession()) {
    console.log(`${LOG} Session already active — ignoring duplicate start`);
    return;
  }
  if (startingPromise) {
    console.log(`${LOG} Session already starting — awaiting existing start`);
    await startingPromise;
    return;
  }

  const startedAtMs = Date.now();
  const doStart = async () => {
    console.log(`${LOG} Starting ${session.runtime} session for tab ${tabId}`);
    activeTabId = tabId;

    if (session.runtime === 'openai-realtime') {
      await startOpenAIRealtimeSession(session, tabId, startedAtMs);
      return;
    }

    await startElevenLabsSession(session, tabId, startedAtMs);
  };

  startingPromise = doStart()
    .catch((err) => {
      console.error(`${LOG} startSession failed:`, err);
      emit('error', {
        error: (err as Error).message,
        voiceRuntime: session.runtime,
      });
      cleanup();
      throw err;
    })
    .finally(() => {
      startingPromise = null;
    });

  await startingPromise;
}

async function startElevenLabsSession(
  session: ElevenLabsVoiceSessionPayload,
  _tabId: number,
  startedAtMs: number,
): Promise<void> {
  const conversation = (await Conversation.startSession({
    signedUrl: session.signedUrl,
    workletPaths: getElevenLabsWorkletPaths((path) =>
      chrome.runtime.getURL(path),
    ),
    clientTools: {
      get_page_context: () => callTool('get_page_context', {}),
      answer_with_knowledge: (args: { question: string }) =>
        callTool('answer_with_knowledge', args),
      search_page_elements: (args: { query: string; limit?: number }) =>
        callTool('search_page_elements', args),
      inspect_element: (args: { selector: string }) =>
        callTool('inspect_element', args),
      inspect_page_region: (args: { selector?: string; regionId?: string }) =>
        callTool('inspect_page_region', args),
      capture_screenshot: () => callTool('capture_screenshot', {}),
      highlight_element: (args: {
        selector: string;
        label?: string;
        action?: string;
      }) => callTool('highlight_element', args),
      highlight_elements: (args: {
        targets: Array<{
          selector: string;
          label?: string;
          action?: 'point' | 'highlight' | 'pulse';
        }>;
      }) => callTool('highlight_elements', args),
      hover_element: (args: { selector: string }) =>
        callTool('hover_element', args),
      click_element: (args: { selector: string }) =>
        callTool('click_element', args),
      type_in_element: (args: {
        selector: string;
        text: string;
        clear?: boolean;
      }) => callTool('type_in_element', args),
      scroll_to_element: (args: { selector: string }) =>
        callTool('scroll_to_element', args),
      press_key: (args: {
        key: string;
        selector?: string;
        modifiers?: string[];
        repeat?: number;
      }) => callTool('press_key', args),
    },
    onConnect: ({ conversationId }) => {
      console.log(`${LOG} ElevenLabs connected`);
      emit('connected', {
        conversationId,
        voiceRuntime: 'elevenlabs',
        startupLatencyMs: Date.now() - startedAtMs,
      });
    },
    onDisconnect: (details) => {
      console.log(`${LOG} ElevenLabs disconnected`);
      emit('disconnected', {
        reason: details?.reason ?? 'unknown',
        message: details?.message ?? null,
        voiceRuntime: 'elevenlabs',
      });
      cleanup();
    },
    onError: (error: string) => {
      console.error(`${LOG} ElevenLabs error:`, error);
      emit('error', { error, voiceRuntime: 'elevenlabs' });
    },
    onMessage: (message: unknown) => {
      emit('message', { message, voiceRuntime: 'elevenlabs' });
    },
    onModeChange: (mode: { mode: 'listening' | 'speaking' }) => {
      if (mode.mode === 'speaking') {
        void primeConversationAudio(activeElevenLabsConversation, document);
      }
      emit('mode_change', { mode: mode.mode, voiceRuntime: 'elevenlabs' });
    },
    onStatusChange: (status: { status: string }) => {
      emit('status', { status: status.status, voiceRuntime: 'elevenlabs' });
    },
  })) as VoiceConversation;

  activeElevenLabsConversation = conversation;
  try {
    conversation.sendContextualUpdate(buildTriboraVoiceAgentInstructions());
  } catch (err) {
    console.warn(
      `${LOG} Identity instructions failed:`,
      (err as Error).message,
    );
  }
  stopAudioPriming?.();
  stopAudioPriming = startConversationAudioPrimingWindow({
    getConversation: () => activeElevenLabsConversation,
    documentRoot: document,
  });

  console.log(`${LOG} ElevenLabs session started:`, conversation.getId());
}

async function startOpenAIRealtimeSession(
  session: OpenAIRealtimeVoiceSessionPayload,
  _tabId: number,
  startedAtMs: number,
): Promise<void> {
  const peerConnection = new RTCPeerConnection();
  const dataChannel = peerConnection.createDataChannel(
    OPENAI_DATA_CHANNEL_LABEL,
  );
  const audioElement = document.createElement('audio');
  audioElement.autoplay = true;
  document.body.appendChild(audioElement);

  peerConnection.ontrack = (event) => {
    audioElement.srcObject = event.streams[0] ?? null;
  };

  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  for (const track of localStream.getAudioTracks()) {
    peerConnection.addTrack(track, localStream);
  }

  const connection: ActiveOpenAIRealtimeConnection = {
    peerConnection,
    dataChannel,
    localStream,
    audioElement,
    session,
    sessionId: null,
  };
  activeOpenAIConnection = connection;
  attachOpenAIRealtimeListeners(connection);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  if (!offer.sdp) throw new Error('OpenAI Realtime offer SDP is empty');

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${session.clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `OpenAI Realtime call failed (${response.status}): ${errorText}`,
    );
  }

  await peerConnection.setRemoteDescription({
    type: 'answer',
    sdp: await response.text(),
  });

  await waitForDataChannelOpen(dataChannel);
  sendOpenAIRealtimeEvent(
    buildOpenAIRealtimeSessionUpdate(session),
    connection,
  );
  emit('connected', {
    conversationId: connection.sessionId,
    voiceRuntime: 'openai-realtime',
    model: session.model,
    reasoningEffort: session.reasoningEffort,
    startupLatencyMs: Date.now() - startedAtMs,
  });
  console.log(`${LOG} OpenAI Realtime session started: ${session.model}`);
}

function buildOpenAIRealtimeSessionUpdate(
  session: OpenAIRealtimeVoiceSessionPayload,
): Record<string, unknown> {
  return {
    type: 'session.update',
    session: buildOpenAIRealtimeSessionConfig({
      model: session.model,
      voice: session.voice,
      reasoningEffort: session.reasoningEffort,
    }),
  };
}

function attachOpenAIRealtimeListeners(
  connection: ActiveOpenAIRealtimeConnection,
): void {
  connection.dataChannel.addEventListener('message', (event) => {
    const realtimeEvent = parseOpenAIRealtimeEvent(event.data);
    if (!realtimeEvent) return;
    handleOpenAIRealtimeEvent(realtimeEvent, connection);
  });

  connection.dataChannel.addEventListener('error', () => {
    emit('error', {
      error: 'OpenAI Realtime data channel error',
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
  });

  connection.peerConnection.addEventListener('connectionstatechange', () => {
    if (activeOpenAIConnection !== connection) return;
    const state = connection.peerConnection.connectionState;
    emit('status', {
      status: state,
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });

    if (
      state === 'failed' ||
      state === 'disconnected' ||
      state === 'closed'
    ) {
      emit('disconnected', {
        reason: state,
        voiceRuntime: 'openai-realtime',
        model: connection.session.model,
        reasoningEffort: connection.session.reasoningEffort,
      });
      cleanup();
    }
  });
}

function parseOpenAIRealtimeEvent(value: unknown): Record<string, unknown> | null {
  const raw =
    typeof value === 'string'
      ? value
      : typeof (value as { data?: unknown })?.data === 'string'
        ? ((value as { data: string }).data ?? '')
        : null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function handleOpenAIRealtimeEvent(
  event: Record<string, unknown>,
  connection: ActiveOpenAIRealtimeConnection,
): void {
  const eventType = typeof event.type === 'string' ? event.type : 'unknown';
  const session = event.session as Record<string, unknown> | undefined;
  if (typeof session?.id === 'string') {
    connection.sessionId = session.id;
  }

  if (eventType === 'input_audio_buffer.speech_started') {
    emit('mode_change', {
      mode: 'listening',
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
  }

  if (
    eventType === 'response.created' ||
    eventType === 'response.output_item.added'
  ) {
    emit('mode_change', {
      mode: 'speaking',
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
  }

  emitOpenAIMessageEvent(event, connection);

  const calls = extractOpenAIRealtimeToolCalls(event);
  for (const call of calls) {
    void handleOpenAIRealtimeToolCall(call, connection);
  }

  if (eventType === 'response.done') {
    emit('mode_change', {
      mode: 'listening',
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
    const response = event.response as Record<string, unknown> | undefined;
    emit('status', {
      status: 'response_done',
      usage:
        typeof response?.usage === 'object' && response.usage !== null
          ? (response.usage as Record<string, unknown>)
          : null,
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
  }

  if (eventType === 'error') {
    const error = event.error as Record<string, unknown> | undefined;
    emit('error', {
      error:
        typeof error?.message === 'string'
          ? error.message
          : 'OpenAI Realtime error',
      voiceRuntime: 'openai-realtime',
      model: connection.session.model,
      reasoningEffort: connection.session.reasoningEffort,
    });
  }
}

function emitOpenAIMessageEvent(
  event: Record<string, unknown>,
  connection: ActiveOpenAIRealtimeConnection,
): void {
  const eventType = typeof event.type === 'string' ? event.type : '';
  if (eventType === 'conversation.item.input_audio_transcription.completed') {
    const transcript =
      typeof event.transcript === 'string' ? event.transcript.trim() : '';
    if (transcript) {
      emit('message', {
        message: { source: 'user', message: transcript },
        voiceRuntime: 'openai-realtime',
        model: connection.session.model,
        reasoningEffort: connection.session.reasoningEffort,
      });
    }
    return;
  }

  if (eventType === 'response.audio_transcript.done') {
    const transcript =
      typeof event.transcript === 'string' ? event.transcript.trim() : '';
    if (transcript) {
      emit('message', {
        message: { source: 'assistant', message: transcript },
        voiceRuntime: 'openai-realtime',
        model: connection.session.model,
        reasoningEffort: connection.session.reasoningEffort,
      });
    }
    return;
  }

  if (eventType === 'response.output_item.done') {
    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type !== 'message') return;
    const text = extractOpenAIMessageText(item);
    if (text) {
      emit('message', {
        message: { source: 'assistant', message: text },
        voiceRuntime: 'openai-realtime',
        model: connection.session.model,
        reasoningEffort: connection.session.reasoningEffort,
      });
    }
  }
}

function extractOpenAIMessageText(item: Record<string, unknown>): string {
  const content = Array.isArray(item.content) ? item.content : [];
  return content
    .map((part) => {
      if (typeof part !== 'object' || part === null) return '';
      const payload = part as Record<string, unknown>;
      return typeof payload.text === 'string'
        ? payload.text
        : typeof payload.transcript === 'string'
          ? payload.transcript
          : '';
    })
    .join(' ')
    .trim();
}

async function handleOpenAIRealtimeToolCall(
  call: OpenAIRealtimeToolCall,
  connection: ActiveOpenAIRealtimeConnection,
): Promise<void> {
  if (handledOpenAIToolCallIds.has(call.callId)) return;
  handledOpenAIToolCallIds.add(call.callId);

  try {
    const result = await callTool(call.name, call.args);
    sendOpenAIRealtimeEvent(
      buildOpenAIRealtimeFunctionOutputEvent(call.callId, { result }),
      connection,
    );
  } catch (err) {
    sendOpenAIRealtimeEvent(
      buildOpenAIRealtimeFunctionOutputEvent(call.callId, {
        error: (err as Error).message,
      }),
      connection,
    );
  }

  sendOpenAIRealtimeEvent({ type: 'response.create' }, connection);
}

function sendOpenAIRealtimeEvent(
  event: Record<string, unknown>,
  connection = activeOpenAIConnection,
): void {
  if (!connection || connection.dataChannel.readyState !== 'open') return;
  connection.dataChannel.send(JSON.stringify(event));
}

function waitForDataChannelOpen(dataChannel: RTCDataChannel): Promise<void> {
  if (dataChannel.readyState === 'open') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanupListeners();
      reject(new Error('OpenAI Realtime data channel did not open'));
    }, OPENAI_DATA_CHANNEL_TIMEOUT_MS);

    const onOpen = () => {
      cleanupListeners();
      resolve();
    };
    const onError = () => {
      cleanupListeners();
      reject(new Error('OpenAI Realtime data channel failed to open'));
    };
    const cleanupListeners = () => {
      window.clearTimeout(timeout);
      dataChannel.removeEventListener('open', onOpen);
      dataChannel.removeEventListener('error', onError);
    };

    dataChannel.addEventListener('open', onOpen);
    dataChannel.addEventListener('error', onError);
  });
}

async function endSession(): Promise<void> {
  if (!hasActiveSession()) return;
  console.log(`${LOG} Ending session`);
  try {
    if (activeElevenLabsConversation) {
      await activeElevenLabsConversation.endSession();
    }
    if (activeOpenAIConnection) {
      emit('disconnected', {
        reason: 'client_end',
        voiceRuntime: 'openai-realtime',
        model: activeOpenAIConnection.session.model,
        reasoningEffort: activeOpenAIConnection.session.reasoningEffort,
      });
    }
  } catch (err) {
    console.warn(`${LOG} endSession error:`, (err as Error).message);
  }
  cleanup();
}

function cleanup(): void {
  stopAudioPriming?.();
  stopAudioPriming = null;
  activeElevenLabsConversation = null;

  const openAIConnection = activeOpenAIConnection;
  activeOpenAIConnection = null;
  if (openAIConnection) {
    openAIConnection.dataChannel.close();
    openAIConnection.peerConnection.close();
    for (const track of openAIConnection.localStream.getTracks()) {
      track.stop();
    }
    openAIConnection.audioElement.remove();
  }

  activeTabId = null;
  for (const [callId, pending] of pendingToolCalls) {
    pending.reject(new Error('Session ended'));
    pendingToolCalls.delete(callId);
  }
  handledOpenAIToolCallIds.clear();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;

  switch (message.kind) {
    case 'START_SESSION': {
      const { session, tabId } = parseStartSessionPayload(message.payload);
      void startSession(session, tabId)
        .then(() => sendResponse({ ok: true }))
        .catch((err) =>
          sendResponse({ ok: false, error: (err as Error).message }),
        );
      return true;
    }

    case 'END_SESSION':
      void endSession().then(() => sendResponse({ ok: true }));
      return true;

    case 'TOOL_RESULT': {
      const { callId, result, error } = message.payload as {
        callId: string;
        result?: string;
        error?: string;
      };
      const pending = pendingToolCalls.get(callId);
      if (pending) {
        pendingToolCalls.delete(callId);
        if (error) pending.reject(new Error(error));
        else pending.resolve(result ?? '');
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'QUERY_STATE':
      sendResponse({
        active: hasActiveSession() || !!startingPromise,
        tabId: activeTabId,
      });
      return false;

    case 'CONTEXTUAL_UPDATE': {
      const { text } = message.payload as { text?: string };
      if (!hasActiveSession()) {
        sendResponse({ ok: false, error: 'No active conversation' });
        return false;
      }
      if (!text || typeof text !== 'string') {
        sendResponse({ ok: false, error: 'No contextual update text' });
        return false;
      }
      try {
        if (activeOpenAIConnection) {
          sendOpenAIRealtimeEvent(
            buildOpenAIRealtimeContextUpdateEvent(text),
            activeOpenAIConnection,
          );
        } else {
          activeElevenLabsConversation?.sendContextualUpdate(text);
        }
        emit('contextual_update', {
          hash:
            typeof (message.payload as { hash?: unknown }).hash === 'string'
              ? (message.payload as { hash: string }).hash
              : null,
          knowledgeMode:
            typeof (message.payload as { knowledgeMode?: unknown })
              .knowledgeMode === 'string'
              ? ((message.payload as { knowledgeMode: string }).knowledgeMode ??
                null)
              : null,
          sourceCount:
            typeof (message.payload as { sourceCount?: unknown })
              .sourceCount === 'number'
              ? (message.payload as { sourceCount: number }).sourceCount
              : null,
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message });
      }
      return false;
    }

    default:
      return false;
  }
});

console.log(`${LOG} Offscreen document loaded`);
