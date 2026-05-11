/**
 * build-search-index.ts
 *
 * Build audience-filtered MiniSearch index files from the compiled page list.
 *
 * Three output files:
 *   public.json            — pages where audience === 'public'
 *   org-admin.json         — pages where audience ∈ {'public', 'org-admin'}
 *   system-admin.json      — all non-draft, non-unlisted pages
 *
 * See plan §9.
 */

import MiniSearch from 'minisearch';

import type { Audience } from '../../../src/lib/docs/types';

import { stripHtml } from './strip-html';

const BODY_TEXT_MAX = 8 * 1024; // 8KB plaintext cap per page

const AUDIENCE_LEVEL: Record<Audience, number> = {
  public: 0,
  'org-admin': 1,
  'system-admin': 2,
};

interface SearchIndexEntry {
  id: string;
  title: string;
  description: string;
  section: string;
  audience: Audience;
  bodyText: string;
  tags?: string[];
}

export interface CompiledPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  audience: Audience;
  tags?: string[];
  bodyHtml: string;
  draft?: boolean;
  unlisted?: boolean;
}

/**
 * Build MiniSearch-serialisable index data for a given max audience level.
 * Pages visible to `maxAudience` and below are included.
 */
function buildIndexForAudience(
  pages: CompiledPage[],
  maxAudience: Audience,
): object {
  const maxLevel = AUDIENCE_LEVEL[maxAudience];

  const filtered = pages.filter(
    (p) =>
      !p.draft &&
      !p.unlisted &&
      AUDIENCE_LEVEL[p.audience] <= maxLevel,
  );

  const entries: SearchIndexEntry[] = filtered.map((p) => {
    const rawText = stripHtml(p.bodyHtml);
    const bodyText =
      rawText.length > BODY_TEXT_MAX
        ? rawText.slice(0, BODY_TEXT_MAX)
        : rawText;

    return {
      id: p.slug,
      title: p.title,
      description: p.description,
      section: p.section,
      audience: p.audience,
      bodyText,
      tags: p.tags,
    };
  });

  // Build a MiniSearch instance and serialize it for client-side hydration
  const ms = new MiniSearch<SearchIndexEntry>({
    idField: 'id',
    fields: ['title', 'description', 'bodyText', 'tags'],
    storeFields: ['id', 'title', 'description', 'section', 'audience', 'tags'],
    searchOptions: {
      boost: { title: 3, description: 1.5, bodyText: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  ms.addAll(entries);

  return {
    index: ms.toJSON(),
    entries: entries.map(({ id, title, description, section, audience, tags }) => ({
      id,
      title,
      description,
      section,
      audience,
      tags,
    })),
  };
}

export interface SearchIndexSet {
  public: object;
  'org-admin': object;
  'system-admin': object;
}

/**
 * Build all three search indexes from the compiled page list.
 */
export function buildSearchIndexes(pages: CompiledPage[]): SearchIndexSet {
  return {
    public: buildIndexForAudience(pages, 'public'),
    'org-admin': buildIndexForAudience(pages, 'org-admin'),
    'system-admin': buildIndexForAudience(pages, 'system-admin'),
  };
}
