import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import type { KnowledgeSourceType } from '@/lib/types/knowledge-docs';
import {
  extractPendingContradictions,
  listPendingReviewPages,
  readCompilationLog,
  type PendingReviewPage,
} from '@/lib/services/wiki-review';

type ReviewQueueKind = 'contradiction' | 'routing';

interface RoutingReviewSourceLink {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  contributedAt: string;
  sourceTitle?: string | null;
}

interface RoutingReviewCandidate {
  pageId: string;
  topic: string;
  app: string | null;
  screen: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLinks: RoutingReviewSourceLink[];
}

export interface ReviewQueueContradictionItem {
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

export interface ReviewQueueRoutingItem {
  kind: 'routing';
  id: string;
  sortAt: string;
  pageId: string;
  title: string;
  topic: string;
  app: string | null;
  screen: string | null;
  sourceCount: number;
  summary: string;
  latestSourceId: string | null;
  latestSourceTitle: string | null;
  latestSourceType: RoutingReviewSourceLink['sourceType'] | null;
  latestSourceAt: string | null;
}

export type ReviewQueueItem =
  | ReviewQueueContradictionItem
  | ReviewQueueRoutingItem;

type RoutingPageRow = Pick<
  Database['public']['Tables']['org_wiki_pages']['Row'],
  | 'id'
  | 'topic'
  | 'app'
  | 'screen'
  | 'created_at'
  | 'updated_at'
  | 'compilation_log'
>;

interface RoutingSourceRow {
  page_id: string;
  source_id: string;
  source_type: KnowledgeSourceType;
  contributed_at: string;
}

type ContentTitleRow = Pick<
  Database['public']['Tables']['content']['Row'],
  'id' | 'title'
>;

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

function sortReviewQueueItems(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items.toSorted(
    (left, right) => toTimestamp(right.sortAt) - toTimestamp(left.sortAt),
  );
}

function describeRoutingGap(
  candidate: Pick<RoutingReviewCandidate, 'app' | 'screen'>,
): string {
  if (!candidate.app && !candidate.screen) {
    return 'This page is missing both an app and screen assignment.';
  }

  if (!candidate.app) {
    return 'This page is missing an app assignment.';
  }

  if (!candidate.screen) {
    return 'This page is missing a screen assignment.';
  }

  return 'This routing decision still needs reviewer confirmation.';
}

async function listPendingRoutingReviewCandidates(
  orgId: string,
): Promise<RoutingReviewCandidate[]> {
  const { data: pages, error: pagesError } = await supabaseAdmin
    .from('org_wiki_pages')
    .select('id, topic, app, screen, created_at, updated_at, compilation_log')
    .eq('org_id', orgId)
    .is('valid_until', null)
    .or('app.is.null,screen.is.null')
    .order('updated_at', { ascending: false });

  if (pagesError) {
    console.warn(
      '[wiki-review] Failed to load routing review candidates:',
      pagesError.message,
    );
    return [];
  }

  const routingPages = ((pages ?? []) as RoutingPageRow[]).filter((page) => {
    const pendingContradictions = extractPendingContradictions(
      readCompilationLog(page.compilation_log),
    );
    return pendingContradictions.length === 0;
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
      '[wiki-review] Failed to load routing source links:',
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
        '[wiki-review] Failed to load routing source titles:',
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

function buildReviewQueueItems(input: {
  contradictions: PendingReviewPage[];
  routing: RoutingReviewCandidate[];
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
      const [latestSource] = candidate.sourceLinks.toSorted(
        (left, right) =>
          toTimestamp(right.contributedAt) - toTimestamp(left.contributedAt),
      );

      const sourceCount = candidate.sourceLinks.length;
      const sourceSummary =
        sourceCount > 0
          ? `${sourceCount} linked ${pluralize(sourceCount, 'source')} available for review.`
          : 'No linked source context has been attached yet.';

      return {
        kind: 'routing',
        id: `routing:${candidate.pageId}`,
        sortAt:
          latestSource?.contributedAt ??
          candidate.updatedAt ??
          candidate.createdAt,
        pageId: candidate.pageId,
        title: candidate.topic,
        topic: candidate.topic,
        app: candidate.app,
        screen: candidate.screen,
        sourceCount,
        summary: `${describeRoutingGap(candidate)} ${sourceSummary}`,
        latestSourceId: latestSource?.sourceId ?? null,
        latestSourceTitle: latestSource?.sourceTitle ?? null,
        latestSourceType: latestSource?.sourceType ?? null,
        latestSourceAt: latestSource?.contributedAt ?? null,
      };
    },
  );

  return sortReviewQueueItems([...contradictionItems, ...routingItems]);
}

export function splitReviewQueueItemsByKind(items: ReviewQueueItem[]): {
  contradiction: ReviewQueueContradictionItem[];
  routing: ReviewQueueRoutingItem[];
} {
  return items.reduce<{
    contradiction: ReviewQueueContradictionItem[];
    routing: ReviewQueueRoutingItem[];
  }>(
    (groups, item) => {
      if (item.kind === 'contradiction') {
        groups.contradiction.push(item);
      } else {
        groups.routing.push(item);
      }
      return groups;
    },
    { contradiction: [], routing: [] },
  );
}

export async function listReviewQueueItems(
  orgId: string,
): Promise<ReviewQueueItem[]> {
  const [contradictions, routing] = await Promise.all([
    listPendingReviewPages(orgId),
    listPendingRoutingReviewCandidates(orgId),
  ]);

  return buildReviewQueueItems({ contradictions, routing });
}
