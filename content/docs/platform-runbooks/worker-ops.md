---
title: Worker operations
description: Running the background job worker, inspecting the job queue, restarting stuck jobs, and handler-level observability.
audience: system-admin
section: platform-runbooks
order: 30
related:
  - platform-runbooks/deployment-lifecycle
  - platform-runbooks/cost-and-quota-investigation
tags:
  - runbook
  - worker
  - jobs
  - railway
---

## Overview

The background job worker processes all async workloads: transcription, AI enrichment, wiki compilation, vendor doc ingestion, and email delivery. It runs as a separate Railway service and polls the `jobs` table for pending work. This runbook covers how to start the worker locally, read queue state, diagnose failures, and recover stuck jobs.

## Starting the worker

**Development (with hot reload):**

```bash
npm run worker:dev
```

**Production equivalent (single run, no watch):**

```bash
npm run worker
```

The worker logs to stdout using Pino. In development, output is pretty-printed. In production (Railway), it emits JSON that is collected by Railway's log aggregator.

**Never start a second worker process against the same database while one is already running.** The `jobs` table uses optimistic locking (`attempt_count` + `status` transitions) to prevent double-processing, but running duplicate workers wastes compute and creates confusing log interleaving.

## Queue introspection

### Check pending job count

```sql
SELECT type, status, count(*)
FROM jobs
WHERE status IN ('pending', 'processing')
GROUP BY type, status
ORDER BY type, status;
```

### Inspect the oldest pending jobs

```sql
SELECT id, type, status, attempt_count, created_at, dedupe_key
FROM jobs
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 20;
```

### Find jobs stuck in `processing`

A job is stuck if its `processing_started_at` is more than 10 minutes old and `status` is still `processing`. This means the worker died mid-flight.

```sql
SELECT id, type, attempt_count, processing_started_at, created_at
FROM jobs
WHERE status = 'processing'
  AND processing_started_at < now() - interval '10 minutes'
ORDER BY processing_started_at ASC;
```

## Recovering stuck jobs

### Reset a single stuck job

```sql
UPDATE jobs
SET status = 'pending',
    processing_started_at = NULL,
    attempt_count = attempt_count  -- leave count intact; handler will retry
WHERE id = '<job-id>'
  AND status = 'processing';
```

### Bulk-reset all timed-out processing jobs

```sql
UPDATE jobs
SET status = 'pending',
    processing_started_at = NULL
WHERE status = 'processing'
  AND processing_started_at < now() - interval '10 minutes';
```

After the reset, the worker will pick up the jobs on its next poll cycle (default: every 5 seconds).

### Permanently fail a job that keeps retrying

If a job has exceeded its retry budget (typically `attempt_count >= 3`) and the underlying cause is not fixable without a code change, mark it failed:

```sql
UPDATE jobs
SET status = 'failed',
    error = 'Manually failed by operator — see TRIB-<ticket>'
WHERE id = '<job-id>';
```

## Handler-level observability

Each handler writes structured logs using Pino. To filter by handler in Railway logs:

- **Transcription:** `component: transcribe`
- **Wiki compilation:** `component: compile_wiki`
- **Vendor doc ingest:** `component: ingest_vendor_docs`
- **AI enrichment:** `component: enrich`

In Sentry, job failures appear under the `worker` service with the job type in the transaction name. Filter by `type:<handler-name>` to isolate failures.

### What a healthy worker log looks like

```
INFO  [worker] polling — pending: 0, processing: 0
INFO  [worker] picked up job transcribe_audio id=abc123
INFO  [transcribe] completed in 4.2s — words: 312
INFO  [worker] polling — pending: 0, processing: 0
```

### What a failing handler looks like

```
INFO  [worker] picked up job ingest_vendor_docs id=xyz789
ERROR [ingest_vendor_docs] robots.txt blocked crawl — source: acme.com/docs
WARN  [worker] job failed, attempt 1/3 — requeueing with backoff
```

After 3 attempts, the job transitions to `failed` and no longer appears in the active queue.

## Restarting the Railway worker

**Via the Railway dashboard:**

1. Open [railway.app](https://railway.app) → recorder project → worker service.
2. Click **Restart** in the top-right of the deployment panel.
3. Wait ~15 seconds for the new process to start polling.

**Via the Railway CLI:**

```bash
railway run --service worker -- echo "ping"
# If the service is healthy, this exits 0 almost immediately.
```

To force a full redeploy (rebuilds the Docker image):

```bash
railway up --service worker
```

## Related

- [Deployment lifecycle](deployment-lifecycle) — rolling out a new worker version
- [Cost and quota investigation](cost-and-quota-investigation) — diagnosing AI-cost spikes from runaway jobs
