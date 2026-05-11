'use client';

import { Suspense, useReducer, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Brain,
  List,
  Network,
  Hash,
  AlertCircle,
  Info,
  Sparkles,
  Upload,
  Activity,
  Filter,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
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
  Concept,
  ConceptType,
  type KnowledgeGraphData,
} from '@/lib/validations/knowledge';
import { type KnowledgeGraphPayload } from '@/lib/types/knowledge-graph';
import {
  CANVAS_EDGE_KIND_FILTERS,
  CANVAS_NODE_KIND_FILTERS,
  buildCanvasClusterHulls,
  filterCanvasGraphData,
  type CanvasEdgeKindFilter,
  type CanvasNodeKindFilter,
  toCanvasGraphData,
} from '@/lib/services/knowledge-graph-canvas';
import { fadeIn } from '@/lib/utils/animations';
import {
  getKnowledgeStatusMeta,
  KNOWLEDGE_STATUS_DISPLAY_ORDER,
  type KnowledgeStatusCounts,
} from '@/lib/utils/knowledge-status';

type ViewMode = 'graph' | 'list';
type SortOption =
  | 'mention_count_desc'
  | 'last_seen_desc'
  | 'name_asc'
  | 'name_desc';

type KnowledgeMapState = {
  selectedConceptId: string | null;
  selectedGraphNodeId: string | null;
  focusedClusterNodeId: string | null;
  selectedTypes: ConceptType[];
  sortBy: SortOption;
  graphSearch: string;
  includeSuperseded: boolean;
  selectedNodeKinds: CanvasNodeKindFilter[];
  selectedEdgeKinds: CanvasEdgeKindFilter[];
  graphNodes: KnowledgeGraphData['nodes'];
  graphEdges: KnowledgeGraphData['edges'];
  graphMeta: KnowledgeGraphPayload['meta'] | null;
  concepts: Concept[];
  knowledgeStatusCounts: KnowledgeStatusCounts | null;
  loading: boolean;
  error: string | null;
};

type KnowledgeMapAction =
  | Partial<KnowledgeMapState>
  | ((state: KnowledgeMapState) => KnowledgeMapState);

const initialKnowledgeMapState: KnowledgeMapState = {
  selectedConceptId: null,
  selectedGraphNodeId: null,
  focusedClusterNodeId: null,
  selectedTypes: [],
  sortBy: 'mention_count_desc',
  graphSearch: '',
  includeSuperseded: false,
  selectedNodeKinds: [...CANVAS_NODE_KIND_FILTERS],
  selectedEdgeKinds: [...CANVAS_EDGE_KIND_FILTERS],
  graphNodes: [],
  graphEdges: [],
  graphMeta: null,
  concepts: [],
  knowledgeStatusCounts: null,
  loading: true,
  error: null,
};

function knowledgeMapReducer(
  state: KnowledgeMapState,
  action: KnowledgeMapAction,
): KnowledgeMapState {
  return typeof action === 'function' ? action(state) : { ...state, ...action };
}

const NODE_KIND_LABELS: Record<CanvasNodeKindFilter, string> = {
  org_page: 'Org pages',
  vendor_page: 'Vendor pages',
  cluster: 'Clusters',
};

const EDGE_KIND_STYLES: Record<
  CanvasEdgeKindFilter,
  { label: string; color: string; description: string }
> = {
  org_relationship: {
    label: 'Page relationships',
    color: '#6366f1',
    description: 'Org page to org page semantic links.',
  },
  org_in_cluster: {
    label: 'Cluster membership',
    color: '#0ea5e9',
    description: 'Org page membership edges into computed clusters.',
  },
  org_matches_vendor: {
    label: 'Vendor overlay matches',
    color: '#16a34a',
    description: 'Org pages aligned to vendor reference pages.',
  },
};

const RELATIONSHIP_TYPE_LABELS: Record<
  'requires' | 'precedes' | 'contradicts' | 'related',
  string
> = {
  requires: 'Requires',
  precedes: 'Precedes',
  contradicts: 'Contradicts',
  related: 'Related',
};

const CLUSTER_HULL_COLORS = [
  'bg-sky-500/15 border-sky-500/40',
  'bg-emerald-500/15 border-emerald-500/40',
  'bg-fuchsia-500/15 border-fuchsia-500/40',
  'bg-amber-500/15 border-amber-500/40',
  'bg-violet-500/15 border-violet-500/40',
] as const;

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
  return useKnowledgePageContentImplementation();
}

function useKnowledgePageContentImplementation() {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const requestedView = getSearchParam('view');
  const originPageId = getSearchParam('originPage');

  // View state
  const viewMode: ViewMode = requestedView === 'list' ? 'list' : 'graph';
  const viewHref = useCallback(
    (nextViewMode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextViewMode === 'list') {
        params.set('view', 'list');
      } else {
        params.delete('view');
      }
      const query = params.toString();
      return query ? `/knowledge/map?${query}` : '/knowledge/map';
    },
    [searchParams],
  );
  const [
    {
      selectedConceptId,
      selectedGraphNodeId,
      focusedClusterNodeId,
      selectedTypes,
      sortBy,
      graphSearch,
      includeSuperseded,
      selectedNodeKinds,
      selectedEdgeKinds,
      graphNodes,
      graphEdges,
      graphMeta,
      concepts,
      knowledgeStatusCounts,
      loading,
      error,
    },
    updateKnowledgeMapState,
  ] = useReducer(knowledgeMapReducer, initialKnowledgeMapState);

  // Stable fetch function that takes params explicitly to avoid stale closures
  const fetchGraphData = useCallback(
    async (
      sort: SortOption,
      includeSupersededRecords: boolean,
      signal: AbortSignal,
    ) => {
      try {
        updateKnowledgeMapState({ loading: true, error: null });

        // Build query params for operational page graph
        const graphParams = new URLSearchParams({
          orgPageLimit: '300',
          vendorPageLimit: '300',
          clusterLimit: '200',
          relationshipLimit: '2000',
          vendorMatchesPerOrgPage: '3',
        });
        if (includeSupersededRecords) {
          graphParams.set('includeSuperseded', 'true');
        }

        const conceptParams = new URLSearchParams();
        // Fetch all concepts - client-side filtering handles multiple type selection
        // The API only supports single type filter, so we fetch all and filter in filteredConcepts
        conceptParams.set('sort', sort);
        conceptParams.set('limit', '100');

        const [graphResponse, conceptResponse, healthResponse] =
          await Promise.all([
            fetch(`/api/knowledge/graph?${graphParams.toString()}`, { signal }),
            fetch(`/api/knowledge/concepts?${conceptParams.toString()}`, {
              signal,
            }),
            fetch('/api/dashboard/knowledge-health', { signal }),
          ]);

        if (!graphResponse.ok) {
          const errorData = await graphResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to fetch knowledge graph',
          );
        }

        if (!conceptResponse.ok) {
          throw new Error('Failed to fetch concepts');
        }

        if (!healthResponse.ok) {
          throw new Error('Failed to fetch knowledge status');
        }

        const [graphResult, conceptResult, healthResult] = await Promise.all([
          graphResponse.json(),
          conceptResponse.json(),
          healthResponse.json(),
        ]);
        const payload = (graphResult.data || {
          nodes: [],
          edges: [],
          meta: null,
        }) as KnowledgeGraphPayload;
        const canvasGraph = toCanvasGraphData(payload);

        // Check if aborted before updating state
        if (signal.aborted) return;

        updateKnowledgeMapState({
          graphNodes: canvasGraph.nodes,
          graphEdges: canvasGraph.edges,
          graphMeta: payload.meta ?? null,
        });

        // Check if aborted before updating state
        if (signal.aborted) return;

        updateKnowledgeMapState({
          concepts: conceptResult.data?.concepts || [],
          knowledgeStatusCounts:
            healthResult.data?.knowledgeStatus?.counts ?? null,
        });
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching graph data:', err);
        updateKnowledgeMapState({
          error:
            err instanceof Error
              ? err.message
              : 'Failed to load knowledge graph',
        });
      } finally {
        // Only clear loading if not aborted
        if (!signal.aborted) {
          updateKnowledgeMapState({ loading: false });
        }
      }
    },
    [], // No dependencies - all values passed as params
  );

  // Fetch data when sortBy changes (including initial mount)
  useEffect(() => {
    const controller = new AbortController();

    fetchGraphData(sortBy, includeSuperseded, controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchGraphData, includeSuperseded, sortBy]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      push(viewHref(mode));
      if (mode === 'graph') {
        updateKnowledgeMapState({ selectedConceptId: null });
        return;
      }
      updateKnowledgeMapState({ selectedGraphNodeId: null });
    },
    [push, viewHref],
  );

  const baseFilteredGraph = useMemo(
    () =>
      filterCanvasGraphData(
        {
          nodes: graphNodes,
          edges: graphEdges,
        },
        {
          nodeKinds: selectedNodeKinds,
          edgeKinds: selectedEdgeKinds,
          search: graphSearch,
        },
      ),
    [graphEdges, graphNodes, graphSearch, selectedEdgeKinds, selectedNodeKinds],
  );

  const clusterHulls = useMemo(
    () => buildCanvasClusterHulls(baseFilteredGraph),
    [baseFilteredGraph],
  );

  useEffect(() => {
    if (!focusedClusterNodeId) return;
    if (
      !clusterHulls.some((hull) => hull.clusterNodeId === focusedClusterNodeId)
    ) {
      updateKnowledgeMapState({ focusedClusterNodeId: null });
    }
  }, [clusterHulls, focusedClusterNodeId]);

  const filteredGraph = useMemo(() => {
    if (!focusedClusterNodeId) return baseFilteredGraph;

    const focusedHull = clusterHulls.find(
      (hull) => hull.clusterNodeId === focusedClusterNodeId,
    );
    if (!focusedHull) return baseFilteredGraph;

    const includedNodeIds = new Set<string>([
      focusedHull.clusterNodeId,
      ...focusedHull.memberNodeIds,
      ...focusedHull.vendorNodeIds,
    ]);

    const nodes = baseFilteredGraph.nodes.filter((node) =>
      includedNodeIds.has(node.id),
    );
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = baseFilteredGraph.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );

    return {
      nodes,
      edges,
    };
  }, [baseFilteredGraph, clusterHulls, focusedClusterNodeId]);

  // Calculate stats
  const stats = useMemo(() => {
    const total =
      viewMode === 'graph' ? filteredGraph.nodes.length : concepts.length;
    const byType: Record<string, number> = {};

    if (viewMode === 'graph') {
      filteredGraph.nodes.forEach((node) => {
        const label = node.typeLabel || node.type;
        byType[label] = (byType[label] || 0) + 1;
      });
    } else {
      concepts.forEach((concept) => {
        byType[concept.conceptType] = (byType[concept.conceptType] || 0) + 1;
      });
    }

    return { total, byType };
  }, [concepts, filteredGraph.nodes, viewMode]);

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
    updateKnowledgeMapState({ selectedConceptId: conceptId });
  }, []);

  const handleClosePanel = useCallback(() => {
    updateKnowledgeMapState({ selectedConceptId: null });
  }, []);

  // Clear list filters
  const handleClearFilters = useCallback(() => {
    updateKnowledgeMapState({ selectedTypes: [] });
  }, []);

  const handleGraphNodeClick = useCallback((nodeId: string) => {
    updateKnowledgeMapState({ selectedGraphNodeId: nodeId });
  }, []);

  const toggleNodeKind = useCallback((kind: CanvasNodeKindFilter) => {
    updateKnowledgeMapState((state) => {
      if (state.selectedNodeKinds.includes(kind)) {
        if (state.selectedNodeKinds.length === 1) {
          return state;
        }
        return {
          ...state,
          selectedNodeKinds: state.selectedNodeKinds.filter(
            (item) => item !== kind,
          ),
        };
      }
      return {
        ...state,
        selectedNodeKinds: [...state.selectedNodeKinds, kind],
      };
    });
  }, []);

  const toggleEdgeKind = useCallback((kind: CanvasEdgeKindFilter) => {
    updateKnowledgeMapState((state) => {
      if (state.selectedEdgeKinds.includes(kind)) {
        if (state.selectedEdgeKinds.length === 1) {
          return state;
        }
        return {
          ...state,
          selectedEdgeKinds: state.selectedEdgeKinds.filter(
            (item) => item !== kind,
          ),
        };
      }
      return {
        ...state,
        selectedEdgeKinds: [...state.selectedEdgeKinds, kind],
      };
    });
  }, []);

  const handleResetGraphFilters = useCallback(() => {
    updateKnowledgeMapState({
      graphSearch: '',
      selectedNodeKinds: [...CANVAS_NODE_KIND_FILTERS],
      selectedEdgeKinds: [...CANVAS_EDGE_KIND_FILTERS],
      focusedClusterNodeId: null,
    });
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'g',
      handler: () => handleViewModeChange('graph'),
      description: 'Switch to graph view',
    },
    {
      key: 'l',
      handler: () => handleViewModeChange('list'),
      description: 'Switch to list view',
    },
    {
      key: 'Escape',
      handler: () => {
        if (viewMode === 'graph' && selectedGraphNodeId) {
          updateKnowledgeMapState({ selectedGraphNodeId: null });
          return;
        }
        if (viewMode === 'list' && selectedConceptId) {
          handleClosePanel();
        }
      },
      description: 'Close inspector panel',
      preventDefault: false,
    },
  ]);

  const selectedGraphNode = useMemo(() => {
    if (!selectedGraphNodeId) return null;
    return (
      filteredGraph.nodes.find((node) => node.id === selectedGraphNodeId) ??
      null
    );
  }, [filteredGraph.nodes, selectedGraphNodeId]);

  const connectedGraphNodes = useMemo(() => {
    if (!selectedGraphNode) return [];

    const connectionMap = new Map<
      string,
      { edgeType: string; edgeKind: CanvasEdgeKindFilter; strength: number }
    >();

    filteredGraph.edges.forEach((edge) => {
      if (edge.source === selectedGraphNode.id) {
        connectionMap.set(edge.target, {
          edgeType: edge.relationshipType ?? edge.type,
          edgeKind: edge.edgeKind ?? 'org_relationship',
          strength: edge.strength,
        });
      }
      if (edge.target === selectedGraphNode.id) {
        connectionMap.set(edge.source, {
          edgeType: edge.relationshipType ?? edge.type,
          edgeKind: edge.edgeKind ?? 'org_relationship',
          strength: edge.strength,
        });
      }
    });

    return filteredGraph.nodes
      .flatMap((__item, __index, __array) =>
        connectionMap.has(__item.id)
            ? [
                {
                  node: __item,
                  edgeType:
                    connectionMap.get(__item.id)?.edgeType ?? 'related',
                  edgeKind:
                    connectionMap.get(__item.id)?.edgeKind ??
                    'org_relationship',
                  strength: connectionMap.get(__item.id)?.strength ?? 0,
                },
              ]
          : [],
      )
      .sort((left, right) => right.node.mentionCount - left.node.mentionCount);
  }, [filteredGraph.edges, filteredGraph.nodes, selectedGraphNode]);

  const selectedGraphNodeKnowledgeHref = selectedGraphNode?.rawId
    ? `/dashboard/knowledge/pages/${selectedGraphNode.rawId}`
    : null;

  const selectedGraphNodeHealthHref = selectedGraphNode?.rawId
    ? `/knowledge/health?wikiPageId=${selectedGraphNode.rawId}`
    : '/knowledge/health';

  const relationshipBreakdown = useMemo(() => {
    const counts: Partial<
      Record<'requires' | 'precedes' | 'contradicts' | 'related', number>
    > = {};

    filteredGraph.edges.forEach((edge) => {
      const edgeKind = edge.edgeKind ?? 'org_relationship';
      if (edgeKind !== 'org_relationship') return;

      const relationshipType = edge.relationshipType ?? 'related';
      counts[relationshipType] = (counts[relationshipType] ?? 0) + 1;
    });

    return counts;
  }, [filteredGraph.edges]);

  const edgeKindBreakdown = useMemo(() => {
    const counts: Record<CanvasEdgeKindFilter, number> = {
      org_relationship: 0,
      org_in_cluster: 0,
      org_matches_vendor: 0,
    };

    filteredGraph.edges.forEach((edge) => {
      const edgeKind = edge.edgeKind ?? 'org_relationship';
      counts[edgeKind] += 1;
    });

    return counts;
  }, [filteredGraph.edges]);

  const graphGeneratedLabel = graphMeta?.generatedAt
    ? new Date(graphMeta.generatedAt).toLocaleString()
    : null;

  const focusedHull = focusedClusterNodeId
    ? (clusterHulls.find(
        (hull) => hull.clusterNodeId === focusedClusterNodeId,
      ) ?? null)
    : null;

  // Check if we have any data
  const hasData =
    viewMode === 'graph' ? filteredGraph.nodes.length > 0 : concepts.length > 0;

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
                <Brain className="size-7 sm:size-8 text-primary" />
                Knowledge Graph
              </h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[320px] p-4">
                    <div className="space-y-2">
                      <p className="font-medium">
                        How operational graph nodes are created
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Org wiki pages are compiled from your
                        recordings/documents, vendor pages come from source
                        documentation, and clusters are derived from page
                        relationships.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This graph shows relationships, cluster memberships, and
                        vendor matches so you can inspect operational coverage
                        in one canvas.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground">
              Explore org pages, vendor pages, relationships, and clusters
            </p>
          </div>

          {/* Right: Health link + View mode toggle */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-[44px]"
            >
              <Link href="/knowledge/health">
                <Activity className="size-4 mr-2" aria-hidden="true" />
                Health
              </Link>
            </Button>
            <div
              className="flex items-center border rounded-lg p-1 bg-muted/20 w-full sm:w-auto"
              role="group"
              aria-label="View mode selection"
            >
              <Button
                asChild
                variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 sm:flex-none gap-2 min-h-[44px]"
                aria-label="Graph view"
                aria-pressed={viewMode === 'graph'}
              >
                <Link href={viewHref('graph')}>
                  <Network className="size-4" aria-hidden="true" />
                  <span>Graph</span>
                </Link>
              </Button>
              <Button
                asChild
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 sm:flex-none gap-2 min-h-[44px]"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <Link href={viewHref('list')}>
                  <List className="size-4" aria-hidden="true" />
                  <span>List</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats and Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Stats */}
          <div
            className="flex items-center gap-4 flex-wrap"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <Hash
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">
                {stats.total} {viewMode === 'graph' ? 'nodes' : 'concepts'}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px]">
                    <p className="text-xs">
                      {viewMode === 'graph'
                        ? 'Graph mode visualizes operational wiki nodes and typed edges for routing, relationship, and coverage analysis.'
                        : 'Concept mode lists AI-extracted topics from your content.'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Stats by type */}
            {Object.entries(stats.byType).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="text-xs capitalize"
                  >
                    {type.replace('_', ' ')}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Concept Type Filter (list view only) */}
            {viewMode === 'list' && (
              <ConceptFilter
                selectedTypes={selectedTypes}
                onSelectionChange={(types) =>
                  updateKnowledgeMapState({ selectedTypes: types })
                }
              />
            )}

            {/* Sort (List view only) */}
            {viewMode === 'list' && (
              <Select
                value={sortBy}
                onValueChange={(value) =>
                  updateKnowledgeMapState({ sortBy: value as SortOption })
                }
              >
                <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mention_count_desc">
                    Most Mentioned
                  </SelectItem>
                  <SelectItem value="last_seen_desc">Recently Seen</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Clear filters */}
            {viewMode === 'list' && selectedTypes.length > 0 && (
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

        {knowledgeStatusCounts && (
          <div className="rounded-xl border bg-card/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Operational status
              </span>
              {KNOWLEDGE_STATUS_DISPLAY_ORDER.map((status) => {
                const meta = getKnowledgeStatusMeta(status);
                return (
                  <Badge
                    key={status}
                    variant={meta.badgeVariant}
                    className={meta.badgeClassName}
                    title={meta.description}
                  >
                    {meta.shortLabel}: {knowledgeStatusCounts[status]}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'list' && originPageId && (
          <Alert className="border-primary/30 bg-primary/5">
            <Sparkles className="size-4 text-primary" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">
                Concept view is a secondary enrichment surface. Primary
                knowledge navigation remains page-centric.
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-[36px] w-fit"
              >
                <Link
                  href={`/knowledge/pages/${encodeURIComponent(originPageId)}`}
                >
                  Back to page detail
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <m.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {viewMode === 'graph' ? (
              <KnowledgeGraphSkeleton />
            ) : (
              <ConceptListViewSkeleton
                viewMode="list"
                groupCount={3}
                itemsPerGroup={8}
              />
            )}
          </m.div>
        ) : !hasData ? (
          <m.div
            key="empty"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-primary/5 rounded-full p-6 mb-6">
                <Brain className="size-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Your Knowledge Graph is Empty
              </h3>
              <p className="text-sm text-muted-foreground max-w-lg mb-8">
                The Knowledge Graph automatically discovers and connects
                concepts from your content. As you add recordings, videos, and
                documents, AI will extract key topics, tools, people, and ideas.
              </p>

              {/* How it works section */}
              <div className="bg-muted/30 rounded-lg p-6 max-w-2xl w-full mb-8">
                <h4 className="font-medium mb-4 flex items-center gap-2 justify-center">
                  <Sparkles className="size-4 text-primary" />
                  How the Knowledge Graph Works
                </h4>
                <div className="grid sm:grid-cols-3 gap-4 text-left">
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Upload className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">1. Add Content</p>
                    <p className="text-xs text-muted-foreground">
                      Upload recordings, videos, documents, or create notes
                    </p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Sparkles className="size-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">2. AI Extraction</p>
                    <p className="text-xs text-muted-foreground">
                      Concepts like tools, processes, people, and topics are
                      automatically identified
                    </p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="bg-background rounded-full p-2 mb-2">
                      <Network className="size-5 text-muted-foreground" />
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
                  <span className="size-2 rounded-full bg-blue-500 mr-1.5" />
                  Tools & Technologies
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="size-2 rounded-full bg-green-500 mr-1.5" />
                  Processes & Workflows
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="size-2 rounded-full bg-purple-500 mr-1.5" />
                  People & Organizations
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <span className="size-2 rounded-full bg-orange-500 mr-1.5" />
                  Technical Terms
                </Badge>
              </div>

              <Button asChild>
                <Link href="/library">Go to Library</Link>
              </Button>
            </div>
          </m.div>
        ) : (
          <m.div
            key={viewMode}
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-4"
          >
            {viewMode === 'graph' ? (
              <>
                <Card className="gap-3 py-4">
                  <CardHeader className="px-4 pb-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Filter className="size-4 text-muted-foreground" />
                      Graph filters
                    </CardTitle>
                    <CardDescription>
                      Narrow node/edge types, include superseded records, and
                      focus specific cluster hulls without leaving the map.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        value={graphSearch}
                        onChange={(event) =>
                          updateKnowledgeMapState({
                            graphSearch: event.target.value,
                          })
                        }
                        placeholder="Search nodes by title, app, or screen"
                        aria-label="Search graph nodes"
                      />
                      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                          Include superseded
                        </span>
                        <Switch
                          checked={includeSuperseded}
                          onCheckedChange={(checked) =>
                            updateKnowledgeMapState({
                              includeSuperseded: checked,
                            })
                          }
                          aria-label="Include superseded pages"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Node kinds
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CANVAS_NODE_KIND_FILTERS.map((kind) => (
                            <Button
                              key={kind}
                              type="button"
                              variant={
                                selectedNodeKinds.includes(kind)
                                  ? 'secondary'
                                  : 'outline'
                              }
                              size="sm"
                              onClick={() => toggleNodeKind(kind)}
                              className="h-8"
                            >
                              {NODE_KIND_LABELS[kind]}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Edge kinds
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CANVAS_EDGE_KIND_FILTERS.map((kind) => (
                            <Button
                              key={kind}
                              type="button"
                              variant={
                                selectedEdgeKinds.includes(kind)
                                  ? 'secondary'
                                  : 'outline'
                              }
                              size="sm"
                              onClick={() => toggleEdgeKind(kind)}
                              className="h-8"
                            >
                              {EDGE_KIND_STYLES[kind].label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        {focusedHull && (
                          <Badge variant="outline" className="text-[11px]">
                            Focused hull: {focusedHull.clusterLabel}
                          </Badge>
                        )}
                        {graphGeneratedLabel && (
                          <span>Snapshot: {graphGeneratedLabel}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={handleResetGraphFilters}
                        className="h-8"
                      >
                        Reset filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="gap-3 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-base">
                        Typed edge legend
                      </CardTitle>
                      <CardDescription>
                        Operational edge classes and relationship distribution
                        currently visible in the graph.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 space-y-3">
                      <div className="space-y-2">
                        {CANVAS_EDGE_KIND_FILTERS.map((kind) => (
                          <div
                            key={kind}
                            className="flex items-start justify-between gap-3 rounded-md border p-2"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex size-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      EDGE_KIND_STYLES[kind].color,
                                  }}
                                  aria-hidden="true"
                                />
                                <p className="text-sm font-medium">
                                  {EDGE_KIND_STYLES[kind].label}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {EDGE_KIND_STYLES[kind].description}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {edgeKindBreakdown[kind]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Relationship types
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(relationshipBreakdown).length > 0 ? (
                            (
                              Object.entries(relationshipBreakdown) as Array<
                                [
                                  (
                                    | 'requires'
                                    | 'precedes'
                                    | 'contradicts'
                                    | 'related'
                                  ),
                                  number,
                                ]
                              >
                            ).map(([relationshipType, count]) => (
                              <Badge key={relationshipType} variant="secondary">
                                {RELATIONSHIP_TYPE_LABELS[relationshipType]}:{' '}
                                {count}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No org-to-org relationships in the current filter
                              context.
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="gap-3 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-base">
                        Cluster hull visualization
                      </CardTitle>
                      <CardDescription>
                        Computed hulls summarize each cluster envelope, member
                        pages, and connected vendor overlays.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 space-y-2">
                      {clusterHulls.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No cluster hulls available in this filter context.
                        </p>
                      ) : (
                        clusterHulls.slice(0, 8).map((hull, index) => {
                          const accent =
                            CLUSTER_HULL_COLORS[
                              index % CLUSTER_HULL_COLORS.length
                            ];
                          const isFocused =
                            focusedClusterNodeId === hull.clusterNodeId;
                          return (
                            <button
                              key={hull.clusterNodeId}
                              type="button"
                              onClick={() =>
                                updateKnowledgeMapState((state) => ({
                                  ...state,
                                  focusedClusterNodeId:
                                    state.focusedClusterNodeId ===
                                    hull.clusterNodeId
                                      ? null
                                      : hull.clusterNodeId,
                                }))
                              }
                              className={`w-full rounded-md border px-3 py-2 text-left transition hover:shadow-sm ${accent} ${
                                isFocused ? 'ring-1 ring-primary' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">
                                  {hull.clusterLabel}
                                </p>
                                <Badge
                                  variant={isFocused ? 'default' : 'outline'}
                                >
                                  {isFocused ? 'Focused' : 'Focus'}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {hull.memberCount} org pages ·{' '}
                                {hull.vendorNodeIds.length} vendor links ·{' '}
                                {hull.relationshipEdgeCount} internal
                                relationships
                              </p>
                            </button>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="rounded-xl border bg-card/20 p-2 sm:p-3">
                    <KnowledgeGraphContainer
                      nodes={filteredGraph.nodes}
                      edges={filteredGraph.edges}
                      onNodeClick={handleGraphNodeClick}
                      selectedNodeId={selectedGraphNodeId}
                      height={640}
                    />
                  </div>

                  <Card className="gap-3 py-4">
                    <CardHeader className="px-4 pb-0">
                      <CardTitle className="text-base">
                        Graph inspector
                      </CardTitle>
                      <CardDescription>
                        Select a node to inspect routing metadata and jump
                        through related records.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 space-y-4">
                      {selectedGraphNode ? (
                        <>
                          <div className="space-y-2 rounded-md border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">
                                {selectedGraphNode.name}
                              </p>
                              <Badge variant="outline">
                                {selectedGraphNode.nodeKind
                                  ? NODE_KIND_LABELS[selectedGraphNode.nodeKind]
                                  : selectedGraphNode.typeLabel ||
                                    selectedGraphNode.type}
                              </Badge>
                              {selectedGraphNode.status && (
                                <Badge
                                  variant={
                                    selectedGraphNode.status === 'active'
                                      ? 'secondary'
                                      : 'outline'
                                  }
                                >
                                  {selectedGraphNode.status}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {selectedGraphNode.app && (
                                <span>App: {selectedGraphNode.app}</span>
                              )}
                              {selectedGraphNode.screen && (
                                <span>Screen: {selectedGraphNode.screen}</span>
                              )}
                              {typeof selectedGraphNode.confidence ===
                                'number' && (
                                <span>
                                  Confidence:{' '}
                                  {Math.round(
                                    selectedGraphNode.confidence * 100,
                                  )}
                                  %
                                </span>
                              )}
                              {selectedGraphNode.memberCount && (
                                <span>
                                  Members: {selectedGraphNode.memberCount}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedGraphNodeKnowledgeHref && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={selectedGraphNodeKnowledgeHref}>
                                  Open page
                                  <ArrowRight className="ml-2 size-3.5" />
                                </Link>
                              </Button>
                            )}
                            <Button asChild size="sm" variant="ghost">
                              <Link href={selectedGraphNodeHealthHref}>
                                Open health
                              </Link>
                            </Button>
                            {selectedGraphNode.sourceUrl && (
                              <Button asChild size="sm" variant="ghost">
                                <a
                                  href={selectedGraphNode.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Vendor source
                                  <ExternalLink className="ml-2 size-3.5" />
                                </a>
                              </Button>
                            )}
                            {selectedGraphNode.nodeKind === 'cluster' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateKnowledgeMapState((state) => ({
                                    ...state,
                                    focusedClusterNodeId:
                                      state.focusedClusterNodeId ===
                                      selectedGraphNode.id
                                        ? null
                                        : selectedGraphNode.id,
                                  }))
                                }
                              >
                                {focusedClusterNodeId === selectedGraphNode.id
                                  ? 'Unfocus hull'
                                  : 'Focus hull'}
                              </Button>
                            )}
                            {selectedGraphNode.nodeKind === 'org_page' &&
                              selectedGraphNode.clusterId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateKnowledgeMapState({
                                      focusedClusterNodeId: `cluster:${selectedGraphNode.clusterId}`,
                                    })
                                  }
                                >
                                  Focus cluster hull
                                </Button>
                              )}
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Connected nodes ({connectedGraphNodes.length})
                            </p>
                            {connectedGraphNodes.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No visible connections for this node under
                                current filters.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {connectedGraphNodes
                                  .slice(0, 12)
                                  .map((connection) => (
                                    <button
                                      key={connection.node.id}
                                      type="button"
                                      onClick={() =>
                                        updateKnowledgeMapState({
                                          selectedGraphNodeId:
                                            connection.node.id,
                                        })
                                      }
                                      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition hover:bg-muted/40"
                                    >
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium">
                                          {connection.node.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {
                                            EDGE_KIND_STYLES[
                                              connection.edgeKind
                                            ].label
                                          }{' '}
                                          · {connection.edgeType}
                                        </p>
                                      </div>
                                      <ArrowRight
                                        className="size-4 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          Select a node in the graph to inspect metadata, jump
                          to docs, focus cluster hulls, and step through related
                          nodes.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <ConceptListView
                concepts={filteredConcepts}
                onConceptClick={handleConceptClick}
                selectedConceptId={selectedConceptId}
                viewMode="list"
              />
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Concept Details Panel */}
      {viewMode === 'list' && (
        <ConceptPanel
          conceptId={selectedConceptId}
          onClose={handleClosePanel}
          onConceptClick={handleConceptClick}
        />
      )}
    </div>
  );
}

/**
 * Default export with keyboard shortcuts provider
 */
export default function KnowledgePage() {
  return (
    <KeyboardShortcutsProvider>
      <Suspense fallback={<KnowledgeGraphSkeleton />}>
        <KnowledgePageContent />
      </Suspense>
    </KeyboardShortcutsProvider>
  );
}
