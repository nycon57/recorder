import { unstable_cache } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { SOURCE_STATUS } from '@/lib/utils/status-helpers';
import type { Json } from '@/lib/types/database';
import type { KnowledgeSourceType } from '@/lib/types/knowledge-docs';

import {
  extractPendingContradictions,
  listPendingReviewPages,
  readCompilationLog,
  type PendingReviewPage,
} from './wiki-review';
import { getPendingApprovals } from './agent-permissions';
import {
  ROUTING_REVIEW_ACTION_TYPE,
  parseRoutingReviewProposedAction,
  type RoutingRoute,
} from './routing-review';

export type ReviewQueueKind =
  | 'contradiction'
  | 'routing'
  | 'manual-publication';

interface ReviewQueueAction {
  label: string;
  href: string;
}

interface RoutingReviewSourceLink {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  contributedAt: string;
  sourceTitle?: string | null;
}

export interface LegacyRoutingReviewCandidate {
  pageId: string;
  topic: string;
  app: string | null;
  screen: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLinks: RoutingReviewSourceLink[];
}

export interface ApprovalRoutingReviewCandidate {
  approvalId: string;
  contentId: string;
  title: string | null;
  createdAt: string;
  routeConfidence: number | null;
  routeReason: string | null;
  proposedRoute: RoutingRoute;
}

type RoutingReviewCandidate =
  | LegacyRoutingReviewCandidate
  | ApprovalRoutingReviewCandidate;

export interface ManualPublicationReviewCandidate {
  contentId: string;
  documentId: string;
  title: string | null;
  createdAt: string;
  connectorCount: number;
}

interface ReviewQueueContradictionItem {
  kind: 'contradiction';
  id: string;
  sortAt: string;
  pageId: string;
  logEntryIndex: number;
  topic: string;
  app: string | null;
  screen: string | null;
  currentContent: string;
  detectedAt: string;
  sourceRecordingId: string;
  contradictions: Array<{ old: string; new: string; field?: string }>;
  additions?: string[];
  mergedContentPreview?: string | null;
}

interface ReviewQueueRoutingLegacyItem {
  kind: 'routing';
  routingKind: 'legacy';
  id: string;
  sortAt: string;
  pageId: string;
  title: string;
  app: string | null;
  screen: string | null;
  sourceCount: number;
  summary: string;
  primaryAction: ReviewQueueAction;
  secondaryAction?: ReviewQueueAction;
}

interface ReviewQueueRoutingApprovalItem {
  kind: 'routing';
  routingKind: 'approval';
  id: string;
  sortAt: string;
  approvalId: string;
  contentId: string;
  title: string;
  topic: string;
  app: string | null;
  screen: string | null;
  sourceCount: number;
  summary: string;
  primaryAction: ReviewQueueAction;
  routeConfidence: number | null;
  routeReason: string | null;
}

type ReviewQueueRoutingItem =
  | ReviewQueueRoutingLegacyItem
  | ReviewQueueRoutingApprovalItem;

interface ReviewQueueManualPublicationItem {
  kind: 'manual-publication';
  id: string;
  sortAt: string;
  contentId: string;
  documentId: string;
  title: string;
  connectorCount: number;
  summary: string;
  primaryAction: ReviewQueueAction;
}

export type ReviewQueueItem =
  | ReviewQueueContradictionItem
  | ReviewQueueRoutingItem
  | ReviewQueueManualPublicationItem;

interface RoutingPageRow {
  id: string;
  topic: string;
  app: string | null;
  screen: string | null;
  created_at: string;
  updated_at: string;
  compilation_log: Json | null;
}

interface RoutingSourceRow {
  page_id: string;
  source_id: string;
  source_type: KnowledgeSourceType;
  contributed_at: string;
}

interface ContentTitleRow {
  id: string;
  title: string | null;
}

interface ContentQueueRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface DocumentQueueRow {
  id: string;
  content_id: string;
  created_at: string;
  status: 'generating' | 'generated' | 'edited' | 'error';
}

interface PublishedDocumentQueueRow {
  content_id: string;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortReviewQueueItems(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items.toSorted(
    (left, right) => toTimestamp(right.sortAt) - toTimestamp(left.sortAt),
  );
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

function formatRouteConfidence(value: number | null): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return `${Math.round(value * 100)}% confidence`;
}

export function buildReviewQueueItems(input: {
  contradictions: PendingReviewPage[];
  routing: RoutingReviewCandidate[];
  manualPublications: ManualPublicationReviewCandidate[];
}): ReviewQueueItem[] {
  const contradictionItems: ReviewQueueContradictionItem[] =
    input.contradictions.flatMap(({ page, pendingEntries }) =>
      pendingEntries.map(({ entryIndex, entry }) => ({
        kind: 'contradiction',
        id: `contradiction:${page.id}:${entryIndex}`,
        sortAt: entry.detected_at,
        pageId: page.id,
        logEntryIndex: entryIndex,
        topic: page.topic,
        app: page.app,
        screen: page.screen,
        currentContent: page.content,
        detectedAt: entry.detected_at,
        sourceRecordingId: entry.source_recording_id,
        contradictions: entry.contradictions ?? [],
        additions: entry.additions,
        mergedContentPreview: entry.merged_content ?? null,
      })),
    );

  const routingItems: ReviewQueueRoutingItem[] = input.routing.map(
    (candidate) => {
      if ('approvalId' in candidate) {
        const confidenceLabel = formatRouteConfidence(
          candidate.routeConfidence,
        );
        const summary = [
          confidenceLabel
            ? `${confidenceLabel}.`
            : 'Low-confidence route detected.',
          candidate.routeReason ??
            'Review and adjust the proposed topic, app, and screen before compile_wiki publishes.',
        ]
          .filter(Boolean)
          .join(' ');

        return {
          kind: 'routing',
          routingKind: 'approval',
          id: `routing-approval:${candidate.approvalId}`,
          sortAt: candidate.createdAt,
          approvalId: candidate.approvalId,
          contentId: candidate.contentId,
          title: candidate.title?.trim() || 'Untitled source',
          topic: candidate.proposedRoute.topic,
          app: candidate.proposedRoute.app,
          screen: candidate.proposedRoute.screen,
          sourceCount: 1,
          summary,
          primaryAction: {
            label: 'Open source detail',
            href: `/library/${candidate.contentId}`,
          },
          routeConfidence: candidate.routeConfidence,
          routeReason: candidate.routeReason,
        };
      }

      const [primarySource] = candidate.sourceLinks.toSorted(
        (left, right) =>
          toTimestamp(right.contributedAt) - toTimestamp(left.contributedAt),
      );

      const sourceCount = candidate.sourceLinks.length;
      const sourceDetailAction = primarySource
        ? {
            label: 'Open source detail',
            href: `/library/${primarySource.sourceId}`,
          }
        : null;

      return {
        kind: 'routing',
        routingKind: 'legacy',
        id: `routing:${candidate.pageId}`,
        sortAt:
          primarySource?.contributedAt ??
          candidate.updatedAt ??
          candidate.createdAt,
        pageId: candidate.pageId,
        title: candidate.topic,
        app: candidate.app,
        screen: candidate.screen,
        sourceCount,
        summary:
          sourceCount > 0
            ? `This page is missing an app or screen assignment. ${sourceCount} linked ${pluralize(
                sourceCount,
                'source',
              )} can be used to reroute it.`
            : 'This page is missing an app or screen assignment and needs manual routing.',
        primaryAction: sourceDetailAction ?? {
          label: 'Open knowledge health',
          href: '/knowledge/health',
        },
        secondaryAction: sourceDetailAction
          ? {
              label: 'Open knowledge health',
              href: '/knowledge/health',
            }
          : undefined,
      };
    },
  );

  const manualPublicationItems: ReviewQueueManualPublicationItem[] =
    input.manualPublications.map((candidate) => ({
      kind: 'manual-publication',
      id: `manual-publication:${candidate.contentId}`,
      sortAt: candidate.createdAt,
      contentId: candidate.contentId,
      documentId: candidate.documentId,
      title: candidate.title?.trim() || 'Untitled document',
      connectorCount: candidate.connectorCount,
      summary: `Ready to publish manually to ${candidate.connectorCount} connected ${pluralize(
        candidate.connectorCount,
        'destination',
      )}.`,
      primaryAction: {
        label: 'Open publish flow',
        href: `/library/${candidate.contentId}`,
      },
    }));

  return sortReviewQueueItems([
    ...contradictionItems,
    ...routingItems,
    ...manualPublicationItems,
  ]);
}

export function splitReviewQueueItemsByKind(
  items: ReviewQueueItem[],
): Record<ReviewQueueKind, ReviewQueueItem[]> {
  return items.reduce<Record<ReviewQueueKind, ReviewQueueItem[]>>(
    (groups, item) => {
      groups[item.kind].push(item);
      return groups;
    },
    {
      contradiction: [],
      routing: [],
      'manual-publication': [],
    },
  );
}

async function listLegacyRoutingReviewCandidates(
  orgId: string,
): Promise<LegacyRoutingReviewCandidate[]> {
  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('org_wiki_pages')
    .select('id, topic, app, screen, created_at, updated_at, compilation_log')
    .eq('org_id', orgId)
    .is('valid_until', null)
    .or('app.is.null,screen.is.null')
    .order('updated_at', { ascending: false });

  if (pagesError) {
    console.warn(
      '[review-queue] Failed to load routing review candidates:',
      pagesError.message,
    );
    return [];
  }

  const routingPages = ((pages ?? []) as RoutingPageRow[]).filter((page) => {
    const pendingCount = extractPendingContradictions(
      readCompilationLog(page.compilation_log),
    ).length;
    return pendingCount === 0;
  });

  if (routingPages.length === 0) {
    return [];
  }

  const pageIds = routingPages.map((page) => page.id);
  const { data: sourceLinks, error: sourceLinksError } = await supabaseAdmin
    .from('wiki_page_sources')
    .select('page_id, source_id, source_type, contributed_at')
    .in('page_id', pageIds);

  if (sourceLinksError) {
    console.warn(
      '[review-queue] Failed to load routing source links:',
      sourceLinksError.message,
    );
  }

  const normalizedSourceLinks = (sourceLinks ?? []) as RoutingSourceRow[];
  const contentIds = Array.from(
    new Set(
      normalizedSourceLinks.flatMap((__item, __index, __array) => {
        const __mapped = __item.source_id;
        return __mapped ? [__mapped] : [];
      }),
    ),
  );

  const contentTitles = new Map<string, string | null>();
  if (contentIds.length > 0) {
    const { data: contentRows, error: contentError } = await supabaseAdmin
      .from('content')
      .select('id, title')
      .in('id', contentIds);

    if (contentError) {
      console.warn(
        '[review-queue] Failed to load routing source titles:',
        contentError.message,
      );
    } else {
      for (const row of (contentRows ?? []) as ContentTitleRow[]) {
        contentTitles.set(row.id, row.title);
      }
    }
  }

  return routingPages.map((page) => ({
    pageId: page.id,
    topic: page.topic,
    app: page.app,
    screen: page.screen,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    sourceLinks: normalizedSourceLinks.flatMap((__item, __index, __array) =>
      __item.page_id === page.id
        ? [
            {
              sourceId: __item.source_id,
              sourceType: __item.source_type,
              contributedAt: __item.contributed_at,
              sourceTitle: contentTitles.get(__item.source_id) ?? null,
            },
          ]
        : [],
    ),
  }));
}

async function listPendingRoutingApprovalCandidates(
  orgId: string,
): Promise<ApprovalRoutingReviewCandidate[]> {
  const approvals = await getPendingApprovals(orgId);

  return approvals.flatMap((approval) => {
    if (approval.action_type !== ROUTING_REVIEW_ACTION_TYPE) return [];
    const proposedAction = parseRoutingReviewProposedAction(
      approval.proposed_action,
    );
    if (!proposedAction || !approval.content_id) {
      return [];
    }

    return [
      {
        approvalId: approval.id,
        contentId: approval.content_id,
        title: proposedAction.contentTitle,
        createdAt: approval.created_at ?? new Date(0).toISOString(),
        routeConfidence: proposedAction.routeConfidence,
        routeReason: proposedAction.routeReason,
        proposedRoute: proposedAction.proposedRoute,
      },
    ];
  });
}

async function listRoutingReviewCandidates(
  orgId: string,
): Promise<RoutingReviewCandidate[]> {
  const [approvalCandidates, legacyCandidates] = await Promise.all([
    listPendingRoutingApprovalCandidates(orgId),
    listLegacyRoutingReviewCandidates(orgId),
  ]);

  return [...approvalCandidates, ...legacyCandidates];
}

async function listManualPublicationReviewCandidates(
  orgId: string,
): Promise<ManualPublicationReviewCandidate[]> {
  const connectorsResult = await supabaseAdmin
    .from('connector_configs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_active', true)
    .eq('supports_publish', true);

  if (connectorsResult.error) {
    console.warn(
      '[review-queue] Failed to count publish-capable connectors:',
      connectorsResult.error.message,
    );
    return [];
  }

  const connectorCount = connectorsResult.count ?? 0;
  if (connectorCount === 0) {
    return [];
  }

  const settingsResult = await supabaseAdmin
    .from('org_publish_settings')
    .select('auto_publish_enabled')
    .eq('org_id', orgId)
    .maybeSingle();

  if (settingsResult.error && settingsResult.error.code !== 'PGRST116') {
    console.warn(
      '[review-queue] Failed to read publish settings:',
      settingsResult.error.message,
    );
    return [];
  }

  if (settingsResult.data?.auto_publish_enabled === true) {
    return [];
  }

  const { data: contentRows, error: contentError } = await supabaseAdmin
    .from('content')
    .select('id, title, created_at, updated_at, completed_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('status', SOURCE_STATUS.COMPLETED)
    .order('updated_at', { ascending: false });

  if (contentError) {
    console.warn(
      '[review-queue] Failed to load manual publication content candidates:',
      contentError.message,
    );
    return [];
  }

  const normalizedContentRows = (contentRows ?? []) as ContentQueueRow[];
  if (normalizedContentRows.length === 0) {
    return [];
  }

  const contentIds = normalizedContentRows.map((row) => row.id);
  const documentRowsResult = await supabaseAdmin
    .from('documents')
    .select('id, content_id, created_at, status')
    .eq('org_id', orgId)
    .in('content_id', contentIds)
    .in('status', ['generated', 'edited'])
    .order('created_at', { ascending: false });

  if (documentRowsResult.error) {
    console.warn(
      '[review-queue] Failed to load generated documents for publication review:',
      documentRowsResult.error.message,
    );
    return [];
  }

  const publicationRowsResult = await supabaseAdmin
    .from('published_documents')
    .select('content_id')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('content_id', contentIds);

  if (publicationRowsResult.error) {
    console.warn(
      '[review-queue] Failed to load existing publications:',
      publicationRowsResult.error.message,
    );
    return [];
  }

  const latestDocumentByContentId = new Map<string, DocumentQueueRow>();
  for (const row of (documentRowsResult.data ?? []) as DocumentQueueRow[]) {
    if (!latestDocumentByContentId.has(row.content_id)) {
      latestDocumentByContentId.set(row.content_id, row);
    }
  }

  const publishedContentIds = new Set(
    ((publicationRowsResult.data ?? []) as PublishedDocumentQueueRow[]).map(
      (row) => row.content_id,
    ),
  );

  return normalizedContentRows.flatMap((__item, __index, __array) =>
    latestDocumentByContentId.has(__item.id)
      ? !publishedContentIds.has(__item.id)
        ? [
            {
              contentId: __item.id,
              documentId: latestDocumentByContentId.get(__item.id)!.id,
              title: __item.title,
              createdAt:
                __item.completed_at ?? __item.updated_at ?? __item.created_at,
              connectorCount,
            },
          ]
        : []
      : [],
  );
}

export async function listReviewQueueItems(
  orgId: string,
): Promise<ReviewQueueItem[]> {
  const [contradictions, routing, manualPublications] = await Promise.all([
    listPendingReviewPages(orgId),
    listRoutingReviewCandidates(orgId),
    listManualPublicationReviewCandidates(orgId),
  ]);

  return buildReviewQueueItems({
    contradictions,
    routing,
    manualPublications,
  });
}

function getPendingReviewQueueCount(orgId: string): Promise<number> {
  return unstable_cache(
    async (id: string) => {
      const items = await listReviewQueueItems(id);
      return items.length;
    },
    ['review-queue-count', orgId],
    { revalidate: 60, tags: [`review-queue-count:${orgId}`] },
  )(orgId);
}
