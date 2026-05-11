import type {
  ContextHeading,
  ContextRect,
  ContextSnippet,
  DialogSurface,
  FormField,
  FormSurface,
  InteractiveElement,
  KnowledgeAvailability,
  KnowledgeMatch,
  NavigationItem,
  PageAction,
  PageContext,
  PageRegion,
  SelectedEntity,
  TableSurface,
  ViewportSnapshot,
  WorkspaceContext,
  WorkspaceContextItem,
} from './types';

export const PAGE_CONTEXT_SANITIZER_LIMITS = {
  title: 180,
  summary: 500,
  label: 140,
  selector: 220,
  selectedEntityTitle: 180,
  selectedEntitySubtitle: 160,
  snippet: 220,
  knowledgeMessage: 260,
  appIdentity: 80,
  headings: 8,
  navigation: 12,
  primaryActions: 12,
  interactiveElements: 40,
  breadcrumbs: 6,
  workspaceItems: 6,
  regions: 12,
  snippets: 8,
  forms: 6,
  formFields: 12,
  tables: 4,
  tableColumns: 10,
  tableActions: 8,
  dialogs: 4,
  dialogActions: 8,
  wikiPages: 10,
  selectorHints: 8,
} as const;

const REDACTION = '[REDACTED]';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function clipText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

export function sanitizePageContextUrl(url: string | null | undefined): string {
  try {
    const parsed = new URL(url ?? '');
    const pathname = parsed.pathname || '/';
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    parsed.host = parsed.host.toLowerCase();
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return 'https://unknown/';
  }
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(?:bearer\s+)[a-z0-9._~+/=-]{8,}\b/gi, `Bearer ${REDACTION}`)
    .replace(
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|passwd|pwd)\s*[:=]\s*["']?[^"'\s,;]+/gi,
      (match) => {
        const separator = match.includes('=') ? '=' : ':';
        return `${match.split(separator)[0]}${separator}${REDACTION}`;
      },
    )
    .replace(/\bsk_(?:live|test)_[a-z0-9_=-]{6,}\b/gi, REDACTION)
    .replace(
      /\b[a-z0-9_-]{12,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/gi,
      REDACTION,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTION)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, REDACTION)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, REDACTION)
    .replace(
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      REDACTION,
    )
    .replace(/\b\d{9,}\b/g, REDACTION)
    .replace(
      /\b(?=[a-z0-9_-]*[a-z])(?=[a-z0-9_-]*\d)[a-z0-9_-]{32,}\b/gi,
      REDACTION,
    );
}

export function sanitizePageContextText(
  value: string | null | undefined,
  limit: number = PAGE_CONTEXT_SANITIZER_LIMITS.label,
): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  return clipText(redactSensitiveText(normalized), limit);
}

export function sanitizePageContextSelector(
  value: string | null | undefined,
  limit: number = PAGE_CONTEXT_SANITIZER_LIMITS.selector,
): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  if (hasSensitiveLocatorText(normalized)) {
    return undefined;
  }

  return clipText(normalized, limit);
}

function hasSensitiveLocatorText(value: string): boolean {
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|passwd|pwd)\s*[:=]/i.test(
      value,
    ) ||
    /\bsk_(?:live|test)_[a-z0-9_=-]{6,}\b/i.test(value) ||
    /(?:^|[/?&#])token=/i.test(value) ||
    /:\/\/[^/\s:@]+:[^/\s@]+@/.test(value)
  );
}

function sanitizeStringList(
  values: string[] | undefined,
  limit: number,
  textLimit: number = PAGE_CONTEXT_SANITIZER_LIMITS.label,
): string[] | undefined {
  const sanitized = (values ?? [])
    .slice(0, limit)
    .flatMap((__item, __index, __array) => {
      const __mapped = sanitizePageContextText(__item, textLimit);
      return __mapped ? [__mapped] : [];
    });
  return sanitized.length ? sanitized : undefined;
}

function sanitizeRect(rect: ContextRect | undefined): ContextRect | undefined {
  if (!rect) return undefined;
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

function sanitizeViewport(
  viewport: ViewportSnapshot | undefined,
): ViewportSnapshot | undefined {
  if (!viewport) return undefined;
  return {
    width: viewport.width,
    height: viewport.height,
    scrollX: viewport.scrollX,
    scrollY: viewport.scrollY,
    devicePixelRatio: viewport.devicePixelRatio,
  };
}

function sanitizeKnowledgeMatch(
  match: KnowledgeMatch | null | undefined,
): KnowledgeMatch | null | undefined {
  if (match === null) return null;
  if (!match) return undefined;
  return {
    matched: match.matched,
    basis: match.basis,
    confidence: match.confidence,
    app:
      sanitizePageContextText(
        match.app,
        PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
      ) ?? null,
    screen:
      sanitizePageContextText(
        match.screen,
        PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
      ) ?? null,
    label: sanitizePageContextText(match.label),
    pageIds: (match.pageIds ?? []).slice(
      0,
      PAGE_CONTEXT_SANITIZER_LIMITS.wikiPages,
    ),
    selectorHints: sanitizeSelectorList(
      match.selectorHints,
      PAGE_CONTEXT_SANITIZER_LIMITS.selectorHints,
    ),
    basisCategory: match.basisCategory,
    basisLabel: sanitizePageContextText(match.basisLabel),
    basisExplanation: sanitizePageContextText(match.basisExplanation, 260),
  };
}

function sanitizeKnowledgeAvailability(
  availability: KnowledgeAvailability | undefined,
): KnowledgeAvailability | undefined {
  if (!availability) return undefined;
  return {
    hasVendorDocs: availability.hasVendorDocs,
    hasOrgKnowledge: availability.hasOrgKnowledge,
    mode: availability.mode,
    message:
      sanitizePageContextText(
        availability.message,
        PAGE_CONTEXT_SANITIZER_LIMITS.knowledgeMessage,
      ) ?? '',
  };
}

function sanitizeSelectorList(
  values: string[] | undefined,
  limit: number,
): string[] | undefined {
  const sanitized = (values ?? [])
    .slice(0, limit)
    .flatMap((__item, __index, __array) => {
      const __mapped = sanitizePageContextSelector(__item);
      return __mapped ? [__mapped] : [];
    });
  return sanitized.length ? sanitized : undefined;
}

function sanitizeInteractiveElement(
  element: InteractiveElement,
): InteractiveElement | null {
  const selector = sanitizePageContextSelector(element.selector);
  if (!selector) return null;

  return {
    selector,
    label: sanitizePageContextText(element.label) ?? '',
    type: sanitizePageContextText(element.type, 60) ?? 'unknown',
    ariaLabel: sanitizePageContextText(element.ariaLabel),
    boundingRect: element.boundingRect,
    rect: sanitizeRect(element.rect),
    priority: element.priority,
    group: element.group,
    roleHint: sanitizePageContextText(element.roleHint, 80),
    surface: element.surface,
    selected: element.selected,
    disabled: element.disabled,
    visible: element.visible,
    expanded: element.expanded,
    checked: element.checked,
    required: element.required,
    readonly: element.readonly,
    invalid: element.invalid,
    valuePresent: element.valuePresent,
    placeholder: sanitizePageContextText(element.placeholder),
    frameOwner: element.frameOwner
      ? {
          frameSelector:
            sanitizePageContextSelector(element.frameOwner.frameSelector) ?? '',
          innerSelector:
            sanitizePageContextSelector(element.frameOwner.innerSelector) ?? '',
          status: element.frameOwner.status,
          frameTitle: sanitizePageContextText(
            element.frameOwner.frameTitle,
            80,
          ),
          frameUrl: sanitizePageContextUrl(element.frameOwner.frameUrl),
        }
      : undefined,
  };
}

function sanitizeHeading(heading: ContextHeading): ContextHeading {
  return {
    level: heading.level,
    text: sanitizePageContextText(heading.text) ?? '',
    selector: sanitizePageContextSelector(heading.selector),
  };
}

function sanitizeNavigationItem(item: NavigationItem): NavigationItem {
  return {
    label: sanitizePageContextText(item.label) ?? '',
    selector: sanitizePageContextSelector(item.selector),
    current: item.current,
    kind: item.kind,
  };
}

function sanitizePageAction(action: PageAction): PageAction | null {
  const selector = sanitizePageContextSelector(action.selector);
  if (!selector) return null;

  return {
    label: sanitizePageContextText(action.label) ?? '',
    selector,
    priority: action.priority,
    group: action.group,
    surface: action.surface,
  };
}

function sanitizeSelectedEntity(
  entity: SelectedEntity | undefined,
): SelectedEntity | undefined {
  if (!entity) return undefined;
  return {
    title:
      sanitizePageContextText(
        entity.title,
        PAGE_CONTEXT_SANITIZER_LIMITS.selectedEntityTitle,
      ) ?? '',
    subtitle: sanitizePageContextText(
      entity.subtitle,
      PAGE_CONTEXT_SANITIZER_LIMITS.selectedEntitySubtitle,
    ),
    kind: sanitizePageContextText(entity.kind, 80),
  };
}

function sanitizeWorkspaceItem(
  item: WorkspaceContextItem,
): WorkspaceContextItem {
  return {
    kind: item.kind,
    value: sanitizePageContextText(item.value) ?? '',
    selector: sanitizePageContextSelector(item.selector),
  };
}

function sanitizeWorkspaceContext(
  context: WorkspaceContext | undefined,
): WorkspaceContext | undefined {
  if (!context) return undefined;
  const items = context.items
    .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.workspaceItems)
    .map(sanitizeWorkspaceItem);
  return { items };
}

function sanitizeRegion(region: PageRegion): PageRegion | null {
  const selector = sanitizePageContextSelector(region.selector);
  if (!selector) return null;

  return {
    id: sanitizePageContextText(region.id, 80) ?? '',
    selector,
    kind: region.kind,
    label: sanitizePageContextText(region.label),
    summary: sanitizePageContextText(region.summary, 220),
    rect: sanitizeRect(region.rect),
    inViewport: region.inViewport,
    interactiveCount: region.interactiveCount,
    snippetCount: region.snippetCount,
  };
}

function sanitizeSnippet(snippet: ContextSnippet): ContextSnippet | null {
  const selector = sanitizePageContextSelector(snippet.selector);
  if (!selector) return null;

  return {
    id: sanitizePageContextText(snippet.id, 80) ?? '',
    selector,
    regionId: sanitizePageContextText(snippet.regionId, 80),
    kind: snippet.kind,
    text:
      sanitizePageContextText(
        snippet.text,
        PAGE_CONTEXT_SANITIZER_LIMITS.snippet,
      ) ?? '',
    rect: sanitizeRect(snippet.rect),
  };
}

function sanitizeFormField(field: FormField): FormField | null {
  const selector = sanitizePageContextSelector(field.selector);
  if (!selector) return null;

  return {
    label: sanitizePageContextText(field.label) ?? '',
    selector,
    type: sanitizePageContextText(field.type, 60) ?? 'text',
    required: field.required,
  };
}

function sanitizeForm(form: FormSurface): FormSurface {
  return {
    label: sanitizePageContextText(form.label),
    selector: sanitizePageContextSelector(form.selector),
    fields: form.fields
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.formFields)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizeFormField(__item);
        return __mapped ? [__mapped] : [];
      }),
  };
}

function sanitizeTable(table: TableSurface): TableSurface {
  return {
    label: sanitizePageContextText(table.label),
    selector: sanitizePageContextSelector(table.selector),
    columns:
      sanitizeStringList(
        table.columns,
        PAGE_CONTEXT_SANITIZER_LIMITS.tableColumns,
      ) ?? [],
    rowCount: table.rowCount,
    actionLabels: sanitizeStringList(
      table.actionLabels,
      PAGE_CONTEXT_SANITIZER_LIMITS.tableActions,
    ),
    bulkSelectable: table.bulkSelectable,
    selectionLabels: sanitizeStringList(
      table.selectionLabels,
      PAGE_CONTEXT_SANITIZER_LIMITS.tableActions,
    ),
  };
}

function sanitizeDialog(dialog: DialogSurface): DialogSurface | null {
  const selector = sanitizePageContextSelector(dialog.selector);
  if (!selector) return null;

  return {
    title: sanitizePageContextText(dialog.title),
    selector,
    description: sanitizePageContextText(dialog.description, 220),
    actionLabels:
      sanitizeStringList(
        dialog.actionLabels,
        PAGE_CONTEXT_SANITIZER_LIMITS.dialogActions,
      ) ?? [],
  };
}

export function sanitizePageContextForNetwork(
  context: PageContext,
): PageContext {
  return {
    app:
      sanitizePageContextText(
        context.app,
        PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
      ) ?? 'unknown',
    appVersion: sanitizePageContextText(context.appVersion, 80),
    screen:
      sanitizePageContextText(
        context.screen,
        PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
      ) ?? 'unknown',
    appSignature: sanitizePageContextText(context.appSignature, 120),
    url: sanitizePageContextUrl(context.url),
    title:
      sanitizePageContextText(
        context.title,
        PAGE_CONTEXT_SANITIZER_LIMITS.title,
      ) ?? '',
    interactiveElements: (context.interactiveElements ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.interactiveElements)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizeInteractiveElement(__item);
        return __mapped ? [__mapped] : [];
      }),
    detectionConfidence: context.detectionConfidence,
    pageSummary: sanitizePageContextText(
      context.pageSummary,
      PAGE_CONTEXT_SANITIZER_LIMITS.summary,
    ),
    headings: (context.headings ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.headings)
      .map(sanitizeHeading),
    navigation: (context.navigation ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.navigation)
      .map(sanitizeNavigationItem),
    primaryActions: (context.primaryActions ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.primaryActions)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizePageAction(__item);
        return __mapped ? [__mapped] : [];
      }),
    selectedEntity: sanitizeSelectedEntity(context.selectedEntity),
    workspaceContext: sanitizeWorkspaceContext(context.workspaceContext),
    viewport: sanitizeViewport(context.viewport),
    regions: (context.regions ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.regions)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizeRegion(__item);
        return __mapped ? [__mapped] : [];
      }),
    snippets: (context.snippets ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.snippets)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizeSnippet(__item);
        return __mapped ? [__mapped] : [];
      }),
    forms: (context.forms ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.forms)
      .map(sanitizeForm),
    tables: (context.tables ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.tables)
      .map(sanitizeTable),
    dialogs: (context.dialogs ?? [])
      .slice(0, PAGE_CONTEXT_SANITIZER_LIMITS.dialogs)
      .flatMap((__item, __index, __array) => {
        const __mapped = sanitizeDialog(__item);
        return __mapped ? [__mapped] : [];
      }),
    vendorKnowledgeMatch: sanitizeKnowledgeMatch(context.vendorKnowledgeMatch),
    orgKnowledgeMatch: sanitizeKnowledgeMatch(context.orgKnowledgeMatch),
    knowledgeAvailability: sanitizeKnowledgeAvailability(
      context.knowledgeAvailability,
    ),
    relevantWikiPages: (context.relevantWikiPages ?? []).slice(
      0,
      PAGE_CONTEXT_SANITIZER_LIMITS.wikiPages,
    ),
    knowledgeResolvedFor: context.knowledgeResolvedFor
      ? {
          app:
            sanitizePageContextText(
              context.knowledgeResolvedFor.app,
              PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
            ) ?? 'unknown',
          screen:
            sanitizePageContextText(
              context.knowledgeResolvedFor.screen,
              PAGE_CONTEXT_SANITIZER_LIMITS.appIdentity,
            ) ?? 'unknown',
          appSignature:
            sanitizePageContextText(
              context.knowledgeResolvedFor.appSignature,
              120,
            ) ?? 'unknown:unknown',
          host:
            sanitizePageContextText(context.knowledgeResolvedFor.host, 140) ??
            'unknown',
          path:
            sanitizePageContextSelector(
              context.knowledgeResolvedFor.path,
              PAGE_CONTEXT_SANITIZER_LIMITS.selector,
            ) ?? '/',
        }
      : undefined,
    breadcrumbs: sanitizeStringList(
      context.breadcrumbs,
      PAGE_CONTEXT_SANITIZER_LIMITS.breadcrumbs,
    ),
  };
}

export function sanitizePageContextForModel(context: PageContext): PageContext {
  return sanitizePageContextForNetwork(context);
}
