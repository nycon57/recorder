/**
 * Seeds the vendor demo org (Tribora Vendor Demo) and its white_label_config,
 * then links Acme Support Demo to it via organizations.vendor_org_id.
 *
 * Ordering constraint: vendor org row must exist before the UPDATE on Acme.
 * Slug collision guard mirrors TRIB-145 organization.ts pattern.
 *
 * Idempotency:
 * - vendor org: ON CONFLICT (id) DO UPDATE SET
 * - white_label_config: ON CONFLICT (vendor_org_id) DO UPDATE SET
 * - Acme link: plain UPDATE (idempotent by definition)
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID, DEMO_VENDOR_ORG_ID, DEMO_WHITE_LABEL_CONFIG_ID } from '../fixtures.js';

const VENDOR_SLUG = 'tribora-vendor-demo';
const SEED_CREATED_AT = '2026-01-01T00:00:00.000Z';
const SEED_METADATA = JSON.stringify({ seed: 'demo', generated_by: 'scripts/demo-seed' });

const VENDOR_FEATURES = JSON.stringify({
  recording: true,
  wiki: true,
  assistant: true,
  mcp: true,
  white_label_vendor: true,
  auto_publish_wiki: true,
  digest_weekly: false,
});

const VENDOR_SETTINGS = JSON.stringify({ seed: 'demo' });

const WHITE_LABEL_BRANDING = JSON.stringify({
  product_name: 'Tribora Vendor Demo',
  primary_color: '#4f46e5',
  logo_url: null,
});

export async function seedVendorOrg(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();

  if (opts.dryRun) {
    console.log(`[dry-run] Would upsert vendor org: ${VENDOR_SLUG} (${DEMO_VENDOR_ORG_ID})`);
    console.log(`[dry-run] Would upsert white_label_config: ${DEMO_WHITE_LABEL_CONFIG_ID}`);
    console.log(`[dry-run] Would link Acme org vendor_org_id → ${DEMO_VENDOR_ORG_ID}`);
    return;
  }

  // ── Slug collision guard ─────────────────────────────────────────────────

  const collision = await client.query(
    `SELECT id FROM organizations WHERE slug = $1 AND id != $2 LIMIT 1`,
    [VENDOR_SLUG, DEMO_VENDOR_ORG_ID]
  );
  if (collision.rowCount && collision.rowCount > 0) {
    throw new Error(
      `Slug collision: slug "${VENDOR_SLUG}" is already owned by org ${collision.rows[0].id}. ` +
        `Cannot seed vendor org.`
    );
  }

  // ── Vendor org insert ────────────────────────────────────────────────────

  await client.query(
    `INSERT INTO organizations (
      id, name, slug, plan, metadata, billing_email, features, settings,
      max_users, max_storage_gb, onboarded_at, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT (id) DO UPDATE SET
      name           = EXCLUDED.name,
      slug           = EXCLUDED.slug,
      plan           = EXCLUDED.plan,
      metadata       = EXCLUDED.metadata,
      features       = organizations.features || EXCLUDED.features,
      settings       = organizations.settings || EXCLUDED.settings,
      max_users      = EXCLUDED.max_users,
      max_storage_gb = EXCLUDED.max_storage_gb,
      updated_at     = EXCLUDED.updated_at`,
    [
      DEMO_VENDOR_ORG_ID,
      'Tribora Vendor Demo',
      VENDOR_SLUG,
      'enterprise',
      SEED_METADATA,
      'billing@vendor.tribora.test',
      VENDOR_FEATURES,
      VENDOR_SETTINGS,
      100,
      1000,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
      now,
    ]
  );

  console.log(`[seed] vendor org upserted: ${VENDOR_SLUG} (${DEMO_VENDOR_ORG_ID})`);

  // ── White-label config ───────────────────────────────────────────────────

  await client.query(
    `INSERT INTO white_label_configs (
      id, vendor_org_id, branding, voice_config, knowledge_scope,
      custom_domain, is_active, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (vendor_org_id) DO UPDATE SET
      branding        = EXCLUDED.branding,
      voice_config    = EXCLUDED.voice_config,
      knowledge_scope = EXCLUDED.knowledge_scope,
      is_active       = EXCLUDED.is_active,
      updated_at      = EXCLUDED.updated_at`,
    [
      DEMO_WHITE_LABEL_CONFIG_ID,
      DEMO_VENDOR_ORG_ID,
      WHITE_LABEL_BRANDING,
      JSON.stringify({}),
      ['hubspot', 'zendesk', 'jira'],
      null,
      true,
      SEED_CREATED_AT,
      now,
    ]
  );

  console.log(`[seed] white_label_config upserted: ${DEMO_WHITE_LABEL_CONFIG_ID}`);

  // ── Link Acme → vendor org ───────────────────────────────────────────────

  await client.query(
    `UPDATE organizations SET vendor_org_id = $1, updated_at = $2 WHERE id = $3`,
    [DEMO_VENDOR_ORG_ID, now, DEMO_ORG_ID]
  );

  console.log(`[seed] linked Acme org vendor_org_id → ${DEMO_VENDOR_ORG_ID}`);
}
