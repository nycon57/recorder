/**
 * Seeds 4 knowledge gap rows: 2 open, 1 in_progress, 1 resolved.
 *
 * Note: knowledge_gaps.org_id is TEXT (not UUID) — pass DEMO_ORG_ID as string.
 * Idempotency: ON CONFLICT (id) DO UPDATE SET.
 * Preserved: resolved_at (cleared only with --force-reseed).
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID } from '../fixtures.js';
import { KNOWLEDGE_GAP_FIXTURES } from '../content-fixtures.js';

const SEED_CREATED_AT = '2026-02-15T00:00:00.000Z';
const SEED_METADATA = JSON.stringify({ seed: 'demo' });

export async function seedKnowledgeGaps(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean },
): Promise<void> {
  const now = new Date().toISOString();

  await Promise.all(
    KNOWLEDGE_GAP_FIXTURES.map(async (gap) => {
      if (opts.dryRun) {
        console.log(
          `[dry-run] Would upsert knowledge gap: ${gap.topic} (${gap.id})`,
        );
        return;
      }

      const resolvedAt =
        gap.status === 'resolved' ? '2026-04-01T00:00:00.000Z' : null;

      if (opts.forceReseed) {
        // Force-reseed: clear resolved_at on all gaps.
        await client.query(
          `INSERT INTO knowledge_gaps (
          id, org_id, topic, description, severity, impact_score, search_count,
          status, suggested_action, metadata, resolved_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          topic            = EXCLUDED.topic,
          description      = EXCLUDED.description,
          severity         = EXCLUDED.severity,
          impact_score     = EXCLUDED.impact_score,
          search_count     = EXCLUDED.search_count,
          status           = EXCLUDED.status,
          suggested_action = EXCLUDED.suggested_action,
          metadata         = knowledge_gaps.metadata || EXCLUDED.metadata,
          resolved_at      = EXCLUDED.resolved_at,
          updated_at       = EXCLUDED.updated_at`,
          [
            gap.id,
            DEMO_ORG_ID,
            gap.topic,
            gap.description,
            gap.severity,
            gap.impactScore,
            gap.searchCount,
            gap.status,
            gap.suggestedAction,
            SEED_METADATA,
            resolvedAt,
            SEED_CREATED_AT,
            now,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO knowledge_gaps (
          id, org_id, topic, description, severity, impact_score, search_count,
          status, suggested_action, metadata, resolved_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          topic            = EXCLUDED.topic,
          description      = EXCLUDED.description,
          severity         = EXCLUDED.severity,
          impact_score     = EXCLUDED.impact_score,
          search_count     = EXCLUDED.search_count,
          status           = EXCLUDED.status,
          suggested_action = EXCLUDED.suggested_action,
          metadata         = knowledge_gaps.metadata || EXCLUDED.metadata,
          updated_at       = EXCLUDED.updated_at`,
          [
            gap.id,
            DEMO_ORG_ID,
            gap.topic,
            gap.description,
            gap.severity,
            gap.impactScore,
            gap.searchCount,
            gap.status,
            gap.suggestedAction,
            SEED_METADATA,
            resolvedAt,
            SEED_CREATED_AT,
            now,
          ],
        );
      }

      console.log(
        `[seed] knowledge gap upserted: ${gap.slug} status=${gap.status}`,
      );
    }),
  );
}
