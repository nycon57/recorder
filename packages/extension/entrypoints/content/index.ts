/**
 * content/index.ts — Main content script entrypoint for the Tribora extension.
 *
 * Orchestrates: page context detection, DOM overlay, floating widget,
 * auth bridge, and ElevenLabs Conversational Agent sessions (push-to-talk).
 */

import type { PageContext, AssistantState } from "@tribora/shared";
import { ASSISTANT_STATE_KEY } from "@tribora/shared";
import { buildPageContext } from "./context-engine";
import { createDomObserver } from "./dom-observer";
import { createDomOverlay } from "./dom-overlay";
import { createWidget } from "./widget";
import { createHotkey } from "../../utils/hotkey.js";
import { DEFAULT_HOTKEY_MAC, DEFAULT_HOTKEY_WIN } from "@tribora/shared";
import { startAgentSession } from "../../utils/agent-client.js";
import type { AgentSession } from "../../utils/agent-client.js";

const LOG = "[Tribora content]";
const WIDGET_VISIBLE_KEY = "tribora_widget_visible";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    console.log(`${LOG} ✅ Content script loaded on`, window.location.href);

    // ── Page context ────────────────────────────────────────────────────────
    const initialContext: PageContext = buildPageContext(document, window);
    let latestContext: PageContext = initialContext;
    console.log(`${LOG} Page context: ${initialContext.app}:${initialContext.screen}`, `(${initialContext.interactiveElements?.length ?? 0} elements)`);

    chrome.runtime.sendMessage(
      { type: "PAGE_CONTEXT_UPDATED", context: initialContext },
      () => void chrome.runtime.lastError,
    );

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_PAGE_CONTEXT") {
        sendResponse({ type: "PAGE_CONTEXT_RESPONSE", payload: latestContext });
        return true;
      }
    });

    const observer = createDomObserver((ctx: PageContext) => {
      latestContext = ctx;
      console.log(`${LOG} SPA navigation detected: ${ctx.app}:${ctx.screen}`);
      chrome.runtime.sendMessage(
        { type: "PAGE_CONTEXT_UPDATED", context: ctx },
        () => void chrome.runtime.lastError,
      );
    });
    observer.start();

    // ── DOM overlay ─────────────────────────────────────────────────────────
    const overlay = createDomOverlay();
    console.log(`${LOG} DOM overlay initialized`);

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "OVERLAY_POINT") {
        console.log(`${LOG} 🎯 Overlay POINT: ${msg.selector} "${msg.label}"`);
        overlay.pointAt(msg.selector as string, msg.label as string | undefined);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_HIGHLIGHT") {
        console.log(`${LOG} 🔵 Overlay HIGHLIGHT: ${msg.selector}`);
        overlay.highlight(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_PULSE") {
        console.log(`${LOG} 💫 Overlay PULSE: ${msg.selector}`);
        overlay.pulse(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_CLEAR") {
        console.log(`${LOG} Overlay CLEAR`);
        overlay.clear();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });

    // ── Auth bridge ─────────────────────────────────────────────────────────
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "TRIBORA_AUTH_SUCCESS") return;
      console.log(`${LOG} 🔑 Auth bridge: relaying session to background`);
      chrome.runtime.sendMessage(
        { type: "AUTH_CALLBACK", session: event.data.session },
        () => void chrome.runtime.lastError,
      );
    });

    // ── Floating widget ─────────────────────────────────────────────────────
    // Widget click handlers — forward-declare wrappers that call the session
    // functions once they're defined further down. This lets the widget be
    // created early while still getting live click handlers.
    let startSessionFn: () => void = () => {};
    let stopSessionFn: () => void = () => {};

    const widget = createWidget({
      onStartClick: () => startSessionFn(),
      onStopClick: () => stopSessionFn(),
    });
    console.log(`${LOG} Widget created`);

    void (async () => {
      const result = await chrome.storage.session.get(WIDGET_VISIBLE_KEY);
      const wasVisible = result[WIDGET_VISIBLE_KEY] === true;
      console.log(`${LOG} Widget restore from storage: visible=${wasVisible}`);
      if (wasVisible) {
        widget.show();
      }
    })();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "QUERY_WIDGET_STATE") {
        sendResponse({ visible: widget.isVisible() });
        return false;
      }
      if (msg?.type === "TOGGLE_WIDGET") {
        console.log(`${LOG} 🔄 TOGGLE_WIDGET: visible=${msg.visible}`);
        if (msg.visible) widget.show(); else widget.hide();
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "REQUEST_PERMISSIONS") {
        console.log(`${LOG} 🎤 REQUEST_PERMISSIONS: requesting mic access`);
        void (async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            await chrome.storage.local.set({ micPermissionGranted: true });
            console.log(`${LOG} ✅ Mic permission granted`);
          } catch (err) {
            console.warn(`${LOG} ❌ Mic permission denied:`, (err as Error).message);
          }
        })();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && changes[WIDGET_VISIBLE_KEY]) {
        const visible = changes[WIDGET_VISIBLE_KEY].newValue === true;
        console.log(`${LOG} Storage sync: widget visible=${visible}`);
        if (visible) widget.show(); else widget.hide();
      }
    });

    // ── Assistant state broadcasting ────────────────────────────────────────
    const broadcastAssistantState = async (patch: Partial<AssistantState>) => {
      try {
        const result = await chrome.storage.session.get(ASSISTANT_STATE_KEY);
        const current = (result[ASSISTANT_STATE_KEY] as AssistantState | undefined) ?? { status: "idle" };
        const next: AssistantState = { ...current, ...patch, updatedAt: Date.now() };
        await chrome.storage.session.set({ [ASSISTANT_STATE_KEY]: next });
      } catch { /* non-fatal */ }
    };

    // ── ElevenLabs Conversational Agent (push-to-talk) ──────────────────────
    let activeSession: AgentSession | null = null;
    let sessionStarting = false;

    const isMac = navigator.platform.toLowerCase().includes("mac");
    const hotkeyConfig = isMac ? DEFAULT_HOTKEY_MAC : DEFAULT_HOTKEY_WIN;
    console.log(`${LOG} Hotkey: ${isMac ? "⌘+⌥" : "Ctrl+Alt"} (push-to-talk)`);

    /** Screenshot capture — delegates to background */
    function captureScreenshot(): Promise<string> {
      console.log(`${LOG} 📸 Requesting screenshot from background...`);
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
          if (chrome.runtime.lastError || !response?.screenshot) {
            console.warn(`${LOG} 📸 Screenshot failed:`, chrome.runtime.lastError?.message || "no data");
            resolve("Screenshot unavailable");
          } else {
            console.log(`${LOG} 📸 Screenshot received (${Math.round((response.screenshot as string).length / 1024)} KB)`);
            resolve(response.screenshot as string);
          }
        });
      });
    }

    // Auto-clear the overlay after a delay so stale highlights don't linger
    // after DOM changes (e.g., modal closes, sidebar collapses).
    let overlayClearTimer: number | null = null;
    function scheduleOverlayClear(delayMs = 3000): void {
      if (overlayClearTimer !== null) window.clearTimeout(overlayClearTimer);
      overlayClearTimer = window.setTimeout(() => {
        overlay.clear();
        overlayClearTimer = null;
      }, delayMs);
    }
    function cancelOverlayClear(): void {
      if (overlayClearTimer !== null) {
        window.clearTimeout(overlayClearTimer);
        overlayClearTimer = null;
      }
    }

    /** Highlight a DOM element via the overlay */
    function highlightElement(selector: string, label: string, action: string): string {
      console.log(`${LOG} 🎯 Agent tool: highlight_element("${selector}", "${label}", "${action}")`);
      cancelOverlayClear();
      try {
        const el = document.querySelector(selector);
        if (!el) {
          console.warn(`${LOG} 🎯 Element not found: ${selector}`);
          return "element not found";
        }
        if (action === "highlight") {
          overlay.highlight(selector);
        } else if (action === "pulse") {
          overlay.pulse(selector);
        } else {
          overlay.pointAt(selector, label);
        }
        console.log(`${LOG} 🎯 Element highlighted successfully`);
        // Keep highlight visible for 4s so user can see it, then auto-clear
        scheduleOverlayClear(4000);
        return "highlighted";
      } catch (err) {
        console.error(`${LOG} 🎯 Highlight error:`, err);
        return "element not found";
      }
    }

    /** Click a DOM element by selector */
    function clickElement(selector: string): string {
      console.log(`${LOG} 🖱️ Agent tool: click_element("${selector}")`);
      cancelOverlayClear();
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) {
          console.warn(`${LOG} 🖱️ Element not found: ${selector}`);
          return "element not found";
        }
        // Scroll into view first so the user can see what's being clicked
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Briefly highlight before clicking so the user sees the action
        overlay.pointAt(selector);
        // Click after a short delay so the highlight animation is visible
        window.setTimeout(() => {
          el.click();
          console.log(`${LOG} 🖱️ Element clicked`);
          // Clear overlay 1.5s after click so stale highlights don't linger
          // when the DOM changes (modal opens, sidebar collapses, etc.)
          scheduleOverlayClear(1500);
        }, 300);
        return "clicked";
      } catch (err) {
        console.error(`${LOG} 🖱️ Click error:`, err);
        return "click failed";
      }
    }

    /** Type text into an input/textarea/contenteditable element */
    function typeInElement(selector: string, text: string, clearFirst?: boolean): string {
      console.log(`${LOG} ⌨️ Agent tool: type_in_element("${selector}")`);
      cancelOverlayClear();
      try {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) {
          console.warn(`${LOG} ⌨️ Element not found: ${selector}`);
          return "element not found";
        }

        overlay.pointAt(selector);
        scheduleOverlayClear(2500);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();

        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (clearFirst) el.value = "";
          el.value = (clearFirst ? "" : el.value) + text;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          console.log(`${LOG} ⌨️ Typed ${text.length} chars into ${el.tagName}`);
          return "typed";
        }

        if (el.isContentEditable) {
          if (clearFirst) el.textContent = "";
          el.textContent = (clearFirst ? "" : el.textContent ?? "") + text;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          console.log(`${LOG} ⌨️ Typed ${text.length} chars into contenteditable`);
          return "typed";
        }

        console.warn(`${LOG} ⌨️ Element is not an input/textarea/contenteditable`);
        return "element is not an input field";
      } catch (err) {
        console.error(`${LOG} ⌨️ Type error:`, err);
        return "type failed";
      }
    }

    /** Smoothly scroll an element into view */
    function scrollToElement(selector: string): string {
      console.log(`${LOG} 📜 Agent tool: scroll_to_element("${selector}")`);
      cancelOverlayClear();
      try {
        const el = document.querySelector(selector);
        if (!el) {
          console.warn(`${LOG} 📜 Element not found: ${selector}`);
          return "element not found";
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        overlay.pointAt(selector);
        scheduleOverlayClear(3000);
        return "scrolled";
      } catch (err) {
        console.error(`${LOG} 📜 Scroll error:`, err);
        return "scroll failed";
      }
    }

    // The ElevenLabs agent has its own turn-taking model (VAD), so we don't
    // manually mute/unmute. Session ends only on explicit stop (widget click or
    // hotkey while active).
    let sessionConnected = false;

    async function endActiveSession(): Promise<void> {
      if (!activeSession) return;
      console.log(`${LOG} 🛑 Ending session`);
      try {
        await activeSession.endSession();
      } catch (err) {
        console.warn(`${LOG} endSession error (non-fatal):`, (err as Error).message);
      }
      activeSession = null;
      sessionConnected = false;
      widget.setIdle();
      overlay.clear();
      void broadcastAssistantState({ status: "idle" });
    }

    async function startSession(): Promise<void> {
      console.log(`${LOG} 🎙️ Start session requested — activeSession=${!!activeSession}, sessionStarting=${sessionStarting}, widgetVisible=${widget.isVisible()}`);

      if (sessionStarting) {
        console.log(`${LOG} Session already starting — ignoring`);
        return;
      }
      if (activeSession) {
        console.log(`${LOG} Session already active — ignoring`);
        return;
      }
      if (!widget.isVisible()) {
        console.log(`${LOG} Widget not visible — ignoring`);
        return;
      }

      sessionStarting = true;
      sessionConnected = false;
      widget.setConnecting();
      void broadcastAssistantState({ status: "listening" });

      console.log(`${LOG} 🎤 Requesting mic permission before starting session...`);
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((t) => t.stop());
        console.log(`${LOG} 🎤 Mic permission confirmed`);
      } catch (micErr) {
        console.error(`${LOG} 🎤 Mic permission DENIED:`, (micErr as Error).message);
        sessionStarting = false;
        widget.setIdle();
        void broadcastAssistantState({ status: "error", error: "Microphone access denied" });
        return;
      }

      try {
        activeSession = await startAgentSession(
          {
            getPageContext: () => {
              console.log(`${LOG} 🔧 Agent tool: get_page_context → ${latestContext.url}`);
              return latestContext;
            },
            captureScreenshot,
            highlightElement,
            clickElement,
            typeInElement,
            scrollToElement,
          },
          {
            onModeChange: (mode) => {
              console.log(`${LOG} 🔄 Agent mode: ${mode.mode}`);
              if (mode.mode === "listening") {
                // User is about to speak — clear any stale overlay from the
                // previous agent turn so it doesn't linger on the page.
                cancelOverlayClear();
                overlay.clear();
                widget.setListening(
                  activeSession ? () => activeSession!.getInputFrequencyData() : undefined,
                );
                void broadcastAssistantState({ status: "listening" });
              } else if (mode.mode === "speaking") {
                widget.setSpeaking(
                  activeSession ? () => activeSession!.getOutputFrequencyData() : undefined,
                );
                void broadcastAssistantState({ status: "speaking" });
              }
            },
            onConnect: () => {
              console.log(`${LOG} ✅ Agent session CONNECTED — mic is live, speak now`);
              sessionStarting = false;
              sessionConnected = true;
              widget.setListening(
                activeSession ? () => activeSession!.getInputFrequencyData() : undefined,
              );
            },
            onDisconnect: () => {
              console.log(`${LOG} ❌ Agent session DISCONNECTED`);
              activeSession = null;
              sessionStarting = false;
              sessionConnected = false;
              widget.setIdle();
              overlay.clear();
              void broadcastAssistantState({ status: "idle" });
            },
            onError: (error) => {
              console.error(`${LOG} ❌ Agent session ERROR:`, error);
              activeSession = null;
              sessionStarting = false;
              widget.setIdle();
              void broadcastAssistantState({ status: "error", error });
            },
            onMessage: (message) => {
              console.log(`${LOG} 💬 Agent message:`, JSON.stringify(message).slice(0, 200));
            },
            onStatusChange: (status) => {
              console.log(`${LOG} 📡 Agent status: ${status}`);
            },
          },
        );
        console.log(`${LOG} ✅ Agent session started successfully`);
      } catch (err) {
        console.error(`${LOG} ❌ Failed to start agent session:`, err);
        sessionStarting = false;
        widget.setIdle();
        void broadcastAssistantState({
          status: "error",
          error: (err as Error).message,
        });
      }
    }

    // Wire the widget click callbacks to the session functions
    startSessionFn = () => { void startSession(); };
    stopSessionFn = () => { void endActiveSession(); };

    // Hotkey: press toggles session (same as widget click).
    // No push-to-talk hold — the agent's VAD handles turn-taking.
    const hotkey = createHotkey(hotkeyConfig, () => {
      if (!widget.isVisible()) {
        console.log(`${LOG} Hotkey pressed but widget hidden — ignoring`);
        return;
      }
      if (activeSession) {
        void endActiveSession();
      } else {
        void startSession();
      }
    }, () => {
      // no-op on release
    });
    hotkey.start();
    console.log(`${LOG} ✅ Hotkey listener started (press to start/stop, click widget to start/stop)`);
  },
});
