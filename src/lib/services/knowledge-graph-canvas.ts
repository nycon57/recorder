import type { KnowledgeGraphData } from '@/lib/validations/knowledge';
import type {
  KnowledgeGraphPayload,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '@/lib/types/knowledge-graph';

function toCanvasNode(
  node: KnowledgeGraphNode
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
      };
    case 'vendor_page':
      return {
        id: node.id,
        name: node.label,
        type: 'tool',
        mentionCount: 1,
        metricLabel: 'sources',
        typeLabel: 'vendor page',
      };
    case 'cluster':
      return {
        id: node.id,
        name: node.label,
        type: 'organization',
        mentionCount: node.memberCount,
        metricLabel: 'members',
        typeLabel: 'cluster',
      };
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function toCanvasEdge(
  edge: KnowledgeGraphEdge
): KnowledgeGraphData['edges'][number] {
  switch (edge.kind) {
    case 'org_relationship':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.relationshipType,
        strength: edge.confidence,
      };
    case 'org_in_cluster':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'related_to',
        strength: 0.85,
      };
    case 'org_matches_vendor':
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'often_used_with',
        strength: 0.75,
      };
    default: {
      const exhaustive: never = edge;
      return exhaustive;
    }
  }
}

/**
 * Adapt TRIB-104 operational graph payload into the legacy graph-canvas
 * contract used by the current 2D/3D graph components.
 */
export function toCanvasGraphData(
  payload: KnowledgeGraphPayload
): KnowledgeGraphData {
  const nodes = payload.nodes.map(toCanvasNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = payload.edges
    .map(toCanvasEdge)
    .filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

  return {
    nodes,
    edges,
  };
}
