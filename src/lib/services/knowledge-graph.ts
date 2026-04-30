import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { LightweightSupabaseClient } from '@/lib/supabase/types';
import type { Database } from '@/lib/types/database';
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphPayload,
  KnowledgeGraphQueryInput,
} from '@/lib/types/knowledge-graph';

type AdminClient = LightweightSupabaseClient;

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
>;

type VendorWikiPageRow = Pick<
  Database['public']['Tables']['vendor_wiki_pages']['Row'],
  'id' | 'app' | 'screen' | 'source_url'
>;

type WikiRelationshipRow = Pick<
  Database['public']['Tables']['wiki_relationships']['Row'],
  | 'id'
  | 'source_page_id'
  | 'target_page_id'
  | 'relationship_type'
  | 'source_type'
  | 'confidence'
  | 'evidence'
>;

type WikiClusterRow = Pick<
  Database['public']['Tables']['wiki_clusters']['Row'],
  | 'id'
  | 'name'
  | 'member_count'
  | 'central_page_id'
  | 'modularity'
  | 'computed_at'
>;

export interface BuildKnowledgeGraphArgs {
  orgId: string;
  query: KnowledgeGraphQueryInput;
  supabase?: AdminClient;
}

interface AssembleKnowledgeGraphArgs {
  orgId: string;
  query: KnowledgeGraphQueryInput;
  orgPages: OrgWikiPageRow[];
  vendorPages: VendorWikiPageRow[];
  clusters: WikiClusterRow[];
  relationships: WikiRelationshipRow[];
}

function toNodeId(kind: 'org_page' | 'vendor_page' | 'cluster', rawId: string) {
  return `${kind}:${rawId}`;
}

function normalizeSegment(value: string) {
  return value.trim().toLowerCase();
}

function toMatchKey(
  app: string | null | undefined,
  screen: string | null | undefined
) {
  if (!app || !screen) return null;
  return `${normalizeSegment(app)}::${normalizeSegment(screen)}`;
}

async function fetchOrgPages(args: {
  supabase: AdminClient;
  orgId: string;
  query: KnowledgeGraphQueryInput;
}) {
  let queryBuilder = args.supabase
    .from('org_wiki_pages')
    .select(
      'id, app, screen, topic, confidence, valid_until, cluster_id, updated_at'
    )
    .eq('org_id', args.orgId)
    .order('updated_at', { ascending: false })
    .limit(args.query.orgPageLimit);

  if (!args.query.includeSuperseded) {
    queryBuilder = queryBuilder.is('valid_until', null);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    throw new Error(`Failed to fetch org wiki pages: ${error.message}`);
  }

  return (data ?? []) as OrgWikiPageRow[];
}

async function fetchClusters(args: {
  supabase: AdminClient;
  orgId: string;
  query: KnowledgeGraphQueryInput;
}) {
  const { data, error } = await args.supabase
    .from('wiki_clusters')
    .select('id, name, member_count, central_page_id, modularity, computed_at')
    .eq('org_id', args.orgId)
    .order('member_count', { ascending: false })
    .limit(args.query.clusterLimit);

  if (error) {
    throw new Error(`Failed to fetch wiki clusters: ${error.message}`);
  }

  return (data ?? []) as WikiClusterRow[];
}

async function fetchRelationships(args: {
  supabase: AdminClient;
  orgId: string;
  pageIds: string[];
  query: KnowledgeGraphQueryInput;
}) {
  if (args.pageIds.length === 0) return [] as WikiRelationshipRow[];

  const { data, error } = await args.supabase
    .from('wiki_relationships')
    .select(
      'id, source_page_id, target_page_id, relationship_type, source_type, confidence, evidence'
    )
    .eq('org_id', args.orgId)
    .in('source_page_id', args.pageIds)
    .in('target_page_id', args.pageIds)
    .order('confidence', { ascending: false })
    .limit(args.query.relationshipLimit);

  if (error) {
    throw new Error(`Failed to fetch wiki relationships: ${error.message}`);
  }

  return (data ?? []) as WikiRelationshipRow[];
}

async function fetchVendorPages(args: {
  supabase: AdminClient;
  orgPages: OrgWikiPageRow[];
  query: KnowledgeGraphQueryInput;
}) {
  const matchKeys = new Set<string>();
  const apps = new Set<string>();

  for (const page of args.orgPages) {
    const key = toMatchKey(page.app, page.screen);
    if (!key || !page.app) continue;
    matchKeys.add(key);
    apps.add(normalizeSegment(page.app));
  }

  // If we have no routable app/screen pairs yet, return a bounded generic
  // vendor slice so the graph still represents vendor-side knowledge.
  if (matchKeys.size === 0) {
    const { data, error } = await args.supabase
      .from('vendor_wiki_pages')
      .select('id, app, screen, source_url')
      .is('retired_at', null)
      .order('app', { ascending: true })
      .order('screen', { ascending: true })
      .limit(args.query.vendorPageLimit);

    if (error) {
      throw new Error(`Failed to fetch vendor wiki pages: ${error.message}`);
    }

    return (data ?? []) as VendorWikiPageRow[];
  }

  const appFilters = Array.from(apps);
  const candidateLimit = Math.min(args.query.vendorPageLimit * 5, 1000);

  const { data, error } = await args.supabase
    .from('vendor_wiki_pages')
    .select('id, app, screen, source_url')
    .in('app', appFilters)
    .is('retired_at', null)
    .order('app', { ascending: true })
    .order('screen', { ascending: true })
    .limit(candidateLimit);

  if (error) {
    throw new Error(`Failed to fetch vendor wiki pages: ${error.message}`);
  }

  const filtered = ((data ?? []) as VendorWikiPageRow[]).filter((page) => {
    const key = toMatchKey(page.app, page.screen);
    return key ? matchKeys.has(key) : false;
  });

  return filtered.slice(0, args.query.vendorPageLimit);
}

export function assembleKnowledgeGraph(
  args: AssembleKnowledgeGraphArgs
): KnowledgeGraphPayload {
  const nodes: KnowledgeGraphPayload['nodes'] = [];
  const edges: KnowledgeGraphEdge[] = [];

  const orgNodeIdByPageId = new Map<string, string>();
  const vendorNodeIdsByMatchKey = new Map<string, string[]>();
  const clusterNodeIdByClusterId = new Map<string, string>();

  for (const page of args.orgPages) {
    const nodeId = toNodeId('org_page', page.id);
    orgNodeIdByPageId.set(page.id, nodeId);
    nodes.push({
      id: nodeId,
      kind: 'org_page',
      rawId: page.id,
      label: page.topic,
      topic: page.topic,
      app: page.app,
      screen: page.screen,
      confidence: page.confidence,
      status: page.valid_until ? 'superseded' : 'active',
      clusterId: page.cluster_id,
      updatedAt: page.updated_at,
    });
  }

  for (const page of args.vendorPages) {
    const nodeId = toNodeId('vendor_page', page.id);
    nodes.push({
      id: nodeId,
      kind: 'vendor_page',
      rawId: page.id,
      label: `${page.app} · ${page.screen}`,
      app: page.app,
      screen: page.screen,
      sourceUrl: page.source_url,
    });

    const key = toMatchKey(page.app, page.screen);
    if (!key) continue;
    const existing = vendorNodeIdsByMatchKey.get(key) ?? [];
    existing.push(nodeId);
    vendorNodeIdsByMatchKey.set(key, existing);
  }

  for (const cluster of args.clusters) {
    const nodeId = toNodeId('cluster', cluster.id);
    clusterNodeIdByClusterId.set(cluster.id, nodeId);
    nodes.push({
      id: nodeId,
      kind: 'cluster',
      rawId: cluster.id,
      label: cluster.name,
      name: cluster.name,
      memberCount: cluster.member_count,
      centralPageId: cluster.central_page_id,
      modularity: cluster.modularity,
      computedAt: cluster.computed_at,
    });
  }

  for (const relationship of args.relationships) {
    const sourceNodeId = orgNodeIdByPageId.get(relationship.source_page_id);
    const targetNodeId = orgNodeIdByPageId.get(relationship.target_page_id);
    if (!sourceNodeId || !targetNodeId) continue;

    edges.push({
      id: `org_relationship:${relationship.id}`,
      kind: 'org_relationship',
      source: sourceNodeId,
      target: targetNodeId,
      relationshipType: relationship.relationship_type,
      sourceType: relationship.source_type,
      confidence: relationship.confidence,
      evidence: relationship.evidence,
    });
  }

  for (const page of args.orgPages) {
    if (!page.cluster_id) continue;
    const sourceNodeId = orgNodeIdByPageId.get(page.id);
    const clusterNodeId = clusterNodeIdByClusterId.get(page.cluster_id);
    if (!sourceNodeId || !clusterNodeId) continue;

    edges.push({
      id: `org_in_cluster:${page.id}:${page.cluster_id}`,
      kind: 'org_in_cluster',
      source: sourceNodeId,
      target: clusterNodeId,
    });
  }

  for (const page of args.orgPages) {
    const sourceNodeId = orgNodeIdByPageId.get(page.id);
    const key = toMatchKey(page.app, page.screen);
    if (!sourceNodeId || !key) continue;

    const vendorNodeIds = vendorNodeIdsByMatchKey.get(key) ?? [];
    const matchTargets = vendorNodeIds.slice(0, args.query.vendorMatchesPerOrgPage);

    for (const targetNodeId of matchTargets) {
      edges.push({
        id: `org_matches_vendor:${page.id}:${targetNodeId}`,
        kind: 'org_matches_vendor',
        source: sourceNodeId,
        target: targetNodeId,
        matchKey: key,
      });
    }
  }

  const counts = {
    orgPages: nodes.filter((node) => node.kind === 'org_page').length,
    vendorPages: nodes.filter((node) => node.kind === 'vendor_page').length,
    clusters: nodes.filter((node) => node.kind === 'cluster').length,
    orgRelationships: edges.filter((edge) => edge.kind === 'org_relationship')
      .length,
    clusterMemberships: edges.filter((edge) => edge.kind === 'org_in_cluster')
      .length,
    vendorMatches: edges.filter((edge) => edge.kind === 'org_matches_vendor')
      .length,
  };

  return {
    nodes,
    edges,
    meta: {
      generatedAt: new Date().toISOString(),
      orgId: args.orgId,
      limits: {
        orgPageLimit: args.query.orgPageLimit,
        vendorPageLimit: args.query.vendorPageLimit,
        clusterLimit: args.query.clusterLimit,
        relationshipLimit: args.query.relationshipLimit,
        vendorMatchesPerOrgPage: args.query.vendorMatchesPerOrgPage,
        includeSuperseded: args.query.includeSuperseded,
      },
      counts: {
        nodes: nodes.length,
        edges: edges.length,
        ...counts,
      },
    },
  };
}

export async function buildKnowledgeGraph(
  args: BuildKnowledgeGraphArgs
): Promise<KnowledgeGraphPayload> {
  const supabase = args.supabase ?? createAdminClient();

  const [orgPages, clusters] = await Promise.all([
    fetchOrgPages({
      supabase,
      orgId: args.orgId,
      query: args.query,
    }),
    fetchClusters({
      supabase,
      orgId: args.orgId,
      query: args.query,
    }),
  ]);

  const [relationships, vendorPages] = await Promise.all([
    fetchRelationships({
      supabase,
      orgId: args.orgId,
      pageIds: orgPages.map((page) => page.id),
      query: args.query,
    }),
    fetchVendorPages({
      supabase,
      orgPages,
      query: args.query,
    }),
  ]);

  return assembleKnowledgeGraph({
    orgId: args.orgId,
    query: args.query,
    orgPages,
    vendorPages,
    clusters,
    relationships,
  });
}
