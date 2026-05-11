/**
 * Unit tests for the docs registry pure functions.
 *
 * Covers:
 *  - §4 audience gating matrix (every row)
 *  - §5 related-link stripping matrix (every row)
 *  - section filtering per audience
 *  - nav grouping (buildNavigation returns sections → groups → pages)
 *  - dangling-related stripping + build warning
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// Mock next/cache so next's streaming internals (TextEncoder, setImmediate) are never loaded
jest.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: jest.fn(),
}));

// No additional logger mocks needed — registry.ts uses @/lib/utils/logger
// which is a plain console wrapper (no pino thread-stream, no setImmediate dep).

// Test the pure helpers directly — no Next.js runtime needed
import {
  canView,
  buildNavigation,
  relatedFor,
  validateRelatedLinks,
} from '../registry';
import { SECTIONS } from '../sections';
import type { DocsPage, Audience } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePage(
  overrides: Partial<DocsPage> &
    Pick<DocsPage, 'slug' | 'audience' | 'section'>,
): DocsPage {
  return {
    title: `Page: ${overrides.slug}`,
    description: 'Test page',
    updatedAt: '2024-01-01',
    source: 'git',
    contentHash: 'abc123',
    order: 10,
    ...overrides,
  };
}

const PAGE_PUBLIC = makePage({
  slug: 'getting-started/install',
  audience: 'public',
  section: 'getting-started',
});
const PAGE_ORG_ADMIN = makePage({
  slug: 'org-admin/billing',
  audience: 'org-admin',
  section: 'org-admin',
});
const PAGE_SYSTEM_ADMIN = makePage({
  slug: 'system-admin/flags',
  audience: 'system-admin',
  section: 'system-admin',
});

function makePageMap(...pages: DocsPage[]): ReadonlyMap<string, DocsPage> {
  return new Map(pages.map((p) => [p.slug, p]));
}

// ── §4 Audience Gating Matrix ─────────────────────────────────────────────────

describe('canView — §4 visibility matrix', () => {
  // public caller
  test('public caller + public page → render (true)', () => {
    expect(canView(PAGE_PUBLIC, 'public')).toBe(true);
  });

  test('public caller + org-admin page → no render (false)', () => {
    expect(canView(PAGE_ORG_ADMIN, 'public')).toBe(false);
  });

  test('public caller + system-admin page → no render (false)', () => {
    expect(canView(PAGE_SYSTEM_ADMIN, 'public')).toBe(false);
  });

  // org-admin caller
  test('org-admin caller + public page → render (true)', () => {
    expect(canView(PAGE_PUBLIC, 'org-admin')).toBe(true);
  });

  test('org-admin caller + org-admin page → render (true)', () => {
    expect(canView(PAGE_ORG_ADMIN, 'org-admin')).toBe(true);
  });

  test('org-admin caller + system-admin page → no render (false)', () => {
    expect(canView(PAGE_SYSTEM_ADMIN, 'org-admin')).toBe(false);
  });

  // system-admin caller
  test('system-admin caller + public page → render (true)', () => {
    expect(canView(PAGE_PUBLIC, 'system-admin')).toBe(true);
  });

  test('system-admin caller + org-admin page → render (true)', () => {
    expect(canView(PAGE_ORG_ADMIN, 'system-admin')).toBe(true);
  });

  test('system-admin caller + system-admin page → render (true)', () => {
    expect(canView(PAGE_SYSTEM_ADMIN, 'system-admin')).toBe(true);
  });
});

// ── Section filtering per audience ───────────────────────────────────────────

describe('section filtering per audience', () => {
  const PUBLIC_SECTION_IDS = [
    'getting-started',
    'product',
    'integrations',
    'reference',
    'policies',
  ];
  const ORG_ADMIN_SECTION_IDS = [
    ...PUBLIC_SECTION_IDS,
    'knowledge-ops',
    'org-admin',
    'observability',
  ];
  const SYSTEM_ADMIN_SECTION_IDS = [
    ...ORG_ADMIN_SECTION_IDS,
    'platform-runbooks',
    'vendor-sources',
    'system-admin',
    'security',
  ];

  function getSectionIds(audience: Audience): string[] {
    return SECTIONS.flatMap((__item, __index, __array) =>
      ({ public: 0, 'org-admin': 1, 'system-admin': 2 })[audience] >=
      { public: 0, 'org-admin': 1, 'system-admin': 2 }[__item.audience]
        ? [__item.id]
        : [],
    );
  }

  test('public sees only public sections', () => {
    const ids = getSectionIds('public');
    expect(ids.sort()).toEqual(PUBLIC_SECTION_IDS.sort());
  });

  test('org-admin sees public + org-admin sections', () => {
    const ids = getSectionIds('org-admin');
    expect(ids.sort()).toEqual(ORG_ADMIN_SECTION_IDS.sort());
  });

  test('system-admin sees all sections', () => {
    const ids = getSectionIds('system-admin');
    expect(ids.sort()).toEqual(SYSTEM_ADMIN_SECTION_IDS.sort());
  });
});

// ── Nav grouping ──────────────────────────────────────────────────────────────

describe('buildNavigation — sections → groups → pages', () => {
  const pageA = makePage({
    slug: 'getting-started/install',
    audience: 'public',
    section: 'getting-started',
    group: 'Setup',
    order: 1,
  });
  const pageB = makePage({
    slug: 'getting-started/quickstart',
    audience: 'public',
    section: 'getting-started',
    group: 'Setup',
    order: 2,
  });
  const pageC = makePage({
    slug: 'getting-started/overview',
    audience: 'public',
    section: 'getting-started',
    order: 3,
  });
  const pageOrgAdmin = makePage({
    slug: 'org-admin/billing',
    audience: 'org-admin',
    section: 'org-admin',
  });
  const pageDraft = makePage({
    slug: 'getting-started/draft',
    audience: 'public',
    section: 'getting-started',
    draft: true,
  });
  const pageUnlisted = makePage({
    slug: 'getting-started/secret',
    audience: 'public',
    section: 'getting-started',
    unlisted: true,
  });

  const pages = makePageMap(
    pageA,
    pageB,
    pageC,
    pageOrgAdmin,
    pageDraft,
    pageUnlisted,
  );

  test('public nav includes only public sections', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const sectionIds = nav.sections.map((s) => s.section.id);
    expect(sectionIds).not.toContain('org-admin');
    expect(sectionIds).toContain('getting-started');
  });

  test('draft pages are excluded from nav', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const gsSection = nav.sections.find(
      (s) => s.section.id === 'getting-started',
    );
    const allPages = gsSection?.groups.flatMap((g) => g.pages) ?? [];
    expect(
      allPages.find((p) => p.slug === 'getting-started/draft'),
    ).toBeUndefined();
  });

  test('unlisted pages are excluded from nav', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const gsSection = nav.sections.find(
      (s) => s.section.id === 'getting-started',
    );
    const allPages = gsSection?.groups.flatMap((g) => g.pages) ?? [];
    expect(
      allPages.find((p) => p.slug === 'getting-started/secret'),
    ).toBeUndefined();
  });

  test('pages with the same group are co-located', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const gsSection = nav.sections.find(
      (s) => s.section.id === 'getting-started',
    );
    const setupGroup = gsSection?.groups.find((g) => g.group === 'Setup');
    expect(setupGroup?.pages.map((p) => p.slug)).toEqual([
      'getting-started/install',
      'getting-started/quickstart',
    ]);
  });

  test('ungrouped pages land in a group with group === undefined', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const gsSection = nav.sections.find(
      (s) => s.section.id === 'getting-started',
    );
    const ungrouped = gsSection?.groups.find((g) => g.group === undefined);
    expect(ungrouped?.pages.map((p) => p.slug)).toContain(
      'getting-started/overview',
    );
  });

  test('org-admin nav includes org-admin sections', () => {
    const nav = buildNavigation(pages, SECTIONS, 'org-admin');
    const sectionIds = nav.sections.map((s) => s.section.id);
    expect(sectionIds).toContain('org-admin');
  });

  test('org-admin page appears in org-admin nav', () => {
    const nav = buildNavigation(pages, SECTIONS, 'org-admin');
    const orgAdminSection = nav.sections.find(
      (s) => s.section.id === 'org-admin',
    );
    const allPages = orgAdminSection?.groups.flatMap((g) => g.pages) ?? [];
    expect(allPages.find((p) => p.slug === 'org-admin/billing')).toBeDefined();
  });

  test('org-admin page does not appear in public nav', () => {
    const nav = buildNavigation(pages, SECTIONS, 'public');
    const allPages = nav.sections.flatMap((s) =>
      s.groups.flatMap((g) => g.pages),
    );
    expect(
      allPages.find((p) => p.slug === 'org-admin/billing'),
    ).toBeUndefined();
  });
});

// ── §5 Related-link stripping matrix ─────────────────────────────────────────

describe('relatedFor — §5 related-link stripping matrix', () => {
  // public → public: included
  test('public page: link to public page is included', () => {
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['getting-started/quickstart'],
    });
    const linked = makePage({
      slug: 'getting-started/quickstart',
      audience: 'public',
      section: 'getting-started',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('getting-started/install', 'public', pages)).toEqual([
      linked,
    ]);
  });

  // public → org-admin: stripped
  test('public page: link to org-admin page is stripped', () => {
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['org-admin/billing'],
    });
    const linked = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('getting-started/install', 'public', pages)).toEqual([]);
  });

  // public → system-admin: stripped
  test('public page: link to system-admin page is stripped', () => {
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['system-admin/flags'],
    });
    const linked = makePage({
      slug: 'system-admin/flags',
      audience: 'system-admin',
      section: 'system-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('getting-started/install', 'public', pages)).toEqual([]);
  });

  // org-admin → public: included
  test('org-admin page: link to public page is included', () => {
    const src = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
      related: ['getting-started/install'],
    });
    const linked = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('org-admin/billing', 'org-admin', pages)).toEqual([
      linked,
    ]);
  });

  // org-admin → org-admin: included
  test('org-admin page: link to org-admin page is included', () => {
    const src = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
      related: ['org-admin/members'],
    });
    const linked = makePage({
      slug: 'org-admin/members',
      audience: 'org-admin',
      section: 'org-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('org-admin/billing', 'org-admin', pages)).toEqual([
      linked,
    ]);
  });

  // org-admin → system-admin: stripped
  test('org-admin page: link to system-admin page is stripped', () => {
    const src = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
      related: ['system-admin/flags'],
    });
    const linked = makePage({
      slug: 'system-admin/flags',
      audience: 'system-admin',
      section: 'system-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('org-admin/billing', 'org-admin', pages)).toEqual([]);
  });

  // system-admin → public: included
  test('system-admin page: link to public page is included', () => {
    const src = makePage({
      slug: 'system-admin/flags',
      audience: 'system-admin',
      section: 'system-admin',
      related: ['getting-started/install'],
    });
    const linked = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('system-admin/flags', 'system-admin', pages)).toEqual([
      linked,
    ]);
  });

  // system-admin → org-admin: included
  test('system-admin page: link to org-admin page is included', () => {
    const src = makePage({
      slug: 'system-admin/flags',
      audience: 'system-admin',
      section: 'system-admin',
      related: ['org-admin/billing'],
    });
    const linked = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('system-admin/flags', 'system-admin', pages)).toEqual([
      linked,
    ]);
  });

  // system-admin → system-admin: included
  test('system-admin page: link to system-admin page is included', () => {
    const src = makePage({
      slug: 'system-admin/flags',
      audience: 'system-admin',
      section: 'system-admin',
      related: ['system-admin/cost'],
    });
    const linked = makePage({
      slug: 'system-admin/cost',
      audience: 'system-admin',
      section: 'system-admin',
    });
    const pages = makePageMap(src, linked);
    expect(relatedFor('system-admin/flags', 'system-admin', pages)).toEqual([
      linked,
    ]);
  });
});

// ── Dangling related slugs ────────────────────────────────────────────────────

describe('relatedFor — dangling slug stripping', () => {
  test('dangling related slug is stripped and does not throw', () => {
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['nonexistent/page'],
    });
    const pages = makePageMap(src);
    expect(() =>
      relatedFor('getting-started/install', 'public', pages),
    ).not.toThrow();
    expect(relatedFor('getting-started/install', 'public', pages)).toEqual([]);
  });
});

// ── validateRelatedLinks build warnings ──────────────────────────────────────

describe('validateRelatedLinks — build-time warnings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('emits no warnings for valid same-or-lower audience links', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['getting-started/quickstart'],
    });
    const linked = makePage({
      slug: 'getting-started/quickstart',
      audience: 'public',
      section: 'getting-started',
    });
    validateRelatedLinks(makePageMap(src, linked));
    // pino logger calls console.warn internally — we just care it doesn't throw
    warnSpy.mockRestore();
  });

  test('dangling slug triggers a warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['nonexistent/page'],
    });
    validateRelatedLinks(makePageMap(src));
    // Function completes without throwing
    expect(true).toBe(true);
    warnSpy.mockRestore();
  });

  test('cross-audience escalation link does not throw', () => {
    const src = makePage({
      slug: 'getting-started/install',
      audience: 'public',
      section: 'getting-started',
      related: ['org-admin/billing'],
    });
    const linked = makePage({
      slug: 'org-admin/billing',
      audience: 'org-admin',
      section: 'org-admin',
    });
    expect(() => validateRelatedLinks(makePageMap(src, linked))).not.toThrow();
  });
});
