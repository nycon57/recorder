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
  type EdgeMouseHandler,
  MarkerType,
  Panel,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import { ChevronDown, ChevronUp, Network, Info, X, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import '@xyflow/react/dist/style.css';
import './knowledge-graph.css';

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
  highlighted?: boolean;
  onNodeClick?: (conceptId: string) => void;
}

interface SelectedEdgeInfo {
  edge: BaseGraphEdge;
  sourceNode: BaseGraphNode;
  targetNode: BaseGraphNode;
  position: { x: number; y: number };
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
  const isHighlighted = nodeData.highlighted;

  // Calculate luminance to determine if we need light or dark text
  const getLuminance = (hexColor: string): number => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
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
        isHighlighted && 'ring-2 ring-accent ring-offset-2 shadow-lg shadow-accent/20 scale-102',
        'min-w-[120px] max-w-[200px]'
      )}
      style={{
        borderColor: color,
        backgroundColor: isSelected ? `${color}15` : isHighlighted ? `${color}10` : undefined,
      } as React.CSSProperties}
    >
      {/* Connection handles for edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-muted-foreground/50 !border-0"
      />

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
// Edge Legend Component
// ============================================================================

// Edge relationship type definitions with colors and descriptions
const EDGE_TYPES = [
  {
    types: ['prerequisite', 'requires'],
    color: '#ef4444',
    label: 'Prerequisite / Requires',
    animated: true,
  },
  {
    types: ['co-occurs', 'often_used_with'],
    color: '#22c55e',
    label: 'Co-occurs / Often Used With',
    animated: false,
  },
  {
    types: ['uses', 'implements'],
    color: '#3b82f6',
    label: 'Uses / Implements',
    animated: false,
  },
  {
    types: ['created_by', 'works_on', 'employs'],
    color: '#f97316',
    label: 'Created By / Works On / Employs',
    animated: false,
  },
  {
    types: ['provides'],
    color: '#8b5cf6',
    label: 'Provides',
    animated: false,
  },
  {
    types: ['related', 'related_to'],
    color: '#6366f1',
    label: 'Related / General',
    animated: false,
  },
] as const;

/**
 * EdgeLegend - Collapsible legend showing edge relationship types
 *
 * Displays all edge colors and their meanings in a compact panel
 */
function EdgeLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  return (
    <div className="edge-legend">
      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="edge-legend-toggle"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse edge legend' : 'Expand edge legend'}
        type="button"
      >
        <Info className="h-3 w-3" />
        <span>Edge Legend</span>
        {isExpanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="edge-legend-content" role="region" aria-label="Edge relationship types">
          {EDGE_TYPES.map((edgeType, index) => (
            <div key={index} className="edge-legend-item">
              <div
                className={cn('edge-legend-line', edgeType.animated && 'animated')}
                style={{ backgroundColor: edgeType.color }}
                aria-hidden="true"
              />
              <span className="edge-legend-label">{edgeType.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Edge Popover Component
// ============================================================================

/**
 * Get human-readable label for edge type
 */
function getEdgeTypeLabel(type: string): string {
  const edgeType = EDGE_TYPES.find((et) => et.types.includes(type as never));
  return edgeType?.label || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get edge color by type
 */
function getEdgeColor(type: string): string {
  const edgeType = EDGE_TYPES.find((et) => et.types.includes(type as never));
  return edgeType?.color || '#6366f1';
}

interface EdgePopoverProps {
  selectedEdge: SelectedEdgeInfo;
  onClose: () => void;
  onNodeClick?: (conceptId: string) => void;
}

/**
 * Get strength label based on percentage
 */
function getStrengthLabel(percent: number): string {
  if (percent >= 80) return 'Very Strong';
  if (percent >= 60) return 'Strong';
  if (percent >= 40) return 'Moderate';
  if (percent >= 20) return 'Weak';
  return 'Very Weak';
}

/**
 * EdgePopover - Displays relationship details when an edge is clicked
 */
function EdgePopover({ selectedEdge, onClose, onNodeClick }: EdgePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { edge, sourceNode, targetNode, position } = selectedEdge;
  const edgeColor = getEdgeColor(edge.type);
  const strengthPercent = Math.round(edge.strength * 100);
  const strengthLabel = getStrengthLabel(strengthPercent);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the edge click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="edge-popover"
      style={{
        left: position.x,
        top: position.y,
      }}
      role="dialog"
      aria-label="Edge relationship details"
    >
      {/* Header with close button */}
      <div className="edge-popover-header">
        <span className="edge-popover-title">Connection</span>
        <button
          onClick={onClose}
          className="edge-popover-close"
          aria-label="Close"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Connected concepts - vertical flow with connecting line */}
      <div className="edge-popover-connection">
        {/* Source node row - clickable */}
        <button
          className="edge-popover-row edge-popover-row--clickable"
          onClick={() => onNodeClick?.(sourceNode.id)}
          type="button"
          aria-label={`View ${sourceNode.name} details`}
        >
          <div className="edge-popover-rail">
            <div
              className="edge-popover-dot"
              style={{ backgroundColor: CONCEPT_TYPE_COLORS[sourceNode.type] }}
            />
          </div>
          <div className="edge-popover-content">
            <span className="edge-popover-name">{sourceNode.name}</span>
            <span className="edge-popover-type">{sourceNode.type.replace(/_/g, ' ')}</span>
          </div>
        </button>

        {/* Connector row */}
        <div className="edge-popover-row edge-popover-row--connector">
          <div className="edge-popover-rail">
            <div
              className="edge-popover-line"
              style={{ backgroundColor: edgeColor }}
            />
            <div
              className="edge-popover-arrow"
              style={{ borderTopColor: edgeColor }}
            />
          </div>
          <div className="edge-popover-content">
            <span
              className="edge-popover-label"
              style={{ color: edgeColor, borderColor: `${edgeColor}40` }}
            >
              {edge.type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Target node row - clickable */}
        <button
          className="edge-popover-row edge-popover-row--clickable"
          onClick={() => onNodeClick?.(targetNode.id)}
          type="button"
          aria-label={`View ${targetNode.name} details`}
        >
          <div className="edge-popover-rail">
            <div
              className="edge-popover-dot"
              style={{ backgroundColor: CONCEPT_TYPE_COLORS[targetNode.type] }}
            />
          </div>
          <div className="edge-popover-content">
            <span className="edge-popover-name">{targetNode.name}</span>
            <span className="edge-popover-type">{targetNode.type.replace(/_/g, ' ')}</span>
          </div>
        </button>
      </div>

      {/* Strength indicator */}
      <div className="edge-popover-strength">
        <div className="edge-popover-strength-header">
          <span className="edge-popover-strength-label">Connection Strength</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="edge-popover-strength-info"
                aria-label="Connection strength explanation"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-left">
              <p className="font-medium mb-1">Connection Strength</p>
              <p className="text-xs opacity-90 mb-2">
                Measures how often these concepts appear together in your content.
              </p>
              <div className="text-xs space-y-0.5 opacity-80">
                <div>80-100%: Very Strong</div>
                <div>60-79%: Strong</div>
                <div>40-59%: Moderate</div>
                <div>20-39%: Weak</div>
                <div>0-19%: Very Weak</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="edge-popover-strength-value-row">
          <span className="edge-popover-strength-rating">{strengthLabel}</span>
          <div className="edge-popover-strength-bar">
            <div
              className="edge-popover-strength-fill"
              style={{
                width: `${strengthPercent}%`,
                backgroundColor: edgeColor,
              }}
            />
          </div>
          <span className="edge-popover-strength-value">{strengthPercent}%</span>
        </div>
      </div>
    </div>
  );
}

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
  highlightedNodeIds: Set<string>,
  selectedEdgeId: string | null,
  onNodeClick?: (conceptId: string) => void
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const nodes: Node<ConceptNodeData>[] = graphNodes.map((node) => ({
    id: node.id,
    type: 'concept',
    position: { x: node.x || 0, y: node.y || 0 },
    data: {
      ...node,
      selected: node.id === selectedNodeId,
      highlighted: highlightedNodeIds.has(node.id),
      onNodeClick,
    },
  }));

  // Get edge color based on relationship type
  const getEdgeColor = (type: string): string => {
    switch (type) {
      case 'prerequisite':
      case 'requires':
        return '#ef4444'; // red-500 for prerequisites/requirements
      case 'co-occurs':
      case 'often_used_with':
        return '#22c55e'; // green-500 for co-occurrence
      case 'uses':
      case 'implements':
        return '#3b82f6'; // blue-500 for usage relationships
      case 'created_by':
      case 'works_on':
      case 'employs':
        return '#f97316'; // orange-500 for people/org relationships
      case 'provides':
        return '#8b5cf6'; // violet-500 for provider relationships
      case 'related':
      case 'related_to':
      default:
        return '#6366f1'; // indigo-500 for general related
    }
  };

  const edges: Edge[] = graphEdges.map((edge) => {
    const edgeColor = getEdgeColor(edge.type);
    const isSelected = edge.id === selectedEdgeId;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      // Use 'default' (bezier) for curved edges that route around nodes better
      // 'smoothstep' causes straight orthogonal lines that pass through unrelated nodes
      type: 'default',
      animated: edge.type === 'prerequisite' || edge.type === 'requires',
      selected: isSelected,
      style: {
        stroke: edgeColor,
        strokeWidth: isSelected ? 4 : Math.max(2, edge.strength * 4),
        opacity: isSelected ? 1 : Math.max(0.5, edge.strength),
        cursor: 'pointer',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: isSelected ? 24 : 20,
        height: isSelected ? 24 : 20,
        color: edgeColor,
      },
      label: edge.type === 'prerequisite' ? 'requires' : undefined,
      labelStyle: { fontSize: 10, fill: '#666' },
      // Store original edge data for click handler
      data: { originalEdge: edge },
    };
  });

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
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdgeInfo | null>(null);

  // Compute highlighted nodes based on selected edge
  const highlightedNodeIds = useMemo(() => {
    if (!selectedEdge) return new Set<string>();
    return new Set([selectedEdge.edge.source, selectedEdge.edge.target]);
  }, [selectedEdge]);

  // Apply auto layout to nodes
  const layoutNodes = useMemo(() => {
    return applyAutoLayout(propNodes, propEdges);
  }, [propNodes, propEdges]);

  // Convert to ReactFlow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return convertToFlowData(
      layoutNodes,
      propEdges,
      selectedNodeId,
      highlightedNodeIds,
      selectedEdge?.edge.id || null,
      onNodeClick
    );
  }, [layoutNodes, propEdges, selectedNodeId, highlightedNodeIds, selectedEdge, onNodeClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when props change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToFlowData(
      layoutNodes,
      propEdges,
      selectedNodeId,
      highlightedNodeIds,
      selectedEdge?.edge.id || null,
      onNodeClick
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [layoutNodes, propEdges, selectedNodeId, highlightedNodeIds, selectedEdge, onNodeClick, setNodes, setEdges]);

  // Handle edge click
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      // Find the original edge data from propEdges
      const originalEdge = propEdges.find((e) => e.id === edge.id);
      if (!originalEdge) return;

      // Find source and target nodes
      const sourceNode = propNodes.find((n) => n.id === originalEdge.source);
      const targetNode = propNodes.find((n) => n.id === originalEdge.target);
      if (!sourceNode || !targetNode) return;

      // Get click position relative to container
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;

      setSelectedEdge({
        edge: originalEdge,
        sourceNode,
        targetNode,
        position: { x, y },
      });
    },
    [propEdges, propNodes]
  );

  // Close edge popover
  const handleCloseEdgePopover = useCallback(() => {
    setSelectedEdge(null);
  }, []);

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
        onEdgeClick={handleEdgeClick}
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
          type: 'default', // bezier curves for smoother routing
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
          aria-label="Graph minimap"
        />
        <Panel position="top-right" className="bg-background/80 backdrop-blur-sm rounded-lg p-2 text-xs text-muted-foreground">
          <span aria-live="polite" aria-atomic="true">
            {propNodes.length} concepts, {propEdges.length} connections
          </span>
        </Panel>
        <EdgeLegend />
      </ReactFlow>

      {/* Edge details popover */}
      {selectedEdge && (
        <EdgePopover
          selectedEdge={selectedEdge}
          onClose={handleCloseEdgePopover}
          onNodeClick={onNodeClick}
        />
      )}
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
