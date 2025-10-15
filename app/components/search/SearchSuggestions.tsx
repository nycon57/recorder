"use client"

import React, { useEffect, useState } from 'react';
import { Clock, TrendingUp, Hash } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  className?: string;
}

interface Suggestion {
  text: string;
  type: 'recent' | 'popular' | 'tag';
}

/**
 * SearchSuggestions Component
 * Shows autocomplete suggestions for search
 *
 * Features:
 * - Recent searches (from localStorage)
 * - Popular searches
 * - Tag suggestions
 * - Keyboard navigation
 * - Click to select
 *
 * Usage:
 * <SearchSuggestions
 *   query="meet"
 *   onSelect={(text) => setQuery(text)}
 * />
 */
export function SearchSuggestions({
  query,
  onSelect,
  className,
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Load recent searches from localStorage
  useEffect(() => {
    const recentSearches = getRecentSearches();
    const popularSearches = [
      'meeting notes',
      'product demo',
      'tutorial',
      'presentation',
      'code review',
    ];
    const tagSuggestions = [
      'meeting',
      'demo',
      'tutorial',
      'presentation',
      'documentation',
    ];

    // Filter based on query
    const queryLower = query.toLowerCase();
    const filteredRecent = recentSearches
      .filter(s => s.toLowerCase().includes(queryLower))
      .map(text => ({ text, type: 'recent' as const }));

    const filteredPopular = popularSearches
      .filter(s => s.toLowerCase().includes(queryLower))
      .map(text => ({ text, type: 'popular' as const }));

    const filteredTags = tagSuggestions
      .filter(s => s.toLowerCase().includes(queryLower))
      .map(text => ({ text: `#${text}`, type: 'tag' as const }));

    // Combine and limit results
    const allSuggestions = [
      ...filteredRecent.slice(0, 3),
      ...filteredPopular.slice(0, 3),
      ...filteredTags.slice(0, 3),
    ];

    setSuggestions(allSuggestions);
  }, [query]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSelect = (suggestion: string) => {
    onSelect(suggestion);
    // Save to recent searches
    saveRecentSearch(suggestion);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex].text);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex]);

  if (suggestions.length === 0 || !query) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute top-full left-0 right-0 mt-2 z-50',
        'bg-background border border-border rounded-lg shadow-lg',
        'max-h-80 overflow-y-auto',
        className
      )}
    >
      <div className="p-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.type}-${suggestion.text}`}
            type="button"
            onClick={() => handleSelect(suggestion.text)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm',
              'transition-colors text-left',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            )}
          >
            <SuggestionIcon type={suggestion.type} />
            <span className="flex-1">{suggestion.text}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {suggestion.type}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SuggestionIcon({ type }: { type: Suggestion['type'] }) {
  const icons = {
    recent: Clock,
    popular: TrendingUp,
    tag: Hash,
  };

  const Icon = icons[type];
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

// Helper functions for recent searches
const RECENT_SEARCHES_KEY = 'recent-searches';
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined') return;

  try {
    const recent = getRecentSearches();
    const filtered = recent.filter(s => s !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save recent search:', error);
  }
}
