'use server';

/**
 * Admin wiki review server actions — TRIB-34
 *
 * Three mutations against `org_wiki_pages.compilation_log` flagged entries:
 *
 *   - approveContradiction: supersede the page with either the flagged
 *     entry's `merged_content` (if TRIB-32 ever stashes one) or a naive
 *     application of the contradictions list.
 *   - rejectContradiction: mark the flagged entry rejected in place and
 *     leave page content untouched.
 *   - editAndApproveContradiction: supersede the page with admin-provided
 *     content.
 *
 * All three:
 *   1. Call `requireAdmin()` — owner/admin role in the page's org.
 *   2. Verify the target page belongs to the caller's org.
 *   3. Patch the flagged log entry with `resolved_at` + `resolved_by`.
 *   4. Use the supersede pattern (valid_until + new row with supersedes_id)
 *      for approve paths, matching TRIB-32's auto-publish branch.
 *   5. `revalidatePath('/admin/wiki-review')` so the page re-renders empty
 *      when the last pending entry is resolved.
 *   6. `updateTag('wiki-review-count:<orgId>')` so the nav badge updates
 *      with read-your-own-writes semantics on the next render.
 */

import { revalidatePath, updateTag } from 'next/cache';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/utils/api';
import { logger } from '@/lib/utils/logger';
import type { Database, Json } from '@/lib/types/database';
import {
  applyContradictionsToContent,
  readCompilationLog,
  type CompilationLogEntry,
  type OrgWikiPageRow,
} from '@/lib/services/wiki-review';

type OrgWikiPageInsert = Database['public']['Tables']['org_wiki_pages']['Insert'];

const WIKI_REVIEW_PATH = '/admin/wiki-review';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface LoadedTarget {
  page: OrgWikiPageRow;
  log: CompilationLogEntry[];
  entry: CompilationLogEntry;
}

/**
 * Load the page + validate the flagged entry at `logEntryIndex`. Throws with
 * human-readable messages so the calling action can surface them via
 * `ActionResult.error`.
 */
async function loadAndValidateTarget(input: {
  pageId: string;
  logEntryIndex: number;
  orgId: string;
}): Promise<LoadedTarget> {
  const { pageId, logEntryIndex, orgId } = input;

  const { data, error } = await supabaseAdmin
    .from('org_wiki_pages')
    .select(
      'id, org_id, app, screen, topic, content, confidence, valid_from, valid_until, supersedes_id, compilation_log, created_at, updated_at'
    )
    .eq('id', pageId)
    .single();

  if (error || !data) {
    throw new Error('Page not found');
  }

  const page = data as OrgWikiPageRow;

  if (page.org_id !== orgId) {
    throw new Error('Page does not belong to your organization');
  }

  if (page.valid_until !== null) {
    throw new Error('Page has already been superseded');
  }

  const log = readCompilationLog(page.compilation_log);
  const entry = log[logEntryIndex];

  if (!entry) {
    throw new Error('Log entry not found');
  }

  if (entry.action !== 'flagged') {
    throw new Error(`Log entry is already ${entry.action}`);
  }

  if ((entry.resolved_at ?? null) !== null) {
    throw new Error('Log entry has already been resolved');
  }

  return { page, log, entry };
}

/**
 * Clamp a confidence value into [0, 1]. Mirrors the helper in compile-wiki.
 */
function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/**
 * Supersede the current page and insert a new row with the given content.
 * Writes an `applied` log entry on the new row that carries `resolved_at`
 * and `resolved_by`, matching TRIB-32's `applyContradictionWithSupersede`.
 */
async function supersedeWithContent(input: {
  existingPage: OrgWikiPageRow;
  existingLog: CompilationLogEntry[];
  entryIndex: number;
  newContent: string;
  userId: string;
  nowIso: string;
}): Promise<void> {
  const { existingPage, existingLog, entryIndex, newContent, userId, nowIso } = input;
  const originalEntry = existingLog[entryIndex];

  const { error: supersedeError } = await supabaseAdmin
    .from('org_wiki_pages')
    .update({ valid_until: nowIso } as never)
    .eq('id', existingPage.id);

  if (supersedeError) {
    throw new Error(`Failed to supersede page ${existingPage.id}: ${supersedeError.message}`);
  }

  // Preserve the full prior history, but swap the flagged entry for its
  // resolved counterpart so the new page keeps an auditable trail.
  const resolvedEntry: CompilationLogEntry = {
    ...originalEntry,
    action: 'applied',
    resolved_at: nowIso,
    resolved_by: userId,
  };

  const carriedLog = [...existingLog];
  carriedLog[entryIndex] = resolvedEntry;

  const newConfidence = clampConfidence(
    (existingPage.confidence ?? 0.5) + (originalEntry.confidence_delta ?? 0)
  );

  const newPageInsert: OrgWikiPageInsert = {
    org_id: existingPage.org_id,
    app: existingPage.app,
    screen: existingPage.screen,
    topic: existingPage.topic,
    content: newContent,
    confidence: newConfidence,
    supersedes_id: existingPage.id,
    compilation_log: carriedLog as unknown as Json,
  };

  const { error: insertError } = await supabaseAdmin
    .from('org_wiki_pages')
    .insert(newPageInsert as never);

  if (insertError) {
    throw new Error(`Failed to insert superseding page for ${existingPage.id}: ${insertError.message}`);
  }
}

/**
 * Patch a single flagged entry in place on the given page (no supersede,
 * no content change). Used by `rejectContradiction`.
 */
async function patchLogEntryInPlace(input: {
  pageId: string;
  existingLog: CompilationLogEntry[];
  entryIndex: number;
  patch: Partial<CompilationLogEntry>;
}): Promise<void> {
  const { pageId, existingLog, entryIndex, patch } = input;
  const nextLog = [...existingLog];
  nextLog[entryIndex] = { ...existingLog[entryIndex], ...patch };

  const { error } = await supabaseAdmin
    .from('org_wiki_pages')
    .update({ compilation_log: nextLog as unknown as Json } as never)
    .eq('id', pageId);

  if (error) {
    throw new Error(`Failed to patch compilation_log on page ${pageId}: ${error.message}`);
  }
}

function invalidate(orgId: string): void {
  revalidatePath(WIKI_REVIEW_PATH);
  // updateTag gives read-your-own-writes semantics in server actions, so the
  // admin nav badge reflects the fresh count on the very next render.
  updateTag(`wiki-review-count:${orgId}`);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Approve a flagged contradiction. Supersedes the existing page with new
 * content — either the flagged entry's stored `merged_content` (when
 * present) or a conservative string-replacement fallback that applies each
 * `{ old, new }` pair from the contradictions list to the page body.
 */
export async function approveContradiction(input: {
  pageId: string;
  logEntryIndex: number;
}): Promise<ActionResult> {
  try {
    const { userId, orgId } = await requireAdmin();
    const { page, log, entry } = await loadAndValidateTarget({ ...input, orgId });

    const mergedContent = entry.merged_content?.trim();
    const nextContent = mergedContent && mergedContent.length > 0
      ? mergedContent
      : applyContradictionsToContent(page.content, entry.contradictions);

    if (nextContent === page.content) {
      // Nothing would actually change — treat as a no-op and reject the
      // entry so it stops re-appearing in the review queue.
      await patchLogEntryInPlace({
        pageId: page.id,
        existingLog: log,
        entryIndex: input.logEntryIndex,
        patch: { action: 'rejected', resolved_at: new Date().toISOString(), resolved_by: userId },
      });
      logger.warn('Approve resulted in no content change; auto-rejected', {
        context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
      });
      invalidate(orgId);
      return { ok: true };
    }

    await supersedeWithContent({
      existingPage: page,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      newContent: nextContent,
      userId,
      nowIso: new Date().toISOString(),
    });

    logger.info('Wiki contradiction approved', {
      context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('approveContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    return { ok: false, error: message };
  }
}

/**
 * Reject a flagged contradiction. Leaves the page content untouched and
 * marks the log entry as `rejected` with `resolved_at` / `resolved_by`.
 */
export async function rejectContradiction(input: {
  pageId: string;
  logEntryIndex: number;
}): Promise<ActionResult> {
  try {
    const { userId, orgId } = await requireAdmin();
    const { page, log } = await loadAndValidateTarget({ ...input, orgId });

    await patchLogEntryInPlace({
      pageId: page.id,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      patch: {
        action: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      },
    });

    logger.info('Wiki contradiction rejected', {
      context: { orgId, userId, pageId: page.id, logEntryIndex: input.logEntryIndex },
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('rejectContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    return { ok: false, error: message };
  }
}

/**
 * Approve a flagged contradiction with admin-edited content. Same supersede
 * mechanics as `approveContradiction` but uses the admin's rewritten body
 * instead of the LLM's `merged_content` or the fallback replacement.
 */
export async function editAndApproveContradiction(input: {
  pageId: string;
  logEntryIndex: number;
  editedContent: string;
}): Promise<ActionResult> {
  try {
    const { userId, orgId } = await requireAdmin();
    const { page, log } = await loadAndValidateTarget({
      pageId: input.pageId,
      logEntryIndex: input.logEntryIndex,
      orgId,
    });

    const editedContent = input.editedContent?.trim() ?? '';
    if (editedContent.length === 0) {
      return { ok: false, error: 'Edited content cannot be empty' };
    }

    await supersedeWithContent({
      existingPage: page,
      existingLog: log,
      entryIndex: input.logEntryIndex,
      newContent: editedContent,
      userId,
      nowIso: new Date().toISOString(),
    });

    logger.info('Wiki contradiction edited and approved', {
      context: {
        orgId,
        userId,
        pageId: page.id,
        logEntryIndex: input.logEntryIndex,
        contentLength: editedContent.length,
      },
    });

    invalidate(orgId);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('editAndApproveContradiction failed', {
      error: error instanceof Error ? error : undefined,
      context: { pageId: input.pageId, logEntryIndex: input.logEntryIndex },
    });
    return { ok: false, error: message };
  }
}
