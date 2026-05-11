/**
 * Git-backed docs adapter.
 *
 * Loads pages from the build-time manifest at
 * `src/lib/docs/generated/manifest.json`.
 *
 * The manifest is produced by `scripts/docs/build.ts` (run via `npm run prebuild`).
 * If the manifest is absent (fresh clone before first build), returns [] and logs
 * a warning — the site degrades to an empty docs listing rather than crashing.
 *
 * See plan §6.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { createLogger } from '@/lib/utils/logger';

import { parseDocsPage } from '../schema';
import type { DocsPage } from '../types';

const logger = createLogger({});

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocsPageWithBody extends DocsPage {
  bodyHtml: string;
}

// ── Manifest schema ───────────────────────────────────────────────────────────

const ManifestSchema = z.object({
  version: z.literal(1),
  builtAt: z.string(),
  contentRoot: z.literal('content/docs'),
  // Each page is validated individually below via parseDocsPage
  pages: z.array(z.unknown()),
});

// ── Module-level cache ────────────────────────────────────────────────────────

let cached: DocsPageWithBody[] | null = null;

// ── Loaders ───────────────────────────────────────────────────────────────────

/** Load all git-backed pages (without body HTML). Used by the registry. */
export async function loadGitPages(): Promise<DocsPage[]> {
  const pages = await loadGitPagesWithBody();
  // Strip bodyHtml — the registry only needs metadata
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return pages.map(({ bodyHtml, ...meta }) => meta as DocsPage);
}

/** Load all git-backed pages including compiled HTML. Used by the page renderer. */
async function loadGitPagesWithBody(): Promise<DocsPageWithBody[]> {
  if (cached) return cached;

  const manifestPath = join(
    process.cwd(),
    'src',
    'lib',
    'docs',
    'generated',
    'manifest.json',
  );

  if (!existsSync(manifestPath)) {
    logger.warn(
      '[docs:git] manifest.json not found — /docs will render empty. ' +
        'Run `npm run prebuild` to generate it.',
    );
    return (cached = []);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `[docs:manifest] failed to parse manifest.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Validate top-level shape
  const manifest = ManifestSchema.parse(raw);

  const pages: DocsPageWithBody[] = [];

  for (const entry of manifest.pages) {
    const pageEntry = entry as { bodyHtml?: unknown; [k: string]: unknown };
    const { bodyHtml, ...meta } = pageEntry;

    // Validate page metadata
    const page = parseDocsPage(meta);

    pages.push({
      ...page,
      bodyHtml: typeof bodyHtml === 'string' ? bodyHtml : '',
    });
  }

  cached = pages;
  return cached;
}

/**
 * Look up the compiled HTML for a specific slug.
 * Returns undefined if the slug is not found or the manifest is not loaded.
 *
 * The caller must have triggered `loadGitPages()` or `loadGitPagesWithBody()`
 * first (which happens automatically via the registry on every request).
 */
export function findGitPageBody(slug: string): string | undefined {
  return cached?.find((p) => p.slug === slug)?.bodyHtml;
}

/** Clear the module-level cache. Useful in tests. */
function clearGitPageCache(): void {
  cached = null;
}
