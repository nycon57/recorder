/**
 * Upserts demo users across three tables in dependency order:
 *   1. "user"    (Better Auth — quoted camelCase)
 *   2. "account" (Better Auth credential account, no password hash → magic-link)
 *   3. users     (Supabase app table)
 *
 * Writing directly to Postgres (not via Better Auth admin API) to bypass the
 * databaseHooks.user.create.after hook that auto-creates a workspace org.
 * See src/lib/auth/auth.ts:107-134 for the hook definition.
 *
 * Idempotency contract — "user":
 * - Refreshed: name, email, emailVerified, image, phone, updatedAt
 * - Preserved: createdAt
 *
 * Idempotency contract — "account":
 * - Refreshed: updatedAt
 * - Preserved: password (never touched — NULL = magic-link)
 *
 * Idempotency contract — users (app):
 * - Refreshed: email, name, role, title, department_id, timezone, status, onboarded_at, updated_at
 * - Preserved: last_login_at, last_active_at, login_count, notification_preferences, ui_preferences
 *
 * With --force-reseed: preserved fields are also cleared.
 */

import type { PoolClient } from 'pg';
import { DEMO_DEPARTMENT_IDS, DEMO_USERS, SEED_CREATED_AT } from '../fixtures.js';
import type { DepartmentMap } from './departments.js';

// Department slug → DEMO_DEPARTMENT_IDS key mapping.
const SLUG_TO_DEPT_ID: Record<string, string> = {
  executive: DEMO_DEPARTMENT_IDS.executive,
  'support-ops': DEMO_DEPARTMENT_IDS.supportOps,
  support: DEMO_DEPARTMENT_IDS.support,
};

export async function seedUsers(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean; departmentMap: DepartmentMap }
): Promise<void> {
  const now = new Date().toISOString();

  for (const user of DEMO_USERS) {
    const deptSlug = user.departmentSlug === 'supportOps' ? 'support-ops' : user.departmentSlug;
    const departmentId = SLUG_TO_DEPT_ID[deptSlug] ?? opts.departmentMap[deptSlug];

    if (opts.dryRun) {
      console.log(
        `[dry-run] Would upsert user: ${user.name} <${user.email}> role=${user.role} dept=${deptSlug}`
      );
      continue;
    }

    // 1. Better Auth "user" table.
    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", image, phone, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name           = EXCLUDED.name,
         email          = EXCLUDED.email,
         "emailVerified" = EXCLUDED."emailVerified",
         image          = EXCLUDED.image,
         phone          = EXCLUDED.phone,
         "updatedAt"    = EXCLUDED."updatedAt"`,
      [user.id, user.name, user.email, true, null, null, SEED_CREATED_AT, now]
    );

    // 2. Better Auth "account" table (credential, no password → magic-link).
    await client.query(
      `INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         "updatedAt" = EXCLUDED."updatedAt"`,
      [user.accountId, user.id, user.id, 'credential', SEED_CREATED_AT, now]
    );

    // 3. Supabase app users table.
    if (opts.forceReseed) {
      await client.query(
        `INSERT INTO users (
           id, email, name, org_id, role, title, department_id, timezone, status,
           email_verified, onboarded_at, created_at, updated_at,
           last_login_at, last_active_at, login_count
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NULL, NULL, 0)
         ON CONFLICT (id) DO UPDATE SET
           email          = EXCLUDED.email,
           name           = EXCLUDED.name,
           role           = EXCLUDED.role,
           title          = EXCLUDED.title,
           department_id  = EXCLUDED.department_id,
           timezone       = EXCLUDED.timezone,
           status         = EXCLUDED.status,
           email_verified = EXCLUDED.email_verified,
           onboarded_at   = EXCLUDED.onboarded_at,
           last_login_at  = NULL,
           last_active_at = NULL,
           login_count    = 0,
           updated_at     = EXCLUDED.updated_at`,
        [
          user.id,
          user.email,
          user.name,
          DEMO_USERS[0].id, // placeholder; org_id set by fixtures
          user.role,
          user.title,
          departmentId,
          'America/New_York',
          'active',
          true,
          SEED_CREATED_AT,
          SEED_CREATED_AT,
          now,
        ]
      );

      // Set org_id correctly (the insert above used a placeholder).
      await client.query(
        `UPDATE users SET org_id = (
           SELECT id FROM organizations WHERE slug = 'acme-support-demo' LIMIT 1
         ) WHERE id = $1`,
        [user.id]
      );
    } else {
      await client.query(
        `INSERT INTO users (
           id, email, name, org_id, role, title, department_id, timezone, status,
           email_verified, onboarded_at, created_at, updated_at
         )
         SELECT $1,$2,$3,o.id,$4,$5,$6,$7,$8,$9,$10,$11,$12
         FROM organizations o WHERE o.slug = 'acme-support-demo'
         ON CONFLICT (id) DO UPDATE SET
           email          = EXCLUDED.email,
           name           = EXCLUDED.name,
           role           = EXCLUDED.role,
           title          = EXCLUDED.title,
           department_id  = EXCLUDED.department_id,
           timezone       = EXCLUDED.timezone,
           status         = EXCLUDED.status,
           email_verified = EXCLUDED.email_verified,
           onboarded_at   = EXCLUDED.onboarded_at,
           updated_at     = EXCLUDED.updated_at`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.title,
          departmentId,
          'America/New_York',
          'active',
          true,
          SEED_CREATED_AT,
          SEED_CREATED_AT,
          now,
        ]
      );
    }

    console.log(`[seed] user upserted: ${user.name} <${user.email}> (${user.id})`);
  }
}
