---
slug: vendor-sources/preview-and-health
title: Preview and health affordances
description: How to use the page preview, health table, and failure log to inspect and maintain vendor source quality.
audience: system-admin
section: vendor-sources
order: 50
updatedAt: "2026-04-20"
related:
  - vendor-sources/failure-handling
  - vendor-sources/governance
  - vendor-sources/sync-lifecycle
tags:
  - runbook
  - preview
  - health
---

# Vendor Source Preview and Health Affordances

This runbook documents the operator-facing tools shipped in TRIB-152 for inspecting vendor source content quality and monitoring sync health.

## Page preview

### How to access

1. Navigate to `/admin/vendor-sources/pages`.
2. Filter by App or search by screen name.
3. Click any page row to open the detail view at `/admin/vendor-sources/pages/[id]`.
4. Click the **Preview** button in the top-right action bar.

The preview opens an in-page dialog with two panes:

- **Left pane** — the page's markdown rendered as HTML. Scroll within the pane if content is long.
- **Right rail** — compact metadata: App, Screen, Source URL link, last-updated date, curated-by (operator email or UUID fragment), and ingest job link.

### What to look for

| Signal | Meaning | Action |
|--------|---------|--------|
| Missing sections | Crawl extracted partial content | Re-sync or adjust seed URL |
| Broken markdown (raw `***` or unrendered tables) | Markdown conversion issue | Open a TRIB ticket for the extractor |
| Stale date in metadata | Page not re-synced recently | Check freshness on health table |
| `—` in Curated by | Scheduled sync (no operator attribution) | Normal for non-manual syncs |
| Empty preview body | Old crawl with no content column | Re-sync to populate |

### Security note

Vendor content is untrusted. The preview renderer applies `rehype-sanitize` with an explicit allow-list schema. Script tags, inline event handlers, and `javascript:` hrefs are stripped before rendering. You cannot preview raw HTML — only sanitized output.

## Health table

### How to access

Click **Health** in the top-right toolbar of the Vendor Sources dashboard, or navigate directly to `/admin/vendor-sources/health`.

The health table shows all configured sources sorted by severity: failing → stale → never_synced → syncing → healthy.

### Reading the drift indicator

Each row shows a **Drift** column with:

- **Absolute days** since last successful sync (e.g. `7d`).
- **Percentage** of the freshness budget consumed (e.g. `50%`).
- **Color** — supplementary, never the sole indicator:
  - Green: less than 50% of budget consumed.
  - Amber: 50–100% of budget consumed.
  - Red: over 100% — past the freshness target.

A source showing `14d (100%)` in red means it is exactly at its freshness target and needs a sync. A source showing `Never synced` in red has never successfully completed a crawl.

### Re-sync from the health table

Click the **Re-sync** button in the Actions column of any row. This enqueues an `ingest_vendor_docs` job with `force: true`. A toast notification confirms the job ID.

## Failure log

The failure log is on the `/admin/vendor-sources/health` page below the health table.

### Reading a failure row

| Column | Meaning |
|--------|---------|
| When | How long ago the job was queued |
| App | The vendor app that was being synced |
| Error | Truncated first line of the error message |
| Attempts | How many times the worker tried before giving up |
| Triggered by | Operator email (manual sync) or — (scheduled) |
| Job | Clickable ID that opens a detail dialog |

### Job detail dialog

Click any job ID to open a full detail view showing:

- The complete error message.
- The full job payload (JSON).
- Timestamps for queue, start, and completion.

### Retry from the failure log

If the failure row contains a `source_id` in its payload, a **Re-sync** button appears in the Actions column. Clicking it re-queues the sync immediately.

If no source ID is present (URL-only jobs from older code), use the dashboard source card to trigger a new sync instead.

## Curated-by attribution

The **Curated by** field on the page detail view shows who last ingested the page:

- Operator email — a system admin manually triggered the sync.
- UUID fragment — the user row could not be resolved (user deleted, or UUID from before email resolution was added).
- `—` — a scheduled sync ran without an operator context. This is normal and expected.

Attribution applies to the **last writer** on update, not the original creator. If a scheduled sync overwrites a manually-curated page, the curated-by field reflects the scheduled run (null). This is intentional — the field tracks last-touched-by, not created-by.

---

> **Docs maintenance:** Update this runbook whenever the preview dialog layout, health table columns, or failure log columns change. TRIB-154 owns the cross-cutting docs-maintenance checklist — consult it for the PR process when modifying this file alongside a UI change.
