/**
 * offscreen/main.ts — Persistent audio + agent runtime for the Tribora extension.
 *
 * Owns the ElevenLabs Conversation (WebSocket + mic capture + audio playback)
 * so the session survives page navigations in the content script's tab.
 *
 * Message protocol with the background service worker:
 *
 *   Inbox  (target === "offscreen"):
 *     START_SESSION  { signedUrl, tabId }
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

/* global chrome */

import { Conversation } from '@elevenlabs/client';
import type { VoiceConversation } from '@elevenlabs/client';

import { getElevenLabsWorkletPaths } from '../../utils/elevenlabs-worklets.js';
import {
  primeConversationAudio,
  startConversationAudioPrimingWindow,
} from '../../utils/conversation-audio.js';
import { buildTriboraVoiceAgentInstructions } from '../../utils/voice-agent-policy.js';

type PendingToolCall = {
  resolve: (value: string) => void;
  reject: (err: Error) => void;
};

const LOG = '[Tribora offscreen]';

let activeConversation: VoiceConversation | null = null;
let activeTabId: number | null = null;
let startingPromise: Promise<void> | null = null;
let stopAudioPriming: (() => void) | null = null;
const pendingToolCalls = new Map<string, PendingToolCall>();
let toolCallSeq = 0;

function nextCallId(): string {
  toolCallSeq += 1;
  return `tc_${Date.now()}_${toolCallSeq}`;
}

function send(kind: string, payload: unknown = {}): void {
  chrome.runtime.sendMessage({ target: 'background', kind, payload }, () => {
    // Swallow "Receiving end does not exist" — background may be dormant briefly
    void chrome.runtime.lastError;
  });
}

function emit(kind: string, payload: unknown = {}): void {
  send('SESSION_EVENT', { kind, payload });
}

/** Ask the content script (via background) to execute a tool and wait for the result. */
function callTool(name: string, args: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const callId = nextCallId();
    pendingToolCalls.set(callId, { resolve, reject });

    // 15s cap so a failing tool never strands the agent's turn
    setTimeout(() => {
      if (pendingToolCalls.delete(callId)) {
        reject(new Error(`Tool "${name}" timed out`));
      }
    }, 15000);

    send('TOOL_CALL', { callId, name, args });
  });
}

async function startSession(signedUrl: string, tabId: number): Promise<void> {
  if (activeConversation) {
    console.log(`${LOG} Session already active — ignoring duplicate start`);
    return;
  }
  if (startingPromise) {
    console.log(`${LOG} Session already starting — awaiting existing start`);
    await startingPromise;
    return;
  }

  const doStart = async () => {
    console.log(`${LOG} Starting session for tab ${tabId}`);
    activeTabId = tabId;

    const conversation = (await Conversation.startSession({
      signedUrl,
      workletPaths: getElevenLabsWorkletPaths((path) =>
        chrome.runtime.getURL(path),
      ),
      clientTools: {
        get_page_context: () => callTool('get_page_context', {}),
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
        console.log(`${LOG} Connected`);
        emit('connected', { conversationId });
      },
      onDisconnect: (details) => {
        console.log(`${LOG} Disconnected`);
        emit('disconnected', {
          reason: details?.reason ?? 'unknown',
          message: details?.message ?? null,
        });
        cleanup();
      },
      onError: (error: string) => {
        console.error(`${LOG} Error:`, error);
        emit('error', { error });
      },
      onMessage: (message: unknown) => {
        emit('message', { message });
      },
      onModeChange: (mode: { mode: 'listening' | 'speaking' }) => {
        if (mode.mode === 'speaking') {
          void primeConversationAudio(activeConversation, document);
        }
        emit('mode_change', { mode: mode.mode });
      },
      onStatusChange: (status: { status: string }) => {
        emit('status', { status: status.status });
      },
    })) as VoiceConversation;

    activeConversation = conversation;
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
      getConversation: () => activeConversation,
      documentRoot: document,
    });

    console.log(`${LOG} Session started:`, conversation.getId());
  };

  startingPromise = doStart()
    .catch((err) => {
      console.error(`${LOG} startSession failed:`, err);
      emit('error', { error: (err as Error).message });
      cleanup();
      throw err;
    })
    .finally(() => {
      startingPromise = null;
    });

  await startingPromise;
}

async function endSession(): Promise<void> {
  if (!activeConversation) return;
  console.log(`${LOG} Ending session`);
  try {
    await activeConversation.endSession();
  } catch (err) {
    console.warn(`${LOG} endSession error:`, (err as Error).message);
  }
  cleanup();
}

function cleanup(): void {
  stopAudioPriming?.();
  stopAudioPriming = null;
  activeConversation = null;
  activeTabId = null;
  for (const [callId, pending] of pendingToolCalls) {
    pending.reject(new Error('Session ended'));
    pendingToolCalls.delete(callId);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;

  switch (message.kind) {
    case 'START_SESSION':
      void startSession(
        message.payload.signedUrl as string,
        message.payload.tabId as number,
      )
        .then(() => sendResponse({ ok: true }))
        .catch((err) =>
          sendResponse({ ok: false, error: (err as Error).message }),
        );
      return true;

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
        active: !!activeConversation || !!startingPromise,
        tabId: activeTabId,
      });
      return false;

    case 'CONTEXTUAL_UPDATE': {
      const { text } = message.payload as { text?: string };
      if (!activeConversation) {
        sendResponse({ ok: false, error: 'No active conversation' });
        return false;
      }
      if (!text || typeof text !== 'string') {
        sendResponse({ ok: false, error: 'No contextual update text' });
        return false;
      }
      try {
        activeConversation.sendContextualUpdate(text);
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
