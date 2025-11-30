'use client';

import { useState, useEffect, useRef } from 'react';
import * as motion from 'motion/react-client';
import { Network, Sparkles, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * KnowledgeGraphViz - Interactive knowledge graph visualization
 *
 * Bespoke component for the /features/collaboration page.
 * Shows an animated, organic network of connected concepts
 * with aurora-infused visual effects.
 *
 * Aesthetic: Organic neural network - living, breathing, connected
 */

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  size: 'small' | 'medium' | 'large';
  category: 'topic' | 'person' | 'tool';
}

interface Edge {
  from: string;
  to: string;
  strength: number;
}

const DEMO_NODES: Node[] = [
  { id: 'deploy', label: 'Deployment', x: 50, y: 35, size: 'large', category: 'topic' },
  { id: 'cicd', label: 'CI/CD', x: 35, y: 50, size: 'medium', category: 'topic' },
  { id: 'github', label: 'GitHub', x: 25, y: 35, size: 'small', category: 'tool' },
  { id: 'docker', label: 'Docker', x: 65, y: 55, size: 'medium', category: 'tool' },
  { id: 'sarah', label: 'Sarah K.', x: 20, y: 65, size: 'small', category: 'person' },
  { id: 'testing', label: 'Testing', x: 75, y: 40, size: 'medium', category: 'topic' },
  { id: 'api', label: 'API Design', x: 55, y: 70, size: 'large', category: 'topic' },
  { id: 'rest', label: 'REST', x: 70, y: 75, size: 'small', category: 'topic' },
  { id: 'alex', label: 'Alex M.', x: 40, y: 80, size: 'small', category: 'person' },
  { id: 'security', label: 'Security', x: 85, y: 60, size: 'medium', category: 'topic' },
];

const DEMO_EDGES: Edge[] = [
  { from: 'deploy', to: 'cicd', strength: 0.9 },
  { from: 'deploy', to: 'docker', strength: 0.8 },
  { from: 'cicd', to: 'github', strength: 0.7 },
  { from: 'cicd', to: 'sarah', strength: 0.5 },
  { from: 'docker', to: 'testing', strength: 0.6 },
  { from: 'deploy', to: 'testing', strength: 0.5 },
  { from: 'api', to: 'rest', strength: 0.9 },
  { from: 'api', to: 'alex', strength: 0.6 },
  { from: 'api', to: 'security', strength: 0.7 },
  { from: 'testing', to: 'security', strength: 0.5 },
  { from: 'docker', to: 'api', strength: 0.4 },
];

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

const getCategoryColor = (category: Node['category']) => {
  switch (category) {
    case 'topic':
      return { bg: 'bg-accent/20', border: 'border-accent/40', text: 'text-accent', glow: 'rgba(0,223,130,0.3)' };
    case 'person':
      return { bg: 'bg-secondary/20', border: 'border-secondary/40', text: 'text-secondary', glow: 'rgba(44,194,149,0.3)' };
    case 'tool':
      return { bg: 'bg-primary/20', border: 'border-primary/40', text: 'text-primary', glow: 'rgba(3,98,76,0.3)' };
    default:
      return { bg: 'bg-accent/20', border: 'border-accent/40', text: 'text-accent', glow: 'rgba(0,223,130,0.3)' };
  }
};

const getNodeSize = (size: Node['size']) => {
  switch (size) {
    case 'large':
      return 'w-24 h-10';
    case 'medium':
      return 'w-20 h-8';
    case 'small':
      return 'w-16 h-7';
    default:
      return 'w-20 h-8';
  }
};

export function KnowledgeGraphViz() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate actual positions based on container dimensions
  const getPosition = (node: Node) => ({
    x: (node.x / 100) * dimensions.width,
    y: (node.y / 100) * dimensions.height,
  });

  // Check if edge is connected to hovered node
  const isEdgeHighlighted = (edge: Edge) => {
    if (!hoveredNode) return false;
    return edge.from === hoveredNode || edge.to === hoveredNode;
  };

  // Check if node is connected to hovered node
  const isNodeHighlighted = (nodeId: string) => {
    if (!hoveredNode) return true;
    if (nodeId === hoveredNode) return true;
    return DEMO_EDGES.some(
      (edge) =>
        (edge.from === hoveredNode && edge.to === nodeId) ||
        (edge.to === hoveredNode && edge.from === nodeId)
    );
  };

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[30%] left-[50%] -translate-x-1/2
            w-[900px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springTransition}
            className="text-center mb-12"
          >
            <div
              className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full
                bg-accent/10 border border-accent/30"
            >
              <Network className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Knowledge Graph</span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Concepts{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                connected
              </span>
            </h3>
            <p className="text-muted-foreground">
              Watch knowledge compound as relationships form automatically
            </p>
          </motion.div>

          {/* Graph Visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.2 }}
            className={cn(
              'relative rounded-3xl overflow-hidden',
              'bg-gradient-to-b from-card/50 to-background/80',
              'backdrop-blur-xl',
              'border border-accent/20',
              'shadow-[0_0_80px_rgba(0,223,130,0.1)]'
            )}
          >
            {/* SVG Container for edges */}
            <div
              ref={containerRef}
              className="relative w-full aspect-[16/10] min-h-[400px]"
            >
              {/* Edges */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 1 }}
              >
                <defs>
                  <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(0,223,130,0.3)" />
                    <stop offset="50%" stopColor="rgba(44,194,149,0.5)" />
                    <stop offset="100%" stopColor="rgba(0,223,130,0.3)" />
                  </linearGradient>
                  <linearGradient id="edgeGradientHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(0,223,130,0.6)" />
                    <stop offset="50%" stopColor="rgba(44,194,149,0.8)" />
                    <stop offset="100%" stopColor="rgba(0,223,130,0.6)" />
                  </linearGradient>
                </defs>

                {DEMO_EDGES.map((edge, index) => {
                  const fromNode = DEMO_NODES.find((n) => n.id === edge.from);
                  const toNode = DEMO_NODES.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const from = getPosition(fromNode);
                  const to = getPosition(toNode);
                  const highlighted = isEdgeHighlighted(edge);

                  return (
                    <motion.line
                      key={`${edge.from}-${edge.to}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={highlighted ? 'url(#edgeGradientHighlight)' : 'url(#edgeGradient)'}
                      strokeWidth={highlighted ? 2 : 1}
                      strokeOpacity={highlighted ? 1 : hoveredNode ? 0.2 : edge.strength * 0.6}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: index * 0.1 + 0.5,
                        duration: 0.8,
                        ease: 'easeOut',
                      }}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              {DEMO_NODES.map((node, index) => {
                const pos = getPosition(node);
                const colors = getCategoryColor(node.category);
                const sizeClass = getNodeSize(node.size);
                const highlighted = isNodeHighlighted(node.id);
                const isHovered = hoveredNode === node.id;

                return (
                  <motion.div
                    key={node.id}
                    className="absolute"
                    style={{
                      left: pos.x,
                      top: pos.y,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isHovered ? 10 : 2,
                    }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: highlighted ? 1 : 0.3,
                      scale: isHovered ? 1.1 : 1,
                    }}
                    transition={{
                      delay: index * 0.08 + 0.3,
                      ...springTransition,
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Glow effect */}
                    {isHovered && (
                      <motion.div
                        layoutId="node-glow"
                        className="absolute inset-0 -m-2 rounded-full blur-xl"
                        style={{ backgroundColor: colors.glow }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                      />
                    )}

                    {/* Node pill */}
                    <div
                      className={cn(
                        'relative flex items-center justify-center rounded-full',
                        'backdrop-blur-sm cursor-pointer',
                        'border transition-all duration-300',
                        sizeClass,
                        colors.bg,
                        colors.border,
                        isHovered && 'shadow-lg'
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-medium truncate px-2',
                          colors.text
                        )}
                      >
                        {node.label}
                      </span>

                      {/* Pulse animation for large nodes */}
                      {node.size === 'large' && (
                        <div
                          className={cn(
                            'absolute inset-0 rounded-full animate-ping',
                            colors.bg
                          )}
                          style={{ animationDuration: '3s' }}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* Floating particles */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-accent/40"
                  style={{
                    left: `${15 + Math.random() * 70}%`,
                    top: `${15 + Math.random() * 70}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.2, 0.6, 0.2],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3 + Math.random() * 2,
                    delay: Math.random() * 2,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Stats bar */}
            <div
              className={cn(
                'flex items-center justify-center gap-8 sm:gap-12 px-6 py-4',
                'border-t border-border/30',
                'bg-gradient-to-r from-accent/5 via-transparent to-secondary/5'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent/40" />
                <span className="text-sm text-muted-foreground">Topics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary/40" />
                <span className="text-sm text-muted-foreground">People</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary/40" />
                <span className="text-sm text-muted-foreground">Tools</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-accent/10">
                <Zap className="h-3 w-3 text-accent" />
                <span className="text-xs font-medium text-accent">
                  {DEMO_EDGES.length} connections
                </span>
              </div>
            </div>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            Hover over nodes to explore connections · Real graphs grow with your content
          </motion.p>
        </div>
      </div>
    </section>
  );
}
