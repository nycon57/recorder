/**
 * route.test.ts
 *
 * Visibility filter enforcement for the gated search index API.
 *
 * Tests the audience-level access logic in isolation — no actual file I/O
 * or HTTP server needed.
 */

import type { Audience } from '@/lib/docs';

// ── Replicate the AUDIENCE_LEVEL check from the route ─────────────────────────

const AUDIENCE_LEVEL: Record<Audience, number> = {
  public: 0,
  'org-admin': 1,
  'system-admin': 2,
};

type GatedAudience = 'org-admin' | 'system-admin';

function canAccessIndex(
  callerAudience: Audience,
  requestedIndex: GatedAudience,
): boolean {
  return AUDIENCE_LEVEL[callerAudience] >= AUDIENCE_LEVEL[requestedIndex];
}

// ── Search index visibility tests ─────────────────────────────────────────────

describe('search index visibility filter', () => {
  describe('org-admin index', () => {
    it('denies public callers', () => {
      expect(canAccessIndex('public', 'org-admin')).toBe(false);
    });

    it('allows org-admin callers', () => {
      expect(canAccessIndex('org-admin', 'org-admin')).toBe(true);
    });

    it('allows system-admin callers', () => {
      expect(canAccessIndex('system-admin', 'org-admin')).toBe(true);
    });
  });

  describe('system-admin index', () => {
    it('denies public callers', () => {
      expect(canAccessIndex('public', 'system-admin')).toBe(false);
    });

    it('denies org-admin callers', () => {
      expect(canAccessIndex('org-admin', 'system-admin')).toBe(false);
    });

    it('allows system-admin callers', () => {
      expect(canAccessIndex('system-admin', 'system-admin')).toBe(true);
    });
  });
});

// ── Search index content isolation tests ─────────────────────────────────────

interface PageEntry {
  id: string;
  audience: Audience;
}

function buildIndexEntries(
  pages: PageEntry[],
  maxAudience: Audience,
): PageEntry[] {
  const maxLevel = AUDIENCE_LEVEL[maxAudience];
  return pages.filter((p) => AUDIENCE_LEVEL[p.audience] <= maxLevel);
}

describe('search index content isolation', () => {
  const allPages: PageEntry[] = [
    { id: 'getting-started/welcome', audience: 'public' },
    { id: 'product/capture', audience: 'public' },
    { id: 'org-admin/members', audience: 'org-admin' },
    { id: 'system-admin/flags', audience: 'system-admin' },
    { id: 'platform-runbooks/deploy', audience: 'system-admin' },
  ];

  it('public index contains only public pages', () => {
    const entries = buildIndexEntries(allPages, 'public');
    expect(entries.every((e) => e.audience === 'public')).toBe(true);
    expect(entries.some((e) => e.audience === 'org-admin')).toBe(false);
    expect(entries.some((e) => e.audience === 'system-admin')).toBe(false);
  });

  it('org-admin index contains public and org-admin pages', () => {
    const entries = buildIndexEntries(allPages, 'org-admin');
    expect(entries.some((e) => e.audience === 'public')).toBe(true);
    expect(entries.some((e) => e.audience === 'org-admin')).toBe(true);
    expect(entries.some((e) => e.audience === 'system-admin')).toBe(false);
  });

  it('system-admin index contains all pages', () => {
    const entries = buildIndexEntries(allPages, 'system-admin');
    expect(entries).toHaveLength(allPages.length);
  });

  it('no admin slug leaks into public index', () => {
    const publicEntries = buildIndexEntries(allPages, 'public');
    const publicIds = new Set(publicEntries.map((e) => e.id));
    expect(publicIds.has('org-admin/members')).toBe(false);
    expect(publicIds.has('system-admin/flags')).toBe(false);
    expect(publicIds.has('platform-runbooks/deploy')).toBe(false);
  });
});
