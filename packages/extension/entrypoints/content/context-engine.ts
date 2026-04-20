/**
 * context-engine.ts — answers "what is the user looking at right now?"
 *
 * Builds a universal semantic context pack for the current page:
 * - vendor/app detection with confidence scoring
 * - structured surfaces such as navigation, dialogs, forms, and tables
 * - ranked interactive elements derived from those surfaces
 *
 * Output matches the PageContext interface in @tribora/shared.
 */

import type {
  ContextHeading,
  DetectionConfidence,
  DialogSurface,
  FormField,
  FormSurface,
  InteractiveElement,
  InteractiveGroup,
  NavigationItem,
  PageAction,
  PageContext,
  SelectedEntity,
  SurfaceKind,
  TableSurface,
  WorkspaceContext,
  WorkspaceContextItem,
} from '@tribora/shared';

import { getStableSelector } from './selector';

export interface AppRegistryEntry {
  name: string;
  hostPatterns: RegExp[];
  urlPatterns: RegExp[];
  domFingerprints: Array<{ selector: string; minCount?: number }>;
  detectScreen: (url: string, doc: Document) => string | null;
}

type DetectedApp = {
  app: string;
  screen: string;
  appVersion?: string;
  detectionConfidence: DetectionConfidence;
};

type InteractiveDescriptor = InteractiveElement & {
  priority: number;
  group: InteractiveGroup;
  surface: SurfaceKind;
};

const APP_REGISTRY: AppRegistryEntry[] = [
  {
    name: 'salesforce',
    hostPatterns: [
      /(?:^|\.)salesforce\.com$/i,
      /(?:^|\.)force\.com$/i,
      /(?:^|\.)lightning\.force\.com$/i,
    ],
    urlPatterns: [/\/lightning\//i],
    domFingerprints: [
      {
        selector:
          "lightning-formatted-text, lightning-icon, lightning-button, .slds-scope, [class*='slds-']",
        minCount: 1,
      },
    ],
    detectScreen(url, doc) {
      if (/\/lightning\/r\/Lead\/[^/]+\/view/.test(url)) return 'lead-detail';
      if (/\/lightning\/o\/Lead\/list/.test(url)) return 'lead-list';
      if (/\/lightning\/r\/Opportunity\/[^/]+\/view/.test(url))
        return 'opportunity-detail';
      if (/\/lightning\/o\/Opportunity\/list/.test(url))
        return 'opportunity-list';
      if (/\/lightning\/setup\//.test(url)) return 'setup';
      if (/\/lightning\/r\/Dashboard\//.test(url)) return 'dashboard';
      if (/\/lightning\/r\/Report\//.test(url)) return 'reports';
      if (/\/lightning\/page\/home/.test(url)) return 'home';
      if (doc.title.toLowerCase().includes('dashboard')) return 'dashboard';
      return 'unknown-salesforce';
    },
  },
  {
    name: 'hubspot',
    hostPatterns: [/app\.hubspot\.com$/i, /(?:^|\.)hubspot\.com$/i],
    urlPatterns: [/\/contacts\//i, /\/deals\//i, /\/reports\//i],
    domFingerprints: [
      {
        selector:
          '[data-global-nav], #hs-nav-v4, .private-page__body, [data-selenium-test]',
        minCount: 1,
      },
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
    hostPatterns: [/\.atlassian\.net$/i],
    urlPatterns: [/\/jira\//i, /\/browse\//i, /\/board/i],
    domFingerprints: [
      {
        selector:
          "[data-testid*='jira'], #jira, #ak-main-content, [data-ds--page-layout--slot]",
        minCount: 1,
      },
    ],
    detectScreen(url) {
      if (/\/browse\/[A-Z]+-\d+/.test(url)) return 'issue-detail';
      if (/\/board/.test(url)) return 'board';
      if (/\/backlog/.test(url)) return 'backlog';
      if (/\/roadmap/.test(url)) return 'roadmap';
      return 'unknown-jira';
    },
  },
  {
    name: 'zendesk',
    hostPatterns: [/\.zendesk\.com$/i],
    urlPatterns: [/\/agent\//i],
    domFingerprints: [
      {
        selector:
          "[data-garden-version], .u-posAbsolute, #main_navigation, [data-test-id*='zen']",
        minCount: 1,
      },
    ],
    detectScreen(url) {
      if (/\/agent\/tickets\/\d+/.test(url)) return 'ticket-detail';
      if (/\/agent\/tickets/.test(url)) return 'tickets-list';
      if (/\/agent\/dashboard/.test(url) || /\/agent\/?$/.test(url))
        return 'dashboard';
      return 'unknown-zendesk';
    },
  },
  {
    name: 'notion',
    hostPatterns: [/notion\.so$/i, /notion\.site$/i],
    urlPatterns: [/\/[a-f0-9]{32}/i, /\/database\//i],
    domFingerprints: [
      {
        selector:
          '.notion-page-content, .notion-frame, [data-block-id], .notion-sidebar-container',
        minCount: 1,
      },
    ],
    detectScreen(url) {
      if (/\/database\//.test(url)) return 'database';
      if (/\/search/.test(url)) return 'search';
      return 'page';
    },
  },
  {
    name: 'supabase',
    hostPatterns: [/supabase\.com$/i],
    urlPatterns: [/\/dashboard\//i],
    domFingerprints: [
      {
        selector:
          "[href*='/dashboard/project/'], [data-testid*='sidebar'], nav a[href*='/dashboard/project/']",
        minCount: 1,
      },
    ],
    detectScreen(url, doc) {
      if (/\/dashboard\/project\/[^/]+\/database\/settings/.test(url)) {
        return 'database-settings';
      }
      if (/\/dashboard\/project\/[^/]+\/database\/tables/.test(url)) {
        return 'table-editor';
      }
      if (/\/dashboard\/project\/[^/]+\/sql/.test(url)) return 'sql-editor';
      if (/\/dashboard\/project\/[^/]+\/auth/.test(url))
        return 'authentication';
      if (/\/dashboard\/project\/[^/]+\/storage/.test(url)) return 'storage';
      if (/\/dashboard\/project\/[^/]+\/functions/.test(url)) {
        return 'edge-functions';
      }
      if (/\/dashboard\/project\/[^/]+\/settings/.test(url))
        return 'project-settings';
      if (doc.title.toLowerCase().includes('database')) return 'database';
      return 'project-overview';
    },
  },
];

const INTERACTIVE_SELECTORS =
  'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="combobox"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"]';

const NAVIGATION_CONTAINERS =
  'nav, aside, [role="navigation"], [data-testid*="sidebar"], [class*="sidebar"], [class*="nav"], [role="tablist"]';

const DIALOG_SELECTORS = '[role="dialog"], [aria-modal="true"], dialog[open]';

const WORKSPACE_PATTERNS: Array<{
  kind: WorkspaceContextItem['kind'];
  pattern: RegExp;
}> = [
  { kind: 'workspace', pattern: /\bworkspace\b/i },
  { kind: 'project', pattern: /\bproject\b/i },
  { kind: 'environment', pattern: /\benvironment\b|\bbranch\b/i },
  { kind: 'account', pattern: /\baccount\b|\borg(?:anization)?\b|\bteam\b/i },
];

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function singularizeLabel(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (/ies$/i.test(normalized)) return normalized.replace(/ies$/i, 'y');
  if (/ses$/i.test(normalized)) return normalized.replace(/es$/i, '');
  if (/s$/i.test(normalized) && !/ss$/i.test(normalized)) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isDisabled(el: Element): boolean {
  return (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  );
}

function isCurrentNavItem(el: Element): boolean {
  const ariaCurrent = el.getAttribute('aria-current');
  if (ariaCurrent && ariaCurrent !== 'false') return true;
  const className = (el.getAttribute('class') ?? '').toLowerCase();
  return /(current|active|selected)/.test(className);
}

function deriveLabel(el: Element): string {
  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = el.ownerDocument.getElementById(labelledBy);
    const label = normalizeText(labelEl?.textContent);
    if (label) return label;
  }

  if (el.getAttribute('role') === 'checkbox') {
    const checkboxLabel = deriveCheckboxLabel(el);
    if (checkboxLabel) return checkboxLabel;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      const checkboxLabel = deriveCheckboxLabel(el);
      if (checkboxLabel) return checkboxLabel;
    }
    if (el.labels?.length) {
      const label = normalizeText(el.labels[0]?.textContent);
      if (label) return label;
    }
    const placeholder = normalizeText(el.placeholder);
    if (placeholder) return placeholder;
    const name = normalizeText(el.name);
    if (name) return name;
    const value = normalizeText(el.value);
    if (value) return value.slice(0, 80);
  }

  const text = normalizeText((el as HTMLElement).innerText || el.textContent);
  if (text) return text.slice(0, 120);

  const title = normalizeText(el.getAttribute('title'));
  if (title) return title;

  return '';
}

function getTableLikeAncestor(el: Element): Element | null {
  return el.closest('table, [role="table"], [role="grid"]');
}

function getTableLabel(table: Element): string {
  return (
    normalizeText(table.getAttribute('aria-label')) ||
    normalizeText(
      (table.previousElementSibling as HTMLElement | null)?.innerText,
    ) ||
    normalizeText(
      (
        table
          .closest('section, main, article, div')
          ?.querySelector('h1, h2, h3, h4') as HTMLElement | null
      )?.innerText,
    )
  );
}

function getRowLikeAncestor(el: Element): Element | null {
  return el.closest('tr, [role="row"]');
}

function isHeaderRow(row: Element | null): boolean {
  if (!row) return false;
  if (row.closest('thead')) return true;
  return Array.from(row.children).some((child) => {
    const role = child.getAttribute?.('role');
    return child.tagName.toLowerCase() === 'th' || role === 'columnheader';
  });
}

function derivePrimaryRowLabel(row: Element): string {
  const candidates = Array.from(
    row.querySelectorAll(
      'a[href], [role="link"], td, th, [role="cell"], [role="rowheader"]',
    ),
  );

  for (const candidate of candidates) {
    if (!isVisible(candidate)) continue;
    if (
      candidate instanceof HTMLInputElement &&
      ['checkbox', 'radio', 'button'].includes(candidate.type)
    ) {
      continue;
    }
    const text = normalizeText(
      (candidate as HTMLElement).innerText || candidate.textContent,
    );
    if (!text) continue;
    if (text.length > 120) continue;
    return text;
  }

  return '';
}

function deriveCheckboxLabel(el: Element): string {
  const table = getTableLikeAncestor(el);
  if (!table) return '';

  const tableLabel = getTableLabel(table);
  const row = getRowLikeAncestor(el);

  if (isHeaderRow(row)) {
    return tableLabel
      ? `Select all ${tableLabel.toLowerCase()}`
      : 'Select all rows';
  }

  const rowLabel = row ? derivePrimaryRowLabel(row) : '';
  if (rowLabel) {
    const singular = singularizeLabel(tableLabel);
    if (singular) {
      return `Select ${singular.toLowerCase()} ${rowLabel}`;
    }
    return `Select row ${rowLabel}`;
  }

  if (tableLabel) {
    const singular = singularizeLabel(tableLabel);
    return singular
      ? `Select ${singular.toLowerCase()}`
      : `Select from ${tableLabel.toLowerCase()}`;
  }

  return 'Select row';
}

function deriveType(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');

  if (role === 'button' || role === 'menuitem') return 'button';
  if (role === 'link') return 'link';
  if (role === 'combobox' || role === 'option') return 'select';
  if (role === 'tab') return 'tab';
  if (role === 'checkbox') return 'checkbox';
  if (role === 'radio') return 'radio';

  switch (tag) {
    case 'button':
      return 'button';
    case 'input': {
      const inputType = (el as HTMLInputElement).type ?? 'text';
      if (['submit', 'button', 'reset', 'image'].includes(inputType)) {
        return 'button';
      }
      if (inputType === 'checkbox') return 'checkbox';
      if (inputType === 'radio') return 'radio';
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

function hostnameScreenFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      [
        'chrome-extension:',
        'devtools:',
        'view-source:',
        'data:',
        'javascript:',
      ].includes(parsed.protocol)
    ) {
      return 'internal';
    }
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'edge:') {
      return `${parsed.protocol.replace(':', '')}-${parsed.hostname || 'home'}`;
    }
    if (parsed.protocol === 'about:') {
      return parsed.pathname || 'blank';
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';
    return toKebabCase(segments.join('-')).slice(0, 60) || 'home';
  } catch {
    return 'unknown';
  }
}

export function extractBreadcrumbs(doc: Document): string[] | undefined {
  const nav =
    doc.querySelector('[aria-label="breadcrumb"], [aria-label="Breadcrumb"]') ??
    doc.querySelector(
      "nav.breadcrumb, nav[class*='breadcrumb'], ol.breadcrumb, ul.breadcrumb, .breadcrumbs, [data-testid*='breadcrumb']",
    );

  if (!nav) return undefined;

  const items = uniqueBy(
    Array.from(nav.querySelectorAll('li, [aria-current], a, span'))
      .map((el) =>
        normalizeText((el as HTMLElement).innerText || el.textContent),
      )
      .filter(Boolean),
    (label) => label,
  );

  return items.length > 0 ? items : undefined;
}

export function extractVisibleText(doc: Document, maxChars = 2000): string {
  const body = doc.body;
  if (!body) return '';
  const text = normalizeText(
    (body as HTMLElement).innerText || body.textContent,
  );
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function inferGenericScreen(
  url: string,
  doc: Document,
  breadcrumbs: string[] | undefined,
  headings: ContextHeading[],
): { screen: string; confidence: number } {
  const currentBreadcrumb = breadcrumbs?.[breadcrumbs.length - 1];
  if (currentBreadcrumb) {
    return {
      screen: toKebabCase(currentBreadcrumb) || hostnameScreenFromUrl(url),
      confidence: 0.7,
    };
  }

  const h1 = headings.find((heading) => heading.level === 1)?.text;
  if (h1) {
    return {
      screen: toKebabCase(h1) || hostnameScreenFromUrl(url),
      confidence: 0.62,
    };
  }

  return { screen: hostnameScreenFromUrl(url), confidence: 0.35 };
}

function buildDetectionConfidence(
  appConfidence: number,
  screenConfidence: number,
): DetectionConfidence {
  return {
    app: clamp(appConfidence, 0, 1),
    screen: clamp(screenConfidence, 0, 1),
    overall: clamp((appConfidence + screenConfidence) / 2, 0, 1),
  };
}

const GENERIC_HOST_SEGMENTS = new Set([
  'www',
  'app',
  'dashboard',
  'admin',
  'beta',
  'dev',
  'prod',
  'production',
  'staging',
  'mail',
  'docs',
  'help',
  'support',
  'localhost',
]);

function inferGenericAppFromHostname(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    ) {
      return null;
    }

    const parts = hostname.split('.').filter(Boolean);
    for (let index = parts.length - 2; index >= 0; index -= 1) {
      const part = parts[index] ?? '';
      if (!part || GENERIC_HOST_SEGMENTS.has(part)) continue;
      return toKebabCase(part);
    }
  } catch {
    return null;
  }

  return null;
}

export function detectApp(url: string, doc: Document): DetectedApp {
  const breadcrumbs = extractBreadcrumbs(doc);
  const headings = extractHeadings(doc);

  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = '';
  }

  for (const entry of APP_REGISTRY) {
    const hostMatches = entry.hostPatterns.some((pattern) =>
      pattern.test(host),
    );
    const urlMatches = entry.urlPatterns.some((pattern) => pattern.test(url));
    if (!hostMatches && !urlMatches) continue;

    const fingerprintMatches = entry.domFingerprints.every(
      ({ selector, minCount = 1 }) => {
        try {
          return doc.querySelectorAll(selector).length >= minCount;
        } catch {
          return false;
        }
      },
    );

    if (!hostMatches && !fingerprintMatches) {
      continue;
    }

    const screen = entry.detectScreen(url, doc) ?? 'unknown';
    const screenConfidence = screen.startsWith('unknown-') ? 0.52 : 0.92;

    if (fingerprintMatches) {
      return {
        app: entry.name,
        screen,
        detectionConfidence: buildDetectionConfidence(0.96, screenConfidence),
      };
    }

    return {
      app: entry.name,
      screen,
      detectionConfidence: buildDetectionConfidence(
        0.88,
        Math.max(0.82, screenConfidence - 0.04),
      ),
    };
  }

  const inferred = inferGenericScreen(url, doc, breadcrumbs, headings);
  const genericApp = inferGenericAppFromHostname(url);
  return {
    app: genericApp ?? 'unknown',
    screen: inferred.screen,
    detectionConfidence: buildDetectionConfidence(
      genericApp ? 0.48 : 0.2,
      inferred.confidence,
    ),
  };
}

function extractHeadings(doc: Document): ContextHeading[] {
  return uniqueBy(
    Array.from(doc.querySelectorAll('h1, h2, h3'))
      .filter(isVisible)
      .map((el) => {
        const text = normalizeText(
          (el as HTMLElement).innerText || el.textContent,
        );
        if (!text) return null;
        const level = Number(el.tagName.slice(1));
        return {
          level,
          text,
          selector: getStableSelector(el),
        } satisfies ContextHeading;
      })
      .filter(Boolean) as ContextHeading[],
    (heading) => `${heading.level}:${heading.text}`,
  ).slice(0, 8);
}

function classifyNavigationKind(container: Element): NavigationItem['kind'] {
  const ariaLabel = normalizeText(
    container.getAttribute('aria-label'),
  ).toLowerCase();
  const className = normalizeText(
    container.getAttribute('class'),
  ).toLowerCase();
  if (ariaLabel.includes('breadcrumb') || className.includes('breadcrumb')) {
    return 'breadcrumb';
  }
  if (
    container.getAttribute('role') === 'tablist' ||
    className.includes('tab')
  ) {
    return 'tab';
  }
  if (
    container.tagName.toLowerCase() === 'aside' ||
    className.includes('sidebar')
  ) {
    return 'sidebar';
  }
  return 'topbar';
}

function extractNavigation(doc: Document): NavigationItem[] {
  const breadcrumbItems: NavigationItem[] =
    extractBreadcrumbs(doc)?.map((label, index, items) => ({
      label,
      selector: undefined,
      kind: 'breadcrumb',
      current: index === items.length - 1,
    })) ?? [];

  const navItems = Array.from(
    doc.querySelectorAll(NAVIGATION_CONTAINERS),
  ).flatMap((container) => {
    const kind = classifyNavigationKind(container);
    return Array.from(
      container.querySelectorAll(
        'a[href], button, [role="link"], [role="button"], [role="tab"]',
      ),
    )
      .filter(isVisible)
      .map((el) => {
        const label = deriveLabel(el);
        if (!label || label.length > 80) return null;
        return {
          label,
          selector: getStableSelector(el),
          current: isCurrentNavItem(el),
          kind,
        } satisfies NavigationItem;
      })
      .filter(Boolean) as NavigationItem[];
  });

  return uniqueBy(
    [...breadcrumbItems, ...navItems],
    (item) => `${item.kind}:${item.label}:${item.selector ?? ''}`,
  ).slice(0, 16);
}

function detectWorkspaceKind(
  label: string,
): WorkspaceContextItem['kind'] | null {
  const normalized = label.toLowerCase();
  for (const entry of WORKSPACE_PATTERNS) {
    if (entry.pattern.test(normalized)) return entry.kind;
  }
  return null;
}

function extractWorkspaceContext(doc: Document): WorkspaceContext | undefined {
  const items: WorkspaceContextItem[] = [];
  const selectors =
    'header button, header a[href], nav button, nav a[href], aside button, aside a[href], [aria-label], [title]';

  for (const el of Array.from(doc.querySelectorAll(selectors))) {
    if (!isVisible(el)) continue;

    const aria = normalizeText(el.getAttribute('aria-label'));
    const title = normalizeText(el.getAttribute('title'));
    const label = aria || title;
    const kind = detectWorkspaceKind(label);
    if (kind && label) {
      const visibleValue = normalizeText(
        (el as HTMLElement).innerText || el.textContent,
      );
      const value =
        visibleValue ||
        normalizeText(
          label.replace(
            /\b(current|workspace|project|account|organization|team|environment|branch)\b/gi,
            '',
          ),
        );
      if (!value) continue;
      items.push({
        kind,
        value,
        selector: getStableSelector(el),
      });
      continue;
    }

    const text = deriveLabel(el);
    if (!text || text.length > 40) continue;
    const parentHeader = el.closest('header, nav, aside');
    if (!parentHeader) continue;
    if (
      (el.tagName.toLowerCase() === 'button' ||
        el.getAttribute('role') === 'button') &&
      !/\b(help|support|privacy|terms|connect|save|delete|cancel|close|reset|create|new)\b/i.test(
        text,
      )
    ) {
      const inferredKind = items.some((item) => item.kind === 'workspace')
        ? items.some((item) => item.kind === 'project')
          ? 'environment'
          : 'project'
        : 'workspace';
      items.push({
        kind: inferredKind,
        value: text,
        selector: getStableSelector(el),
      });
    }
  }

  const deduped = uniqueBy(items, (item) => `${item.kind}:${item.value}`);
  return deduped.length > 0 ? { items: deduped.slice(0, 4) } : undefined;
}

function extractDialogs(doc: Document): DialogSurface[] {
  return uniqueBy(
    Array.from(doc.querySelectorAll(DIALOG_SELECTORS))
      .filter(isVisible)
      .map((el) => {
        const titleEl = el.querySelector('h1, h2, h3');
        const title =
          normalizeText(
            (titleEl as HTMLElement | null)?.textContent ??
              el.getAttribute('aria-label'),
          ) || undefined;
        const description =
          normalizeText(
            (el.querySelector('p, [data-description]') as HTMLElement | null)
              ?.textContent,
          ) || undefined;
        const actionLabels = uniqueBy(
          Array.from(el.querySelectorAll('button, a[href], [role="button"]'))
            .filter(isVisible)
            .map((action) => deriveLabel(action))
            .filter(Boolean),
          (label) => label,
        );

        return {
          title,
          selector: getStableSelector(el),
          description,
          actionLabels,
        } satisfies DialogSurface;
      }),
    (dialog) => dialog.selector,
  );
}

function extractSelectedEntity(args: {
  title: string;
  headings: ContextHeading[];
  breadcrumbs: string[] | undefined;
  dialogs: DialogSurface[];
}): SelectedEntity | undefined {
  if (args.dialogs[0]?.title) {
    return {
      title: args.dialogs[0].title,
      subtitle: args.dialogs[0].description,
      kind: 'dialog',
    };
  }

  const h1 = args.headings.find((heading) => heading.level === 1)?.text;
  if (h1) {
    return {
      title: h1,
      subtitle: args.breadcrumbs?.slice(0, -1).join(' > ') || undefined,
      kind: 'page',
    };
  }

  if (args.breadcrumbs?.length) {
    return {
      title: args.breadcrumbs[args.breadcrumbs.length - 1],
      subtitle: args.breadcrumbs.slice(0, -1).join(' > ') || undefined,
      kind: 'breadcrumb',
    };
  }

  if (args.title) {
    return { title: args.title, kind: 'document' };
  }

  return undefined;
}

function deriveFieldLabel(field: Element): string {
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    if (field.labels?.length) {
      const label = normalizeText(field.labels[0]?.textContent);
      if (label) return label;
    }
  }
  return deriveLabel(field);
}

function extractForms(doc: Document): FormSurface[] {
  const containers = Array.from(
    doc.querySelectorAll('form, fieldset, [role="form"]'),
  );
  if (containers.length === 0) {
    const fallbackFields = Array.from(
      doc.querySelectorAll('input:not([type="hidden"]), select, textarea'),
    );
    if (fallbackFields.length === 0) return [];
    containers.push(doc.body);
  }

  return uniqueBy(
    containers
      .map((container) => {
        const fields = uniqueBy(
          Array.from(
            container.querySelectorAll(
              'input:not([type="hidden"]), select, textarea',
            ),
          )
            .filter(isVisible)
            .map((field) => {
              const label = deriveFieldLabel(field);
              if (!label) return null;
              return {
                label,
                selector: getStableSelector(field),
                type: deriveType(field),
                required:
                  field.hasAttribute('required') ||
                  field.getAttribute('aria-required') === 'true',
              } satisfies FormField;
            })
            .filter(Boolean) as FormField[],
          (field) => field.selector,
        );

        if (fields.length === 0) return null;

        const label =
          normalizeText(container.getAttribute('aria-label')) ||
          normalizeText(
            (
              container.querySelector(
                'legend, h2, h3, label',
              ) as HTMLElement | null
            )?.innerText,
          ) ||
          undefined;

        return {
          label,
          selector:
            container === doc.body ? undefined : getStableSelector(container),
          fields,
        } satisfies FormSurface;
      })
      .filter(Boolean) as FormSurface[],
    (form) => `${form.selector ?? 'body'}:${form.label ?? ''}`,
  ).slice(0, 6);
}

function extractTables(doc: Document): TableSurface[] {
  return uniqueBy(
    Array.from(doc.querySelectorAll('table, [role="table"], [role="grid"]'))
      .filter(isVisible)
      .map((table) => {
        const columns = uniqueBy(
          Array.from(table.querySelectorAll('th, [role="columnheader"]'))
            .map((header) =>
              normalizeText(
                (header as HTMLElement).innerText || header.textContent,
              ),
            )
            .filter(Boolean),
          (value) => value,
        );
        const rowCount = table.querySelectorAll(
          'tbody tr, [role="row"]',
        ).length;
        if (columns.length === 0 && rowCount === 0) return null;
        const actionLabels = uniqueBy(
          Array.from(table.querySelectorAll('button, a[href], [role="button"]'))
            .filter(isVisible)
            .map((action) => deriveLabel(action))
            .filter(Boolean),
          (value) => value,
        ).slice(0, 6);

        const selectionControls = uniqueBy(
          Array.from(
            table.querySelectorAll('input[type="checkbox"], [role="checkbox"]'),
          )
            .filter(isVisible)
            .map((control) => {
              if (control instanceof HTMLInputElement) {
                return deriveCheckboxLabel(control);
              }
              return deriveLabel(control);
            })
            .filter(Boolean),
          (value) => value,
        ).slice(0, 6);

        const bulkSelectable = Array.from(
          table.querySelectorAll('input[type="checkbox"], [role="checkbox"]'),
        )
          .filter(isVisible)
          .some((control) => isHeaderRow(getRowLikeAncestor(control)));

        return {
          label: getTableLabel(table) || undefined,
          selector: getStableSelector(table),
          columns,
          rowCount,
          actionLabels,
          bulkSelectable,
          selectionLabels: selectionControls,
        } satisfies TableSurface;
      })
      .filter(Boolean) as TableSurface[],
    (table) => table.selector ?? table.label ?? '',
  ).slice(0, 6);
}

function inferSurface(
  el: Element,
  dialogs: DialogSurface[],
  navigation: NavigationItem[],
  workspaceContext: WorkspaceContext | undefined,
  forms: FormSurface[],
  tables: TableSurface[],
): { surface: SurfaceKind; group: InteractiveGroup; roleHint?: string } {
  const selector = getStableSelector(el);
  if (el.closest(DIALOG_SELECTORS)) {
    return { surface: 'dialog', group: 'dialog', roleHint: 'dialog_action' };
  }

  const workspaceItem = workspaceContext?.items.find(
    (item) => item.selector === selector,
  );
  if (workspaceItem) {
    return {
      surface: 'workspace',
      group: 'workspace',
      roleHint: `${workspaceItem.kind}_switcher`,
    };
  }

  const navItem = navigation.find((item) => item.selector === selector);
  if (navItem) {
    return {
      surface: 'navigation',
      group: 'navigation',
      roleHint: navItem.current
        ? 'current_navigation_item'
        : `${navItem.kind}_navigation`,
    };
  }

  if (tables.some((table) => table.selector && el.closest(table.selector))) {
    if (deriveType(el) === 'checkbox') {
      return {
        surface: 'table',
        group: 'table',
        roleHint: isHeaderRow(getRowLikeAncestor(el))
          ? 'table_bulk_selector'
          : 'table_row_selector',
      };
    }
    return { surface: 'table', group: 'table', roleHint: 'table_interaction' };
  }

  if (
    forms.some((form) =>
      form.fields.some((field) => field.selector === selector),
    )
  ) {
    return {
      surface: 'form',
      group: 'form',
      roleHint: deriveType(el) === 'button' ? 'form_action' : 'form_field',
    };
  }

  if (el.closest('header, [role="banner"]')) {
    return {
      surface: 'primary_action',
      group: 'primary_action',
      roleHint: 'header_action',
    };
  }

  return { surface: 'content', group: 'content' };
}

function scoreInteractiveElement(
  el: Element,
  descriptor: { surface: SurfaceKind; roleHint?: string },
): number {
  const type = deriveType(el);
  let score = 38;

  switch (descriptor.surface) {
    case 'dialog':
      score += 48;
      break;
    case 'primary_action':
      score += 34;
      break;
    case 'workspace':
      score += 28;
      break;
    case 'navigation':
      score += 24;
      break;
    case 'form':
      score += 18;
      break;
    case 'table':
      score += 12;
      break;
    default:
      score += 6;
      break;
  }

  if (type === 'button') score += 8;
  if (type === 'input' || type === 'select') score += 5;
  if (type === 'checkbox' && descriptor.surface === 'table') score += 24;
  if (descriptor.roleHint === 'table_bulk_selector') score += 18;
  if (descriptor.roleHint === 'table_row_selector') score += 12;
  if (isCurrentNavItem(el) || el.getAttribute('aria-selected') === 'true')
    score += 10;
  if (
    /\b(delete|confirm|save|connect|continue|start|launch)\b/i.test(
      deriveLabel(el),
    )
  ) {
    score += 7;
  }
  if (/\b(cancel|close|dismiss|back)\b/i.test(deriveLabel(el))) {
    score -= 5;
  }
  if (el.closest('footer')) score -= 26;
  if (/\b(help|support|privacy|terms)\b/i.test(deriveLabel(el))) score -= 14;
  if (isDisabled(el)) score -= 10;
  if (!deriveLabel(el)) score -= 12;

  return clamp(score, 1, 100);
}

export function buildInteractiveElementInventory(
  doc: Document,
  args: {
    dialogs: DialogSurface[];
    navigation: NavigationItem[];
    workspaceContext?: WorkspaceContext;
    forms: FormSurface[];
    tables: TableSurface[];
  },
  limit = 60,
): PageContext['interactiveElements'] {
  const elements = Array.from(doc.querySelectorAll(INTERACTIVE_SELECTORS));

  const ranked = uniqueBy(
    elements.filter(isVisible).map((el) => {
      const label = deriveLabel(el);
      const selector = getStableSelector(el);
      const rect = el.getBoundingClientRect();
      const semantic = inferSurface(
        el,
        args.dialogs,
        args.navigation,
        args.workspaceContext,
        args.forms,
        args.tables,
      );

      const descriptor: InteractiveDescriptor = {
        selector,
        label,
        type: deriveType(el),
        ariaLabel: normalizeText(el.getAttribute('aria-label')) || undefined,
        boundingRect: rect.width > 0 && rect.height > 0 ? rect : undefined,
        priority: scoreInteractiveElement(el, semantic),
        group: semantic.group,
        roleHint: semantic.roleHint,
        surface: semantic.surface,
        selected:
          isCurrentNavItem(el) || el.getAttribute('aria-selected') === 'true',
        disabled: isDisabled(el),
        visible: true,
      };

      return descriptor;
    }),
    (item) => item.selector,
  )
    .sort((left, right) => right.priority - left.priority)
    .slice(0, limit);

  return ranked;
}

function extractPrimaryActions(
  interactiveElements: PageContext['interactiveElements'],
): PageAction[] {
  return interactiveElements
    .filter((item) => {
      if (!item.selector || !item.label) return false;
      if (item.surface === 'dialog') return true;
      return (
        item.group === 'primary_action' ||
        item.group === 'workspace' ||
        (item.type === 'button' && (item.priority ?? 0) >= 70)
      );
    })
    .slice(0, 6)
    .map((item) => ({
      label: item.label,
      selector: item.selector,
      priority: item.priority ?? 0,
      group: item.group ?? 'secondary',
      surface: item.surface ?? 'unknown',
    }));
}

function buildPageSummary(args: {
  title: string;
  selectedEntity?: SelectedEntity;
  breadcrumbs?: string[];
  workspaceContext?: WorkspaceContext;
  primaryActions: PageAction[];
  forms: FormSurface[];
  tables: TableSurface[];
  dialogs: DialogSurface[];
}): string {
  if (args.dialogs[0]) {
    const actionLabels = args.dialogs[0].actionLabels.slice(0, 3).join(', ');
    return `${args.dialogs[0].title ?? 'Dialog'} dialog is open. ${
      actionLabels ? `Primary dialog actions: ${actionLabels}. ` : ''
    }Background page: ${args.selectedEntity?.title ?? args.title}.`.trim();
  }

  const segments = [`${args.selectedEntity?.title ?? args.title} page.`];

  if (args.breadcrumbs?.length) {
    segments.push(`Current location: ${args.breadcrumbs.join(' > ')}.`);
  }

  if (args.workspaceContext?.items.length) {
    segments.push(
      `Workspace context: ${args.workspaceContext.items
        .map((item) => item.value)
        .join(', ')}.`,
    );
  }

  if (args.primaryActions.length) {
    segments.push(
      `Primary actions: ${args.primaryActions
        .slice(0, 3)
        .map((action) => action.label)
        .join(', ')}.`,
    );
  }

  if (args.forms.length || args.tables.length) {
    segments.push(
      `Contains ${args.forms.length} form${args.forms.length === 1 ? '' : 's'} and ${
        args.tables.length
      } table${args.tables.length === 1 ? '' : 's'}.`,
    );
  }

  if (
    args.tables.some(
      (table) =>
        table.bulkSelectable || (table.selectionLabels?.length ?? 0) > 0,
    )
  ) {
    segments.push(
      'Visible tables include selection checkboxes for bulk actions.',
    );
  }

  return segments.join(' ');
}

export function buildPageContext(
  doc: Document = document,
  win: Window = window,
): PageContext {
  const url = win.location.href;
  const title = normalizeText(doc.title);
  const headings = extractHeadings(doc);
  const breadcrumbs = extractBreadcrumbs(doc);
  const detected = detectApp(url, doc);
  const dialogs = extractDialogs(doc);
  const navigation = extractNavigation(doc);
  const workspaceContext = extractWorkspaceContext(doc);
  const forms = extractForms(doc);
  const tables = extractTables(doc);
  const selectedEntity = extractSelectedEntity({
    title,
    headings,
    breadcrumbs,
    dialogs,
  });
  const interactiveElements = buildInteractiveElementInventory(
    doc,
    {
      dialogs,
      navigation,
      workspaceContext,
      forms,
      tables,
    },
    60,
  );
  const primaryActions = extractPrimaryActions(interactiveElements);
  const visibleText = extractVisibleText(doc);
  const pageSummary = buildPageSummary({
    title,
    selectedEntity,
    breadcrumbs,
    workspaceContext,
    primaryActions,
    forms,
    tables,
    dialogs,
  });

  return {
    app: detected.app,
    appVersion: detected.appVersion,
    screen: detected.screen,
    appSignature: `${detected.app}:${detected.screen}`,
    url,
    title,
    interactiveElements,
    detectionConfidence: detected.detectionConfidence,
    pageSummary,
    headings,
    navigation,
    primaryActions,
    selectedEntity,
    workspaceContext,
    forms,
    tables,
    dialogs,
    breadcrumbs,
    visibleText,
  };
}
