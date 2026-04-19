import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import type { KnowledgeStatus } from '@/lib/types/knowledge-status';
import {
  KNOWLEDGE_DOC_TYPES,
  type KnowledgeDocType,
  type KnowledgeDocsListItem,
  type KnowledgeDocsPayload,
  type KnowledgeDocsQueryInput,
  type KnowledgeVendorCoverage,
} from '@/lib/types/knowledge-docs';
import { resolveKnowledgeStatusForWikiPage } from '@/lib/utils/knowledge-status';

type CompilationLogEntryLike = {
  action?: string;
  resolved_at?: string | null;
};

type AdminClient = SupabaseClient<Database>;

type OrgWikiPageRow = Pick<
  Database['public']['Tables']['org_wiki_pages']['Row'],
  | 'id'
  | 'app'
  | 'screen'
  | 'topic'
  | 'confidence'
  | 'valid_until'
  | 'cluster_id'
  | 'updated_at'
  | 'compilation_log'
>;

type WikiPageSourceRow = Pick<
  Database['public']['Tables']['wiki_page_sources']['Row'],
  'page_id' | 'source_type'
>;

type WikiClusterRow = Pick<
  Database['public']['Tables']['wiki_clusters']['Row'],
  'id' | 'name'
>;

type VendorWikiPageRow = Pick<
  Database['public']['Tables']['vendor_wiki_pages']['Row'],
  'app' | 'screen'
>;

export interface BuildKnowledgeDocsArgs {
  orgId: string;
  query: KnowledgeDocsQueryInput;
  supabase?: AdminClient;
}

interface AssembleKnowledgeDocsArgs {
  query: KnowledgeDocsQueryInput;
  pages: OrgWikiPageRow[];
  pageSources: WikiPageSourceRow[];
  clusters: WikiClusterRow[];
  vendorPages: VendorWikiPageRow[];
}

function normalizeSegment(value: string) {
  return value.trim().toLowerCase();
}

function normalizeTuple(
  app: string | null | undefined,
  screen: string | null | undefined
) {
  if (!app || !screen) return null;
  return `${normalizeSegment(app)}::${normalizeSegment(screen)}`;
}

function deriveDocType(
  sourceTypes: Array<'recording' | 'document' | 'manual'>
): KnowledgeDocType {
  if (sourceTypes.length === 0) return 'unknown';
  if (sourceTypes.length > 1) return 'mixed';
  const [only] = sourceTypes;
  if (KNOWLEDGE_DOC_TYPES.includes(only)) {
    return only;
  }
  return 'unknown';
}

function deriveVendorCoverage(input: {
  app: string | null;
  screen: string | null;
  vendorTupleKeys: Set<string>;
}): KnowledgeVendorCoverage {
  const key = normalizeTuple(input.app, input.screen);
  if (!key) return 'unrouted';
  return input.vendorTupleKeys.has(key) ? 'covered' : 'gap';
}

function compareDocs(
  left: KnowledgeDocsListItem,
  right: KnowledgeDocsListItem,
  sort: KnowledgeDocsQueryInput['sort']
) {
  switch (sort) {
    case 'updated_asc':
      return left.updatedAt.localeCompare(right.updatedAt);
    case 'topic_asc':
      return left.topic.localeCompare(right.topic);
    case 'topic_desc':
      return right.topic.localeCompare(left.topic);
    case 'updated_desc':
    default:
      return right.updatedAt.localeCompare(left.updatedAt);
  }
}

function hasPendingReview(
  compilationLog: Database['public']['Tables']['org_wiki_pages']['Row']['compilation_log']
) {
  if (!Array.isArray(compilationLog)) return false;
  return (compilationLog as CompilationLogEntryLike[]).some(
    (entry) => entry?.action === 'flagged' && (entry.resolved_at ?? null) === null
  );
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function assembleKnowledgeDocsList(
  args: AssembleKnowledgeDocsArgs
): KnowledgeDocsPayload {
  const clusterNameById = new Map(args.clusters.map((cluster) => [cluster.id, cluster.name]));

  const sourceTypesByPageId = new Map<
    string,
    Set<'recording' | 'document' | 'manual'>
  >();
  for (const sourceRow of args.pageSources) {
    const existing = sourceTypesByPageId.get(sourceRow.page_id) ?? new Set();
    existing.add(sourceRow.source_type);
    sourceTypesByPageId.set(sourceRow.page_id, existing);
  }

  const vendorTupleKeys = new Set<string>();
  for (const vendorPage of args.vendorPages) {
    const tuple = normalizeTuple(vendorPage.app, vendorPage.screen);
    if (tuple) vendorTupleKeys.add(tuple);
  }

  const allDocs: KnowledgeDocsListItem[] = args.pages.map((page) => {
    const pageSourceTypes = Array.from(
      sourceTypesByPageId.get(page.id) ?? []
    ).sort() as Array<'recording' | 'document' | 'manual'>;
    const docType = deriveDocType(pageSourceTypes);
    const pageHasPendingReview = hasPendingReview(page.compilation_log);
    const status: KnowledgeStatus = resolveKnowledgeStatusForWikiPage({
      validUntil: page.valid_until,
      app: page.app,
      screen: page.screen,
      hasPendingReview: pageHasPendingReview,
    });
    const vendorCoverage = deriveVendorCoverage({
      app: page.app,
      screen: page.screen,
      vendorTupleKeys,
    });

    return {
      id: page.id,
      topic: page.topic,
      app: page.app,
      screen: page.screen,
      confidence: page.confidence,
      status,
      type: docType,
      vendorCoverage,
      sourceTypes: pageSourceTypes,
      clusterId: page.cluster_id,
      clusterName: page.cluster_id ? (clusterNameById.get(page.cluster_id) ?? null) : null,
      updatedAt: page.updated_at,
      detailHref: `/knowledge/pages/${page.id}`,
    };
  });

  const filteredDocs = allDocs
    .filter((doc) => {
      if (args.query.type && doc.type !== args.query.type) return false;
      if (args.query.status && doc.status !== args.query.status) return false;
      if (
        args.query.app &&
        normalizeSegment(doc.app ?? '') !== normalizeSegment(args.query.app)
      ) {
        return false;
      }
      if (
        args.query.vendorCoverage &&
        doc.vendorCoverage !== args.query.vendorCoverage
      ) {
        return false;
      }
      if (args.query.cluster) {
        if (args.query.cluster === 'unclustered') {
          if (doc.clusterId !== null) return false;
        } else if (doc.clusterId !== args.query.cluster) {
          return false;
        }
      }
      if (args.query.search) {
        const haystack = `${doc.topic} ${doc.app ?? ''} ${doc.screen ?? ''}`.toLowerCase();
        if (!haystack.includes(args.query.search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((left, right) => compareDocs(left, right, args.query.sort));

  const paginatedItems = filteredDocs.slice(
    args.query.offset,
    args.query.offset + args.query.limit
  );

  const typeCounts = countBy(allDocs.map((doc) => doc.type));
  const statusCounts = countBy(allDocs.map((doc) => doc.status));
  const appCounts = countBy(
    allDocs
      .map((doc) => doc.app)
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeSegment(value))
  );
  const coverageCounts = countBy(allDocs.map((doc) => doc.vendorCoverage));
  const clusterCounts = countBy(
    allDocs
      .map((doc) => doc.clusterId ?? 'unclustered')
      .filter((value): value is string => Boolean(value))
  );

  return {
    items: paginatedItems,
    pagination: {
      total: filteredDocs.length,
      limit: args.query.limit,
      offset: args.query.offset,
      hasMore: filteredDocs.length > args.query.offset + args.query.limit,
    },
    facets: {
      types: Array.from(typeCounts.entries())
        .map(([value, count]) => ({
          value,
          label: value.replace('_', ' '),
          count,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      statuses: Array.from(statusCounts.entries())
        .map(([value, count]) => ({
          value,
          label: value.replace('_', ' '),
          count,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      apps: Array.from(appCounts.entries())
        .map(([value, count]) => ({
          value,
          label: value,
          count,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      vendorCoverage: Array.from(coverageCounts.entries())
        .map(([value, count]) => ({
          value,
          label: value,
          count,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      clusters: Array.from(clusterCounts.entries())
        .map(([value, count]) => {
          const label =
            value === 'unclustered'
              ? 'Unclustered'
              : (clusterNameById.get(value) ?? value);
          return { value, label, count };
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
    filters: args.query,
  };
}

async function fetchOrgPages(args: { supabase: AdminClient; orgId: string }) {
  const { data, error } = await args.supabase
    .from('org_wiki_pages')
    .select(
      'id, app, screen, topic, confidence, valid_until, cluster_id, updated_at, compilation_log'
    )
    .eq('org_id', args.orgId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch org wiki pages: ${error.message}`);
  }

  return (data ?? []) as OrgWikiPageRow[];
}

async function fetchWikiPageSources(args: {
  supabase: AdminClient;
  pageIds: string[];
}) {
  if (args.pageIds.length === 0) return [] as WikiPageSourceRow[];

  const { data, error } = await args.supabase
    .from('wiki_page_sources')
    .select('page_id, source_type')
    .in('page_id', args.pageIds);

  if (error) {
    throw new Error(`Failed to fetch wiki page sources: ${error.message}`);
  }

  return (data ?? []) as WikiPageSourceRow[];
}

async function fetchClusters(args: { supabase: AdminClient; orgId: string }) {
  const { data, error } = await args.supabase
    .from('wiki_clusters')
    .select('id, name')
    .eq('org_id', args.orgId);

  if (error) {
    throw new Error(`Failed to fetch wiki clusters: ${error.message}`);
  }

  return (data ?? []) as WikiClusterRow[];
}

async function fetchVendorPages(args: { supabase: AdminClient }) {
  const { data, error } = await args.supabase
    .from('vendor_wiki_pages')
    .select('app, screen');

  if (error) {
    throw new Error(`Failed to fetch vendor wiki pages: ${error.message}`);
  }

  return (data ?? []) as VendorWikiPageRow[];
}

export async function buildKnowledgeDocsList(
  args: BuildKnowledgeDocsArgs
): Promise<KnowledgeDocsPayload> {
  const supabase = args.supabase ?? createAdminClient();

  const pages = await fetchOrgPages({
    supabase,
    orgId: args.orgId,
  });

  const [pageSources, clusters, vendorPages] = await Promise.all([
    fetchWikiPageSources({
      supabase,
      pageIds: pages.map((page) => page.id),
    }),
    fetchClusters({
      supabase,
      orgId: args.orgId,
    }),
    fetchVendorPages({ supabase }),
  ]);

  return assembleKnowledgeDocsList({
    query: args.query,
    pages,
    pageSources,
    clusters,
    vendorPages,
  });
}
