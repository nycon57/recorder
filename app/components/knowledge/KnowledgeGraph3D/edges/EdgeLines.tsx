/**
 * EdgeLines - Edge rendering for 3D graph
 *
 * Renders connections between nodes using THREE.Line with
 * color-coding based on relationship type and opacity based on strength.
 */

'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphNode3D, GraphEdge3D, LODConfig } from '../types';
import { EDGE_TYPE_COLORS } from '../types';

interface EdgeLinesProps {
  edges: GraphEdge3D[];
  nodes: GraphNode3D[];
  lodConfig: LODConfig;
  selectedNodeId?: string | null;
}

/**
 * Get resolved node position from edge source/target
 */
function getNodePosition(
  nodeRef: string | GraphNode3D,
  nodesMap: Map<string, GraphNode3D>
): THREE.Vector3 | null {
  if (typeof nodeRef === 'string') {
    const node = nodesMap.get(nodeRef);
    return node ? new THREE.Vector3(node.x, node.y, node.z) : null;
  }
  return new THREE.Vector3(nodeRef.x, nodeRef.y, nodeRef.z);
}

/**
 * Get edge color based on relationship type
 */
function getEdgeColor(type: string): string {
  return EDGE_TYPE_COLORS[type] || EDGE_TYPE_COLORS.related;
}

/**
 * Single edge line component
 */
function EdgeLine({
  edge,
  startPos,
  endPos,
  isHighlighted,
}: {
  edge: GraphEdge3D;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  isHighlighted: boolean;
}) {
  const color = getEdgeColor(edge.type);
  const opacity = isHighlighted ? 0.9 : Math.max(0.2, edge.strength * 0.6);
  const lineWidth = isHighlighted ? 2 : Math.max(0.5, edge.strength * 1.5);

  const points = useMemo(() => [startPos, endPos], [startPos, endPos]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  return (
    <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      linewidth: lineWidth,
    }))} />
  );
}

export function EdgeLines({
  edges,
  nodes,
  lodConfig,
  selectedNodeId,
}: EdgeLinesProps) {
  // Create node lookup map
  const nodesMap = useMemo(() => {
    const map = new Map<string, GraphNode3D>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Limit edges based on LOD
  const visibleEdges = useMemo(() => {
    if (edges.length <= lodConfig.maxVisibleEdges) {
      return edges;
    }

    // Sort by strength and take top N
    return [...edges]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, lodConfig.maxVisibleEdges);
  }, [edges, lodConfig.maxVisibleEdges]);

  // Render edges
  const renderedEdges = useMemo(() => {
    return visibleEdges.map((edge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;

      const startPos = getNodePosition(edge.source, nodesMap);
      const endPos = getNodePosition(edge.target, nodesMap);

      if (!startPos || !endPos) return null;

      // Check if edge is connected to selected node
      const isHighlighted =
        selectedNodeId !== null &&
        (sourceId === selectedNodeId || targetId === selectedNodeId);

      return (
        <EdgeLine
          key={edge.id}
          edge={edge}
          startPos={startPos}
          endPos={endPos}
          isHighlighted={isHighlighted}
        />
      );
    });
  }, [visibleEdges, nodesMap, selectedNodeId]);

  return <group name="edges">{renderedEdges}</group>;
}

export default EdgeLines;
