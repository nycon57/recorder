/**
 * Upserts canonical demo tags into the `tags` table.
 *
 * Idempotency: ON CONFLICT (id) DO UPDATE SET name, color, description, updated_at.
 * Preserved: created_at, deleted_at.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID, DEMO_USER_IDS } from '../fixtures.js';
import { TAG_FIXTURES } from '../content-fixtures.js';

export async function seedTags(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  const SEED_CREATED_AT = '2026-01-15T00:00:00.000Z';

  for (const tag of TAG_FIXTURES) {
    if (opts.dryRun) {
      console.log(`[dry-run] Would upsert tag: ${tag.name} (${tag.id})`);
      continue;
    }

    await client.query(
      `INSERT INTO tags (id, org_id, name, color, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         color       = EXCLUDED.color,
         description = EXCLUDED.description,
         updated_at  = EXCLUDED.updated_at`,
      [
        tag.id,
        DEMO_ORG_ID,
        tag.name,
        tag.color,
        tag.description,
        DEMO_USER_IDS.admin,
        SEED_CREATED_AT,
        now,
      ]
    );

    console.log(`[seed] tag upserted: ${tag.name} (${tag.id})`);
  }
}
