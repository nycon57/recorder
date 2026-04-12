/**
 * Wiki Lint Service (TRIB-42)
 * ============================
 *
 * Karpathy-style "Lint" operation — five health checks that run daily on
 * every org's compiled wiki. See product-architecture-v2.md Part 3
 * Component 4 and Part 8 (What to Borrow from Karpathy's LLM Wiki).
 *
 * The scheduled Vercel cron at `POST /api/cron/wiki-lint` calls
 * {@link runWikiLintAllOrgs} once a day. Individual orgs can be re-linted
 * on demand via {@link runWikiLint}. Results are upserted into
 * `wiki_lint_results` (one row per org per UTC calendar day).
 *
 * All five checks only look at ACTIVE pages (`valid_until IS NULL`) —
 * superseded history is explicitly excluded per TRIB-40. The only check
 * that reaches into superseded pages is the stale-link scan, which needs
 * the superseded set as its "dangling target" list.
 *
 * The service owns the lint logic so it can be unit-tested independently
 * of the cron route handler. The handler is a thin auth + HTTP shim.
 */

import { createClient } from '@/lib/supabase/admin';
import { getWikiCompilationSettings } from '@/lib/services/agent-config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

type AdminClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrphanDetail {
  page_id: string;
  topic: string;
}

export interface StaleDetail {
  page_id: string;
  topic: string;
  last_contributed_at: string | null;
  threshold_days: number;
}

export interface StaleLinkDetail {
  page_id: string;
  topic: string;
  /** The `[[target]]` string that resolved to a superseded page. */
  target_topic: string;
  target_page_id: string;
}

export interface CoverageGapDetail {
  app: string;
  screen: string;
  vendor_pages_count: number;
}

export interface ConfidenceDecayDetail {
  page_id: string;
  topic: string;
  old_confidence: number;
  new_confidence: number;
}

export interface LintDetails {
  orphans: OrphanDetail[];
  stale: StaleDetail[];
  stale_links: StaleLinkDetail[];
  coverage_gaps: CoverageGapDetail[];
  confidence_decay: ConfidenceDecayDetail[];
}

export interface LintResult {
  org_id: string;
  run_at: string;
  orphan_count: number;
  stale_count: number;
  stale_link_count: number;
  coverage_gap_count: number;
  confidence_decay_count: number;
  details: LintDetails;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Confidence delta applied per lint run to stale pages. */
const CONFIDENCE_DECAY_STEP = 0.05;

/** Confidence floor. Once a page drops below this it is left alone. */
const CONFIDENCE_DECAY_FLOOR = 0.1;

/**
 * Age (in days) after which confidence decay triggers. PRD Part 3 Component 4
 * uses "haven't been corroborated by new recordings in a long time" — we fix
 * this at 90 days so decay is independent of the per-org stale threshold that
 * gates the separate `stale` check.
 */
const CONFIDENCE_DECAY_AGE_DAYS = 90;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run lint on every org that has at least one active `org_wiki_pages` row.
 * Failures are isolated per-org — one org erroring does not abort the run.
 * Returns successful lint results; failures are logged.
 */
export async function runWikiLintAllOrgs(): Promise<LintResult[]> {
  const supabase = createClient();
  const orgIds = await listOrgsWithWikiPages(supabase);

  const results: LintResult[] = [];
  for (const orgId of orgIds) {
    try {
      const result = await runWikiLint(orgId, supabase);
      results.push(result);
    } catch (err) {
      console.error(`[wiki-lint] org=${orgId} failed:`, err);
    }
  }
  return results;
}

/**
 * Run all 5 lint checks for a single org, persist the result row, and
 * return the computed `LintResult`. The caller supplies the Supabase admin
 * client for DI/testability; defaults to a fresh admin client.
 */
export async function runWikiLint(
  orgId: string,
  supabase: AdminClient = createClient()
): Promise<LintResult> {
  const runAt = new Date().toISOString();

  // Per-org configuration — stale threshold defaults to 90 days.
  const { wikiStaleThresholdDays } = await getWikiCompilationSettings(orgId);
  const staleThresholdDays = clampThreshold(wikiStaleThresholdDays);

  // Load the active page set once; every check reuses it.
  const activePages = await loadActivePages(supabase, orgId);

  const [orphans, stale, staleLinks, coverageGaps, decay] = await Promise.all([
    detectOrphans(supabase, orgId, activePages),
    detectStale(supabase, orgId, activePages, staleThresholdDays),
    detectStaleLinks(supabase, orgId, activePages),
    detectCoverageGaps(supabase, orgId, activePages),
    applyConfidenceDecay(supabase, orgId, activePages),
  ]);

  const details: LintDetails = {
    orphans,
    stale,
    stale_links: staleLinks,
    coverage_gaps: coverageGaps,
    confidence_decay: decay,
  };

  const result: LintResult = {
    org_id: orgId,
    run_at: runAt,
    orphan_count: orphans.length,
    stale_count: stale.length,
    stale_link_count: staleLinks.length,
    coverage_gap_count: coverageGaps.length,
    confidence_decay_count: decay.length,
    details,
  };

  await persistResult(supabase, result);
  return result;
}

// ---------------------------------------------------------------------------
// Data loading helpers
// ---------------------------------------------------------------------------

interface ActivePage {
  id: string;
  org_id: string;
  topic: string;
  content: string;
  confidence: number;
  app: string | null;
  screen: string | null;
}

async function listOrgsWithWikiPages(supabase: AdminClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('org_wiki_pages')
    .select('org_id')
    .is('valid_until', null);

  if (error) {
    throw new Error(`[wiki-lint] Failed to list orgs with wiki pages: ${error.message}`);
  }

  // De-dupe org_ids in JS — cheaper than a DISTINCT round-trip for small N.
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (row.org_id) seen.add(row.org_id);
  }
  return Array.from(seen);
}

async function loadActivePages(
  supabase: AdminClient,
  orgId: string
): Promise<ActivePage[]> {
  const { data, error } = await supabase
    .from('org_wiki_pages')
    .select('id, org_id, topic, content, confidence, app, screen')
    .eq('org_id', orgId)
    .is('valid_until', null);

  if (error) {
    throw new Error(`[wiki-lint] Failed to load active pages for ${orgId}: ${error.message}`);
  }

  return (data ?? []) as ActivePage[];
}

// ---------------------------------------------------------------------------
// Check 1 — Orphan detection
// ---------------------------------------------------------------------------

/**
 * Pages with zero incoming edges in `wiki_relationships`. A page is orphaned
 * if it never appears as `target_page_id` for any row in the org's graph.
 * Uses the (org_id, target_page_id) index from TRIB-38.
 */
async function detectOrphans(
  supabase: AdminClient,
  orgId: string,
  activePages: ActivePage[]
): Promise<OrphanDetail[]> {
  if (activePages.length === 0) return [];

  const { data, error } = await supabase
    .from('wiki_relationships')
    .select('target_page_id')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`[wiki-lint] Failed to load relationships for ${orgId}: ${error.message}`);
  }

  const inbound = new Set<string>();
  for (const row of data ?? []) {
    if (row.target_page_id) inbound.add(row.target_page_id);
  }

  return activePages
    .filter((p) => !inbound.has(p.id))
    .map((p) => ({ page_id: p.id, topic: p.topic }));
}

// ---------------------------------------------------------------------------
// Check 2 — Stale detection
// ---------------------------------------------------------------------------

/**
 * Pages whose most-recent `wiki_page_sources.contributed_at` is older than
 * the org's `wiki_stale_threshold_days` setting. Pages with no source rows
 * at all are also considered stale (nothing has ever corroborated them).
 */
async function detectStale(
  supabase: AdminClient,
  orgId: string,
  activePages: ActivePage[],
  thresholdDays: number
): Promise<StaleDetail[]> {
  if (activePages.length === 0) return [];

  const thresholdIso = daysAgo(thresholdDays);
  const pageIds = activePages.map((p) => p.id);
  const maxContributed = await loadMaxContributedAt(supabase, pageIds);

  const out: StaleDetail[] = [];
  for (const page of activePages) {
    const last = maxContributed.get(page.id) ?? null;
    if (last === null || last < thresholdIso) {
      out.push({
        page_id: page.id,
        topic: page.topic,
        last_contributed_at: last,
        threshold_days: thresholdDays,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 3 — Stale link (contradiction) scan
// ---------------------------------------------------------------------------

/**
 * Parses Obsidian-style `[[wiki-links]]` out of every active page's content
 * and resolves them against the org's topic index, including superseded
 * pages (`valid_until IS NOT NULL`). Any link that resolves to a superseded
 * page is a dangling reference — flagged as a stale link.
 */
async function detectStaleLinks(
  supabase: AdminClient,
  orgId: string,
  activePages: ActivePage[]
): Promise<StaleLinkDetail[]> {
  if (activePages.length === 0) return [];

  // Load the full topic index (active + superseded) for this org so we can
  // resolve [[target]] strings to page IDs, then check validity.
  const { data, error } = await supabase
    .from('org_wiki_pages')
    .select('id, topic, valid_until')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`[wiki-lint] Failed to load topic index for ${orgId}: ${error.message}`);
  }

  // Case-insensitive topic → {id, superseded} index. On duplicates we prefer
  // the most-recently active row (active > superseded) so links to a topic
  // that has been re-created don't falsely fire.
  type Entry = { id: string; superseded: boolean };
  const byTopic = new Map<string, Entry>();
  for (const row of data ?? []) {
    const key = row.topic.toLowerCase();
    const entry: Entry = {
      id: row.id,
      superseded: row.valid_until !== null,
    };
    const prev = byTopic.get(key);
    if (!prev || (prev.superseded && !entry.superseded)) {
      byTopic.set(key, entry);
    }
  }

  const out: StaleLinkDetail[] = [];
  for (const page of activePages) {
    const links = parseBracketLinks(page.content);
    for (const link of links) {
      const resolved = byTopic.get(link.toLowerCase());
      if (!resolved) continue; // broken links are TRIB-41 territory
      if (resolved.superseded) {
        out.push({
          page_id: page.id,
          topic: page.topic,
          target_topic: link,
          target_page_id: resolved.id,
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 4 — Coverage gaps
// ---------------------------------------------------------------------------

/**
 * Apps/screens that have vendor wiki pages but no matching active org wiki
 * pages. Matching is case-insensitive on `(app, screen)` tuples. Returns
 * `{ app, screen, vendor_pages_count }` aggregated across vendor rows.
 */
async function detectCoverageGaps(
  supabase: AdminClient,
  _orgId: string,
  activePages: ActivePage[]
): Promise<CoverageGapDetail[]> {
  const { data, error } = await supabase
    .from('vendor_wiki_pages')
    .select('app, screen');

  if (error) {
    throw new Error(`[wiki-lint] Failed to load vendor pages: ${error.message}`);
  }

  // Aggregate vendor rows by (app|screen) tuple.
  const vendorCounts = new Map<string, { app: string; screen: string; count: number }>();
  for (const row of data ?? []) {
    if (!row.app || !row.screen) continue;
    const key = `${row.app.toLowerCase()}::${row.screen.toLowerCase()}`;
    const existing = vendorCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      vendorCounts.set(key, { app: row.app, screen: row.screen, count: 1 });
    }
  }

  // Build set of covered (app|screen) keys from active org pages.
  const covered = new Set<string>();
  for (const p of activePages) {
    if (!p.app || !p.screen) continue;
    covered.add(`${p.app.toLowerCase()}::${p.screen.toLowerCase()}`);
  }

  const out: CoverageGapDetail[] = [];
  for (const [key, row] of vendorCounts.entries()) {
    if (covered.has(key)) continue;
    out.push({
      app: row.app,
      screen: row.screen,
      vendor_pages_count: row.count,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 5 — Confidence decay
// ---------------------------------------------------------------------------

/**
 * Mutates pages in-place: subtracts {@link CONFIDENCE_DECAY_STEP} from any
 * active page whose most-recent source contribution is older than
 * {@link CONFIDENCE_DECAY_AGE_DAYS} AND whose current confidence is strictly
 * greater than {@link CONFIDENCE_DECAY_FLOOR}. Clamps the resulting value to
 * the floor so repeated runs converge instead of going negative. Pages with
 * no source rows at all also decay — they haven't been corroborated by
 * anything.
 */
async function applyConfidenceDecay(
  supabase: AdminClient,
  _orgId: string,
  activePages: ActivePage[]
): Promise<ConfidenceDecayDetail[]> {
  if (activePages.length === 0) return [];

  const ageCutoff = daysAgo(CONFIDENCE_DECAY_AGE_DAYS);
  const eligible = activePages.filter((p) => p.confidence > CONFIDENCE_DECAY_FLOOR);
  if (eligible.length === 0) return [];

  const maxContributed = await loadMaxContributedAt(
    supabase,
    eligible.map((p) => p.id)
  );

  const updates: ConfidenceDecayDetail[] = [];
  for (const page of eligible) {
    const last = maxContributed.get(page.id) ?? null;
    if (last !== null && last >= ageCutoff) continue; // fresh enough

    const nextConfidence = Math.max(
      CONFIDENCE_DECAY_FLOOR,
      +(page.confidence - CONFIDENCE_DECAY_STEP).toFixed(4)
    );
    if (nextConfidence === page.confidence) continue; // already at floor

    const { error } = await supabase
      .from('org_wiki_pages')
      .update({
        confidence: nextConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', page.id);

    if (error) {
      console.error(
        `[wiki-lint] confidence decay failed for page=${page.id}: ${error.message}`
      );
      continue;
    }

    updates.push({
      page_id: page.id,
      topic: page.topic,
      old_confidence: page.confidence,
      new_confidence: nextConfidence,
    });
  }
  return updates;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Upsert one lint row per org per UTC calendar day. We compute the UTC
 * day key in JS and soft-upsert: delete-then-insert on conflict. Generated
 * columns can't be referenced in `ON CONFLICT`, so a select-then-decide
 * flow is simpler and still safe because the (org_id, run_day) unique
 * index guarantees only one row per day.
 */
async function persistResult(supabase: AdminClient, result: LintResult): Promise<void> {
  const runDay = new Date(result.run_at).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const { data: existing, error: selErr } = await supabase
    .from('wiki_lint_results')
    .select('id')
    .eq('org_id', result.org_id)
    .eq('run_day', runDay)
    .maybeSingle();

  if (selErr) {
    throw new Error(`[wiki-lint] Failed to check existing lint row: ${selErr.message}`);
  }

  const payload = {
    org_id: result.org_id,
    run_at: result.run_at,
    orphan_count: result.orphan_count,
    stale_count: result.stale_count,
    stale_link_count: result.stale_link_count,
    coverage_gap_count: result.coverage_gap_count,
    confidence_decay_count: result.confidence_decay_count,
    details: result.details as unknown as Database['public']['Tables']['wiki_lint_results']['Insert']['details'],
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('wiki_lint_results')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      throw new Error(`[wiki-lint] Failed to update lint row: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from('wiki_lint_results').insert(payload);
    if (error) {
      throw new Error(`[wiki-lint] Failed to insert lint row: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Returns a map of page_id → max(contributed_at) for the given set of pages,
 * or `null` if a page has no source rows. Filters out nullish inputs.
 */
async function loadMaxContributedAt(
  supabase: AdminClient,
  pageIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (pageIds.length === 0) return out;

  // Seed every requested id with null so "never contributed" is represented.
  for (const id of pageIds) out.set(id, null);

  // Supabase JS doesn't expose aggregates directly — pull contributed_at and
  // reduce in JS. Page counts per org are bounded (low thousands) so this is
  // cheaper than N round-trips.
  const { data, error } = await supabase
    .from('wiki_page_sources')
    .select('page_id, contributed_at')
    .in('page_id', pageIds);

  if (error) {
    throw new Error(`[wiki-lint] Failed to load wiki_page_sources: ${error.message}`);
  }

  for (const row of data ?? []) {
    const prev = out.get(row.page_id) ?? null;
    if (prev === null || row.contributed_at > prev) {
      out.set(row.page_id, row.contributed_at);
    }
  }
  return out;
}

/**
 * Parse Obsidian-style `[[wiki-link]]` targets from page content. Matches
 * both `[[topic]]` and `[[topic|display text]]`. Mirrors
 * {@link compile-wiki-relationships.ts#parseBracketLinks}. We purposely keep
 * a local copy rather than importing — the relationship handler imports
 * heavy LLM libraries we don't need here.
 */
function parseBracketLinks(content: string): string[] {
  const out = new Set<string>();
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const m of matches) {
    const raw = m[1];
    if (!raw) continue;
    const topic = raw.split('|')[0]?.trim();
    if (!topic) continue;
    if (topic.length > 200) continue; // defensive cap, same as relationships handler
    out.add(topic);
  }
  return Array.from(out);
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Sanity-clamp the per-org threshold. We never want 0-day staleness (would
 * flag every page) or a threshold so large it effectively disables the check.
 */
function clampThreshold(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 90;
  if (days > 3650) return 3650; // 10 years — any larger is almost certainly a bug
  return Math.floor(days);
}
