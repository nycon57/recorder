#!/usr/bin/env tsx
/**
 * Demo tenant smoke verification script.
 *
 * Reads from the DB and runs assertions against the expected post-seed state.
 * Each assertion prints pass/fail + count. Exits 0 on all-pass, 1 on any-fail.
 *
 * Usage:
 *   DEMO_SEED_ENABLED=1 npm run demo:smoke -- --env=local
 *   DEMO_SEED_ENABLED=1 npm run demo:smoke -- --env=staging --confirm=<token>
 *
 * Flags:
 *   --env=<local|staging>   Required.
 *   --confirm=<token>       Required for staging.
 *
 * Hard constraint: never writes. Read-only. Still reuses the env-guard to
 * ensure the operator is pointed at the right DB.
 */

import 'dotenv/config';
import pg from 'pg';

import { checkGuard, type SeedEnv } from './env-guard.js';
import {
  DEMO_ORG_ID,
  DEMO_VENDOR_ORG_ID,
  DEMO_WHITE_LABEL_CONFIG_ID,
  DEMO_USERS,
  DEMO_USER_IDS,
  DEMO_WIKI_PAGE_SLUGS,
  DEMO_RECORDING_SLUGS,
} from './fixtures.js';

const { Pool } = pg;

// ─── Assertion runner ─────────────────────────────────────────────────────────

interface AssertionResult {
  name: string;
  passed: boolean;
  actual: string;
  expected: string;
  advisory?: string;
}

function printResult(result: AssertionResult): void {
  const icon = result.passed ? 'PASS' : 'FAIL';
  const line = `  [${icon}] ${result.name}`;
  if (result.passed) {
    console.log(line);
  } else {
    console.error(line);
    console.error(
      `         actual=${result.actual} expected=${result.expected}`,
    );
  }
  if (result.advisory) {
    console.log(`         NOTE: ${result.advisory}`);
  }
}

// ─── Individual assertions ────────────────────────────────────────────────────
//
// These are exported so unit tests can call them with a mocked client.

export async function assertDemoOrgExists(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  const row = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations WHERE id = $1`,
    [DEMO_ORG_ID],
  );
  const exists = row.rowCount === 1;
  const result: AssertionResult = {
    name: 'Demo org exists',
    passed: exists,
    actual: exists ? `id=${row.rows[0]?.id}` : 'not found',
    expected: `id=${DEMO_ORG_ID}`,
  };
  printResult(result);
  return result;
}

export async function assertUsersExistWithRoles(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  const userIds = Object.values(DEMO_USER_IDS);
  const row = await client.query<{ id: string; role: string; email: string }>(
    `SELECT id, role, email FROM users WHERE id = ANY($1::uuid[]) ORDER BY email`,
    [userIds],
  );
  const found = row.rowCount ?? 0;
  const expected = DEMO_USERS.length;

  const roleMap = new Map(row.rows.map((r) => [r.id, r.role]));
  const roleErrors: string[] = [];
  for (const u of DEMO_USERS) {
    const actualRole = roleMap.get(u.id);
    if (actualRole !== u.role) {
      roleErrors.push(
        `${u.email}: expected ${u.role}, got ${actualRole ?? 'missing'}`,
      );
    }
  }

  const passed = found === expected && roleErrors.length === 0;
  const result: AssertionResult = {
    name: `All ${expected} demo users exist with correct roles`,
    passed,
    actual:
      roleErrors.length > 0
        ? `role mismatches: ${roleErrors.join('; ')}`
        : `${found} users`,
    expected: `${expected} users with correct roles`,
  };
  printResult(result);
  return result;
}

export async function assertRecordingCountsByUser(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  // Expected: 18 lead (Marcus) / 10 agent (Sofía) / 2 admin (Priya) / 0 owner / 0 reader
  const row = await client.query<{ created_by: string; cnt: string }>(
    `SELECT created_by, COUNT(*)::text AS cnt FROM content WHERE metadata->>'seed' = 'demo' GROUP BY created_by`,
    [],
  );
  const countMap = new Map(
    row.rows.map((r) => [r.created_by, parseInt(r.cnt, 10)]),
  );

  const expected: Record<string, number> = {
    [DEMO_USER_IDS.lead]: 18,
    [DEMO_USER_IDS.agent]: 10,
    [DEMO_USER_IDS.admin]: 2,
  };

  const errors: string[] = [];
  const userNameById = new Map(DEMO_USERS.map((user) => [user.id, user.name]));
  for (const [userId, expectedCount] of Object.entries(expected)) {
    const actual = countMap.get(userId) ?? 0;
    const userName = userNameById.get(userId) ?? userId;
    if (actual !== expectedCount) {
      errors.push(`${userName}: expected ${expectedCount}, got ${actual}`);
    }
  }

  // Owner and reader should have 0 recordings
  for (const uid of [DEMO_USER_IDS.owner, DEMO_USER_IDS.reader]) {
    if (countMap.has(uid)) {
      const userName = userNameById.get(uid) ?? uid;
      errors.push(
        `${userName}: expected 0 recordings, got ${countMap.get(uid)}`,
      );
    }
  }

  const totalActual = Array.from(countMap.values()).reduce((a, b) => a + b, 0);
  const passed = errors.length === 0;
  const result: AssertionResult = {
    name: 'Recording counts per user (18 lead / 10 agent / 2 admin)',
    passed,
    actual:
      errors.length > 0 ? errors.join('; ') : `${totalActual} total recordings`,
    expected: '18 lead + 10 agent + 2 admin = 30 total',
  };
  printResult(result);
  return result;
}

export async function assertTranscriptChunkCount(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  // 30 recordings × 6 chunks = 180 expected
  const row = await client.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM transcript_chunks WHERE id = ANY(
      SELECT tc.id FROM transcript_chunks tc
      JOIN transcripts t ON t.id = tc.transcript_id
      JOIN content c ON c.id = t.content_id
      WHERE c.metadata->>'seed' = 'demo'
    )`,
    [],
  );
  const actual = parseInt(row.rows[0]?.cnt ?? '0', 10);
  // Allow range 150–210 (some recordings may have fewer splits)
  const passed = actual >= 150 && actual <= 210;
  const result: AssertionResult = {
    name: 'Transcript chunk count (~180)',
    passed,
    actual: `${actual} chunks`,
    expected: '150–210 (30 recordings × ~6 chunks)',
  };
  printResult(result);
  return result;
}

export async function assertWikiPageCounts(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  const row = await client.query<{
    total: string;
    published: string;
    draft: string;
  }>(
    `SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE is_published = true)::text AS published,
      COUNT(*) FILTER (WHERE is_published = false)::text AS draft
     FROM org_wiki_pages
     WHERE metadata->>'seed' = 'demo'`,
    [],
  );
  const total = parseInt(row.rows[0]?.total ?? '0', 10);
  const published = parseInt(row.rows[0]?.published ?? '0', 10);
  const draft = parseInt(row.rows[0]?.draft ?? '0', 10);

  const expectedTotal = DEMO_WIKI_PAGE_SLUGS.length; // 12
  const passed = total === expectedTotal && published === 8 && draft === 4;
  const result: AssertionResult = {
    name: 'Wiki pages: 12 total, 8 published, 4 draft',
    passed,
    actual: `total=${total} published=${published} draft=${draft}`,
    expected: `total=${expectedTotal} published=8 draft=4`,
  };
  printResult(result);
  return result;
}

export async function assertVendorDemoOrgExists(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  // Check vendor org + white_label_configs row + Acme link
  const [orgRow, wlRow, acmeRow] = await Promise.all([
    client.query<{ id: string; vendor_org_id: string }>(
      `SELECT id,
      (SELECT id FROM organizations WHERE id = $2 LIMIT 1) AS vendor_org_id
     FROM organizations WHERE id = $1`,
      [DEMO_ORG_ID, DEMO_VENDOR_ORG_ID],
    ),
    client.query<{ id: string }>(
      `SELECT id FROM white_label_configs WHERE id = $1`,
      [DEMO_WHITE_LABEL_CONFIG_ID],
    ),
    client.query<{ vendor_org_id: string }>(
      `SELECT vendor_org_id::text FROM organizations WHERE id = $1`,
      [DEMO_ORG_ID],
    ),
  ]);

  const vendorExists = !!orgRow.rows[0]?.vendor_org_id;
  const wlExists = (wlRow.rowCount ?? 0) === 1;
  const acmeLinked = acmeRow.rows[0]?.vendor_org_id === DEMO_VENDOR_ORG_ID;

  const passed = vendorExists && wlExists && acmeLinked;
  const result: AssertionResult = {
    name: 'Vendor demo org + white_label_config + Acme link',
    passed,
    actual: `vendorExists=${vendorExists} wlExists=${wlExists} acmeLinked=${acmeLinked}`,
    expected: 'all true',
  };
  printResult(result);
  return result;
}

export async function assertDepartmentFKResolution(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  // Join users → departments → expected dept names
  const expectedDeptNames = new Set(['Executive', 'Support Ops', 'Support']);
  const row = await client.query<{ dept_name: string; user_email: string }>(
    `SELECT d.name AS dept_name, u.email AS user_email
     FROM users u
     JOIN departments d ON d.id = u.department_id
     WHERE u.id = ANY($1::uuid[])`,
    [Object.values(DEMO_USER_IDS)],
  );
  const foundDeptNames = new Set(row.rows.map((r) => r.dept_name));
  const missingDepts = [...expectedDeptNames].filter(
    (n) => !foundDeptNames.has(n),
  );
  const usersWithDept = row.rowCount ?? 0;

  const passed =
    missingDepts.length === 0 && usersWithDept === DEMO_USERS.length;
  const result: AssertionResult = {
    name: 'Department FK resolution (users → departments)',
    passed,
    actual: `${usersWithDept} users resolved, depts=[${[...foundDeptNames].join(', ')}]`,
    expected: `${DEMO_USERS.length} users, depts=[${[...expectedDeptNames].join(', ')}]`,
  };
  printResult(result);
  return result;
}

export async function assertSeedMetadataPresent(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  // Check that seed-owned rows with metadata column carry metadata.seed = 'demo'
  const checks: Array<{ table: string; count: number; seedCount: number }> = [];

  await Promise.all(
    Array.from(['content', 'org_wiki_pages', 'organizations']).map(
      async (table) => {
        const [totalRow, seedRow] = await Promise.all([
          client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM ${table} WHERE id IN (
                SELECT id FROM ${table} WHERE metadata IS NOT NULL LIMIT 1000
              )`,
          ),
          client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM ${table} WHERE metadata->>'seed' = 'demo'`,
          ),
        ]);
        checks.push({
          table,
          count: parseInt(totalRow.rows[0]?.cnt ?? '0', 10),
          seedCount: parseInt(seedRow.rows[0]?.cnt ?? '0', 10),
        });
      },
    ),
  );

  // All demo content rows must have metadata.seed = 'demo'
  const contentCheck = checks.find((c) => c.table === 'content');
  const wikiCheck = checks.find((c) => c.table === 'org_wiki_pages');

  const expectedContentCount = DEMO_RECORDING_SLUGS.length; // 30
  const expectedWikiCount = DEMO_WIKI_PAGE_SLUGS.length; // 12

  const passed =
    (contentCheck?.seedCount ?? 0) === expectedContentCount &&
    (wikiCheck?.seedCount ?? 0) >= expectedWikiCount;

  const result: AssertionResult = {
    name: `Seed metadata present (metadata.seed = 'demo')`,
    passed,
    actual: checks
      .map((c) => `${c.table}:seed_count=${c.seedCount}`)
      .join(', '),
    expected: `content:seed_count=${expectedContentCount}, org_wiki_pages:seed_count>=${expectedWikiCount}`,
  };
  printResult(result);
  return result;
}

export async function assertForceReseedFKSafety(
  client: pg.PoolClient,
): Promise<AssertionResult> {
  /**
   * TRIB-145 advisory: the --force-reseed path in seeders/users.ts uses
   * DEMO_USERS[0].id (a user UUID) as a placeholder org_id before a follow-up
   * UPDATE corrects it. If users.org_id has a NOT NULL FK to organizations.id,
   * this INSERT will fail because the user UUID is not a valid org ID.
   *
   * This assertion verifies the advisory by checking the DB constraint and
   * examining whether the placeholder value could satisfy it.
   *
   * We do NOT actually run --force-reseed here (that would mutate data).
   * Instead we check the constraint definition to determine if the bug is real.
   */

  // Check if users.org_id has a NOT NULL constraint
  const constraintRow = await client.query<{
    is_nullable: string;
    constraint_type: string | null;
  }>(
    `SELECT
      c.is_nullable,
      tc.constraint_type
     FROM information_schema.columns c
     LEFT JOIN information_schema.constraint_column_usage ccu
       ON ccu.table_name = c.table_name
       AND ccu.column_name = c.column_name
       AND ccu.table_schema = c.table_schema
     LEFT JOIN information_schema.table_constraints tc
       ON tc.constraint_name = ccu.constraint_name
       AND tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY')
     WHERE c.table_schema = 'public'
       AND c.table_name = 'users'
       AND c.column_name = 'org_id'
     LIMIT 1`,
    [],
  );

  const isNullable = constraintRow.rows[0]?.is_nullable === 'YES';
  const hasFk = constraintRow.rows[0]?.constraint_type === 'FOREIGN KEY';

  // Check if DEMO_USERS[0].id (the placeholder) exists in organizations
  // If org_id is NOT NULL and has FK, inserting a user UUID as org_id will fail.
  const placeholderUserId = DEMO_USER_IDS.owner; // DEMO_USERS[0].id
  const orgExistsRow = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1) AS exists`,
    [placeholderUserId],
  );
  const placeholderIsValidOrg = orgExistsRow.rows[0]?.exists === true;

  let advisoryNote: string;
  let passed: boolean;

  if (isNullable) {
    // org_id is nullable — INSERT with placeholder UUID would succeed even if
    // the UUID is not a valid org. The follow-up UPDATE would then set it correctly.
    // No FK violation possible. Advisory was a false alarm.
    advisoryNote =
      'users.org_id is NULLABLE — placeholder INSERT in --force-reseed path is safe (no FK violation). Advisory was a false alarm.';
    passed = true;
  } else if (placeholderIsValidOrg) {
    // org_id is NOT NULL but the placeholder UUID happens to match an org ID.
    // This would be a coincidence — flag as suspicious.
    advisoryNote =
      'users.org_id is NOT NULL but placeholder UUID coincidentally matches an org. Unusual — verify manually.';
    passed = true;
  } else {
    // org_id is NOT NULL and placeholder UUID is not a valid org.
    // The --force-reseed INSERT would fail with a NOT NULL FK violation.
    advisoryNote =
      'BUG CONFIRMED: users.org_id is NOT NULL and placeholder UUID is not a valid org. ' +
      '--force-reseed will fail on INSERT. Fix: use DEMO_ORG_ID as the placeholder instead of DEMO_USERS[0].id, ' +
      'or use a SELECT subquery like the non-force path.';
    passed = false;
  }

  const result: AssertionResult = {
    name: 'TRIB-145 advisory: --force-reseed org_id FK safety',
    passed,
    actual: `org_id is_nullable=${isNullable} hasFk=${hasFk} placeholderIsValidOrg=${placeholderIsValidOrg}`,
    expected: 'no NOT NULL FK violation on force-reseed INSERT',
    advisory: advisoryNote,
  };
  printResult(result);
  return result;
}

// ─── Flag parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  env: SeedEnv | null;
  confirm: string | undefined;
} {
  const args = argv.slice(2);
  let env: SeedEnv | null = null;
  let confirm: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const val = arg.slice('--env='.length);
      if (val === 'local' || val === 'staging') {
        env = val;
      } else {
        console.error(
          `[error] Unknown --env value: "${val}". Use local or staging.`,
        );
        process.exit(1);
      }
    } else if (arg.startsWith('--confirm=')) {
      confirm = arg.slice('--confirm='.length);
    }
  }

  return { env, confirm };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { env, confirm } = parseArgs(process.argv);

  if (!env) {
    console.error('[error] --env=<local|staging> is required.');
    process.exit(1);
  }

  // Reuse env-guard — no new guard logic.
  const guard = checkGuard({ env, stagingConfirmToken: confirm });
  if (!guard.ok) {
    console.error(guard.reason);
    process.exit(guard.exitCode ?? 1);
  }

  const dbUrl = process.env['DIRECT_DATABASE_URL']!;
  const pool = new Pool({ connectionString: dbUrl, max: 1 });
  const client = await pool.connect();

  try {
    const smoke = await client.query<{ current_database: string }>(
      `SELECT current_database()`,
    );
    console.log(
      `\n[demo:smoke] Connected to database: ${smoke.rows[0]?.current_database}`,
    );
    console.log('[demo:smoke] Running assertions...\n');

    // Run all assertions — collect results but don't stop on failure.
    const allResults = [
      await assertDemoOrgExists(client),
      await assertUsersExistWithRoles(client),
      await assertRecordingCountsByUser(client),
      await assertTranscriptChunkCount(client),
      await assertWikiPageCounts(client),
      await assertVendorDemoOrgExists(client),
      await assertDepartmentFKResolution(client),
      await assertSeedMetadataPresent(client),
      await assertForceReseedFKSafety(client),
    ];

    // ── Summary ──────────────────────────────────────────────────────────────

    const passed = allResults.filter((r) => r.passed).length;
    const failed = allResults.filter((r) => !r.passed).length;
    const total = allResults.length;

    console.log(`\n[demo:smoke] Results: ${passed}/${total} passed`);

    if (failed > 0) {
      console.error(`[demo:smoke] ${failed} assertion(s) FAILED:`);
      for (const r of allResults.filter((r) => !r.passed)) {
        console.error(`  - ${r.name}`);
        if (r.advisory) console.error(`    ${r.advisory}`);
      }
      process.exit(1);
    } else {
      console.log('[demo:smoke] All assertions passed.');
      process.exit(0);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Guard: only run main() when executed directly (not when imported by tests).
// Under Jest/CJS: require.main !== module. Under tsx/ESM: process.argv[1] matches.
const isMain =
  typeof require !== 'undefined'
    ? require.main === module
    : process.argv[1]?.endsWith('smoke.ts') ||
      process.argv[1]?.endsWith('smoke.js');

if (isMain) {
  main().catch((err) => {
    console.error('[demo:smoke] Fatal error:', err);
    process.exit(1);
  });
}
