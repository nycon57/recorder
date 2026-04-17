import type { Database, Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

type EventRow = Database['public']['Tables']['events']['Row'];

export type ExtensionDebugSessionEventType =
  | 'session_start_requested'
  | 'session_started'
  | 'session_ended'
  | 'session_error'
  | 'mic_permission_opened'
  | 'mic_permission_granted'
  | 'mic_permission_denied'
  | 'mic_permission_resumed'
  | 'page_context_checked'
  | 'contextual_update_sent'
  | 'user_message'
  | 'assistant_message'
  | 'assistant_reply_watchdog_fired'
  | 'duplicate_assistant_reply'
  | 'tool_call_started'
  | 'tool_call_completed';

export type ExtensionDebugSessionKnowledgeMode =
  | 'dom_only'
  | 'vendor_backed'
  | 'org_backed'
  | 'unknown';

export type ExtensionDebugSessionMatchBasis =
  | 'exact'
  | 'screen_alias'
  | 'app_only'
  | 'domain_alias'
  | 'none'
  | 'unknown';

export type ExtensionDebugSessionStatus = 'active' | 'completed' | 'failed';
export type ExtensionDebugSessionSince = '1h' | '24h' | '7d' | '30d' | 'all';

export interface ExtensionDebugSessionFilters {
  app?: string;
  host?: string;
  status?: ExtensionDebugSessionStatus;
  query?: string;
  limit: number;
  since: ExtensionDebugSessionSince;
}

export interface ExtensionDebugSessionEvent {
  id: string;
  createdAt: string;
  orgId: string;
  actorId: string | null;
  authMethod: 'session' | 'api_key';
  sessionId: string;
  seq: number;
  turnId: string | null;
  eventType: ExtensionDebugSessionEventType;
  occurredAt: string;
  urlHost: string | null;
  urlPath: string | null;
  app: string | null;
  screen: string | null;
  knowledgeMode: ExtensionDebugSessionKnowledgeMode;
  vendorMatchBasis: ExtensionDebugSessionMatchBasis;
  orgMatchBasis: ExtensionDebugSessionMatchBasis;
  messageText: string | null;
  toolName: string | null;
  selector: string | null;
  label: string | null;
  action: string | null;
  inputTextPreview: string | null;
  inputTextLength: number | null;
  resultText: string | null;
  error: string | null;
  pageSummary: string | null;
  selectedEntityTitle: string | null;
  tabId: number | null;
  windowId: number | null;
  conversationId: string | null;
  fingerprint: string | null;
}

export interface ExtensionDebugSessionSummary {
  id: string;
  startedAt: string;
  endedAt: string | null;
  lastEventAt: string;
  status: ExtensionDebugSessionStatus;
  app: string;
  screen: string;
  host: string;
  path: string;
  knowledgeMode: ExtensionDebugSessionKnowledgeMode;
  turnCount: number;
  toolCallCount: number;
  errorCount: number;
  eventCount: number;
  conversationId: string | null;
  assistantPreview: string | null;
  latestError: string | null;
}

export interface ExtensionDebugSessionTurn {
  id: string;
  startedAt: string;
  userMessage: ExtensionDebugSessionEvent | null;
  events: ExtensionDebugSessionEvent[];
}

export interface ExtensionDebugSessionTimeline {
  sessionId: string;
  summary: ExtensionDebugSessionSummary | null;
  events: ExtensionDebugSessionEvent[];
  turns: ExtensionDebugSessionTurn[];
  nonTurnEvents: ExtensionDebugSessionEvent[];
}

export interface ExtensionDebugSessionTranscriptEntry {
  speaker: 'user' | 'assistant';
  turnId: string | null;
  occurredAt: string;
  messageText: string;
}

export interface ExtensionDebugSessionReviewPageContext {
  occurredAt: string;
  app: string | null;
  screen: string | null;
  knowledgeMode: ExtensionDebugSessionKnowledgeMode;
  pageSummary: string | null;
  selectedEntityTitle: string | null;
  fingerprint: string | null;
}

export interface ExtensionDebugSessionReviewToolAction {
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  occurredAt: string;
  selector: string | null;
  label: string | null;
  action: string | null;
  inputTextPreview: string | null;
  inputTextLength: number | null;
  resultText: string | null;
  error: string | null;
}

export interface ExtensionDebugSessionFailurePoint {
  code:
    | 'mic_permission'
    | 'tool_failure'
    | 'agent_no_page_action'
    | 'dom_only_guidance'
    | 'no_assistant_reply'
    | 'assistant_reply_watchdog'
    | 'duplicate_assistant_reply';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  evidence: string;
}

export interface ExtensionDebugSessionReviewTurn {
  id: string;
  startedAt: string;
  userMessage: string | null;
  assistantReplies: string[];
  toolActions: ExtensionDebugSessionReviewToolAction[];
  pageContexts: ExtensionDebugSessionReviewPageContext[];
  errors: string[];
  transcript: ExtensionDebugSessionTranscriptEntry[];
}

export interface ExtensionDebugSessionReview {
  sessionId: string;
  summary: ExtensionDebugSessionSummary | null;
  transcript: ExtensionDebugSessionTranscriptEntry[];
  turns: ExtensionDebugSessionReviewTurn[];
  nonTurnEvents: ExtensionDebugSessionEvent[];
  failurePoints: ExtensionDebugSessionFailurePoint[];
}

export interface ListExtensionDebugSessionsResult {
  sessions: ExtensionDebugSessionSummary[];
  availableApps: string[];
  availableHosts: string[];
}

const KNOWN_STATUSES: ExtensionDebugSessionStatus[] = [
  'active',
  'completed',
  'failed',
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

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

function clampLimit(value: number): number {
  return Math.min(Math.max(value, 10), 200);
}

function cutoffFromSince(since: ExtensionDebugSessionSince): string | null {
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

function eventSort(
  a: ExtensionDebugSessionEvent,
  b: ExtensionDebugSessionEvent,
) {
  if (a.seq !== b.seq) return a.seq - b.seq;
  return (
    new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function eventTimestamp(event: ExtensionDebugSessionEvent): string {
  const occurredAt = new Date(event.occurredAt).getTime();
  const createdAt = new Date(event.createdAt).getTime();
  return new Date(Math.max(occurredAt, createdAt)).toISOString();
}

function firstNonEmpty(
  events: ExtensionDebugSessionEvent[],
  key: keyof Pick<
    ExtensionDebugSessionEvent,
    'app' | 'screen' | 'urlHost' | 'urlPath' | 'conversationId'
  >,
): string | null {
  for (const event of events) {
    const value = event[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function lastNonEmpty(
  events: ExtensionDebugSessionEvent[],
  key: keyof Pick<
    ExtensionDebugSessionEvent,
    'app' | 'screen' | 'urlHost' | 'urlPath' | 'conversationId' | 'error'
  >,
): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = events[index]?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function isLocationOrActionQuery(text: string | null | undefined): boolean {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;

  return /(where|how do i|how can i|switch|open|click|show me|take me|navigate|find)/.test(
    normalized,
  );
}

function buildTranscriptEntry(
  event: ExtensionDebugSessionEvent,
): ExtensionDebugSessionTranscriptEntry | null {
  if (
    event.eventType !== 'user_message' &&
    event.eventType !== 'assistant_message'
  ) {
    return null;
  }

  if (!event.messageText) return null;

  return {
    speaker: event.eventType === 'user_message' ? 'user' : 'assistant',
    turnId: event.turnId,
    occurredAt: event.occurredAt,
    messageText: event.messageText,
  };
}

function buildPageContextSnapshot(
  event: ExtensionDebugSessionEvent,
): ExtensionDebugSessionReviewPageContext | null {
  const hasContext =
    event.eventType === 'page_context_checked' ||
    !!event.pageSummary ||
    !!event.app ||
    !!event.screen ||
    !!event.selectedEntityTitle;

  if (!hasContext) return null;

  return {
    occurredAt: event.occurredAt,
    app: event.app,
    screen: event.screen,
    knowledgeMode: event.knowledgeMode,
    pageSummary: event.pageSummary,
    selectedEntityTitle: event.selectedEntityTitle,
    fingerprint: event.fingerprint,
  };
}

function buildTurnToolActions(
  events: ExtensionDebugSessionEvent[],
): ExtensionDebugSessionReviewToolAction[] {
  const actions: ExtensionDebugSessionReviewToolAction[] = [];
  const pending = new Map<string, number[]>();

  function keyFor(event: ExtensionDebugSessionEvent): string {
    return [event.toolName ?? 'unknown', event.selector ?? ''].join('||');
  }

  for (const event of events) {
    if (
      event.eventType !== 'tool_call_started' &&
      event.eventType !== 'tool_call_completed'
    ) {
      continue;
    }

    const key = keyFor(event);

    if (event.eventType === 'tool_call_started') {
      actions.push({
        toolName: event.toolName ?? 'unknown',
        status: 'started',
        occurredAt: event.occurredAt,
        selector: event.selector,
        label: event.label,
        action: event.action,
        inputTextPreview: event.inputTextPreview,
        inputTextLength: event.inputTextLength,
        resultText: null,
        error: null,
      });
      const indices = pending.get(key) ?? [];
      indices.push(actions.length - 1);
      pending.set(key, indices);
      continue;
    }

    const indices = pending.get(key) ?? [];
    const pendingIndex = indices.shift();
    if (indices.length > 0) {
      pending.set(key, indices);
    } else {
      pending.delete(key);
    }

    if (pendingIndex !== undefined) {
      const action = actions[pendingIndex];
      actions[pendingIndex] = {
        ...action,
        status: event.error ? 'failed' : 'completed',
        resultText: event.resultText,
        error: event.error,
        occurredAt: event.occurredAt,
      };
      continue;
    }

    actions.push({
      toolName: event.toolName ?? 'unknown',
      status: event.error ? 'failed' : 'completed',
      occurredAt: event.occurredAt,
      selector: event.selector,
      label: event.label,
      action: event.action,
      inputTextPreview: event.inputTextPreview,
      inputTextLength: event.inputTextLength,
      resultText: event.resultText,
      error: event.error,
    });
  }

  return actions;
}

function collectFailurePoints(args: {
  summary: ExtensionDebugSessionSummary | null;
  turns: ExtensionDebugSessionReviewTurn[];
  nonTurnEvents: ExtensionDebugSessionEvent[];
  events: ExtensionDebugSessionEvent[];
}): ExtensionDebugSessionFailurePoint[] {
  const points: ExtensionDebugSessionFailurePoint[] = [];

  const micIssue = args.events.find(
    (event) =>
      event.eventType === 'mic_permission_denied' ||
      /permission dismissed|microphone permission|permission is required/i.test(
        event.error ?? '',
      ),
  );
  if (micIssue) {
    points.push({
      code: 'mic_permission',
      severity: 'critical',
      title: 'Microphone permission blocked the session',
      evidence:
        micIssue.error ?? 'Microphone permission was denied or dismissed.',
    });
  }

  const toolFailure = args.events.find(
    (event) => event.eventType === 'tool_call_completed' && !!event.error,
  );
  if (toolFailure) {
    points.push({
      code: 'tool_failure',
      severity: 'warning',
      title: `Tool failed: ${toolFailure.toolName ?? 'unknown tool'}`,
      evidence: toolFailure.error ?? 'Tool call completed with an error.',
    });
  }

  const noActionTurn = args.turns.find(
    (turn) =>
      isLocationOrActionQuery(turn.userMessage) &&
      turn.assistantReplies.length > 0 &&
      turn.toolActions.length === 0,
  );
  if (noActionTurn) {
    points.push({
      code: 'agent_no_page_action',
      severity: 'warning',
      title: 'Assistant replied without grounding on the page',
      evidence:
        noActionTurn.userMessage ??
        'User asked for a page action or location, but no tool interaction was logged.',
    });
  }

  const domOnlyTurn = args.turns.find((turn) =>
    turn.pageContexts.some((context) => context.knowledgeMode === 'dom_only'),
  );
  if (domOnlyTurn || args.summary?.knowledgeMode === 'dom_only') {
    points.push({
      code: 'dom_only_guidance',
      severity: 'info',
      title: 'Session relied on DOM-only guidance',
      evidence:
        domOnlyTurn?.pageContexts[0]?.pageSummary ??
        'No vendor or org-specific knowledge match was available for this session.',
    });
  }

  const missingReplyTurn = args.turns.find(
    (turn) => !!turn.userMessage && turn.assistantReplies.length === 0,
  );
  if (missingReplyTurn) {
    points.push({
      code: 'no_assistant_reply',
      severity: 'warning',
      title: 'User turn ended without an assistant reply',
      evidence:
        missingReplyTurn.userMessage ??
        'A user turn had no assistant response.',
    });
  }

  const watchdogEvent = args.events.find(
    (event) => event.eventType === 'assistant_reply_watchdog_fired',
  );
  if (watchdogEvent) {
    points.push({
      code: 'assistant_reply_watchdog',
      severity: 'warning',
      title: 'Assistant stalled after a user turn or tool result',
      evidence:
        watchdogEvent.resultText ??
        'A watchdog fired because no assistant reply was observed in time.',
    });
  }

  const duplicateReply = args.events.find(
    (event) => event.eventType === 'duplicate_assistant_reply',
  );
  if (duplicateReply) {
    points.push({
      code: 'duplicate_assistant_reply',
      severity: 'warning',
      title: 'Assistant replied more than once without new grounding',
      evidence:
        duplicateReply.messageText ??
        duplicateReply.resultText ??
        'A duplicate assistant reply was observed in the same turn.',
    });
  }

  return points;
}

export function parseExtensionDebugSessionFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ExtensionDebugSessionFilters {
  const app = normalizeText(
    Array.isArray(searchParams.app) ? searchParams.app[0] : searchParams.app,
  ).toLowerCase();
  const host = normalizeText(
    Array.isArray(searchParams.host) ? searchParams.host[0] : searchParams.host,
  ).toLowerCase();
  const query = normalizeText(
    Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q,
  );
  const status = normalizeText(
    Array.isArray(searchParams.status)
      ? searchParams.status[0]
      : searchParams.status,
  ) as ExtensionDebugSessionStatus;
  const sinceValue = normalizeText(
    Array.isArray(searchParams.since)
      ? searchParams.since[0]
      : searchParams.since,
  ) as ExtensionDebugSessionSince;
  const rawLimit = Number.parseInt(
    Array.isArray(searchParams.limit)
      ? (searchParams.limit[0] ?? '')
      : (searchParams.limit ?? ''),
    10,
  );

  return {
    app: app && app !== 'all' ? app : undefined,
    host: host && host !== 'all' ? host : undefined,
    status: KNOWN_STATUSES.includes(status) ? status : undefined,
    query: query || undefined,
    limit: Number.isFinite(rawLimit) ? clampLimit(rawLimit) : 100,
    since: ['1h', '24h', '7d', '30d', 'all'].includes(sinceValue)
      ? sinceValue
      : '24h',
  };
}

export function normalizeExtensionDebugSessionEvent(
  row: EventRow,
): ExtensionDebugSessionEvent | null {
  if (row.type !== 'extension.debug_session.event') return null;
  if (!isRecord(row.payload)) return null;

  const payload = row.payload;
  const sessionId = readString(payload, 'sessionId');
  const eventType = readString(
    payload,
    'eventType',
  ) as ExtensionDebugSessionEventType | null;

  if (!readString(payload, 'orgId') || !sessionId || !eventType) {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.created_at,
    orgId: readString(payload, 'orgId')!,
    actorId: readString(payload, 'actorId'),
    authMethod:
      readString(payload, 'authMethod') === 'api_key' ? 'api_key' : 'session',
    sessionId,
    seq: readNumber(payload, 'seq') ?? 0,
    turnId: readString(payload, 'turnId'),
    eventType,
    occurredAt: readString(payload, 'occurredAt') ?? row.created_at,
    urlHost: readString(payload, 'urlHost'),
    urlPath: readString(payload, 'urlPath'),
    app: readString(payload, 'app'),
    screen: readString(payload, 'screen'),
    knowledgeMode:
      (readString(
        payload,
        'knowledgeMode',
      ) as ExtensionDebugSessionKnowledgeMode | null) ?? 'unknown',
    vendorMatchBasis:
      (readString(
        payload,
        'vendorMatchBasis',
      ) as ExtensionDebugSessionMatchBasis | null) ?? 'unknown',
    orgMatchBasis:
      (readString(
        payload,
        'orgMatchBasis',
      ) as ExtensionDebugSessionMatchBasis | null) ?? 'unknown',
    messageText: readString(payload, 'messageText'),
    toolName: readString(payload, 'toolName'),
    selector: readString(payload, 'selector'),
    label: readString(payload, 'label'),
    action: readString(payload, 'action'),
    inputTextPreview: readString(payload, 'inputTextPreview'),
    inputTextLength: readNumber(payload, 'inputTextLength'),
    resultText: readString(payload, 'resultText'),
    error: readString(payload, 'error'),
    pageSummary: readString(payload, 'pageSummary'),
    selectedEntityTitle: readString(payload, 'selectedEntityTitle'),
    tabId: readNumber(payload, 'tabId'),
    windowId: readNumber(payload, 'windowId'),
    conversationId: readString(payload, 'conversationId'),
    fingerprint: readString(payload, 'fingerprint'),
  };
}

export function summarizeExtensionDebugSessions(
  events: ExtensionDebugSessionEvent[],
): ExtensionDebugSessionSummary[] {
  const bySession = new Map<string, ExtensionDebugSessionEvent[]>();

  for (const event of events) {
    const existing = bySession.get(event.sessionId);
    if (existing) {
      existing.push(event);
    } else {
      bySession.set(event.sessionId, [event]);
    }
  }

  return Array.from(bySession.entries())
    .map(([sessionId, sessionEvents]) => {
      const orderedEvents = [...sessionEvents].sort(eventSort);
      const startedAt =
        orderedEvents[0]?.occurredAt ?? orderedEvents[0]?.createdAt;
      const endedEvent = [...orderedEvents]
        .reverse()
        .find((event) => event.eventType === 'session_ended');
      const hasError = orderedEvents.some(
        (event) => event.eventType === 'session_error' || !!event.error,
      );
      const status: ExtensionDebugSessionStatus = hasError
        ? 'failed'
        : endedEvent
          ? 'completed'
          : 'active';
      const lastEvent = orderedEvents[orderedEvents.length - 1];
      const assistantPreview =
        [...orderedEvents]
          .reverse()
          .find((event) => event.eventType === 'assistant_message')
          ?.messageText ?? null;

      return {
        id: sessionId,
        startedAt:
          startedAt ?? eventTimestamp(lastEvent) ?? new Date(0).toISOString(),
        endedAt: endedEvent?.occurredAt ?? null,
        lastEventAt: lastEvent
          ? eventTimestamp(lastEvent)
          : (startedAt ?? new Date(0).toISOString()),
        status,
        app: lastNonEmpty(orderedEvents, 'app') ?? 'unknown',
        screen: lastNonEmpty(orderedEvents, 'screen') ?? 'unknown',
        host: lastNonEmpty(orderedEvents, 'urlHost') ?? 'unknown',
        path: lastNonEmpty(orderedEvents, 'urlPath') ?? '/',
        knowledgeMode:
          [...orderedEvents]
            .reverse()
            .find((event) => event.knowledgeMode !== 'unknown')
            ?.knowledgeMode ?? 'unknown',
        turnCount: new Set(
          orderedEvents.map((event) => event.turnId).filter(Boolean),
        ).size,
        toolCallCount: orderedEvents.filter(
          (event) => event.eventType === 'tool_call_started',
        ).length,
        errorCount: orderedEvents.filter(
          (event) => event.eventType === 'session_error' || !!event.error,
        ).length,
        eventCount: orderedEvents.length,
        conversationId:
          lastNonEmpty(orderedEvents, 'conversationId') ??
          firstNonEmpty(orderedEvents, 'conversationId'),
        assistantPreview,
        latestError: lastNonEmpty(orderedEvents, 'error'),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
    );
}

export function matchesExtensionDebugSessionFilters(
  session: ExtensionDebugSessionSummary,
  filters: Partial<ExtensionDebugSessionFilters>,
): boolean {
  if (filters.app && session.app.toLowerCase() !== filters.app.toLowerCase()) {
    return false;
  }

  if (
    filters.host &&
    session.host.toLowerCase() !== filters.host.toLowerCase()
  ) {
    return false;
  }

  if (filters.status && session.status !== filters.status) {
    return false;
  }

  if (filters.query) {
    const haystack = [
      session.app,
      session.screen,
      session.host,
      session.path,
      session.assistantPreview,
      session.latestError,
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

export function buildExtensionDebugSessionTimeline(args: {
  sessionId: string;
  events: ExtensionDebugSessionEvent[];
}): ExtensionDebugSessionTimeline {
  const orderedEvents = args.events
    .filter((event) => event.sessionId === args.sessionId)
    .sort(eventSort);
  const turns = new Map<string, ExtensionDebugSessionTurn>();
  const nonTurnEvents: ExtensionDebugSessionEvent[] = [];

  for (const event of orderedEvents) {
    if (!event.turnId) {
      nonTurnEvents.push(event);
      continue;
    }

    const existing = turns.get(event.turnId);
    if (existing) {
      existing.events.push(event);
      if (!existing.userMessage && event.eventType === 'user_message') {
        existing.userMessage = event;
      }
      continue;
    }

    turns.set(event.turnId, {
      id: event.turnId,
      startedAt: event.occurredAt,
      userMessage: event.eventType === 'user_message' ? event : null,
      events: [event],
    });
  }

  const summary =
    summarizeExtensionDebugSessions(orderedEvents).find(
      (session) => session.id === args.sessionId,
    ) ?? null;

  return {
    sessionId: args.sessionId,
    summary,
    events: orderedEvents,
    turns: Array.from(turns.values()).sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    ),
    nonTurnEvents,
  };
}

export function buildExtensionDebugSessionReview(args: {
  sessionId: string;
  events: ExtensionDebugSessionEvent[];
}): ExtensionDebugSessionReview {
  const timeline = buildExtensionDebugSessionTimeline(args);
  const transcript = timeline.events
    .map((event) => buildTranscriptEntry(event))
    .filter(
      (entry): entry is ExtensionDebugSessionTranscriptEntry => entry !== null,
    );

  const turns = timeline.turns.map((turn) => {
    const turnEvents = [...turn.events].sort(eventSort);
    const assistantReplies = turnEvents
      .filter(
        (event) =>
          event.eventType === 'assistant_message' && !!event.messageText,
      )
      .map((event) => event.messageText as string);
    const transcriptEntries = turnEvents
      .map((event) => buildTranscriptEntry(event))
      .filter(
        (entry): entry is ExtensionDebugSessionTranscriptEntry =>
          entry !== null,
      );
    const turnStartTime = new Date(turn.startedAt).getTime();
    const latestPriorContext = [...timeline.nonTurnEvents]
      .reverse()
      .find(
        (event) =>
          event.eventType === 'page_context_checked' &&
          new Date(event.occurredAt).getTime() <= turnStartTime,
      );
    const pageContexts = [
      latestPriorContext ? buildPageContextSnapshot(latestPriorContext) : null,
      ...turnEvents.map((event) => buildPageContextSnapshot(event)),
    ].filter(
      (context): context is ExtensionDebugSessionReviewPageContext =>
        context !== null,
    );
    const dedupedPageContexts: ExtensionDebugSessionReviewPageContext[] = [];
    const seenFingerprints = new Set<string>();

    for (const context of pageContexts) {
      const fingerprint =
        context.fingerprint ??
        `${context.app}:${context.screen}:${context.pageSummary}`;
      if (seenFingerprints.has(fingerprint)) continue;
      seenFingerprints.add(fingerprint);
      dedupedPageContexts.push(context);
    }

    return {
      id: turn.id,
      startedAt: turn.startedAt,
      userMessage: turn.userMessage?.messageText ?? null,
      assistantReplies,
      toolActions: buildTurnToolActions(turnEvents),
      pageContexts: dedupedPageContexts,
      errors: turnEvents
        .map((event) => event.error)
        .filter((value): value is string => !!value),
      transcript: transcriptEntries,
    };
  });

  return {
    sessionId: timeline.sessionId,
    summary: timeline.summary,
    transcript,
    turns,
    nonTurnEvents: timeline.nonTurnEvents,
    failurePoints: collectFailurePoints({
      summary: timeline.summary,
      turns,
      nonTurnEvents: timeline.nonTurnEvents,
      events: timeline.events,
    }),
  };
}

export async function listExtensionDebugSessions(args: {
  orgId: string;
  filters: ExtensionDebugSessionFilters;
}): Promise<ListExtensionDebugSessionsResult> {
  const cutoff = cutoffFromSince(args.filters.since);
  const fetchLimit = Math.max(args.filters.limit * 10, 500);

  let query = supabaseAdmin
    .from('events')
    .select('id, type, payload, processed, created_at')
    .eq('type', 'extension.debug_session.event')
    .order('created_at', { ascending: false })
    .limit(Math.min(fetchLimit, 2000));

  if (cutoff) {
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to load extension debug session events: ${error.message}`,
    );
  }

  const normalized = (data ?? [])
    .map((row) => normalizeExtensionDebugSessionEvent(row))
    .filter((event): event is ExtensionDebugSessionEvent => event !== null)
    .filter((event) => event.orgId === args.orgId);

  const availableApps = Array.from(
    new Set(normalized.map((event) => event.app).filter(Boolean)),
  ).sort() as string[];
  const availableHosts = Array.from(
    new Set(normalized.map((event) => event.urlHost).filter(Boolean)),
  ).sort() as string[];
  const sessions = summarizeExtensionDebugSessions(normalized)
    .filter((session) =>
      matchesExtensionDebugSessionFilters(session, args.filters),
    )
    .slice(0, args.filters.limit);

  return {
    sessions,
    availableApps,
    availableHosts,
  };
}

export async function getExtensionDebugSessionTimeline(args: {
  orgId: string;
  sessionId: string;
}): Promise<ExtensionDebugSessionTimeline | null> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, type, payload, processed, created_at')
    .eq('type', 'extension.debug_session.event')
    .order('created_at', { ascending: true })
    .limit(2000);

  if (error) {
    throw new Error(
      `Failed to load extension debug session timeline: ${error.message}`,
    );
  }

  const normalized = (data ?? [])
    .map((row) => normalizeExtensionDebugSessionEvent(row))
    .filter((event): event is ExtensionDebugSessionEvent => event !== null)
    .filter(
      (event) =>
        event.orgId === args.orgId && event.sessionId === args.sessionId,
    );

  if (normalized.length === 0) {
    return null;
  }

  return buildExtensionDebugSessionTimeline({
    sessionId: args.sessionId,
    events: normalized,
  });
}

export async function getExtensionDebugSessionReview(args: {
  orgId: string;
  sessionId: string;
}): Promise<ExtensionDebugSessionReview | null> {
  const timeline = await getExtensionDebugSessionTimeline(args);
  if (!timeline) return null;

  return buildExtensionDebugSessionReview({
    sessionId: args.sessionId,
    events: timeline.events,
  });
}

export async function getLatestExtensionDebugSessionReview(args: {
  orgId: string;
  filters?: Partial<ExtensionDebugSessionFilters>;
}): Promise<ExtensionDebugSessionReview | null> {
  const { sessions } = await listExtensionDebugSessions({
    orgId: args.orgId,
    filters: {
      app: args.filters?.app,
      host: args.filters?.host,
      query: args.filters?.query,
      status: args.filters?.status,
      since: args.filters?.since ?? '24h',
      limit: 1,
    },
  });

  const latestSession = sessions[0];
  if (!latestSession) {
    return null;
  }

  return getExtensionDebugSessionReview({
    orgId: args.orgId,
    sessionId: latestSession.id,
  });
}
