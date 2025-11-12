'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Highlight {
  /**
   * Unique identifier for this highlight
   */
  id: string;

  /**
   * Text to highlight (will be matched in content)
   */
  text: string;

  /**
   * Optional relevance score
   */
  similarity?: number;
}

export interface HighlightableContentProps {
  /**
   * The content to display and highlight
   */
  content: string;

  /**
   * List of text snippets to highlight
   */
  highlights: Highlight[];

  /**
   * ID of the current highlight (receives different styling)
   */
  currentHighlightId?: string;

  /**
   * Whether highlights are visible
   */
  highlightsEnabled: boolean;

  /**
   * Callback to provide highlight element refs to parent
   */
  onHighlightRefs?: (refs: Map<string, HTMLElement>) => void;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Optional content type for specialized rendering
   */
  contentType?: 'text' | 'markdown';
}

/**
 * HighlightableContent Component
 *
 * Renders text content with highlighted sections based on citation chunks.
 * Supports:
 * - Multiple highlights with different visual states
 * - Current highlight (brighter, focused)
 * - Toggle highlight visibility
 * - Scroll to highlight via refs
 */
export function HighlightableContent({
  content,
  highlights,
  currentHighlightId,
  highlightsEnabled,
  onHighlightRefs,
  className,
  contentType = 'text',
}: HighlightableContentProps) {
  const highlightRefsMap = React.useRef<Map<string, HTMLElement>>(new Map());

  // Update parent with refs whenever highlights change
  React.useEffect(() => {
    if (onHighlightRefs && highlightRefsMap.current.size > 0) {
      onHighlightRefs(highlightRefsMap.current);
    }
  }, [highlights, onHighlightRefs]);

  /**
   * Strip markdown and formatting symbols for better matching
   */
  const stripFormatting = (text: string): string => {
    return text
      // Remove markdown headings (# ## ### etc)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown bold/italic (**text** or *text* or __text__ or _text_)
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove markdown links [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown code blocks ```code```
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove extra whitespace and normalize
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  /**
   * Find where normalized text appears in original content
   * Uses a simple fuzzy approach: finds the longest common substring
   */
  const findInOriginal = (
    originalContent: string,
    normalizedSearchText: string
  ): { start: number; end: number } | null => {
    const contentLower = originalContent.toLowerCase();

    // Try direct substring match first (fastest)
    const directIndex = contentLower.indexOf(normalizedSearchText);
    if (directIndex !== -1) {
      return {
        start: directIndex,
        end: directIndex + normalizedSearchText.length,
      };
    }

    // Try with first 100 characters (truncated search for long chunks)
    const truncatedSearch = normalizedSearchText.substring(0, Math.min(100, normalizedSearchText.length));
    const truncatedIndex = contentLower.indexOf(truncatedSearch);
    if (truncatedIndex !== -1) {
      // Found beginning, extend to full length or content end
      const estimatedEnd = Math.min(
        truncatedIndex + normalizedSearchText.length,
        originalContent.length
      );
      return {
        start: truncatedIndex,
        end: estimatedEnd,
      };
    }

    // Try word-by-word matching (more flexible)
    const searchWords = normalizedSearchText.split(' ').filter(w => w.length > 3); // Only significant words
    if (searchWords.length > 0) {
      const firstWord = searchWords[0];
      const wordIndex = contentLower.indexOf(firstWord);
      if (wordIndex !== -1) {
        // Found first significant word, estimate boundaries
        return {
          start: wordIndex,
          end: Math.min(wordIndex + normalizedSearchText.length, originalContent.length),
        };
      }
    }

    return null;
  };

  /**
   * Find all occurrences of highlight text in content
   * Returns array of {start, end, highlightId} for each match
   */
  const findMatches = React.useMemo(() => {
    console.log('[HighlightableContent] Finding matches:', {
      highlightsEnabled,
      highlightsCount: highlights.length,
      contentLength: content.length,
    });

    if (!highlightsEnabled || highlights.length === 0) {
      return [];
    }

    const matches: Array<{ start: number; end: number; highlightId: string }> = [];

    for (const highlight of highlights) {
      // Normalize search text (strip formatting and normalize whitespace)
      const normalizedSearchText = stripFormatting(highlight.text);

      console.log('[HighlightableContent] Searching for highlight:', {
        highlightId: highlight.id,
        searchTextPreview: normalizedSearchText.substring(0, 100),
        searchTextLength: normalizedSearchText.length,
        originalPreview: highlight.text.substring(0, 100),
      });

      // Find in original content
      const match = findInOriginal(content, normalizedSearchText);

      console.log('[HighlightableContent] Search result:', {
        highlightId: highlight.id,
        found: match !== null,
        start: match?.start,
        end: match?.end,
      });

      if (match) {
        matches.push({
          start: match.start,
          end: match.end,
          highlightId: highlight.id,
        });
      }
    }

    // Sort by start position
    matches.sort((a, b) => a.start - b.start);

    console.log('[HighlightableContent] Final matches:', {
      matchCount: matches.length,
      matches: matches.map((m) => ({
        highlightId: m.highlightId,
        start: m.start,
        end: m.end,
      })),
    });

    return matches;
  }, [content, highlights, highlightsEnabled]);

  /**
   * Render content with highlights
   */
  const renderHighlightedContent = () => {
    if (!highlightsEnabled || findMatches.length === 0) {
      return <pre className="whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>;
    }

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    findMatches.forEach((match, idx) => {
      // Add text before highlight
      if (match.start > lastIndex) {
        segments.push(
          <span key={`text-${idx}`}>
            {content.slice(lastIndex, match.start)}
          </span>
        );
      }

      // Add highlighted text
      const isCurrentHighlight = match.highlightId === currentHighlightId;
      segments.push(
        <mark
          key={`highlight-${match.highlightId}`}
          ref={(el) => {
            if (el) {
              highlightRefsMap.current.set(match.highlightId, el);
            }
          }}
          data-highlight-id={match.highlightId}
          className={cn(
            'rounded px-1 transition-colors',
            isCurrentHighlight
              ? 'bg-yellow-300/60 ring-2 ring-yellow-400 dark:bg-yellow-500/40 dark:ring-yellow-500'
              : 'bg-yellow-200/30 dark:bg-yellow-500/20'
          )}
        >
          {content.slice(match.start, match.end)}
        </mark>
      );

      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push(
        <span key="text-end">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return (
      <pre className="whitespace-pre-wrap font-sans leading-relaxed">
        {segments}
      </pre>
    );
  };

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      {renderHighlightedContent()}
    </div>
  );
}
