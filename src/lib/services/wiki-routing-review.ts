import { createHash } from 'node:crypto';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

import { requestApproval } from './agent-permissions';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type JobInsert = Database['public']['Tables']['jobs']['Insert'];

export interface WikiRoute {
  app: string | null;
  screen: string | null;
  topic: string;
}

export interface WikiRoutingClassification extends WikiRoute {
  routingConfidence: number;
  routingRationale: string;
  ambiguous: boolean;
  ambiguityReasons: string[];
}

export interface ApprovedWikiRoutingOverride {
  approvalId: string | null;
  approvedAt: string;
  reviewedBy: string | null;
  note?: string | null;
  route: WikiRoute;
}

export interface WikiRoutingReviewDecision {
  requiresReview: boolean;
  reasons: string[];
}

interface WikiRoutingAuditEntry {
  kind: 'queued' | 'approved' | 'rejected' | 'compiled';
  at: string;
  route: WikiRoute;
  approvalId?: string | null;
  confidence?: number;
  rationale?: string | null;
  reviewReasons?: string[];
  ambiguityReasons?: string[];
  reviewedBy?: string | null;
  note?: string | null;
  source?: 'classification' | 'approved-override';
}

export interface WikiRoutingReviewState {
  version: 1;
  pendingReview: {
    status: 'pending';
    approvalId: string | null;
    proposedRoute: WikiRoute;
    confidence: number;
    rationale: string;
    ambiguous: boolean;
    ambiguityReasons: string[];
    reviewReasons: string[];
    requestedAt: string;
  } | null;
  approvedOverride: ApprovedWikiRoutingOverride | null;
  lastCompiledRoute: {
    route: WikiRoute;
    source: 'classification' | 'approved-override';
    compiledAt: string;
  } | null;
  auditLog: WikiRoutingAuditEntry[];
}

export interface ResolveWikiRouteForCompileResult {
  source: 'classification' | 'approved-override';
  route: WikiRoute;
  approvedOverride: ApprovedWikiRoutingOverride | null;
}

const ROUTING_METADATA_KEY = 'wiki_routing_review';
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
const DEFAULT_JOB_PRIORITY = 2;

const WIKI_ROUTING_APPROVAL_ACTION = 'review_wiki_routing';

function isJsonObject(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toMetadataRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return isJsonObject(value) ? { ...value } : {};
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function cloneAuditLog(value: unknown): WikiRoutingAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value as WikiRoutingAuditEntry[];
}

function normalizeRoute(value: unknown): WikiRoute | null {
  if (!isJsonObject(value)) return null;
  const topic = typeof value.topic === 'string' ? value.topic.trim() : '';
  if (!topic) return null;
  const app = typeof value.app === 'string' && value.app.trim().length > 0
    ? value.app.trim()
    : null;
  const screen = typeof value.screen === 'string' && value.screen.trim().length > 0
    ? value.screen.trim()
    : null;
  return { app, screen, topic };
}

function appendAuditEntry(
  state: WikiRoutingReviewState,
  entry: WikiRoutingAuditEntry
): WikiRoutingReviewState {
  return {
    ...state,
    auditLog: [...state.auditLog, entry],
  };
}

function writeRoutingState(
  metadata: Json | null | undefined,
  state: WikiRoutingReviewState
): Record<string, Json | undefined> {
  const nextMetadata = toMetadataRecord(metadata);
  nextMetadata[ROUTING_METADATA_KEY] = state as unknown as Json;
  return nextMetadata;
}

export function readWikiRoutingReviewState(
  metadata: Json | null | undefined
): WikiRoutingReviewState {
  const root = toMetadataRecord(metadata);
  const rawState = root[ROUTING_METADATA_KEY];

  if (!isJsonObject(rawState)) {
    return {
      version: 1,
      pendingReview: null,
      approvedOverride: null,
      lastCompiledRoute: null,
      auditLog: [],
    };
  }

  const pendingRaw = rawState.pendingReview;
  const approvedRaw = rawState.approvedOverride;
  const compiledRaw = rawState.lastCompiledRoute;

  const pendingRoute = pendingRaw && isJsonObject(pendingRaw)
    ? normalizeRoute(pendingRaw.proposedRoute)
    : null;
  const approvedRoute = normalizeRoute(approvedRaw && isJsonObject(approvedRaw)
    ? approvedRaw.route
    : null);
  const compiledRoute = normalizeRoute(compiledRaw && isJsonObject(compiledRaw)
    ? compiledRaw.route
    : null);

  return {
    version: 1,
    pendingReview:
      pendingRaw && isJsonObject(pendingRaw) && pendingRoute
        ? {
            status: 'pending',
            approvalId:
              typeof pendingRaw.approvalId === 'string' ? pendingRaw.approvalId : null,
            proposedRoute: pendingRoute,
            confidence: clampConfidence(Number(pendingRaw.confidence ?? 0)),
            rationale:
              typeof pendingRaw.rationale === 'string' ? pendingRaw.rationale : '',
            ambiguous: pendingRaw.ambiguous === true,
            ambiguityReasons: Array.isArray(pendingRaw.ambiguityReasons)
              ? pendingRaw.ambiguityReasons.filter(
                  (reason): reason is string =>
                    typeof reason === 'string' && reason.trim().length > 0
                )
              : [],
            reviewReasons: Array.isArray(pendingRaw.reviewReasons)
              ? pendingRaw.reviewReasons.filter(
                  (reason): reason is string =>
                    typeof reason === 'string' && reason.trim().length > 0
                )
              : [],
            requestedAt:
              typeof pendingRaw.requestedAt === 'string' ? pendingRaw.requestedAt : '',
          }
        : null,
    approvedOverride:
      approvedRaw && isJsonObject(approvedRaw) && approvedRoute
        ? {
            approvalId:
              typeof approvedRaw.approvalId === 'string' ? approvedRaw.approvalId : null,
            approvedAt:
              typeof approvedRaw.approvedAt === 'string' ? approvedRaw.approvedAt : '',
            reviewedBy:
              typeof approvedRaw.reviewedBy === 'string' ? approvedRaw.reviewedBy : null,
            note: typeof approvedRaw.note === 'string' ? approvedRaw.note : null,
            route: approvedRoute,
          }
        : null,
    lastCompiledRoute:
      compiledRaw && isJsonObject(compiledRaw) && compiledRoute
        ? {
            route: compiledRoute,
            source:
              compiledRaw.source === 'approved-override'
                ? 'approved-override'
                : 'classification',
            compiledAt:
              typeof compiledRaw.compiledAt === 'string' ? compiledRaw.compiledAt : '',
          }
        : null,
    auditLog: cloneAuditLog(rawState.auditLog),
  };
}

export function readApprovedWikiRoutingOverride(
  metadata: Json | null | undefined
): ApprovedWikiRoutingOverride | null {
  return readWikiRoutingReviewState(metadata).approvedOverride;
}

export function shouldQueueWikiRoutingReview(
  classification: WikiRoutingClassification,
  options: { confidenceThreshold?: number } = {}
): WikiRoutingReviewDecision {
  const reasons = new Set<string>();
  const confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  if (!classification.topic.trim()) {
    reasons.add('missing-topic');
  }
  if (classification.routingConfidence < confidenceThreshold) {
    reasons.add('low-confidence');
  }
  if (classification.app === null) {
    reasons.add('missing-app');
  }
  if (classification.screen === null) {
    reasons.add('missing-screen');
  }
  if (classification.ambiguous || classification.ambiguityReasons.length > 0) {
    reasons.add('ambiguous-routing');
  }

  return {
    requiresReview: reasons.size > 0,
    reasons: [...reasons],
  };
}

export function queueWikiRoutingReviewMetadata(
  metadata: Json | null | undefined,
  input: {
    approvalId: string | null;
    requestedAt: string;
    classification: WikiRoutingClassification;
    reviewReasons: string[];
  }
): Record<string, Json | undefined> {
  const state = readWikiRoutingReviewState(metadata);
  const nextState = appendAuditEntry(
    {
      ...state,
      pendingReview: {
        status: 'pending',
        approvalId: input.approvalId,
        proposedRoute: {
          app: input.classification.app,
          screen: input.classification.screen,
          topic: input.classification.topic,
        },
        confidence: clampConfidence(input.classification.routingConfidence),
        rationale: input.classification.routingRationale,
        ambiguous: input.classification.ambiguous,
        ambiguityReasons: [...input.classification.ambiguityReasons],
        reviewReasons: [...input.reviewReasons],
        requestedAt: input.requestedAt,
      },
    },
    {
      kind: 'queued',
      at: input.requestedAt,
      approvalId: input.approvalId,
      route: {
        app: input.classification.app,
        screen: input.classification.screen,
        topic: input.classification.topic,
      },
      confidence: clampConfidence(input.classification.routingConfidence),
      rationale: input.classification.routingRationale,
      reviewReasons: [...input.reviewReasons],
      ambiguityReasons: [...input.classification.ambiguityReasons],
    }
  );

  return writeRoutingState(metadata, nextState);
}

export function approveWikiRoutingOverrideMetadata(
  metadata: Json | null | undefined,
  input: {
    approvalId: string | null;
    approvedAt: string;
    reviewedBy: string | null;
    route: WikiRoute;
    note?: string | null;
  }
): Record<string, Json | undefined> {
  const state = readWikiRoutingReviewState(metadata);
  const nextState = appendAuditEntry(
    {
      ...state,
      pendingReview: null,
      approvedOverride: {
        approvalId: input.approvalId,
        approvedAt: input.approvedAt,
        reviewedBy: input.reviewedBy,
        note: input.note ?? null,
        route: input.route,
      },
    },
    {
      kind: 'approved',
      at: input.approvedAt,
      approvalId: input.approvalId,
      reviewedBy: input.reviewedBy,
      note: input.note ?? null,
      route: input.route,
    }
  );

  return writeRoutingState(metadata, nextState);
}

function rejectWikiRoutingReviewMetadata(
  metadata: Json | null | undefined,
  input: {
    rejectedAt: string;
    reviewedBy: string | null;
    note?: string | null;
  }
): Record<string, Json | undefined> {
  const state = readWikiRoutingReviewState(metadata);
  const route = state.pendingReview?.proposedRoute ?? state.lastCompiledRoute?.route ?? {
    app: null,
    screen: null,
    topic: 'unknown',
  };

  const nextState = appendAuditEntry(
    {
      ...state,
      pendingReview: null,
    },
    {
      kind: 'rejected',
      at: input.rejectedAt,
      reviewedBy: input.reviewedBy,
      note: input.note ?? null,
      route,
    }
  );

  return writeRoutingState(metadata, nextState);
}

export function markWikiRoutingCompileCompletedMetadata(
  metadata: Json | null | undefined,
  input: {
    compiledAt: string;
    route: WikiRoute;
    source: 'classification' | 'approved-override';
  }
): Record<string, Json | undefined> {
  const state = readWikiRoutingReviewState(metadata);
  const approvalId =
    input.source === 'approved-override'
      ? state.approvedOverride?.approvalId ?? null
      : state.pendingReview?.approvalId ?? null;

  const nextState = appendAuditEntry(
    {
      ...state,
      pendingReview: null,
      lastCompiledRoute: {
        route: input.route,
        source: input.source,
        compiledAt: input.compiledAt,
      },
    },
    {
      kind: 'compiled',
      at: input.compiledAt,
      approvalId,
      route: input.route,
      source: input.source,
    }
  );

  return writeRoutingState(metadata, nextState);
}

export function resolveWikiRouteForCompile(input: {
  metadata: Json | null | undefined;
  classification: WikiRoutingClassification;
}): ResolveWikiRouteForCompileResult {
  const approvedOverride = readApprovedWikiRoutingOverride(input.metadata);
  if (approvedOverride) {
    return {
      source: 'approved-override',
      route: approvedOverride.route,
      approvedOverride,
    };
  }

  return {
    source: 'classification',
    route: {
      app: input.classification.app,
      screen: input.classification.screen,
      topic: input.classification.topic,
    },
    approvedOverride: null,
  };
}

function buildRouteFingerprint(route: WikiRoute | undefined): string {
  if (!route) return 'no-route';
  return createHash('sha1')
    .update(JSON.stringify(route))
    .digest('hex')
    .slice(0, 10);
}

export function buildCompileWikiDedupeKey(input: {
  recordingId: string;
  reason?: string;
  enqueueToken?: string;
  route?: WikiRoute;
}): string {
  if (!input.reason && !input.enqueueToken && !input.route) {
    return `compile_wiki:${input.recordingId}`;
  }

  const reason = input.reason?.trim() || 'manual';
  const token = input.enqueueToken?.trim() || 'no-token';
  const routeFingerprint = buildRouteFingerprint(input.route);

  return `compile_wiki:${input.recordingId}:${reason}:${token}:${routeFingerprint}`;
}

function buildRoutingReviewDescription(
  recordingId: string,
  classification: WikiRoutingClassification,
  reviewReasons: string[]
): string {
  const routePreview = [
    classification.app ?? '(no app)',
    classification.screen ?? '(no screen)',
    classification.topic,
  ].join(' / ');

  return (
    `Review wiki routing for recording ${recordingId}: ${routePreview} ` +
    `(confidence ${classification.routingConfidence.toFixed(2)}; reasons: ${reviewReasons.join(', ')})`
  );
}

async function updateContentMetadata(input: {
  supabase: SupabaseAdminClient;
  orgId: string;
  recordingId: string;
  metadata: Record<string, Json | undefined>;
}): Promise<void> {
  const { error } = await input.supabase
    .from('content')
    .update(
      {
        metadata: input.metadata as unknown as Json,
        updated_at: new Date().toISOString(),
      } as never
    )
    .eq('id', input.recordingId)
    .eq('org_id', input.orgId);

  if (error) {
    throw new Error(`Failed to update content metadata: ${error.message}`);
  }
}

async function requestWikiRoutingReview(input: {
  supabase?: SupabaseAdminClient;
  orgId: string;
  recordingId: string;
  currentMetadata: Json | null | undefined;
  classification: WikiRoutingClassification;
  reviewReasons: string[];
}): Promise<{ approvalId: string; metadata: Record<string, Json | undefined> }> {
  const supabase = input.supabase ?? createAdminClient();
  const requestedAt = new Date().toISOString();
  const approvalId = await requestApproval({
    orgId: input.orgId,
    agentType: 'wiki_compiler',
    actionType: WIKI_ROUTING_APPROVAL_ACTION,
    contentId: input.recordingId,
    description: buildRoutingReviewDescription(
      input.recordingId,
      input.classification,
      input.reviewReasons
    ),
    proposedAction: {
      kind: 'wiki_routing_review',
      proposedRoute: {
        app: input.classification.app,
        screen: input.classification.screen,
        topic: input.classification.topic,
      },
      routingConfidence: clampConfidence(input.classification.routingConfidence),
      routingRationale: input.classification.routingRationale,
      ambiguous: input.classification.ambiguous,
      ambiguityReasons: input.classification.ambiguityReasons,
      reviewReasons: input.reviewReasons,
      requestedAt,
    } as unknown as Json,
  });

  const nextMetadata = queueWikiRoutingReviewMetadata(input.currentMetadata, {
    approvalId,
    requestedAt,
    classification: input.classification,
    reviewReasons: input.reviewReasons,
  });

  await updateContentMetadata({
    supabase,
    orgId: input.orgId,
    recordingId: input.recordingId,
    metadata: nextMetadata,
  });

  return { approvalId, metadata: nextMetadata };
}

async function markWikiRoutingCompileCompleted(input: {
  supabase?: SupabaseAdminClient;
  orgId: string;
  recordingId: string;
  currentMetadata: Json | null | undefined;
  route: WikiRoute;
  source: 'classification' | 'approved-override';
}): Promise<Record<string, Json | undefined>> {
  const supabase = input.supabase ?? createAdminClient();
  const compiledAt = new Date().toISOString();
  const nextMetadata = markWikiRoutingCompileCompletedMetadata(input.currentMetadata, {
    compiledAt,
    route: input.route,
    source: input.source,
  });

  await updateContentMetadata({
    supabase,
    orgId: input.orgId,
    recordingId: input.recordingId,
    metadata: nextMetadata,
  });

  return nextMetadata;
}

async function enqueueCompileWikiJob(input: {
  supabase?: SupabaseAdminClient;
  recordingId: string;
  orgId: string;
  reason?: string;
  enqueueToken?: string;
  route?: WikiRoute;
  priority?: number;
}): Promise<{ queued: boolean; duplicate: boolean; dedupeKey: string }> {
  const supabase = input.supabase ?? createAdminClient();
  const dedupeKey = buildCompileWikiDedupeKey({
    recordingId: input.recordingId,
    reason: input.reason,
    enqueueToken: input.enqueueToken,
    route: input.route,
  });

  const insertPayload: JobInsert = {
    type: 'compile_wiki',
    status: 'pending',
    payload: {
      recordingId: input.recordingId,
      orgId: input.orgId,
    } as unknown as Json,
    dedupe_key: dedupeKey,
    priority: input.priority ?? DEFAULT_JOB_PRIORITY,
  };

  const { error } = await supabase.from('jobs').insert(insertPayload as never);

  if (error) {
    if (error.code === '23505') {
      return {
        queued: false,
        duplicate: true,
        dedupeKey,
      };
    }
    throw new Error(`Failed to enqueue compile_wiki job: ${error.message}`);
  }

  return {
    queued: true,
    duplicate: false,
    dedupeKey,
  };
}
