import type { SearchResultItem } from '@/app/components/search/search-result-types';

export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getQueryTerms(query: string) {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function getHighlightParts(text: string, query: string): HighlightPart[] {
  const terms = getQueryTerms(query);
  if (!text || terms.length === 0) {
    return [{ text, highlighted: false }];
  }

  const pattern = terms.map(escapeRegex).join('|');
  const splitRegex = new RegExp(`(${pattern})`, 'gi');
  const exactTermRegex = new RegExp(`^(?:${pattern})$`, 'i');

  return text
    .split(splitRegex)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: exactTermRegex.test(part),
    }));
}

export function getResultPageNumber(result: SearchResultItem): number | null {
  if (result.metadata.source !== 'document') return null;
  if (typeof result.metadata.chunkIndex !== 'number') return null;
  return result.metadata.chunkIndex + 1;
}

export function getResultTimestamp(result: SearchResultItem): string | null {
  if (result.metadata.timestampRange) return result.metadata.timestampRange;
  if (typeof result.metadata.startTime === 'number') {
    return formatTime(result.metadata.startTime);
  }
  return null;
}

export function buildSearchResultHref(result: SearchResultItem): string {
  const params = new URLSearchParams();

  if (typeof result.metadata.startTime === 'number') {
    params.set('t', String(Math.floor(result.metadata.startTime)));
  }

  const pageNumber = getResultPageNumber(result);
  if (pageNumber !== null) {
    params.set('page', String(pageNumber));
  }

  params.set('highlight', result.id);

  const queryString = params.toString();
  const basePath = `/library/${result.contentId}`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function getResultJumpLabel(result: SearchResultItem): string {
  const pageNumber = getResultPageNumber(result);
  if (pageNumber !== null) {
    return `Page ${pageNumber}`;
  }

  const timestamp = getResultTimestamp(result);
  if (timestamp) {
    return timestamp;
  }

  return 'Open source';
}
