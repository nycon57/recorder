/**
 * Seeds content, transcripts, transcript_chunks, documents, and content_summaries
 * for all 30 demo recordings. Also seeds content_tags join rows.
 *
 * Idempotency: ON CONFLICT (id) DO UPDATE SET ... per TRIB-145 contract.
 * Embeddings: zero-vector(1536) placeholder — regenerate via `npm run demo:reembed`.
 * R2 paths: deterministic DB-only paths, no blob upload. Playback 404s expected.
 */

import type { PoolClient } from 'pg';

import { DEMO_ORG_ID, DEMO_TAG_IDS } from '../fixtures.js';
import {
  loadRecordingFixtures,
  ZERO_VECTOR_1536,
} from '../content-fixtures.js';
import { deriveChunkId } from '../ids.js';

const SEED_METADATA = JSON.stringify({ seed: 'demo' });

function buildR2Path(orgId: string, recordingId: string): string {
  return `org_${orgId}/recordings/${recordingId}/raw.webm`;
}

function splitChunks(text: string, count = 6): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  if (sentences.length <= count) return sentences;

  const chunkSize = Math.ceil(sentences.length / count);
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const slice = sentences.slice(i * chunkSize, (i + 1) * chunkSize);
    if (slice.length > 0) chunks.push(slice.join(' '));
  }
  return chunks;
}

export async function seedRecordings(
  client: PoolClient,
  opts: { dryRun: boolean; forceReseed: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  const recordings = loadRecordingFixtures();

  await Promise.all(
    recordings.map(async (rec) => {
      const r2Path = buildR2Path(DEMO_ORG_ID, rec.id);

      if (opts.dryRun) {
        console.log(
          `[dry-run] Would upsert recording: ${rec.slug} (${rec.id})`,
        );
        return;
      }

      // ── content ─────────────────────────────────────────────────────────────

      await client.query(
        `INSERT INTO content (
        id, org_id, title, description, status, content_type, file_type,
        mime_type, file_size, duration_sec, storage_provider, storage_tier,
        storage_path_r2, storage_path_raw, thumbnail_url,
        source_type, analysis_type, skip_analysis,
        created_by, created_at, updated_at, completed_at, metadata
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
      )
      ON CONFLICT (id) DO UPDATE SET
        title          = EXCLUDED.title,
        description    = EXCLUDED.description,
        status         = EXCLUDED.status,
        content_type   = EXCLUDED.content_type,
        file_type      = EXCLUDED.file_type,
        mime_type      = EXCLUDED.mime_type,
        file_size      = EXCLUDED.file_size,
        duration_sec   = EXCLUDED.duration_sec,
        storage_provider = EXCLUDED.storage_provider,
        storage_path_r2  = EXCLUDED.storage_path_r2,
        storage_path_raw = EXCLUDED.storage_path_raw,
        source_type    = EXCLUDED.source_type,
        created_by     = EXCLUDED.created_by,
        metadata       = content.metadata || EXCLUDED.metadata,
        updated_at     = EXCLUDED.updated_at,
        completed_at   = EXCLUDED.completed_at`,
        [
          rec.id,
          DEMO_ORG_ID,
          rec.title,
          rec.description,
          'processed',
          'recording',
          'webm',
          'video/webm',
          2_400_000,
          rec.durationSec,
          'r2',
          'hot',
          r2Path,
          r2Path,
          null,
          'upload',
          'general',
          false,
          rec.createdBy,
          rec.createdAt,
          now,
          rec.createdAt,
          SEED_METADATA,
        ],
      );

      // ── transcript ───────────────────────────────────────────────────────────

      await client.query(
        `INSERT INTO transcripts (
        id, content_id, language, text, confidence, provider, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        text       = EXCLUDED.text,
        language   = EXCLUDED.language,
        confidence = EXCLUDED.confidence,
        provider   = EXCLUDED.provider,
        updated_at = EXCLUDED.updated_at`,
        [
          rec.transcriptId,
          rec.id,
          'en',
          rec.transcriptText,
          0.95,
          'demo-seed',
          rec.createdAt,
          now,
        ],
      );

      // ── transcript_chunks ────────────────────────────────────────────────────

      const chunks = splitChunks(rec.transcriptText);
      await Promise.all(
        Array.from(
          { length: Math.max(0, Math.ceil((chunks.length - 0) / 1)) },
          (_, __loopIndex) => 0 + __loopIndex * 1,
        ).map(async (i) => {
          const chunkId = deriveChunkId(rec.slug, i);
          const chunkText = chunks[i]!;
          const startSec = (rec.durationSec / chunks.length) * i;
          const endSec = (rec.durationSec / chunks.length) * (i + 1);

          await client.query(
            `INSERT INTO transcript_chunks (
                id, content_id, org_id, chunk_index, chunk_text, embedding,
                start_time_sec, end_time_sec, chunking_strategy, model, metadata, created_at
              ) VALUES ($1,$2,$3,$4,$5,$6::vector,$7,$8,$9,$10,$11,$12)
              ON CONFLICT (id) DO UPDATE SET
                chunk_text        = EXCLUDED.chunk_text,
                embedding         = EXCLUDED.embedding,
                chunking_strategy = EXCLUDED.chunking_strategy,
                model             = EXCLUDED.model,
                metadata          = EXCLUDED.metadata`,
            [
              chunkId,
              rec.id,
              DEMO_ORG_ID,
              i,
              chunkText,
              ZERO_VECTOR_1536,
              startSec,
              endSec,
              'paragraph',
              'demo-seed-zero-vec',
              SEED_METADATA,
              rec.createdAt,
            ],
          );
        }),
      );

      // ── document ─────────────────────────────────────────────────────────────

      const isPublished = parseInt(rec.slug.slice(-2), 10) <= 22;

      await Promise.all([
        client.query(
          `INSERT INTO documents (
        id, content_id, org_id, markdown, html, summary, version, model,
        is_published, status, created_at, updated_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        markdown     = EXCLUDED.markdown,
        summary      = EXCLUDED.summary,
        version      = EXCLUDED.version,
        model        = EXCLUDED.model,
        is_published = EXCLUDED.is_published,
        status       = EXCLUDED.status,
        metadata     = documents.metadata || EXCLUDED.metadata,
        updated_at   = EXCLUDED.updated_at`,
          [
            rec.documentId,
            rec.id,
            DEMO_ORG_ID,
            rec.documentMarkdown,
            null,
            rec.summaryText,
            'ai:1',
            'demo-seed',
            isPublished,
            'generated',
            rec.createdAt,
            now,
            SEED_METADATA,
          ],
        ),

        // ── content_summary ───────────────────────────────────────────────────────

        client.query(
          `INSERT INTO content_summaries (
        id, content_id, org_id, summary_text, summary_embedding, model, metadata, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5::vector,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        summary_text      = EXCLUDED.summary_text,
        summary_embedding = EXCLUDED.summary_embedding,
        model             = EXCLUDED.model,
        metadata          = content_summaries.metadata || EXCLUDED.metadata,
        updated_at        = EXCLUDED.updated_at`,
          [
            rec.summaryId,
            rec.id,
            DEMO_ORG_ID,
            rec.summaryText,
            ZERO_VECTOR_1536,
            'demo-seed',
            SEED_METADATA,
            rec.createdAt,
            now,
          ],
        ),

        // ── content_tags ─────────────────────────────────────────────────────────

        Promise.all(
          rec.tagNames.map(async (tagName) => {
            const tagId = DEMO_TAG_IDS[tagName as keyof typeof DEMO_TAG_IDS];
            if (!tagId) return;

            await client.query(
              `INSERT INTO content_tags (content_id, tag_id, created_by, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (content_id, tag_id) DO NOTHING`,
              [rec.id, tagId, rec.createdBy, rec.createdAt],
            );
          }),
        ),
      ]);

      console.log(
        `[seed] recording upserted: ${rec.slug} (${chunks.length} chunks, published=${isPublished})`,
      );
    }),
  );
}
