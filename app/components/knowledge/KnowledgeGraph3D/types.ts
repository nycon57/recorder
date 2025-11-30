/**
 * 3D Knowledge Graph Type Definitions
 *
 * TypeScript interfaces for the 3D visualization components.
 * Extends base types from knowledge.ts with 3D-specific properties.
 */

import type { ConceptType, GraphNode, GraphEdge, RelationshipType } from '@/lib/validations/knowledge';

// ============================================================================
// 3D Node Types
// ============================================================================

/**
 * Extended graph node with 3D position coordinates
 */
export interface GraphNode3D extends GraphNode {
  x: number;
  y: number;
  z: number;
  vx?: number;  // velocity for physics simulation
  vy?: number;
  vz?: number;
  fx?: number;  // fixed position (locks node)
  fy?: number;
  fz?: number;
}

/**
 * Node data for selection/interaction state
 */
export interface NodeInteractionState {
  selectedId: string | null;
  hoveredId: string | null;
  highlightedIds: Set<string>;
}

// ============================================================================
// 3D Edge Types
// ============================================================================

/**
 * Extended graph edge with resolved node references
 */
export interface GraphEdge3D extends Omit<GraphEdge, 'source' | 'target'> {
  source: string | GraphNode3D;
  target: string | GraphNode3D;
}

/**
 * Edge type color mapping
 */
export const EDGE_TYPE_COLORS: Record<string, string> = {
  prerequisite: '#ef4444',   // red-500
  requires: '#ef4444',       // red-500
  'co-occurs': '#22c55e',    // green-500
  often_used_with: '#22c55e', // green-500
  uses: '#3b82f6',           // blue-500
  implements: '#3b82f6',     // blue-500
  created_by: '#f97316',     // orange-500
  works_on: '#f97316',       // orange-500
  employs: '#f97316',        // orange-500
  provides: '#8b5cf6',       // violet-500
  related: '#6366f1',        // indigo-500
  related_to: '#6366f1',     // indigo-500
};

// ============================================================================
// Level of Detail (LOD) Types
// ============================================================================

/**
 * LOD levels for adaptive rendering
 */
export type LODLevel = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';

/**
 * Configuration for each LOD level
 */
export interface LODConfig {
  nodeSegments: number;       // Sphere geometry detail
  showLabels: boolean;        // Text labels on nodes
  showParticles: boolean;     // Edge particles
  showGlow: boolean;          // Node glow effect
  showPostProcessing: boolean; // Bloom/effects
  instancedBatch: number;     // Batch size for instanced meshes
  maxVisibleEdges: number;    // Edge render limit
  labelDistance: number;      // Distance at which labels appear
}

/**
 * LOD configurations by level
 */
export const LOD_CONFIGS: Record<LODLevel, LODConfig> = {
  ultra: {
    nodeSegments: 32,
    showLabels: true,
    showParticles: true,
    showGlow: true,
    showPostProcessing: true,
    instancedBatch: 100,
    maxVisibleEdges: Infinity,
    labelDistance: 200,
  },
  high: {
    nodeSegments: 24,
    showLabels: true,
    showParticles: true,
    showGlow: true,
    showPostProcessing: true,
    instancedBatch: 500,
    maxVisibleEdges: 2000,
    labelDistance: 150,
  },
  medium: {
    nodeSegments: 16,
    showLabels: true,
    showParticles: false,
    showGlow: true,
    showPostProcessing: true,
    instancedBatch: 1000,
    maxVisibleEdges: 1000,
    labelDistance: 100,
  },
  low: {
    nodeSegments: 8,
    showLabels: false,
    showParticles: false,
    showGlow: false,
    showPostProcessing: false,
    instancedBatch: 2000,
    maxVisibleEdges: 500,
    labelDistance: 50,
  },
  minimal: {
    nodeSegments: 6,
    showLabels: false,
    showParticles: false,
    showGlow: false,
    showPostProcessing: false,
    instancedBatch: 5000,
    maxVisibleEdges: 200,
    labelDistance: 30,
  },
};

// ============================================================================
// Props Types
// ============================================================================

/**
 * Main KnowledgeGraph3D component props
 */
export interface KnowledgeGraph3DProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onNodeClick?: (conceptId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  isLoading?: boolean;
  height?: number;
}

/**
 * Graph scene props
 */
export interface GraphSceneProps {
  nodes: GraphNode3D[];
  edges: GraphEdge3D[];
  onNodeClick?: (conceptId: string) => void;
  selectedNodeId?: string | null;
  lodConfig: LODConfig;
}

/**
 * Camera controller props
 */
export interface CameraControllerProps {
  selectedNode?: GraphNode3D | null;
  onFlyComplete?: () => void;
  initialPosition?: [number, number, number];
}

// ============================================================================
// Performance Types
// ============================================================================

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  nodeCount: number;
  edgeCount: number;
  lodLevel: LODLevel;
}

/**
 * Device capability detection result
 */
export interface DeviceCapabilities {
  webgl2: boolean;
  webgl1: boolean;
  maxTextureSize: number;
  gpuTier: 'high' | 'medium' | 'low' | 'unknown';
  recommendedLOD: LODLevel;
}

// ============================================================================
// Re-export base types for convenience
// ============================================================================

export type { ConceptType, GraphNode, GraphEdge, RelationshipType };
export { CONCEPT_TYPE_COLORS } from '@/lib/validations/knowledge';
