'use client';

import Link from 'next/link';
import { Clock, ExternalLink, FileText } from 'lucide-react';
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

interface DocsModeResultsProps {
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

export function DocsModeResults({ results, query }: DocsModeResultsProps) {
  return (
    <motion.div
      key="docs-mode"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      exit="exit"
      className="space-y-4"
    >
      {results.map((result) => {
        const href = buildSearchResultHref(result);
        const jumpLabel = getResultJumpLabel(result);
        const pageNumber = getResultPageNumber(result);
        const timestamp = getResultTimestamp(result);

        return (
          <motion.article key={result.id} variants={staggerItem} className="rounded-xl border p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-primary">{result.contentTitle || 'Untitled'}</h3>
              <Badge variant="secondary">
                {Math.round(result.similarity * 100)}% match
              </Badge>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 capitalize">
                {CONTENT_TYPE_EMOJI[result.contentType as keyof typeof CONTENT_TYPE_EMOJI]}
                <span>{result.contentType || 'content'}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <FileText className="h-3 w-3" />
                <span>{result.metadata.source === 'document' ? 'Document' : 'Transcript'}</span>
              </span>
              {pageNumber !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <span>{jumpLabel}</span>
                </span>
              ) : null}
              {timestamp !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Clock className="h-3 w-3" />
                  <span>{timestamp}</span>
                </span>
              ) : null}
            </div>

            <HighlightedSnippet text={result.chunkText} query={query} />

            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href={href} target="_blank" rel="noopener noreferrer">
                  Jump to {jumpLabel}
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.article>
        );
      })}
    </motion.div>
  );
}
