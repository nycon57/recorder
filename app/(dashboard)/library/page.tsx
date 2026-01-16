"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Grid3x3, List, Search, SlidersHorizontal, FileX2, Settings, Upload, Download, Plus, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
import { ContentGridSkeleton, ContentListSkeleton } from '@/app/components/skeletons/ContentCardSkeleton';
import { LibraryEmptyState } from '@/app/components/empty-states/LibraryEmptyState';
import { BulkActionsToolbar } from '@/app/components/library/BulkActionsToolbar';
import { BulkTagModal } from '@/app/components/library/BulkTagModal';
import { TagManager } from '@/app/components/tags/TagManager';
import { TagFilter } from '@/app/components/tags/TagFilter';
import { AdvancedFilters, FilterState, StatusFilter } from '@/app/components/filters/AdvancedFilters';
import { FilterChips } from '@/app/components/filters/FilterChips';
import { CollectionManager } from '@/app/components/collections/CollectionManager';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useToast } from '@/app/components/ui/use-toast';
import UploadWizard from '@/app/components/recorder/UploadWizard';
import ExportModal from '@/app/components/library/ExportModal';
import GoogleDriveImportModal from '@/app/components/library/GoogleDriveImportModal';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/app/hooks/useKeyboardShortcuts';

// New folder navigation components
import { LibraryRootView, LibraryRootViewSkeleton, QuickAccessTab } from '@/app/components/library/LibraryRootView';
import { CollectionFolderView, CollectionFolderViewSkeleton } from '@/app/components/collections/CollectionFolderView';
import { CollectionFolder } from '@/app/components/collections/CollectionFolderCard';
import { MoveToCollectionModal } from '@/app/components/collections/MoveToCollectionModal';

import { SelectableContentCard, LibraryTable } from '@/app/components/library';
import { ContentItem } from '@/app/components/content';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/app/components/ui/pagination';

type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'duration-asc' | 'duration-desc';
type ViewMode = 'grid' | 'list';

const ITEMS_PER_PAGE = 25;

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface CollectionViewData {
  collection: CollectionFolder & { item_count: number; subcollection_count: number };
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
  recentItems: any[];
  counts: {
    uncategorized: number;
    favorites: number;
    total: number;
  };
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const { toast } = useToast();

  // Navigation state - current collection (null = root/home view)
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  // Quick access tab for root view
  const [activeTab, setActiveTab] = useState<QuickAccessTab>('recent');

  // Data state
  const [homeData, setHomeData] = useState<HomeViewData | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionViewData | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/view state
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    contentTypes: [],
    statuses: [],
    statusFilter: 'active',
    dateRange: { from: null, to: null },
    favoritesOnly: false,
    hasTranscript: null,
    hasDocument: null,
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showGoogleDriveImport, setShowGoogleDriveImport] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionFolder | null>(null);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [showDeleteCollectionDialog, setShowDeleteCollectionDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<CollectionFolder | null>(null);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);

  // Tag filter state
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');

  // All collections for move modal
  const [allCollections, setAllCollections] = useState<CollectionFolder[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search input ref
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize from URL params
  useEffect(() => {
    const collectionParam = searchParams.get('collection');
    const tabParam = searchParams.get('tab') as QuickAccessTab | null;
    const searchParam = searchParams.get('q');

    if (collectionParam) {
      setCurrentCollectionId(collectionParam);
    }
    if (tabParam && ['recent', 'favorites', 'all', 'uncategorized'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    if (searchParam) {
      setSearchQuery(searchParam);
    }

    // Load saved preferences
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('library-view-mode') as ViewMode;
      const savedSortBy = localStorage.getItem('library-sort-by') as SortOption;
      if (savedViewMode) setViewMode(savedViewMode);
      if (savedSortBy) setSortBy(savedSortBy);
    }
  }, [searchParams]);

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
    if (!currentCollectionId && activeTab !== 'recent') params.set('tab', activeTab);
    if (searchQuery) params.set('q', searchQuery);

    const newUrl = params.toString() ? `?${params.toString()}` : '/library';
    router.replace(newUrl, { scroll: false });
  }, [currentCollectionId, activeTab, searchQuery, router]);

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

  // Clear selection when changing views
  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
  }, [currentCollectionId, activeTab]);

  // Fetch functions
  async function fetchHomeView() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/library/home');
      if (!response.ok) throw new Error('Failed to fetch library home');

      const result = await response.json();
      setHomeData(result.data);
      setCollectionData(null);
    } catch (err) {
      console.error('Error fetching library home:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCollectionView(collectionId: string) {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String((currentPage - 1) * ITEMS_PER_PAGE),
        sort: sortBy,
      });

      const response = await fetch(`/api/collections/${collectionId}/view?${params}`);
      if (!response.ok) {
        if (response.status === 404) {
          setCurrentCollectionId(null);
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
      setCollectionData(result.data);
      setItems(result.data.items || []);
      setHomeData(null);
    } catch (err) {
      console.error('Error fetching collection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFilteredContent() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '100',
        view: advancedFilters.statusFilter,
      });

      const response = await fetch(`/api/library?${params}`);
      if (!response.ok) throw new Error('Failed to fetch content');

      const result = await response.json();
      let allItems = result.data?.data || [];

      // Filter by tab
      if (activeTab === 'favorites') {
        allItems = allItems.filter((item: any) => item.is_favorite);
      } else if (activeTab === 'uncategorized') {
        allItems = allItems.filter((item: any) => !item.collection_id);
      }
      // 'all' tab shows everything

      setItems(allItems);
    } catch (err) {
      console.error('Error fetching content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTags() {
    try {
      const response = await fetch('/api/tags?includeUsageCount=true&limit=100');
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      setAvailableTags(data.data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }

  async function fetchAllCollections() {
    try {
      const response = await fetch('/api/collections?limit=200');
      if (!response.ok) throw new Error('Failed to fetch collections');

      const data = await response.json();
      setAllCollections(data.data?.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }

  // Navigation handlers
  const handleNavigateToCollection = useCallback((collectionId: string) => {
    setCurrentCollectionId(collectionId);
  }, []);

  const handleNavigateBack = useCallback(() => {
    if (collectionData?.breadcrumb && collectionData.breadcrumb.length > 1) {
      // Navigate to parent
      const parentId = collectionData.breadcrumb[collectionData.breadcrumb.length - 2]?.id || null;
      setCurrentCollectionId(parentId);
    } else {
      // Navigate to root
      setCurrentCollectionId(null);
    }
  }, [collectionData]);

  const handleBreadcrumbClick = useCallback((collectionId: string | null) => {
    setCurrentCollectionId(collectionId);
  }, []);

  const handleTabChange = useCallback((tab: QuickAccessTab) => {
    setActiveTab(tab);
    if (tab !== 'recent') {
      fetchFilteredContent();
    }
  }, []);

  // Compute filtered items
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by content types
    if (advancedFilters.contentTypes.length > 0) {
      filtered = filtered.filter(item =>
        advancedFilters.contentTypes.includes(item.content_type as any)
      );
    }

    // Filter by tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(item => {
        const itemTagIds = (item as any).tags?.map((t: any) => t.id) || [];
        if (tagFilterMode === 'and') {
          return selectedTagIds.every(tagId => itemTagIds.includes(tagId));
        } else {
          return selectedTagIds.some(tagId => itemTagIds.includes(tagId));
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.original_filename?.toLowerCase().includes(query)
      );
    }

    // Sort items
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
  }, [items, sortBy, searchQuery, selectedTagIds, tagFilterMode, advancedFilters]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = viewMode === 'list' ? filteredItems.slice(startIndex, endIndex) : filteredItems;

  // Action handlers
  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setShowDeleteDialog(true);
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

      setItems(prev => prev.filter(item => item.id !== itemToDelete));
      toast({
        description: 'Item moved to trash.',
      });
    } catch (err) {
      console.error('Delete failed:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete item',
      });
    } finally {
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };

  const handleShare = (id: string) => {
    router.push(`/library/${id}?action=share`);
  };

  const handleDownload = (id: string) => {
    router.push(`/library/${id}?action=download`);
  };

  // Bulk selection handlers
  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev =>
      selected ? [...prev, id] : prev.filter(itemId => itemId !== id)
    );
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    const itemsToSelect = viewMode === 'list' ? paginatedItems : filteredItems;
    setSelectedIds(checked ? itemsToSelect.map(item => item.id) : []);
  }, [filteredItems, paginatedItems, viewMode]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Collection handlers
  const handleNewCollection = useCallback(() => {
    setEditingCollection(null);
    setShowCollectionManager(true);
  }, []);

  const handleEditCollection = useCallback((collection: CollectionFolder) => {
    setEditingCollection(collection);
    setShowCollectionManager(true);
  }, []);

  const handleDeleteCollection = useCallback((collection: CollectionFolder) => {
    setCollectionToDelete(collection);
    setShowDeleteCollectionDialog(true);
  }, []);

  // Move items to collection handler
  const handleMoveToCollection = useCallback(async (collectionId: string | null) => {
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
      setItems((prev) =>
        prev.map((item) =>
          selectedIds.includes(item.id)
            ? { ...item, collection_id: collectionId }
            : item
        )
      );

      // Refresh data
      if (currentCollectionId) {
        fetchCollectionView(currentCollectionId);
      } else {
        fetchHomeView();
      }

      setSelectedIds([]);
      toast({
        description: `Moved ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'} successfully`,
      });
    } catch (err) {
      console.error('Move failed:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to move items',
      });
      throw err;
    }
  }, [selectedIds, currentCollectionId, toast]);

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete) return;

    setIsDeletingCollection(true);
    try {
      const response = await fetch(`/api/collections/${collectionToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete');
      }

      if (currentCollectionId === collectionToDelete.id) {
        setCurrentCollectionId(null);
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
        description: err instanceof Error ? err.message : 'Failed to delete collection',
      });
    } finally {
      setIsDeletingCollection(false);
      setShowDeleteCollectionDialog(false);
      setCollectionToDelete(null);
    }
  };

  // Save collection handler
  const handleSaveCollection = async (data: any) => {
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
      newFilters.contentTypes = newFilters.contentTypes.filter(t => t !== value);
    } else if (key === 'favoritesOnly') {
      newFilters.favoritesOnly = false;
    } else if (key === 'hasTranscript') {
      newFilters.hasTranscript = null;
    } else if (key === 'hasDocument') {
      newFilters.hasDocument = null;
    }

    setAdvancedFilters(newFilters);
  };

  const handleClearAllFilters = () => {
    setAdvancedFilters({
      contentTypes: [],
      statuses: [],
      statusFilter: 'active',
      dateRange: { from: null, to: null },
      favoritesOnly: false,
      hasTranscript: null,
      hasDocument: null,
    });
    setSelectedTagIds([]);
    setSearchQuery('');
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.UPLOAD,
      handler: () => setShowUploadWizard(true),
    },
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'n',
      ctrl: true,
      handler: () => setShowCollectionManager(true),
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
          setShowMoveModal(true);
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

  // Render content grid/list
  const renderContentGrid = () => {
    if (filteredItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <FileX2 className="h-12 w-12 text-muted-foreground mb-6" />
          <h3 className="text-lg font-semibold mb-3">No items found</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            {searchQuery ? 'Try adjusting your search' : 'No content in this view'}
          </p>
          {searchQuery && (
            <Button onClick={() => setSearchQuery('')} variant="outline">
              Clear Search
            </Button>
          )}
        </div>
      );
    }

    return viewMode === 'list' ? (
      <div className="space-y-6">
        <div className="rounded-md border overflow-x-auto">
          <LibraryTable
            items={paginatedItems}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onDelete={handleDelete}
            onShare={handleShare}
            onDownload={handleDownload}
          />
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length}
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    {...({} as any)}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-4 text-sm">{currentPage} / {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    {...({} as any)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredItems.map((item) => (
          <SelectableContentCard
            key={item.id}
            item={item}
            selected={selectedIds.includes(item.id)}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onShare={handleShare}
            onDownload={handleDownload}
          />
        ))}
      </div>
    );
  };

  // Render filter controls
  const renderFilterControls = () => (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-4">
        {/* Select all */}
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
              onCheckedChange={handleSelectAll}
              aria-label="Select all items"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={setAdvancedFilters}
        />

        <TagFilter
          tags={availableTags}
          selectedTags={selectedTagIds}
          onSelectionChange={setSelectedTagIds}
          filterMode={tagFilterMode}
          onFilterModeChange={setTagFilterMode}
          showCounts={true}
        />
      </div>

      <div className="flex items-center gap-4">
        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[180px]">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
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

        {/* View toggle */}
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-heading-3 font-outfit tracking-tight">Library</h1>
            <p className="text-sm text-muted-foreground">
              Your recordings, documents, and content organized in folders
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setShowTagManager(true)}>
              <Settings className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Manage Tags</span>
            </Button>
            <Button onClick={() => setShowUploadWizard(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
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
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
            >
              <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Library</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => currentCollectionId ? fetchCollectionView(currentCollectionId) : fetchHomeView()} variant="outline">
                Try Again
              </Button>
            </motion.div>
          ) : currentCollectionId && collectionData ? (
            // Collection View
            <motion.div
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
                renderContent={() => (
                  <div className="space-y-4">
                    {renderFilterControls()}
                    <FilterChips
                      filters={advancedFilters}
                      onRemoveFilter={handleRemoveFilter}
                      onClearAll={handleClearAllFilters}
                    />
                    {renderContentGrid()}
                  </div>
                )}
              />
            </motion.div>
          ) : homeData ? (
            // Root/Home View
            <motion.div
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
                onRecentItemClick={(id) => router.push(`/library/${id}`)}
                onSeeAllRecent={() => handleTabChange('all')}
                renderContent={() => (
                  <div className="space-y-4">
                    {renderFilterControls()}
                    <FilterChips
                      filters={advancedFilters}
                      onRemoveFilter={handleRemoveFilter}
                      onClearAll={handleClearAllFilters}
                    />
                    {renderContentGrid()}
                  </div>
                )}
              />
            </motion.div>
          ) : (
            <LibraryEmptyState onUploadComplete={() => fetchHomeView()} />
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onDelete={async () => setShowBulkDeleteDialog(true)}
        onAddTags={() => setShowTagModal(true)}
        onMoveToCollection={() => setShowMoveModal(true)}
        onDownload={async () => setShowExportModal(true)}
        mode="active"
      />

      {/* Modals */}
      <BulkTagModal
        open={showTagModal}
        onOpenChange={setShowTagModal}
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
      />

      <TagManager
        open={showTagManager}
        onOpenChange={setShowTagManager}
      />

      <CollectionManager
        open={showCollectionManager}
        onOpenChange={(open) => {
          setShowCollectionManager(open);
          if (!open) setEditingCollection(null);
        }}
        collection={editingCollection}
        collections={homeData?.collections || collectionData?.subcollections || []}
        onSave={handleSaveCollection}
      />

      <UploadWizard
        open={showUploadWizard}
        onClose={() => {
          setShowUploadWizard(false);
          if (currentCollectionId) {
            fetchCollectionView(currentCollectionId);
          } else {
            fetchHomeView();
          }
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedItems={selectedIds}
        totalItems={items.length}
      />

      <GoogleDriveImportModal
        isOpen={showGoogleDriveImport}
        onClose={() => setShowGoogleDriveImport(false)}
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
        onOpenChange={setShowMoveModal}
        items={items.filter((item) => selectedIds.includes(item.id)).map((item) => ({
          id: item.id,
          title: item.title,
          collection_id: item.collection_id,
        }))}
        collections={allCollections}
        onMove={handleMoveToCollection}
        maxDepth={2}
      />

      {/* Delete Dialogs */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be moved to trash. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedIds.length} items to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              These items will be moved to trash. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const promises = selectedIds.map(id =>
                  fetch(`/api/recordings/${id}`, { method: 'DELETE' })
                );
                await Promise.allSettled(promises);
                setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
                setSelectedIds([]);
                setShowBulkDeleteDialog(false);
                toast({ description: `Moved ${selectedIds.length} items to trash` });
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteCollectionDialog} onOpenChange={setShowDeleteCollectionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{collectionToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the collection. Items in this collection will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCollection}>Cancel</AlertDialogCancel>
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
      <LibraryPageContent />
    </KeyboardShortcutsProvider>
  );
}
