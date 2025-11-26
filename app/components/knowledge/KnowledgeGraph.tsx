'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Panel,
  type NodeProps,
} from '@xyflow/react';
import { Network } from 'lucide-react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils';
import {
  type ConceptType,
  CONCEPT_TYPE_COLORS,
  type GraphNode as BaseGraphNode,
  type GraphEdge as BaseGraphEdge,
} from '@/lib/validations/knowledge';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/app/components/ui/empty';

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeGraphProps {
  nodes?: BaseGraphNode[];
  edges?: BaseGraphEdge[];
  onNodeClick?: (conceptId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  isLoading?: boolean;
  height?: string | number;
}

interface ConceptNodeData extends BaseGraphNode {
  selected?: boolean;
  onNodeClick?: (conceptId: string) => void;
}

// ============================================================================
// Custom Node Component
// ============================================================================

/**
 * ConceptNode - Custom node component for rendering concept nodes
 *
 * Features:
 * - Colored border/background based on concept type
 * - Display name and mention count
 * - Selected state styling
 * - Hover effects
 */
function ConceptNode({ data, selected }: NodeProps<ConceptNodeData>) {
  const nodeData = data as ConceptNodeData;
  const color = CONCEPT_TYPE_COLORS[nodeData.type];
  const isSelected = selected || nodeData.selected;

  // Calculate luminance to determine if we need light or dark text
  const getLuminance = (hexColor: string): number => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };

  const isDark = getLuminance(color) < 0.5;

  const handleClick = useCallback(() => {
    if (nodeData.onNodeClick) {
      nodeData.onNodeClick(nodeData.id);
    }
  }, [nodeData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${nodeData.name} concept, ${nodeData.mentionCount} mentions, type: ${nodeData.type}`}
      aria-pressed={isSelected}
      className={cn(
        'relative rounded-lg border-2 bg-background px-4 py-3 shadow-md transition-all',
        'cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected && 'ring-2 ring-offset-2 shadow-xl scale-105',
        'min-w-[120px] max-w-[200px]'
      )}
      style={{
        borderColor: color,
        backgroundColor: isSelected ? `${color}15` : undefined,
      } as React.CSSProperties}
    >
      {/* Concept Name */}
      <div
        className={cn(
          'font-semibold text-sm mb-1 truncate',
          'text-foreground'
        )}
        title={nodeData.name}
      >
        {nodeData.name}
      </div>

      {/* Mention Count */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span
          className="inline-flex items-center justify-center rounded-full px-2 py-0.5 font-medium"
          style={{
            backgroundColor: color,
            color: isDark ? '#ffffff' : '#000000',
          }}
        >
          {nodeData.mentionCount} {nodeData.mentionCount === 1 ? 'mention' : 'mentions'}
        </span>
      </div>

      {/* Type indicator dot */}
      <div
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
        style={{ backgroundColor: color }}
        title={nodeData.type}
        aria-hidden="true"
      />
    </div>
  );
}

// Register custom node type
const nodeTypes = {
  concept: ConceptNode,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert graph data to ReactFlow nodes and edges
 */
function convertToFlowData(
  graphNodes: BaseGraphNode[],
  graphEdges: BaseGraphEdge[],
  selectedNodeId: string | null,
  onNodeClick?: (conceptId: string) => void
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const nodes: Node<ConceptNodeData>[] = graphNodes.map((node) => ({
    id: node.id,
    type: 'concept',
    position: { x: node.x || 0, y: node.y || 0 },
    data: {
      ...node,
      selected: node.id === selectedNodeId,
      onNodeClick,
    },
  }));

  const edges: Edge[] = graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: edge.type === 'prerequisite',
    style: {
      strokeWidth: Math.max(1, edge.strength * 3),
      opacity: Math.max(0.3, edge.strength),
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
    },
    label: edge.type === 'prerequisite' ? 'requires' : undefined,
    labelStyle: { fontSize: 10, fill: '#666' },
  }));

  return { nodes, edges };
}

/**
 * Apply automatic layout to nodes using a simple force-directed algorithm
 */
function applyAutoLayout(
  nodes: BaseGraphNode[],
  edges: BaseGraphEdge[]
): BaseGraphNode[] {
  // If nodes already have positions, use them
  if (nodes.every((n) => n.x !== undefined && n.y !== undefined)) {
    return nodes;
  }

  // Simple circular layout as fallback
  const radius = Math.max(200, nodes.length * 20);
  const centerX = 400;
  const centerY = 300;

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    return {
      ...node,
      x: node.x ?? centerX + radius * Math.cos(angle),
      y: node.y ?? centerY + radius * Math.sin(angle),
    };
  });
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function KnowledgeGraphSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative w-full rounded-lg border bg-background',
        className
      )}
      style={{ height: '600px' }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 max-w-sm">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Skeleton className="h-20 w-20 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-lg" />
            <Skeleton className="h-20 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * KnowledgeGraph - Interactive knowledge graph visualization
 *
 * Features:
 * - ReactFlow-based graph visualization
 * - Custom concept nodes with type-specific colors
 * - Clickable nodes to show concept details
 * - Zoom controls and minimap
 * - Responsive sizing
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * <KnowledgeGraph
 *   nodes={graphData.nodes}
 *   edges={graphData.edges}
 *   onNodeClick={(id) => console.log('Clicked:', id)}
 *   selectedNodeId={selectedId}
 *   isLoading={false}
 * />
 * ```
 */
export function KnowledgeGraph({
  nodes: propNodes = [],
  edges: propEdges = [],
  onNodeClick,
  selectedNodeId = null,
  className,
  isLoading = false,
  height = '600px',
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Apply auto layout to nodes
  const layoutNodes = useMemo(() => {
    return applyAutoLayout(propNodes, propEdges);
  }, [propNodes, propEdges]);

  // Convert to ReactFlow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return convertToFlowData(layoutNodes, propEdges, selectedNodeId, onNodeClick);
  }, [layoutNodes, propEdges, selectedNodeId, onNodeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when props change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToFlowData(
      layoutNodes,
      propEdges,
      selectedNodeId,
      onNodeClick
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [layoutNodes, propEdges, selectedNodeId, onNodeClick, setNodes, setEdges]);

  // Handle responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Loading state
  if (isLoading) {
    return <KnowledgeGraphSkeleton className={className} />;
  }

  // Empty state
  if (propNodes.length === 0) {
    return (
      <div
        className={cn('w-full rounded-lg border bg-background', className)}
        style={{ height }}
      >
        <Empty className="h-full border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Network className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No Knowledge Graph Available</EmptyTitle>
            <EmptyDescription>
              Start adding content to build your knowledge graph. Concepts will appear here as they are extracted from your recordings and documents.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <p className="text-xs text-muted-foreground">
              The knowledge graph visualizes relationships between concepts, tools, processes, and people across your organization's content.
            </p>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full rounded-lg border bg-background', className)}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background className="bg-muted/20" gap={16} />
        <Controls showInteractive={false} aria-label="Graph controls" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as ConceptNodeData;
            return CONCEPT_TYPE_COLORS[data.type];
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-background border border-border"
          aria-label="Graph minimap"
        />
        <Panel position="top-right" className="bg-background/80 backdrop-blur-sm rounded-lg p-2 text-xs text-muted-foreground">
          <span aria-live="polite" aria-atomic="true">
            {propNodes.length} concepts, {propEdges.length} connections
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
}

/**
 * Usage Examples:
 *
 * // Basic usage
 * <KnowledgeGraph
 *   nodes={[
 *     { id: '1', name: 'React', type: 'tool', mentionCount: 10 },
 *     { id: '2', name: 'TypeScript', type: 'tool', mentionCount: 8 }
 *   ]}
 *   edges={[
 *     { id: 'e1', source: '1', target: '2', type: 'related', strength: 0.8 }
 *   ]}
 * />
 *
 * // With selection and click handling
 * <KnowledgeGraph
 *   nodes={graphData.nodes}
 *   edges={graphData.edges}
 *   selectedNodeId={selectedId}
 *   onNodeClick={(id) => setSelectedId(id)}
 * />
 *
 * // Loading state
 * <KnowledgeGraph isLoading={true} />
 *
 * // Custom height
 * <KnowledgeGraph
 *   nodes={nodes}
 *   edges={edges}
 *   height="800px"
 * />
 */
