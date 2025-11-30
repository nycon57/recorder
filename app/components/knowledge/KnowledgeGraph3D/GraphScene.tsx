/**
 * GraphScene - Main 3D scene orchestrator
 *
 * Manages lighting, camera, environment, and child components.
 * Handles the overall scene composition and effects.
 */

'use client';

import { useRef, useState, useCallback, useMemo, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { GraphNode3D, GraphEdge3D, LODConfig, NodeInteractionState } from './types';
import { NodeInstances } from './nodes/NodeInstances';
import { EdgeLines } from './edges/EdgeLines';

interface GraphSceneProps {
  nodes: GraphNode3D[];
  edges: GraphEdge3D[];
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  lodConfig: LODConfig;
}

/**
 * Camera controller with fly-to animation
 */
function CameraController({
  selectedNode,
  onFlyComplete,
}: {
  selectedNode?: GraphNode3D | null;
  onFlyComplete?: () => void;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const isFlying = useRef(false);
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Fly to selected node
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (selectedNode && !isFlying.current) {
      // Start flying to node
      isFlying.current = true;
      targetLookAt.current.set(selectedNode.x, selectedNode.y, selectedNode.z);

      // Position camera at distance from node
      const distance = 80;
      const direction = new THREE.Vector3()
        .subVectors(camera.position, targetLookAt.current)
        .normalize();
      targetPosition.current
        .copy(targetLookAt.current)
        .add(direction.multiplyScalar(distance));
    }

    if (isFlying.current) {
      // Smooth camera transition
      const controls = controlsRef.current;
      const speed = 2 * delta;

      controls.target.lerp(targetLookAt.current, speed);
      camera.position.lerp(targetPosition.current, speed);

      // Check if reached destination
      const distanceToTarget = camera.position.distanceTo(targetPosition.current);
      if (distanceToTarget < 1) {
        isFlying.current = false;
        onFlyComplete?.();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={20}
      maxDistance={800}
      panSpeed={0.5}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
  );
}

/**
 * Environment and lighting setup
 */
function Environment({ showStars }: { showStars: boolean }) {
  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.3} />

      {/* Main directional light */}
      <directionalLight position={[50, 100, 50]} intensity={0.5} color="#ffffff" />

      {/* Accent point light at center */}
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#00df82" distance={200} />

      {/* Background fog for depth */}
      <fog attach="fog" args={['#030e10', 150, 600]} />

      {/* Stars background */}
      {showStars && (
        <Stars
          radius={400}
          depth={80}
          count={1200}
          factor={4}
          saturation={0}
          fade
          speed={0.3}
        />
      )}
    </>
  );
}

/**
 * Selected node indicator ring
 */
function SelectedNodeRing({ node }: { node: GraphNode3D }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const scale = Math.max(1, Math.min(3, Math.log2(node.mentionCount + 1)));

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      ringRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Rotating ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[scale * 2, 0.15, 16, 64]} />
        <meshBasicMaterial color="#00df82" transparent opacity={0.8} />
      </mesh>

      {/* Glow sprite */}
      <sprite scale={[scale * 4, scale * 4, 1]}>
        <spriteMaterial
          color="#00df82"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

/**
 * Node labels (billboard text)
 */
function NodeLabels({
  nodes,
  selectedNodeId,
  hoveredNodeId,
  lodConfig,
}: {
  nodes: GraphNode3D[];
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  lodConfig: LODConfig;
}) {
  const { camera } = useThree();

  // Filter nodes that should show labels
  const labelNodes = useMemo(() => {
    if (!lodConfig.showLabels) return [];

    return nodes.filter((node) => {
      // Always show selected/hovered
      if (node.id === selectedNodeId || node.id === hoveredNodeId) return true;
      // Show high-mention nodes
      if (node.mentionCount >= 5) return true;
      return false;
    });
  }, [nodes, selectedNodeId, hoveredNodeId, lodConfig.showLabels]);

  return (
    <group name="labels">
      {labelNodes.map((node) => {
        const scale = Math.max(1, Math.min(3, Math.log2(node.mentionCount + 1)));
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;

        return (
          <Billboard
            key={`label-${node.id}`}
            position={[node.x, node.y + scale + 2, node.z]}
            follow
          >
            <Text
              fontSize={isSelected || isHovered ? 2.5 : 2}
              color={isSelected ? '#00df82' : isHovered ? '#2cc295' : '#ffffff'}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.1}
              outlineColor="#030e10"
              maxWidth={20}
            >
              {node.name}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}

/**
 * Post-processing effects
 */
function PostProcessingEffects({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.3}
        luminanceSmoothing={0.9}
        intensity={0.4}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.4} />
    </EffectComposer>
  );
}

/**
 * Main GraphScene component
 */
export function GraphScene({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
  lodConfig,
}: GraphSceneProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Find connected nodes for highlighting
  const highlightedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();

    const connected = new Set<string>();
    edges.forEach((edge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;

      if (sourceId === selectedNodeId) connected.add(targetId);
      if (targetId === selectedNodeId) connected.add(sourceId);
    });
    return connected;
  }, [selectedNodeId, edges]);

  const interactionState: NodeInteractionState = {
    selectedId: selectedNodeId ?? null,
    hoveredId: hoveredNodeId,
    highlightedIds,
  };

  // Find selected node for camera fly-to
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  return (
    <>
      {/* Environment */}
      <Environment showStars={lodConfig.showGlow} />

      {/* Camera controls */}
      <CameraController selectedNode={selectedNode} />

      {/* Edges */}
      <EdgeLines
        edges={edges}
        nodes={nodes}
        lodConfig={lodConfig}
        selectedNodeId={selectedNodeId}
      />

      {/* Nodes */}
      <NodeInstances
        nodes={nodes}
        interactionState={interactionState}
        lodConfig={lodConfig}
        onNodeClick={onNodeClick}
        onNodeHover={setHoveredNodeId}
      />

      {/* Selected node indicator */}
      {selectedNode && <SelectedNodeRing node={selectedNode} />}

      {/* Labels */}
      <NodeLabels
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        lodConfig={lodConfig}
      />

      {/* Post-processing */}
      <Suspense fallback={null}>
        <PostProcessingEffects enabled={lodConfig.showPostProcessing} />
      </Suspense>
    </>
  );
}

export default GraphScene;
