/**
 * context-engine.ts — answers "what is the user looking at right now?"
 *
 * Identifies the application, screen/view, and interactive elements.
 * Output matches the PageContext interface in @tribora/shared.
 */

import type { PageContext, InteractiveElement } from "@tribora/shared";
import { getStableSelector } from "./selector";

// ---------------------------------------------------------------------------
// App Registry
// ---------------------------------------------------------------------------

export interface AppRegistryEntry {
  /** Canonical app identifier (lowercase, no spaces) */
  name: string;
  /** URL patterns — at least one must match */
  urlPatterns: RegExp[];
  /** DOM features — all provided selectors must match at least minCount elements */
  domFingerprints: Array<{ selector: string; minCount?: number }>;
  /** Derive the screen name from the current URL and document */
  detectScreen: (url: string, doc: Document) => string | null;
}

export const APP_REGISTRY: AppRegistryEntry[] = [
  // -------------------------------------------------------------------------
  // Salesforce Lightning
  // -------------------------------------------------------------------------
  {
    name: "salesforce",
    urlPatterns: [/\.salesforce\.com/, /\.force\.com/, /\.lightning\.force\.com/],
    domFingerprints: [
      // Lightning Web Components (LWC) or SLDS classes
      { selector: "lightning-formatted-text, lightning-icon, lightning-button, .slds-scope, [class*='slds-']", minCount: 1 },
    ],
    detectScreen(url, doc) {
      // Object record views  (Lightning Experience URL patterns)
      if (/\/lightning\/r\/Lead\/[^/]+\/view/.test(url)) return "lead-detail";
      if (/\/lightning\/o\/Lead\/list/.test(url)) return "lead-list";
      if (/\/lightning\/r\/Opportunity\/[^/]+\/view/.test(url)) return "opportunity-detail";
      if (/\/lightning\/o\/Opportunity\/list/.test(url)) return "opportunity-list";
      if (/\/lightning\/r\/Contact\/[^/]+\/view/.test(url)) return "contact-detail";
      if (/\/lightning\/r\/Account\/[^/]+\/view/.test(url)) return "account-detail";
      if (/\/lightning\/r\/Case\/[^/]+\/view/.test(url)) return "case-detail";
      if (/\/lightning\/r\/Campaign\/[^/]+\/view/.test(url)) return "campaign-detail";
      if (/\/lightning\/r\/Task\/[^/]+\/view/.test(url)) return "task-activity";
      if (/\/lightning\/o\/[A-Za-z]+\/list/.test(url)) return "object-list";
      // Setup
      if (/\/lightning\/setup\//.test(url)) return "setup";
      // Reports & dashboards
      if (/\/lightning\/r\/Dashboard\//.test(url)) return "dashboard";
      if (/\/lightning\/r\/Report\//.test(url)) return "reports";
      if (/\/lightning\/o\/Dashboard\//.test(url)) return "dashboard-list";
      // Activity
      if (/\/lightning\/page\/home/.test(url)) return "home";
      // Fallback — try title
      const title = doc.title.toLowerCase();
      if (title.includes("setup")) return "setup";
      if (title.includes("dashboard")) return "dashboard";
      if (title.includes("report")) return "reports";
      return "unknown-salesforce";
    },
  },

  // -------------------------------------------------------------------------
  // HubSpot CRM
  // -------------------------------------------------------------------------
  {
    name: "hubspot",
    urlPatterns: [/app\.hubspot\.com/, /\.hubspot\.com/],
    domFingerprints: [
      { selector: "[data-global-nav], #hs-nav-v4, .private-page__body, [data-selenium-test]", minCount: 1 },
    ],
    detectScreen(url, _doc) {
      if (/\/contacts\/\d+\/contact\//.test(url)) return "contact-detail";
      if (/\/contacts\/list\//.test(url)) return "contacts-list";
      if (/\/contacts\/\d+\/company\//.test(url)) return "company-detail";
      if (/\/deals\/\d+\/deal\//.test(url)) return "deal-detail";
      if (/\/deals\/board/.test(url)) return "deals-board";
      if (/\/ticket\/\d+/.test(url)) return "ticket-detail";
      if (/\/reports\/dashboard/.test(url)) return "dashboard";
      if (/\/workflows\//.test(url)) return "workflows";
      if (/\/email\//.test(url)) return "email";
      if (/\/forms\//.test(url)) return "forms";
      return "unknown-hubspot";
    },
  },

  // -------------------------------------------------------------------------
  // Jira (Cloud)
  // -------------------------------------------------------------------------
  {
    name: "jira",
    urlPatterns: [/\.atlassian\.net\/jira/, /\.atlassian\.net\/browse/, /\.atlassian\.net\/board/],
    domFingerprints: [
      { selector: "[data-testid*='jira'], #jira, #ak-main-content, [data-ds--page-layout--slot]", minCount: 1 },
    ],
    detectScreen(url, _doc) {
      if (/\/browse\/[A-Z]+-\d+/.test(url)) return "issue-detail";
      if (/\/board/.test(url)) return "board";
      if (/\/backlog/.test(url)) return "backlog";
      if (/\/roadmap/.test(url)) return "roadmap";
      if (/\/project\/[^/]+\/list/.test(url)) return "issue-list";
      if (/\/jira\/software\/projects\/[^/]+\/boards/.test(url)) return "board";
      if (/\/jira\/software\/projects\/[^/]+\/backlog/.test(url)) return "backlog";
      if (/\/jira\/dashboards/.test(url) || /\/jira\/.*\/dashboard/.test(url)) return "dashboard";
      if (/\/jira\/projects/.test(url)) return "project-list";
      return "unknown-jira";
    },
  },

  // -------------------------------------------------------------------------
  // Zendesk Support
  // -------------------------------------------------------------------------
  {
    name: "zendesk",
    urlPatterns: [/\.zendesk\.com/],
    domFingerprints: [
      { selector: "[data-garden-version], .u-posAbsolute, #main_navigation, [data-test-id*='zen']", minCount: 1 },
    ],
    detectScreen(url, _doc) {
      if (/\/agent\/tickets\/\d+/.test(url)) return "ticket-detail";
      if (/\/agent\/tickets/.test(url)) return "tickets-list";
      if (/\/agent\/users\/\d+/.test(url)) return "user-detail";
      if (/\/agent\/organizations\/\d+/.test(url)) return "organization-detail";
      if (/\/agent\/reports/.test(url)) return "reports";
      if (/\/agent\/admin\/views/.test(url)) return "views";
      if (/\/agent\/admin/.test(url)) return "admin";
      if (/\/agent\/dashboard/.test(url) || /\/agent\/?$/.test(url)) return "dashboard";
      return "unknown-zendesk";
    },
  },

  // -------------------------------------------------------------------------
  // Notion
  // -------------------------------------------------------------------------
  {
    name: "notion",
    urlPatterns: [/notion\.so/, /notion\.site/],
    domFingerprints: [
      { selector: ".notion-page-content, .notion-frame, [data-block-id], .notion-sidebar-container", minCount: 1 },
    ],
    detectScreen(url, _doc) {
      if (/\/([a-f0-9]{32}|[a-z0-9-]+-[a-f0-9]{32})$/.test(url)) return "page";
      if (/\/database\//.test(url)) return "database";
      if (/\/search/.test(url)) return "search";
      return "page";
    },
  },
];

// ---------------------------------------------------------------------------
// App Detection
// ---------------------------------------------------------------------------

/**
 * Try to match the current page against the app registry.
 * Returns the first match, or a fallback "unknown" entry.
 */
export function detectApp(
  url: string,
  doc: Document,
): { app: string; screen: string; appVersion?: string } {
  for (const entry of APP_REGISTRY) {
    const urlMatches = entry.urlPatterns.some((re) => re.test(url));
    if (!urlMatches) continue;

    const domMatches = entry.domFingerprints.every(({ selector, minCount = 1 }) => {
      try {
        const nodes = doc.querySelectorAll(selector);
        return nodes.length >= minCount;
      } catch {
        // Invalid selector — treat as not matching
        return false;
      }
    });

    if (domMatches) {
      const screen = entry.detectScreen(url, doc) ?? "unknown";
      return { app: entry.name, screen };
    }

    // URL matched but DOM not yet loaded — still claim the app, fall back screen
    if (urlMatches && entry.domFingerprints.length === 0) {
      const screen = entry.detectScreen(url, doc) ?? "unknown";
      return { app: entry.name, screen };
    }

    // URL matched but DOM fingerprint didn't — could be a loading state.
    // Still return with URL-derived app name so we don't lose the match.
    const screen = entry.detectScreen(url, doc) ?? "unknown";
    return { app: entry.name, screen };
  }

  // Unknown app — derive a human-readable screen from the hostname
  return { app: "unknown", screen: hostnameFromUrl(url) };
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Interactive Element Inventory
// ---------------------------------------------------------------------------

const INTERACTIVE_SELECTORS =
  'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="combobox"], [role="menuitem"], [role="option"]';

/**
 * Build an inventory of visible, interactive elements on the page.
 * Skips hidden elements and elements with zero bounding area.
 */
export function buildInteractiveElementInventory(
  doc: Document,
  limit = 100,
): PageContext["interactiveElements"] {
  const elements = Array.from(doc.querySelectorAll(INTERACTIVE_SELECTORS));
  const results: InteractiveElement[] = [];

  for (const el of elements) {
    if (results.length >= limit) break;
    if (!isVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    const type = deriveType(el);
    const label = deriveLabel(el);
    const ariaLabel = el.getAttribute("aria-label") ?? undefined;
    const selector = getStableSelector(el);

    const item: InteractiveElement = { selector, label, type };
    if (ariaLabel) item.ariaLabel = ariaLabel;

    // Include bounding rect only when element is on-screen and has size
    if (rect.width > 0 && rect.height > 0) {
      item.boundingRect = rect;
    }

    results.push(item);
  }

  return results;
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  return true;
}

function deriveType(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");

  if (role === "button" || role === "menuitem") return "button";
  if (role === "link") return "link";
  if (role === "combobox" || role === "option") return "select";

  switch (tag) {
    case "button": return "button";
    case "input": {
      const inputType = (el as HTMLInputElement).type ?? "text";
      if (["submit", "button", "reset", "image"].includes(inputType)) return "button";
      if (inputType === "checkbox") return "checkbox";
      if (inputType === "radio") return "radio";
      return "input";
    }
    case "select": return "select";
    case "textarea": return "input";
    case "a": return "link";
    default: return tag;
  }
}

function deriveLabel(el: Element): string {
  // aria-label > aria-labelledby > text content > placeholder > name > value > alt
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = el.ownerDocument.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim();
  }

  const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
  if (text) return text.slice(0, 80); // cap to avoid huge labels

  if (el instanceof HTMLInputElement) {
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
    if (el.value) return el.value.slice(0, 40);
  }

  if (el instanceof HTMLImageElement && el.alt) return el.alt;

  const title = el.getAttribute("title");
  if (title) return title;

  return "";
}

// ---------------------------------------------------------------------------
// Breadcrumb Extraction
// ---------------------------------------------------------------------------

export function extractBreadcrumbs(doc: Document): string[] | undefined {
  const nav =
    doc.querySelector('[aria-label="breadcrumb"]') ??
    doc.querySelector("nav.breadcrumb, nav[class*='breadcrumb'], ol.breadcrumb, ul.breadcrumb, .breadcrumbs, [data-testid*='breadcrumb']");

  if (!nav) return undefined;

  const items = Array.from(nav.querySelectorAll("li, [aria-current], a, span"))
    .map((el) => (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? "")
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

// ---------------------------------------------------------------------------
// Visible Text Extraction
// ---------------------------------------------------------------------------

export function extractVisibleText(doc: Document, maxChars = 2000): string {
  const body = doc.body;
  if (!body) return "";
  const text = (body as HTMLElement).innerText ?? body.textContent ?? "";
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + "…";
}

// ---------------------------------------------------------------------------
// PageContext Builder
// ---------------------------------------------------------------------------

export function buildPageContext(
  doc: Document = document,
  win: Window = window,
): PageContext {
  const url = win.location.href;
  const title = doc.title;
  const { app, screen, appVersion } = detectApp(url, doc);
  const interactiveElements = buildInteractiveElementInventory(doc);
  const breadcrumbs = extractBreadcrumbs(doc);
  const visibleText = extractVisibleText(doc);

  const ctx: PageContext = {
    app,
    screen,
    url,
    title,
    interactiveElements,
  };

  if (appVersion) ctx.appVersion = appVersion;
  if (breadcrumbs) ctx.breadcrumbs = breadcrumbs;
  if (visibleText) ctx.visibleText = visibleText;

  return ctx;
}
