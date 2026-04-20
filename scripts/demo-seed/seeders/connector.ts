/**
 * Seeds a demo connector_config row required as the FK parent for imported_documents.
 *
 * The connector represents a Zendesk knowledge-base import integration.
 * Idempotency: ON CONFLICT (id) DO UPDATE SET.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID, DEMO_USER_IDS, DEMO_CONNECTOR_ID } from '../fixtures.js';

const SEED_CREATED_AT = '2026-01-15T00:00:00.000Z';

export async function seedConnector(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();

  if (opts.dryRun) {
    console.log(`[dry-run] Would upsert connector: zendesk (${DEMO_CONNECTOR_ID})`);
    return;
  }

  await client.query(
    `INSERT INTO connector_configs (
      id, org_id, connector_type, name, credentials, settings, is_active,
      sync_status, sync_frequency, created_by, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      name         = EXCLUDED.name,
      is_active    = EXCLUDED.is_active,
      sync_status  = EXCLUDED.sync_status,
      updated_at   = EXCLUDED.updated_at`,
    [
      DEMO_CONNECTOR_ID,
      DEMO_ORG_ID,
      'zendesk',
      'Zendesk Knowledge Base (Demo)',
      JSON.stringify({ api_key: 'demo-placeholder', domain: 'acme.zendesk.com' }),
      JSON.stringify({ seed: 'demo', import_articles: true }),
      true,
      'idle',
      'manual',
      DEMO_USER_IDS.admin,
      SEED_CREATED_AT,
      now,
    ]
  );

  console.log(`[seed] connector upserted: zendesk (${DEMO_CONNECTOR_ID})`);
}
