/**
 * context.ts — Lightweight context detection for the Tribora SDK.
 *
 * Ported from the Chrome extension's context-engine.ts (TRIB-24).
 * Detects which app/screen the user is on and builds an inventory
 * of interactive elements to send as context to the query API.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InteractiveElement {
  selector: string;
  label: string;
  type: string;
  ariaLabel?: string;
}

export interface PageContext {
  app: string;
  screen: string;
  url: string;
  title: string;
  interactiveElements: InteractiveElement[];
  breadcrumbs?: string[];
  visibleText?: string;
}

// ─── App Registry ───────────────────────────────────────────────────────────

interface AppRegistryEntry {
  name: string;
  urlPatterns: RegExp[];
  domFingerprints: Array<{ selector: string; minCount?: number }>;
  detectScreen: (url: string, doc: Document) => string | null;
}

const APP_REGISTRY: AppRegistryEntry[] = [
  {
    name: 'salesforce',
    urlPatterns: [/\.salesforce\.com/, /\.force\.com/, /\.lightning\.force\.com/],
    domFingerprints: [
      { selector: "lightning-formatted-text, lightning-icon, lightning-button, .slds-scope, [class*='slds-']", minCount: 1 },
    ],
    detectScreen(url) {
      if (/\/lightning\/r\/Lead\/[^/]+\/view/.test(url)) return 'lead-detail';
      if (/\/lightning\/o\/Lead\/list/.test(url)) return 'lead-list';
      if (/\/lightning\/r\/Opportunity\/[^/]+\/view/.test(url)) return 'opportunity-detail';
      if (/\/lightning\/o\/Opportunity\/list/.test(url)) return 'opportunity-list';
      if (/\/lightning\/r\/Contact\/[^/]+\/view/.test(url)) return 'contact-detail';
      if (/\/lightning\/r\/Account\/[^/]+\/view/.test(url)) return 'account-detail';
      if (/\/lightning\/o\/[A-Za-z]+\/list/.test(url)) return 'object-list';
      if (/\/lightning\/setup\//.test(url)) return 'setup';
      if (/\/lightning\/page\/home/.test(url)) return 'home';
      return 'unknown-salesforce';
    },
  },
  {
    name: 'hubspot',
    urlPatterns: [/app\.hubspot\.com/, /\.hubspot\.com/],
    domFingerprints: [
      { selector: "[data-global-nav], #hs-nav-v4, .private-page__body, [data-selenium-test]", minCount: 1 },
    ],
    detectScreen(url) {
      if (/\/contacts\/\d+\/contact\//.test(url)) return 'contact-detail';
      if (/\/contacts\/list\//.test(url)) return 'contacts-list';
      if (/\/deals\/\d+\/deal\//.test(url)) return 'deal-detail';
      if (/\/deals\/board/.test(url)) return 'deals-board';
      if (/\/reports\/dashboard/.test(url)) return 'dashboard';
      return 'unknown-hubspot';
    },
  },
  {
    name: 'jira',
    urlPatterns: [/\.atlassian\.net\/jira/, /\.atlassian\.net\/browse/, /\.atlassian\.net\/board/],
    domFingerprints: [
      { selector: "[data-testid*='jira'], #jira, #ak-main-content", minCount: 1 },
    ],
    detectScreen(url) {
      if (/\/browse\/[A-Z]+-\d+/.test(url)) return 'issue-detail';
      if (/\/board/.test(url)) return 'board';
      if (/\/backlog/.test(url)) return 'backlog';
      return 'unknown-jira';
    },
  },
  {
    name: 'zendesk',
    urlPatterns: [/\.zendesk\.com/],
    domFingerprints: [
      { selector: "[data-garden-version], #main_navigation", minCount: 1 },
    ],
    detectScreen(url) {
      if (/\/agent\/tickets\/\d+/.test(url)) return 'ticket-detail';
      if (/\/agent\/tickets/.test(url)) return 'tickets-list';
      if (/\/agent\/dashboard/.test(url)) return 'dashboard';
      return 'unknown-zendesk';
    },
  },
  {
    name: 'notion',
    urlPatterns: [/notion\.so/, /notion\.site/],
    domFingerprints: [
      { selector: ".notion-page-content, .notion-frame, [data-block-id]", minCount: 1 },
    ],
    detectScreen(url) {
      if (/\/database\//.test(url)) return 'database';
      return 'page';
    },
  },
];

// ─── Detection ──────────────────────────────────────────────────────────────

export function detectApp(
  url: string,
  doc: Document,
): { app: string; screen: string } {
  for (const entry of APP_REGISTRY) {
    const urlMatches = entry.urlPatterns.some((re) => re.test(url));
    if (!urlMatches) continue;

    const domMatches = entry.domFingerprints.every(({ selector, minCount = 1 }) => {
      try {
        return doc.querySelectorAll(selector).length >= minCount;
      } catch {
        return false;
      }
    });

    if (domMatches) {
      const screen = entry.detectScreen(url, doc) ?? 'unknown';
      return { app: entry.name, screen };
    }

    // URL matched but DOM didn't — still return app name
    const screen = entry.detectScreen(url, doc) ?? 'unknown';
    return { app: entry.name, screen };
  }

  return { app: 'unknown', screen: hostnameScreenFromUrl(url) };
}

function hostnameScreenFromUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (
      parsed.protocol === 'chrome-extension:' ||
      parsed.protocol === 'data:' ||
      parsed.protocol === 'javascript:'
    ) {
      return 'internal';
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';

    const slug = segments
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return slug.slice(0, 60) || 'home';
  } catch {
    return 'unknown';
  }
}

// ─── Interactive Element Inventory ──────────────────────────────────────────

const INTERACTIVE_SELECTORS =
  'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="combobox"], [role="menuitem"]';

export function buildInteractiveElementInventory(
  doc: Document,
  limit = 50,
): InteractiveElement[] {
  const elements = Array.from(doc.querySelectorAll(INTERACTIVE_SELECTORS));
  const results: InteractiveElement[] = [];

  for (const el of elements) {
    if (results.length >= limit) break;
    if (!isVisible(el)) continue;

    // Skip elements owned by the SDK overlay
    if ((el as HTMLElement).getAttribute?.('data-tribora-sdk') === 'true') continue;

    const type = deriveType(el);
    const label = deriveLabel(el);
    const ariaLabel = el.getAttribute('aria-label') ?? undefined;
    const selector = getStableSelector(el);

    const item: InteractiveElement = { selector, label, type };
    if (ariaLabel) item.ariaLabel = ariaLabel;
    results.push(item);
  }

  return results;
}

// ─── Visible Text Extraction ────────────────────────────────────────────────

function extractVisibleText(doc: Document, maxChars = 2000): string {
  const body = doc.body;
  if (!body) return '';
  const text = (body as HTMLElement).innerText ?? body.textContent ?? '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

// ─── Breadcrumb Extraction ──────────────────────────────────────────────────

function extractBreadcrumbs(doc: Document): string[] | undefined {
  const nav =
    doc.querySelector('[aria-label="breadcrumb"]') ??
    doc.querySelector("nav.breadcrumb, nav[class*='breadcrumb'], ol.breadcrumb, ul.breadcrumb, .breadcrumbs");

  if (!nav) return undefined;

  const seen = new Set<string>();
  const items: string[] = [];
  for (const el of Array.from(nav.querySelectorAll('li, [aria-current], a, span'))) {
    const label = ((el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    items.push(label);
  }

  return items.length > 0 ? items : undefined;
}

// ─── Full Page Context Builder ──────────────────────────────────────────────

export function buildPageContext(): PageContext {
  const url = window.location.href;
  const title = document.title;
  const { app, screen } = detectApp(url, document);
  const interactiveElements = buildInteractiveElementInventory(document);
  const breadcrumbs = extractBreadcrumbs(document);
  const visibleText = extractVisibleText(document);

  const ctx: PageContext = {
    app,
    screen,
    url,
    title,
    interactiveElements,
  };

  if (breadcrumbs) ctx.breadcrumbs = breadcrumbs;
  if (visibleText) ctx.visibleText = visibleText;

  return ctx;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  )
    return false;
  return true;
}

function deriveType(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');

  if (role === 'button' || role === 'menuitem') return 'button';
  if (role === 'link') return 'link';
  if (role === 'combobox') return 'select';

  switch (tag) {
    case 'button':
      return 'button';
    case 'input': {
      const inputType = (el as HTMLInputElement).type ?? 'text';
      if (['submit', 'button', 'reset'].includes(inputType)) return 'button';
      return 'input';
    }
    case 'select':
      return 'select';
    case 'textarea':
      return 'input';
    case 'a':
      return 'link';
    default:
      return tag;
  }
}

function deriveLabel(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = el.ownerDocument.getElementById(labelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim();
  }

  const text =
    (el as HTMLElement).innerText?.trim() || el.textContent?.trim();
  if (text) return text.slice(0, 80);

  if (el instanceof HTMLInputElement) {
    if (el.placeholder) return el.placeholder;
    if (el.name) return el.name;
  }

  const title = el.getAttribute('title');
  if (title) return title;

  return '';
}

/**
 * Stable CSS selector generation — ported from extension selector.ts.
 * Priority: data-* > name > aria-label > id > nth-child path.
 */
function getStableSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();

  const dataAttrs = ['data-field', 'data-id', 'data-testid', 'data-cy', 'data-qa', 'data-key'];
  for (const attr of dataAttrs) {
    const val = el.getAttribute(attr);
    if (val) return `${tag}[${attr}="${cssEscape(val)}"]`;
  }

  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${cssEscape(name)}"]`;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return `${tag}[aria-label="${cssEscape(ariaLabel)}"]`;

  const id = el.id;
  if (id && !isAutoGeneratedId(id)) return `#${cssEscape(id)}`;

  return buildNthChildPath(el);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Fallback for environments without CSS.escape
  return value.replace(/([^\w-])/g, '\\$1');
}

function isAutoGeneratedId(id: string): boolean {
  return /[\d]{2,}/.test(id) || /^[a-f0-9]{8}-/.test(id);
}

function buildNthChildPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < 5) {
    const part = getNthChildSegment(current);
    parts.unshift(part);

    const anchorAttr =
      current.id && !isAutoGeneratedId(current.id)
        ? `#${cssEscape(current.id)}`
        : null;
    if (anchorAttr && depth > 0) {
      parts[0] = anchorAttr;
      break;
    }

    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

function getNthChildSegment(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter(
    (c) => c.tagName === el.tagName,
  );
  if (siblings.length === 1) return tag;

  const index = siblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${index})`;
}
