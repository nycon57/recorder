import { scheduleTokenRefresh } from "../utils/token-refresh.js";
import { createTabRecorder } from "../utils/tab-recorder.js";
import { uploadRecording } from "../utils/recording-uploader.js";
import type { TabRecorder } from "../utils/tab-recorder.js";
import { getStoredSession } from "../utils/api-client.js";
import type { PageContext } from "@tribora/shared";

// TRIB-65: backend base URL for the /api/extension/query fusion endpoint.
// Matches the pattern used in utils/api-client.ts / utils/elevenlabs-client.ts.
const API_BASE_URL =
  (import.meta.env as Record<string, string>).VITE_TRIBORA_API_URL ||
  "http://localhost:3000";

/**
 * TRIB-65: SSE event shapes emitted by /api/extension/query.
 * Must stay in sync with src/app/api/extension/query/route.ts (`SseEvent`).
 */
interface SseTextChunkEvent {
  type: "text_chunk";
  text: string;
}
interface SseElementRefEvent {
  type: "element_ref";
  selector: string;
  label: string;
  action: "highlight" | "point" | "pulse";
}
interface SseCitationEvent {
  type: "citation";
  sourceId: string;
  title: string;
  recordingUrl?: string;
}
interface SseDoneEvent {
  type: "done";
}
type SseEvent =
  | SseTextChunkEvent
  | SseElementRefEvent
  | SseCitationEvent
  | SseDoneEvent;

/**
 * TRIB-65: Transform the extension's `PageContext` into the shape
 * /api/extension/query expects. The route reads `url`, `appSignature`
 * (single "app:screen" string) and `elements` (lean `{selector, label}`
 * tuples), whereas the extension stores `app`, `screen`, and the richer
 * `interactiveElements` with type/ariaLabel/boundingRect.
 */
function serializePageContext(ctx: PageContext): {
  url: string;
  appSignature: string;
  elements: Array<{ selector: string; label: string }>;
} {
  return {
    url: ctx.url,
    appSignature: `${ctx.app}:${ctx.screen}`,
    elements: (ctx.interactiveElements ?? []).map((el) => ({
      selector: el.selector,
      label: el.label,
    })),
  };
}

/**
 * TRIB-65: Parse a buffer of concatenated SSE frames into complete events.
 * SSE frames are delimited by `\n\n`. Each frame may contain a single
 * `data: <json>` line (the fusion route doesn't use named events or ids).
 * Returns the parsed events plus any trailing partial frame the caller
 * should keep for the next `reader.read()`.
 */
function parseSseBuffer(buffer: string): {
  events: SseEvent[];
  remainder: string;
} {
  const events: SseEvent[] = [];
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";

  for (const frame of frames) {
    const dataLine = frame
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) continue;
    try {
      events.push(JSON.parse(dataLine.slice(6)) as SseEvent);
    } catch {
      console.warn("[Tribora STT] Failed to parse SSE frame:", dataLine);
    }
  }

  return { events, remainder };
}

/**
 * TRIB-65: Handle a finalized STT transcript from the content script.
 *
 *   content/audio-capture → Deepgram → content/index.ts
 *     → chrome.runtime.sendMessage({type: "STT_FINAL", transcript, context})
 *     → background.ts (this function)
 *       → POST /api/extension/query (SSE)
 *         → dispatches OVERLAY_POINT/HIGHLIGHT/PULSE + TTS_SPEAK back to
 *           the same tab's content script
 *
 * All errors are logged and swallowed — the STT flow is best-effort and
 * should never crash the service worker.
 */
async function handleSttFinal(args: {
  transcript: string;
  context: PageContext | undefined;
  tabId: number;
}): Promise<void> {
  const { transcript, tabId } = args;
  let pageContext = args.context;

  try {
    // 1. Auth gate
    const session = await getStoredSession();
    if (!session || session.status !== "authenticated" || !session.token) {
      console.warn("[Tribora STT] Not authenticated — dropping transcript");
      return;
    }

    // 2. Page context — prefer the one riding along with STT_FINAL.
    //    Fall back to GET_PAGE_CONTEXT if somehow absent (e.g. the content
    //    script dispatched from an older build without context wiring).
    if (!pageContext) {
      try {
        const response = (await chrome.tabs.sendMessage(tabId, {
          type: "GET_PAGE_CONTEXT",
        })) as { payload?: PageContext } | undefined;
        pageContext = response?.payload ?? undefined;
      } catch {
        // Content script not loaded on this tab — give up gracefully.
      }
    }
    if (!pageContext) {
      console.warn("[Tribora STT] No page context for tab", tabId);
      return;
    }

    // 3. POST to /api/extension/query
    const body = JSON.stringify({
      question: transcript,
      context: serializePageContext(pageContext),
    });

    const response = await fetch(`${API_BASE_URL}/api/extension/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      credentials: "include",
      body,
    });

    if (!response.ok) {
      console.error(
        `[Tribora STT] /api/extension/query returned HTTP ${response.status} ${response.statusText}`,
      );
      return;
    }
    if (!response.body) {
      console.error("[Tribora STT] Query response has no body");
      return;
    }

    // 4. Parse the SSE stream. Text chunks are accumulated into a single
    //    answer string (played via TTS after the stream closes). Element
    //    refs are dispatched immediately to the content script so the user
    //    sees the overlay land before the audio starts.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedText = "";
    let dispatchedOverlay = false;
    const citations: Array<{ sourceId: string; title: string }> = [];

    const dispatchOverlay = (
      selector: string,
      label: string,
      action: "highlight" | "point" | "pulse",
    ) => {
      const overlayType =
        action === "highlight"
          ? "OVERLAY_HIGHLIGHT"
          : action === "pulse"
            ? "OVERLAY_PULSE"
            : "OVERLAY_POINT";
      void chrome.tabs.sendMessage(tabId, {
        type: overlayType,
        selector,
        label,
      });
    };

    const consumeEvent = (event: SseEvent) => {
      if (event.type === "text_chunk") {
        accumulatedText +=
          (accumulatedText.length > 0 ? " " : "") + event.text;
      } else if (event.type === "element_ref") {
        // First element_ref wins — subsequent refs would fight the overlay
        // state machine. The answer text still references them by selector
        // so the user can see which element each step mentions.
        if (!dispatchedOverlay) {
          dispatchedOverlay = true;
          dispatchOverlay(event.selector, event.label, event.action);
        }
      } else if (event.type === "citation") {
        citations.push({ sourceId: event.sourceId, title: event.title });
      }
      // `done` is a no-op; the reader loop exits naturally.
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseBuffer(buffer);
      buffer = remainder;
      for (const event of events) consumeEvent(event);
    }

    // Flush any trailing partial frame that didn't get a terminating `\n\n`
    // (shouldn't happen with a well-formed stream, but be defensive).
    if (buffer.trim()) {
      const { events } = parseSseBuffer(`${buffer}\n\n`);
      for (const event of events) consumeEvent(event);
    }

    // 5. Speak the answer.
    const answer = accumulatedText.trim();
    if (answer) {
      void chrome.tabs.sendMessage(tabId, {
        type: "TTS_SPEAK",
        text: answer,
      });
    }

    if (citations.length > 0) {
      // Future work: surface these in an overlay toast. For now, log so they
      // show up in the service worker console during smoke tests.
      console.log("[Tribora STT] Citations:", citations);
    }
  } catch (err) {
    console.error("[Tribora STT] Handler failed:", err);
  }
}

export default defineBackground(() => {
  console.log("Tribora service worker started");

  // TRIB-27: schedule token refresh 5 min before expiry on startup
  scheduleTokenRefresh();

  // TRIB-48: recording state (scoped to service worker lifetime)
  let activeRecorder: TabRecorder | null = null;

  // TRIB-48: recording message handler (separate listener — Chrome dispatches to all)
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RECORDING_START') {
      void (async () => {
        try {
          activeRecorder = createTabRecorder();
          await activeRecorder.start();
          sendResponse({ ok: true, state: { status: 'recording', startedAt: Date.now() } });
        } catch (err) {
          sendResponse({ ok: false, error: (err as Error).message });
        }
      })();
      return true; // keep channel open for async response
    }
    if (message?.type === 'RECORDING_STOP') {
      void (async () => {
        try {
          if (!activeRecorder) return sendResponse({ ok: false, error: 'Not recording' });
          const blob = await activeRecorder.stop();
          activeRecorder = null;
          const { recordingId } = await uploadRecording(blob, {
            filename: `extension-${Date.now()}.webm`,
            mimeType: 'video/webm',
            source: 'extension',
          });
          sendResponse({ ok: true, recordingId });
        } catch (err) {
          sendResponse({ ok: false, error: (err as Error).message });
        }
      })();
      return true; // keep channel open for async response
    }
    return false;
  });

  // TRIB-23 / TRIB-27: existing page context + auth listeners
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("Tribora background received message:", message.type);

    switch (message.type) {
      case "GET_PAGE_CONTEXT":
        // Relay to content script or return cached context
        sendResponse({ type: "PAGE_CONTEXT_RESPONSE", payload: null });
        break;

      case "PAGE_CONTEXT_UPDATED":
        // Content script reports updated context on SPA navigation.
        // Real handling (caching, forwarding to API) implemented in TRIB-25+.
        console.log("[Tribora] PAGE_CONTEXT_UPDATED received:", message.context);
        break;

      case "QUERY_KNOWLEDGE":
        // Forward to Tribora backend API (implemented in TRIB-25+)
        sendResponse({ type: "KNOWLEDGE_RESPONSE", payload: null });
        break;

      // TRIB-27: handle auth state queries from popup or content script
      case "AUTH_STATE_REQUEST":
        void (async () => {
          const session = await getStoredSession();
          sendResponse(session);
        })();
        return true; // keep channel open for async response

      default:
        sendResponse({ error: "Unknown message type" });
    }

    // Return true to keep the message channel open for async responses
    return true;
  });

  // TRIB-65: STT → /api/extension/query glue. Runs as its own listener so
  // the fire-and-forget fetch + SSE parse can proceed without blocking
  // either of the switch-based listeners above. The content script sends
  // `{type: "STT_FINAL", transcript, context}` when the push-to-talk hotkey
  // is released; we POST to the fusion endpoint, stream the answer, and
  // dispatch OVERLAY_* / TTS_SPEAK back to the same tab.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "STT_FINAL") return false;
    if (typeof message.transcript !== "string" || !message.transcript.trim()) {
      sendResponse({ ok: false, error: "Empty transcript" });
      return false;
    }
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "No sender tab id" });
      return false;
    }
    // Ack synchronously so Chrome doesn't hold the channel open. The async
    // work runs in the background and dispatches follow-up messages.
    void handleSttFinal({
      transcript: message.transcript,
      context: (message.context as PageContext | undefined) ?? undefined,
      tabId,
    });
    sendResponse({ ok: true });
    return false;
  });
});
