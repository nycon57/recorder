/**
 * KnowledgeGraph Component Examples
 *
 * This file demonstrates various usage patterns for the KnowledgeGraph component.
 * Copy these examples to your pages/components as needed.
 */

'use client';

import { useState, useEffect } from 'react';
import { KnowledgeGraph, ConceptPanel } from '@/app/components/knowledge';
import type { GraphNode, GraphEdge } from '@/lib/validations/knowledge';

// ============================================================================
// Example 1: Basic Static Graph
// ============================================================================

export function BasicGraphExample() {
  const nodes: GraphNode[] = [
    { id: '1', name: 'React', type: 'tool', mentionCount: 15 },
    { id: '2', name: 'TypeScript', type: 'tool', mentionCount: 12 },
    { id: '3', name: 'Next.js', type: 'tool', mentionCount: 10 },
    { id: '4', name: 'Deployment', type: 'process', mentionCount: 8 },
    { id: '5', name: 'John Doe', type: 'person', mentionCount: 5 },
  ];

  const edges: GraphEdge[] = [
    { id: 'e1', source: '1', target: '2', type: 'related', strength: 0.9 },
    { id: 'e2', source: '1', target: '3', type: 'related', strength: 0.8 },
    { id: 'e3', source: '3', target: '4', type: 'prerequisite', strength: 0.7 },
    { id: 'e4', source: '5', target: '4', type: 'related', strength: 0.6 },
  ];

  return (
    <div className="w-full h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Basic Knowledge Graph</h1>
      <KnowledgeGraph nodes={nodes} edges={edges} height="calc(100vh - 120px)" />
    </div>
  );
}

// ============================================================================
// Example 2: Interactive Graph with Selection
// ============================================================================

export function InteractiveGraphExample() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes: GraphNode[] = [
    { id: '1', name: 'React Hooks', type: 'technical_term', mentionCount: 20 },
    { id: '2', name: 'useState', type: 'tool', mentionCount: 18 },
    { id: '3', name: 'useEffect', type: 'tool', mentionCount: 16 },
    { id: '4', name: 'Component Lifecycle', type: 'process', mentionCount: 12 },
    { id: '5', name: 'State Management', type: 'process', mentionCount: 14 },
  ];

  const edges: GraphEdge[] = [
    { id: 'e1', source: '1', target: '2', type: 'related', strength: 1.0 },
    { id: 'e2', source: '1', target: '3', type: 'related', strength: 1.0 },
    { id: 'e3', source: '2', target: '5', type: 'related', strength: 0.8 },
    { id: 'e4', source: '3', target: '4', type: 'prerequisite', strength: 0.7 },
  ];

  return (
    <div className="flex gap-4 h-screen p-8">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">Interactive Graph</h1>
        <KnowledgeGraph
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedId}
          onNodeClick={setSelectedId}
          height="calc(100vh - 120px)"
        />
      </div>

      {selectedId && (
        <div className="w-96">
          <ConceptPanel conceptId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 3: Graph with Loading State
// ============================================================================

export function LoadingGraphExample() {
  const [isLoading, setIsLoading] = useState(true);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>({
    nodes: [],
    edges: [],
  });

  // Simulate loading
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setGraphData({
        nodes: [
          { id: '1', name: 'API Design', type: 'process', mentionCount: 10 },
          { id: '2', name: 'REST', type: 'technical_term', mentionCount: 8 },
          { id: '3', name: 'GraphQL', type: 'technical_term', mentionCount: 6 },
        ],
        edges: [
          { id: 'e1', source: '1', target: '2', type: 'related', strength: 0.8 },
          { id: 'e2', source: '1', target: '3', type: 'related', strength: 0.7 },
        ],
      });
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="w-full h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Loading Graph Example</h1>
      <KnowledgeGraph
        nodes={graphData.nodes}
        edges={graphData.edges}
        isLoading={isLoading}
        height="calc(100vh - 120px)"
      />
    </div>
  );
}

// ============================================================================
// Example 4: Empty State
// ============================================================================

export function EmptyGraphExample() {
  return (
    <div className="w-full h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Empty Graph Example</h1>
      <KnowledgeGraph nodes={[]} edges={[]} height="calc(100vh - 120px)" />
    </div>
  );
}

// ============================================================================
// Example 5: Large Graph with Positioned Nodes
// ============================================================================

export function PositionedGraphExample() {
  // Generate nodes in a grid layout
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const gridSize = 5;
  const spacing = 200;

  // Create grid of nodes
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const id = `${i}-${j}`;
      nodes.push({
        id,
        name: `Concept ${i},${j}`,
        type: ['tool', 'process', 'person', 'organization', 'technical_term'][
          (i + j) % 5
        ] as GraphNode['type'],
        mentionCount: Math.floor(Math.random() * 20) + 1,
        x: j * spacing,
        y: i * spacing,
      });

      // Connect to neighbors
      if (j > 0) {
        edges.push({
          id: `e-${id}-left`,
          source: `${i}-${j - 1}`,
          target: id,
          type: 'related',
          strength: Math.random() * 0.5 + 0.5,
        });
      }
      if (i > 0) {
        edges.push({
          id: `e-${id}-up`,
          source: `${i - 1}-${j}`,
          target: id,
          type: 'related',
          strength: Math.random() * 0.5 + 0.5,
        });
      }
    }
  }

  return (
    <div className="w-full h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">
        Positioned Graph ({nodes.length} nodes)
      </h1>
      <KnowledgeGraph nodes={nodes} edges={edges} height="calc(100vh - 120px)" />
    </div>
  );
}

// ============================================================================
// Example 6: Fetching from API
// ============================================================================

export function APIGraphExample() {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
  }>({
    nodes: [],
    edges: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadGraph() {
      try {
        const response = await fetch('/api/knowledge/graph');

        if (!response.ok) {
          throw new Error('Failed to load graph');
        }

        const data = await response.json();
        if (isMounted) {
          setGraphData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadGraph();

    return () => {
      isMounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">API Graph Example</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">Error loading graph</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">API Graph Example</h1>
      <KnowledgeGraph
        nodes={graphData.nodes}
        edges={graphData.edges}
        isLoading={isLoading}
        height="calc(100vh - 120px)"
      />
    </div>
  );
}

// ============================================================================
// Example 7: Compact Graph (Card/Widget)
// ============================================================================

export function CompactGraphExample() {
  const nodes: GraphNode[] = [
    { id: '1', name: 'React', type: 'tool', mentionCount: 10 },
    { id: '2', name: 'TypeScript', type: 'tool', mentionCount: 8 },
    { id: '3', name: 'Testing', type: 'process', mentionCount: 6 },
  ];

  const edges: GraphEdge[] = [
    { id: 'e1', source: '1', target: '2', type: 'related', strength: 0.9 },
    { id: 'e2', source: '2', target: '3', type: 'related', strength: 0.7 },
  ];

  return (
    <div className="w-full max-w-md p-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-2">Knowledge Overview</h2>
        <KnowledgeGraph nodes={nodes} edges={edges} height="300px" />
      </div>
    </div>
  );
}
