/**
 * KnowledgeGraphContainer - 2D/3D Graph Toggle Wrapper
 *
 * Provides a seamless toggle between the 2D ReactFlow-based graph
 * and the new 3D React Three Fiber visualization.
 *
 * Features:
 * - Remembers user preference in localStorage
 * - Dynamic loading of 3D component (avoids SSR issues)
 * - Graceful fallback to 2D if WebGL unavailable
 * - Consistent props interface for both modes
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, Layers, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

import { KnowledgeGraph, KnowledgeGraphSkeleton } from './KnowledgeGraph';
import { KnowledgeGraph3DSkeleton } from './KnowledgeGraph3D';
import type { GraphNode, GraphEdge } from '@/lib/validations/knowledge';

// Dynamic import for 3D component (avoids SSR issues with Three.js)
const KnowledgeGraph3D = dynamic(
  () => import('./KnowledgeGraph3D').then((mod) => mod.KnowledgeGraph3D),
  {
    ssr: false,
    loading: () => <KnowledgeGraph3DSkeleton />,
  }
);

// Storage key for persisting user preference
const STORAGE_KEY = 'knowledge-graph-view-mode';

type GraphViewMode = '2d' | '3d';

export interface KnowledgeGraphContainerProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onNodeClick?: (conceptId: string) => void;
  selectedNodeId?: string | null;
  className?: string;
  isLoading?: boolean;
  height?: number | string;
  /** Whether to show the 2D/3D toggle. Defaults to true. */
  showToggle?: boolean;
  /** Default view mode if no preference is stored */
  defaultMode?: GraphViewMode;
}

/**
 * Check if WebGL is available and capable
 */
function checkWebGLSupport(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') {
    return { supported: true }; // Assume supported on server
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return { supported: false, reason: 'WebGL is not supported in your browser' };
    }

    // Check for software renderer (usually poor performance)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      if (renderer.includes('SwiftShader') || renderer.includes('Software')) {
        return {
          supported: false,
          reason: 'Hardware acceleration is not available. 3D view requires a GPU.'
        };
      }
    }

    return { supported: true };
  } catch {
    return { supported: false, reason: 'Failed to initialize WebGL' };
  }
}

/**
 * Toggle button for switching between 2D and 3D views
 */
function ViewToggle({
  mode,
  onModeChange,
  webglSupported,
  webglReason,
}: {
  mode: GraphViewMode;
  onModeChange: (mode: GraphViewMode) => void;
  webglSupported: boolean;
  webglReason?: string;
}) {
  return (
    <div
      className="flex items-center border rounded-lg p-0.5 bg-muted/30"
      role="group"
      aria-label="Graph view mode selection"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === '2d' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onModeChange('2d')}
            className="gap-1.5 h-8 px-3"
            aria-label="2D view"
            aria-pressed={mode === '2d'}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="text-xs">2D</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Classic 2D graph view</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={mode === '3d' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => webglSupported && onModeChange('3d')}
            className={cn(
              'gap-1.5 h-8 px-3',
              !webglSupported && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="3D view"
            aria-pressed={mode === '3d'}
            disabled={!webglSupported}
          >
            <Box className="h-3.5 w-3.5" />
            <span className="text-xs">3D</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          {webglSupported ? (
            <p>Immersive 3D graph view</p>
          ) : (
            <p className="text-destructive">{webglReason}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function KnowledgeGraphContainer({
  nodes = [],
  edges = [],
  onNodeClick,
  selectedNodeId,
  className,
  isLoading = false,
  height = 600,
  showToggle = true,
  defaultMode = '2d',
}: KnowledgeGraphContainerProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<GraphViewMode>(defaultMode);
  const [hasHydrated, setHasHydrated] = useState(false);

  // WebGL support check
  const [webglStatus, setWebglStatus] = useState<{
    checked: boolean;
    supported: boolean;
    reason?: string;
  }>({ checked: false, supported: true });

  // Load persisted preference and check WebGL on mount
  useEffect(() => {
    // Check WebGL support
    const status = checkWebGLSupport();
    setWebglStatus({ checked: true, ...status });

    // Load persisted preference
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as GraphViewMode | null;
      if (stored === '2d' || stored === '3d') {
        // Only use 3D if WebGL is supported
        setViewMode(stored === '3d' && status.supported ? '3d' : stored === '3d' ? '2d' : stored);
      }
    } catch {
      // localStorage not available
    }

    setHasHydrated(true);
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((newMode: GraphViewMode) => {
    setViewMode(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // localStorage not available
    }
  }, []);

  // Normalize height to number for 3D component
  const heightNum = useMemo(() => {
    if (typeof height === 'number') return height;
    if (typeof height === 'string') {
      const parsed = parseInt(height, 10);
      return isNaN(parsed) ? 600 : parsed;
    }
    return 600;
  }, [height]);

  // Show loading state during hydration
  if (!hasHydrated) {
    return viewMode === '3d' ? (
      <KnowledgeGraph3DSkeleton height={heightNum} className={className} />
    ) : (
      <KnowledgeGraphSkeleton />
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Toggle positioned in top-right corner */}
      {showToggle && (
        <div className="absolute top-3 right-3 z-20">
          <ViewToggle
            mode={viewMode}
            onModeChange={handleModeChange}
            webglSupported={webglStatus.supported}
            webglReason={webglStatus.reason}
          />
        </div>
      )}

      {/* WebGL warning for 3D mode */}
      {viewMode === '3d' && !webglStatus.supported && webglStatus.checked && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {webglStatus.reason} Falling back to 2D view.
          </AlertDescription>
        </Alert>
      )}

      {/* Render appropriate graph */}
      {viewMode === '3d' && webglStatus.supported ? (
        <KnowledgeGraph3D
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          selectedNodeId={selectedNodeId}
          isLoading={isLoading}
          height={heightNum}
        />
      ) : (
        <KnowledgeGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          selectedNodeId={selectedNodeId}
          isLoading={isLoading}
          height={height}
        />
      )}
    </div>
  );
}

export default KnowledgeGraphContainer;
