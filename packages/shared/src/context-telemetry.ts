import type { KnowledgeResolvedFor, PageContext } from './types';

export interface SanitizedPageContextLocation {
  host: string;
  path: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeIdentityText(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function takeUnique(
  values: Array<string | null | undefined>,
  limit = 4,
): string[] {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || unique.has(normalized)) continue;
    unique.add(normalized);
    if (unique.size >= limit) break;
  }

  return Array.from(unique);
}

export function sanitizePageContextLocation(
  url: string,
): SanitizedPageContextLocation {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host.toLowerCase(),
      path: parsed.pathname || '/',
    };
  } catch {
    return {
      host: 'unknown',
      path: '/',
    };
  }
}

export function buildContextSemanticFingerprint(context: PageContext): string {
  const location = sanitizePageContextLocation(context.url);

  const currentNav = takeUnique(
    (context.navigation ?? []).flatMap((__item, __index, __array) =>
      __item.current ? [`${__item.kind}:${__item.label}`] : [],
    ),
    4,
  );

  const workspaceItems = takeUnique(
    (context.workspaceContext?.items ?? []).map(
      (item) => `${item.kind}:${item.value}`,
    ),
    4,
  );

  const dialogTitles = takeUnique(
    (context.dialogs ?? []).flatMap((dialog) => [
      dialog.title,
      ...dialog.actionLabels.map((label) => `action:${label}`),
    ]),
    6,
  );

  const primaryActions = takeUnique(
    (context.primaryActions ?? []).map((action) => action.label),
    4,
  );

  const forms = takeUnique(
    (context.forms ?? []).map((form) =>
      [form.label, ...form.fields.slice(0, 3).map((field) => field.label)]
        .filter(Boolean)
        .join(':'),
    ),
    4,
  );

  const tables = takeUnique(
    (context.tables ?? []).map((table) =>
      [table.label, ...table.columns.slice(0, 3)].filter(Boolean).join(':'),
    ),
    4,
  );

  const regions = takeUnique(
    (context.regions ?? []).map((region) =>
      [region.kind, region.label, region.interactiveCount].join(':'),
    ),
    6,
  );

  const snippets = takeUnique(
    (context.snippets ?? []).map((snippet) =>
      [snippet.kind, snippet.text].join(':'),
    ),
    6,
  );

  const breadcrumbs = takeUnique(context.breadcrumbs ?? [], 4);
  const headings = takeUnique(
    (context.headings ?? []).map((heading) => heading.text),
    3,
  );

  return [
    location.host,
    location.path,
    normalizeText(context.appSignature ?? `${context.app}:${context.screen}`),
    normalizeText(context.title),
    normalizeText(context.selectedEntity?.title),
    normalizeText(context.pageSummary),
    breadcrumbs.join('>'),
    currentNav.join('|'),
    workspaceItems.join('|'),
    dialogTitles.join('|'),
    primaryActions.join('|'),
    forms.join('|'),
    tables.join('|'),
    regions.join('|'),
    snippets.join('|'),
    headings.join('|'),
  ].join('||');
}

export function buildKnowledgeResolvedFor(
  context: Pick<PageContext, 'app' | 'screen' | 'appSignature' | 'url'>,
): KnowledgeResolvedFor {
  const location = sanitizePageContextLocation(context.url);
  const app = normalizeIdentityText(context.app) || 'unknown';
  const screen = normalizeIdentityText(context.screen) || 'unknown';

  return {
    app,
    screen,
    appSignature:
      normalizeIdentityText(context.appSignature) || `${app}:${screen}`,
    host: location.host,
    path: location.path,
  };
}

export function knowledgeResolvedForEquals(
  left: KnowledgeResolvedFor | null | undefined,
  right: KnowledgeResolvedFor | null | undefined,
): boolean {
  if (!left || !right) return false;

  return (
    left.app === right.app &&
    left.screen === right.screen &&
    left.appSignature === right.appSignature &&
    left.host === right.host &&
    left.path === right.path
  );
}

export function knowledgeResolvedForContextMatches(
  resolvedFor: KnowledgeResolvedFor | null | undefined,
  context: Pick<PageContext, 'app' | 'screen' | 'appSignature' | 'url'>,
): boolean {
  return knowledgeResolvedForEquals(
    resolvedFor,
    buildKnowledgeResolvedFor(context),
  );
}
