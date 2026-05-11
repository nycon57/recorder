import type { Json, Database } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  ExtensionContextPageType,
  ExtensionContextTelemetryPayload,
} from '@/lib/services/extension-context-telemetry';

type EventRow = Database['public']['Tables']['events']['Row'];

type ExtensionContextDebugSince = '1h' | '24h' | '7d' | '30d' | 'all';
export type ExtensionContextDebugKnowledgeMode =
  | 'dom_only'
  | 'vendor_backed'
  | 'org_backed'
  | 'unknown';

export interface ExtensionContextDebugFilters {
  app?: string;
  pageType?: ExtensionContextPageType;
  knowledgeMode?: ExtensionContextDebugKnowledgeMode;
  host?: string;
  query?: string;
  limit: number;
  since: ExtensionContextDebugSince;
}

interface ExtensionContextDebugEvent {
  id: string;
  createdAt: string;
  telemetry: ExtensionContextTelemetryPayload;
}

interface ExtensionContextDebugSummary {
  total: number;
  distinctApps: number;
  distinctHosts: number;
  byKnowledgeMode: Record<ExtensionContextDebugKnowledgeMode, number>;
}

export interface ListExtensionContextDebugEventsResult {
  events: ExtensionContextDebugEvent[];
  summary: ExtensionContextDebugSummary;
  availableApps: string[];
  availableHosts: string[];
}

const KNOWN_PAGE_TYPES: ExtensionContextPageType[] = [
  'dialog',
  'settings',
  'dashboard',
  'record_detail',
  'table',
  'form',
  'document',
  'marketing',
  'unknown',
];

const KNOWN_KNOWLEDGE_MODES: ExtensionContextDebugKnowledgeMode[] = [
  'dom_only',
  'vendor_backed',
  'org_backed',
  'unknown',
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isRecord(
  value: Json | undefined,
): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(
  record: Record<string, Json | undefined>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(
  record: Record<string, Json | undefined>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === 'number' ? value : null;
}

function readStringArray(
  record: Record<string, Json | undefined>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readSurfaceCounts(
  record: Record<string, Json | undefined>,
): ExtensionContextTelemetryPayload['surfaceCounts'] | null {
  const value = record.surfaceCounts;
  if (!isRecord(value)) return null;

  return {
    headings: readNumber(value, 'headings') ?? 0,
    navigation: readNumber(value, 'navigation') ?? 0,
    primaryActions: readNumber(value, 'primaryActions') ?? 0,
    forms: readNumber(value, 'forms') ?? 0,
    tables: readNumber(value, 'tables') ?? 0,
    dialogs: readNumber(value, 'dialogs') ?? 0,
    regions: readNumber(value, 'regions') ?? 0,
    snippets: readNumber(value, 'snippets') ?? 0,
    interactiveElements: readNumber(value, 'interactiveElements') ?? 0,
  };
}

function readDetectionConfidence(
  record: Record<string, Json | undefined>,
): ExtensionContextTelemetryPayload['detectionConfidence'] | null {
  const value = record.detectionConfidence;
  if (!isRecord(value)) return null;

  return {
    app: readNumber(value, 'app'),
    screen: readNumber(value, 'screen'),
    overall: readNumber(value, 'overall'),
  };
}

function clampLimit(value: number): number {
  return Math.min(Math.max(value, 10), 200);
}

function cutoffFromSince(since: ExtensionContextDebugSince): string | null {
  const now = Date.now();

  switch (since) {
    case '1h':
      return new Date(now - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
    default:
      return null;
  }
}

export function parseExtensionContextDebugFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ExtensionContextDebugFilters {
  const app = normalizeText(
    Array.isArray(searchParams.app) ? searchParams.app[0] : searchParams.app,
  ).toLowerCase();
  const host = normalizeText(
    Array.isArray(searchParams.host) ? searchParams.host[0] : searchParams.host,
  ).toLowerCase();
  const pageType = normalizeText(
    Array.isArray(searchParams.pageType)
      ? searchParams.pageType[0]
      : searchParams.pageType,
  ) as ExtensionContextPageType;
  const knowledgeMode = normalizeText(
    Array.isArray(searchParams.knowledgeMode)
      ? searchParams.knowledgeMode[0]
      : searchParams.knowledgeMode,
  ) as ExtensionContextDebugKnowledgeMode;
  const query = normalizeText(
    Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q,
  );
  const rawLimit = Number.parseInt(
    Array.isArray(searchParams.limit)
      ? (searchParams.limit[0] ?? '')
      : (searchParams.limit ?? ''),
    10,
  );
  const sinceValue = normalizeText(
    Array.isArray(searchParams.since)
      ? searchParams.since[0]
      : searchParams.since,
  ) as ExtensionContextDebugSince;

  return {
    app: app && app !== 'all' ? app : undefined,
    pageType: KNOWN_PAGE_TYPES.includes(pageType) ? pageType : undefined,
    knowledgeMode: KNOWN_KNOWLEDGE_MODES.includes(knowledgeMode)
      ? knowledgeMode
      : undefined,
    host: host && host !== 'all' ? host : undefined,
    query: query || undefined,
    limit: Number.isFinite(rawLimit) ? clampLimit(rawLimit) : 100,
    since: ['1h', '24h', '7d', '30d', 'all'].includes(sinceValue)
      ? sinceValue
      : '24h',
  };
}

function normalizeExtensionContextDebugEvent(
  row: EventRow,
): ExtensionContextDebugEvent | null {
  if (row.type !== 'extension.context.checked') return null;
  if (!isRecord(row.payload)) return null;

  const payload = row.payload;
  const pageType = readString(
    payload,
    'pageType',
  ) as ExtensionContextPageType | null;
  const knowledgeMode = readString(
    payload,
    'knowledgeMode',
  ) as ExtensionContextDebugKnowledgeMode | null;
  const surfaceCounts = readSurfaceCounts(payload);
  const detectionConfidence = readDetectionConfidence(payload);

  if (
    !readString(payload, 'orgId') ||
    !readString(payload, 'urlHost') ||
    !readString(payload, 'urlPath') ||
    !readString(payload, 'app') ||
    !readString(payload, 'screen') ||
    !readString(payload, 'appSignature') ||
    !pageType ||
    !knowledgeMode ||
    !surfaceCounts ||
    !detectionConfidence
  ) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    telemetry: {
      orgId: readString(payload, 'orgId')!,
      actorId: readString(payload, 'actorId'),
      authMethod:
        readString(payload, 'authMethod') === 'api_key' ? 'api_key' : 'session',
      urlHost: readString(payload, 'urlHost')!,
      urlPath: readString(payload, 'urlPath')!,
      app: readString(payload, 'app')!,
      screen: readString(payload, 'screen')!,
      appSignature: readString(payload, 'appSignature')!,
      pageType,
      detectionConfidence,
      knowledgeMode,
      vendorMatchBasis: (readString(payload, 'vendorMatchBasis') ??
        'none') as ExtensionContextTelemetryPayload['vendorMatchBasis'],
      orgMatchBasis: (readString(payload, 'orgMatchBasis') ??
        'none') as ExtensionContextTelemetryPayload['orgMatchBasis'],
      vendorMatchCategory: (readString(payload, 'vendorMatchCategory') ??
        'unknown') as ExtensionContextTelemetryPayload['vendorMatchCategory'],
      orgMatchCategory: (readString(payload, 'orgMatchCategory') ??
        'unknown') as ExtensionContextTelemetryPayload['orgMatchCategory'],
      vendorMatchLabel: readString(payload, 'vendorMatchLabel'),
      orgMatchLabel: readString(payload, 'orgMatchLabel'),
      vendorMatchExplanation: readString(payload, 'vendorMatchExplanation'),
      orgMatchExplanation: readString(payload, 'orgMatchExplanation'),
      vendorMatchConfidence: readNumber(payload, 'vendorMatchConfidence'),
      orgMatchConfidence: readNumber(payload, 'orgMatchConfidence'),
      selectedEntityTitle: readString(payload, 'selectedEntityTitle'),
      currentNavigationLabels: readStringArray(
        payload,
        'currentNavigationLabels',
      ),
      workspaceValues: readStringArray(payload, 'workspaceValues'),
      surfaceCounts,
      pageSummary: readString(payload, 'pageSummary') ?? '',
      latencyMs: readNumber(payload, 'latencyMs') ?? 0,
      fingerprint: readString(payload, 'fingerprint') ?? row.id,
    },
  };
}

function matchesExtensionContextDebugFilters(
  event: ExtensionContextDebugEvent,
  filters: ExtensionContextDebugFilters,
): boolean {
  const { telemetry } = event;

  if (
    filters.app &&
    telemetry.app.toLowerCase() !== filters.app.toLowerCase()
  ) {
    return false;
  }
  if (filters.pageType && telemetry.pageType !== filters.pageType) {
    return false;
  }
  if (
    filters.knowledgeMode &&
    telemetry.knowledgeMode !== filters.knowledgeMode
  ) {
    return false;
  }
  if (
    filters.host &&
    telemetry.urlHost.toLowerCase() !== filters.host.toLowerCase()
  ) {
    return false;
  }

  if (filters.query) {
    const haystack = [
      telemetry.app,
      telemetry.screen,
      telemetry.pageType,
      telemetry.urlHost,
      telemetry.urlPath,
      telemetry.pageSummary,
      String(telemetry.surfaceCounts.regions),
      String(telemetry.surfaceCounts.snippets),
      telemetry.selectedEntityTitle,
      telemetry.vendorMatchLabel,
      telemetry.orgMatchLabel,
      telemetry.vendorMatchExplanation,
      telemetry.orgMatchExplanation,
      ...telemetry.currentNavigationLabels,
      ...telemetry.workspaceValues,
    ]
      .map((value) => normalizeText(value))
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(filters.query.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function summarizeExtensionContextDebugEvents(
  events: ExtensionContextDebugEvent[],
): ExtensionContextDebugSummary {
  const apps = new Set<string>();
  const hosts = new Set<string>();
  const byKnowledgeMode: ExtensionContextDebugSummary['byKnowledgeMode'] = {
    dom_only: 0,
    vendor_backed: 0,
    org_backed: 0,
    unknown: 0,
  };

  for (const event of events) {
    apps.add(event.telemetry.app);
    hosts.add(event.telemetry.urlHost);
    byKnowledgeMode[event.telemetry.knowledgeMode] += 1;
  }

  return {
    total: events.length,
    distinctApps: apps.size,
    distinctHosts: hosts.size,
    byKnowledgeMode,
  };
}

export async function listExtensionContextDebugEvents(args: {
  orgId: string;
  filters: ExtensionContextDebugFilters;
}): Promise<ListExtensionContextDebugEventsResult> {
  const { orgId, filters } = args;
  const cutoff = cutoffFromSince(filters.since);
  const fetchLimit = Math.max(filters.limit * 4, 250);

  let query = supabaseAdmin
    .from('events')
    .select('id, type, payload, processed, created_at')
    .eq('type', 'extension.context.checked')
    .order('created_at', { ascending: false })
    .limit(Math.min(fetchLimit, 500));

  if (cutoff) {
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to load extension context events: ${error.message}`,
    );
  }

  const normalized = (data ?? []).flatMap((__item, __index, __array) => {
    const __mapped = normalizeExtensionContextDebugEvent(__item);
    return __mapped !== null && __mapped.telemetry.orgId === orgId
      ? [__mapped]
      : [];
  });

  const availableApps = Array.from(
    new Set(
      normalized.flatMap((__item, __index, __array) => {
        const __mapped = __item.telemetry.app;
        return __mapped ? [__mapped] : [];
      }),
    ),
  ).sort();
  const availableHosts = Array.from(
    new Set(
      normalized.flatMap((__item, __index, __array) => {
        const __mapped = __item.telemetry.urlHost;
        return __mapped ? [__mapped] : [];
      }),
    ),
  ).sort();

  const events = normalized
    .filter((event) => matchesExtensionContextDebugFilters(event, filters))
    .slice(0, filters.limit);

  return {
    events,
    summary: summarizeExtensionContextDebugEvents(events),
    availableApps,
    availableHosts,
  };
}
