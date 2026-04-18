import { supabaseAdmin } from '../supabase/admin';
import type { Database } from '../types/database';
import { SOURCE_STATUS } from '../utils/status-helpers';
import { extractPendingContradictions, readCompilationLog } from './wiki-review';
import {
  getKnowledgeStatusMeta,
  resolveKnowledgeStatusForSource,
  summarizeKnowledgeStatusCounts,
  resolveKnowledgeStatusForWikiPage,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_DISPLAY_ORDER,
  type KnowledgeStatusCounts,
  type KnowledgeStatus,
  type KnowledgeStatusMeta,
} from '../utils/knowledge-status';

type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];

export interface KnowledgeStatusSummary {
  counts: KnowledgeStatusCounts;
  total: number;
}

export {
  getKnowledgeStatusMeta,
  resolveKnowledgeStatusForSource,
  resolveKnowledgeStatusForWikiPage,
  summarizeKnowledgeStatusCounts,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_DISPLAY_ORDER,
  type KnowledgeStatusCounts,
  type KnowledgeStatus,
  type KnowledgeStatusMeta,
} from '../utils/knowledge-status';

export async function fetchKnowledgeStatusSummary(
  orgId: string
): Promise<KnowledgeStatusSummary> {
  const [processingResult, wikiPagesResult, vendorPagesResult] = await Promise.all([
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
      .select('app, screen'),
  ]);

  if (processingResult.error) {
    throw new Error(
      `Failed to count processing sources: ${processingResult.error.message}`
    );
  }

  if (wikiPagesResult.error) {
    throw new Error(
      `Failed to load org wiki pages for status summary: ${wikiPagesResult.error.message}`
    );
  }

  if (vendorPagesResult.error) {
    throw new Error(
      `Failed to load vendor wiki pages for status summary: ${vendorPagesResult.error.message}`
    );
  }

  const processingSources = processingResult.count ?? 0;
  const wikiPages =
    (wikiPagesResult.data ?? []) as Array<
      Pick<OrgWikiPageRow, 'id' | 'app' | 'screen' | 'valid_until' | 'compilation_log'>
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
        extractPendingContradictions(readCompilationLog(page.compilation_log)).length > 0,
    })
  );

  const activeOrgTuples = new Set(
    wikiPages
      .filter((page) => page.valid_until === null && page.app && page.screen)
      .map((page) => `${page.app!.toLowerCase()}::${page.screen!.toLowerCase()}`)
  );

  const vendorOnlyCount = new Set(
    vendorPages
      .filter((page) => page.app && page.screen)
      .map((page) => `${page.app!.toLowerCase()}::${page.screen!.toLowerCase()}`)
      .filter((key) => !activeOrgTuples.has(key))
  ).size;

  const counts = summarizeKnowledgeStatusCounts({
    processingSources,
    wikiPageStatuses,
    vendorOnlyCount,
  });

  const total = KNOWLEDGE_STATUS_DISPLAY_ORDER.reduce(
    (sum, status) => sum + counts[status],
    0
  );

  return { counts, total };
}
