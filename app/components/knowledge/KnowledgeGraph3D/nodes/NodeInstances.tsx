/**
 * NodeInstances - InstancedMesh node rendering
 *
 * Renders all graph nodes using THREE.InstancedMesh for performance.
 * Supports 10,000+ nodes at 30+ FPS with proper LOD settings.
 */

'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphNode3D, LODConfig, NodeInteractionState } from '../types';
import { CONCEPT_TYPE_COLORS } from '../types';

interface NodeInstancesProps {
  nodes: GraphNode3D[];
  interactionState: NodeInteractionState;
  lodConfig: LODConfig;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

/**
 * Calculate node scale based on mention count
 */
function getNodeScale(mentionCount: number): number {
  return Math.max(1, Math.min(3, Math.log2(mentionCount + 1)));
}

/**
 * Get color for node based on type and selection state
 */
function getNodeColor(
  node: GraphNode3D,
  interactionState: NodeInteractionState
): THREE.Color {
  const { selectedId, hoveredId, highlightedIds } = interactionState;

  // Selected node - accent color
  if (node.id === selectedId) {
    return new THREE.Color('#00df82');
  }

  // Hovered node - secondary color
  if (node.id === hoveredId) {
    return new THREE.Color('#2cc295');
  }

  // Highlighted (connected) nodes - slightly brighter
  if (highlightedIds.has(node.id)) {
    const baseColor = new THREE.Color(CONCEPT_TYPE_COLORS[node.type] || '#6366f1');
    baseColor.multiplyScalar(1.2);
    return baseColor;
  }

  // Default - type color
  return new THREE.Color(CONCEPT_TYPE_COLORS[node.type] || '#6366f1');
}

export function NodeInstances({
  nodes,
  interactionState,
  lodConfig,
  onNodeClick,
  onNodeHover,
}: NodeInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera, raycaster, pointer, gl } = useThree();
  const hoveredInstanceId = useRef<number | null>(null);
  // Store refs for use in click handler
  const nodesRef = useRef(nodes);
  const onNodeClickRef = useRef(onNodeClick);

  // Keep refs up to date
  useEffect(() => {
    nodesRef.current = nodes;
    onNodeClickRef.current = onNodeClick;
  }, [nodes, onNodeClick]);

  // Create geometry based on LOD
  const geometry = useMemo(
    () => new THREE.SphereGeometry(1, lodConfig.nodeSegments, lodConfig.nodeSegments),
    [lodConfig.nodeSegments]
  );

  // Create material with emissive for visibility
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // MeshBasicMaterial doesn't need lighting - nodes will be visible regardless
        // We'll set per-instance colors in the useEffect
      }),
    []
  );

  // Dummy object for matrix calculations
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Update instance matrices and colors when nodes change
  useEffect(() => {
    if (!meshRef.current || nodes.length === 0) return;

    const mesh = meshRef.current;

    nodes.forEach((node, i) => {
      // Set position and scale
      const scale = getNodeScale(node.mentionCount);
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Set color
      const color = getNodeColor(node, interactionState);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, interactionState, dummy]);

  // Listen for clicks on canvas - use the hovered node from useFrame
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = () => {
      if (!onNodeClickRef.current) return;

      // If we're hovering over a node (detected by useFrame), click it
      if (hoveredInstanceId.current !== null) {
        const node = nodesRef.current[hoveredInstanceId.current];
        if (node) {
          onNodeClickRef.current(node.id);
        }
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gl]);

  // Raycasting for hover detection only (clicks handled in mousedown listener)
  useFrame(() => {
    if (!meshRef.current || !onNodeHover) return;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(meshRef.current);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;

      // Handle hover
      if (instanceId !== undefined && instanceId !== hoveredInstanceId.current) {
        hoveredInstanceId.current = instanceId;
        const node = nodes[instanceId];
        if (node) {
          onNodeHover(node.id);
          document.body.style.cursor = 'pointer';
        }
      }
    } else {
      // Not hovering over any node
      if (hoveredInstanceId.current !== null) {
        hoveredInstanceId.current = null;
        onNodeHover(null);
        document.body.style.cursor = 'default';
      }
    }
  });

  if (nodes.length === 0) return null;

  return (
    <instancedMesh
      key={`instanced-${nodes.length}`} // Force recreation when count changes
      ref={meshRef}
      args={[geometry, material, nodes.length]}
      frustumCulled
    />
  );
}

export default NodeInstances;
