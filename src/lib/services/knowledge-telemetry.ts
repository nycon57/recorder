import type { Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type KnowledgeTelemetryEventType =
  | 'extension.context.checked'
  | 'knowledge.chat.outcome'
  | 'knowledge.extension.query.outcome'
  | 'knowledge.review.outcome';

export type KnowledgeChatAnswerMode =
  | 'compiled-memory'
  | 'discovery'
  | 'tool-discovery'
  | 'empty';

export type KnowledgeReviewOutcome =
  | 'approved'
  | 'rejected'
  | 'edited_and_approved'
  | 'auto_rejected_noop'
  | 'error';

export type KnowledgeTelemetrySince = '1h' | '24h' | '7d' | '30d' | 'all';

export interface KnowledgeChatTelemetryPayload {
  orgId: string;
  userId: string;
  queryId: string;
  query: string;
  queryLength: number;
  queryWordCount: number;
  answerMode: KnowledgeChatAnswerMode;
  routeStrategy: string | null;
  selectedStrategy: string;
  recordingsCount: number;
  sourcesCount: number;
  retrievalAttempts: number;
  finalThreshold: number | null;
  averageSimilarity: number;
  totalTimeMs: number;
  routingFailed: boolean;
  routingFailureReason: string | null;
}

export interface KnowledgeExtensionQueryTelemetryPayload {
  orgId: string;
  userId: string;
  app: string;
  screen: string;
  hadOrgKnowledge: boolean;
  hadVendorKnowledge: boolean;
  knowledgeMode: 'dom_only' | 'vendor_backed' | 'org_backed' | 'unknown';
  responseLatencyMs: number;
  routingFailed: boolean;
  asOf: string | null;
}

export interface KnowledgeReviewTelemetryPayload {
  orgId: string;
  userId: string;
  pageId: string;
  logEntryIndex: number;
  action: 'approveContradiction' | 'rejectContradiction' | 'editAndApproveContradiction';
  outcome: KnowledgeReviewOutcome;
  contentLength: number | null;
  errorMessage: string | null;
}

export interface KnowledgeTelemetryEventRow {
  id: string;
  type: KnowledgeTelemetryEventType;
  payload: Json;
  created_at: string;
}

export interface KnowledgeTelemetryEvent {
  id: string;
  type: KnowledgeTelemetryEventType;
  createdAt: string;
  payload: Record<string, Json>;
}

export interface KnowledgeTelemetryFilters {
  orgId: string;
  since?: KnowledgeTelemetrySince;
  limit?: number;
}

export interface KnowledgeTelemetrySummary {
  total: number;
  byType: Record<KnowledgeTelemetryEventType, number>;
  byChatAnswerMode: Record<KnowledgeChatAnswerMode, number>;
  routingFailures: number;
  reviewOutcomes: Record<KnowledgeReviewOutcome, number>;
  byVendorMatchBasis: Record<string, number>;
  byOrgMatchBasis: Record<string, number>;
  extensionQueryAvailability: {
    orgKnowledge: number;
    vendorKnowledge: number;
    empty: number;
  };
}

const CHAT_ANSWER_MODES: KnowledgeChatAnswerMode[] = [
  'compiled-memory',
  'discovery',
  'tool-discovery',
  'empty',
];

const REVIEW_OUTCOMES: KnowledgeReviewOutcome[] = [
  'approved',
  'rejected',
  'edited_and_approved',
  'auto_rejected_noop',
  'error',
];

function isRecord(value: Json): value is Record<string, Json | undefined> {
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

function readBoolean(
  record: Record<string, Json | undefined>,
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

function normalizePayload(payload: Json): Record<string, Json> {
  if (!isRecord(payload)) return {};
  return payload as Record<string, Json>;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function clampLimit(value: number): number {
  return Math.min(Math.max(value, 10), 200);
}

function cutoffFromSince(since: KnowledgeTelemetrySince): string | null {
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

export function buildKnowledgeChatTelemetry(
  args: KnowledgeChatTelemetryPayload,
): KnowledgeChatTelemetryPayload {
  const shouldInferRoutingFailure =
    args.answerMode !== 'tool-discovery' &&
    args.answerMode !== 'empty' &&
    args.sourcesCount === 0 &&
    args.recordingsCount > 0;
  const routingFailed =
    args.routingFailed ||
    shouldInferRoutingFailure;

  return {
    ...args,
    routingFailed,
    routingFailureReason: routingFailed
      ? args.routingFailureReason ?? 'no_sources'
      : null,
  };
}

export function buildKnowledgeExtensionQueryTelemetry(
  args: KnowledgeExtensionQueryTelemetryPayload,
): KnowledgeExtensionQueryTelemetryPayload {
  const routingFailed = !args.hadOrgKnowledge && !args.hadVendorKnowledge;

  return {
    ...args,
    routingFailed,
  };
}

export function buildKnowledgeReviewTelemetry(
  args: KnowledgeReviewTelemetryPayload,
): KnowledgeReviewTelemetryPayload {
  return {
    ...args,
    contentLength:
      typeof args.contentLength === 'number' ? args.contentLength : null,
    errorMessage: args.errorMessage?.trim() ? args.errorMessage : null,
  };
}

export async function recordKnowledgeTelemetryEvent(input: {
  type: KnowledgeTelemetryEventType;
  payload: Json;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('events').insert({
      type: input.type,
      payload: input.payload,
    });

    if (error) {
      console.warn('[knowledge-telemetry] Failed to record event:', {
        type: input.type,
        error: error.message,
      });
    }
  } catch (error) {
    console.warn('[knowledge-telemetry] Failed to record event:', {
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function normalizeKnowledgeTelemetryEvent(
  row: KnowledgeTelemetryEventRow,
): KnowledgeTelemetryEvent | null {
  if (!row.type) return null;

  const payload = normalizePayload(row.payload);
  const orgId = readString(payload, 'orgId');
  if (!orgId) return null;

  return {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    payload,
  };
}

export function summarizeKnowledgeTelemetryEvents(
  events: KnowledgeTelemetryEvent[],
): KnowledgeTelemetrySummary {
  const byType: KnowledgeTelemetrySummary['byType'] = {
    'extension.context.checked': 0,
    'knowledge.chat.outcome': 0,
    'knowledge.extension.query.outcome': 0,
    'knowledge.review.outcome': 0,
  };
  const byChatAnswerMode: KnowledgeTelemetrySummary['byChatAnswerMode'] = {
    'compiled-memory': 0,
    discovery: 0,
    'tool-discovery': 0,
    empty: 0,
  };
  const reviewOutcomes: KnowledgeTelemetrySummary['reviewOutcomes'] = {
    approved: 0,
    rejected: 0,
    edited_and_approved: 0,
    auto_rejected_noop: 0,
    error: 0,
  };
  const byVendorMatchBasis: Record<string, number> = {};
  const byOrgMatchBasis: Record<string, number> = {};

  let routingFailures = 0;
  let orgKnowledgeCount = 0;
  let vendorKnowledgeCount = 0;
  let emptyKnowledgeCount = 0;

  for (const event of events) {
    byType[event.type] += 1;

    if (event.type === 'extension.context.checked') {
      const vendorBasis = readString(event.payload, 'vendorMatchBasis');
      const orgBasis = readString(event.payload, 'orgMatchBasis');
      if (vendorBasis) {
        byVendorMatchBasis[vendorBasis] = (byVendorMatchBasis[vendorBasis] ?? 0) + 1;
      }
      if (orgBasis) {
        byOrgMatchBasis[orgBasis] = (byOrgMatchBasis[orgBasis] ?? 0) + 1;
      }
    }

    if (event.type === 'knowledge.chat.outcome') {
      const answerMode = readString(event.payload, 'answerMode') as KnowledgeChatAnswerMode | null;
      if (answerMode && answerMode in byChatAnswerMode) {
        byChatAnswerMode[answerMode] += 1;
      }
      if (readBoolean(event.payload, 'routingFailed')) {
        routingFailures += 1;
      }
    }

    if (event.type === 'knowledge.extension.query.outcome') {
      if (readBoolean(event.payload, 'routingFailed')) {
        routingFailures += 1;
      }
      if (readBoolean(event.payload, 'hadOrgKnowledge')) {
        orgKnowledgeCount += 1;
      } else if (readBoolean(event.payload, 'hadVendorKnowledge')) {
        vendorKnowledgeCount += 1;
      } else {
        emptyKnowledgeCount += 1;
      }
    }

    if (event.type === 'knowledge.review.outcome') {
      const outcome = readString(event.payload, 'outcome') as KnowledgeReviewOutcome | null;
      if (outcome && outcome in reviewOutcomes) {
        reviewOutcomes[outcome] += 1;
      }
    }
  }

  return {
    total: events.length,
    byType,
    byChatAnswerMode,
    routingFailures,
    reviewOutcomes,
    byVendorMatchBasis,
    byOrgMatchBasis,
    extensionQueryAvailability: {
      orgKnowledge: orgKnowledgeCount,
      vendorKnowledge: vendorKnowledgeCount,
      empty: emptyKnowledgeCount,
    },
  };
}

export async function listKnowledgeTelemetryEvents(args: KnowledgeTelemetryFilters): Promise<{
  events: KnowledgeTelemetryEvent[];
  summary: KnowledgeTelemetrySummary;
}> {
  const { orgId, since = '24h', limit = 100 } = args;
  const cutoff = cutoffFromSince(since);
  const fetchLimit = clampLimit(limit);

  let query = supabaseAdmin
    .from('events')
    .select('id, type, payload, created_at')
    .in('type', [
      'extension.context.checked',
      'knowledge.chat.outcome',
      'knowledge.extension.query.outcome',
      'knowledge.review.outcome',
    ])
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (cutoff) {
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load knowledge telemetry events: ${error.message}`);
  }

  const events = (data ?? [])
    .map((row) => normalizeKnowledgeTelemetryEvent(row as KnowledgeTelemetryEventRow))
    .filter((event): event is KnowledgeTelemetryEvent => event !== null)
    .filter((event) => readString(event.payload, 'orgId') === orgId);

  const summary = summarizeKnowledgeTelemetryEvents(events);

  return { events, summary };
}

export function summarizeTelemetryQuery(
  query: string,
): { queryLength: number; queryWordCount: number; normalizedQuery: string } {
  const normalizedQuery = normalizeText(query);
  return {
    queryLength: normalizedQuery.length,
    queryWordCount: normalizedQuery ? normalizedQuery.split(/\s+/).length : 0,
    normalizedQuery,
  };
}
