#!/usr/bin/env tsx
/**
 * Demo tenant reset script.
 *
 * Surgically deletes all seed-owned rows (identified by metadata.seed = 'demo'
 * or deterministic demo IDs), then calls the existing seed() orchestrator to
 * restore a clean known-good state.
 *
 * Usage:
 *   DEMO_SEED_ENABLED=1 npm run demo:reset -- --env=local
 *   DEMO_SEED_ENABLED=1 npm run demo:reset -- --env=local --dry-run
 *   DEMO_SEED_ENABLED=1 npm run demo:reset -- --env=staging --confirm=<token>
 *
 * Flags:
 *   --env=<local|staging>   Required. Target environment.
 *   --confirm=<token>       Required for staging.
 *   --dry-run               List rows that would be deleted + what would be re-seeded.
 *
 * Hard constraints:
 *   - Never deletes without a WHERE clause.
 *   - Only deletes rows with metadata.seed = 'demo' OR a deterministic demo ID.
 *   - Refuses to run against production (project ref clpatptmumyasbypvmun).
 *   - Reuses the existing env-guard; no new guard logic.
 */

import 'dotenv/config';
import pg from 'pg';

import { checkGuard, type SeedEnv } from './env-guard.js';
import {
  DEMO_ORG_ID,
  DEMO_VENDOR_ORG_ID,
  DEMO_WHITE_LABEL_CONFIG_ID,
  DEMO_CONNECTOR_ID,
  DEMO_USER_IDS,
  DEMO_DEPARTMENT_IDS,
  DEMO_RECORDING_IDS,
  DEMO_DOCUMENT_IDS,
  DEMO_SUMMARY_IDS,
  DEMO_TRANSCRIPT_IDS,
  DEMO_WIKI_PAGE_IDS,
  DEMO_IMPORTED_DOC_IDS,
  DEMO_KNOWLEDGE_GAP_IDS,
  DEMO_SHARE_IDS,
  DEMO_TAG_IDS,
  DEMO_RECORDING_SLUGS,
  DEMO_ORG,
} from './fixtures.js';
import { deriveChunkId } from './ids.js'; // eslint-disable-line import/order
import { seed } from './index.js'; // eslint-disable-line import/order

const { Pool } = pg;

// ─── Delete plan ──────────────────────────────────────────────────────────────
//
// Reverse FK dependency order:
//   leaf → parent
//
// Tables without metadata column use deterministic IDs from fixtures.
//
// RULE: Every DELETE must have a WHERE clause scoped to metadata.seed = 'demo'
//       OR to a known demo ID list. Never unscoped.

interface DeleteStep {
  table: string;
  /** Human-readable description for dry-run output */
  description: string;
  /** The WHERE clause and bind params for the DELETE */
  where: string;
  params: unknown[];
  /** Whether this table has a metadata column with seed marker */
  hasSeedMetadata?: boolean;
}

function buildDeleteSteps(): DeleteStep[] {
  // All recording chunk IDs
  const allChunkIds: string[] = [];
  for (const slug of DEMO_RECORDING_SLUGS) {
    for (let i = 0; i < 6; i++) {
      allChunkIds.push(deriveChunkId(slug, i));
    }
  }

  const allRecordingIds = Object.values(DEMO_RECORDING_IDS);
  const allDocumentIds = Object.values(DEMO_DOCUMENT_IDS);
  const allSummaryIds = Object.values(DEMO_SUMMARY_IDS);
  const allTranscriptIds = Object.values(DEMO_TRANSCRIPT_IDS);
  const allWikiPageIds = Object.values(DEMO_WIKI_PAGE_IDS);
  const allImportedDocIds = Object.values(DEMO_IMPORTED_DOC_IDS);
  const allKnowledgeGapIds = Object.values(DEMO_KNOWLEDGE_GAP_IDS);
  const allShareIds = Object.values(DEMO_SHARE_IDS);
  const allTagIds = Object.values(DEMO_TAG_IDS);
  const allUserIds = Object.values(DEMO_USER_IDS);
  const allDeptIds = Object.values(DEMO_DEPARTMENT_IDS);

  return [
    // ── Deepest leaves first ──────────────────────────────────────────────

    {
      table: 'wiki_page_sources',
      description: `wiki_page_sources for ${allWikiPageIds.length} demo wiki pages`,
      where: `page_id = ANY($1::uuid[])`,
      params: [allWikiPageIds],
    },
    {
      table: 'transcript_chunks',
      description: `transcript_chunks for ${allChunkIds.length} demo chunks`,
      where: `id = ANY($1::uuid[])`,
      params: [allChunkIds],
    },
    {
      table: 'content_tags',
      description: `content_tags for ${allRecordingIds.length} demo recordings`,
      where: `content_id = ANY($1::uuid[])`,
      params: [allRecordingIds],
    },

    // ── Mid-tier dependencies ─────────────────────────────────────────────

    {
      table: 'content_summaries',
      description: `${allSummaryIds.length} demo content_summaries`,
      where: `id = ANY($1::uuid[])`,
      params: [allSummaryIds],
    },
    {
      table: 'documents',
      description: `${allDocumentIds.length} demo documents`,
      where: `id = ANY($1::uuid[])`,
      params: [allDocumentIds],
    },
    {
      table: 'transcripts',
      description: `${allTranscriptIds.length} demo transcripts`,
      where: `id = ANY($1::uuid[])`,
      params: [allTranscriptIds],
    },
    {
      table: 'org_wiki_pages',
      description: `${allWikiPageIds.length} demo wiki pages (metadata.seed = 'demo')`,
      where: `metadata->>'seed' = 'demo'`,
      params: [],
      hasSeedMetadata: true,
    },
    {
      table: 'imported_documents',
      description: `${allImportedDocIds.length} demo imported_documents`,
      where: `id = ANY($1::uuid[])`,
      params: [allImportedDocIds],
    },
    {
      table: 'knowledge_gaps',
      description: `${allKnowledgeGapIds.length} demo knowledge_gaps`,
      where: `id = ANY($1::uuid[])`,
      params: [allKnowledgeGapIds],
    },
    {
      table: 'shares',
      description: `${allShareIds.length} demo shares`,
      where: `id = ANY($1::uuid[])`,
      params: [allShareIds],
    },
    {
      table: 'content',
      description: `${allRecordingIds.length} demo content rows (metadata.seed = 'demo')`,
      where: `metadata->>'seed' = 'demo'`,
      params: [],
      hasSeedMetadata: true,
    },
    {
      table: 'connector_configs',
      description: `1 demo connector_config`,
      where: `id = $1`,
      params: [DEMO_CONNECTOR_ID],
    },
    {
      table: 'tags',
      description: `${allTagIds.length} demo tags`,
      where: `id = ANY($1::uuid[])`,
      params: [allTagIds],
    },

    // ── white_label_configs before vendor org ─────────────────────────────

    {
      table: 'white_label_configs',
      description: `1 demo white_label_config`,
      where: `id = $1`,
      params: [DEMO_WHITE_LABEL_CONFIG_ID],
    },

    // ── Un-link Acme from vendor org before deleting vendor org ──────────
    // (Handled separately as an UPDATE, not a DELETE)

    // ── Better Auth membership rows ───────────────────────────────────────

    {
      table: '"member"',
      description: `${allUserIds.length} demo org memberships`,
      where: `"organizationId" = $1`,
      params: [DEMO_ORG_ID],
    },

    // ── App users ─────────────────────────────────────────────────────────

    {
      table: 'users',
      description: `${allUserIds.length} demo users (app table)`,
      where: `id = ANY($1::uuid[])`,
      params: [allUserIds],
    },
    {
      table: '"account"',
      description: `${allUserIds.length} demo Better Auth accounts`,
      where: `"userId" = ANY($1::uuid[])`,
      params: [allUserIds],
    },
    {
      table: '"user"',
      description: `${allUserIds.length} demo Better Auth users`,
      where: `id = ANY($1::uuid[])`,
      params: [allUserIds],
    },

    // ── Departments ───────────────────────────────────────────────────────

    {
      table: 'departments',
      description: `${allDeptIds.length} demo departments`,
      where: `id = ANY($1::uuid[])`,
      params: [allDeptIds],
    },

    // ── Vendor org ────────────────────────────────────────────────────────

    {
      table: 'organizations',
      description: `vendor org (tribora-vendor-demo)`,
      where: `id = $1`,
      params: [DEMO_VENDOR_ORG_ID],
    },

    // ── Main demo org (last, all children deleted above) ─────────────────

    {
      table: 'organizations',
      description: `Acme Support Demo org`,
      where: `id = $1`,
      params: [DEMO_ORG_ID],
    },
  ];
}

// ─── Flag parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  env: SeedEnv | null;
  dryRun: boolean;
  confirm: string | undefined;
} {
  const args = argv.slice(2);
  let env: SeedEnv | null = null;
  let dryRun = false;
  let confirm: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const val = arg.slice('--env='.length);
      if (val === 'local' || val === 'staging') {
        env = val;
      } else {
        console.error(`[error] Unknown --env value: "${val}". Use local or staging.`);
        process.exit(1);
      }
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--confirm=')) {
      confirm = arg.slice('--confirm='.length);
    }
  }

  return { env, dryRun, confirm };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { env, dryRun, confirm } = parseArgs(process.argv);

  if (!env) {
    console.error('[error] --env=<local|staging> is required.');
    process.exit(1);
  }

  // ── Guard (reuse env-guard — no new logic) ────────────────────────────────

  const guard = checkGuard({ env, stagingConfirmToken: confirm });
  if (!guard.ok) {
    console.error(guard.reason);
    process.exit(guard.exitCode ?? 1);
  }

  const dbUrl = process.env['DIRECT_DATABASE_URL']!;

  console.log(`\n[demo:reset] Starting${dryRun ? ' (DRY RUN)' : ''}...`);
  console.log(`  env:  ${env}`);
  console.log(`  org:  ${DEMO_ORG.name} (${DEMO_ORG_ID})`);
  console.log('');

  if (dryRun) {
    console.log('[demo:reset] Dry run — delete plan:');
    const steps = buildDeleteSteps();
    for (const step of steps) {
      console.log(`  DELETE FROM ${step.table} WHERE ${step.where} — ${step.description}`);
    }
    console.log('');
    console.log('[demo:reset] UPDATE organizations SET vendor_org_id = NULL — un-link Acme vendor');
    console.log('');
    console.log('[demo:reset] Would then call seed() orchestrator (--force-reseed implied).');
    console.log('[demo:reset] Dry run complete. No data was written.\n');
    return;
  }

  // ── Connection ───────────────────────────────────────────────────────────

  const pool = new Pool({ connectionString: dbUrl, max: 1 });
  const client = await pool.connect();

  try {
    const smoke = await client.query<{ current_database: string }>(
      `SELECT current_database()`
    );
    console.log(`[demo:reset] Connected to database: ${smoke.rows[0]?.current_database}`);

    // ── Delete transaction ────────────────────────────────────────────────
    //
    // Single transaction: delete all seed rows, then commit.
    // The seed() call runs its own transaction after this commits.
    // Tradeoff vs single mega-transaction: if seed() fails, the DB is empty
    // (no demo data) until the operator retries. This is acceptable for a
    // dev/staging tool; the alternative (one massive txn) risks lock timeout
    // on large deployments. Document the split here.

    console.log('[demo:reset] Phase 1: delete seed-owned rows...');
    await client.query('BEGIN');

    try {
      // Un-link Acme from vendor org first (vendor org deleted below).
      const unlinkResult = await client.query(
        `UPDATE organizations SET vendor_org_id = NULL, updated_at = NOW() WHERE id = $1`,
        [DEMO_ORG_ID]
      );
      console.log(
        `[demo:reset]   UPDATE organizations (vendor_org_id = NULL): ${unlinkResult.rowCount} row(s)`
      );

      const steps = buildDeleteSteps();
      for (const step of steps) {
        const sql = `DELETE FROM ${step.table} WHERE ${step.where}`;
        const result = await client.query(sql, step.params);
        console.log(
          `[demo:reset]   DELETE FROM ${step.table}: ${result.rowCount ?? 0} row(s) — ${step.description}`
        );
      }

      await client.query('COMMIT');
      console.log('[demo:reset] Phase 1 complete — all seed rows deleted.\n');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[demo:reset] ROLLBACK — delete transaction failed:', err);
      throw err;
    }

    // ── Phase 2: reseed ───────────────────────────────────────────────────

    console.log('[demo:reset] Phase 2: reseed (--force-reseed)...');
    await seed(client, { dryRun: false, forceReseed: true });
    console.log('[demo:reset] Phase 2 complete.\n');

    console.log('[demo:reset] Reset complete. Demo tenant restored to known-good state.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[demo:reset] Fatal error:', err);
  process.exit(1);
});
