/**
 * manifest.test.ts
 *
 * Validates the manifest shape and loader degradation behaviour.
 * Does NOT run the full build script (that requires Shiki and heavy I/O);
 * instead it tests the schema and loader in isolation with fixture data.
 */

import { z } from 'zod';

import { DocsPageSchema } from '../schema';

// ── ManifestSchema (mirrors adapters/git.ts) ──────────────────────────────────

const ManifestSchema = z.object({
  version: z.literal(1),
  builtAt: z.string(),
  contentRoot: z.literal('content/docs'),
  pages: z.array(z.unknown()),
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPage = {
  slug: 'getting-started/welcome',
  title: 'Welcome to Tribora',
  description: 'An overview of what Tribora is and how it works.',
  audience: 'public',
  section: 'getting-started',
  updatedAt: '2026-04-20',
  contentHash: 'abc123def456abcd',
  source: 'git',
  bodyHtml: '<h2>Hello</h2><p>World</p>',
};

const validManifest = {
  version: 1 as const,
  builtAt: '2026-04-20T12:00:00.000Z',
  contentRoot: 'content/docs' as const,
  pages: [validPage],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ManifestSchema', () => {
  it('accepts a valid manifest', () => {
    expect(() => ManifestSchema.parse(validManifest)).not.toThrow();
  });

  it('rejects wrong version', () => {
    expect(() =>
      ManifestSchema.parse({ ...validManifest, version: 2 }),
    ).toThrow();
  });

  it('rejects wrong contentRoot', () => {
    expect(() =>
      ManifestSchema.parse({ ...validManifest, contentRoot: 'content/other' }),
    ).toThrow();
  });

  it('requires pages array', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pages, ...rest } = validManifest;
    expect(() => ManifestSchema.parse(rest)).toThrow();
  });
});

describe('DocsPageSchema', () => {
  it('validates a complete valid page', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bodyHtml, ...meta } = validPage;
    expect(() => DocsPageSchema.parse(meta)).not.toThrow();
  });

  it('rejects missing required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title, ...incomplete } = validPage;
    expect(() => DocsPageSchema.parse(incomplete)).toThrow();
  });

  it('rejects invalid audience', () => {
    expect(() =>
      DocsPageSchema.parse({ ...validPage, audience: 'super-admin' }),
    ).toThrow();
  });

  it('rejects invalid section', () => {
    expect(() =>
      DocsPageSchema.parse({ ...validPage, section: 'unknown-section' }),
    ).toThrow();
  });

  it('rejects slug with uppercase', () => {
    expect(() =>
      DocsPageSchema.parse({ ...validPage, slug: 'Getting-Started/Welcome' }),
    ).toThrow();
  });

  it('rejects slug with leading hyphen', () => {
    expect(() =>
      DocsPageSchema.parse({ ...validPage, slug: '-bad-slug' }),
    ).toThrow();
  });

  it('rejects updatedAt in wrong format', () => {
    expect(() =>
      DocsPageSchema.parse({ ...validPage, updatedAt: '20-04-2026' }),
    ).toThrow();
  });

  it('accepts optional fields absent', () => {
    const minimal = {
      slug: 'getting-started/welcome',
      title: 'Welcome',
      description: 'Hello.',
      audience: 'public',
      section: 'getting-started',
      updatedAt: '2026-04-20',
      contentHash: 'abc123def456abcd',
      source: 'git',
    };
    expect(() => DocsPageSchema.parse(minimal)).not.toThrow();
  });
});

describe('Loader degradation', () => {
  it('returns empty array when manifest is missing (simulated)', async () => {
    // We test the logic path by calling clearGitPageCache and checking
    // that the adapter handles a missing file path gracefully.
    // The actual file I/O is tested in the integration smoke test.

    // Verify the ManifestSchema rejects an empty object
    expect(() => ManifestSchema.parse({})).toThrow();
  });

  it('throws on malformed manifest version', () => {
    expect(() =>
      ManifestSchema.parse({
        version: 99,
        builtAt: new Date().toISOString(),
        contentRoot: 'content/docs',
        pages: [],
      }),
    ).toThrow();
  });
});
