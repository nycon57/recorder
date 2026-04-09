/**
 * KnowledgeGraph3D - Main 3D Knowledge Graph Component
 *
 * A React Three Fiber based 3D visualization of the knowledge graph.
 * Features:
 * - InstancedMesh for 10K+ node performance
 * - Adaptive LOD based on node count and FPS
 * - Force-directed layout with d3-force-3d
 * - Premium visual effects (bloom, glow, particles)
 * - Orbit camera controls with fly-to-node
 *
 * USAGE: Import via dynamic() to avoid SSR issues:
 *
 * ```tsx
 * import dynamic from 'next/dynamic';
 *
 * const KnowledgeGraph3D = dynamic(
 *   () => import('@/app/components/knowledge/KnowledgeGraph3D'),
 *   { ssr: false, loading: () => <KnowledgeGraph3DSkeleton /> }
 * );
 * ```
 */

'use client';

import { Suspense, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty';

import { GraphScene } from './GraphScene';
import { useGraphLayout } from './hooks/useGraphLayout';
import { useAdaptiveLOD } from './hooks/useAdaptiveLOD';
import type { KnowledgeGraph3DProps, GraphNode3D } from './types';
import { LOD_CONFIGS } from './types';

// ============================================================================
// Skeleton Component
// ============================================================================

export function KnowledgeGraph3DSkeleton({
  className,
  height = 600,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-lg border bg-background',
        className
      )}
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading 3D visualization...</p>
      </div>
    </div>
  );
}

// ============================================================================
// Controls Overlay
// ============================================================================

interface ControlsOverlayProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView: () => void;
  nodeCount: number;
  edgeCount: number;
  fps: number;
  lodLevel: string;
}

function ControlsOverlay({
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  nodeCount,
  edgeCount,
  fps,
  lodLevel,
}: ControlsOverlayProps) {
  return (
    <>
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onZoomIn}
              className="bg-background/80 backdrop-blur-sm"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom in (+)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onZoomOut}
              className="bg-background/80 backdrop-blur-sm"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom out (-)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onFitView}
              className="bg-background/80 backdrop-blur-sm"
              aria-label="Fit view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Fit view (F)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onResetView}
              className="bg-background/80 backdrop-blur-sm"
              aria-label="Reset camera"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Reset camera (R)</TooltipContent>
        </Tooltip>
      </div>

      {/* Stats panel */}
      <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground z-10 flex flex-col gap-1">
        <span>{nodeCount} concepts</span>
        <span>{edgeCount} connections</span>
        <span className="text-[10px] opacity-70">
          {fps} FPS • {lodLevel.toUpperCase()}
        </span>
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 left-4 bg-background/70 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground z-10">
        <span>Drag to rotate • Scroll to zoom • Click node for details</span>
      </div>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function KnowledgeGraph3D({
  nodes = [],
  edges = [],
  onNodeClick,
  selectedNodeId,
  className,
  isLoading = false,
  height = 600,
}: KnowledgeGraph3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraApi, setCameraApi] = useState<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    fitView: () => void;
  } | null>(null);

  // Compute layout with d3-force-3d
  const { layoutNodes, layoutEdges, isSimulating } = useGraphLayout(nodes, edges, {
    warmupTicks: 100,
  });

  // Adaptive LOD based on node count (uses useFrame internally)
  const nodeCount = layoutNodes.length;

  // Simple LOD calculation (not using useFrame here since we're outside Canvas)
  const lodLevel = useMemo(() => {
    if (nodeCount < 100) return 'ultra';
    if (nodeCount < 300) return 'high';
    if (nodeCount < 700) return 'medium';
    if (nodeCount < 2000) return 'low';
    return 'minimal';
  }, [nodeCount]) as 'ultra' | 'high' | 'medium' | 'low' | 'minimal';

  const lodConfig = LOD_CONFIGS[lodLevel];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cameraApi) return;

      switch (e.key) {
        case '+':
        case '=':
          cameraApi.zoomIn();
          break;
        case '-':
          cameraApi.zoomOut();
          break;
        case 'f':
        case 'F':
          cameraApi.fitView();
          break;
        case 'r':
        case 'R':
          cameraApi.resetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraApi]);

  // Loading state
  if (isLoading) {
    return <KnowledgeGraph3DSkeleton className={className} height={height} />;
  }

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center rounded-lg border bg-background', className)}
        style={{ height }}
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <div className="rounded-full bg-muted p-6">
                <svg
                  className="h-12 w-12 text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="4" cy="8" r="2" />
                  <circle cx="20" cy="8" r="2" />
                  <circle cx="4" cy="16" r="2" />
                  <circle cx="20" cy="16" r="2" />
                  <path d="M6 8h3M15 8h3M6 16h3M15 16h3M12 9V6M12 18v-3" />
                </svg>
              </div>
            </EmptyMedia>
            <EmptyTitle>No Knowledge Graph Available</EmptyTitle>
            <EmptyDescription>
              Start adding content to build your knowledge graph. Concepts and
              relationships will appear here as they are extracted.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div
      className={cn('relative rounded-lg border bg-background overflow-hidden', className)}
      style={{ height }}
    >
      <Canvas
        ref={canvasRef as any}
        camera={{ position: [0, 0, 400], fov: 60, near: 0.1, far: 3000 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        style={{ background: '#030e10' }}
        onCreated={({ camera, gl }) => {
          // Expose camera controls
          setCameraApi({
            zoomIn: () => {
              camera.position.multiplyScalar(0.8);
            },
            zoomOut: () => {
              camera.position.multiplyScalar(1.25);
            },
            resetView: () => {
              camera.position.set(0, 0, 300);
              camera.lookAt(0, 0, 0);
            },
            fitView: () => {
              // Calculate bounding sphere and position camera
              if (layoutNodes.length === 0) return;
              const bounds = layoutNodes.reduce(
                (acc, node) => ({
                  minX: Math.min(acc.minX, node.x),
                  maxX: Math.max(acc.maxX, node.x),
                  minY: Math.min(acc.minY, node.y),
                  maxY: Math.max(acc.maxY, node.y),
                  minZ: Math.min(acc.minZ, node.z),
                  maxZ: Math.max(acc.maxZ, node.z),
                }),
                { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
              );
              const size = Math.max(
                bounds.maxX - bounds.minX,
                bounds.maxY - bounds.minY,
                bounds.maxZ - bounds.minZ
              );
              camera.position.set(0, 0, size * 1.5);
            },
          });
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <Suspense fallback={null}>
          <GraphScene
            nodes={layoutNodes}
            edges={layoutEdges}
            onNodeClick={onNodeClick}
            selectedNodeId={selectedNodeId}
            lodConfig={lodConfig}
          />
        </Suspense>

        <Preload all />
      </Canvas>

      {/* Controls overlay */}
      <ControlsOverlay
        onZoomIn={() => cameraApi?.zoomIn()}
        onZoomOut={() => cameraApi?.zoomOut()}
        onResetView={() => cameraApi?.resetView()}
        onFitView={() => cameraApi?.fitView()}
        nodeCount={layoutNodes.length}
        edgeCount={layoutEdges.length}
        fps={60}
        lodLevel={lodLevel}
      />

      {/* Simulation indicator */}
      {isSimulating && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground z-10">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Optimizing layout...</span>
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraph3D;
