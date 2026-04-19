'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, Search, Sparkles } from 'lucide-react';

import { Loader } from '@/app/components/ai-elements/loader';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/app/components/ai-elements/sources';
import { SearchInitialState, SearchNoResultsState } from '@/app/components/empty-states/SearchEmptyState';
import { KeyboardShortcutsProvider } from '@/app/components/keyboard-shortcuts/KeyboardShortcutsProvider';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  COMMON_SHORTCUTS,
  useKeyboardShortcuts,
} from '@/app/hooks/useKeyboardShortcuts';
import {
  SEARCH_UI_DEFAULT_MODE,
  SEARCH_UI_MODES,
  SearchUiMode,
  parseSearchUiMode,
} from '@/app/components/search/search-modes';
import { DocsModeResults } from '@/app/components/search/DocsModeResults';
import { SourcesModeResults } from '@/app/components/search/SourcesModeResults';
import type { SearchResultItem } from '@/app/components/search/search-result-types';
import { trackSearchQuery } from '@/lib/hooks/useEngagementTracking';
import { fadeIn } from '@/lib/utils/animations';

interface SearchApiResponse {
  data?: {
    results?: SearchResultItem[];
  };
  error?: {
    message?: string;
  };
}

interface GroupedSource {
  contentId: string;
  contentTitle: string;
  contentType: string;
  startTime?: number;
  bestSimilarity: number;
  matchCount: number;
  topSnippet: string;
}

function truncateText(value: string, maxLength = 260) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function buildLibraryHref(contentId: string, startTime?: number) {
  if (startTime === undefined) return `/library/${contentId}`;
  return `/library/${contentId}?t=${Math.floor(startTime)}`;
}

function groupResultsBySource(results: SearchResultItem[]): GroupedSource[] {
  const grouped = new Map<string, GroupedSource>();

  for (const result of results) {
    const existing = grouped.get(result.contentId);
    if (!existing) {
      grouped.set(result.contentId, {
        contentId: result.contentId,
        contentTitle: result.contentTitle || 'Untitled',
        contentType: result.contentType || 'content',
        startTime: result.metadata.startTime,
        bestSimilarity: result.similarity,
        matchCount: 1,
        topSnippet: result.chunkText,
      });
      continue;
    }

    existing.matchCount += 1;
    if (result.similarity > existing.bestSimilarity) {
      existing.bestSimilarity = result.similarity;
      existing.topSnippet = result.chunkText;
      existing.startTime = result.metadata.startTime;
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => b.bestSimilarity - a.bestSimilarity,
  );
}

function SearchPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initializedFromUrlRef = useRef(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchUiMode>(SEARCH_UI_DEFAULT_MODE);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const groupedSources = useMemo(() => groupResultsBySource(results), [results]);

  const syncUrlState = useCallback(
    (nextMode: SearchUiMode, nextQuery: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('mode', nextMode);

      const normalizedQuery = nextQuery.trim();
      if (normalizedQuery.length > 0) {
        params.set('q', normalizedQuery);
      } else {
        params.delete('q');
      }

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const performSearch = useCallback(async (searchQuery: string) => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setResults([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    trackSearchQuery(normalizedQuery);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: normalizedQuery,
          mode: 'hybrid',
          limit: 20,
          threshold: 0.7,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as SearchApiResponse;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            `Search failed with status ${response.status}`,
        );
      }

      const nextResults = payload.data?.results ?? [];
      setResults(nextResults);
      setHasSearched(true);
    } catch (searchError) {
      console.error('[SearchPage] search failed', searchError);
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Search failed. Please try again.',
      );
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    await performSearch(query);
    syncUrlState(mode, query);
  };

  const handleModeChange = (nextMode: SearchUiMode) => {
    setMode(nextMode);
    syncUrlState(nextMode, query);
  };

  useEffect(() => {
    if (initializedFromUrlRef.current) return;
    initializedFromUrlRef.current = true;

    const urlMode = parseSearchUiMode(searchParams.get('mode'));
    const urlQuery = searchParams.get('q')?.trim() ?? '';

    setMode(urlMode);
    setQuery(urlQuery);

    if (urlQuery) {
      void performSearch(urlQuery);
    }
  }, [performSearch, searchParams]);

  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.SEARCH,
      handler: () => searchInputRef.current?.focus(),
    },
    {
      key: '1',
      handler: () => handleModeChange('answer'),
      description: 'Switch to Answer mode',
    },
    {
      key: '2',
      handler: () => handleModeChange('docs'),
      description: 'Switch to Docs mode',
    },
    {
      key: '3',
      handler: () => handleModeChange('sources'),
      description: 'Switch to Sources mode',
    },
  ]);

  const answerMarkdown = useMemo(() => {
    if (groupedSources.length === 0) return '';

    const topSources = groupedSources.slice(0, 3);
    return topSources
      .map((source, index) => {
        const score = Math.round(source.bestSimilarity * 100);
        return `${index + 1}. **${source.contentTitle}** (${score}% match)\n\n${truncateText(source.topSnippet, 320)}`;
      })
      .join('\n\n');
  }, [groupedSources]);

  const modeMeta = SEARCH_UI_MODES.find((item) => item.mode === mode);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-heading-3 font-outfit">Search Workspace</h1>
        <p className="text-muted-foreground">
          One omnibox, three result modes. Ask for an answer, inspect docs, or
          browse source matches.
        </p>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask anything across your recordings and documents..."
              className="pl-10 pr-4 py-6 text-base"
            />
          </div>
          <Button type="submit" size="lg" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {SEARCH_UI_MODES.map((item) => (
          <Button
            key={item.mode}
            type="button"
            variant={mode === item.mode ? 'default' : 'outline'}
            onClick={() => handleModeChange(item.mode)}
            aria-pressed={mode === item.mode}
          >
            {item.label}
          </Button>
        ))}
        {modeMeta ? (
          <span className="text-sm text-muted-foreground ml-1">
            {modeMeta.description}
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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
        ) : results.length === 0 && hasSearched && query ? (
          <motion.div key="no-results" variants={fadeIn} initial="hidden" animate="show" exit="exit">
            <SearchNoResultsState
              query={query}
              onClearSearch={() => {
                setQuery('');
                setResults([]);
                setError(null);
                setHasSearched(false);
                syncUrlState(mode, '');
              }}
            />
          </motion.div>
        ) : results.length === 0 ? (
          <motion.div key="initial" variants={fadeIn} initial="hidden" animate="show" exit="exit">
            <SearchInitialState />
          </motion.div>
        ) : mode === 'answer' ? (
          <motion.div
            key="answer-mode"
            variants={fadeIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-4"
          >
            <section className="rounded-xl border bg-card/40 p-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Answer</h2>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{answerMarkdown}</ReactMarkdown>
              </div>
            </section>

            <Sources>
              <SourcesTrigger count={Math.min(groupedSources.length, 5)} />
              <SourcesContent>
                {groupedSources.slice(0, 5).map((source) => (
                  <Source
                    key={source.contentId}
                    href={buildLibraryHref(source.contentId, source.startTime)}
                    title={source.contentTitle}
                  />
                ))}
              </SourcesContent>
            </Sources>
          </motion.div>
        ) : mode === 'docs' ? (
          <DocsModeResults results={results} query={query} />
        ) : (
          <SourcesModeResults results={results} query={query} />
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
