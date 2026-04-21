---
title: Storage alerts
description: Reading storage alerts and health indicators, acknowledging alerts, and escalation procedures for storage anomalies.
audience: system-admin
section: system-admin
order: 30
related:
  - system-admin/global-quotas
  - platform-runbooks/cost-and-quota-investigation
tags:
  - runbook
  - storage
  - alerts
---

## Overview

The storage alerting system monitors per-org storage consumption and fires alerts when usage crosses configured thresholds. Two dashboards surface this information: `/admin/storage-alerts` for the active alert queue, and `/admin/storage-health` for the broader health picture including historical trends. This runbook explains how to read both surfaces and respond to common alert patterns.

## The alert queue — `/admin/storage-alerts`

The alert queue lists all `open` and `acknowledged` alerts sorted by severity (critical → warning → info). Each row shows:

| Column | Description |
|---|---|
| Org | The affected organization |
| Type | Alert category (see below) |
| Severity | `critical`, `warning`, or `info` |
| Triggered | Timestamp when the alert was raised |
| Value | The metric value that breached the threshold |
| Threshold | The configured threshold |

### Alert types

| Type | Meaning |
|---|---|
| `storage_threshold_warning` | Org has consumed 80% of its `storage_bytes_limit` |
| `storage_threshold_critical` | Org has consumed 95% of its `storage_bytes_limit` |
| `storage_growth_anomaly` | Day-over-day growth rate exceeds the baseline by 3x |
| `storage_quota_exceeded` | Org is at or over its limit; new uploads are blocked |

### Acknowledging an alert

Click the **Ack** button on an alert row, or run:

```sql
UPDATE alerts
SET status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by = '<your-user-id>'
WHERE id = '<alert-id>';
```

Acknowledging an alert keeps it visible in the queue but removes it from the critical-count badge. It does not resolve the underlying condition.

### Resolving an alert

Alerts auto-resolve when the triggering condition clears (e.g., the org deletes content and drops below the threshold). To manually resolve an alert that you have addressed:

```sql
UPDATE alerts
SET status = 'resolved',
    resolved_at = now()
WHERE id = '<alert-id>';
```

## Storage health — `/admin/storage-health`

The storage health dashboard shows:

- **Per-org storage breakdown** by tier (hot / warm / cold archive)
- **System-wide storage used vs. total allocated** (R2 bucket-level)
- **Growth trend chart** — 30-day rolling view per org
- **Recommendations** — AI-generated suggestions for archival or deletion

Use this dashboard to identify which orgs are growing fastest before alerts fire.

## Responding to a `storage_quota_exceeded` alert

When an org's storage is full:

1. **Notify the org's owner** via email (use Resend: `POST /api/admin/email/quota-exceeded` with `{ orgId }`).
2. **Check if the org is on a plan that should have a higher limit.** If their Stripe subscription covers more storage, the `org_quotas` row may be stale. Update it:

   ```sql
   UPDATE org_quotas
   SET storage_bytes_limit = <new-limit>
   WHERE org_id = '<org-id>';
   ```

3. **If the org is legitimately over quota**, the correct path is an upgrade. Do not raise limits without a corresponding billing change.
4. **Emergency grace extension** — if the org needs 24–48 hours to clean up, temporarily raise the limit, set a calendar reminder to re-evaluate, and document the extension:

   ```sql
   INSERT INTO audit_logs (org_id, action, actor_id, metadata)
   VALUES (
     '<org-id>',
     'storage_grace_extension',
     '<your-user-id>',
     '{"expires": "<ISO-date>", "reason": "grace period pending cleanup"}'::jsonb
   );
   ```

## Responding to a `storage_growth_anomaly` alert

A 3x growth-rate spike usually means one of:

- A bulk import (user imported a large Drive folder)
- A runaway worker that is storing intermediate artifacts
- A test account used for load testing

Check recent uploads:

```sql
SELECT c.org_id, o.name, count(*) AS uploads, sum(c.file_size) AS total_bytes
FROM content c
JOIN organizations o ON o.id = c.org_id
WHERE c.created_at > now() - interval '1 day'
  AND c.org_id = '<org-id>'
GROUP BY c.org_id, o.name;
```

If the growth is from a bulk import, no action is needed beyond monitoring. If it looks like a worker loop, see [Worker operations](../platform-runbooks/worker-ops).

## Alert configuration

Alert thresholds are stored in `alert_config`. To adjust the 80% warning threshold to 90%:

```sql
UPDATE alert_config
SET warning_threshold_pct = 90
WHERE org_id = '<org-id>'
  AND alert_type = 'storage_threshold_warning';
```

Global defaults apply to orgs without a custom config row.

## Related

- [Global quotas](global-quotas) — raising or removing per-org storage limits
- [Cost and quota investigation](../platform-runbooks/cost-and-quota-investigation) — diagnosing what drove the storage growth
