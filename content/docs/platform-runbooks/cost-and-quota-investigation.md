---
title: Cost and quota investigation
description: Diagnosing sudden cost spikes across R2, AI providers, and Redis. How to read cost dashboards and throttle a tenant.
audience: system-admin
section: platform-runbooks
order: 40
related:
  - platform-runbooks/worker-ops
  - system-admin/global-quotas
tags:
  - runbook
  - cost
  - quotas
  - r2
  - ai
---

## Overview

Cost anomalies on Tribora fall into three categories: storage (Cloudflare R2), AI inference (Google Gemini / OpenAI), and caching (Upstash Redis). Each has a different detection signal and throttle mechanism. This runbook walks through diagnosing a spike and the levers available to slow it down.

## Step 1 — Identify the cost category

Navigate to `/admin/cost-management` and look at the top-line breakdown:

| Signal | Likely cause |
|---|---|
| R2 bytes transferred ↑ sharply | A tenant is downloading large recordings at high volume, or an export job is looping |
| AI token usage ↑ | A bulk enrichment job, a runaway wiki compilation sweep, or a single tenant consuming tokens abnormally fast |
| Redis ops ↑ | Cache stampede — a cold-start scenario with many concurrent requests hitting the same cache key |

## Step 2 — Identify the tenant

Run the following query to rank tenants by usage in the last 24 hours:

```sql
SELECT org_id, event_type, SUM(quantity) AS total
FROM quota_usage_events
WHERE created_at > now() - interval '24 hours'
GROUP BY org_id, event_type
ORDER BY total DESC
LIMIT 20;
```

Compare the top org against its configured quota in `org_quotas`:

```sql
SELECT o.name, oq.recording_seconds_limit, oq.storage_bytes_limit, oq.ai_tokens_limit
FROM org_quotas oq
JOIN organizations o ON o.id = oq.org_id
WHERE oq.org_id = '<org-id>';
```

## Step 3 — Diagnose AI token spikes

### Identify the job type consuming tokens

```sql
SELECT payload->>'type' AS handler, SUM((payload->>'token_count')::int) AS tokens
FROM jobs
WHERE status = 'completed'
  AND completed_at > now() - interval '24 hours'
  AND payload->>'org_id' = '<org-id>'
GROUP BY handler
ORDER BY tokens DESC;
```

Common culprits:

- **`enrich_recording`** — runs once per recording; if a large batch was imported, expect a proportional spike.
- **`compile_wiki`** — re-runs when enough new recordings arrive. If it is looping, check for an infinite re-trigger condition.
- **`ingest_vendor_docs`** — only consumes tokens during AI metadata extraction; check if a source re-crawl was triggered manually.

### Pause a specific job type for a tenant

There is no per-tenant per-job-type kill switch in the current system. The fastest mitigation is to raise the tenant's `ai_tokens_limit` to a hard cap that stops new jobs from being enqueued:

```sql
UPDATE org_quotas
SET ai_tokens_limit = <current_used>  -- set to exactly what they've already used
WHERE org_id = '<org-id>';
```

This causes subsequent quota checks to fail and enqueue new enrichment jobs as `quota_exceeded`. Remove the cap once the investigation is complete.

## Step 4 — Diagnose R2 storage spikes

### Check recent large transfers

Cloudflare R2 metrics are available in the Cloudflare dashboard under the `tribora-recordings` bucket → Analytics → Data Transfer. Spikes correlate to:

- Bulk exports triggered from `/library`
- A download loop caused by a broken client retry
- Background jobs reading recordings for processing (e.g., transcription)

### Reduce bandwidth for a specific org

If a tenant is actively exporting large volumes, you can temporarily disable their API key access via the `api_keys` table:

```sql
UPDATE api_keys
SET is_active = false
WHERE org_id = '<org-id>'
  AND is_active = true;
```

This blocks SDK-driven downloads. Browser-session downloads continue through the web app and are not affected by this flag.

## Step 5 — Diagnose Redis spikes

A Redis op spike typically resolves itself after a cold-start wave passes. If it persists:

1. Check the Upstash dashboard for the specific key namespace generating traffic.
2. Look for `Cache read error` lines in the worker or API logs — these indicate Redis is rejecting connections, which causes the app to fall back to the database for every request.
3. If the Redis connection is failing entirely, the app degrades gracefully (errors are caught and logged as `WARN`). No action is required beyond monitoring.

## Step 6 — Document and escalate

After throttling a tenant, document the action:

```sql
INSERT INTO audit_logs (org_id, action, actor_id, metadata)
VALUES (
  '<org-id>',
  'quota_emergency_cap',
  '<your-user-id>',
  '{"reason": "cost spike investigation TRIB-<ticket>", "original_limit": <n>, "cap_set": <n>}'::jsonb
);
```

If the spike is caused by a platform bug (e.g., a looping worker handler), open a TRIB ticket and link it to the audit log entry.

## Related

- [Worker operations](worker-ops) — pausing and recovering specific job types
- [Global quotas](../system-admin/global-quotas) — platform-wide ceiling configuration
