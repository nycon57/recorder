/**
 * content/index.ts — Main content script entrypoint for the Tribora extension.
 *
 * Replaces the stub at entrypoints/content.ts (TRIB-23).
 * Uses WXT's defineContentScript format.
 */

import type { PageContext } from "@tribora/shared";
import { buildPageContext } from "./context-engine";
import { createDomObserver } from "./dom-observer";

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
  },
});
