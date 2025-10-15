'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Table as TableIcon, Search, X, Filter } from 'lucide-react';

import RecordingCard from '@/app/components/RecordingCard';
import RecordingTableRow from '@/app/components/RecordingTableRow';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { staggerContainer, staggerContainerFast, fadeInUp } from '@/lib/utils/animations';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface DashboardClientProps {
  recordings: Recording[];
}

type ViewMode = 'grid' | 'table';
type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';
type StatusFilter = 'all' | 'uploaded' | 'transcribing' | 'transcribed' | 'completed' | 'error';

export default function DashboardClient({ recordings }: DashboardClientProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('dashboard-view');
    if (savedView === 'grid' || savedView === 'table') {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dashboard-view', mode);
  };

  // Filter and sort recordings
  const filteredRecordings = useMemo(() => {
    let filtered = [...recordings];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title?.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [recordings, searchQuery, statusFilter, sortBy]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (statusFilter !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [searchQuery, statusFilter, sortBy]);

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('newest');
  };

  return (
    <div>
      {/* Header with Search and Filters */}
      <div className="mb-8 space-y-4">
        {/* Top Row: Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recordings</h1>
            <p className="mt-2 text-muted-foreground">
              Manage and view your recorded content
            </p>
          </div>
          <Link
            href="/record"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition inline-flex items-center justify-center space-x-2 whitespace-nowrap"
          >
            <span className="text-xl">🎥</span>
            <span>New Recording</span>
          </Link>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="transcribing">Transcribing</SelectItem>
                <SelectItem value="transcribed">Transcribed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="title-asc">Title A-Z</SelectItem>
                <SelectItem value="title-desc">Title Z-A</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewChange('grid')}
                className="rounded-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewChange('table')}
                className="rounded-none"
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Active Filters Indicator */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-2">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Recordings Display */}
      {recordings.length === 0 ? (
        // No recordings at all
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No recordings yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Get started by creating your first recording
          </p>
          <Link
            href="/record"
            className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition space-x-2"
          >
            <span className="text-xl">🎥</span>
            <span>Create Recording</span>
          </Link>
        </div>
      ) : filteredRecordings.length === 0 ? (
        // No results from search/filters
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No results found
          </h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search or filters
          </p>
          <Button onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredRecordings.length} of {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </div>

          {/* Grid View */}
          <AnimatePresence mode="wait">
            {viewMode === 'grid' && (
              <motion.div
                key="grid-view"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                variants={staggerContainerFast}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                {filteredRecordings.map((recording, index) => (
                  <RecordingCard key={recording.id} recording={recording} index={index} />
                ))}
              </motion.div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <motion.div
                key="table-view"
                className="bg-card rounded-lg border border-border overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Thumbnail</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-48">Tags</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-24">Duration</TableHead>
                      <TableHead className="w-40">Created</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecordings.map((recording, index) => (
                      <RecordingTableRow key={recording.id} recording={recording} index={index} />
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
