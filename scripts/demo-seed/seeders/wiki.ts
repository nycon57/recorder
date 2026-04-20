/**
 * Seeds org_wiki_pages and wiki_page_sources for the 12 demo wiki pages.
 *
 * Idempotency: ON CONFLICT (id) DO UPDATE SET ... per TRIB-145 contract.
 * Embeddings: zero-vector(1536) placeholder.
 * Preserved: cluster_id (Louvain cron owns it), supersedes_id.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID } from '../fixtures.js';
import { loadWikiPageFixtures, ZERO_VECTOR_1536 } from '../content-fixtures.js';
import { deriveWikiSourceId } from '../ids.js';

const SEED_METADATA = { seed: 'demo' };
const VALID_FROM = '2026-02-01T00:00:00.000Z';

export async function seedWiki(
  client: PoolClient,
  opts: { dryRun: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  const pages = loadWikiPageFixtures();

  for (const page of pages) {
    if (opts.dryRun) {
      console.log(
        `[dry-run] Would upsert wiki page: ${page.slug} (confidence=${page.confidence}, published=${page.isPublished})`
      );
      continue;
    }

    const compilationLog = JSON.stringify([
      {
        ...SEED_METADATA,
        compiled_at: VALID_FROM,
        source_count: page.sourceRecordingIds.length,
        is_published: page.isPublished,
      },
    ]);

    await client.query(
      `INSERT INTO org_wiki_pages (
        id, org_id, app, topic, content, confidence, valid_from, valid_until,
        compilation_log, embedding, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        app            = EXCLUDED.app,
        topic          = EXCLUDED.topic,
        content        = EXCLUDED.content,
        confidence     = EXCLUDED.confidence,
        valid_from     = EXCLUDED.valid_from,
        valid_until    = EXCLUDED.valid_until,
        compilation_log = org_wiki_pages.compilation_log || EXCLUDED.compilation_log,
        embedding      = EXCLUDED.embedding,
        updated_at     = EXCLUDED.updated_at`,
      [
        page.id,
        DEMO_ORG_ID,
        page.app,
        page.topic,
        page.content,
        page.confidence,
        VALID_FROM,
        null,
        compilationLog,
        ZERO_VECTOR_1536,
        VALID_FROM,
        now,
      ]
    );

    // ── wiki_page_sources ────────────────────────────────────────────────────

    for (const recSlug of page.sourceRecordingSlugs) {
      const sourceId = page.sourceRecordingIds[page.sourceRecordingSlugs.indexOf(recSlug)];
      if (!sourceId) continue;

      const wikiSourceId = deriveWikiSourceId(page.slug, recSlug);

      await client.query(
        `INSERT INTO wiki_page_sources (id, page_id, source_type, source_id, contributed_at, contribution_summary)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           source_type          = EXCLUDED.source_type,
           contributed_at       = EXCLUDED.contributed_at,
           contribution_summary = EXCLUDED.contribution_summary`,
        [
          wikiSourceId,
          page.id,
          'recording',
          sourceId,
          VALID_FROM,
          `Source recording contributing to: ${page.topic}`,
        ]
      );
    }

    console.log(
      `[seed] wiki page upserted: ${page.slug} (confidence=${page.confidence}, sources=${page.sourceRecordingSlugs.length})`
    );
  }
}
