/**
 * Upserts demo departments.
 *
 * Returns a map of department slug → UUID for use by the users seeder.
 *
 * Idempotency contract:
 * - Conflict key: id
 * - Refreshed: name, description, default_visibility, slug, updated_at
 * - Preserved: nothing user-specific (no interaction fields on departments)
 */

import type { PoolClient } from 'pg';

import { DEMO_DEPARTMENTS } from '../fixtures.js';

export type DepartmentMap = Record<string, string>;

export async function seedDepartments(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<DepartmentMap> {
  const map: DepartmentMap = {};
  const now = new Date().toISOString();

  for (const dept of DEMO_DEPARTMENTS) {
    map[dept.slug] = dept.id;

    if (opts.dryRun) {
      console.log(`[dry-run] Would upsert department: ${dept.name} (${dept.id})`);
      continue;
    }

    await client.query(
      `INSERT INTO departments (
        id, org_id, name, slug, description, default_visibility, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        name               = EXCLUDED.name,
        slug               = EXCLUDED.slug,
        description        = EXCLUDED.description,
        default_visibility = EXCLUDED.default_visibility,
        updated_at         = EXCLUDED.updated_at`,
      [
        dept.id,
        dept.org_id,
        dept.name,
        dept.slug,
        dept.description,
        dept.default_visibility,
        dept.created_at,
        now,
      ]
    );

    console.log(`[seed] department upserted: ${dept.name} (${dept.id})`);
  }

  return map;
}
