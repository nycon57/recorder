/** @jest-environment node */

/**
 * Runbook frontmatter validation.
 *
 * Reads every markdown file under content/docs/ and validates the frontmatter
 * against a subset of DocsPageSchema (excluding loader-computed fields:
 * `source` and `contentHash`).
 *
 * This test catches authoring drift before TRIB-150's content pipeline lands.
 * It must pass on every PR that touches content/docs/.
 *
 * TRIB-152
 */

import { describe, expect, test } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { z } from 'zod';

// ---- Authored frontmatter schema -------------------------------------------
// Matches DocsPageSchema but omits loader-computed fields (source, contentHash).

const slugRegex = /^[a-z0-9][a-z0-9/-]*$/;

const AuthoredFrontmatterSchema = z.object({
  slug: z.string().regex(slugRegex, 'Slug must match ^[a-z0-9][a-z0-9/-]*$'),
  title: z.string().min(1),
  description: z.string().min(1),
  audience: z.enum(['public', 'org-admin', 'system-admin']),
  section: z.enum([
    'getting-started',
    'product',
    'integrations',
    'reference',
    'policies',
    'knowledge-ops',
    'org-admin',
    'observability',
    'platform-runbooks',
    'vendor-sources',
    'system-admin',
    'security',
  ]),
  order: z.number().int().optional(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'updatedAt must be YYYY-MM-DD'),
  related: z.array(z.string().regex(slugRegex)).optional(),
  tags: z.array(z.string()).optional(),
});

// ---- File discovery --------------------------------------------------------

const DOCS_ROOT = join(process.cwd(), 'content/docs');

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...collectMarkdownFiles(fullPath));
      } else if (entry.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch {
    // dir may not exist in test environments where content/ is gitignored
  }
  return files;
}

const markdownFiles = collectMarkdownFiles(DOCS_ROOT);

// ---- Tests -----------------------------------------------------------------

describe('content/docs runbook frontmatter', () => {
  test('content/docs directory exists and contains markdown files', () => {
    expect(markdownFiles.length).toBeGreaterThan(0);
  });

  const expectedSlugs = [
    'platform-runbooks/incident-response',
    'vendor-sources/sync-lifecycle',
    'vendor-sources/failure-handling',
    'vendor-sources/governance',
    'vendor-sources/cost-and-quotas',
    'vendor-sources/preview-and-health',
  ];

  test.each(expectedSlugs)('expected runbook exists: %s', (slug) => {
    const hasSlug = markdownFiles.some((f) => {
      const raw = readFileSync(f, 'utf-8');
      const { data } = matter(raw);
      return data.slug === slug;
    });
    expect(hasSlug).toBe(true);
  });

  describe.each(markdownFiles)('%s', (filePath) => {
    let frontmatter: Record<string, unknown>;

    beforeAll(() => {
      const raw = readFileSync(filePath, 'utf-8');
      const { data } = matter(raw);
      frontmatter = data;
    });

    test('frontmatter parses against AuthoredFrontmatterSchema', () => {
      const result = AuthoredFrontmatterSchema.safeParse(frontmatter);
      if (!result.success) {
        throw new Error(
          `${filePath} frontmatter validation failed:\n${result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`
        );
      }
    });

    test('audience is system-admin', () => {
      expect(frontmatter.audience).toBe('system-admin');
    });

    test('section is platform-runbooks or vendor-sources', () => {
      expect(['platform-runbooks', 'vendor-sources']).toContain(frontmatter.section);
    });

    test('slug matches directory structure', () => {
      // slug: vendor-sources/sync-lifecycle should be in content/docs/vendor-sources/sync-lifecycle.md
      const slug = String(frontmatter.slug ?? '');
      const relativePath = filePath
        .replace(DOCS_ROOT + '/', '')
        .replace(/\.md$/, '');
      expect(relativePath).toBe(slug);
    });
  });
});
