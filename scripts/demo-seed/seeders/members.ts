/**
 * Upserts Better Auth org-plugin membership records.
 *
 * Maps each demo user's role to the "member" table linking them to the demo org.
 *
 * Idempotency contract:
 * - Conflict key: id
 * - Refreshed: role, updatedAt
 * - Preserved: createdAt
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID, DEMO_USERS, SEED_CREATED_AT } from '../fixtures.js';

export async function seedMembers(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();

  for (const user of DEMO_USERS) {
    if (opts.dryRun) {
      console.log(
        `[dry-run] Would upsert member: ${user.email} role=${user.role} org=${DEMO_ORG_ID}`
      );
      continue;
    }

    await client.query(
      `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         role        = EXCLUDED.role,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [user.memberId, DEMO_ORG_ID, user.id, user.role, SEED_CREATED_AT, now]
    );

    console.log(`[seed] member upserted: ${user.email} role=${user.role} (${user.memberId})`);
  }
}
