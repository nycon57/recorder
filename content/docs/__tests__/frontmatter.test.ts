/**
 * Frontmatter validation test — TRIB-154
 *
 * Discovers every .md file under content/docs/ and validates the frontmatter
 * against parseDocsPage. Any file that fails Zod is a hard test failure.
 *
 * This runs as part of `npm test` so CI catches authoring errors before deploy.
 * The same gate runs at build time via `npm run prebuild`, but this test gives
 * a faster, more granular error message during development.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parseFrontmatter } from '../../../scripts/docs/lib/parse-frontmatter';
import { parseDocsPage } from '../../../src/lib/docs/schema';

// ── File discovery ────────────────────────────────────────────────────────────

const CONTENT_ROOT = join(process.cwd(), 'content', 'docs');

function discoverMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    // Skip authoring scratch dirs/files
    if (entry.name.startsWith('_')) continue;
    // Skip test directory itself
    if (entry.name === '__tests__') continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...discoverMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

// ── Slug derivation (mirrors scripts/docs/build.ts logic) ────────────────────

function deriveSlug(filePath: string): string {
  const rel = relative(CONTENT_ROOT, filePath);
  let slug = rel.replace(/\\/g, '/').replace(/\.md$/, '');
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -6); // strip /index suffix
  }
  return slug;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('docs frontmatter validation', () => {
  let markdownFiles: string[];

  beforeAll(() => {
    try {
      markdownFiles = discoverMarkdownFiles(CONTENT_ROOT);
    } catch {
      markdownFiles = [];
    }
  });

  it('discovers at least one markdown file', () => {
    expect(markdownFiles.length).toBeGreaterThan(0);
  });

  it('validates all discovered pages against DocsPageSchema', () => {
    const errors: string[] = [];

    for (const filePath of markdownFiles) {
      const source = readFileSync(filePath, 'utf8');
      const slug = deriveSlug(filePath);
      const { data } = parseFrontmatter(source);

      // Inject derived fields that the loader would normally supply
      const candidate = {
        ...data,
        slug,
        updatedAt: '2026-04-20', // stub — loader uses git log
        source: 'git' as const,
        contentHash: 'test000000000000',
      };

      try {
        parseDocsPage(candidate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${relative(process.cwd(), filePath)}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      fail(`Frontmatter validation failed for ${errors.length} page(s):\n\n${errors.join('\n\n')}`);
    }
  });

  it('all admin pages have a recognized audience', () => {
    const validAudiences = new Set(['public', 'org-admin', 'system-admin']);

    for (const filePath of markdownFiles) {
      const source = readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(source);

      if (data.audience !== undefined) {
        const rel = relative(process.cwd(), filePath);
        expect(`${rel} audience: ${data.audience}`).toBe(
          `${rel} audience: ${validAudiences.has(data.audience as string) ? data.audience : '<INVALID>'}`,
        );
      }
    }
  });

  it('system-admin pages are in system-admin sections', () => {
    const systemAdminSections = new Set([
      'platform-runbooks',
      'vendor-sources',
      'system-admin',
      'security',
    ]);

    for (const filePath of markdownFiles) {
      const source = readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(source);

      if (data.audience === 'system-admin') {
        const rel = relative(process.cwd(), filePath);
        expect(systemAdminSections.has(data.section as string)).toBe(true);
        if (!systemAdminSections.has(data.section as string)) {
          throw new Error(`${rel}: system-admin page in wrong section: "${data.section}"`);
        }
      }
    }
  });

  it('org-admin pages are in org-admin sections', () => {
    const orgAdminSections = new Set([
      'knowledge-ops',
      'org-admin',
      'observability',
    ]);

    for (const filePath of markdownFiles) {
      const source = readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(source);

      if (data.audience === 'org-admin') {
        const rel = relative(process.cwd(), filePath);
        expect(orgAdminSections.has(data.section as string)).toBe(true);
        if (!orgAdminSections.has(data.section as string)) {
          throw new Error(`${rel}: org-admin page in wrong section: "${data.section}"`);
        }
      }
    }
  });
});
