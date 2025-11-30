'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as motion from 'motion/react-client';
import { AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Clock,
  FileText,
  Video,
  SlidersHorizontal,
  Bookmark,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

/**
 * SearchDemo - Matches the real search page UI
 *
 * Bespoke component for the /features/search page.
 * Mirrors the actual product interface with:
 * - Search input with filters button
 * - Result cards with similarity scores, timestamps, tags
 * - Sort options (relevance, date, name)
 * - Filter chips for active filters
 */

interface SearchResult {
  id: string;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  similarity: number;
  source: 'transcript' | 'document';
  startTime?: number;
  createdAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
  isFavorite: boolean;
}

// Mock search data
const mockQueries = [
  {
    text: 'How do I set up the API integration?',
    results: [
      {
        id: '1',
        recordingId: 'rec-1',
        recordingTitle: 'API Integration Tutorial',
        chunkText:
          'To set up the API integration, first navigate to Settings and select the Integrations tab. From there, you can generate an API key and configure your webhook endpoints. Make sure to store your API key securely.',
        similarity: 0.94,
        source: 'transcript' as const,
        startTime: 125,
        createdAt: '2024-01-15T10:30:00Z',
        tags: [
          { id: 't1', name: 'Tutorial', color: '#00df82' },
          { id: 't2', name: 'API', color: '#2cc295' },
        ],
        isFavorite: true,
      },
      {
        id: '2',
        recordingId: 'rec-2',
        recordingTitle: 'Developer Onboarding - Day 1',
        chunkText:
          'The API uses REST endpoints with JSON payloads. Authentication is handled via Bearer tokens that you generate in the dashboard. All requests must include the Authorization header.',
        similarity: 0.87,
        source: 'document' as const,
        createdAt: '2024-01-10T14:00:00Z',
        tags: [{ id: 't3', name: 'Onboarding', color: '#6366f1' }],
        isFavorite: false,
      },
      {
        id: '3',
        recordingId: 'rec-3',
        recordingTitle: 'Tech Stack Overview',
        chunkText:
          'Our integration layer supports webhooks, REST APIs, and GraphQL. Choose the method that best fits your architecture. The SDK provides wrappers for common languages including JavaScript, Python, and Go.',
        similarity: 0.79,
        source: 'transcript' as const,
        startTime: 340,
        createdAt: '2024-01-08T09:15:00Z',
        tags: [],
        isFavorite: false,
      },
    ],
  },
  {
    text: 'What were the Q4 revenue numbers?',
    results: [
      {
        id: '4',
        recordingId: 'rec-4',
        recordingTitle: 'Q4 Financial Review',
        chunkText:
          'Q4 revenue came in at $2.4 million, representing a 34% increase year-over-year. The main growth drivers were enterprise subscriptions and our new API pricing tier.',
        similarity: 0.96,
        source: 'transcript' as const,
        startTime: 180,
        createdAt: '2024-01-20T11:00:00Z',
        tags: [
          { id: 't4', name: 'Finance', color: '#f59e0b' },
          { id: 't5', name: 'Q4', color: '#ef4444' },
        ],
        isFavorite: true,
      },
      {
        id: '5',
        recordingId: 'rec-5',
        recordingTitle: 'Board Meeting - January',
        chunkText:
          'Looking at the numbers, recurring revenue reached $1.8M monthly, with a net revenue retention of 115%. Churn remained stable at 2.1% monthly.',
        similarity: 0.82,
        source: 'document' as const,
        createdAt: '2024-01-22T15:30:00Z',
        tags: [{ id: 't4', name: 'Finance', color: '#f59e0b' }],
        isFavorite: false,
      },
    ],
  },
];

export function SearchDemo() {
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [displayedQuery, setDisplayedQuery] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [hoveredResult, setHoveredResult] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'name'>('relevance');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentQuery = mockQueries[activeQueryIndex];

  // Typewriter effect for query
  useEffect(() => {
    setIsTyping(true);
    setShowResults(false);
    setDisplayedQuery('');

    const query = currentQuery.text;
    let charIndex = 0;

    const typeInterval = setInterval(() => {
      if (charIndex < query.length) {
        setDisplayedQuery(query.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        setTimeout(() => setShowResults(true), 300);
      }
    }, 40);

    return () => clearInterval(typeInterval);
  }, [activeQueryIndex, currentQuery.text]);

  // Auto-switch queries
  useEffect(() => {
    const switchInterval = setInterval(() => {
      setActiveQueryIndex((prev) => (prev + 1) % mockQueries.length);
    }, 15000);

    return () => clearInterval(switchInterval);
  }, []);

  const switchQuery = useCallback(
    (index: number) => {
      if (index !== activeQueryIndex) {
        setActiveQueryIndex(index);
      }
    },
    [activeQueryIndex]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2
            w-[800px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_60%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-center mb-12"
          >
            <div
              className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full
                bg-accent/10 border border-accent/30"
            >
              <Search className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Semantic Search</span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Find by{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                meaning
              </span>
            </h3>
            <p className="text-muted-foreground">
              Ask questions in natural language, get instant answers
            </p>
          </motion.div>

          {/* Search Interface - Matches real search page */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
            className={cn(
              'relative rounded-3xl overflow-hidden',
              'bg-gradient-to-b from-card/80 to-card/60',
              'backdrop-blur-xl',
              'border border-accent/20',
              'shadow-[0_0_80px_rgba(0,223,130,0.15)]'
            )}
          >
            {/* Header */}
            <div className="p-6 border-b border-border/30">
              <h2 className="text-xl font-normal mb-1">Search Recordings</h2>
              <p className="text-sm text-muted-foreground">
                Search across all your recordings using AI-powered semantic search
              </p>
            </div>

            {/* Search Form - Exact match to real page */}
            <div className="p-6 border-b border-border/30">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    value={displayedQuery}
                    readOnly
                    placeholder="Search for anything..."
                    className="pl-10 pr-4 py-6 text-base"
                  />
                  {isTyping && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent"
                    />
                  )}
                </div>
                <Button size="lg" disabled={isTyping}>
                  {isTyping ? 'Searching...' : 'Search'}
                </Button>
                <Button variant="outline" size="lg" className="gap-2">
                  <Filter className="w-5 h-5" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Results */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {isTyping ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full mb-4"
                    />
                    <p className="text-muted-foreground">
                      Searching your knowledge base...
                    </p>
                  </motion.div>
                ) : showResults ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Results Header */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        Found{' '}
                        <span className="font-medium text-foreground">
                          {currentQuery.results.length}
                        </span>{' '}
                        result{currentQuery.results.length !== 1 ? 's' : ''} for "
                        {currentQuery.text}"
                      </p>
                      <Select
                        value={sortBy}
                        onValueChange={(v) => setSortBy(v as typeof sortBy)}
                      >
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

                    {/* Result Cards */}
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: { staggerChildren: 0.1 },
                        },
                      }}
                      className="space-y-4"
                    >
                      {currentQuery.results.map((result) => (
                        <motion.div
                          key={result.id}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          onMouseEnter={() => setHoveredResult(result.id)}
                          onMouseLeave={() => setHoveredResult(null)}
                          className={cn(
                            'border border-border rounded-lg p-5 transition-all cursor-pointer',
                            hoveredResult === result.id && 'shadow-md border-accent/30'
                          )}
                        >
                          {/* Result Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <span className="text-lg font-semibold text-primary hover:text-primary/80 hover:underline">
                                {result.recordingTitle}
                              </span>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {result.source === 'transcript' ? (
                                    <>
                                      <Video className="w-4 h-4" /> Transcript
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-4 h-4" /> Document
                                    </>
                                  )}
                                </span>
                                {result.startTime !== undefined && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatTime(result.startTime)}
                                  </span>
                                )}
                                <span className="text-accent font-medium">
                                  {Math.round(result.similarity * 100)}% match
                                </span>
                              </div>
                            </div>

                            {/* Favorite Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                'h-8 w-8 p-0',
                                result.isFavorite && 'text-yellow-500'
                              )}
                            >
                              <Bookmark
                                className={cn(
                                  'h-4 w-4',
                                  result.isFavorite && 'fill-current'
                                )}
                              />
                            </Button>
                          </div>

                          {/* Result Text */}
                          <p className="text-foreground leading-relaxed mb-3">
                            {result.chunkText}
                          </p>

                          {/* Tags */}
                          {result.tags.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.tags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="secondary"
                                  style={{ backgroundColor: `${tag.color}20` }}
                                  className="text-xs"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full mr-1.5"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Date */}
                          <div className="text-xs text-muted-foreground mt-2">
                            {formatDate(result.createdAt)}
                          </div>

                          {/* Hover Arrow */}
                          <motion.div
                            animate={{
                              x: hoveredResult === result.id ? 0 : -10,
                              opacity: hoveredResult === result.id ? 1 : 0,
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-accent"
                          >
                            <ArrowRight className="h-5 w-5" />
                          </motion.div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Query Switcher */}
            <div
              className={cn(
                'flex items-center justify-center gap-3 px-6 py-4',
                'border-t border-border/30',
                'bg-gradient-to-r from-accent/5 via-transparent to-secondary/5'
              )}
            >
              <span className="text-xs text-muted-foreground mr-2">Try:</span>
              {mockQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => switchQuery(index)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium',
                    'transition-all duration-300',
                    activeQueryIndex === index
                      ? 'bg-accent text-accent-foreground shadow-[0_0_15px_rgba(0,223,130,0.4)]'
                      : 'bg-background/50 text-muted-foreground hover:text-foreground hover:bg-background/80'
                  )}
                >
                  Query {index + 1}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            Click results to jump to exact moments · Filter by type, date, or tags
          </motion.p>
        </div>
      </div>
    </section>
  );
}
