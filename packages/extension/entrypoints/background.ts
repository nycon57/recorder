export default defineBackground(() => {
  console.log("Tribora service worker started");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Tribora background received message:", message.type, sender);

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

      default:
        sendResponse({ error: "Unknown message type" });
    }

    // Return true to keep the message channel open for async responses
    return true;
  });
});
