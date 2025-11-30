/**
 * useGraphLayout - d3-force-3d integration hook
 *
 * Computes 3D positions for graph nodes using force-directed simulation.
 * Supports dynamic updates and warm-up for initial stabilization.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { GraphNode, GraphEdge } from '@/lib/validations/knowledge';
import type { GraphNode3D, GraphEdge3D } from '../types';
import type { Simulation } from 'd3-force-3d';

interface UseGraphLayoutOptions {
  strength?: number;          // Charge strength (negative = repulsion)
  linkDistance?: number;      // Desired link length
  centerStrength?: number;    // Force toward center
  warmupTicks?: number;       // Initial simulation ticks
  onLayoutComplete?: () => void;
}

interface UseGraphLayoutResult {
  layoutNodes: GraphNode3D[];
  layoutEdges: GraphEdge3D[];
  isSimulating: boolean;
  reheat: () => void;
}

/**
 * Initialize node with 3D position
 */
function initializeNode(node: GraphNode, index: number, total: number): GraphNode3D {
  // If node has existing position, use it
  if (node.x !== undefined && node.y !== undefined) {
    return {
      ...node,
      x: node.x,
      y: node.y,
      z: (Math.random() - 0.5) * 100,
    };
  }

  // Spherical distribution for initial positions
  const phi = Math.acos(-1 + (2 * index) / total);
  const theta = Math.sqrt(total * Math.PI) * phi;
  const radius = 100 + Math.random() * 50;

  return {
    ...node,
    x: radius * Math.cos(theta) * Math.sin(phi),
    y: radius * Math.sin(theta) * Math.sin(phi),
    z: radius * Math.cos(phi),
  };
}

export function useGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: UseGraphLayoutOptions = {}
): UseGraphLayoutResult {
  const {
    strength = -100,
    linkDistance = 50,
    centerStrength = 0.05,
    warmupTicks = 100,
    onLayoutComplete,
  } = options;

  const [layoutNodes, setLayoutNodes] = useState<GraphNode3D[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<GraphEdge3D[]>([]);
  const [isSimulating, setIsSimulating] = useState(true);
  const simulationRef = useRef<Simulation<GraphNode3D> | null>(null);
  const nodesRef = useRef<GraphNode3D[]>([]);

  // Convert edges to 3D format
  const edges3D = useMemo((): GraphEdge3D[] => {
    return edges.map(edge => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));
  }, [edges]);

  // Initialize and run simulation
  useEffect(() => {
    if (nodes.length === 0) {
      setLayoutNodes([]);
      setLayoutEdges([]);
      setIsSimulating(false);
      return;
    }

    // Dynamically import d3-force-3d
    import('d3-force-3d').then((d3Force) => {
      // Initialize nodes with 3D positions
      const initialNodes: GraphNode3D[] = nodes.map((node, index) =>
        initializeNode(node, index, nodes.length)
      );
      nodesRef.current = initialNodes;

      // Prepare links for simulation
      const links = edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        strength: edge.strength,
      }));

      // Create 3D force simulation
      const simulation = d3Force.forceSimulation<GraphNode3D>(initialNodes, 3);

      simulation
        .force(
          'link',
          d3Force
            .forceLink<GraphNode3D>(links)
            .id((d) => d.id)
            .distance(linkDistance)
            .strength((d) => (d as { strength?: number }).strength ?? 0.5)
        )
        .force('charge', d3Force.forceManyBody<GraphNode3D>().strength(strength))
        .force('center', d3Force.forceCenter<GraphNode3D>(0, 0, 0).strength(centerStrength))
        .force('z', d3Force.forceZ<GraphNode3D>(0).strength(0.01))
        .alphaDecay(0.02)
        .velocityDecay(0.3);

      // Warm up simulation
      simulation.tick(warmupTicks);

      // Update state with positioned nodes
      setLayoutNodes([...nodesRef.current]);
      setLayoutEdges(edges3D);

      // Continue simulation with tick updates
      simulation.on('tick', () => {
        setLayoutNodes([...nodesRef.current]);
      });

      // Handle simulation end
      simulation.on('end', () => {
        setIsSimulating(false);
        onLayoutComplete?.();
      });

      simulationRef.current = simulation;

      // Stop simulation after timeout to save resources
      const timeout = setTimeout(() => {
        simulation.stop();
        setIsSimulating(false);
      }, 5000);

      return () => {
        clearTimeout(timeout);
        simulation.stop();
      };
    });
  }, [nodes, edges, edges3D, strength, linkDistance, centerStrength, warmupTicks, onLayoutComplete]);

  // Reheat simulation (e.g., after user interaction)
  const reheat = useCallback(() => {
    if (simulationRef.current) {
      setIsSimulating(true);
      simulationRef.current.alpha(0.3).restart();
    }
  }, []);

  return {
    layoutNodes,
    layoutEdges,
    isSimulating,
    reheat,
  };
}

export default useGraphLayout;
