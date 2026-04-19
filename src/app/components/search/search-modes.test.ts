import {
  SEARCH_UI_DEFAULT_MODE,
  isSearchUiMode,
  parseSearchUiMode,
} from './search-modes';

describe('search UI mode helpers', () => {
  it('validates known modes', () => {
    expect(isSearchUiMode('answer')).toBe(true);
    expect(isSearchUiMode('docs')).toBe(true);
    expect(isSearchUiMode('sources')).toBe(true);

    expect(isSearchUiMode('vector')).toBe(false);
    expect(isSearchUiMode('')).toBe(false);
    expect(isSearchUiMode(undefined)).toBe(false);
  });

  it('parses a supported mode', () => {
    expect(parseSearchUiMode('answer')).toBe('answer');
    expect(parseSearchUiMode('docs')).toBe('docs');
    expect(parseSearchUiMode('sources')).toBe('sources');
  });

  it('falls back to default mode for unsupported values', () => {
    expect(parseSearchUiMode('hybrid')).toBe(SEARCH_UI_DEFAULT_MODE);
    expect(parseSearchUiMode(null)).toBe(SEARCH_UI_DEFAULT_MODE);
    expect(parseSearchUiMode('')).toBe(SEARCH_UI_DEFAULT_MODE);
  });
});
