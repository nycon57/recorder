export const SEARCH_UI_DEFAULT_MODE = 'answer' as const;

const SEARCH_UI_MODES = [
  {
    mode: 'answer',
    label: 'Answer',
    description: 'AI summary with source citations',
  },
  {
    mode: 'docs',
    label: 'Docs',
    description: 'Document-style result cards',
  },
  {
    mode: 'sources',
    label: 'Sources',
    description: 'Raw source matches and links',
  },
] as const;

export type SearchUiMode = (typeof SEARCH_UI_MODES)[number]['mode'];

export function isSearchUiMode(
  value: string | null | undefined,
): value is SearchUiMode {
  if (!value) return false;
  return SEARCH_UI_MODES.some((item) => item.mode === value);
}

export function parseSearchUiMode(
  value: string | null | undefined,
): SearchUiMode {
  if (!isSearchUiMode(value)) return SEARCH_UI_DEFAULT_MODE;
  return value;
}
