/**
 * Wiki cluster service — TRIB-44.
 *
 * Runs Louvain community detection on an org's wiki_relationships graph
 * and stores one row per detected cluster in `wiki_clusters`, plus a
 * `cluster_id` pointer on each `org_wiki_pages` row. Refreshed weekly by
 * /api/cron/wiki-clusters (Sunday 04:00 UTC).
 *
 * Algorithm choice: Louvain, NOT Leiden.
 *
 * The PRD Part 9 (Graphify borrow list) references Leiden clustering as
 * the gold standard, but we deliberately pick Louvain here because:
 *
 *   1. The graphology JS ecosystem has a mature, well-maintained Louvain
 *      implementation (`graphology-communities-louvain`, ~30kb gzipped).
 *      Leiden in JS is either unavailable or lightly-maintained ports.
 *   2. Quality difference is marginal at our graph sizes. Most orgs
 *      will have fewer than ~1000 wiki pages, where Louvain and Leiden
 *      produce effectively identical community structures.
 *   3. Staying in JS keeps the cron on the same Node runtime as the rest
 *      of the app — no Python worker, no subprocess, no cold-start tax.
 *
 * Graph construction:
 *
 *   - Nodes: every active page in the org (valid_until IS NULL).
 *   - Edges: every row in wiki_relationships, undirected, weighted by
 *     confidence. If both directions exist between the same pair we
 *     take the mean of the two confidences (symmetric).
 *   - Self-loops and duplicates are dropped.
 *
 * Per-cluster metadata:
 *
 *   - name:            derived from the central page's `topic`
 *   - member_count:    number of pages in the community
 *   - central_page_id: highest-weighted-degree node in the community
 *   - modularity:      global Louvain modularity (stored per row for UI convenience)
 *
 * Persistence is "delete-then-insert" per org: any existing clusters for
 * the org are removed, new rows are inserted, and every page's
 * `cluster_id` is updated in a single pass. This keeps the logic simple
 * and avoids trying to match new communities to previous ones (which
 * Louvain does not guarantee is stable across runs anyway).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'wiki-clusters' });

export interface ClusterSummary {
  id: string;
  name: string;
  memberCount: number;
  centralPageId: string | null;
  modularity: number | null;
}

export interface ClusterResult {
  orgId: string;
  nodes: number;
  edges: number;
  clustersCreated: number;
  modularity: number;
  durationMs: number;
}

interface ActiveWikiPage {
  id: string;
  topic: string;
}

interface WikiEdge {
  source_page_id: string;
  target_page_id: string;
  confidence: number;
}

/**
 * Supabase's generated types over-resolve `.from(...)` results to `never`
 * for several of our tables (see org-wiki-embedding.ts, job-processor.ts
 * for the same workaround). We cast to the narrow row shapes we actually
 * need so the rest of this module stays type-safe.
 */
type AnySupabase = SupabaseClient<any, any, any>;

/**
 * Minimum cluster size to persist. Singletons (size 1) are dropped — they
 * carry no information and would pollute the UI with "cluster of one".
 * Louvain can produce singletons when a node's only edges have low weight.
 */
const MIN_CLUSTER_SIZE = 2;

/**
 * Soft guardrails to protect against pathological orgs. If an org has
 * more than this many pages or edges, we skip detection and log a warning.
 * These limits are well above anything we expect in practice (< 1000
 * pages for most orgs); raising them is a one-line change if needed.
 */
const MAX_NODES = 10_000;
const MAX_EDGES = 100_000;

/**
 * Run Louvain community detection for a single org and persist the
 * results. Safe to call directly from a worker or a cron handler.
 *
 * Returns a `ClusterResult` with run stats. Throws on database errors so
 * the caller can surface them; the cron handler catches per-org errors
 * and continues with the next org.
 */
export async function runClusterDetection(
  orgId: string
): Promise<ClusterResult> {
  const start = Date.now();
  const supabase = createAdminClient() as unknown as AnySupabase;

  logger.info('Starting cluster detection', { context: { orgId } });

  // ---- Step 1: fetch active pages ------------------------------------------
  // We only cluster pages that are currently-active (valid_until IS NULL).
  // Superseded pages are excluded — they've been replaced by newer
  // versions and we don't want to pollute the graph with historical noise.
  const { data: pagesRaw, error: pagesError } = await supabase
    .from('org_wiki_pages')
    .select('id, topic')
    .eq('org_id', orgId)
    .is('valid_until', null);

  if (pagesError) {
    throw new Error(
      `Failed to fetch org_wiki_pages for ${orgId}: ${pagesError.message}`
    );
  }

  const pages = (pagesRaw ?? []) as ActiveWikiPage[];

  if (pages.length === 0) {
    logger.info('Org has no active wiki pages, nothing to cluster', {
      context: { orgId },
    });
    await clearExistingClusters(supabase, orgId);
    return {
      orgId,
      nodes: 0,
      edges: 0,
      clustersCreated: 0,
      modularity: 0,
      durationMs: Date.now() - start,
    };
  }

  if (pages.length > MAX_NODES) {
    logger.warn('Org exceeds MAX_NODES, skipping cluster detection', {
      context: { orgId, nodes: pages.length, MAX_NODES },
    });
    return {
      orgId,
      nodes: pages.length,
      edges: 0,
      clustersCreated: 0,
      modularity: 0,
      durationMs: Date.now() - start,
    };
  }

  // Index for quick topic lookup when naming clusters below.
  const pageById = new Map<string, ActiveWikiPage>();
  for (const p of pages) pageById.set(p.id, p);

  // ---- Step 2: fetch edges -------------------------------------------------
  const { data: edgesRaw, error: edgesError } = await supabase
    .from('wiki_relationships')
    .select('source_page_id, target_page_id, confidence')
    .eq('org_id', orgId);

  if (edgesError) {
    throw new Error(
      `Failed to fetch wiki_relationships for ${orgId}: ${edgesError.message}`
    );
  }

  const rawEdges = (edgesRaw ?? []) as WikiEdge[];

  if (rawEdges.length > MAX_EDGES) {
    logger.warn('Org exceeds MAX_EDGES, skipping cluster detection', {
      context: { orgId, edges: rawEdges.length, MAX_EDGES },
    });
    return {
      orgId,
      nodes: pages.length,
      edges: rawEdges.length,
      clustersCreated: 0,
      modularity: 0,
      durationMs: Date.now() - start,
    };
  }

  // ---- Step 3: build the undirected graph ---------------------------------
  // Graphology's UndirectedGraph de-duplicates edges automatically when we
  // use `mergeEdge`, which averages the bidirectional confidence if both
  // directions exist. We normalise the endpoint pair so the smaller id is
  // always "u" — this makes the merge deterministic.
  const graph = new Graph<{ topic: string }, { weight: number; count: number }>(
    { type: 'undirected', multi: false, allowSelfLoops: false }
  );

  // Add every active page as a node — even isolated ones with zero edges.
  // Louvain will put isolates in their own singleton community, which we
  // then filter out when persisting. Including them here means pages with
  // no relationships still appear in the result set as NULL cluster_id.
  for (const page of pages) {
    graph.addNode(page.id, { topic: page.topic });
  }

  let droppedEdges = 0;

  for (const edge of rawEdges) {
    const { source_page_id: source, target_page_id: target, confidence } = edge;

    // Drop self-loops and edges pointing at nodes we didn't include
    // (e.g. the target page was superseded between our two queries).
    if (source === target) {
      droppedEdges++;
      continue;
    }
    if (!graph.hasNode(source) || !graph.hasNode(target)) {
      droppedEdges++;
      continue;
    }

    // Canonicalise the pair so mergeEdgeWithKey is deterministic.
    const [u, v] = source < target ? [source, target] : [target, source];
    const edgeKey = `${u}__${v}`;

    if (graph.hasEdge(edgeKey)) {
      // Running average — second occurrence of the same pair (the other
      // direction). confidence is in [0, 1] so the running mean is safe.
      const existing = graph.getEdgeAttributes(edgeKey);
      const newCount = existing.count + 1;
      const newWeight =
        (existing.weight * existing.count + confidence) / newCount;
      graph.setEdgeAttribute(edgeKey, 'weight', newWeight);
      graph.setEdgeAttribute(edgeKey, 'count', newCount);
    } else {
      graph.addEdgeWithKey(edgeKey, u, v, {
        weight: confidence,
        count: 1,
      });
    }
  }

  const nodeCount = graph.order;
  const edgeCount = graph.size;

  if (edgeCount === 0) {
    logger.info('Org has no edges — every page becomes an isolate', {
      context: { orgId, nodes: nodeCount },
    });
    // No edges → no meaningful communities. Clear existing clusters
    // and return — pages will end up with cluster_id = NULL.
    await clearExistingClusters(supabase, orgId);
    return {
      orgId,
      nodes: nodeCount,
      edges: 0,
      clustersCreated: 0,
      modularity: 0,
      durationMs: Date.now() - start,
    };
  }

  // ---- Step 4: run Louvain -------------------------------------------------
  // `detailed` returns both the node→community mapping AND the global
  // modularity score, so we only traverse the graph once.
  const result = louvain.detailed(graph, {
    getEdgeWeight: 'weight',
    // `resolution: 1` is the standard; higher = more, smaller communities.
    // We stick with the default until we have empirical evidence to tune.
    resolution: 1,
  });

  const communities = result.communities; // { [nodeId]: communityIndex }
  const modularity = result.modularity;

  // Group nodes by community index.
  const communityGroups = new Map<number, string[]>();
  for (const [nodeId, communityIdx] of Object.entries(communities)) {
    let group = communityGroups.get(communityIdx);
    if (!group) {
      group = [];
      communityGroups.set(communityIdx, group);
    }
    group.push(nodeId);
  }

  logger.info('Louvain detection complete', {
    context: {
      orgId,
      nodes: nodeCount,
      edges: edgeCount,
      rawCommunities: communityGroups.size,
      modularity,
      droppedEdges,
    },
  });

  // ---- Step 5: compute central pages + filter out singletons ---------------
  // For each community, pick the node with the highest weighted degree
  // (sum of incident edge weights) as the central page. That node's
  // `topic` becomes the cluster name.
  interface PendingCluster {
    nodeIds: string[];
    centralPageId: string;
    centralTopic: string;
  }

  const pendingClusters: PendingCluster[] = [];

  for (const nodeIds of communityGroups.values()) {
    if (nodeIds.length < MIN_CLUSTER_SIZE) continue;

    // Find highest weighted-degree node inside the community.
    let bestNode = nodeIds[0];
    let bestDegree = -1;

    for (const nodeId of nodeIds) {
      let degree = 0;
      graph.forEachEdge(nodeId, (_edgeKey, attributes) => {
        degree += attributes.weight;
      });
      if (degree > bestDegree) {
        bestDegree = degree;
        bestNode = nodeId;
      }
    }

    const centralPage = pageById.get(bestNode);
    const centralTopic = centralPage?.topic ?? 'Untitled cluster';

    pendingClusters.push({
      nodeIds,
      centralPageId: bestNode,
      centralTopic,
    });
  }

  // ---- Step 6: persist (delete existing → insert fresh → update pages) ----
  await clearExistingClusters(supabase, orgId);

  if (pendingClusters.length === 0) {
    logger.info('No clusters met MIN_CLUSTER_SIZE — nothing to persist', {
      context: { orgId, nodes: nodeCount, edges: edgeCount },
    });
    return {
      orgId,
      nodes: nodeCount,
      edges: edgeCount,
      clustersCreated: 0,
      modularity,
      durationMs: Date.now() - start,
    };
  }

  // Insert cluster rows in one batch so we get the generated UUIDs back.
  const insertRows = pendingClusters.map((pc) => ({
    org_id: orgId,
    name: deriveClusterName(pc.centralTopic),
    member_count: pc.nodeIds.length,
    central_page_id: pc.centralPageId,
    modularity,
  }));

  const { data: insertedRaw, error: insertError } = await supabase
    .from('wiki_clusters')
    .insert(insertRows as never)
    .select('id');

  if (insertError) {
    throw new Error(
      `Failed to insert wiki_clusters for ${orgId}: ${insertError.message}`
    );
  }

  const inserted = (insertedRaw ?? []) as Array<{ id: string }>;
  if (inserted.length !== pendingClusters.length) {
    throw new Error(
      `wiki_clusters insert count mismatch: expected ${pendingClusters.length}, got ${inserted.length}`
    );
  }

  // Build the { pageId → clusterId } assignment map. Every page in
  // `pendingClusters[i].nodeIds` gets `inserted[i].id`. Pages that didn't
  // make it into any persisted cluster get cluster_id = NULL.
  const assignment = new Map<string, string>();
  for (let i = 0; i < pendingClusters.length; i++) {
    const clusterId = inserted[i].id;
    for (const nodeId of pendingClusters[i].nodeIds) {
      assignment.set(nodeId, clusterId);
    }
  }

  // Reset cluster_id on all active pages first so stale assignments get
  // cleared — then write the new assignments. Two-step to keep the
  // individual updates simple.
  const { error: clearError } = await supabase
    .from('org_wiki_pages')
    .update({ cluster_id: null } as never)
    .eq('org_id', orgId)
    .is('valid_until', null);

  if (clearError) {
    throw new Error(
      `Failed to clear org_wiki_pages.cluster_id for ${orgId}: ${clearError.message}`
    );
  }

  // Group pages by target clusterId so we can update in bulk per cluster
  // (N clusters × 1 update each, rather than N×M individual row updates).
  const pagesByCluster = new Map<string, string[]>();
  for (const [pageId, clusterId] of assignment.entries()) {
    let list = pagesByCluster.get(clusterId);
    if (!list) {
      list = [];
      pagesByCluster.set(clusterId, list);
    }
    list.push(pageId);
  }

  for (const [clusterId, pageIds] of pagesByCluster.entries()) {
    const { error: updateError } = await supabase
      .from('org_wiki_pages')
      .update({ cluster_id: clusterId } as never)
      .in('id', pageIds);

    if (updateError) {
      throw new Error(
        `Failed to assign cluster_id ${clusterId} to pages for ${orgId}: ${updateError.message}`
      );
    }
  }

  const durationMs = Date.now() - start;

  logger.info('Cluster detection complete', {
    context: {
      orgId,
      nodes: nodeCount,
      edges: edgeCount,
      clustersCreated: pendingClusters.length,
      modularity,
      durationMs,
    },
  });

  return {
    orgId,
    nodes: nodeCount,
    edges: edgeCount,
    clustersCreated: pendingClusters.length,
    modularity,
    durationMs,
  };
}

/**
 * Iterate every org in the database and run cluster detection for each
 * one. Used by the weekly cron handler. Errors on a single org are logged
 * and swallowed so one bad org can't block the rest of the fleet.
 */
export async function runClusterDetectionAllOrgs(): Promise<{
  orgsProcessed: number;
  orgsFailed: number;
  results: ClusterResult[];
}> {
  const supabase = createAdminClient() as unknown as AnySupabase;

  // Only process orgs that actually have wiki pages. An org with zero
  // pages would be a no-op anyway and this avoids doing N round-trips
  // for orgs that never touched the wiki features.
  const { data: orgRowsRaw, error } = await supabase
    .from('org_wiki_pages')
    .select('org_id')
    .is('valid_until', null);

  if (error) {
    throw new Error(`Failed to enumerate orgs: ${error.message}`);
  }

  const orgRows = (orgRowsRaw ?? []) as Array<{ org_id: string }>;
  const orgIds = Array.from(new Set(orgRows.map((r) => r.org_id)));

  logger.info('Running cluster detection across all orgs', {
    context: { orgCount: orgIds.length },
  });

  const results: ClusterResult[] = [];
  let orgsFailed = 0;

  for (const orgId of orgIds) {
    try {
      const result = await runClusterDetection(orgId);
      results.push(result);
    } catch (error) {
      orgsFailed++;
      logger.error('Cluster detection failed for org', {
        context: { orgId },
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return {
    orgsProcessed: results.length,
    orgsFailed,
    results,
  };
}

/**
 * Given a central page topic, produce the cluster name. Currently this
 * just truncates to 80 chars so admin UIs don't have to wrap on huge
 * topic strings. Future work: LLM-labeled cluster names.
 */
function deriveClusterName(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed) return 'Untitled cluster';
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}

/**
 * Delete all existing wiki_clusters rows for the org. The ON DELETE SET
 * NULL FK on org_wiki_pages.cluster_id means this also resets any stale
 * assignments automatically, but we don't rely on that — the caller
 * explicitly clears cluster_id before re-assigning.
 */
async function clearExistingClusters(
  supabase: AnySupabase,
  orgId: string
): Promise<void> {
  const { error } = await supabase
    .from('wiki_clusters')
    .delete()
    .eq('org_id', orgId);

  if (error) {
    throw new Error(
      `Failed to clear wiki_clusters for ${orgId}: ${error.message}`
    );
  }
}

/**
 * Resolve additional context pages from the same cluster(s) as the
 * given base page ids. Used by the fusion engine in /api/extension/query
 * to widen the LLM context beyond the top-N vector-matched pages.
 *
 * Per PRD: after the top-N pages are selected by cosine distance, pull
 * up to `perCluster` other active pages in the SAME cluster. Pages that
 * already appear in `excludePageIds` are filtered out so we don't double
 * up on the pages the caller already has.
 *
 * This is gated by org_agent_settings.wiki_cluster_context_enabled at
 * the call site — this function always runs and returns pages; it's the
 * caller's job to decide whether to use them.
 */
export interface ClusterContextPage {
  id: string;
  app: string | null;
  screen: string | null;
  topic: string;
  content: string;
  confidence: number;
  /** Always set to Number.POSITIVE_INFINITY so the fusion engine knows
   *  this page came from cluster expansion, not direct vector match. */
  distance: number;
}

export async function resolveClusterContext(args: {
  orgId: string;
  basePageIds: string[];
  perCluster?: number;
  excludePageIds?: string[];
}): Promise<ClusterContextPage[]> {
  const { orgId, basePageIds, perCluster = 2 } = args;
  const exclude = new Set(args.excludePageIds ?? basePageIds);

  if (basePageIds.length === 0) return [];

  const supabase = createAdminClient() as unknown as AnySupabase;

  // Fetch the cluster_id for each base page, filtering out nulls.
  const { data: baseRowsRaw, error: baseError } = await supabase
    .from('org_wiki_pages')
    .select('id, cluster_id')
    .in('id', basePageIds);

  if (baseError) {
    logger.warn('resolveClusterContext: base page lookup failed', {
      context: { orgId },
      error: baseError,
    });
    return [];
  }

  const baseRows = (baseRowsRaw ?? []) as Array<{
    id: string;
    cluster_id: string | null;
  }>;
  const clusterIds = Array.from(
    new Set(baseRows.map((r) => r.cluster_id).filter((id): id is string => !!id))
  );

  if (clusterIds.length === 0) return [];

  // Fetch a modest pool of candidates across all matching clusters,
  // then post-filter in memory so we can honor `perCluster` exactly.
  // `perCluster * clusterIds.length + exclude.size` is a tight upper
  // bound — fetching a bit more lets us drop duplicates cleanly.
  const candidatePool = perCluster * clusterIds.length + exclude.size + 5;

  const { data: candidatesRaw, error: candidatesError } = await supabase
    .from('org_wiki_pages')
    .select('id, app, screen, topic, content, confidence, cluster_id')
    .eq('org_id', orgId)
    .is('valid_until', null)
    .in('cluster_id', clusterIds)
    .order('confidence', { ascending: false })
    .limit(candidatePool);

  if (candidatesError) {
    logger.warn('resolveClusterContext: candidate fetch failed', {
      context: { orgId },
      error: candidatesError,
    });
    return [];
  }

  const candidates = (candidatesRaw ?? []) as Array<{
    id: string;
    app: string | null;
    screen: string | null;
    topic: string;
    content: string;
    confidence: number;
    cluster_id: string | null;
  }>;

  // Bucket by cluster, honoring perCluster and excludePageIds.
  const takenPerCluster = new Map<string, number>();
  const out: ClusterContextPage[] = [];

  for (const row of candidates) {
    if (!row.cluster_id) continue;
    if (exclude.has(row.id)) continue;

    const taken = takenPerCluster.get(row.cluster_id) ?? 0;
    if (taken >= perCluster) continue;

    takenPerCluster.set(row.cluster_id, taken + 1);
    out.push({
      id: row.id,
      app: row.app,
      screen: row.screen,
      topic: row.topic,
      content: row.content,
      confidence: row.confidence,
      distance: Number.POSITIVE_INFINITY,
    });
  }

  return out;
}
