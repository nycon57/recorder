import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';

export const ROUTING_REVIEW_AGENT_TYPE = 'wiki_compiler';
export const ROUTING_REVIEW_ACTION_TYPE = 'reroute_content';
export const ROUTING_REVIEW_METADATA_KEY = 'knowledge_routing_review';
export const ROUTING_REVIEW_CONFIDENCE_THRESHOLD = 0.7;

export interface RoutingRoute {
  topic: string;
  app: string | null;
  screen: string | null;
}

export interface RoutingReviewState {
  status: 'pending' | 'approved' | 'rejected';
  approvalId: string | null;
  requestedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: RoutingRoute;
  approvedRoute: RoutingRoute | null;
}

export interface RoutingReviewProposedAction {
  kind: 'routing_review';
  contentId: string;
  contentTitle: string | null;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: RoutingRoute;
}

function isRecord(value: Json | null | undefined): value is Record<string, Json> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clampConfidence(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function normalizeRoutingApp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'null' || trimmed === 'none') return null;
  return trimmed.slice(0, 120);
}

export function normalizeRoutingSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug || slug === 'null' || slug === 'none') return null;
  return slug.slice(0, 120);
}

export function normalizeRoutingRoute(input: {
  topic: unknown;
  app: unknown;
  screen: unknown;
}): RoutingRoute | null {
  const topic = normalizeRoutingSlug(input.topic);
  if (!topic) return null;

  return {
    topic,
    app: normalizeRoutingApp(input.app),
    screen: normalizeRoutingSlug(input.screen),
  };
}

export function requiresRoutingReview(input: {
  topic: string;
  app: string | null;
  screen: string | null;
  routeConfidence?: number | null;
}): boolean {
  const confidence = clampConfidence(input.routeConfidence);
  if (!input.app || !input.screen) return true;
  if (confidence !== null && confidence < ROUTING_REVIEW_CONFIDENCE_THRESHOLD) {
    return true;
  }
  return false;
}

export function parseRoutingReviewState(
  metadata: Json | null | undefined
): RoutingReviewState | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata[ROUTING_REVIEW_METADATA_KEY];
  if (!isRecord(raw)) return null;

  const status =
    raw.status === 'pending' ||
    raw.status === 'approved' ||
    raw.status === 'rejected'
      ? raw.status
      : null;

  const proposedRoute = normalizeRoutingRoute({
    topic: raw.proposedTopic,
    app: raw.proposedApp,
    screen: raw.proposedScreen,
  });

  if (!status || !proposedRoute) {
    return null;
  }

  const approvedRoute = normalizeRoutingRoute({
    topic: raw.approvedTopic,
    app: raw.approvedApp,
    screen: raw.approvedScreen,
  });

  return {
    status,
    approvalId: typeof raw.approvalId === 'string' ? raw.approvalId : null,
    requestedAt: typeof raw.requestedAt === 'string' ? raw.requestedAt : null,
    reviewedAt: typeof raw.reviewedAt === 'string' ? raw.reviewedAt : null,
    reviewedBy: typeof raw.reviewedBy === 'string' ? raw.reviewedBy : null,
    rejectionReason:
      typeof raw.rejectionReason === 'string' ? raw.rejectionReason : null,
    routeConfidence: clampConfidence(
      typeof raw.routeConfidence === 'number' ? raw.routeConfidence : null
    ),
    routeReason: typeof raw.routeReason === 'string' ? raw.routeReason : null,
    proposedRoute,
    approvedRoute,
  };
}

export function getApprovedRoutingOverride(
  metadata: Json | null | undefined
): RoutingRoute | null {
  const state = parseRoutingReviewState(metadata);
  if (!state || state.status !== 'approved' || !state.approvedRoute) {
    return null;
  }
  return state.approvedRoute;
}

export function writeRoutingReviewState(
  metadata: Json | null | undefined,
  state: RoutingReviewState
): Json {
  const next = isRecord(metadata) ? { ...metadata } : {};
  next[ROUTING_REVIEW_METADATA_KEY] = {
    status: state.status,
    approvalId: state.approvalId,
    requestedAt: state.requestedAt,
    reviewedAt: state.reviewedAt,
    reviewedBy: state.reviewedBy,
    rejectionReason: state.rejectionReason,
    routeConfidence: state.routeConfidence,
    routeReason: state.routeReason,
    proposedTopic: state.proposedRoute.topic,
    proposedApp: state.proposedRoute.app,
    proposedScreen: state.proposedRoute.screen,
    approvedTopic: state.approvedRoute?.topic ?? null,
    approvedApp: state.approvedRoute?.app ?? null,
    approvedScreen: state.approvedRoute?.screen ?? null,
  } as Json;
  return next as Json;
}

export function buildRoutingReviewProposedAction(input: {
  contentId: string;
  contentTitle: string | null;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: RoutingRoute;
}): RoutingReviewProposedAction {
  return {
    kind: 'routing_review',
    contentId: input.contentId,
    contentTitle: input.contentTitle?.trim() || null,
    routeConfidence: clampConfidence(input.routeConfidence),
    routeReason: input.routeReason?.trim() || null,
    proposedRoute: input.proposedRoute,
  };
}

export function parseRoutingReviewProposedAction(
  value: Json | null | undefined
): RoutingReviewProposedAction | null {
  if (!isRecord(value)) return null;
  if (value.kind !== 'routing_review') return null;
  if (typeof value.contentId !== 'string') return null;

  const proposedRoute = normalizeRoutingRoute({
    topic: value.proposedRoute && isRecord(value.proposedRoute)
      ? value.proposedRoute.topic
      : null,
    app: value.proposedRoute && isRecord(value.proposedRoute)
      ? value.proposedRoute.app
      : null,
    screen: value.proposedRoute && isRecord(value.proposedRoute)
      ? value.proposedRoute.screen
      : null,
  });

  if (!proposedRoute) {
    return null;
  }

  return {
    kind: 'routing_review',
    contentId: value.contentId,
    contentTitle:
      typeof value.contentTitle === 'string' ? value.contentTitle : null,
    routeConfidence: clampConfidence(
      typeof value.routeConfidence === 'number' ? value.routeConfidence : null
    ),
    routeReason: typeof value.routeReason === 'string' ? value.routeReason : null,
    proposedRoute,
  };
}

export function buildRoutingReviewDescription(input: {
  contentTitle: string | null;
  proposedRoute: RoutingRoute;
  routeConfidence: number | null;
}): string {
  const sourceLabel = input.contentTitle?.trim() || 'Untitled source';
  const routeLabel = [
    input.proposedRoute.topic,
    input.proposedRoute.app ?? 'unassigned-app',
    input.proposedRoute.screen ?? 'unassigned-screen',
  ].join(' / ');
  const confidenceLabel =
    typeof input.routeConfidence === 'number'
      ? ` (${Math.round(input.routeConfidence * 100)}% confidence)`
      : '';

  return `Review routing for ${sourceLabel}: ${routeLabel}${confidenceLabel}`;
}

export function buildRoutingCompileWikiDedupeKey(input: {
  recordingId: string;
  approvalId: string;
}): string {
  return `compile_wiki:reroute:${input.recordingId}:${input.approvalId}`;
}

export async function enqueueRoutingCompileWikiJob(input: {
  recordingId: string;
  orgId: string;
  approvalId: string;
}): Promise<void> {
  const dedupeKey = buildRoutingCompileWikiDedupeKey({
    recordingId: input.recordingId,
    approvalId: input.approvalId,
  });

  const { error } = await supabaseAdmin.from('jobs').insert({
    type: 'compile_wiki',
    status: 'pending',
    payload: {
      recordingId: input.recordingId,
      orgId: input.orgId,
      triggeredBy: 'routing_review',
      approvalId: input.approvalId,
    },
    dedupe_key: dedupeKey,
    priority: 2,
  });

  if (error && error.code !== '23505') {
    throw new Error(`Failed to enqueue compile_wiki reroute job: ${error.message}`);
  }
}
