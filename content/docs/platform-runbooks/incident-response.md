---
title: Incident response
description: Triage and mitigation guide for vendor-source incidents that spill into platform operations.
audience: system-admin
section: platform-runbooks
order: 10
related:
  - vendor-sources/failure-handling
  - vendor-sources/sync-lifecycle
  - vendor-sources/governance
tags:
  - runbook
  - incident
---

# Vendor Source Incident Response

This runbook covers incidents where vendor-source sync failures or data quality problems escalate beyond a single source and require coordinated operator response.

## Detection

Monitor the following signals:

1. **Vendor Sources dashboard** (`/admin/vendor-sources`) — summary cards show Stale / Failing counts above your normal baseline.
2. **Health page** (`/admin/vendor-sources/health`) — drift indicators turn amber or red across multiple sources simultaneously.
3. **Failure log** (`/admin/vendor-sources/health` → Failure log section) — more than 3 failed jobs in the last 60 minutes.
4. **Sentry** — `ingest-vendor-docs` service emitting repeated `Failed to update vendor wiki page` or `Crawl complete — 0 pages` events.
5. **Operator reports** — support team observes stale knowledge responses in the assistant.

## Triage

Determine scope before acting:

### Single-source failure

- One app is failing, others are healthy.
- Root cause is usually upstream: site rate-limiting, robots.txt change, HTML structure change, or SSL error.
- Response: consult `vendor-sources/failure-handling.md`.

### Multi-source failure

- Two or more apps failing simultaneously.
- Root cause is usually systemic: worker process down, database unreachable, R2 connectivity, or Supabase quota.
- Check Railway worker logs: `railway logs --service worker`.
- Check Supabase project status at `https://status.supabase.com`.

### Corpus quality incident

- Sources are syncing (status = healthy) but knowledge responses are incorrect or missing sections.
- Root cause: content extraction changed, markdown conversion broke, or hash dedup skipped updates incorrectly.
- Inspect page content via the Preview button on any `/admin/vendor-sources/pages/[id]` detail page.

## Mitigation

### Pause a source

Set `terms_review_status = 'restricted'` for the affected source via the database console:

```sql
UPDATE vendor_doc_sources
SET terms_review_status = 'restricted', updated_at = now()
WHERE app = 'target-app';
```

This prevents new syncs from queuing. Existing corpus pages remain available.

### Force a resync

From the health table, click **Re-sync** on any source. This enqueues a new `ingest_vendor_docs` job with `force: true`, bypassing the dedupe-key guard.

### Roll back a corpus page

Use the Delete button on the page detail view (`/admin/vendor-sources/pages/[id]`) to remove a bad page from the corpus. The page will be re-ingested on the next sync unless the source is paused.

## Postmortem

After mitigation:

1. Record what failed, when, and how it was detected in a Sentry incident note.
2. If the crawler needed a code change (new allowlist, adapter patch), open a TRIB ticket referencing this incident.
3. Update `vendor_source_events` if your tenant tracks source-level audit events.
4. If robots.txt or terms-of-service changed, update `terms_review_status` accordingly and document in `vendor-sources/governance.md`.

## Related runbooks

- [Sync lifecycle](vendor-sources/sync-lifecycle.md) — end-to-end sync walkthrough
- [Failure handling](vendor-sources/failure-handling.md) — per-error diagnostic playbook
- [Governance](vendor-sources/governance.md) — source lifecycle decisions

---

> **Docs maintenance:** If the worker payload shape or job queue behavior changes, update `vendor-sources/sync-lifecycle.md` alongside this file. TRIB-154 owns the cross-cutting docs-maintenance pattern — consult it for the PR checklist when making infrastructure changes that touch runbook content.
