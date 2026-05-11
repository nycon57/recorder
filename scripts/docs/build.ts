#!/usr/bin/env tsx
/**
 * scripts/docs/build.ts
 *
 * Prebuild orchestrator for the docs content pipeline.
 *
 * Responsibilities (see plan §5):
 *  1. Glob content/docs/**\/*.md
 *  2. For each file: derive slug, parse frontmatter, compile HTML, compute hash
 *  3. Drop draft pages in production
 *  4. Validate related links (warn, never exit non-zero)
 *  5. Write src/lib/docs/generated/manifest.json
 *  6. Write public/docs/search/{public,org-admin,system-admin}.json
 *  7. Print summary
 *
 * Errors during compile → process.exit(1) with clear context.
 * Missing content directory → empty manifest (safe degradation, see plan §R8).
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import process from 'node:process';

import { parseDocsPage } from '../../src/lib/docs/schema';
import { validateRelatedLinks } from '../../src/lib/docs/registry';
import type { DocsPage } from '../../src/lib/docs/types';

import { parseFrontmatter } from './lib/parse-frontmatter';
import { compileMarkdown, disposeHighlighter } from './lib/compile-markdown';
import { getUpdatedAt } from './lib/git-updated-at';
import { buildSearchIndexes } from './lib/build-search-index';
import type { CompiledPage } from './lib/build-search-index';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const CONTENT_ROOT = join(ROOT, 'content', 'docs');
const GENERATED_DIR = join(ROOT, 'src', 'lib', 'docs', 'generated');
const PUBLIC_SEARCH_DIR = join(ROOT, 'public', 'docs', 'search');
const MANIFEST_PATH = join(GENERATED_DIR, 'manifest.json');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Slug derivation ───────────────────────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9][a-z0-9/-]*$/;

/**
 * Derive a docs slug from an absolute file path.
 * See plan §1.
 */
function deriveSlug(filepath: string): string {
  const rel = relative(CONTENT_ROOT, filepath);
  // Normalise Windows separators
  const normalised = rel.split(sep).join('/');
  // Strip .md extension
  let slug = normalised.replace(/\.md$/, '');
  // index.md → parent directory slug
  if (slug.endsWith('/index')) {
    slug = slug.slice(0, -'/index'.length) || 'index';
  }

  if (!SLUG_REGEX.test(slug)) {
    throw new Error(
      `[docs:build] invalid slug derived from "${rel}": "${slug}" does not match ^[a-z0-9][a-z0-9/-]*$`,
    );
  }

  return slug;
}

// ── Content hash ──────────────────────────────────────────────────────────────

function computeHash(rawYaml: string, body: string): string {
  return createHash('sha256')
    .update(rawYaml)
    .update('\n---\n')
    .update(body)
    .digest('hex')
    .slice(0, 16);
}

// ── File glob ─────────────────────────────────────────────────────────────────

function globMarkdownFiles(): string[] {
  if (!existsSync(CONTENT_ROOT)) {
    return [];
  }
  return walkDir(CONTENT_ROOT);
}

/**
 * Recursively walk `dir`, returning absolute paths to all `.md` files.
 * Skips:
 *  - Entries starting with `_` (authoring scratch)
 *  - Files at the content root level that start with uppercase (e.g. README.md)
 */
function walkDir(dir: string, isRoot = true): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    // Skip authoring scratch
    if (entry.startsWith('_')) continue;
    // Skip uppercase-named files at root level (e.g. README.md)
    if (isRoot && /^[A-Z]/.test(entry)) continue;

    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full, false));
    } else if (entry.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface CompiledEntry extends DocsPage {
  bodyHtml: string;
}

async function main(): Promise<void> {
  const startMs = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Ensure output directories exist
  mkdirSync(GENERATED_DIR, { recursive: true });
  mkdirSync(PUBLIC_SEARCH_DIR, { recursive: true });

  const files = globMarkdownFiles();

  if (files.length === 0) {
    console.warn(
      '[docs:build] No markdown files found under content/docs/. Writing empty manifest.',
    );
  }

  const pages = (
    await Promise.all(
      files.map(async (filepath): Promise<CompiledEntry | null> => {
        const relDisplay = relative(ROOT, filepath);

        try {
          const source = readFileSync(filepath, 'utf8');
          const { data, body, rawYaml } = parseFrontmatter(source);

          // Reject authored slug or updatedAt — must be derived
          if ('slug' in data) {
            throw new Error(
              `"slug" must be derived from file path, not authored. Remove it from frontmatter.`,
            );
          }
          if ('updatedAt' in data) {
            throw new Error(
              `"updatedAt" must be derived from git log, not authored. Remove it from frontmatter.`,
            );
          }

          const slug = deriveSlug(filepath);
          const updatedAt = getUpdatedAt(filepath);
          const contentHash = computeHash(rawYaml, body);

          // Assemble full page object
          const raw = {
            ...data,
            slug,
            updatedAt,
            contentHash,
            source: 'git' as const,
          };

          // Validate via Zod — throws on invalid frontmatter
          const page = parseDocsPage(raw);

          // Skip draft pages in production
          if (page.draft && IS_PRODUCTION) {
            return null;
          }

          // Compile Markdown → HTML
          const bodyHtml = await compileMarkdown(body);

          return { ...page, bodyHtml };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`[docs:build] ${relDisplay}: ${msg}`);
          return null;
        }
      }),
    )
  ).filter((page): page is CompiledEntry => Boolean(page));

  // Validate related links (warn only — never fail)
  const pageMap = new Map<string, DocsPage>(pages.map((p) => [p.slug, p]));
  // validateRelatedLinks logs internally; we capture stderr warnings here
  validateRelatedLinks(pageMap);

  // Write manifest
  const manifest = {
    version: 1 as const,
    builtAt: new Date().toISOString(),
    contentRoot: 'content/docs' as const,
    pages,
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  // Build and write search indexes
  const searchIndexes = buildSearchIndexes(pages as CompiledPage[]);

  writeFileSync(
    join(PUBLIC_SEARCH_DIR, 'public.json'),
    JSON.stringify(searchIndexes.public, null, 2),
    'utf8',
  );
  writeFileSync(
    join(GENERATED_DIR, 'search-index.org-admin.json'),
    JSON.stringify(searchIndexes['org-admin'], null, 2),
    'utf8',
  );
  writeFileSync(
    join(GENERATED_DIR, 'search-index.system-admin.json'),
    JSON.stringify(searchIndexes['system-admin'], null, 2),
    'utf8',
  );

  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(1);

  // Summary
  console.log(
    `[docs:build] ${pages.length} pages compiled in ${elapsedS}s` +
      ` (${errors.length} errors, ${warnings.length} warnings)`,
  );

  for (const w of warnings) {
    console.warn(w);
  }

  // Dispose Shiki singleton
  disposeHighlighter();

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(e);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[docs:build] Fatal error:', err);
  process.exit(1);
});
