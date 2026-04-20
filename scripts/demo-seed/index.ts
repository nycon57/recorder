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
import { seedOrganization } from './seeders/organization.js';
import { seedDepartments } from './seeders/departments.js';
import { seedUsers } from './seeders/users.js';
import { seedMembers } from './seeders/members.js';
import { DEMO_ORG, DEMO_USERS, DEMO_DEPARTMENTS } from './fixtures.js';

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

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  console.log(`  env:         ${env}`);
  console.log(`  force-reseed: ${forceReseed}`);
  console.log(`  org:         ${DEMO_ORG.name} (${DEMO_ORG.id})`);
  console.log(`  users:       ${DEMO_USERS.length}`);
  console.log(`  departments: ${DEMO_DEPARTMENTS.length}\n`);

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
      // Run guard + dry-run path for each seeder (read-only queries allowed).
      await seedOrganization(client, { dryRun: true, forceReseed });
      await seedDepartments(client, { dryRun: true });
      await seedUsers(client, {
        dryRun: true,
        forceReseed,
        departmentMap: {},
      });
      await seedMembers(client, { dryRun: true });

      console.log('\n[demo-seed] Dry run complete. No data was written.\n');
      return;
    }

    // ── Transaction ────────────────────────────────────────────────────────

    await client.query('BEGIN');

    try {
      await seedOrganization(client, { dryRun: false, forceReseed });
      const departmentMap = await seedDepartments(client, { dryRun: false });
      await seedUsers(client, { dryRun: false, forceReseed, departmentMap });
      await seedMembers(client, { dryRun: false });

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[demo-seed] ROLLBACK — transaction failed:', err);
      throw err;
    }

    // ── Summary ───────────────────────────────────────────────────────────

    console.log('\n[demo-seed] Seed complete.');
    console.log(`  Organization:  ${DEMO_ORG.name}`);
    console.log(`  Departments:   ${DEMO_DEPARTMENTS.length}`);
    console.log(`  Users:         ${DEMO_USERS.length}`);
    console.log(`\n  Roster:`);
    for (const u of DEMO_USERS) {
      console.log(`    ${u.role.padEnd(12)} ${u.name} <${u.email}>`);
    }
    console.log('');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[demo-seed] Fatal error:', err);
  process.exit(1);
});
