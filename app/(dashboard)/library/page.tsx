"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Grid3x3, List, Search, SlidersHorizontal, FileX2, Settings, Upload, Download, FolderOpen, Plus, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
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
import { TagFilter } from '@/app/components/tags/TagFilter';
import { TagManager } from '@/app/components/tags/TagManager';
import { AdvancedFilters, FilterState, StatusFilter } from '@/app/components/filters/AdvancedFilters';
import { FilterChips } from '@/app/components/filters/FilterChips';
import { CollectionTree, Collection } from '@/app/components/collections/CollectionTree';
import { CollectionBreadcrumb } from '@/app/components/collections/CollectionBreadcrumb';
import { CollectionManager } from '@/app/components/collections/CollectionManager';
import { CollectionPicker } from '@/app/components/collections/CollectionPicker';
import { FavoriteButton } from '@/app/components/favorites/FavoriteButton';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useToast } from '@/app/components/ui/use-toast';
import UploadWizard from '@/app/components/recorder/UploadWizard';
import ExportModal from '@/app/components/library/ExportModal';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/app/hooks/useKeyboardShortcuts';

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

/**
 * Enhanced Library Page Component
 * Unified content library with Phase 8 features
 *
 * Features:
 * - Advanced filters with content type, favorites, transcript, document filtering
 * - Collections tree sidebar
 * - Favorites integration
 * - Enhanced bulk actions with collections
 * - Keyboard shortcuts
 * - Filter persistence in URL
 * - Tag filtering with AND/OR modes
 * - Grid and list view modes
 * - Pagination for list view
 */
function LibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { toast } = useToast();

  // State management
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
    statuses: [], // Still needed for FilterState interface compatibility
    statusFilter: 'active', // Default to active items
    dateRange: { from: null, to: null }, // Still needed for FilterState interface compatibility
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
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Tag filter state
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionSidebar, setShowCollectionSidebar] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [showDeleteCollectionDialog, setShowDeleteCollectionDialog] = useState(false);
  const [isDeletingCollection, setIsDeletingCollection] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Track if we're on mobile (for Sheet vs desktop sidebar)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024); // lg breakpoint
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    const collectionParam = searchParams.get('collection');
    const favoritesParam = searchParams.get('favorites');
    const searchParam = searchParams.get('q');

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
    if (selectedCollectionId) params.set('collection', selectedCollectionId);
    if (advancedFilters.favoritesOnly) params.set('favorites', 'true');
    if (searchQuery) params.set('q', searchQuery);

    const newUrl = params.toString() ? `?${params.toString()}` : '/library';
    router.replace(newUrl, { scroll: false });
  }, [selectedCollectionId, advancedFilters.favoritesOnly, searchQuery, router]);

  // Fetch content items, tags, and collections
  useEffect(() => {
    fetchItems();
    fetchTags();
    fetchCollections();
  }, [advancedFilters.statusFilter]);

  // Clear selection when changing status filter
  useEffect(() => {
    setSelectedIds([]);
  }, [advancedFilters.statusFilter]);

  // ✅ Compute filtered and sorted items during render (no Effect needed)
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by advanced filters content types
    if (advancedFilters.contentTypes.length > 0) {
      filtered = filtered.filter(item =>
        advancedFilters.contentTypes.includes(item.content_type as any)
      );
    }

    // Filter by favorites
    if (advancedFilters.favoritesOnly) {
      filtered = filtered.filter(item => (item as any).is_favorite === true);
    }

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

    return filtered;
  }, [items, sortBy, searchQuery, selectedTagIds, tagFilterMode, advancedFilters, selectedCollectionId]);

  // ✅ Separate Effect for pagination reset (legitimate side effect)
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, searchQuery, selectedTagIds, tagFilterMode, advancedFilters, selectedCollectionId]);

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

      const response = await fetch(`/api/library?limit=100&view=${advancedFilters.statusFilter}`);

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
        description: 'Item moved to trash. You can restore it from the trash page.',
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
    // In list view, only select items on current page
    const itemsToSelect = viewMode === 'list' ? paginatedItems : filteredItems;
    setSelectedIds(checked ? itemsToSelect.map(item => item.id) : []);
  }, [filteredItems, paginatedItems, viewMode]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Bulk action handlers
  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = async () => {
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
          title: 'Items moved to trash',
          description: `Successfully moved ${successCount} ${successCount === 1 ? 'item' : 'items'} to trash${failCount > 0 ? `, ${failCount} failed` : ''}. You can restore them from the trash page.`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: 'Move to trash failed',
          description: 'Failed to move selected items to trash',
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
    } finally {
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkRestore = async () => {
    try {
      const promises = selectedIds.map(id =>
        fetch(`/api/recordings/${id}/restore`, { method: 'POST' })
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      // Remove restored items from current view
      setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      if (successCount > 0) {
        toast({
          title: 'Items restored',
          description: `Successfully restored ${successCount} ${successCount === 1 ? 'item' : 'items'}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: 'Restore failed',
          description: 'Failed to restore selected items',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Bulk restore failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore items',
        variant: 'destructive',
      });
    }
  };

  const confirmBulkPermanentDelete = async () => {
    console.log('[Library Page] confirmBulkPermanentDelete called');
    console.log('[Library Page] Selected IDs:', selectedIds);
    console.log('[Library Page] Number of items to delete:', selectedIds.length);

    try {
      const promises = selectedIds.map(async id => {
        const url = `/api/recordings/${id}?permanent=true`;
        console.log(`[Library Page] Deleting item ${id} with URL: ${url}`);
        const response = await fetch(url, { method: 'DELETE' });

        console.log(`[Library Page] Response for ${id}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        const responseData = await response.json();
        console.log(`[Library Page] Response data for ${id}:`, responseData);

        if (!response.ok) {
          console.error(`[Library Page] Delete failed for ${id}:`, responseData);
          throw new Error(responseData.error?.message || 'Delete failed');
        }

        return { id, success: true, response: responseData };
      });

      console.log('[Library Page] Waiting for all delete requests...');
      const results = await Promise.allSettled(promises);

      console.log('[Library Page] Delete results:', results);
      const successful = results.filter((r): r is PromiseFulfilledResult<{ id: string; success: boolean; response: any }> => r.status === 'fulfilled').map(r => r.value);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason);
      console.log(`[Library Page] Successful deletions (${successful.length}):`, successful);
      console.log(`[Library Page] Failed deletions (${failed.length}):`, failed);

      const successCount = successful.length;
      const failCount = failed.length;
      console.log(`[Library Page] Success: ${successCount}, Failed: ${failCount}`);

      setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      if (successCount > 0) {
        toast({
          title: 'Items permanently deleted',
          description: `Permanently deleted ${successCount} ${successCount === 1 ? 'item' : 'items'}${failCount > 0 ? `, ${failCount} failed` : ''}. This action cannot be undone.`,
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
      console.error('Bulk permanent delete failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to permanently delete items',
        variant: 'destructive',
      });
    } finally {
      setShowPermanentDeleteDialog(false);
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
    const resetFilters: FilterState = {
      contentTypes: [],
      statuses: [],
      statusFilter: 'active',
      dateRange: { from: null, to: null },
      favoritesOnly: false,
      hasTranscript: null,
      hasDocument: null,
    };
    setAdvancedFilters(resetFilters);
    setSelectedTagIds([]);
    setSelectedCollectionId(null);
    setSearchQuery('');
  };

  // Collection handlers
  const handleCollectionSelect = (collection: Collection) => {
    setSelectedCollectionId(collection.id);
  };

  const handleCollectionNavigate = (collectionId: string | null) => {
    setSelectedCollectionId(collectionId);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setShowCollectionManager(true);
  };

  const handleDeleteCollection = (collection: Collection) => {
    setCollectionToDelete(collection);
    setShowDeleteCollectionDialog(true);
  };

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

      // If deleted collection was selected, clear selection
      if (selectedCollectionId === collectionToDelete.id) {
        setSelectedCollectionId(null);
      }

      await fetchCollections();
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Collections Sidebar - Desktop only, Sheet on mobile */}
      {/* Desktop Sidebar */}
      <AnimatePresence initial={false}>
        {showCollectionSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
            className="hidden lg:block border-r bg-muted/10 overflow-hidden"
          >
            <div className="w-64 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Collections
                </h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCollectionManager(true);
                  }}
                  title="New collection"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <CollectionTree
                collections={collections}
                selectedId={selectedCollectionId}
                onSelect={handleCollectionSelect}
                onCreateChild={() => {
                  setEditingCollection(null);
                  setShowCollectionManager(true);
                }}
                onEdit={handleEditCollection}
                onDelete={handleDeleteCollection}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Sheet - Only open on mobile to avoid conflicts with desktop sidebar */}
      {isMobile && (
        <Sheet open={showCollectionSidebar} onOpenChange={(open) => {
          // Only close if not opening another modal (prevents Dialog from closing Sheet)
          if (open || !showCollectionManager) {
            setShowCollectionSidebar(open);
          }
        }}>
          <SheetContent side="left" className="w-[280px] p-4" hideOverlay={true}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Collections
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowCollectionManager(true);
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Collection
            </Button>
            <CollectionTree
              collections={collections}
              selectedId={selectedCollectionId}
              onSelect={(collection) => {
                handleCollectionSelect(collection);
                setShowCollectionSidebar(false);
              }}
              onCreateChild={() => {
                setEditingCollection(null);
                setShowCollectionManager(true);
              }}
              onEdit={handleEditCollection}
              onDelete={handleDeleteCollection}
            />
          </div>
        </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex-1 overflow-y-auto"
      >
        <div className="container mx-auto p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-6">
            {/* Title/Description and Action Buttons Row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              {/* Left: Title and description */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-normal tracking-tight">Library</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  All your recordings, videos, audio, documents, and notes in one place
                </p>
              </div>

              {/* Right: Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setShowCollectionSidebar(!showCollectionSidebar)}
                  className="w-full sm:w-auto justify-start sm:justify-center min-h-[44px]"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{showCollectionSidebar ? 'Hide' : 'Show'} Collections</span>
                  <span className="sm:hidden">Collections</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTagManager(true)}
                  className="w-full sm:w-auto justify-start sm:justify-center min-h-[44px]"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Manage Tags</span>
                  <span className="sm:hidden">Tags</span>
                </Button>
                <Button
                  onClick={() => setShowUploadWizard(true)}
                  className="w-full sm:w-auto justify-start sm:justify-center min-h-[44px]"
                >
                  <Upload className="h-4 w-4 mr-2" />
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

            {/* Filters and controls - Mobile stacked, Desktop single line */}
            <div className="flex flex-col gap-4">
              {/* Mobile/Tablet: Stacked layout */}
              <div className="flex flex-col gap-4 lg:hidden">
                {/* Row 1: Select all checkbox */}
                {filteredItems.length > 0 && (
                  <div className="flex items-center gap-2 min-h-[44px]">
                    <Checkbox
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                      className="min-h-[44px] min-w-[44px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      Select all
                    </span>
                  </div>
                )}

                {/* Row 2: Search */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full min-h-[44px]"
                  />
                </div>

                {/* Row 3: Filters - stack on mobile, wrap on tablet */}
                <div className="flex flex-wrap gap-2">
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

                {/* Row 4: Sort and View - horizontal with wrap */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-full xs:w-auto xs:min-w-[180px] min-h-[44px]">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
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

                  <div className="flex items-center border rounded-md min-h-[44px] flex-shrink-0">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="rounded-r-none min-h-[44px] min-w-[44px]"
                      aria-label="Grid view"
                      aria-pressed={viewMode === 'grid'}
                    >
                      <Grid3x3 className="h-4 w-4" />
                      <span className="ml-2 sm:hidden">Grid</span>
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-l-none min-h-[44px] min-w-[44px]"
                      aria-label="List view"
                      aria-pressed={viewMode === 'list'}
                    >
                      <List className="h-4 w-4" />
                      <span className="ml-2 sm:hidden">List</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desktop: Single line layout */}
              <div className="hidden lg:flex items-center gap-6 justify-between">
                {/* Group 1: Select all checkbox */}
                <div className="flex items-center">
                  {filteredItems.length > 0 && (
                    <div className="flex items-center gap-3">
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

                {/* Groups 2 & 3: Search, filters, sort, and view controls */}
                <div className="flex items-center gap-5">
                  {/* Group 2: Search and filters */}
                  <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative w-72">
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
                  </div>

                  {/* Group 3: Sort and view toggle (with visual separator) */}
                  <div className="flex items-center gap-4 border-l pl-6 ml-1">
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
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <FileX2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">Error Loading Library</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">{error}</p>
              <Button onClick={() => fetchItems()} variant="outline" className="min-h-[44px]">
                Try Again
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            items.length === 0 && !searchQuery && advancedFilters.contentTypes.length === 0 ? (
              <LibraryEmptyState onUploadComplete={() => fetchItems()} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <FileX2 className="h-12 w-12 text-muted-foreground mb-6" />
                <h3 className="text-base sm:text-lg font-semibold mb-3">No items found</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                  Try adjusting your search or filters
                </p>
                <div className="flex flex-col xs:flex-row gap-3 w-full xs:w-auto">
                  {searchQuery && (
                    <Button
                      onClick={() => setSearchQuery('')}
                      variant="outline"
                      className="min-h-[44px] w-full xs:w-auto"
                    >
                      Clear Search
                    </Button>
                  )}
                  <Button
                    onClick={handleClearAllFilters}
                    variant="outline"
                    className="min-h-[44px] w-full xs:w-auto"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            )
          ) : viewMode === 'list' ? (
            <div className="space-y-6">
              {/* Table wrapper with horizontal scroll on mobile */}
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

              {/* Pagination - responsive */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between pt-2">
                  <p className="text-sm text-muted-foreground text-center sm:text-left">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
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

                      {/* Show fewer page numbers on mobile */}
                      {getPageNumbers().map((page, index) => (
                        <PaginationItem key={`page-${index}`} className="hidden xs:inline-flex">
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page as number)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                              {...({} as any)}
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      {/* Current page indicator on mobile */}
                      <PaginationItem className="xs:hidden">
                        <span className="px-4 text-sm">
                          {currentPage} / {totalPages}
                        </span>
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
            // Grid view - responsive: 1 col mobile, 2 col tablet, 3 col desktop (max)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 auto-rows-fr w-full">
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
      </motion.div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.length}
        onClearSelection={handleClearSelection}
        onDelete={confirmBulkDelete}
        onRestore={advancedFilters.statusFilter === 'trash' ? handleBulkRestore : undefined}
        onPermanentDelete={advancedFilters.statusFilter === 'trash' ? confirmBulkPermanentDelete : undefined}
        onAddTags={advancedFilters.statusFilter !== 'trash' ? () => setShowTagModal(true) : undefined}
        onDownload={handleBulkDownload}
        onAddToCollection={advancedFilters.statusFilter !== 'trash' ? handleBulkAddToCollection : undefined}
        mode={advancedFilters.statusFilter === 'trash' ? 'trash' : 'active'}
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
        collections={collections}
        modal={false}
        onSave={async (data) => {
          try {
            const isEditing = !!editingCollection;
            const url = isEditing
              ? `/api/collections/${editingCollection.id}`
              : '/api/collections';
            const method = isEditing ? 'PATCH' : 'POST';

            const response = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error('Failed to save collection');

            await fetchCollections();
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

      <UploadWizard
        open={showUploadWizard}
        onClose={() => {
          fetchItems();
          setShowUploadWizard(false);
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedItems={selectedIds}
        totalItems={items.length}
      />

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be moved to trash. You can restore it later from the trash page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 text-white hover:bg-red-600">
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
              These items will be moved to trash. You can restore them later from the trash page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-red-500 text-white hover:bg-red-600">
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {selectedIds.length} items?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div className="font-semibold text-red-500">This action cannot be undone!</div>
                <div>These items will be permanently deleted from the system and cannot be recovered.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkPermanentDelete} className="bg-red-500 text-white hover:bg-red-600">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Collection Delete Confirmation */}
      <AlertDialog open={showDeleteCollectionDialog} onOpenChange={setShowDeleteCollectionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{collectionToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the collection. Items in this collection will not be deleted,
              but they will no longer be in this collection.
              {collectionToDelete?.item_count && collectionToDelete.item_count > 0 && (
                <span className="block mt-2 font-medium">
                  This collection contains {collectionToDelete.item_count} items.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCollection}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCollection}
              disabled={isDeletingCollection}
              className="bg-red-500 text-white hover:bg-red-600"
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
