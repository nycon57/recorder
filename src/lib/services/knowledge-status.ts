import { supabaseAdmin } from '../supabase/admin';
import type { Database } from '../types/database';
import { SOURCE_STATUS } from '../utils/status-helpers';
import {
  getKnowledgeStatusMeta,
  resolveKnowledgeStatusForSource,
  resolveSourceWikiPageStatus,
  summarizeKnowledgeStatusCounts,
  resolveKnowledgeStatusForWikiPage,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_DISPLAY_ORDER,
  type KnowledgeStatusCounts,
  type KnowledgeStatus,
  type KnowledgeStatusMeta,
} from '../utils/knowledge-status';

import {
  extractPendingContradictions,
  readCompilationLog,
} from './wiki-review';

type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];

export interface KnowledgeStatusSummary {
  counts: KnowledgeStatusCounts;
  total: number;
}

export {
  getKnowledgeStatusMeta,
  resolveKnowledgeStatusForSource,
  resolveSourceWikiPageStatus,
  resolveKnowledgeStatusForWikiPage,
  summarizeKnowledgeStatusCounts,
  KNOWLEDGE_STATUS,
  type KnowledgeStatus,
} from '../utils/knowledge-status';

export async function fetchKnowledgeStatusForSource(input: {
  orgId: string;
  sourceId: string;
  sourceStatus: string;
}): Promise<KnowledgeStatus> {
  const fallbackStatus = resolveKnowledgeStatusForSource({
    sourceStatus: input.sourceStatus,
    wikiPageStatus: null,
  });

  const { data: sourceLinks, error: sourceLinksError } = await supabaseAdmin
    .from('wiki_page_sources')
    .select('page_id')
    .eq('source_id', input.sourceId);

  if (sourceLinksError) {
    console.warn(
      '[knowledge-status] Failed to load wiki source links for source detail:',
      sourceLinksError.message,
    );
    return fallbackStatus;
  }

  const pageIds = Array.from(
    new Set(
      (sourceLinks ?? []).flatMap((__item, __index, __array) => {
        const __mapped = __item.page_id;
        return __mapped ? [__mapped] : [];
      }),
    ),
  );

  if (pageIds.length === 0) {
    return fallbackStatus;
  }

  const { data: wikiPages, error: wikiPagesError } = await supabaseAdmin
    .from('org_wiki_pages')
    .select('id, app, screen, valid_until, compilation_log')
    .eq('org_id', input.orgId)
    .in('id', pageIds);

  if (wikiPagesError) {
    console.warn(
      '[knowledge-status] Failed to load source-linked wiki pages for source detail:',
      wikiPagesError.message,
    );
    return fallbackStatus;
  }

  const wikiPageStatus = resolveSourceWikiPageStatus(
    (
      (wikiPages ?? []) as Array<
        Pick<
          OrgWikiPageRow,
          'id' | 'app' | 'screen' | 'valid_until' | 'compilation_log'
        >
      >
    ).map((page) =>
      resolveKnowledgeStatusForWikiPage({
        validUntil: page.valid_until,
        app: page.app,
        screen: page.screen,
        hasPendingReview:
          extractPendingContradictions(readCompilationLog(page.compilation_log))
            .length > 0,
      }),
    ),
  );

  return resolveKnowledgeStatusForSource({
    sourceStatus: input.sourceStatus,
    wikiPageStatus,
  });
}

export async function fetchKnowledgeStatusSummary(
  orgId: string,
): Promise<KnowledgeStatusSummary> {
  const [processingResult, wikiPagesResult, vendorPagesResult] =
    await Promise.all([
      supabaseAdmin
        .from('content')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .in('status', [
          SOURCE_STATUS.UPLOADING,
          SOURCE_STATUS.UPLOADED,
          SOURCE_STATUS.TRANSCRIBING,
          SOURCE_STATUS.TRANSCRIBED,
          SOURCE_STATUS.DOCUMENT_GENERATING,
        ]),
      supabaseAdmin
        .from('org_wiki_pages')
        .select('id, app, screen, valid_until, compilation_log')
        .eq('org_id', orgId),
      supabaseAdmin
        .from('vendor_wiki_pages')
        .select('app, screen')
        .is('retired_at', null),
    ]);

  if (processingResult.error) {
    throw new Error(
      `Failed to count processing sources: ${processingResult.error.message}`,
    );
  }

  if (wikiPagesResult.error) {
    throw new Error(
      `Failed to load org wiki pages for status summary: ${wikiPagesResult.error.message}`,
    );
  }

  if (vendorPagesResult.error) {
    throw new Error(
      `Failed to load vendor wiki pages for status summary: ${vendorPagesResult.error.message}`,
    );
  }

  const processingSources = processingResult.count ?? 0;
  const wikiPages = (wikiPagesResult.data ?? []) as Array<
    Pick<
      OrgWikiPageRow,
      'id' | 'app' | 'screen' | 'valid_until' | 'compilation_log'
    >
  >;
  const vendorPages = (vendorPagesResult.data ?? []) as Array<{
    app: string | null;
    screen: string | null;
  }>;

  const wikiPageStatuses = wikiPages.map((page) =>
    resolveKnowledgeStatusForWikiPage({
      validUntil: page.valid_until,
      app: page.app,
      screen: page.screen,
      hasPendingReview:
        extractPendingContradictions(readCompilationLog(page.compilation_log))
          .length > 0,
    }),
  );

  const activeOrgTuples = new Set(
    wikiPages.flatMap((__item, __index, __array) =>
      __item.valid_until === null && __item.app && __item.screen
        ? [`${__item.app!.toLowerCase()}::${__item.screen!.toLowerCase()}`]
        : [],
    ),
  );

  const vendorOnlyCount = new Set(
    vendorPages.flatMap((page) => {
      if (!page.app || !page.screen) return [];
      const tuple = `${page.app.toLowerCase()}::${page.screen.toLowerCase()}`;
      return activeOrgTuples.has(tuple) ? [] : [tuple];
    }),
  ).size;

  const counts = summarizeKnowledgeStatusCounts({
    processingSources,
    wikiPageStatuses,
    vendorOnlyCount,
  });

  const total = KNOWLEDGE_STATUS_DISPLAY_ORDER.reduce(
    (sum, status) => sum + counts[status],
    0,
  );

  return { counts, total };
}
