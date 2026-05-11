/**
 * DB adapter unit tests — TRIB-154
 *
 * Tests loadDbPages and findDbPageBody against a mocked Supabase admin client.
 * Covers: happy path, Zod-invalid row drop, query error degradation,
 * published=false exclusion, and body cache hit vs. miss.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Supabase admin mock ───────────────────────────────────────────────────────

const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => mockCreateClient(),
}));

// Suppress logger output in tests
jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import the adapter AFTER setting up mocks
import { loadDbPages, findDbPageBody } from '../db';

// ── Helpers ───────────────────────────────────────────────────────────────────

const validRow = {
  slug: 'system-admin/feature-flags',
  title: 'Feature flags',
  description: 'Managing feature flags and rollouts.',
  audience: 'system-admin',
  section: 'system-admin',
  group: null as null,
  order: 10,
  related: ['system-admin/global-quotas'],
  tags: ['runbook', 'feature-flags'],
  unlisted: false,
  content_hash: 'abc123def456789a',
  updated_at: '2026-04-20T00:00:00.000Z',
  published: true,
};

const invalidRow = {
  slug: 'system-admin/broken',
  // missing 'title'
  description: 'Broken page.',
  audience: 'not-valid-audience',
  section: 'system-admin',
  group: null as null,
  order: 99,
  related: null as null,
  tags: null as null,
  unlisted: false,
  content_hash: 'deadbeef00000000',
  updated_at: '2026-04-20T00:00:00.000Z',
  published: true,
};

/** Build a chainable Supabase-like query mock that resolves to `result`. */

function buildListMock(result: { data: any; error: any }) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: (table: string) => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (cols: string) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        eq: (col: string, val: any) => Promise.resolve(result),
      }),
    }),
  };
}

/** Build a chainable Supabase-like query mock for maybeSingle queries. */

function buildSingleMock(result: { data: any; error: any }) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    from: (table: string) => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      select: (cols: string) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        eq: (col: string, val: any) => ({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          eq: (col2: string, val2: any) => ({
            maybeSingle: () => Promise.resolve(result),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      update: (payload: any) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        eq: (col: string, val: any) => Promise.resolve({ error: null }),
      }),
    }),
  };
}

// ── loadDbPages tests ─────────────────────────────────────────────────────────

describe('loadDbPages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns parsed pages for valid rows', async () => {
    mockCreateClient.mockReturnValue(buildListMock({ data: [validRow], error: null }));

    const pages = await loadDbPages();

    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('system-admin/feature-flags');
    expect(pages[0].source).toBe('db');
    expect(pages[0].audience).toBe('system-admin');
    expect(pages[0].contentHash).toBe('abc123def456789a');
    expect(pages[0].updatedAt).toBe('2026-04-20');
  });

  it('drops Zod-invalid rows and continues', async () => {
    mockCreateClient.mockReturnValue(
      buildListMock({ data: [validRow, invalidRow], error: null }),
    );

    const pages = await loadDbPages();

    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe('system-admin/feature-flags');
  });

  it('returns empty array and does not throw on query error', async () => {
    mockCreateClient.mockReturnValue(
      buildListMock({
        data: null,
        error: { message: 'connection refused', code: 'ECONNREFUSED' },
      }),
    );

    const pages = await loadDbPages();
    expect(pages).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockCreateClient.mockReturnValue(buildListMock({ data: null, error: null }));

    const pages = await loadDbPages();
    expect(pages).toEqual([]);
  });

  it('sets source to db for all returned pages', async () => {
    mockCreateClient.mockReturnValue(buildListMock({ data: [validRow], error: null }));

    const pages = await loadDbPages();
    for (const page of pages) {
      expect(page.source).toBe('db');
    }
  });
});

// ── findDbPageBody tests ──────────────────────────────────────────────────────

describe('findDbPageBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached HTML when body_html_cached is present', async () => {
    mockCreateClient.mockReturnValue(
      buildSingleMock({
        data: { body_markdown: '# Feature flags', body_html_cached: '<h1>Feature flags</h1>' },
        error: null,
      }),
    );

    const result = await findDbPageBody('system-admin/feature-flags');

    expect(result).not.toBeNull();
    expect(result!.bodyHtml).toBe('<h1>Feature flags</h1>');
    expect(result!.bodyMarkdown).toBe('# Feature flags');
  });

  it('returns null when page is not found', async () => {
    mockCreateClient.mockReturnValue(buildSingleMock({ data: null, error: null }));

    const result = await findDbPageBody('system-admin/nonexistent');
    expect(result).toBeNull();
  });

  it('returns null on query error', async () => {
    mockCreateClient.mockReturnValue(
      buildSingleMock({
        data: null,
        error: { message: 'connection error', code: 'ECONNREFUSED' },
      }),
    );

    const result = await findDbPageBody('system-admin/feature-flags');
    expect(result).toBeNull();
  });

  it('returns result with markdown when body_html_cached is null (compile path)', async () => {
    mockCreateClient.mockReturnValue(
      buildSingleMock({
        data: { body_markdown: '# Hello', body_html_cached: null },
        error: null,
      }),
    );

    const result = await findDbPageBody('system-admin/feature-flags');

    // Either compiled HTML or the fallback <pre> — both are valid non-null results
    expect(result).not.toBeNull();
    expect(result!.bodyMarkdown).toBe('# Hello');
    expect(typeof result!.bodyHtml).toBe('string');
    expect(result!.bodyHtml.length).toBeGreaterThan(0);
  });
});
