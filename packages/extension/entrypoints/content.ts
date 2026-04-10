import type { PageContext } from "@tribora/shared";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    console.log("Tribora content script loaded on", window.location.href);

    // Stub context — populated by context engine in TRIB-23
    const context: PageContext = {
      app: "unknown",
      screen: "unknown",
      url: window.location.href,
      title: document.title,
      interactiveElements: [],
    };

    // Respond to background service worker requests for page context
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_PAGE_CONTEXT") {
        sendResponse({ type: "PAGE_CONTEXT_RESPONSE", payload: context });
        return true;
      }
    });

    console.log("Tribora content script context stub ready", context);
  },
});
