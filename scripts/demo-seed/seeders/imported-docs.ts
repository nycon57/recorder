/**
 * Seeds 8 imported_documents rows (external SOPs and guides).
 *
 * Requires connector_config row to exist first (FK constraint).
 * Idempotency: ON CONFLICT (connector_id, external_id) DO UPDATE SET.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID } from '../fixtures.js';
import { loadImportedDocFixtures } from '../content-fixtures.js';

const SEED_CREATED_AT = '2026-01-20T00:00:00.000Z';
const SEED_METADATA = JSON.stringify({ seed: 'demo' });

export async function seedImportedDocs(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  const docs = loadImportedDocFixtures();

  for (const doc of docs) {
    if (opts.dryRun) {
      console.log(`[dry-run] Would upsert imported doc: ${doc.slug} (${doc.id})`);
      continue;
    }

    await client.query(
      `INSERT INTO imported_documents (
        id, connector_id, org_id, external_id, title, content, file_type, file_size,
        metadata, sync_status, processing_status, chunks_generated, embeddings_generated,
        last_synced_at, first_synced_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (connector_id, external_id) DO UPDATE SET
        title              = EXCLUDED.title,
        content            = EXCLUDED.content,
        file_type          = EXCLUDED.file_type,
        file_size          = EXCLUDED.file_size,
        metadata           = imported_documents.metadata || EXCLUDED.metadata,
        sync_status        = EXCLUDED.sync_status,
        processing_status  = EXCLUDED.processing_status,
        last_synced_at     = EXCLUDED.last_synced_at,
        updated_at         = EXCLUDED.updated_at`,
      [
        doc.id,
        doc.connectorId,
        DEMO_ORG_ID,
        doc.externalId,
        doc.title,
        doc.content,
        doc.fileType,
        doc.fileSize,
        SEED_METADATA,
        'synced',
        'processed',
        true,
        false,
        SEED_CREATED_AT,
        SEED_CREATED_AT,
        SEED_CREATED_AT,
        now,
      ]
    );

    console.log(`[seed] imported doc upserted: ${doc.slug} (${doc.id})`);
  }
}
