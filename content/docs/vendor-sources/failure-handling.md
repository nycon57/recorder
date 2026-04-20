---
slug: vendor-sources/failure-handling
title: Failure handling
description: Diagnostic playbook for failed ingest_vendor_docs jobs — how to classify, re-queue, or escalate.
audience: system-admin
section: vendor-sources
order: 20
updatedAt: "2026-04-20"
related:
  - vendor-sources/sync-lifecycle
  - vendor-sources/governance
  - platform-runbooks/incident-response
tags:
  - runbook
  - failure
  - diagnostic
---

# Vendor Source Failure Handling

This runbook covers how to diagnose and resolve failures in the vendor-source ingestion pipeline.

## Symptoms

A vendor source has failed when:

- The health page (`/admin/vendor-sources/health`) shows the source status as `failing`.
- The failure log section shows new rows for the source's app in the last sync window.
- The `last_success_at` timestamp on the source card is older than `freshness_target`.

## Common error classes

### robots-blocked

**Error text:** `No pages found to ingest` or `0 pages crawled`

**Cause:** The vendor site's `robots.txt` now disallows the crawler user-agent, or a Disallow rule covers the seed URL path.

**Diagnosis:** Fetch `<source_url>/robots.txt` manually. Compare Disallow entries against the seed URL.

**Resolution:**
- If the crawl is legitimately blocked: contact the vendor, or switch to an SDK/API-based adapter.
- If the robots.txt is overly broad: document in the source record and consider a manual import of the docs.

### content-type mismatch

**Error text:** `Failed to parse HTML` or `Unexpected content-type`

**Cause:** The seed URL returns JSON, a redirect to a PDF, or a JavaScript-rendered SPA that serves an empty HTML shell.

**Resolution:** Update the source's `fetch_strategy` to `api` or `playwright`. Requires a code change to the adapter — open a TRIB ticket.

### 429 / rate-limit

**Error text:** `fetch failed` with status 429, or timeout errors mid-crawl.

**Cause:** The vendor site is throttling the crawler. The `CRAWL_DELAY_MS` default (500 ms) is too aggressive for this host.

**Resolution:** Do not immediately re-sync. Wait the Retry-After window (typically 1 hour), then queue a single sync. If repeated 429s occur, reduce `maxPages` in the source configuration or request an API key from the vendor.

### network timeout

**Error text:** `fetch failed` with `AbortError` or `ECONNRESET`.

**Cause:** Transient network issue between Railway and the vendor host, or the page is too slow to respond within the 15 s timeout.

**Resolution:** Click **Re-sync** once. If the error persists across 3+ attempts, check Railway's network status and the vendor's status page.

### content-hash collision

**Error text:** Rows repeatedly skipped despite content changes.

**Cause:** The hash dedup logic considers a page unchanged when `content_hash` matches, even if the surrounding metadata changed. This is by design — the hash covers only markdown content.

**Resolution:** Use `force: true` when re-queueing (the Re-sync button always passes `force: true`). If pages are still being skipped when they should update, inspect the page content via Preview and compare hashes.

## Re-queue decision tree

```
Did the last job fail?
  └─ Yes
       ├─ Is status 429 or network timeout? → Wait, then Re-sync once.
       ├─ Is it robots-blocked? → Investigate robots.txt change. Do NOT spam re-syncs.
       ├─ Is it a content-type mismatch? → Open a TRIB ticket for adapter update.
       ├─ Has it failed 5+ times? → Disable the source, escalate.
       └─ Otherwise → Re-sync once and monitor the failure log.
```

## When to disable a source

Disable a source (set `terms_review_status = 'restricted'`) when:

- The vendor has changed their terms of service to prohibit automated access.
- The source is a duplicate of another active source.
- The content quality is consistently poor despite successful syncs.

See `vendor-sources/governance.md` for the status transition procedure.

## When to escalate

Escalate to the engineering team (open a TRIB ticket) when:

- The crawler requires a new user-agent allowlist negotiated with the vendor.
- A new adapter strategy (playwright, API) is needed.
- The error volume across multiple sources suggests a systemic worker problem.
- You have disabled a source and need a content replacement plan.

---

> **Docs maintenance:** If new error classes emerge from production incidents, add them to the Common error classes section. Reference the triggering Sentry event ID in the commit message. TRIB-154 owns the cross-cutting docs-maintenance checklist.
