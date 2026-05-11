'use client';

import {
  Suspense,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type RefObject,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Grid3x3,
  List,
  Search,
  SlidersHorizontal,
  FileX2,
  Settings,
  Upload,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { LibraryEmptyState } from '@/app/components/empty-states/LibraryEmptyState';
import { BulkActionsToolbar } from '@/app/components/library/BulkActionsToolbar';
import { BulkTagModal } from '@/app/components/library/BulkTagModal';
import { TagManager } from '@/app/components/tags/TagManager';
import { TagFilter } from '@/app/components/tags/TagFilter';
import {
  AdvancedFilters,
  FilterState,
} from '@/app/components/filters/AdvancedFilters';
import { FilterChips } from '@/app/components/filters/FilterChips';
import { CollectionManager } from '@/app/components/collections/CollectionManager';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useToast } from '@/app/components/ui/use-toast';
import UploadWizard from '@/app/components/recorder/UploadWizard';
import ExportModal from '@/app/components/library/ExportModal';
import GoogleDriveImportModal from '@/app/components/library/GoogleDriveImportModal';
import {
  useKeyboardShortcuts,
  COMMON_SHORTCUTS,
} from '@/app/hooks/useKeyboardShortcuts';
import {
  LibraryRootView,
  LibraryRootViewSkeleton,
  QuickAccessTab,
} from '@/app/components/library/LibraryRootView';
import {
  CollectionFolderView,
  CollectionFolderViewSkeleton,
} from '@/app/components/collections/CollectionFolderView';
import { CollectionFolder } from '@/app/components/collections/CollectionFolderCard';
import { MoveToCollectionModal } from '@/app/components/collections/MoveToCollectionModal';
import { SelectableContentCard, LibraryTable } from '@/app/components/library';
import { DocLink } from '@/app/components/docs/doc-link';
import { ContentItem } from '@/app/components/content';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/app/components/ui/pagination';

type SortOption =
  | 'recent'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'size-asc'
  | 'size-desc'
  | 'duration-asc'
  | 'duration-desc';
type ViewMode = 'grid' | 'list';
type TagFilterMode = 'and' | 'or';

const ITEMS_PER_PAGE = 25;
const QUICK_ACCESS_TABS: QuickAccessTab[] = [
  'recent',
  'favorites',
  'all',
  'uncategorized',
];

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface CollectionViewData {
  collection: CollectionFolder & {
    item_count: number;
    subcollection_count: number;
  };
  breadcrumb: BreadcrumbItem[];
  subcollections: CollectionFolder[];
  items: ContentItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface HomeViewData {
  collections: CollectionFolder[];
  recentItems: {
    id: string;
    title: string | null;
    content_type: string;
    file_type?: string | null;
    status: string;
    thumbnail_url?: string | null;
    duration_sec?: number | null;
    created_at: string;
    collection_id?: string | null;
  }[];
  counts: {
    uncategorized: number;
    favorites: number;
    total: number;
  };
}

interface LibraryTag {
  id: string;
  name: string;
  color: string;
  usage_count?: number;
}

interface CollectionSaveData {
  name: string;
  description: string;
  parent_id: string | null;
}

function isQuickAccessTab(value: string | null): value is QuickAccessTab {
  return QUICK_ACCESS_TABS.includes(value as QuickAccessTab);
}

function getSavedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'grid';
  const savedViewMode = localStorage.getItem('library-view-mode');
  return savedViewMode === 'list' || savedViewMode === 'grid'
    ? savedViewMode
    : 'grid';
}

function getSavedSortOption(): SortOption {
  if (typeof window === 'undefined') return 'recent';
  const savedSortBy = localStorage.getItem(
    'library-sort-by',
  ) as SortOption | null;
  return savedSortBy ?? 'recent';
}

const defaultAdvancedFilters: FilterState = {
  contentTypes: [],
  statuses: [],
  statusFilter: 'active',
  dateRange: { from: null, to: null },
  favoritesOnly: false,
  hasTranscript: null,
  hasDocument: null,
};

type LibraryPageState = {
  currentCollectionId: string | null;
  activeTab: QuickAccessTab;
  homeData: HomeViewData | null;
  collectionData: CollectionViewData | null;
  items: ContentItem[];
  loading: boolean;
  error: string | null;
  sortBy: SortOption;
  viewMode: ViewMode;
  searchQuery: string;
  advancedFilters: FilterState;
  selectedIds: string[];
  showTagModal: boolean;
  showTagManager: boolean;
  showUploadWizard: boolean;
  showExportModal: boolean;
  showGoogleDriveImport: boolean;
  showCollectionManager: boolean;
  showMoveModal: boolean;
  editingCollection: CollectionFolder | null;
  showDeleteDialog: boolean;
  showBulkDeleteDialog: boolean;
  showDeleteCollectionDialog: boolean;
  itemToDelete: string | null;
  collectionToDelete: CollectionFolder | null;
  isDeletingCollection: boolean;
  availableTags: LibraryTag[];
  selectedTagIds: string[];
  tagFilterMode: TagFilterMode;
  allCollections: CollectionFolder[];
  currentPage: number;
};

type LibraryPageAction =
  | Partial<LibraryPageState>
  | ((state: LibraryPageState) => LibraryPageState);

function createInitialLibraryPageState(
  collectionParam: string | null,
  tabParam: string | null,
  searchParam: string | null,
): LibraryPageState {
  return {
    currentCollectionId: collectionParam ?? null,
    activeTab: isQuickAccessTab(tabParam) ? tabParam : 'recent',
    homeData: null,
    collectionData: null,
    items: [],
    loading: true,
    error: null,
    sortBy: getSavedSortOption(),
    viewMode: getSavedViewMode(),
    searchQuery: searchParam ?? '',
    advancedFilters: defaultAdvancedFilters,
    selectedIds: [],
    showTagModal: false,
    showTagManager: false,
    showUploadWizard: false,
    showExportModal: false,
    showGoogleDriveImport: false,
    showCollectionManager: false,
    showMoveModal: false,
    editingCollection: null,
    showDeleteDialog: false,
    showBulkDeleteDialog: false,
    showDeleteCollectionDialog: false,
    itemToDelete: null,
    collectionToDelete: null,
    isDeletingCollection: false,
    availableTags: [],
    selectedTagIds: [],
    tagFilterMode: 'or',
    allCollections: [],
    currentPage: 1,
  };
}

function libraryPageReducer(
  state: LibraryPageState,
  action: LibraryPageAction,
): LibraryPageState {
  return typeof action === 'function' ? action(state) : { ...state, ...action };
}

interface LibraryContentGridProps {
  items: ContentItem[];
  paginatedItems: ContentItem[];
  viewMode: ViewMode;
  selectedIds: string[];
  searchQuery: string;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onDownload: (id: string) => void;
}

function LibraryContentGrid({
  items,
  paginatedItems,
  viewMode,
  selectedIds,
  searchQuery,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  onClearSearch,
  onPageChange,
  onSelect,
  onSelectAll,
  onDelete,
  onShare,
  onDownload,
}: LibraryContentGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <FileX2 className="size-12 text-muted-foreground mb-6" />
        <h3 className="text-lg font-semibold mb-3">No items found</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {searchQuery
            ? 'Try adjusting your search'
            : 'No content in this view'}
        </p>
        {searchQuery && (
          <Button onClick={onClearSearch} variant="outline">
            Clear Search
          </Button>
        )}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="rounded-md border overflow-x-auto">
          <LibraryTable
            items={paginatedItems}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onSelectAll={onSelectAll}
            onDelete={onDelete}
            onShare={onShare}
            onDownload={onDownload}
          />
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, items.length)} of{' '}
              {items.length}
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={
                      currentPage === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      onPageChange(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {items.map((item) => (
        <SelectableContentCard
          key={item.id}
          item={item}
          selected={selectedIds.includes(item.id)}
          onSelect={onSelect}
          onDelete={onDelete}
          onShare={onShare}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

interface LibraryFilterControlsProps {
  itemsCount: number;
  selectedIdsCount: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  advancedFilters: FilterState;
  availableTags: LibraryTag[];
  selectedTagIds: string[];
  tagFilterMode: TagFilterMode;
  sortBy: SortOption;
  viewMode: ViewMode;
  onSelectAll: (checked: boolean) => void;
  onSearchQueryChange: (value: string) => void;
  onAdvancedFiltersChange: (filters: FilterState) => void;
  onSelectedTagIdsChange: (ids: string[]) => void;
  onTagFilterModeChange: (mode: TagFilterMode) => void;
  onSortByChange: (sortBy: SortOption) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
}

function LibraryFilterControls({
  itemsCount,
  selectedIdsCount,
  searchInputRef,
  searchQuery,
  advancedFilters,
  availableTags,
  selectedTagIds,
  tagFilterMode,
  sortBy,
  viewMode,
  onSelectAll,
  onSearchQueryChange,
  onAdvancedFiltersChange,
  onSelectedTagIdsChange,
  onTagFilterModeChange,
  onSortByChange,
  onViewModeChange,
}: LibraryFilterControlsProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {itemsCount > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIdsCount === itemsCount && itemsCount > 0}
              onCheckedChange={onSelectAll}
              aria-label="Select all items"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={onAdvancedFiltersChange}
        />

        <TagFilter
          tags={availableTags}
          selectedTags={selectedTagIds}
          onSelectionChange={onSelectedTagIdsChange}
          filterMode={tagFilterMode}
          onFilterModeChange={onTagFilterModeChange}
          showCounts={true}
        />
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={sortBy}
          onValueChange={(v) => onSortByChange(v as SortOption)}
        >
          <SelectTrigger className="w-[180px]">
            <SlidersHorizontal className="mr-2 size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="size-asc">Size (Smallest)</SelectItem>
            <SelectItem value="size-desc">Size (Largest)</SelectItem>
            <SelectItem value="duration-asc">Duration (Shortest)</SelectItem>
            <SelectItem value="duration-desc">Duration (Longest)</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="rounded-r-none"
          >
            <Grid3x3 className="size-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="rounded-l-none"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function LibraryContentSection({
  children,
  filterControls,
  advancedFilters,
  onRemoveFilter,
  onClearAllFilters,
}: {
  children: ReactNode;
  filterControls: ReactNode;
  advancedFilters: FilterState;
  onRemoveFilter: (key: keyof FilterState, value?: string) => void;
  onClearAllFilters: () => void;
}) {
  return (
    <div className="space-y-4">
      {filterControls}
      <FilterChips
        filters={advancedFilters}
        onRemoveFilter={onRemoveFilter}
        onClearAll={onClearAllFilters}
      />
      {children}
    </div>
  );
}

/**
 * Enhanced Library Page Component
 * Folder-style navigation model
 *
 * Features:
 * - Navigate INTO collections (folder feel)
 * - Full-width content area
 * - Breadcrumb navigation
 * - Quick access tabs (Recent, Favorites, All, Uncategorized)
 * - Grid and list view modes
 * - Advanced filtering and search
 */
function LibraryPageContent() {
  return useLibraryPageContentImplementation();
}

function useLibraryPageContentImplementation() {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const collectionParam = getSearchParam('collection');
  const tabParam = getSearchParam('tab');
  const searchParam = getSearchParam('q');

  const { toast } = useToast();

  const [
    {
      currentCollectionId,
      activeTab,
      homeData,
      collectionData,
      items,
      loading,
      error,
      sortBy,
      viewMode,
      searchQuery,
      advancedFilters,
      selectedIds,
      showTagModal,
      showTagManager,
      showUploadWizard,
      showExportModal,
      showGoogleDriveImport,
      showCollectionManager,
      showMoveModal,
      editingCollection,
      showDeleteDialog,
      showBulkDeleteDialog,
      showDeleteCollectionDialog,
      itemToDelete,
      collectionToDelete,
      isDeletingCollection,
      availableTags,
      selectedTagIds,
      tagFilterMode,
      allCollections,
      currentPage,
    },
    updateLibraryPageState,
  ] = useReducer(libraryPageReducer, undefined, () =>
    createInitialLibraryPageState(collectionParam, tabParam, searchParam),
  );

  const updateAdvancedFilters = useCallback(
    (action: FilterState | ((filters: FilterState) => FilterState)) => {
      updateLibraryPageState((state) => ({
        ...state,
        advancedFilters:
          typeof action === 'function' ? action(state.advancedFilters) : action,
      }));
    },
    [],
  );

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resetSelectionForViewChange = useCallback(() => {
    updateLibraryPageState({ selectedIds: [], currentPage: 1 });
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('library-view-mode', viewMode);
      localStorage.setItem('library-sort-by', sortBy);
    }
  }, [viewMode, sortBy]);

  // Update URL when navigation changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentCollectionId) params.set('collection', currentCollectionId);
    if (!currentCollectionId && activeTab !== 'recent')
      params.set('tab', activeTab);
    if (searchQuery) params.set('q', searchQuery);

    const newUrl = params.toString() ? `?${params.toString()}` : '/library';
    window.history.replaceState(null, '', newUrl);
  }, [currentCollectionId, activeTab, searchQuery]);

  // Fetch data based on current navigation state
  useEffect(() => {
    if (currentCollectionId) {
      fetchCollectionView(currentCollectionId);
    } else {
      fetchHomeView();
    }
    fetchTags();
    fetchAllCollections();
  }, [currentCollectionId, advancedFilters.statusFilter]);

  // Fetch content when tab changes (for non-recent tabs)
  useEffect(() => {
    if (!currentCollectionId && activeTab !== 'recent') {
      fetchFilteredContent();
    }
  }, [activeTab, currentCollectionId, advancedFilters.statusFilter]);

  // Fetch functions
  async function fetchHomeView() {
    try {
      updateLibraryPageState({ loading: true, error: null });

      const response = await fetch('/api/library/home');
      if (!response.ok) throw new Error('Failed to fetch library home');

      const result = await response.json();
      updateLibraryPageState({
        homeData: result.data,
        collectionData: null,
      });
    } catch (err) {
      console.error('Error fetching library home:', err);
      updateLibraryPageState({
        error: err instanceof Error ? err.message : 'Failed to load library',
      });
    } finally {
      updateLibraryPageState({ loading: false });
    }
  }

  async function fetchCollectionView(collectionId: string) {
    try {
      updateLibraryPageState({ loading: true, error: null });

      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String((currentPage - 1) * ITEMS_PER_PAGE),
        sort: sortBy,
      });

      const response = await fetch(
        `/api/collections/${collectionId}/view?${params}`,
      );
      if (!response.ok) {
        if (response.status === 404) {
          updateLibraryPageState({ currentCollectionId: null });
          resetSelectionForViewChange();
          toast({
            variant: 'destructive',
            title: 'Collection not found',
            description: 'The collection may have been deleted.',
          });
          return;
        }
        throw new Error('Failed to fetch collection');
      }

      const result = await response.json();
      updateLibraryPageState({
        collectionData: result.data,
        items: result.data.items || [],
        homeData: null,
      });
    } catch (err) {
      console.error('Error fetching collection:', err);
      updateLibraryPageState({
        error: err instanceof Error ? err.message : 'Failed to load collection',
      });
    } finally {
      updateLibraryPageState({ loading: false });
    }
  }

  async function fetchFilteredContent() {
    try {
      updateLibraryPageState({ loading: true, error: null });

      const params = new URLSearchParams({
        limit: '100',
        view: advancedFilters.statusFilter,
      });

      const response = await fetch(`/api/library?${params}`);
      if (!response.ok) throw new Error('Failed to fetch content');

      const result = await response.json();
      let allItems: ContentItem[] = result.data?.data || [];

      // Filter by tab
      if (activeTab === 'favorites') {
        allItems = allItems.filter((item) =>
          Boolean(item.metadata?.is_favorite),
        );
      } else if (activeTab === 'uncategorized') {
        allItems = allItems.filter((item) => !item.collection_id);
      }
      // 'all' tab shows everything

      updateLibraryPageState({ items: allItems });
    } catch (err) {
      console.error('Error fetching content:', err);
      updateLibraryPageState({
        error: err instanceof Error ? err.message : 'Failed to load content',
      });
    } finally {
      updateLibraryPageState({ loading: false });
    }
  }

  async function fetchTags() {
    try {
      const response = await fetch(
        '/api/tags?includeUsageCount=true&limit=100',
      );
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      updateLibraryPageState({ availableTags: data.data.tags || [] });
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  async function fetchAllCollections() {
    try {
      const response = await fetch('/api/collections?limit=200');
      if (!response.ok) throw new Error('Failed to fetch collections');

      const data = await response.json();
      updateLibraryPageState({ allCollections: data.data?.collections || [] });
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }

  // Navigation handlers
  const handleNavigateToCollection = useCallback(
    (collectionId: string) => {
      updateLibraryPageState({ currentCollectionId: collectionId });
      resetSelectionForViewChange();
    },
    [resetSelectionForViewChange],
  );

  const handleNavigateBack = useCallback(() => {
    if (collectionData?.breadcrumb && collectionData.breadcrumb.length > 1) {
      // Navigate to parent
      const parentId =
        collectionData.breadcrumb[collectionData.breadcrumb.length - 2]?.id ||
        null;
      updateLibraryPageState({ currentCollectionId: parentId });
    } else {
      // Navigate to root
      updateLibraryPageState({ currentCollectionId: null });
    }
    resetSelectionForViewChange();
  }, [collectionData, resetSelectionForViewChange]);

  const handleBreadcrumbClick = useCallback(
    (collectionId: string | null) => {
      updateLibraryPageState({ currentCollectionId: collectionId });
      resetSelectionForViewChange();
    },
    [resetSelectionForViewChange],
  );

  const handleTabChange = useCallback(
    (tab: QuickAccessTab) => {
      updateLibraryPageState({ activeTab: tab, currentCollectionId: null });
      resetSelectionForViewChange();
    },
    [resetSelectionForViewChange],
  );

  // Compute filtered items
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by content types
    if (advancedFilters.contentTypes.length > 0) {
      filtered = filtered.filter((item) =>
        item.content_type
          ? advancedFilters.contentTypes.includes(item.content_type)
          : false,
      );
    }

    // Filter by tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((item) => {
        const itemTagIds = item.metadata?.tags?.map((tag) => tag.id) || [];
        if (tagFilterMode === 'and') {
          return selectedTagIds.every((tagId) => itemTagIds.includes(tagId));
        } else {
          return selectedTagIds.some((tagId) => itemTagIds.includes(tagId));
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.original_filename?.toLowerCase().includes(query),
      );
    }

    // Sort items
    switch (sortBy) {
      case 'recent':
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        break;
      case 'oldest':
        filtered.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        break;
      case 'name-asc':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'name-desc':
        filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'size-asc':
        filtered.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
        break;
      case 'size-desc':
        filtered.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
        break;
      case 'duration-asc':
        filtered.sort((a, b) => (a.duration_sec || 0) - (b.duration_sec || 0));
        break;
      case 'duration-desc':
        filtered.sort((a, b) => (b.duration_sec || 0) - (a.duration_sec || 0));
        break;
    }

    return filtered;
  }, [
    items,
    sortBy,
    searchQuery,
    selectedTagIds,
    tagFilterMode,
    advancedFilters,
  ]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems =
    viewMode === 'list'
      ? filteredItems.slice(startIndex, endIndex)
      : filteredItems;

  // Action handlers
  const handleDelete = (id: string) => {
    updateLibraryPageState({ itemToDelete: id, showDeleteDialog: true });
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/recordings/${itemToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete');
      }

      updateLibraryPageState((state) => ({
        ...state,
        items: state.items.filter((item) => item.id !== itemToDelete),
      }));
      toast({
        description: 'Item moved to trash.',
      });
    } catch (err) {
      console.error('Delete failed:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to delete item',
      });
    } finally {
      updateLibraryPageState({
        showDeleteDialog: false,
        itemToDelete: null,
      });
    }
  };

  const handleShare = (id: string) => {
    push(`/library/${id}?action=share`);
  };

  const handleDownload = (id: string) => {
    push(`/library/${id}?action=download`);
  };

  // Bulk selection handlers
  const handleSelect = useCallback((id: string, selected: boolean) => {
    updateLibraryPageState((state) => ({
      ...state,
      selectedIds: selected
        ? [...state.selectedIds, id]
        : state.selectedIds.filter((itemId) => itemId !== id),
    }));
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const itemsToSelect =
        viewMode === 'list' ? paginatedItems : filteredItems;
      updateLibraryPageState({
        selectedIds: checked ? itemsToSelect.map((item) => item.id) : [],
      });
    },
    [filteredItems, paginatedItems, viewMode],
  );

  const handleClearSelection = useCallback(() => {
    updateLibraryPageState({ selectedIds: [] });
  }, []);

  // Collection handlers
  const handleNewCollection = useCallback(() => {
    updateLibraryPageState({
      editingCollection: null,
      showCollectionManager: true,
    });
  }, []);

  const handleEditCollection = useCallback((collection: CollectionFolder) => {
    updateLibraryPageState({
      editingCollection: collection,
      showCollectionManager: true,
    });
  }, []);

  const handleDeleteCollection = useCallback((collection: CollectionFolder) => {
    updateLibraryPageState({
      collectionToDelete: collection,
      showDeleteCollectionDialog: true,
    });
  }, []);

  // Move items to collection handler
  const handleMoveToCollection = useCallback(
    async (collectionId: string | null) => {
      if (selectedIds.length === 0) return;

      try {
        const response = await fetch('/api/content/bulk-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content_ids: selectedIds,
            collection_id: collectionId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to move items');
        }

        // Update local state
        updateLibraryPageState((state) => ({
          ...state,
          items: state.items.map((item) =>
            selectedIds.includes(item.id)
              ? { ...item, collection_id: collectionId }
              : item,
          ),
        }));

        // Refresh data
        if (currentCollectionId) {
          fetchCollectionView(currentCollectionId);
        } else {
          fetchHomeView();
        }

        updateLibraryPageState({ selectedIds: [] });
        toast({
          description: `Moved ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'} successfully`,
        });
      } catch (err) {
        console.error('Move failed:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            err instanceof Error ? err.message : 'Failed to move items',
        });
        throw err;
      }
    },
    [selectedIds, currentCollectionId, toast],
  );

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete) return;

    updateLibraryPageState({ isDeletingCollection: true });
    try {
      const response = await fetch(
        `/api/collections/${collectionToDelete.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete');
      }

      if (currentCollectionId === collectionToDelete.id) {
        updateLibraryPageState({ currentCollectionId: null });
        resetSelectionForViewChange();
      }

      // Refresh data
      if (currentCollectionId) {
        fetchCollectionView(currentCollectionId);
      } else {
        fetchHomeView();
      }

      toast({ description: 'Collection deleted successfully' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to delete collection',
      });
    } finally {
      updateLibraryPageState({
        isDeletingCollection: false,
        showDeleteCollectionDialog: false,
        collectionToDelete: null,
      });
    }
  };

  // Save collection handler
  const handleSaveCollection = async (data: CollectionSaveData) => {
    try {
      const isEditing = !!editingCollection;
      const url = isEditing
        ? `/api/collections/${editingCollection.id}`
        : '/api/collections';
      const method = isEditing ? 'PATCH' : 'POST';

      // If creating in a collection context, set parent_id
      if (!isEditing && currentCollectionId) {
        data.parent_id = currentCollectionId;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to save collection');

      // Refresh data
      if (currentCollectionId) {
        fetchCollectionView(currentCollectionId);
      } else {
        fetchHomeView();
      }

      toast({
        description: isEditing
          ? 'Collection updated successfully'
          : 'Collection created successfully',
      });
    } catch (error) {
      console.error('Failed to save collection:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save collection',
      });
      throw error;
    }
  };

  // Filter handlers
  const handleRemoveFilter = (key: keyof FilterState, value?: string) => {
    const newFilters = { ...advancedFilters };

    if (key === 'contentTypes' && value) {
      newFilters.contentTypes = newFilters.contentTypes.filter(
        (t) => t !== value,
      );
    } else if (key === 'favoritesOnly') {
      newFilters.favoritesOnly = false;
    } else if (key === 'hasTranscript') {
      newFilters.hasTranscript = null;
    } else if (key === 'hasDocument') {
      newFilters.hasDocument = null;
    }

    updateAdvancedFilters(newFilters);
  };

  const handleClearAllFilters = () => {
    updateLibraryPageState({
      advancedFilters: defaultAdvancedFilters,
      selectedTagIds: [],
      searchQuery: '',
    });
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.UPLOAD,
      handler: () => updateLibraryPageState({ showUploadWizard: true }),
    },
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'n',
      ctrl: true,
      handler: () => updateLibraryPageState({ showCollectionManager: true }),
      description: 'New collection',
    },
    {
      key: 'Escape',
      handler: () => {
        if (selectedIds.length > 0) {
          handleClearSelection();
        }
      },
      description: 'Clear selection',
      preventDefault: false,
    },
    {
      key: 'm',
      handler: () => {
        if (selectedIds.length > 0) {
          updateLibraryPageState({ showMoveModal: true });
        }
      },
      description: 'Move to folder',
    },
    {
      key: 'Backspace',
      handler: () => {
        if (currentCollectionId && selectedIds.length === 0) {
          handleNavigateBack();
        }
      },
      description: 'Go back',
      preventDefault: false,
    },
  ]);

  const filterControls = (
    <LibraryFilterControls
      itemsCount={filteredItems.length}
      selectedIdsCount={selectedIds.length}
      searchInputRef={searchInputRef}
      searchQuery={searchQuery}
      advancedFilters={advancedFilters}
      availableTags={availableTags}
      selectedTagIds={selectedTagIds}
      tagFilterMode={tagFilterMode}
      sortBy={sortBy}
      viewMode={viewMode}
      onSelectAll={handleSelectAll}
      onSearchQueryChange={(searchQuery) =>
        updateLibraryPageState({ searchQuery })
      }
      onAdvancedFiltersChange={updateAdvancedFilters}
      onSelectedTagIdsChange={(selectedTagIds) =>
        updateLibraryPageState({ selectedTagIds })
      }
      onTagFilterModeChange={(tagFilterMode) =>
        updateLibraryPageState({ tagFilterMode })
      }
      onSortByChange={(sortBy) => updateLibraryPageState({ sortBy })}
      onViewModeChange={(viewMode) => updateLibraryPageState({ viewMode })}
    />
  );

  const contentGrid = (
    <LibraryContentGrid
      items={filteredItems}
      paginatedItems={paginatedItems}
      viewMode={viewMode}
      selectedIds={selectedIds}
      searchQuery={searchQuery}
      currentPage={currentPage}
      totalPages={totalPages}
      startIndex={startIndex}
      endIndex={endIndex}
      onClearSearch={() => updateLibraryPageState({ searchQuery: '' })}
      onPageChange={(currentPage) => updateLibraryPageState({ currentPage })}
      onSelect={handleSelect}
      onSelectAll={handleSelectAll}
      onDelete={handleDelete}
      onShare={handleShare}
      onDownload={handleDownload}
    />
  );

  const libraryContent = (
    <LibraryContentSection
      filterControls={filterControls}
      advancedFilters={advancedFilters}
      onRemoveFilter={handleRemoveFilter}
      onClearAllFilters={handleClearAllFilters}
    >
      {contentGrid}
    </LibraryContentSection>
  );

  return (
    <div className="min-h-screen">
      <div className="trbd-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="trbd-page-title tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">
              Your recordings, documents, and content organized in folders
            </p>
            <DocLink href="/docs/product/recordings">About recordings</DocLink>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => updateLibraryPageState({ showTagManager: true })}
            >
              <Settings className="size-4 mr-2" />
              <span className="hidden sm:inline">Manage Tags</span>
            </Button>
            <Button
              onClick={() => updateLibraryPageState({ showUploadWizard: true })}
            >
              <Upload className="size-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <m.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {currentCollectionId ? (
                <CollectionFolderViewSkeleton />
              ) : (
                <LibraryRootViewSkeleton />
              )}
            </m.div>
          ) : error ? (
            <m.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
            >
              <FileX2 className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Error Loading Library
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button
                onClick={() =>
                  currentCollectionId
                    ? fetchCollectionView(currentCollectionId)
                    : fetchHomeView()
                }
                variant="outline"
              >
                Try Again
              </Button>
            </m.div>
          ) : currentCollectionId && collectionData ? (
            // Collection View
            <m.div
              key={`collection-${currentCollectionId}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <CollectionFolderView
                collection={collectionData.collection}
                breadcrumb={collectionData.breadcrumb}
                subcollections={collectionData.subcollections}
                onBack={handleNavigateBack}
                onBreadcrumbClick={handleBreadcrumbClick}
                onSubcollectionClick={handleNavigateToCollection}
                onNewSubcollection={handleNewCollection}
                onEditCollection={handleEditCollection}
                onDeleteCollection={handleDeleteCollection}
                content={libraryContent}
              />
            </m.div>
          ) : homeData ? (
            // Root/Home View
            <m.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <LibraryRootView
                collections={homeData.collections}
                recentItems={homeData.recentItems}
                counts={homeData.counts}
                activeTab={activeTab}
                onCollectionClick={handleNavigateToCollection}
                onTabChange={handleTabChange}
                onNewCollection={handleNewCollection}
                onEditCollection={handleEditCollection}
                onDeleteCollection={handleDeleteCollection}
                onRecentItemClick={(id) => push(`/library/${id}`)}
                onSeeAllRecent={() => handleTabChange('all')}
                content={libraryContent}
              />
            </m.div>
          ) : (
            <LibraryEmptyState onUploadComplete={() => fetchHomeView()} />
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onDelete={async () =>
          updateLibraryPageState({ showBulkDeleteDialog: true })
        }
        onAddTags={() => updateLibraryPageState({ showTagModal: true })}
        onMoveToCollection={() =>
          updateLibraryPageState({ showMoveModal: true })
        }
        onDownload={async () =>
          updateLibraryPageState({ showExportModal: true })
        }
        mode="active"
      />

      {/* Modals */}
      <BulkTagModal
        open={showTagModal}
        onOpenChange={(open) => updateLibraryPageState({ showTagModal: open })}
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
      />

      <TagManager
        open={showTagManager}
        onOpenChange={(open) =>
          updateLibraryPageState({ showTagManager: open })
        }
      />

      <CollectionManager
        open={showCollectionManager}
        onOpenChange={(open) => {
          updateLibraryPageState({
            showCollectionManager: open,
            editingCollection: open ? editingCollection : null,
          });
        }}
        collection={editingCollection}
        collections={
          homeData?.collections || collectionData?.subcollections || []
        }
        onSave={handleSaveCollection}
      />

      <UploadWizard
        open={showUploadWizard}
        onClose={() => {
          updateLibraryPageState({ showUploadWizard: false });
          if (currentCollectionId) {
            fetchCollectionView(currentCollectionId);
          } else {
            fetchHomeView();
          }
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => updateLibraryPageState({ showExportModal: false })}
        selectedItems={selectedIds}
        totalItems={items.length}
      />

      <GoogleDriveImportModal
        isOpen={showGoogleDriveImport}
        onClose={() => updateLibraryPageState({ showGoogleDriveImport: false })}
        onImportComplete={(count) => {
          toast({
            description: `Successfully imported ${count} file(s) from Google Drive`,
          });
          if (currentCollectionId) {
            fetchCollectionView(currentCollectionId);
          } else {
            fetchHomeView();
          }
        }}
      />

      <MoveToCollectionModal
        open={showMoveModal}
        onOpenChange={(open) => updateLibraryPageState({ showMoveModal: open })}
        items={items.flatMap((__item, __index, __array) =>
          selectedIds.includes(__item.id)
            ? [
                {
                  id: __item.id,
                  title: __item.title,
                  collection_id: __item.collection_id,
                },
              ]
            : [],
        )}
        collections={allCollections}
        onMove={handleMoveToCollection}
        maxDepth={2}
      />

      {/* Delete Dialogs */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) =>
          updateLibraryPageState({ showDeleteDialog: open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be moved to trash. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={(open) =>
          updateLibraryPageState({ showBulkDeleteDialog: open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {selectedIds.length} items to Trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              These items will be moved to trash. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const promises = selectedIds.map((id) =>
                  fetch(`/api/recordings/${id}`, { method: 'DELETE' }),
                );
                await Promise.allSettled(promises);
                updateLibraryPageState((state) => ({
                  ...state,
                  items: state.items.filter(
                    (item) => !selectedIds.includes(item.id),
                  ),
                  selectedIds: [],
                  showBulkDeleteDialog: false,
                }));
                toast({
                  description: `Moved ${selectedIds.length} items to trash`,
                });
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDeleteCollectionDialog}
        onOpenChange={(open) =>
          updateLibraryPageState({ showDeleteCollectionDialog: open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{collectionToDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the collection. Items in this collection will not
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCollection}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCollection}
              disabled={isDeletingCollection}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeletingCollection ? 'Deleting...' : 'Delete Collection'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <KeyboardShortcutsProvider>
      <Suspense fallback={<LibraryRootViewSkeleton />}>
        <LibraryPageContent />
      </Suspense>
    </KeyboardShortcutsProvider>
  );
}
