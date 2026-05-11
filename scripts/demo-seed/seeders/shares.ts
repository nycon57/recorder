/**
 * Seeds 3 public-link share rows targeting wiki pages.
 *
 * Note: shares.share_id is a separate unique text column (not the PK).
 * Idempotency: ON CONFLICT (id) DO UPDATE SET.
 * Preserved: access_count, last_accessed_at (interaction trail).
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID } from '../fixtures.js';
import { buildShareFixtures } from '../content-fixtures.js';

const SEED_CREATED_AT = '2026-02-15T00:00:00.000Z';

export async function seedShares(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean },
): Promise<void> {
  const shares = buildShareFixtures();

  await Promise.all(
    shares.map(async (share) => {
      if (opts.dryRun) {
        console.log(
          `[dry-run] Would upsert share: ${share.slug} (${share.id})`,
        );
        return;
      }

      if (opts.forceReseed) {
        await client.query(
          `INSERT INTO shares (
          id, org_id, target_type, target_id, share_id, expires_at,
          access_count, last_accessed_at, created_by, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          target_type      = EXCLUDED.target_type,
          target_id        = EXCLUDED.target_id,
          expires_at       = EXCLUDED.expires_at,
          access_count     = 0,
          last_accessed_at = NULL`,
          [
            share.id,
            DEMO_ORG_ID,
            share.targetType,
            share.targetId,
            share.shareToken,
            share.expiresAt,
            0,
            null,
            share.createdBy,
            SEED_CREATED_AT,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO shares (
          id, org_id, target_type, target_id, share_id, expires_at,
          access_count, created_by, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          target_type = EXCLUDED.target_type,
          target_id   = EXCLUDED.target_id,
          expires_at  = EXCLUDED.expires_at`,
          [
            share.id,
            DEMO_ORG_ID,
            share.targetType,
            share.targetId,
            share.shareToken,
            share.expiresAt,
            0,
            share.createdBy,
            SEED_CREATED_AT,
          ],
        );
      }

      console.log(
        `[seed] share upserted: ${share.slug} → ${share.targetType} (${share.targetId})`,
      );
    }),
  );
}
