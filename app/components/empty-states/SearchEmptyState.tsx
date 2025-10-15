'use client';

import { Search, FileSearch, Lightbulb, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

/**
 * SearchNoResultsState Component
 *
 * Displayed when search query returns no results
 *
 * Features:
 * - Helpful suggestions to refine search
 * - Quick actions to browse library
 * - Tips for better search results
 */
interface SearchNoResultsStateProps {
  query: string;
  onClearSearch?: () => void;
}

export function SearchNoResultsState({ query, onClearSearch }: SearchNoResultsStateProps) {
  const router = useRouter();

  return (
    <Card className="border-dashed border-2">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center rounded-full bg-muted p-6 mb-6">
          <FileSearch className="size-12 text-muted-foreground" />
        </div>

        {/* Heading */}
        <h3 className="text-2xl font-bold mb-2">
          No results found for "{query}"
        </h3>

        <p className="text-muted-foreground mb-8 max-w-md">
          We couldn't find any content matching your search. Try adjusting your query or browse your library.
        </p>

        {/* Search Tips */}
        <div className="w-full max-w-lg mb-8">
          <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <Lightbulb className="size-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-left space-y-2">
              <p className="font-semibold text-sm">Search Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Try different keywords or synonyms</li>
                <li>• Use broader terms for more results</li>
                <li>• Check your spelling</li>
                <li>• Try switching between semantic and hybrid search modes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            onClick={() => router.push('/library')}
            className="gap-2"
          >
            Browse Library
            <ArrowRight className="size-4" />
          </Button>
          {onClearSearch && (
            <Button
              size="lg"
              variant="outline"
              onClick={onClearSearch}
            >
              Clear Search
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * SearchInitialState Component
 *
 * Displayed when user hasn't performed a search yet
 *
 * Features:
 * - Welcoming message
 * - Quick tips on using search
 * - Examples of search queries
 */
export function SearchInitialState() {
  const router = useRouter();

  const exampleQueries = [
    'meeting notes',
    'product demo',
    'customer feedback',
    'project planning',
  ];

  return (
    <Card className="border-dashed border-2">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6 mb-6">
          <Search className="size-12 text-primary" />
        </div>

        {/* Heading */}
        <h3 className="text-2xl font-bold mb-2">
          Powerful AI Search
        </h3>

        <p className="text-muted-foreground mb-8 max-w-md">
          Search across all your recordings, transcripts, and documents using semantic AI search.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg text-left">
            <div className="inline-flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30 p-2 flex-shrink-0">
              <Search className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Semantic Search</h4>
              <p className="text-xs text-muted-foreground">
                Find content by meaning, not just keywords
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg text-left">
            <div className="inline-flex items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30 p-2 flex-shrink-0">
              <FileSearch className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Full Text Search</h4>
              <p className="text-xs text-muted-foreground">
                Search transcripts and documents instantly
              </p>
            </div>
          </div>
        </div>

        {/* Example Queries */}
        <div className="w-full max-w-lg">
          <p className="text-sm font-medium mb-3">Try searching for:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {exampleQueries.map((query) => (
              <button
                key={query}
                className="px-4 py-2 text-sm bg-muted hover:bg-accent rounded-full transition-colors"
                onClick={() => {
                  // This would trigger a search with the example query
                  // Implementation depends on parent component
                }}
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Browse Library CTA */}
        <div className="mt-8 pt-8 border-t w-full max-w-md">
          <Button
            variant="outline"
            onClick={() => router.push('/library')}
            className="gap-2"
          >
            Browse Library
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
