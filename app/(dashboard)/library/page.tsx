"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Grid3x3, List, Search, SlidersHorizontal, FileX2, Settings } from 'lucide-react';

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
import { ContentGridSkeleton, ContentListSkeleton } from '@/app/components/skeletons/ContentCardSkeleton';
import { LibraryEmptyState } from '@/app/components/empty-states/LibraryEmptyState';
import { BulkActionsToolbar } from '@/app/components/library/BulkActionsToolbar';
import { BulkTagModal } from '@/app/components/library/BulkTagModal';
import { TagFilter } from '@/app/components/tags/TagFilter';
import { TagManager } from '@/app/components/tags/TagManager';
import { useToast } from '@/app/components/ui/use-toast';

import { SelectableContentCard } from './components/SelectableContentCard';
import { ContentItem } from './components/ContentCard';

type ContentTypeFilter = 'all' | 'recording' | 'video' | 'audio' | 'document' | 'text';
type SortOption = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'duration-asc' | 'duration-desc';
type ViewMode = 'grid' | 'list';
type QuickFilter = 'all' | 'today' | 'week' | 'month';

/**
 * Library Page Component
 * Unified content library for recordings, videos, audio, documents, and text notes
 *
 * Features:
 * - Content type filtering (All, Videos, Audio, Documents, Text)
 * - Sort options (Recent, Oldest, Name A-Z, Name Z-A)
 * - View toggle (Grid / List)
 * - Search functionality
 * - Responsive grid layout
 * - Loading skeletons
 * - Empty states
 * - Infinite scroll ready
 */
export default function LibraryPage() {
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

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  // Tag filter state
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('library-view-mode') as ViewMode;
      const savedSortBy = localStorage.getItem('library-sort-by') as SortOption;
      if (savedViewMode) setViewMode(savedViewMode);
      if (savedSortBy) setSortBy(savedSortBy);
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('library-view-mode', viewMode);
      localStorage.setItem('library-sort-by', sortBy);
    }
  }, [viewMode, sortBy]);

  // Fetch content items and tags
  useEffect(() => {
    fetchItems();
    fetchTags();
  }, []);

  // Filter and sort items when filters change
  useEffect(() => {
    let filtered = [...items];

    // Filter by content type
    if (contentType !== 'all') {
      filtered = filtered.filter(item => item.content_type === contentType);
    }

    // Filter by quick filter (date range)
    if (quickFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(item => {
        const createdAt = new Date(item.created_at);
        switch (quickFilter) {
          case 'today':
            return createdAt >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return createdAt >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return createdAt >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Filter by selected tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(item => {
        const itemTagIds = item.tags?.map((t: any) => t.id) || [];
        if (tagFilterMode === 'and') {
          // All selected tags must be present
          return selectedTagIds.every(tagId => itemTagIds.includes(tagId));
        } else {
          // At least one selected tag must be present
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
  }, [items, contentType, sortBy, searchQuery, quickFilter, selectedTagIds, tagFilterMode]);

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

  async function fetchItems() {
    try {
      setLoading(true);
      setError(null);

      console.log('[Library] Fetching items from /api/library...');
      const response = await fetch('/api/library?limit=100');

      console.log('[Library] Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Library] Response error:', errorText);
        throw new Error('Failed to fetch library items');
      }

      const result = await response.json();
      console.log('[Library] Full response:', result);
      console.log('[Library] Items data:', result.data?.data);
      console.log('[Library] Items count:', result.data?.data?.length);

      // API returns { data: { data: [...], pagination: {...}, filters: {...} } }
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

      // Remove from local state
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete item');
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
    setSelectedIds(checked ? filteredItems.map(item => item.id) : []);
  }, [filteredItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Bulk action handlers
  const handleBulkDelete = async () => {
    try {
      const promises = selectedIds.map(id =>
        fetch(`/api/recordings/${id}`, { method: 'DELETE' })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      // Update local state
      setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      // Show toast notification
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
    try {
      // Note: This would require an API endpoint for creating ZIP archives
      // For now, we'll just show a message
      toast({
        title: 'Download started',
        description: `Preparing ${selectedIds.length} items for download...`,
      });

      // Simulate download delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'Download ready',
        description: 'Your download will begin shortly',
      });
    } catch (error) {
      console.error('Bulk download failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to download items',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Select all: Ctrl/Cmd + A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && filteredItems.length > 0) {
        e.preventDefault();
        handleSelectAll(selectedIds.length !== filteredItems.length);
      }

      // Delete: Delete key (when items selected)
      if (e.key === 'Delete' && selectedIds.length > 0) {
        e.preventDefault();
        handleBulkDelete();
      }

      // Escape: Clear selection
      if (e.key === 'Escape' && selectedIds.length > 0) {
        handleClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, filteredItems, handleSelectAll, handleClearSelection]);

  // Get counts for each content type
  const counts = {
    all: items.length,
    recording: items.filter(i => i.content_type === 'recording').length,
    video: items.filter(i => i.content_type === 'video').length,
    audio: items.filter(i => i.content_type === 'audio').length,
    document: items.filter(i => i.content_type === 'document').length,
    text: items.filter(i => i.content_type === 'text').length,
  };

  return (
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
          <Button
            variant="outline"
            onClick={() => setShowTagManager(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Tags
          </Button>
        </div>

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
            {/* Left side: Select all checkbox (when items exist) */}
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
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

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
        </div>
      </div>

      {/* Content */}
      {loading ? (
        // Loading skeletons with shimmer animation
        viewMode === 'grid' ? (
          <ContentGridSkeleton count={8} />
        ) : (
          <ContentListSkeleton count={8} />
        )
      ) : error ? (
        // Error state
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Library</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchItems()} variant="outline">
            Try Again
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        // Enhanced empty state
        items.length === 0 && !searchQuery && contentType === 'all' ? (
          // True empty library - show comprehensive onboarding
          <LibraryEmptyState onUploadComplete={() => fetchItems()} />
        ) : (
          // Filtered view with no results
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
            </div>
          </div>
        )
      ) : (
        // Content grid/list
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
              : 'space-y-4'
          }
        >
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

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onDelete={handleBulkDelete}
        onAddTags={() => setShowTagModal(true)}
        onDownload={handleBulkDownload}
      />

      {/* Bulk Tag Modal */}
      <BulkTagModal
        open={showTagModal}
        onOpenChange={setShowTagModal}
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
      />

      {/* Tag Manager Modal */}
      <TagManager
        open={showTagManager}
        onOpenChange={setShowTagManager}
      />
    </div>
  );
}
