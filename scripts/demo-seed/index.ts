#!/usr/bin/env tsx
/**
 * Demo tenant seed script.
 *
 * Usage:
 *   DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local
 *   DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local --dry-run
 *   DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local --force-reseed
 *   DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=staging --confirm=<token>
 *
 * Flags:
 *   --env=<local|staging>   Required. Target environment.
 *   --dry-run               Resolve fixtures, log planned writes, zero mutations.
 *   --confirm=<token>       Required for staging; must equal DEMO_SEED_STAGING_CONFIRM.
 *   --force-reseed          Overwrite preserved fields (reset hook for TRIB-151).
 *
 * Hard constraint: never writes to production (project ref clpatptmumyasbypvmun).
 */

import 'dotenv/config';
import pg from 'pg';

import { checkGuard, type SeedEnv } from './env-guard.js';
import { seed } from './seed.js';
import {
  DEMO_ORG,
  DEMO_USERS,
  DEMO_DEPARTMENTS,
  DEMO_RECORDING_SLUGS,
  DEMO_WIKI_PAGE_SLUGS,
  DEMO_IMPORTED_DOC_SLUGS,
  DEMO_TAG_NAMES,
} from './fixtures.js';

const { Pool } = pg;

// ─── Flag parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  env: SeedEnv | null;
  dryRun: boolean;
  forceReseed: boolean;
  confirm: string | undefined;
} {
  const args = argv.slice(2);
  let env: SeedEnv | null = null;
  let dryRun = false;
  let forceReseed = false;
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
    } else if (arg === '--force-reseed') {
      forceReseed = true;
    } else if (arg.startsWith('--confirm=')) {
      confirm = arg.slice('--confirm='.length);
    }
  }

  return { env, dryRun, forceReseed, confirm };
}

// ─── Main (entry point when run directly) ────────────────────────────────────

async function main(): Promise<void> {
  const { env, dryRun, forceReseed, confirm } = parseArgs(process.argv);

  if (!env) {
    console.error('[error] --env=<local|staging> is required.');
    process.exit(1);
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  const guard = checkGuard({ env, stagingConfirmToken: confirm });
  if (!guard.ok) {
    console.error(guard.reason);
    process.exit(guard.exitCode ?? 1);
  }

  const dbUrl = process.env['DIRECT_DATABASE_URL']!;

  console.log(`\n[demo-seed] Starting${dryRun ? ' (DRY RUN)' : ''}...`);
  console.log(`  env:          ${env}`);
  console.log(`  force-reseed: ${forceReseed}`);
  console.log(`  org:          ${DEMO_ORG.name} (${DEMO_ORG.id})`);
  console.log(`  users:        ${DEMO_USERS.length}`);
  console.log(`  departments:  ${DEMO_DEPARTMENTS.length}`);
  console.log(`  recordings:   ${DEMO_RECORDING_SLUGS.length}`);
  console.log(`  wiki pages:   ${DEMO_WIKI_PAGE_SLUGS.length}`);
  console.log(`  imported docs:${DEMO_IMPORTED_DOC_SLUGS.length}`);
  console.log(`  tags:         ${DEMO_TAG_NAMES.length}\n`);

  // ── Connection ───────────────────────────────────────────────────────────

  const pool = new Pool({ connectionString: dbUrl, max: 1 });

  const client = await pool.connect();
  try {
    // Smoke query to confirm we're talking to the right DB.
    const smoke = await client.query<{ current_database: string }>(
      `SELECT current_database()`
    );
    console.log(`[demo-seed] Connected to database: ${smoke.rows[0]?.current_database}`);

    if (dryRun) {
      await seed(client, { dryRun: true, forceReseed });
      console.log('\n[demo-seed] Dry run complete. No data was written.\n');
      return;
    }

    await seed(client, { dryRun: false, forceReseed });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[demo-seed] Fatal error:', err);
  process.exit(1);
});
