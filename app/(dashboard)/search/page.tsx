'use client';

/**
 * Enhanced Search Page
 * Semantic search with Phase 8 advanced filtering
 *
 * New Features:
 * - Advanced filters (content type, tags, collections, date range)
 * - Filter chips showing active filters
 * - Favorites integration
 * - Tags display on results
 * - Collection breadcrumb
 * - Keyboard shortcuts
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Clock, FileText, Video, SlidersHorizontal, Bookmark, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import debounce from 'lodash/debounce';
import ReactMarkdown from 'react-markdown';

import { Loader } from '@/app/components/ai-elements/loader';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

import { staggerContainer, staggerItem, fadeIn } from '@/lib/utils/animations';
import { SearchNoResultsState, SearchInitialState } from '@/app/components/empty-states/SearchEmptyState';
import { SearchFilters, SearchFiltersState } from '@/app/components/search/SearchFilters';
import { SearchSuggestions } from '@/app/components/search/SearchSuggestions';
import { SavedSearches } from '@/app/components/search/SavedSearches';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';
import { TagFilter } from '@/app/components/tags/TagFilter';
import { TagBadge } from '@/app/components/tags/TagBadge';
import { FavoriteButton } from '@/app/components/favorites/FavoriteButton';
import { CollectionPicker } from '@/app/components/collections/CollectionPicker';
import { CollectionBreadcrumb } from '@/app/components/collections/CollectionBreadcrumb';
import { Collection } from '@/app/components/collections/CollectionTree';
import { DateRangePicker } from '@/app/components/filters/DateRangePicker';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/app/hooks/useKeyboardShortcuts';
import { ContentType } from '@/lib/types/database';
import { CONTENT_TYPE_EMOJI } from '@/lib/types/content';

interface SearchResult {
  id: string;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  similarity: number;
  metadata: {
    source: 'transcript' | 'document';
    transcriptId?: string;
    documentId?: string;
    chunkIndex?: number;
    startTime?: number;
    endTime?: number;
    tags?: Array<{ id: string; name: string; color: string }>;
    collectionId?: string;
    isFavorite?: boolean;
  };
  createdAt: string;
}

interface FilterState {
  contentTypes: ContentType[];
  tagIds: string[];
  collectionId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  favoritesOnly: boolean;
}

function SearchPageContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'vector' | 'hybrid'>('vector');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'transcript' | 'document'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'name'>('relevance');

  // Advanced filters state
  const [filters, setFilters] = useState<FilterState>({
    contentTypes: [],
    tagIds: [],
    collectionId: null,
    dateFrom: null,
    dateTo: null,
    favoritesOnly: false,
  });

  // Tags and collections
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch tags and collections
  useEffect(() => {
    fetchTags();
    fetchCollections();
  }, []);

  const handleSearch = useCallback(async (e?: React.FormEvent, overrideQuery?: string, overrideFilters?: FilterState) => {
    e?.preventDefault();

    // Use override values if provided, otherwise use state
    const searchQuery = overrideQuery ?? query;
    const searchFilters = overrideFilters ?? filters;

    if (!searchQuery.trim()) {
      // Clear results if query is empty
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          mode: searchMode,
          source: sourceFilter === 'all' ? undefined : sourceFilter,
          contentTypes: searchFilters.contentTypes.length > 0 ? searchFilters.contentTypes : undefined,
          dateFrom: searchFilters.dateFrom?.toISOString(),
          dateTo: searchFilters.dateTo?.toISOString(),
          tagIds: searchFilters.tagIds.length > 0 ? searchFilters.tagIds : undefined,
          collectionId: searchFilters.collectionId || undefined,
          favoritesOnly: searchFilters.favoritesOnly || undefined,
          limit: 20,
          threshold: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Search failed with status ${response.status}`);
      }

      const data = await response.json();
      let results = data.data.results;

      // Apply client-side sorting
      results = sortResults(results, sortBy);

      setResults(results);
      setError(null);
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Search failed. Please try again.';
      setError(errorMessage);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, filters, searchMode, sourceFilter, sortBy]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string, searchFilters: FilterState) => {
      if (searchQuery.trim()) {
        handleSearch(undefined, searchQuery, searchFilters);
      }
    }, 500),
    [handleSearch]
  );

  // Auto-search on query or filter changes
  useEffect(() => {
    if (query.trim()) {
      debouncedSearch(query, filters);
    }

    // Cleanup debounce on unmount
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, filters, debouncedSearch]);

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
      setCollections(data.data?.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  }

  const sortResults = (results: SearchResult[], sortBy: 'relevance' | 'date' | 'name') => {
    const sorted = [...results];
    switch (sortBy) {
      case 'relevance':
        return sorted.sort((a, b) => b.similarity - a.similarity);
      case 'date':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'name':
        return sorted.sort((a, b) => a.recordingTitle.localeCompare(b.recordingTitle));
      default:
        return sorted;
    }
  };

  const handleSelectSavedSearch = (savedSearch: any) => {
    setQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    handleSearch(undefined, savedSearch.query, savedSearch.filters);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.contentTypes.length > 0) count++;
    if (filters.tagIds.length > 0) count++;
    if (filters.collectionId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.favoritesOnly) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilters({
      contentTypes: [],
      tagIds: [],
      collectionId: null,
      dateFrom: null,
      dateTo: null,
      favoritesOnly: false,
    });
  };

  const removeContentTypeFilter = (type: ContentType) => {
    setFilters(prev => ({
      ...prev,
      contentTypes: prev.contentTypes.filter(t => t !== type),
    }));
  };

  const removeTagFilter = (tagId: string) => {
    setFilters(prev => ({
      ...prev,
      tagIds: prev.tagIds.filter(id => id !== tagId),
    }));
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Re-sort results when sortBy changes
  useEffect(() => {
    if (results.length > 0) {
      setResults(sortResults(results, sortBy));
    }
  }, [sortBy]);

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => [
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: 'f',
      handler: () => setFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly })),
      description: 'Toggle favorites filter',
    },
    {
      key: 'Escape',
      handler: () => {
        if (showFilters) {
          setShowFilters(false);
        } else if (showSuggestions) {
          setShowSuggestions(false);
        }
      },
      description: 'Close filters/suggestions',
      preventDefault: false,
    },
  ], [showFilters, showSuggestions, setFilters, setShowFilters, setShowSuggestions]);

  useKeyboardShortcuts(keyboardShortcuts);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const highlightText = (text: string, query: string) => {
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-warning/30 font-semibold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-normal mb-2">Search Recordings</h1>
        <p className="text-muted-foreground">
          Search across all your recordings using AI-powered semantic search
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for anything..."
              className="pl-10 pr-4 py-6 text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            size="lg"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Filter className="w-5 h-5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Advanced Filters</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Search Mode */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Search Mode
                  </label>
                  <Select value={searchMode} onValueChange={(v) => setSearchMode(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vector">Semantic (AI)</SelectItem>
                      <SelectItem value="hybrid">Hybrid (AI + Keywords)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Source Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Source
                  </label>
                  <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="transcript">Transcripts Only</SelectItem>
                      <SelectItem value="document">Documents Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Content Types */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Content Types
                  </label>
                  <div className="space-y-2">
                    {(['recording', 'video', 'audio', 'document', 'text'] as ContentType[]).map((type) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.contentTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                contentTypes: [...prev.contentTypes, type],
                              }));
                            } else {
                              removeContentTypeFilter(type);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{type}s</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Tags
                  </label>
                  <TagFilter
                    tags={availableTags}
                    selectedTags={filters.tagIds}
                    onSelectionChange={(ids) => setFilters(prev => ({ ...prev, tagIds: ids }))}
                    filterMode={tagFilterMode}
                    onFilterModeChange={setTagFilterMode}
                    showCounts={true}
                  />
                </div>

                {/* Collection Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Collection
                  </label>
                  <CollectionPicker
                    collections={collections}
                    selectedId={filters.collectionId}
                    onSelect={(id) => setFilters(prev => ({ ...prev, collectionId: id }))}
                    placeholder="All collections"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Date Range
                  </label>
                  <DateRangePicker
                    from={filters.dateFrom}
                    to={filters.dateTo}
                    onSelect={(range) => setFilters(prev => ({
                      ...prev,
                      dateFrom: range?.from || null,
                      dateTo: range?.to || null,
                    }))}
                  />
                </div>

                {/* Favorites Only */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.favoritesOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, favoritesOnly: e.target.checked }))}
                    className="rounded"
                  />
                  <Bookmark className="w-4 h-4" />
                  <span className="text-sm">Favorites only</span>
                </label>

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="w-full"
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filters Chips */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>

            {/* Content Type Filters */}
            {filters.contentTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1">
                <span>Type: {type}</span>
                <button
                  type="button"
                  onClick={() => removeContentTypeFilter(type)}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}

            {/* Tag Filters */}
            {filters.tagIds.map((tagId) => {
              const tag = availableTags.find(t => t.id === tagId);
              return tag ? (
                <TagBadge
                  key={tagId}
                  tag={tag}
                  onRemove={() => removeTagFilter(tagId)}
                  showRemoveButton
                />
              ) : null;
            })}

            {/* Collection Filter */}
            {filters.collectionId && (
              <Badge variant="secondary" className="gap-1">
                <span>Collection</span>
                <button
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, collectionId: null }))}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {/* Favorites Filter */}
            {filters.favoritesOnly && (
              <Badge variant="secondary" className="gap-1">
                <Bookmark className="w-3 h-3" />
                <span>Favorites</span>
                <button
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, favoritesOnly: false }))}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {/* Date Range Filter */}
            {(filters.dateFrom || filters.dateTo) && (
              <Badge variant="secondary" className="gap-1">
                <span>Date range</span>
                <button
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, dateFrom: null, dateTo: null }))}
                  className="hover:bg-black/10 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </form>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sort Options */}
      {results.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Most Relevant</SelectItem>
              <SelectItem value="date">Most Recent</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader size={48} className="text-primary mb-4" />
            <p className="text-muted-foreground">Searching your knowledge base...</p>
          </motion.div>
        ) : results.length > 0 ? (
          <motion.div
            key="search-results"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-4"
          >
            {results.map((result) => (
              <motion.div
                key={result.id}
                variants={staggerItem}
                className="border border-border rounded-lg p-5 transition-all hover:shadow-md"
              >
                {/* Result Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link
                      href={`/library/${result.recordingId}${
                        result.metadata.startTime
                          ? `?t=${Math.floor(result.metadata.startTime)}`
                          : ''
                      }`}
                      className="text-lg font-semibold text-primary hover:text-primary/80 hover:underline"
                    >
                      {result.recordingTitle}
                    </Link>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {result.metadata.source === 'transcript' ? (
                          <><Video className="w-4 h-4" /> Transcript</>
                        ) : (
                          <><FileText className="w-4 h-4" /> Document</>
                        )}
                      </span>
                      {result.metadata.startTime !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(result.metadata.startTime)}
                        </span>
                      )}
                      <span className="text-success font-medium">
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                  </div>

                  {/* Favorite Button */}
                  <FavoriteButton
                    recordingId={result.recordingId}
                    isFavorite={result.metadata.isFavorite || false}
                    size="sm"
                  />
                </div>

                {/* Result Text */}
                <div className="text-foreground leading-relaxed mb-3 prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1">
                  <ReactMarkdown
                    components={{
                      // Custom styling for markdown elements
                      p: ({ children }) => <p>{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>,
                      pre: ({ children }) => <pre className="bg-muted p-3 rounded-md overflow-x-auto">{children}</pre>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mt-3 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mt-2 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
                    }}
                  >
                    {result.chunkText}
                  </ReactMarkdown>
                </div>

                {/* Tags */}
                {result.metadata.tags && result.metadata.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {result.metadata.tags.map((tag) => (
                      <TagBadge key={tag.id} tag={tag} />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : query ? (
          <SearchNoResultsState
            query={query}
            onClearSearch={() => setQuery('')}
          />
        ) : (
          <SearchInitialState />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SearchPage() {
  return (
    <KeyboardShortcutsProvider>
      <SearchPageContent />
    </KeyboardShortcutsProvider>
  );
}
