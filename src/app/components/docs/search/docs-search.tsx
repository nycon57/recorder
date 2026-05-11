'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import type { Audience } from '@/lib/docs';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';

import { useDocsSearch } from './docs-search-context';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchEntry {
  id: string;
  title: string;
  description: string;
  section: string;
  audience: Audience;
  tags?: string[];
}

interface IndexPayload {
  index: object;
  entries: SearchEntry[];
}

interface MiniSearchResult {
  id: string;
  score: number;
}

interface LoadedSearchIndex {
  indexPayload: IndexPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  miniSearch: any;
}

// ── Search index URL resolution ───────────────────────────────────────────────

function getIndexUrl(audience: Audience): string | null {
  // public.json is a static Next.js public asset — no auth needed
  if (audience === 'public') return '/docs/search/public.json';
  // org-admin and system-admin are served via the gated API route
  return `/api/docs/search/${audience}`;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * DocsSearch — ⌘K / Ctrl-K search dialog for the docs shell.
 *
 * Lazy-loads the MiniSearch index on first open (never in the initial bundle).
 * Reuses shadcn CommandDialog + CommandList primitives.
 *
 * See plan §10.
 */
export function DocsSearch() {
  const { isOpen, audience, close } = useDocsSearch();
  const { push } = useRouter();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);

  const {
    data: loadedIndex,
    isLoading: isLoadingIndex,
    error: loadError,
  } = useQuery<LoadedSearchIndex, Error>({
    queryKey: ['docs', 'search-index', audience],
    enabled: isOpen,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const url = getIndexUrl(audience);
      if (!url) {
        throw new Error('Search index is not available for this audience.');
      }

      const [payload, { default: MiniSearch }] = await Promise.all([
        fetch(url, { signal }).then((r) => {
          if (!r.ok) throw new Error(`Search index returned ${r.status}`);
          return r.json() as Promise<IndexPayload>;
        }),
        import('minisearch'),
      ]);

      return {
        indexPayload: payload,
        miniSearch: MiniSearch.loadJSON<SearchEntry>(
          JSON.stringify(payload.index),
          {
            idField: 'id',
            fields: ['title', 'description', 'bodyText', 'tags'],
            storeFields: [
              'id',
              'title',
              'description',
              'section',
              'audience',
              'tags',
            ],
            searchOptions: {
              boost: { title: 3, description: 1.5, bodyText: 1 },
              fuzzy: 0.2,
              prefix: true,
            },
          },
        ),
      };
    },
  });

  // ── Keyboard shortcut: ⌘K / Ctrl-K ──────────────────────────────────────

  const { open: openSearch } = useDocsSearch();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  // ── Search execution ──────────────────────────────────────────────────────

  const results = useMemo<SearchEntry[]>(() => {
    if (!loadedIndex?.miniSearch || !debouncedQuery.trim()) return [];

    const raw = loadedIndex.miniSearch.search(
      debouncedQuery,
    ) as MiniSearchResult[];
    const entryMap = new Map(
      loadedIndex.indexPayload.entries.map((e) => [e.id, e]),
    );

    return raw.slice(0, 12).flatMap((__item, __index, __array) => {
      const __mapped = entryMap.get(__item.id);
      return __mapped ? [__mapped] : [];
    }) as SearchEntry[];
  }, [debouncedQuery, loadedIndex]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (slug: string) => {
      close();
      setQuery('');
      startTransition(() => {
        push(`/docs/${slug}`);
      });
    },
    [close, push],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        close();
        setQuery('');
      }
    },
    [close],
  );

  const SECTION_LABEL: Record<string, string> = {};

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      aria-label="Search docs"
    >
      <CommandInput
        placeholder="Search docs…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search query"
      />

      <CommandList>
        {isLoadingIndex && (
          <div
            role="status"
            aria-live="polite"
            className="py-6 text-center text-sm text-[color:var(--docs-text-muted)]"
          >
            Loading index…
          </div>
        )}

        {loadError && !isLoadingIndex && (
          <div
            role="alert"
            className="py-6 text-center text-sm text-[color:var(--docs-text-muted)]"
          >
            Could not load search index.
          </div>
        )}

        {!isLoadingIndex && !loadError && debouncedQuery.trim() === '' && (
          <CommandEmpty>Start typing to search docs.</CommandEmpty>
        )}

        {!isLoadingIndex &&
          !loadError &&
          debouncedQuery.trim() !== '' &&
          results.length === 0 && (
            <CommandEmpty>
              No results for &ldquo;{debouncedQuery}&rdquo;.
            </CommandEmpty>
          )}

        {results.length > 0 && (
          <CommandGroup heading="Pages">
            {results.map((entry) => (
              <CommandItem
                key={entry.id}
                value={entry.id}
                onSelect={() => handleSelect(entry.id)}
                className="flex items-start gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-5 text-[color:var(--docs-text-primary)]">
                    {entry.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--docs-text-muted)]">
                    {entry.description}
                  </p>
                </div>
                <span className="ml-2 shrink-0 self-center rounded-sm border border-[color:var(--docs-border)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--docs-text-muted)]">
                  {SECTION_LABEL[entry.section] ?? entry.section}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
