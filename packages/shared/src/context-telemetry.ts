import type { PageContext } from './types.js';

export interface SanitizedPageContextLocation {
  host: string;
  path: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
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
    (context.navigation ?? [])
      .filter((item) => item.current)
      .map((item) => `${item.kind}:${item.label}`),
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
    headings.join('|'),
  ].join('||');
}
