import type { SearchResultItem } from './search-result-types';
import {
  buildSearchResultHref,
  formatTime,
  getHighlightParts,
  getQueryTerms,
  getResultJumpLabel,
  getResultPageNumber,
  getResultTimestamp,
} from './search-result-utils';

const DOCUMENT_RESULT: SearchResultItem = {
  id: 'chunk-123',
  contentId: 'content-1',
  contentTitle: 'Quarterly Report',
  contentType: 'document',
  chunkText: 'Revenue increased after the launch in Q4.',
  similarity: 0.92,
  metadata: {
    source: 'document',
    chunkIndex: 3,
    startTime: 125,
  },
};

describe('search-result-utils', () => {
  it('formats time for jump labels', () => {
    expect(formatTime(125)).toBe('2:05');
  });

  it('normalizes query terms', () => {
    expect(getQueryTerms('  launch   q4  ')).toEqual(['launch', 'q4']);
  });

  it('splits snippet text into highlighted parts', () => {
    const parts = getHighlightParts('Launch notes mention Q4 trends', 'launch q4');
    const highlighted = parts.filter((part) => part.highlighted).map((part) => part.text.toLowerCase());

    expect(highlighted).toEqual(['launch', 'q4']);
  });

  it('returns document page number from chunk index', () => {
    expect(getResultPageNumber(DOCUMENT_RESULT)).toBe(4);
  });

  it('returns null page number for transcript results', () => {
    const transcriptResult: SearchResultItem = {
      ...DOCUMENT_RESULT,
      metadata: {
        ...DOCUMENT_RESULT.metadata,
        source: 'transcript',
      },
    };

    expect(getResultPageNumber(transcriptResult)).toBeNull();
  });

  it('prefers explicit timestamp ranges over derived start time', () => {
    const rangedResult: SearchResultItem = {
      ...DOCUMENT_RESULT,
      metadata: {
        ...DOCUMENT_RESULT.metadata,
        timestampRange: '2:05 - 2:12',
      },
    };

    expect(getResultTimestamp(rangedResult)).toBe('2:05 - 2:12');
  });

  it('builds deep-link href with page, timestamp, and highlight id', () => {
    expect(buildSearchResultHref(DOCUMENT_RESULT)).toBe(
      '/library/content-1?t=125&page=4&highlight=chunk-123',
    );
  });

  it('uses page labels before timestamp labels for jump text', () => {
    expect(getResultJumpLabel(DOCUMENT_RESULT)).toBe('Page 4');
  });
});
