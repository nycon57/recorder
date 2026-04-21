/**
 * Database-backed docs adapter — TRIB-154 implementation.
 *
 * Loads published pages from the `docs_pages` table using the service-role
 * admin client. Each row is Zod-validated before inclusion; invalid rows are
 * dropped with a warning so a single bad row never breaks the whole registry.
 *
 * Body resolution (`findDbPageBody`) is intentionally separate from the list
 * loader so the registry never pays the body-transfer cost on every request.
 * Body compilation is cached per-slug with tag `docs:db:body:<slug>`.
 */

import { createClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

import { parseDocsPage } from '../schema';
import type { DocsPage } from '../types';

const logger = createLogger();

// ── Page list loader ──────────────────────────────────────────────────────────

/**
 * Load all published DB-backed pages as DocsPage metadata.
 * Body HTML is NOT included — call `findDbPageBody(slug)` for that.
 *
 * Wrapped in `unstable_cache` with `tags: ['docs:db']` by the registry.
 * This function itself is uncached — the registry owns the cache layer.
 */
export async function loadDbPages(): Promise<DocsPage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('docs_pages')
    .select(
      'slug, title, description, audience, section, "group", "order", related, tags, unlisted, content_hash, updated_at, published',
    )
    .eq('published', true);

  if (error) {
    logger.warn('[docs:db] loadDbPages failed — degrading to git-only', {
      data: { message: error.message, code: error.code },
    });
    return [];
  }

  const pages: DocsPage[] = [];

  for (const row of data ?? []) {
    try {
      const parsed = parseDocsPage({
        slug: row.slug,
        title: row.title,
        description: row.description,
        audience: row.audience,
        section: row.section,
        group: row.group ?? undefined,
        order: row.order ?? undefined,
        related: Array.isArray(row.related) ? (row.related as string[]) : undefined,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
        unlisted: row.unlisted,
        draft: false, // published=true filter above excludes drafts
        updatedAt: String(row.updated_at).slice(0, 10),
        source: 'db' as const,
        contentHash: row.content_hash,
      });
      pages.push(parsed);
    } catch (err) {
      logger.warn('[docs:db] Zod validation failed — dropping row', {
        data: {
          slug: row.slug,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return pages;
}

// ── Body resolver ─────────────────────────────────────────────────────────────

export interface DbPageBody {
  bodyHtml: string;
  bodyMarkdown: string;
}

/**
 * Fetch the compiled HTML body for a DB-backed page.
 *
 * First read: returns `body_html_cached` when populated.
 * Cache miss: compiles `body_markdown` via the TRIB-150 pipeline, writes the
 *             result back to `body_html_cached` (best-effort, non-fatal on
 *             failure), then returns the freshly compiled HTML.
 *
 * Callers should wrap this in `unstable_cache` with tag `docs:db:body:<slug>`
 * so admin revalidation can bust a single page without clearing the whole list.
 *
 * Returns null if the slug is not found or not published.
 */
export async function findDbPageBody(slug: string): Promise<DbPageBody | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('docs_pages')
    .select('body_markdown, body_html_cached')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    logger.warn('[docs:db] findDbPageBody query failed', {
      data: { slug, message: error.message },
    });
    return null;
  }

  if (!data) return null;

  // Cache hit — return immediately
  if (data.body_html_cached) {
    return { bodyHtml: data.body_html_cached, bodyMarkdown: data.body_markdown };
  }

  // Cache miss — compile via the TRIB-150 pipeline
  let bodyHtml: string;
  try {
    const { compileMarkdown } = await import(
      /* webpackIgnore: true */
      '../../../../scripts/docs/lib/compile-markdown'
    );
    bodyHtml = await compileMarkdown(data.body_markdown);
  } catch (compileErr) {
    logger.warn('[docs:db] findDbPageBody compile failed', {
      data: {
        slug,
        error: compileErr instanceof Error ? compileErr.message : String(compileErr),
      },
    });
    // Degrade: return raw markdown wrapped in a <pre> rather than crashing
    bodyHtml = `<pre>${data.body_markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }

  // Best-effort cache write — non-fatal if it fails
  try {
    await supabase
      .from('docs_pages')
      .update({ body_html_cached: bodyHtml })
      .eq('slug', slug);
  } catch (cacheWriteErr) {
    logger.warn('[docs:db] findDbPageBody cache write failed', {
      data: {
        slug,
        error: cacheWriteErr instanceof Error ? cacheWriteErr.message : String(cacheWriteErr),
      },
    });
  }

  return { bodyHtml, bodyMarkdown: data.body_markdown };
}
