---
title: Sync lifecycle
description: End-to-end walkthrough of a vendor-source sync from trigger through curation attribution.
audience: system-admin
section: vendor-sources
order: 10
related:
  - vendor-sources/failure-handling
  - vendor-sources/governance
  - platform-runbooks/incident-response
tags:
  - runbook
  - ingest
  - sync
---

# Vendor Source Sync Lifecycle

This runbook documents the complete lifecycle of a vendor-source sync: how it is triggered, what the worker does, how pages are attributed, and how to observe a sync in progress.

## Trigger paths

There are three ways a sync is initiated:

### 1. Dashboard manual sync

An operator opens `/admin/vendor-sources`, finds the source card, and clicks **Re-sync now** (or uses the **Re-sync** button on the health page). This calls:

```
POST /api/admin/vendor-sources/ingest
{ "sourceId": "<uuid>", "force": true }
```

The API resolves the source row, reads the configured `source_url`, and enqueues an `ingest_vendor_docs` job with `triggered_by_user_id` set to the operator's user ID. The `force: true` flag bypasses the dedupe-key guard so a resync always runs even if a prior job completed recently.

### 2. New source ingestion

An operator submits the **Add source** form at `/admin/vendor-sources/new`. On success the API creates a `vendor_doc_sources` row and immediately enqueues the first sync job.

### 3. Scheduled worker sweep

The background worker process runs a scheduled sweep (configurable via cron) that calls `isVendorSourceDueForSync()` for each active source. Sources whose `last_success_at` is older than `freshness_target` are re-queued automatically. These jobs have `triggered_by_user_id = null`.

## Job queue

All sync jobs are `type = 'ingest_vendor_docs'` rows in the `jobs` table. Key fields:

| Field | Purpose |
|-------|---------|
| `payload.url` | Seed URL to crawl |
| `payload.app` | App identifier |
| `payload.sourceId` | FK to `vendor_doc_sources` |
| `payload.triggered_by_user_id` | Operator UUID or null (scheduled) |
| `payload.syncType` | `'manual'` or `'scheduled'` |
| `status` | `pending → processing → completed / failed` |
| `dedupe_key` | Prevents double-queueing for same source |

The jobs endpoint at `/api/admin/vendor-sources/jobs` returns recent rows. The failure log at `/api/admin/vendor-sources/failures` returns only failed rows with operator email resolution.

## Worker phases

The `handleIngestVendorDocs` handler in `src/lib/workers/handlers/ingest-vendor-docs.ts` runs these steps in sequence:

1. **Parse seed URL** — validates `http/https` protocol.
2. **Resolve source registry** — looks up the `vendor_doc_sources` row by `sourceId` or `app + url`. Records the attempt timestamp.
3. **Fetch robots.txt** — parses `Disallow` rules and `Crawl-delay`. Disallowed paths are skipped during crawl.
4. **BFS crawl** — breadth-first crawl of same-domain pages up to `maxPages` (default 50). Each page: fetch → cheerio parse → strip nav/footer/aside → extract main content → convert to Markdown.
5. **Hash deduplication** — each page's markdown is SHA-256 hashed. If `content_hash` matches the existing row and `vendor_source_id` is unchanged, the page is skipped.
6. **Upsert** — changed or new pages are written to `vendor_wiki_pages` via INSERT or UPDATE. Both operations set `curated_by` and `ingest_job_id` for attribution.
7. **Corpus sync** — `syncVendorCorpusFromLegacyPages` mirrors the upserted rows into the canonical corpus table.
8. **Registry update** — `vendor_doc_sources.last_success_at`, `content_hash`, and `status` are updated.

## Attribution

From TRIB-152, every INSERT and UPDATE to `vendor_wiki_pages` includes:

- `curated_by` — the `triggered_by_user_id` from the job payload. Null for scheduled syncs.
- `ingest_job_id` — the `jobs.id` of the job that wrote the row. Stable across re-syncs (the last writer wins).

These fields are visible in the page detail view at `/admin/vendor-sources/pages/[id]`.

## Observability during a sync

1. Open the ledger (`/admin/vendor-sources`). The source row's status changes to `syncing`, and the detail pane links to the latest sync job.
2. Open `/admin/jobs` and filter by `type=ingest_vendor_docs` to watch the job row transition from `pending → processing → completed`.
3. The Recent jobs strip on the dashboard auto-refreshes every 5 s.
4. After completion, the source row updates `Last success`, `Content/corpus hash`, and latest job status.
5. If the job fails, the source status moves to `failing` and the failure log gains a new row.

---

> **Docs maintenance:** If the worker payload shape (`IngestVendorDocsPayload`) gains or loses fields, update the job queue table above. If the BFS crawl strategy or hash algorithm changes, update the Worker phases section. TRIB-154 owns the cross-cutting docs-maintenance checklist.
