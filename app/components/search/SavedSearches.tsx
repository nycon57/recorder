"use client"

import React, { useState, useEffect } from 'react';
import { Bookmark, Trash2, Plus } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/lib/utils';

import type { SearchFiltersState } from './SearchFilters';

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFiltersState;
  createdAt: string;
}

interface SavedSearchesProps {
  onSelect: (search: SavedSearch) => void;
  currentQuery: string;
  currentFilters: SearchFiltersState;
  className?: string;
}

/**
 * SavedSearches Component
 * Manage and quickly access saved search configurations
 *
 * Features:
 * - Save current search + filters
 * - Quick access to saved searches
 * - Delete saved searches
 * - Persist to localStorage
 *
 * Usage:
 * <SavedSearches
 *   onSelect={(search) => applySearch(search)}
 *   currentQuery={query}
 *   currentFilters={filters}
 * />
 */
export function SavedSearches({
  onSelect,
  currentQuery,
  currentFilters,
  className,
}: SavedSearchesProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');

  // Load saved searches from localStorage
  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = () => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('saved-searches');
      if (stored) {
        setSavedSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const saveToPersistence = (searches: SavedSearch[]) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('saved-searches', JSON.stringify(searches));
    } catch (error) {
      console.error('Failed to save searches:', error);
    }
  };

  const handleSaveSearch = () => {
    if (!newSearchName.trim()) return;

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: newSearchName.trim(),
      query: currentQuery,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedSearches, newSearch];
    setSavedSearches(updated);
    saveToPersistence(updated);

    // Reset and close
    setNewSearchName('');
    setShowSaveDialog(false);
  };

  const handleDeleteSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    saveToPersistence(updated);
  };

  const hasActiveSearch =
    currentQuery.trim() !== '' ||
    currentFilters.contentTypes.length > 0 ||
    currentFilters.tags.length > 0 ||
    currentFilters.status.length > 0 ||
    currentFilters.dateRange.from !== undefined;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with save button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Saved Searches</span>
        </div>

        {hasActiveSearch && (
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7">
                <Plus className="h-3 w-3 mr-1" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save Search</DialogTitle>
                <DialogDescription>
                  Save this search configuration for quick access later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="search-name">Name</Label>
                  <Input
                    id="search-name"
                    placeholder="e.g., Meeting recordings this week"
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveSearch();
                      }
                    }}
                  />
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="p-3 border border-border rounded-md bg-muted/50 space-y-2">
                    {currentQuery && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Query: </span>
                        <span className="font-medium">{currentQuery}</span>
                      </div>
                    )}
                    {currentFilters.contentTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {currentFilters.contentTypes.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSearch}
                  disabled={!newSearchName.trim()}
                >
                  Save Search
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Saved searches list */}
      {savedSearches.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
          No saved searches yet
        </div>
      ) : (
        <div className="space-y-2">
          {savedSearches.map((search) => (
            <div
              key={search.id}
              className="group flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <button
                onClick={() => onSelect(search)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-sm">{search.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {search.query && (
                    <span className="mr-2">"{search.query}"</span>
                  )}
                  {search.filters.contentTypes.length > 0 && (
                    <Badge variant="outline" className="text-xs mr-1">
                      {search.filters.contentTypes.length} types
                    </Badge>
                  )}
                </div>
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteSearch(search.id)}
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
