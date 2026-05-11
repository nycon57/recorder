import type { KnowledgeGraphData } from '@/lib/validations/knowledge';
import type {
  KnowledgeGraphPayload,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '@/lib/types/knowledge-graph';

export const CANVAS_NODE_KIND_FILTERS = [
  'org_page',
  'vendor_page',
  'cluster',
] as const;

export const CANVAS_EDGE_KIND_FILTERS = [
  'org_relationship',
  'org_in_cluster',
  'org_matches_vendor',
] as const;

export type CanvasNodeKindFilter = (typeof CANVAS_NODE_KIND_FILTERS)[number];
export type CanvasEdgeKindFilter = (typeof CANVAS_EDGE_KIND_FILTERS)[number];

function toCanvasNode(
  node: KnowledgeGraphNode,
): KnowledgeGraphData['nodes'][number] {
  switch (node.kind) {
    case 'org_page':
      return {
        id: node.id,
        name: node.label,
        type: 'process',
        mentionCount: Math.max(1, Math.round(node.confidence * 100)),
        metricLabel: 'confidence',
        typeLabel: 'org page',
        nodeKind: 'org_page',
        rawId: node.rawId,
        app: node.app,
        screen: node.screen,
        status: node.status,
        clusterId: node.clusterId,
        confidence: node.confidence,
        updatedAt: node.updatedAt,
      };
    case 'vendor_page':
      return {
        id: node.id,
        name: node.label,
        type: 'tool',
        mentionCount: 1,
        metricLabel: 'sources',
        typeLabel: 'vendor page',
        nodeKind: 'vendor_page',
        rawId: node.rawId,
        app: node.app,
        screen: node.screen,
        sourceUrl: node.sourceUrl,
      };
    case 'cluster':
      return {
        id: node.id,
        name: node.label,
        type: 'organization',
        mentionCount: node.memberCount,
        metricLabel: 'members',
        typeLabel: 'cluster',
        nodeKind: 'cluster',
        rawId: node.rawId,
        memberCount: node.memberCount,
        centralPageId: node.centralPageId,
        computedAt: node.computedAt,
      };
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function toCanvasEdge(
  edge: KnowledgeGraphEdge,
): KnowledgeGraphData['edges'][number] {
  switch (edge.kind) {
    case 'org_relationship':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.relationshipType,
        strength: edge.confidence,
        edgeKind: 'org_relationship',
        relationshipType: edge.relationshipType,
        sourceType: edge.sourceType,
        evidence: edge.evidence,
      };
    case 'org_in_cluster':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'related_to',
        strength: 0.85,
        edgeKind: 'org_in_cluster',
      };
    case 'org_matches_vendor':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'often_used_with',
        strength: 0.75,
        edgeKind: 'org_matches_vendor',
        matchKey: edge.matchKey,
      };
    default: {
      const exhaustive: never = edge;
      return exhaustive;
    }
  }
}

export interface CanvasGraphFilterInput {
  nodeKinds?: CanvasNodeKindFilter[];
  edgeKinds?: CanvasEdgeKindFilter[];
  search?: string;
}

export interface CanvasClusterHull {
  clusterNodeId: string;
  clusterLabel: string;
  memberNodeIds: string[];
  vendorNodeIds: string[];
  memberCount: number;
  relationshipEdgeCount: number;
}

/**
 * Apply UI-facing filters to canvas graph data.
 *
 * - nodeKinds: show only selected operational node categories
 * - edgeKinds: show only selected operational edge categories
 * - search: case-insensitive node label search (name / app / screen)
 */
export function filterCanvasGraphData(
  data: KnowledgeGraphData,
  filters: CanvasGraphFilterInput,
): KnowledgeGraphData {
  const requestedNodeKinds = new Set(
    (filters.nodeKinds ?? CANVAS_NODE_KIND_FILTERS) as readonly string[],
  );
  const requestedEdgeKinds = new Set(
    (filters.edgeKinds ?? CANVAS_EDGE_KIND_FILTERS) as readonly string[],
  );
  const search = (filters.search ?? '').trim().toLowerCase();

  const nodes = data.nodes.filter((node) => {
    const nodeKind = node.nodeKind ?? 'org_page';
    if (!requestedNodeKinds.has(nodeKind)) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [node.name, node.app ?? '', node.screen ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => {
    const edgeKind = edge.edgeKind ?? 'org_relationship';
    if (!requestedEdgeKinds.has(edgeKind)) {
      return false;
    }
    return nodeIds.has(edge.source) && nodeIds.has(edge.target);
  });

  return { nodes, edges };
}

/**
 * Build cluster hull summaries for graph UX controls.
 *
 * Hulls are derived from:
 * - cluster nodes (`nodeKind = cluster`)
 * - membership edges (`edgeKind = org_in_cluster`)
 * - vendor match edges linked to member nodes
 * - org relationship edges where both endpoints are member nodes
 */
export function buildCanvasClusterHulls(
  data: KnowledgeGraphData,
): CanvasClusterHull[] {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));

  const hulls = data.nodes.flatMap((clusterNode) => {
    if (clusterNode.nodeKind !== 'cluster') return [];
    const memberNodeIds = new Set<string>();

    data.edges.forEach((edge) => {
      const edgeKind = edge.edgeKind ?? 'org_relationship';
      if (edgeKind !== 'org_in_cluster') return;

      if (edge.target === clusterNode.id) {
        memberNodeIds.add(edge.source);
      } else if (edge.source === clusterNode.id) {
        memberNodeIds.add(edge.target);
      }
    });

    const vendorNodeIds = new Set<string>();
    let relationshipEdgeCount = 0;

    data.edges.forEach((edge) => {
      const edgeKind = edge.edgeKind ?? 'org_relationship';

      if (edgeKind === 'org_matches_vendor') {
        const sourceIsMember = memberNodeIds.has(edge.source);
        const targetIsMember = memberNodeIds.has(edge.target);

        if (sourceIsMember && !targetIsMember) {
          vendorNodeIds.add(edge.target);
        } else if (targetIsMember && !sourceIsMember) {
          vendorNodeIds.add(edge.source);
        }
      }

      if (
        edgeKind === 'org_relationship' &&
        memberNodeIds.has(edge.source) &&
        memberNodeIds.has(edge.target)
      ) {
        relationshipEdgeCount += 1;
      }
    });

    return [
      {
        clusterNodeId: clusterNode.id,
        clusterLabel: clusterNode.name,
        memberNodeIds: Array.from(memberNodeIds),
        vendorNodeIds: Array.from(vendorNodeIds),
        memberCount: clusterNode.memberCount ?? memberNodeIds.size,
        relationshipEdgeCount,
      },
    ];
  });

  return hulls
    .filter((hull) => {
      const clusterNode = nodeById.get(hull.clusterNodeId);
      return clusterNode?.nodeKind === 'cluster';
    })
    .sort((left, right) => right.memberCount - left.memberCount);
}

/**
 * Adapt TRIB-104 operational graph payload into the legacy graph-canvas
 * contract used by the current 2D/3D graph components.
 */
export function toCanvasGraphData(
  payload: KnowledgeGraphPayload,
): KnowledgeGraphData {
  const nodes = payload.nodes.map(toCanvasNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = payload.edges.flatMap((__item, __index, __array) => {
    const __mapped = toCanvasEdge(__item);
    return nodeIds.has(__mapped.source) && nodeIds.has(__mapped.target)
      ? [__mapped]
      : [];
  });

  return {
    nodes,
    edges,
  };
}
