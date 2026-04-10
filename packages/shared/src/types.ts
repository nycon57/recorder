// PageContext — shared between the Chrome extension content script and the
// Tribora backend API routes (/api/extension/query, /api/extension/context).
// Defined in product-architecture-v2.md Part 3 Component 1, lines 136-152.

export interface InteractiveElement {
  selector: string; // CSS selector to target this element
  label: string; // Visible text label
  type: string; // "button" | "input" | "select" | "link"
  ariaLabel?: string; // Accessibility label if present
  boundingRect?: DOMRect; // Position for cursor targeting
}

export interface PageContext {
  app: string; // "salesforce" | "hubspot" | "jira" | "unknown"
  appVersion?: string; // If detectable
  screen: string; // "lead-detail" | "opportunity-list" | etc.
  url: string; // Current URL (sanitized of sensitive params)
  title: string; // Page title
  interactiveElements: InteractiveElement[];
  breadcrumbs?: string[]; // Navigation breadcrumbs if present
  visibleText?: string; // Truncated visible text for context (max 2000 chars)
}

// Message types for extension messaging between content script and background service worker
export type ExtensionMessageType =
  | "GET_PAGE_CONTEXT"
  | "PAGE_CONTEXT_RESPONSE"
  | "PAGE_CONTEXT_UPDATED"
  | "QUERY_KNOWLEDGE"
  | "KNOWLEDGE_RESPONSE"
  | "AUTH_CHECK"
  | "AUTH_RESPONSE";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
  /** Populated on PAGE_CONTEXT_UPDATED messages sent from the content script */
  context?: PageContext;
  error?: string;
}
