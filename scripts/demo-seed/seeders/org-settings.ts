/**
 * Refreshes Acme Support Demo org settings, features, branding fields.
 *
 * UPDATE-only — never inserts. The TRIB-145 organization seeder owns the row.
 * Preserved: stripe_*, subscription_status, trial_ends_at, onboarded_at.
 *
 * Uses jsonb_strip_nulls + || to merge seed keys without wiping unknown keys.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID } from '../fixtures.js';

const ORG_FEATURES = JSON.stringify({
  recording: true,
  wiki: true,
  assistant: true,
  mcp: true,
  white_label_vendor: false,
  auto_publish_wiki: true,
  digest_weekly: true,
});

const ORG_SETTINGS = JSON.stringify({
  timezone: 'America/New_York',
  default_visibility: 'org',
  notification_channels: ['email'],
  quota_warning_percent: 80,
  retention_days: 365,
  seed: 'demo',
});

export async function seedOrgSettings(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();

  if (opts.dryRun) {
    console.log(`[dry-run] Would UPDATE org settings: ${DEMO_ORG_ID}`);
    return;
  }

  await client.query(
    `UPDATE organizations SET
       primary_color   = $1,
       max_users       = $2,
       max_storage_gb  = $3,
       features        = features || $4::jsonb,
       settings        = settings || $5::jsonb,
       updated_at      = $6
     WHERE id = $7`,
    [
      '#2f6d5e',
      25,
      250,
      ORG_FEATURES,
      ORG_SETTINGS,
      now,
      DEMO_ORG_ID,
    ]
  );

  console.log(`[seed] org settings refreshed: ${DEMO_ORG_ID}`);
}
