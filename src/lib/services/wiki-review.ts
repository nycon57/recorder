/**
 * Wiki Review Service — TRIB-34
 *
 * Shared helpers for the admin review UI that surfaces flagged contradictions
 * in `org_wiki_pages.compilation_log`. Consumes the JSONB log entries produced
 * by TRIB-32's contradiction detection and provides the read + count paths
 * used by `/admin/wiki-review` and the admin nav badge.
 *
 * A "pending contradiction" is a `compilation_log` entry where:
 *   - action === 'flagged'
 *   - resolved_at === null
 *
 * The `compilation_log` column is a JSONB array of entries; this module never
 * mutates it in place — every write goes through the server actions in
 * `src/app/(dashboard)/admin/wiki-review/actions.ts` so auth and audit
 * semantics stay centralized.
 */

import { unstable_cache } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

export type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];

/**
 * Canonical shape of a single entry inside `org_wiki_pages.compilation_log`.
 *
 * Mirrors the TRIB-32 writer in `src/lib/workers/handlers/compile-wiki.ts`.
 * Keep these fields in lockstep with that writer — changing one without the
 * other will silently drop admin-review data.
 */
export interface CompilationLogEntry {
  action: 'created' | 'additive' | 'redundant' | 'flagged' | 'applied' | 'rejected';
  source_recording_id: string;
  detected_at: string;
  contradictions?: Array<{
    old: string;
    new: string;
    field?: string;
  }>;
  additions?: string[];
  confidence_delta?: number;
  /** Optional: may be populated when TRIB-32 evolves to stash merged_content. */
  merged_content?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

/**
 * A flagged (pending) contradiction enriched with its array index so the
 * approve / reject / edit-and-approve server actions can target it.
 */
export interface PendingContradiction {
  /** Zero-based index into `compilation_log`. */
  entryIndex: number;
  entry: CompilationLogEntry;
}

/**
 * A page surfaced to the admin review UI. Contains the whole DB row plus the
 * list of pending entries (newest last, just as they were appended).
 */
export interface PendingReviewPage {
  page: OrgWikiPageRow;
  pendingEntries: PendingContradiction[];
}

/**
 * Safely coerce the `compilation_log` JSONB value into a typed array.
 * Defensive against legacy `null`, `{}`, or non-array shapes that may exist
 * from earlier migrations. Matches the helper used inside `compile-wiki.ts`.
 */
export function readCompilationLog(value: Json | null | undefined): CompilationLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value as unknown as CompilationLogEntry[];
}

/**
 * Find all unresolved `flagged` entries in a compilation log, preserving
 * their array index so callers can patch the right slot in place.
 */
export function extractPendingContradictions(
  log: CompilationLogEntry[]
): PendingContradiction[] {
  const pending: PendingContradiction[] = [];
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry?.action === 'flagged' && (entry.resolved_at ?? null) === null) {
      pending.push({ entryIndex: i, entry });
    }
  }
  return pending;
}

/**
 * Fetch every live `org_wiki_pages` row for the org whose `compilation_log`
 * contains at least one `flagged` entry, and return only those rows that
 * still have at least one unresolved pending entry. "Live" means
 * `valid_until IS NULL` — superseded rows are never surfaced.
 *
 * The JSONB containment filter narrows the DB work; the per-row filter in JS
 * discards pages where every flagged entry has already been resolved.
 */
export async function listPendingReviewPages(orgId: string): Promise<PendingReviewPage[]> {
  const { data, error } = await supabaseAdmin
    .from('org_wiki_pages')
    .select(
      'id, org_id, app, screen, topic, content, confidence, valid_from, valid_until, supersedes_id, compilation_log, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .is('valid_until', null)
    .contains('compilation_log', [{ action: 'flagged' }])
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list pending wiki review pages: ${error.message}`);
  }

  const rows = (data ?? []) as OrgWikiPageRow[];
  const pages: PendingReviewPage[] = [];

  for (const row of rows) {
    const log = readCompilationLog(row.compilation_log);
    const pending = extractPendingContradictions(log);
    if (pending.length > 0) {
      pages.push({ page: row, pendingEntries: pending });
    }
  }

  return pages;
}

/**
 * Count unresolved pending contradictions across all live pages in the org.
 * Used by the admin nav badge. Cached for 60 seconds via `unstable_cache` and
 * keyed on `orgId` so invalidation stays per-tenant.
 */
export function getPendingReviewCount(orgId: string): Promise<number> {
  return unstable_cache(
    async (id: string) => {
      const { data, error } = await supabaseAdmin
        .from('org_wiki_pages')
        .select('compilation_log')
        .eq('org_id', id)
        .is('valid_until', null)
        .contains('compilation_log', [{ action: 'flagged' }]);

      if (error) {
        console.warn('[wiki-review] Failed to count pending contradictions:', error.message);
        return 0;
      }

      let total = 0;
      const rows = (data ?? []) as Array<{ compilation_log: Json | null }>;
      for (const row of rows) {
        const log = readCompilationLog(row.compilation_log);
        total += extractPendingContradictions(log).length;
      }
      return total;
    },
    ['wiki-review-pending-count', orgId],
    { revalidate: 60, tags: [`wiki-review-count:${orgId}`] }
  )(orgId);
}

/**
 * Apply a flagged entry's contradictions to an existing page body by running
 * each `{ old, new }` pair as a literal string replacement (first occurrence
 * only). This is the fallback used when the flagged entry did not persist a
 * full `merged_content` block — matching the spec guidance to "surface
 * merged_content if present, otherwise show the contradictions list."
 *
 * The result is intentionally conservative: we only touch substrings that
 * match exactly, so a noisy LLM contradiction payload cannot silently rewrite
 * the whole page. If the admin wants a broader edit, "Edit & Approve" is the
 * path that lets them author the final content by hand.
 */
export function applyContradictionsToContent(
  content: string,
  contradictions: Array<{ old: string; new: string }> | undefined
): string {
  if (!contradictions || contradictions.length === 0) {
    return content;
  }

  let next = content;
  for (const { old, new: replacement } of contradictions) {
    if (typeof old !== 'string' || typeof replacement !== 'string' || old.length === 0) {
      continue;
    }
    const idx = next.indexOf(old);
    if (idx === -1) continue;
    next = next.slice(0, idx) + replacement + next.slice(idx + old.length);
  }
  return next;
}
