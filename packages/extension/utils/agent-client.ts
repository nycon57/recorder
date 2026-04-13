/**
 * agent-client.ts — ElevenLabs Conversational Agent client for the Tribora extension.
 *
 * Wraps @elevenlabs/client's Conversation.startSession() with:
 * - Signed URL auth (fetched from our backend)
 * - Client tools: get_page_context, capture_screenshot, highlight_element
 * - Session lifecycle management
 *
 * Replaces the old STT → Query → TTS pipeline with a single WebSocket
 * connection that handles real-time voice conversation.
 */

import { Conversation } from "@elevenlabs/client";
import type { VoiceConversation } from "@elevenlabs/client";
import type { PageContext } from "@tribora/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentSessionCallbacks {
  /** Called when the agent's mode changes (listening ↔ speaking) */
  onModeChange?: (mode: { mode: "listening" | "speaking" }) => void;
  /** Called when the WebSocket connects */
  onConnect?: () => void;
  /** Called when the session disconnects */
  onDisconnect?: () => void;
  /** Called on any error */
  onError?: (error: string) => void;
  /** Called with every message (transcriptions, agent text, etc.) */
  onMessage?: (message: unknown) => void;
  /** Called with status changes (connecting, connected, disconnected) */
  onStatusChange?: (status: string) => void;
}

export interface AgentSessionDeps {
  /** Returns the current page context for the get_page_context tool */
  getPageContext: () => PageContext;
  /** Returns the DOM overlay instance for highlight_element tool */
  highlightElement: (selector: string, label: string, action: string) => string;
  /** Captures a screenshot (delegates to background via chrome.runtime.sendMessage) */
  captureScreenshot: () => Promise<string>;
  /** Clicks a DOM element by CSS selector */
  clickElement: (selector: string) => string;
  /** Types text into an input/textarea by CSS selector */
  typeInElement: (selector: string, text: string, clear?: boolean) => string;
  /** Smoothly scrolls an element into view */
  scrollToElement: (selector: string) => string;
}

export interface AgentSession {
  /** The underlying VoiceConversation instance */
  conversation: VoiceConversation;
  /** End the session gracefully */
  endSession: () => Promise<void>;
  /** Get input (mic) frequency data for waveform visualization */
  getInputFrequencyData: () => Uint8Array;
  /** Get output (TTS) frequency data for waveform visualization */
  getOutputFrequencyData: () => Uint8Array;
}

// ─── Signed URL ──────────────────────────────────────────────────────────────

async function getSignedUrl(): Promise<string> {
  // Content scripts can't make authenticated cross-origin requests directly
  // (no chrome.cookies access, Cookie is a forbidden header, CORS * can't
  // carry credentials). Delegate to the background service worker, which
  // has chrome.cookies and isn't subject to page-origin CORS.
  const response = (await chrome.runtime.sendMessage({
    type: "GET_AGENT_SIGNED_URL",
  })) as
    | { ok: true; signedUrl: string; conversationId?: string }
    | { ok: false; error: string; status?: number };

  if (!response?.ok) {
    const status = "status" in response && response.status ? ` (${response.status})` : "";
    throw new Error(`Failed to get signed URL${status}: ${response?.error ?? "no response"}`);
  }

  return response.signedUrl;
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * Start a new ElevenLabs Conversational Agent session.
 *
 * The session handles mic capture, STT, LLM reasoning, and TTS playback
 * over a single WebSocket connection. Client tools allow the agent to
 * query the page context, capture screenshots, and highlight DOM elements.
 */
export async function startAgentSession(
  deps: AgentSessionDeps,
  callbacks: AgentSessionCallbacks = {},
): Promise<AgentSession> {
  const signedUrl = await getSignedUrl();

  console.log("[Tribora agent] Starting session...");

  // Snapshot audio elements before startSession so we can find the SDK's
  // hidden playback element afterward and explicitly call .play() on it.
  // Some pages silently block MediaStream autoplay even after user gesture,
  // which drops the agent's first turn audio. An explicit play() is a safe
  // idempotent fix — no-op if already playing, cure if stuck.
  const existingAudioEls = new Set(Array.from(document.querySelectorAll("audio")));

  const conversation = (await Conversation.startSession({
    signedUrl,
    clientTools: {
      get_page_context: async () => {
        const ctx = deps.getPageContext();
        console.log("[Tribora agent] Tool: get_page_context →", ctx.url);
        return JSON.stringify({
          url: ctx.url,
          app: ctx.app,
          screen: ctx.screen,
          title: ctx.title,
          interactiveElements: ctx.interactiveElements?.slice(0, 50),
        });
      },

      capture_screenshot: async () => {
        console.log("[Tribora agent] Tool: capture_screenshot");
        try {
          const base64 = await deps.captureScreenshot();
          return base64;
        } catch (err) {
          console.error("[Tribora agent] Screenshot failed:", err);
          return "Screenshot capture failed";
        }
      },

      highlight_element: async (params: {
        selector: string;
        label?: string;
        action?: string;
      }) => {
        console.log("[Tribora agent] Tool: highlight_element →", params.selector);
        return deps.highlightElement(
          params.selector,
          params.label ?? "",
          params.action ?? "point",
        );
      },

      click_element: async (params: { selector: string }) => {
        console.log("[Tribora agent] Tool: click_element →", params.selector);
        return deps.clickElement(params.selector);
      },

      type_in_element: async (params: {
        selector: string;
        text: string;
        clear?: boolean;
      }) => {
        console.log("[Tribora agent] Tool: type_in_element →", params.selector, `(${params.text.length} chars)`);
        return deps.typeInElement(params.selector, params.text, params.clear);
      },

      scroll_to_element: async (params: { selector: string }) => {
        console.log("[Tribora agent] Tool: scroll_to_element →", params.selector);
        return deps.scrollToElement(params.selector);
      },
    },

    onConnect: () => {
      console.log("[Tribora agent] Connected");
      callbacks.onConnect?.();
    },

    onDisconnect: () => {
      console.log("[Tribora agent] Disconnected");
      callbacks.onDisconnect?.();
    },

    onError: (error: string) => {
      console.error("[Tribora agent] Error:", error);
      callbacks.onError?.(error);
    },

    onMessage: (message: unknown) => {
      callbacks.onMessage?.(message);
    },

    onModeChange: (mode: { mode: "listening" | "speaking" }) => {
      console.log("[Tribora agent] Mode:", mode.mode);
      callbacks.onModeChange?.(mode);
    },

    onStatusChange: (status: { status: string }) => {
      callbacks.onStatusChange?.(status.status);
    },
  })) as VoiceConversation;

  console.log("[Tribora agent] Session started:", conversation.getId());

  // Force-start any newly-injected hidden audio element so the first agent
  // turn isn't dropped by strict autoplay policies.
  try {
    const newAudioEls = Array.from(document.querySelectorAll("audio")).filter(
      (el) => !existingAudioEls.has(el),
    );
    for (const el of newAudioEls) {
      const result = el.play();
      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          console.warn("[Tribora agent] audio.play() rejected:", err?.message ?? err);
        });
      }
    }
    if (newAudioEls.length > 0) {
      console.log(`[Tribora agent] Primed ${newAudioEls.length} audio element(s)`);
    }
  } catch (err) {
    console.warn("[Tribora agent] Audio priming failed:", (err as Error).message);
  }

  return {
    conversation,

    async endSession() {
      console.log("[Tribora agent] Ending session");
      await conversation.endSession();
    },

    getInputFrequencyData() {
      return conversation.getInputByteFrequencyData();
    },

    getOutputFrequencyData() {
      return conversation.getOutputByteFrequencyData();
    },
  };
}
