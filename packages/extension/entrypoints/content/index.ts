/**
 * content/index.ts — Main content script entrypoint for the Tribora extension.
 *
 * Replaces the stub at entrypoints/content.ts (TRIB-23).
 * Uses WXT's defineContentScript format.
 */

import type { PageContext } from "@tribora/shared";
import { buildPageContext } from "./context-engine";
import { createDomObserver } from "./dom-observer";
import { createDomOverlay } from "./dom-overlay"; // TRIB-24
import { createAudioCapture } from "./audio-capture"; // TRIB-25
import { createAudioPlayer } from "./audio-playback"; // TRIB-26

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    console.log("Tribora content script active on", window.location.href);

    // Initial scan
    const initialContext: PageContext = buildPageContext(document, window);

    if (process.env.NODE_ENV !== "production") {
      console.log("[Tribora] Initial PageContext:", initialContext);
    }

    // Respond to background service worker requests for the current context.
    // This keeps compatibility with the existing GET_PAGE_CONTEXT handler.
    let latestContext: PageContext = initialContext;

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_PAGE_CONTEXT") {
        sendResponse({ type: "PAGE_CONTEXT_RESPONSE", payload: latestContext });
        return true;
      }
    });

    // SPA navigation observer — re-runs context engine on navigation events
    const observer = createDomObserver((ctx: PageContext) => {
      latestContext = ctx;

      if (process.env.NODE_ENV !== "production") {
        console.log("[Tribora] Navigation detected, updated PageContext:", ctx);
      }

      // Notify background service worker of the updated context
      chrome.runtime.sendMessage(
        { type: "PAGE_CONTEXT_UPDATED", context: ctx },
        // Ignore "Receiving end does not exist" errors (background may not be listening)
        () => void chrome.runtime.lastError,
      );
    });

    observer.start();

    // ── TRIB-24: DOM overlay — visual teaching layer ─────────────────────────
    // A second message listener is intentional: Chrome dispatches to ALL
    // registered listeners; each handles only its own message types.
    const overlay = createDomOverlay();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "OVERLAY_POINT") {
        overlay.pointAt(msg.selector as string, msg.label as string | undefined);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_HIGHLIGHT") {
        overlay.highlight(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_PULSE") {
        overlay.pulse(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "OVERLAY_CLEAR") {
        overlay.clear();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });

    // ── TRIB-25: Audio capture + push-to-talk ────────────────────────────────
    const audioCapture = createAudioCapture(
      (finalTranscript) => {
        chrome.runtime.sendMessage({
          type: "STT_FINAL",
          transcript: finalTranscript,
        });
      },
      (err) => {
        console.error("[Tribora STT]", err);
        chrome.runtime.sendMessage({
          type: "STT_ERROR",
          state: { status: "error", error: err.message },
        });
      },
    );
    audioCapture.start();

    // ── TRIB-26: Audio playback — TTS ────────────────────────────────────────
    // A new listener is intentional: Chrome dispatches to ALL registered
    // listeners; each TRIB handles only its own message types.
    const audioPlayer = createAudioPlayer((ttsState) => {
      if (ttsState.status === "error") {
        console.error("[Tribora TTS state]", ttsState.error);
      }
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "TTS_SPEAK" && typeof msg.text === "string") {
        void audioPlayer.speak(msg.text as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "TTS_SPEAK" && typeof msg.audioUrl === "string") {
        void audioPlayer.playUrl(msg.audioUrl as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === "TTS_STOP") {
        audioPlayer.stop();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });
  },
});
