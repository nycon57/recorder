'use client';

import Link from 'next/link';
import { ExternalLink, FileText, Link2 } from 'lucide-react';
import { motion } from 'motion/react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import type { SearchResultItem } from '@/app/components/search/search-result-types';
import {
  buildSearchResultHref,
  getHighlightParts,
  getResultJumpLabel,
  getResultPageNumber,
  getResultTimestamp,
} from '@/app/components/search/search-result-utils';
import { CONTENT_TYPE_EMOJI } from '@/lib/types/content';
import { staggerContainer, staggerItem } from '@/lib/utils/animations';

interface SourcesModeResultsProps {
  results: SearchResultItem[];
  query: string;
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const parts = getHighlightParts(text, query);
  return (
    <p className="text-sm text-foreground/90 leading-relaxed">
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={`${part.text}-${index}`} className="rounded bg-warning/30 px-0.5 font-medium">
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function SourcesModeResults({ results, query }: SourcesModeResultsProps) {
  return (
    <motion.div
      key="sources-mode"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      exit="exit"
      className="space-y-3"
    >
      {results.map((result, index) => {
        const href = buildSearchResultHref(result);
        const jumpLabel = getResultJumpLabel(result);
        const pageNumber = getResultPageNumber(result);
        const timestamp = getResultTimestamp(result);

        return (
          <motion.article key={result.id} variants={staggerItem} className="rounded-xl border bg-card/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    #{index + 1}
                  </Badge>
                  <span className="text-sm font-medium truncate">{result.contentTitle || 'Untitled'}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 capitalize">
                    {CONTENT_TYPE_EMOJI[result.contentType as keyof typeof CONTENT_TYPE_EMOJI]}
                    <span>{result.contentType || 'content'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <FileText className="h-3 w-3" />
                    <span>{result.metadata.source === 'document' ? 'Document source' : 'Transcript source'}</span>
                  </span>
                  {pageNumber !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <span>Page {pageNumber}</span>
                    </span>
                  ) : null}
                  {timestamp !== null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <span>{timestamp}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <Button asChild size="sm" variant="outline">
                <Link href={href} target="_blank" rel="noopener noreferrer">
                  <Link2 className="mr-2 h-3.5 w-3.5" />
                  Jump to {jumpLabel}
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-3">
              <HighlightedSnippet text={result.chunkText} query={query} />
            </div>
          </motion.article>
        );
      })}
    </motion.div>
  );
}
