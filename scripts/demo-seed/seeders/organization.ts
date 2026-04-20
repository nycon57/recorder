/**
 * Upserts the canonical demo organization.
 *
 * Idempotency contract:
 * - Conflict key: id
 * - Refreshed on rerun: name, slug, plan, metadata, billing_email, onboarded_at, updated_at
 * - Preserved on rerun: stripe_customer_id, stripe_subscription_id, settings (non-seed keys)
 * - With --force-reseed: additionally clears Stripe fields, resets settings to {}
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG } from '../fixtures.js';

export async function seedOrganization(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean }
): Promise<void> {
  const now = new Date().toISOString();

  if (opts.dryRun) {
    console.log('[dry-run] Would upsert organization:', DEMO_ORG.id, DEMO_ORG.name);

    // Slug collision pre-check (non-mutating).
    const collision = await client.query(
      `SELECT id FROM organizations WHERE slug = $1 AND id != $2 LIMIT 1`,
      [DEMO_ORG.slug, DEMO_ORG.id]
    );
    if (collision.rowCount && collision.rowCount > 0) {
      throw new Error(
        `Slug collision: slug "${DEMO_ORG.slug}" is already owned by org ${collision.rows[0].id}. ` +
          `Cannot seed.`
      );
    }
    return;
  }

  // Pre-check: slug collision guard.
  const collision = await client.query(
    `SELECT id FROM organizations WHERE slug = $1 AND id != $2 LIMIT 1`,
    [DEMO_ORG.slug, DEMO_ORG.id]
  );
  if (collision.rowCount && collision.rowCount > 0) {
    throw new Error(
      `Slug collision: slug "${DEMO_ORG.slug}" is already owned by org ${collision.rows[0].id}. ` +
        `Aborting to avoid corrupting an existing org.`
    );
  }

  if (opts.forceReseed) {
    await client.query(
      `INSERT INTO organizations (
        id, name, slug, plan, metadata, billing_email, onboarded_at, created_at, updated_at,
        stripe_customer_id, stripe_subscription_id, settings
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NULL, NULL, '{}')
      ON CONFLICT (id) DO UPDATE SET
        name          = EXCLUDED.name,
        slug          = EXCLUDED.slug,
        plan          = EXCLUDED.plan,
        metadata      = EXCLUDED.metadata,
        billing_email = EXCLUDED.billing_email,
        onboarded_at  = EXCLUDED.onboarded_at,
        stripe_customer_id     = NULL,
        stripe_subscription_id = NULL,
        settings      = '{}',
        updated_at    = EXCLUDED.updated_at`,
      [
        DEMO_ORG.id,
        DEMO_ORG.name,
        DEMO_ORG.slug,
        DEMO_ORG.plan,
        DEMO_ORG.metadata,
        DEMO_ORG.billing_email,
        DEMO_ORG.onboarded_at,
        DEMO_ORG.created_at,
        now,
      ]
    );
  } else {
    await client.query(
      `INSERT INTO organizations (
        id, name, slug, plan, metadata, billing_email, onboarded_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        name          = EXCLUDED.name,
        slug          = EXCLUDED.slug,
        plan          = EXCLUDED.plan,
        metadata      = EXCLUDED.metadata,
        billing_email = EXCLUDED.billing_email,
        onboarded_at  = EXCLUDED.onboarded_at,
        updated_at    = EXCLUDED.updated_at`,
      [
        DEMO_ORG.id,
        DEMO_ORG.name,
        DEMO_ORG.slug,
        DEMO_ORG.plan,
        DEMO_ORG.metadata,
        DEMO_ORG.billing_email,
        DEMO_ORG.onboarded_at,
        DEMO_ORG.created_at,
        now,
      ]
    );
  }

  console.log(`[seed] organization upserted: ${DEMO_ORG.name} (${DEMO_ORG.id})`);
}
