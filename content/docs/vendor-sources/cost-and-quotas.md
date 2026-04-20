---
slug: vendor-sources/cost-and-quotas
title: Cost and quotas
description: Crawl cost model, monitoring signals, and quota response procedures for vendor source syncs.
audience: system-admin
section: vendor-sources
order: 40
updatedAt: "2026-04-20"
related:
  - vendor-sources/sync-lifecycle
  - vendor-sources/governance
  - vendor-sources/failure-handling
tags:
  - runbook
  - cost
  - quotas
---

# Vendor Source Cost and Quotas

This runbook covers the cost model for vendor-source crawls, how to monitor crawl load, and how to respond when sources exceed budget guardrails.

## Cost inputs

The primary cost drivers for a vendor-source sync are:

1. **HTTP requests** — one request per crawled page plus one for `robots.txt`. A source configured with `maxPages = 50` generates at most 51 outbound requests per sync.
2. **Crawl delay** — the worker applies a 500 ms polite delay between page fetches. A 50-page crawl takes approximately 25 seconds of elapsed time.
3. **Database writes** — each new or changed page generates an INSERT or UPDATE to `vendor_wiki_pages`. Unchanged pages (hash match) generate zero writes.
4. **Corpus sync** — after upsert, `syncVendorCorpusFromLegacyPages` mirrors rows into the corpus table. This is proportional to the number of changed pages.
5. **Railway CPU** — the worker is single-threaded per job. Concurrent jobs on multiple sources multiply CPU usage accordingly.

## Monitoring

### Dashboard signals

- **Pages per source** — visible on the source card under Coverage. Compare across syncs to detect unexpected growth.
- **Sync duration** — the jobs table (`/admin/jobs`) shows `processing_started_at` and `completed_at`. Duration growth indicates upstream slowdown or content expansion.
- **Failure rate** — the failure log (`/admin/vendor-sources/health`) accumulates failed jobs. High failure rates combined with 429 errors indicate the crawler is being throttled.

### Sentry rate

Search for `ingest-vendor-docs` service events. A healthy sync emits `Starting vendor doc ingestion`, `Robots.txt parsed`, `Crawl complete`, and `Vendor corpus sync after ingestion complete` — four events. More than four events per sync indicates retry loops or error conditions.

## `maxPages` configuration

Each source has a `maxPages` value set at creation time. The default is 50. The configured value is passed through the job payload as `payload.maxPages`.

To review or update `maxPages` for a source:

```sql
SELECT app, max_pages, source_url
FROM vendor_doc_sources
ORDER BY max_pages DESC;

UPDATE vendor_doc_sources
SET max_pages = 25, updated_at = now()
WHERE app = 'target-app';
```

After updating, queue a resync to apply the new limit.

## Quota responses

### Throttle schedule

If a vendor site returns 429 errors:

1. Do not immediately re-sync. Wait at least the Retry-After interval (check the response headers in Sentry).
2. After the wait, queue a single sync and monitor the failure log.
3. If throttling is persistent, reduce `maxPages` to 10–15 and add a note to the source record.

### Postpone resync

When crawl cost needs to be reduced (e.g. during a Railway cost spike):

1. Set `terms_review_status = 'restricted'` on lower-priority sources to stop scheduled syncs.
2. Re-enable the highest-value sources first once the spike resolves.

### Escalate to source owner

If a vendor's documentation site cannot be crawled without exceeding rate limits:

1. Contact the vendor's developer relations team for an API key or official documentation export.
2. Document the escalation in the source's Linear issue.
3. Consider switching `fetch_strategy` to `api` once credentials are available (requires a code change).

## Budget guardrails

The following limits are enforced in code:

| Guardrail | Value | Location |
|-----------|-------|----------|
| Default `maxPages` | 50 | `DEFAULT_MAX_PAGES` in `ingest-vendor-docs.ts` |
| Fetch timeout per page | 15 s | `FETCH_TIMEOUT_MS` |
| Polite crawl delay | 500 ms | `CRAWL_DELAY_MS` |
| Failure API limit | 100 rows max | `GET /api/admin/vendor-sources/failures` |

These values are intentionally conservative. Do not raise `DEFAULT_MAX_PAGES` above 200 without a discussion about Railway quota impact.

---

> **Docs maintenance:** Update the Budget guardrails table whenever these constants change in `ingest-vendor-docs.ts`. Add new cost inputs if new external calls are introduced (e.g. AI enrichment per page). TRIB-154 owns the cross-cutting docs-maintenance checklist.
