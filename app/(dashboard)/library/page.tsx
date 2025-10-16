"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Grid3x3, List, Search, SlidersHorizontal, FileX2, Settings, Upload, Download, FolderOpen, Plus } from 'lucide-react';

import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { ContentGridSkeleton, ContentListSkeleton } from '@/app/components/skeletons/ContentCardSkeleton';
import { LibraryEmptyState } from '@/app/components/empty-states/LibraryEmptyState';
import { BulkActionsToolbar } from '@/app/components/library/BulkActionsToolbar';
import { BulkTagModal } from '@/app/components/library/BulkTagModal';
import { TagFilter } from '@/app/components/tags/TagFilter';
import { TagManager } from '@/app/components/tags/TagManager';
import { AdvancedFilters, FilterState } from '@/app/components/filters/AdvancedFilters';
import { FilterChips } from '@/app/components/filters/FilterChips';
import { CollectionTree, Collection } from '@/app/components/collections/CollectionTree';
import { CollectionBreadcrumb } from '@/app/components/collections/CollectionBreadcrumb';
import { CollectionManager } from '@/app/components/collections/CollectionManager';
import { CollectionPicker } from '@/app/components/collections/CollectionPicker';
import { FavoriteButton } from '@/app/components/favorites/FavoriteButton';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useToast } from '@/app/components/ui/use-toast';
import UploadModal from '@/app/components/upload/UploadModal';
import ExportModal from '@/app/components/library/ExportModal';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/app/hooks/useKeyboardShortcuts';

import { SelectableContentCard } from './components/SelectableContentCard';
import { ContentItem } from './components/ContentCard';
import { LibraryTable } from './components/LibraryTable';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/app/components/ui/pagination';

type ContentTypeFilter = 'all' | 'recording' | 'video' | 'audio' | 'document' | 'text';
type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'duration-asc' | 'duration-desc';
type ViewMode = 'grid' | 'list';
type QuickFilter = 'all' | 'today' | 'week' | 'month';

const ITEMS_PER_PAGE = 25;

/**
 * Enhanced Library Page Component
 * Unified content library with Phase 8 features
 *
 * New Features:
 * - Advanced filters (AdvancedFilters component)
 * - Collections tree sidebar
 * - Favorites integration
 * - Enhanced bulk actions with collections
 * - Keyboard shortcuts
 * - Filter persistence in URL
 * - Collection filtering
 */
function LibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { toast } = useToast();

  // State management
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/view state
  const [contentType, setContentType] = useState<ContentTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    contentTypes: [],
    statuses: [],
    dateRange: { from: null, to: null },
    favoritesOnly: false,
    hasTranscript: null,
    hasDocument: null,
  });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Tag filter state
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionSidebar, setShowCollectionSidebar] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Search input ref for keyboard shortcuts
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('library-view-mode') as ViewMode;
      const savedSortBy = localStorage.getItem('library-sort-by') as SortOption;
      const savedShowSidebar = localStorage.getItem('library-show-sidebar');
      if (savedViewMode) setViewMode(savedViewMode);
      if (savedSortBy) setSortBy(savedSortBy);
      if (savedShowSidebar !== null) setShowCollectionSidebar(savedShowSidebar === 'true');
    }

    // Load filters from URL params
    const typeParam = searchParams.get('type') as ContentTypeFilter;
    const collectionParam = searchParams.get('collection');
    const favoritesParam = searchParams.get('favorites');
    const searchParam = searchParams.get('q');

    if (typeParam) setContentType(typeParam);
    if (collectionParam) setSelectedCollectionId(collectionParam);
    if (favoritesParam === 'true') setAdvancedFilters(prev => ({ ...prev, favoritesOnly: true }));
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('library-view-mode', viewMode);
      localStorage.setItem('library-sort-by', sortBy);
      localStorage.setItem('library-show-sidebar', String(showCollectionSidebar));
    }
  }, [viewMode, sortBy, showCollectionSidebar]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (contentType !== 'all') params.set('type', contentType);
    if (selectedCollectionId) params.set('collection', selectedCollectionId);
    if (advancedFilters.favoritesOnly) params.set('favorites', 'true');
    if (searchQuery) params.set('q', searchQuery);

    const newUrl = params.toString() ? `?${params.toString()}` : '/library';
    router.replace(newUrl, { scroll: false });
  }, [contentType, selectedCollectionId, advancedFilters.favoritesOnly, searchQuery]);

  // Fetch content items, tags, and collections
  useEffect(() => {
    fetchItems();
    fetchTags();
    fetchCollections();
  }, []);

  // Filter and sort items when filters change
  useEffect(() => {
    let filtered = [...items];

    // Filter by content type (from tabs)
    if (contentType !== 'all') {
      filtered = filtered.filter(item => item.content_type === contentType);
    }

    // Filter by advanced filters content types
    if (advancedFilters.contentTypes.length > 0) {
      filtered = filtered.filter(item =>
        advancedFilters.contentTypes.includes(item.content_type as any)
      );
    }

    // Filter by status
    if (advancedFilters.statuses.length > 0) {
      filtered = filtered.filter(item =>
        advancedFilters.statuses.includes(item.status as any)
      );
    }

    // Filter by date range
    if (advancedFilters.dateRange.from || advancedFilters.dateRange.to) {
      filtered = filtered.filter(item => {
        const createdAt = new Date(item.created_at);
        if (advancedFilters.dateRange.from && createdAt < advancedFilters.dateRange.from) {
          return false;
        }
        if (advancedFilters.dateRange.to && createdAt > advancedFilters.dateRange.to) {
          return false;
        }
        return true;
      });
    }

    // Filter by favorites
    if (advancedFilters.favoritesOnly) {
      filtered = filtered.filter(item => (item as any).is_favorite === true);
    }

      filtered = filtered.filter(item => {
        const createdAt = new Date(item.created_at);
        switch (quickFilter) {
          case 'today':
            return createdAt >= today;
          case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return createdAt >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return createdAt >= monthAgo;
          }
          default:
            return true;
        }
      });

    // Filter by selected collection
    if (selectedCollectionId) {
      filtered = filtered.filter(item =>
        (item as any).collection_id === selectedCollectionId
      );
    }

    // Filter by selected tags
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
        filtered.sort((a, b) => {
          const nameA = a.title || a.original_filename || '';
          const nameB = b.title || b.original_filename || '';
          return nameA.localeCompare(nameB);
        });
        break;
      case 'name-desc':
        filtered.sort((a, b) => {
          const nameA = a.title || a.original_filename || '';
          const nameB = b.title || b.original_filename || '';
          return nameB.localeCompare(nameA);
        });
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

    setFilteredItems(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [items, contentType, sortBy, searchQuery, quickFilter, selectedTagIds, tagFilterMode, advancedFilters, selectedCollectionId]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = viewMode === 'list' ? filteredItems.slice(startIndex, endIndex) : filteredItems;

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

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

  async function fetchCollections() {
    try {
      const response = await fetch('/api/collections');
      if (!response.ok) throw new Error('Failed to fetch collections');

      const data = await response.json();
      setCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }

  async function fetchItems() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/library?limit=100');

      if (!response.ok) {
        throw new Error('Failed to fetch library items');
      }

      const result = await response.json();
      setItems(result.data?.data || []);
    } catch (err) {
      console.error('Error fetching library:', err);
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }

  // Action handlers
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      setItems(prev => prev.filter(item => item.id !== id));
      toast({
        description: 'Item deleted successfully',
      });
    } catch (err) {
      console.error('Delete failed:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete item',
      });
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
    // In list view, only select items on current page
    const itemsToSelect = viewMode === 'list' ? paginatedItems : filteredItems;
    setSelectedIds(checked ? itemsToSelect.map(item => item.id) : []);
  }, [filteredItems, paginatedItems, viewMode]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Bulk action handlers
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;

    try {
      const promises = selectedIds.map(id =>
        fetch(`/api/recordings/${id}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      if (successCount > 0) {
        toast({
          title: 'Items deleted',
          description: `Successfully deleted ${successCount} ${successCount === 1 ? 'item' : 'items'}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: 'Delete failed',
          description: 'Failed to delete selected items',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete items',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDownload = async () => {
    setShowExportModal(true);
  };

  const handleBulkAddToCollection = async () => {
    setShowCollectionPicker(true);
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      const response = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_ids: selectedIds }),
      });

      if (!response.ok) throw new Error('Failed to add to collection');

      toast({
        description: `Added ${selectedIds.length} items to collection`,
      });
      setShowCollectionPicker(false);
      setSelectedIds([]);
      fetchItems(); // Refresh to update collection associations
    } catch (error) {
      console.error('Failed to add to collection:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add items to collection',
      });
    }
  };

  // Filter handlers
  const handleRemoveFilter = (key: keyof FilterState, value?: string) => {
    const newFilters = { ...advancedFilters };

    if (key === 'contentTypes' && value) {
      newFilters.contentTypes = newFilters.contentTypes.filter(t => t !== value);
    } else if (key === 'statuses' && value) {
      newFilters.statuses = newFilters.statuses.filter(s => s !== value);
    } else if (key === 'dateRange') {
      newFilters.dateRange = { from: null, to: null };
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
      dateRange: { from: null, to: null },
      favoritesOnly: false,
      hasTranscript: null,
      hasDocument: null,
    });
    setSelectedTagIds([]);
    setSelectedCollectionId(null);
    setSearchQuery('');
    setQuickFilter('all');
  };

  // Collection handlers
  const handleCollectionSelect = (collection: Collection) => {
    setSelectedCollectionId(collection.id);
  };

  const handleCollectionNavigate = (collectionId: string | null) => {
    setSelectedCollectionId(collectionId);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.UPLOAD,
      handler: () => setShowUploadModal(true),
    },
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'f',
      handler: () => setAdvancedFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly })),
      description: 'Toggle favorites filter',
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
  ]);

  // Get counts for each content type
  const counts = useMemo(() => ({
    all: items.length,
    recording: items.filter(i => i.content_type === 'recording').length,
    video: items.filter(i => i.content_type === 'video').length,
    audio: items.filter(i => i.content_type === 'audio').length,
    document: items.filter(i => i.content_type === 'document').length,
    text: items.filter(i => i.content_type === 'text').length,
  }), [items]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Collections Sidebar */}
      {showCollectionSidebar && (
        <aside className="w-64 border-r bg-muted/10 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Collections
              </h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowCollectionManager(true)}
                title="New collection"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <CollectionTree
              collections={collections}
              selectedId={selectedCollectionId}
              onSelect={handleCollectionSelect}
              onCreateChild={(parentId) => {
                setShowCollectionManager(true);
              }}
            />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Library</h1>
                <p className="text-muted-foreground mt-1">
                  All your recordings, videos, audio, documents, and notes in one place
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCollectionSidebar(!showCollectionSidebar)}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {showCollectionSidebar ? 'Hide' : 'Show'} Collections
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTagManager(true)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Tags
                </Button>
                <Button onClick={() => setShowUploadModal(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            </div>

            {/* Collection breadcrumb */}
            {selectedCollectionId && (
              <CollectionBreadcrumb
                collections={collections}
                currentId={selectedCollectionId}
                onNavigate={handleCollectionNavigate}
              />
            )}

            {/* Filters and controls */}
            <div className="flex flex-col gap-4">
              {/* Content type tabs */}
              <Tabs value={contentType} onValueChange={(v) => setContentType(v as ContentTypeFilter)}>
                <TabsList>
                  <TabsTrigger value="all">
                    All {counts.all > 0 && `(${counts.all})`}
                  </TabsTrigger>
                  <TabsTrigger value="recording">
                    Recordings {counts.recording > 0 && `(${counts.recording})`}
                  </TabsTrigger>
                  <TabsTrigger value="video">
                    Videos {counts.video > 0 && `(${counts.video})`}
                  </TabsTrigger>
                  <TabsTrigger value="audio">
                    Audio {counts.audio > 0 && `(${counts.audio})`}
                  </TabsTrigger>
                  <TabsTrigger value="document">
                    Documents {counts.document > 0 && `(${counts.document})`}
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    Notes {counts.text > 0 && `(${counts.text})`}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Quick filters */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Quick filter:</span>
                <Button
                  variant={quickFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickFilter('all')}
                >
                  All Time
                </Button>
                <Button
                  variant={quickFilter === 'today' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickFilter('today')}
                >
                  Today
                </Button>
                <Button
                  variant={quickFilter === 'week' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickFilter('week')}
                >
                  This Week
                </Button>
                <Button
                  variant={quickFilter === 'month' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setQuickFilter('month')}
                >
                  This Month
                </Button>
              </div>

              {/* Search and controls row */}
              <div className="flex items-center gap-2 justify-between">
                {/* Left side: Select all checkbox */}
                <div className="flex items-center gap-3">
                  {filteredItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                      />
                      <span className="text-sm text-muted-foreground">
                        Select all
                      </span>
                    </div>
                  )}
                </div>

                {/* Right side: Search, filters, sort, and view controls */}
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search library..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Advanced Filters */}
                  <AdvancedFilters
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                  />

                  {/* Tag Filter */}
                  <TagFilter
                    tags={availableTags}
                    selectedTags={selectedTagIds}
                    onSelectionChange={setSelectedTagIds}
                    filterMode={tagFilterMode}
                    onFilterModeChange={setTagFilterMode}
                    showCounts={true}
                  />

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
                      <span className="sr-only">Grid view</span>
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-l-none"
                    >
                      <List className="h-4 w-4" />
                      <span className="sr-only">List view</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Filter chips */}
              <FilterChips
                filters={advancedFilters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearAllFilters}
              />
            </div>
          </div>

          {/* Content */}
          {loading ? (
            viewMode === 'grid' ? (
              <ContentGridSkeleton count={8} />
            ) : (
              <ContentListSkeleton count={8} />
            )
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Library</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => fetchItems()} variant="outline">
                Try Again
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            items.length === 0 && !searchQuery && contentType === 'all' ? (
              <LibraryEmptyState onUploadComplete={() => fetchItems()} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No items found' : `No ${contentType} items yet`}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : `Upload or create ${contentType} content to see it here`}
                </p>
                <div className="flex gap-3">
                  {searchQuery && (
                    <Button onClick={() => setSearchQuery('')} variant="outline">
                      Clear Search
                    </Button>
                  )}
                  {contentType !== 'all' && (
                    <Button onClick={() => setContentType('all')} variant="outline">
                      View All Content
                    </Button>
                  )}
                  <Button onClick={handleClearAllFilters} variant="outline">
                    Clear All Filters
                  </Button>
                </div>
              </div>
            )
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              <LibraryTable
                items={paginatedItems}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onDelete={handleDelete}
                onShare={handleShare}
                onDownload={handleDownload}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {getPageNumbers().map((page, index) => (
                        <PaginationItem key={`page-${index}`}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page as number)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
          )}
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onDelete={handleBulkDelete}
        onAddTags={() => setShowTagModal(true)}
        onDownload={handleBulkDownload}
        onAddToCollection={handleBulkAddToCollection}
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
        onOpenChange={setShowCollectionManager}
        collections={collections}
        onSave={async (data) => {
          try {
            const response = await fetch('/api/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Failed to create collection');
            await fetchCollections();
            toast({ description: 'Collection created successfully' });
          } catch (error) {
            console.error('Failed to create collection:', error);
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Failed to create collection',
            });
            throw error;
          }
        }}
      />

      {showCollectionPicker && (
        <Sheet open={showCollectionPicker} onOpenChange={setShowCollectionPicker}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add to Collection</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <CollectionPicker
                collections={collections}
                selectedId={null}
                onSelect={(id) => id && handleAddToCollection(id)}
                placeholder="Select a collection..."
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          fetchItems();
          setShowUploadModal(false);
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedItems={selectedIds}
        totalItems={items.length}
      />
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
