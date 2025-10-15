'use client';

/**
 * Search Page
 *
 * Semantic search across all recordings with filtering options.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Clock, FileText, Video } from 'lucide-react';
import Link from 'next/link';
import { staggerContainer, staggerItem, fadeIn } from '@/lib/utils/animations';

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
  };
  createdAt: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'vector' | 'hybrid'>('vector');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'transcript' | 'document'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          mode: searchMode,
          source: sourceFilter === 'all' ? undefined : sourceFilter,
          limit: 20,
          threshold: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.data.results);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search Recordings</h1>
        <p className="text-muted-foreground">
          Search across all your recordings using AI-powered semantic search
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for anything..."
              className="w-full pl-10 pr-4 py-3 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 border border-input rounded-lg hover:bg-accent flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
              {/* Search Mode */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Search Mode
                </label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as 'vector' | 'hybrid')}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring"
                >
                  <option value="vector">Semantic (AI)</option>
                  <option value="hybrid">Hybrid (AI + Keywords)</option>
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Sources</option>
                  <option value="transcript">Transcripts Only</option>
                  <option value="document">Documents Only</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            key="search-results"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-4"
          >
            <motion.div
              className="text-sm text-muted-foreground mb-4"
              variants={fadeIn}
            >
              Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </motion.div>

            {results.map((result) => (
              <motion.div
                key={result.id}
                variants={staggerItem}
                className="border border-border rounded-lg p-5 transition-all"
                whileHover={{
                  borderColor: 'rgba(var(--primary), 0.5)',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                  y: -2,
                  transition: { duration: 0.2 },
                }}
              >
                {/* Result Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <Link
                      href={`/recordings/${result.recordingId}${
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
                </div>

                {/* Result Text */}
                <p className="text-foreground leading-relaxed">
                  {highlightText(result.chunkText, query)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Results */}
      {results.length === 0 && query && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-16 h-16 mx-auto mb-4 text-muted" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-2">Try different keywords or check your filters</p>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !query && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-16 h-16 mx-auto mb-4 text-muted" />
          <p className="text-lg font-medium">Start searching</p>
          <p className="text-sm mt-2">
            Enter a query to search across all your recordings
          </p>
        </div>
      )}
    </div>
  );
}
