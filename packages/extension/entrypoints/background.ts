import { scheduleTokenRefresh } from "../utils/token-refresh.js";

export default defineBackground(() => {
  console.log("Tribora service worker started");

  // TRIB-27: schedule token refresh 5 min before expiry on startup
  scheduleTokenRefresh();

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
          const { getStoredSession } = await import("../utils/api-client.js");
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
});
