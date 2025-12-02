'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Brain, List, Network, Hash, Filter, AlertCircle, Loader2, Info, Sparkles, Upload, FileText, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  KnowledgeGraphContainer,
  KnowledgeGraphSkeleton,
  ConceptListView,
  ConceptListViewSkeleton,
  ConceptPanel,
  ConceptFilter,
} from '@/app/components/knowledge';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';

import {
  KnowledgeGraphData,
  Concept,
  ConceptType,
  CONCEPT_TYPES,
} from '@/lib/validations/knowledge';
import { fadeIn } from '@/lib/utils/animations';

type ViewMode = 'graph' | 'list';
type SortOption = 'mention_count_desc' | 'last_seen_desc' | 'name_asc' | 'name_desc';

/**
 * KnowledgePage - Main Knowledge Graph page
 *
 * Features:
 * - Toggle between graph and list views
 * - Filter by concept types
 * - View concept details in slide-over panel
 * - Show statistics (total concepts, by type)
 * - Responsive layout for mobile/desktop
 * - Loading and error states
 * - Empty state when no concepts
 */
function KnowledgePageContent() {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);

  // Filter state
  const [selectedTypes, setSelectedTypes] = useState<ConceptType[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('mention_count_desc');

  // Data state
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphData['nodes']>([]);
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphData['edges']>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable fetch function that takes params explicitly to avoid stale closures
  const fetchGraphData = useCallback(
    async (
      types: ConceptType[],
      sort: SortOption,
      signal: AbortSignal
    ) => {
      try {
        setLoading(true);
        setError(null);

        // Build query params for graph
        const graphParams = new URLSearchParams();
        if (types.length > 0) {
          graphParams.set('types', types.join(','));
        }

        const graphResponse = await fetch(`/api/knowledge/graph?${graphParams.toString()}`, { signal });

        if (!graphResponse.ok) {
          const errorData = await graphResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to fetch knowledge graph');
        }

        const graphResult = await graphResponse.json();
        const data = graphResult.data || { nodes: [], edges: [] };

        // Check if aborted before updating state
        if (signal.aborted) return;

        setGraphNodes(data.nodes);
        setGraphEdges(data.edges);

        // Also fetch concepts for list view
        const conceptParams = new URLSearchParams();
        // Fetch all concepts - client-side filtering handles multiple type selection
        // The API only supports single type filter, so we fetch all and filter in filteredConcepts
        conceptParams.set('sort', sort);
        conceptParams.set('limit', '100');

        const conceptResponse = await fetch(`/api/knowledge/concepts?${conceptParams.toString()}`, { signal });

        if (!conceptResponse.ok) {
          throw new Error('Failed to fetch concepts');
        }

        const conceptResult = await conceptResponse.json();

        // Check if aborted before updating state
        if (signal.aborted) return;

        setConcepts(conceptResult.data?.concepts || []);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching graph data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load knowledge graph');
      } finally {
        // Only clear loading if not aborted
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [] // No dependencies - all values passed as params
  );

  // Fetch data when selectedTypes or sortBy change (including initial mount)
  useEffect(() => {
    const controller = new AbortController();

    fetchGraphData(selectedTypes, sortBy, controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchGraphData, selectedTypes, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = viewMode === 'graph' ? graphNodes.length : concepts.length;
    const byType: Partial<Record<ConceptType, number>> = {};

    if (viewMode === 'graph') {
      graphNodes.forEach((node) => {
        byType[node.type] = (byType[node.type] || 0) + 1;
      });
    } else {
      concepts.forEach((concept) => {
        byType[concept.conceptType] = (byType[concept.conceptType] || 0) + 1;
      });
    }

    return { total, byType };
  }, [graphNodes, concepts, viewMode]);

  // Filter concepts for list view
  const filteredConcepts = useMemo(() => {
    let filtered = [...concepts];

    if (selectedTypes.length > 0) {
      filtered = filtered.filter((c) => selectedTypes.includes(c.conceptType));
    }

    return filtered;
  }, [concepts, selectedTypes]);

  // Handle concept click
  const handleConceptClick = useCallback((conceptId: string) => {
    setSelectedConceptId(conceptId);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedConceptId(null);
  }, []);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSelectedTypes([]);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'g',
      handler: () => setViewMode('graph'),
      description: 'Switch to graph view',
    },
    {
      key: 'l',
      handler: () => setViewMode('list'),
      description: 'Switch to list view',
    },
    {
      key: 'Escape',
      handler: () => {
        if (selectedConceptId) {
          handleClosePanel();
        }
      },
      description: 'Close concept panel',
      preventDefault: false,
    },
  ]);

  // Check if we have any data
  const hasData = viewMode === 'graph'
    ? graphNodes.length > 0
    : concepts.length > 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        {/* Title and View Toggle Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Title and description */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-heading-3 font-outfit tracking-tight flex items-center gap-3">
                <Brain className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Knowledge Graph
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[320px] p-4">
                    <div className="space-y-2">
                      <p className="font-medium">How concepts are created</p>
                      <p className="text-xs text-muted-foreground">
                        Concepts are automatically extracted from your content using AI.
                        When you upload recordings, videos, or documents, our system identifies
                        key topics, tools, people, and ideas mentioned in your content.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        As you add more content, concepts build connections showing how
                        different ideas relate across your knowledge base.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Explore concepts and relationships across your content
            </p>
          </div>

          {/* Right: View mode toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/20 w-full sm:w-auto" role="group" aria-label="View mode selection">
            <Button
              variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('graph')}
              className="flex-1 sm:flex-none gap-2 min-h-[44px]"
              aria-label="Graph view"
              aria-pressed={viewMode === 'graph'}
            >
              <Network className="h-4 w-4" aria-hidden="true" />
              <span>Graph</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-none gap-2 min-h-[44px]"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              <span>List</span>
            </Button>
          </div>
        </div>

        {/* Stats and Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 flex-wrap" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{stats.total} concepts</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px]">
                    <p className="text-xs">
                      Concepts are key topics, tools, people, and ideas automatically
                      extracted from your content. The more content you add, the richer
                      your knowledge graph becomes.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Stats by type */}
            {Object.entries(stats.byType).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs capitalize">
                    {type.replace('_', ' ')}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Concept Type Filter */}
            <ConceptFilter
              selectedTypes={selectedTypes}
              onSelectionChange={setSelectedTypes}
            />

            {/* Sort (List view only) */}
            {viewMode === 'list' && (
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mention_count_desc">Most Mentioned</SelectItem>
                  <SelectItem value="last_seen_desc">Recently Seen</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Clear filters */}
            {selectedTypes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="min-h-[44px]"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {viewMode === 'graph' ? (
              <KnowledgeGraphSkeleton />
            ) : (
              <ConceptListViewSkeleton viewMode="list" groupCount={3} itemsPerGroup={8} />
            )}
          </motion.div>
        ) : !hasData ? (
          <motion.div
            key="empty"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-primary/5 rounded-full p-6 mb-6">
                <Brain className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Your Knowledge Graph is Empty</h3>
              <p className="text-sm text-muted-foreground max-w-lg mb-8">
                The Knowledge Graph automatically discovers and connects concepts from your content.
                As you add recordings, videos, and documents, AI will extract key topics, tools, people, and ideas.
              </p>

              {/* How it works section */}
              <div className="bg-muted/30 rounded-lg p-6 max-w-2xl w-full mb-8">
                <h4 className="font-medium mb-4 flex items-center gap-2 justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                  How the Knowledge Graph Works
                </h4>
                <div className="grid sm:grid-cols-3 gap-4 text-left">
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">1. Add Content</p>
                    <p className="text-xs text-muted-foreground">
                      Upload recordings, videos, documents, or create notes
                    </p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">2. AI Extraction</p>
                    <p className="text-xs text-muted-foreground">
                      Concepts like tools, processes, people, and topics are automatically identified
                    </p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Network className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">3. Build Connections</p>
                    <p className="text-xs text-muted-foreground">
                      See how concepts relate across all your content
                    </p>
                  </div>
                </div>
              </div>

              {/* Concept types info */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <Badge variant="outline" className="text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                  Tools & Technologies
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                  Processes & Workflows
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5" />
                  People & Organizations
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5" />
                  Technical Terms
                </Badge>
              </div>

              <Button asChild>
                <a href="/library">Go to Library</a>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={viewMode}
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {viewMode === 'graph' ? (
              <KnowledgeGraphContainer
                nodes={graphNodes}
                edges={graphEdges}
                onNodeClick={handleConceptClick}
                selectedNodeId={selectedConceptId}
                height={600}
              />
            ) : (
              <ConceptListView
                concepts={filteredConcepts}
                onConceptClick={handleConceptClick}
                selectedConceptId={selectedConceptId}
                viewMode="list"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Concept Details Panel */}
      <ConceptPanel
        conceptId={selectedConceptId}
        onClose={handleClosePanel}
        onConceptClick={handleConceptClick}
      />
    </div>
  );
}

/**
 * Default export with keyboard shortcuts provider
 */
export default function KnowledgePage() {
  return (
    <KeyboardShortcutsProvider>
      <KnowledgePageContent />
    </KeyboardShortcutsProvider>
  );
}
