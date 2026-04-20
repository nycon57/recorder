import { cache } from 'react';

import { createLogger } from '@/lib/utils/logger';

import { loadDbPages } from './adapters/db';
import { loadGitPages } from './adapters/git';
import { SECTIONS } from './sections';
import type {
  Audience,
  DocsNavTree,
  DocsPage,
  DocsRegistry,
  DocsSection,
} from './types';

const logger = createLogger({});

// ── Visibility helpers ────────────────────────────────────────────────────────

/**
 * Audience ordinal — higher value = more privileged.
 * Used for ≤ comparisons.
 */
const AUDIENCE_LEVEL: Record<Audience, number> = {
  public: 0,
  'org-admin': 1,
  'system-admin': 2,
};

/**
 * Returns true when `callerAudience` is at least as privileged as `pageAudience`.
 *
 * Visibility matrix (§4):
 *  - system-admin  → any        → render
 *  - org-admin     → public     → render
 *  - org-admin     → org-admin  → render
 *  - org-admin     → system-admin → notFound
 *  - public        → public     → render
 *  - public        → org-admin  → redirect /login
 *  - public        → system-admin → notFound
 *
 * canView encodes the render/no-render split; the caller is responsible for
 * distinguishing between "redirect to login" and "notFound" when needed.
 */
export function canView(page: DocsPage, audience: Audience): boolean {
  return AUDIENCE_LEVEL[audience] >= AUDIENCE_LEVEL[page.audience];
}

// ── Navigation builder ────────────────────────────────────────────────────────

/**
 * Build the nav tree for the given audience.
 * Sections are filtered via audience level, then pages are grouped within each
 * section. `unlisted` pages are excluded from the tree.
 */
export function buildNavigation(
  pages: ReadonlyMap<string, DocsPage>,
  sections: ReadonlyArray<DocsSection>,
  audience: Audience,
): DocsNavTree {
  const visibleSections = sections
    .filter((s) => AUDIENCE_LEVEL[audience] >= AUDIENCE_LEVEL[s.audience])
    .sort((a, b) => a.order - b.order);

  return {
    sections: visibleSections.map((section) => {
      const sectionPages = Array.from(pages.values())
        .filter(
          (p) =>
            p.section === section.id &&
            !p.draft &&
            !p.unlisted &&
            canView(p, audience),
        )
        .sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));

      // Group pages by their `group` field (undefined → ungrouped)
      const groupMap = new Map<string | undefined, DocsPage[]>();
      for (const page of sectionPages) {
        const key = page.group;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(page);
      }

      const groups = Array.from(groupMap.entries()).map(([group, groupPages]) => ({
        group,
        pages: groupPages,
      }));

      return { section, groups };
    }),
  };
}

// ── Related-link resolver ─────────────────────────────────────────────────────

/**
 * Return related pages for `slug` that are visible to `audience`.
 *
 * Rules (§5):
 *  - public page  → strips links to org-admin or system-admin pages (+ warn)
 *  - org-admin    → strips links to system-admin pages (+ warn)
 *  - system-admin → includes all
 *  - dangling slug (not in registry) → stripped + warn
 *
 * Depth-1 only. No transitive resolution.
 */
export function relatedFor(
  slug: string,
  audience: Audience,
  pages: ReadonlyMap<string, DocsPage>,
): DocsPage[] {
  const page = pages.get(slug);
  if (!page || !page.related?.length) return [];

  const results: DocsPage[] = [];

  for (const relatedSlug of page.related) {
    const relatedPage = pages.get(relatedSlug);

    if (!relatedPage) {
      logger.warn(`[docs:related-strip] dangling related slug "${relatedSlug}" on page "${slug}"`);
      continue;
    }

    // Strip if the linked page is more privileged than the source page audience
    if (AUDIENCE_LEVEL[relatedPage.audience] > AUDIENCE_LEVEL[page.audience]) {
      logger.warn(
        `[docs:related-strip] stripped "${relatedSlug}" (audience: ${relatedPage.audience}) ` +
          `from "${slug}" (audience: ${page.audience}) — cross-audience escalation`,
      );
      continue;
    }

    // Also strip if the caller's audience cannot view the linked page (belt-and-suspenders)
    if (!canView(relatedPage, audience)) {
      continue;
    }

    results.push(relatedPage);
  }

  return results;
}

// ── Related-link validation (build-time) ──────────────────────────────────────

/**
 * Validate all related links in a page array, emitting warnings for any
 * dangling or cross-audience escalation links.
 * Called during registry build; safe to call in test environments.
 */
export function validateRelatedLinks(pages: ReadonlyMap<string, DocsPage>): void {
  for (const page of pages.values()) {
    if (!page.related?.length) continue;
    for (const relatedSlug of page.related) {
      const relatedPage = pages.get(relatedSlug);
      if (!relatedPage) {
        logger.warn(
          `[docs:related-strip] dangling related slug "${relatedSlug}" on page "${page.slug}"`,
        );
        continue;
      }
      if (AUDIENCE_LEVEL[relatedPage.audience] > AUDIENCE_LEVEL[page.audience]) {
        logger.warn(
          `[docs:related-strip] cross-audience escalation: "${relatedSlug}" (${relatedPage.audience}) ` +
            `linked from "${page.slug}" (${page.audience})`,
        );
      }
    }
  }
}

// ── DB loader (cached 60s) ────────────────────────────────────────────────────

/**
 * Lazily wrap loadDbPages with unstable_cache so `next/cache` is not imported
 * at module evaluation time (avoids Node.js Web API availability issues in
 * test environments and satisfies the lazy-init pattern in CLAUDE.md).
 * The async dynamic import is resolved once per registry build call.
 */
async function getCachedDbLoader(): Promise<() => Promise<DocsPage[]>> {
  const { unstable_cache } = await import('next/cache');
  return unstable_cache(loadDbPages, ['docs-db-pages'], {
    revalidate: 60,
    tags: ['docs:db'],
  });
}

// ── Registry builder ──────────────────────────────────────────────────────────

function buildRegistry(gitPages: DocsPage[], dbPages: DocsPage[]): DocsRegistry {
  // Start from git pages, then let DB override by slug (DB wins on collision)
  const pageMap = new Map<string, DocsPage>();

  for (const page of gitPages) {
    if (!page.draft) pageMap.set(page.slug, page);
  }

  for (const page of dbPages) {
    if (page.draft) continue;
    if (pageMap.has(page.slug)) {
      logger.warn('docs.db_shadow', { data: { slug: page.slug } });
    }
    pageMap.set(page.slug, page);
  }

  // Validate related links at build time
  validateRelatedLinks(pageMap);

  const registry: DocsRegistry = {
    pages: pageMap,
    sections: SECTIONS,

    findPage(slug) {
      return pageMap.get(slug);
    },

    pagesForAudience(audience) {
      return Array.from(pageMap.values()).filter(
        (p) => !p.draft && canView(p, audience),
      );
    },

    sectionsForAudience(audience) {
      return SECTIONS.filter(
        (s) => AUDIENCE_LEVEL[audience] >= AUDIENCE_LEVEL[s.audience],
      ).sort((a, b) => a.order - b.order);
    },

    buildNavigation(audience) {
      return buildNavigation(pageMap, SECTIONS, audience);
    },

    relatedFor(slug, audience) {
      return relatedFor(slug, audience, pageMap);
    },

    canView(page, audience) {
      return canView(page, audience);
    },
  };

  return registry;
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Load and return the docs registry for the current request.
 *
 * Memoized with React `cache()` — built once per request.
 * Git pages are static per deploy; DB pages use a 60s `unstable_cache`
 * with the `docs:db` tag (invalidated by admin write path in TRIB-154).
 *
 * Throws on malformed manifest (deploy-time bug — fail loud, not silent).
 */
export const getDocsRegistry = cache(async (): Promise<DocsRegistry> => {
  const loadCachedDbPages = await getCachedDbLoader();
  const [gitPages, dbPages] = await Promise.all([
    loadGitPages(),
    loadCachedDbPages(),
  ]);

  return buildRegistry(gitPages, dbPages);
});

// Re-export helpers so callers can use them standalone
export { canView as canViewPage };
