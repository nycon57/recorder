import { scheduleTokenRefresh } from "../utils/token-refresh.js";
import { createTabRecorder } from "../utils/tab-recorder.js";
import { uploadRecording } from "../utils/recording-uploader.js";
import type { TabRecorder } from "../utils/tab-recorder.js";
import { getStoredSession, setStoredSession } from "../utils/api-client.js";
import type { PageContext, AssistantState } from "@tribora/shared";
import { ASSISTANT_STATE_KEY } from "@tribora/shared";

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
    console.log("[Tribora pipeline] STT transcript:", transcript);
    console.log("[Tribora pipeline] Page context:", pageContext.url, `(${pageContext.app}:${pageContext.screen})`);

    // Broadcast "answering" state to popup
    void chrome.storage.session.set({
      [ASSISTANT_STATE_KEY]: {
        status: "answering",
        lastQuestion: transcript,
        updatedAt: Date.now(),
      } satisfies AssistantState,
    });

    // Capture screenshot for vision-based fallback (works on any page)
    let screenshot: string | undefined;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) {
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "jpeg",
          quality: 70,
        });
        // Strip the data:image/jpeg;base64, prefix — backend expects raw base64
        screenshot = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        console.log("[Tribora pipeline] Screenshot captured (" + Math.round(screenshot.length / 1024) + " KB base64)");
      }
    } catch (err) {
      console.warn("[Tribora pipeline] Screenshot capture failed:", (err as Error).message);
      // Non-fatal — query will still work via wiki layers
    }

    const body = JSON.stringify({
      question: transcript,
      context: serializePageContext(pageContext),
      screenshot,
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
      // Broadcast "speaking" state to popup
      void chrome.storage.session.set({
        [ASSISTANT_STATE_KEY]: {
          status: "speaking",
          lastQuestion: transcript,
          lastAnswerPreview: answer.slice(0, 120),
          updatedAt: Date.now(),
        } satisfies AssistantState,
      });

      console.log("[Tribora pipeline] AI response:", answer.slice(0, 200) + (answer.length > 200 ? "..." : ""));
      console.log("[Tribora pipeline] Dispatching TTS (" + answer.length + " chars)");

      void chrome.tabs.sendMessage(tabId, {
        type: "TTS_SPEAK",
        text: answer,
      });
    } else {
      console.warn("[Tribora pipeline] No answer text from query stream");
      // No answer — return to idle
      void chrome.storage.session.set({
        [ASSISTANT_STATE_KEY]: {
          status: "idle",
          lastQuestion: transcript,
          updatedAt: Date.now(),
        } satisfies AssistantState,
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

const WIDGET_VISIBLE_KEY = "tribora_widget_visible";

const BG = "[Tribora bg]";

export default defineBackground(() => {
  console.log(`${BG} ✅ Service worker started`);

  // TRIB-27: schedule token refresh 5 min before expiry on startup
  scheduleTokenRefresh();

  // ── Widget toggle via extension icon ──────────────────────────────────────
  void chrome.action.setPopup({ popup: "" });
  console.log(`${BG} Popup disabled — icon click triggers onClicked`);

  chrome.action.onClicked.addListener((tab) => {
    console.log(`${BG} 🖱️ Extension icon clicked (tab ${tab.id}, ${tab.url?.slice(0, 60)})`);
    void (async () => {
      let session = await getStoredSession();
      console.log(`${BG} Stored session: ${session?.status ?? "none"}`);

      if (!session || session.status !== "authenticated") {
        console.log(`${BG} Not authenticated — trying cookie refresh...`);
        try {
          const { refreshSession } = await import("../utils/auth-session.js");
          session = await refreshSession();
          console.log(`${BG} Cookie refresh result: ${session.status}`);
        } catch (err) {
          console.error(`${BG} Cookie refresh failed:`, (err as Error).message);
        }
      }

      if (!session || session.status !== "authenticated") {
        console.log(`${BG} Still not authenticated — opening sign-in page`);
        await chrome.tabs.create({ url: `${API_BASE_URL}/sign-in?source=extension` });
        return;
      }

      // Use the active tab's actual widget DOM state as source of truth.
      // Storage drifts (page reloads destroy the widget DOM without updating
      // storage), which caused "click the icon twice to show" — the stored
      // value said visible, the DOM said hidden, and a naive toggle flipped
      // storage to hidden on the first click with no visible change.
      let currentlyVisible = false;
      if (tab.id) {
        try {
          const resp = (await chrome.tabs.sendMessage(tab.id, {
            type: "QUERY_WIDGET_STATE",
          })) as { visible?: boolean } | undefined;
          currentlyVisible = resp?.visible === true;
        } catch {
          // Content script not reachable (chrome://, extension gallery, etc.)
          // Fall back to stored value.
          const stored = await chrome.storage.session.get(WIDGET_VISIBLE_KEY);
          currentlyVisible = stored[WIDGET_VISIBLE_KEY] === true;
        }
      }
      const newState = !currentlyVisible;
      await chrome.storage.session.set({ [WIDGET_VISIBLE_KEY]: newState });
      console.log(`${BG} 🔄 Widget toggled: ${newState ? "ON" : "OFF"} (was ${currentlyVisible ? "visible" : "hidden"})`);

      const tabs = await chrome.tabs.query({});
      console.log(`${BG} Broadcasting TOGGLE_WIDGET to ${tabs.length} tabs`);
      for (const t of tabs) {
        if (t.id) {
          chrome.tabs.sendMessage(t.id, { type: "TOGGLE_WIDGET", visible: newState }, () => {
            void chrome.runtime.lastError;
          });
        }
      }

      if (newState && tab.id) {
        console.log(`${BG} Requesting mic permissions on active tab`);
        chrome.tabs.sendMessage(tab.id, { type: "REQUEST_PERMISSIONS" }, () => {
          void chrome.runtime.lastError;
        });
      }
    })();
  });

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

          // TRIB-49: relay upload progress + retry state to popup via storage
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

          // Clear upload state on success
          void chrome.storage.session.remove(UPLOAD_STATE_KEY);
          sendResponse({ ok: true, recordingId });
        } catch (err) {
          // Clear upload state on failure
          void chrome.storage.session.remove('tribora_upload_state');
          sendResponse({ ok: false, error: (err as Error).message });
        }
      })();
      return true; // keep channel open for async response
    }
    return false;
  });

  // TRIB-23 / TRIB-27: existing page context + auth listeners
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log(`${BG} 📨 Message received: ${message.type}`);

    switch (message.type) {
      case "GET_PAGE_CONTEXT":
        sendResponse({ type: "PAGE_CONTEXT_RESPONSE", payload: null });
        break;

      case "PAGE_CONTEXT_UPDATED":
        break;

      case "QUERY_KNOWLEDGE":
        // Forward to Tribora backend API (implemented in TRIB-25+)
        sendResponse({ type: "KNOWLEDGE_RESPONSE", payload: null });
        break;

      case "AUTH_CALLBACK":
        console.log(`${BG} 🔑 AUTH_CALLBACK: storing session`);
        void (async () => {
          if (message.session) {
            await setStoredSession(message.session);
            console.log(`${BG} 🔑 Session stored: ${message.session.user?.email}`);
            sendResponse({ ok: true });
          } else {
            console.warn(`${BG} 🔑 AUTH_CALLBACK: no session data`);
            sendResponse({ ok: false, error: "No session data" });
          }
        })();
        return true;

      case "AUTH_STATE_REQUEST":
        void (async () => {
          const session = await getStoredSession();
          console.log(`${BG} AUTH_STATE_REQUEST: ${session?.status ?? "none"}`);
          sendResponse(session);
        })();
        return true;

      default:
        // Don't respond to message types handled by other listeners
        return false;
    }
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

  // ── Signed URL fetch for agent sessions ─────────────────────────────────
  // Content scripts on arbitrary origins can't make authenticated cross-origin
  // requests to the Tribora API (no access to chrome.cookies, `Cookie` is a
  // forbidden header, and CORS `*` can't carry credentials). The background
  // worker has chrome.cookies access and can send the user's real website
  // cookies via a plain `Cookie` header.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "GET_AGENT_SIGNED_URL") return false;
    void (async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        try {
          const cookies = await chrome.cookies.getAll({ url: API_BASE_URL });
          if (cookies.length > 0) {
            headers["Cookie"] = cookies
              .map((c) => `${c.name}=${c.value}`)
              .join("; ");
          }
        } catch {
          // cookies API unavailable — fall back to bearer token only
        }
        const session = await getStoredSession();
        if (session?.token) {
          headers["Authorization"] = `Bearer ${session.token}`;
        }

        const response = await fetch(
          `${API_BASE_URL}/api/extension/agent-session`,
          { method: "POST", headers },
        );
        if (!response.ok) {
          sendResponse({
            ok: false,
            error: `HTTP ${response.status}`,
            status: response.status,
          });
          return;
        }
        const data = (await response.json()) as {
          signedUrl?: string;
          conversationId?: string;
        };
        if (!data.signedUrl) {
          sendResponse({ ok: false, error: "No signedUrl in response" });
          return;
        }
        sendResponse({
          ok: true,
          signedUrl: data.signedUrl,
          conversationId: data.conversationId,
        });
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message });
      }
    })();
    return true;
  });

  // ── Screenshot capture for agent client tools ───────────────────────────
  // Content scripts can't call chrome.tabs.captureVisibleTab directly —
  // only the background service worker has that API. The agent-client's
  // capture_screenshot tool sends this message to get the screenshot.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "CAPTURE_SCREENSHOT") return false;
    console.log(`${BG} 📸 CAPTURE_SCREENSHOT request from tab ${sender.tab?.id}`);
    void (async () => {
      try {
        const tab = sender.tab;
        const windowId = tab?.windowId ?? (await chrome.windows.getCurrent()).id;
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "jpeg",
          quality: 70,
        });
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
        console.log(`${BG} 📸 Screenshot captured (${Math.round(base64.length / 1024)} KB)`);
        sendResponse({ screenshot: base64 });
      } catch (err) {
        console.error(`${BG} 📸 Screenshot FAILED:`, (err as Error).message);
        sendResponse({ screenshot: null });
      }
    })();
    return true;
  });
});
