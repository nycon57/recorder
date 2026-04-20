---
slug: vendor-sources/governance
title: Governance
description: Curation decisions for vendor sources — adding, removing, and managing page lifecycle.
audience: system-admin
section: vendor-sources
order: 30
updatedAt: "2026-04-20"
related:
  - vendor-sources/sync-lifecycle
  - vendor-sources/failure-handling
  - vendor-sources/cost-and-quotas
tags:
  - runbook
  - governance
  - curation
---

# Vendor Source Governance

This runbook covers the decision-making and procedural steps for managing the vendor source lifecycle: what gets added, what gets removed, and how curation decisions are recorded.

## Adding a source

Before adding a new source:

1. **Verify official status** — the source must have `official_source = true`. Unofficial mirrors or community forks are not permitted. Check the vendor's own documentation site URL.
2. **Review terms of service** — confirm the vendor permits automated access for internal tooling. Set `terms_review_status = 'approved'` only after review.
3. **Estimate cost** — see `vendor-sources/cost-and-quotas.md` for the crawl cost model. Estimate `maxPages` from the site's sitemap before adding.

### Procedure

1. Open `/admin/vendor-sources/new`.
2. Fill in: App name, Source URL, Publisher hostname, Fetch strategy (default: `web`), Max pages.
3. Submit — this creates the `vendor_doc_sources` row and queues the first sync immediately.
4. Monitor the sync on the dashboard. Inspect pages via `/admin/vendor-sources/pages?app=<name>`.
5. If the sync produces low-quality pages, delete them individually and adjust the seed URL or `maxPages`.

## Removing a source

Removing a source is a two-step process:

### Step 1 — restrict

Set `terms_review_status = 'restricted'` to stop new syncs without deleting existing corpus content. Use this when:

- Terms of service review is in progress.
- The source is temporarily unavailable.
- You need to stop crawls while investigating a quality issue.

```sql
UPDATE vendor_doc_sources
SET terms_review_status = 'restricted', updated_at = now()
WHERE app = 'target-app';
```

### Step 2 — retire (optional)

If the source is permanently removed:

1. Delete associated `vendor_wiki_pages` rows via the admin UI or a direct SQL DELETE (log the action).
2. Delete the `vendor_doc_sources` row.
3. Document the retirement reason in a Linear comment on the source's tracking issue.

## Page retraction

Individual pages can be deleted from `/admin/vendor-sources/pages/[id]` using the **Delete page** button. This triggers the `vendor_source.page.deleted` audit log event.

When to retract a page:

- The page contains incorrect information that cannot be corrected by a resync.
- The page is duplicate content with a different screen identifier.
- The vendor has requested removal of specific content.

Page retraction is immediate and hard — there is no soft-delete or recycle bin.

## Drift response

When a source's drift indicator shows amber or red on the health page:

1. **Check** if a sync is already running (status = `syncing`). If so, wait.
2. **Re-sync** via the health table Re-sync button.
3. **If re-sync fails** — consult `vendor-sources/failure-handling.md`.
4. **If content quality is the issue** — use Preview on individual pages to inspect, then decide whether to retract or wait for improved extraction.

## Applicability bands

Each vendor source can scope its pages to specific tenant configurations via the `applicability` JSON column:

- `version_band` — array of version strings (e.g. `["3.x", "4.x"]`). Empty = all versions.
- `plan_band` — array of plan names (e.g. `["enterprise"]`). Empty = all plans.

These bands affect which knowledge responses include pages from this source. Changes to bands take effect on the next corpus sync.

## Official source invariant

The `official_source = true` invariant must be maintained. Do not add community forks, unofficial mirrors, or user-generated content as vendor sources. If uncertain, contact the vendor for an official documentation URL or API.

---

> **Docs maintenance:** Update this runbook whenever the source creation form, terms review workflow, or applicability band semantics change. TRIB-154 owns the cross-cutting docs-maintenance checklist.
