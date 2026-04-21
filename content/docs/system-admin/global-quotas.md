---
title: Global quotas
description: Platform-wide resource ceilings, per-org overrides, hard vs. soft caps, and the admin quotas dashboard.
audience: system-admin
section: system-admin
order: 20
related:
  - platform-runbooks/cost-and-quota-investigation
  - system-admin/storage-alerts
tags:
  - runbook
  - quotas
  - billing
---

## Overview

Tribora enforces resource quotas at two levels: platform-wide defaults applied to every org, and per-org overrides that raise or lower those defaults for specific customers. Quotas govern recording storage (bytes), AI token consumption, and recording duration (seconds). This runbook explains how to read, update, and reason about each level.

## The quota model

The `org_quotas` table holds one row per org with the following ceilings:

| Column | Unit | Default | Notes |
|---|---|---|---|
| `recording_seconds_limit` | seconds | 14,400 (4 h/mo) | Total monthly recording duration |
| `storage_bytes_limit` | bytes | 10,737,418,240 (10 GB) | Cumulative stored bytes |
| `ai_tokens_limit` | tokens | 500,000 | Monthly AI inference tokens |

Limits of `-1` mean uncapped. Usage is tracked via `quota_usage_events` — the application inserts an event row on every billable action and checks the running sum before accepting new work.

### Hard vs. soft caps

- **Hard cap** — the system rejects the operation and returns `HTTP 402 Quota Exceeded`. Default for all limits.
- **Soft cap** — the operation succeeds but triggers a warning notification. The application currently enforces hard caps only. Soft-cap notifications are emitted via the alerting system when usage crosses 80% of the limit.

## Viewing quotas via the admin dashboard

Navigate to `/admin/quotas` to see all orgs sorted by usage percentage. Each row shows:

- Current usage vs. limit for each dimension
- Percentage consumed this month
- Last usage event timestamp

## Reading raw quota state

```sql
SELECT
  o.name AS org_name,
  oq.recording_seconds_limit,
  oq.storage_bytes_limit,
  oq.ai_tokens_limit,
  COALESCE(SUM(CASE WHEN qe.event_type = 'recording_seconds' THEN qe.quantity END), 0) AS recording_seconds_used,
  COALESCE(SUM(CASE WHEN qe.event_type = 'storage_bytes' THEN qe.quantity END), 0) AS storage_bytes_used,
  COALESCE(SUM(CASE WHEN qe.event_type = 'ai_tokens' THEN qe.quantity END), 0) AS ai_tokens_used
FROM org_quotas oq
JOIN organizations o ON o.id = oq.org_id
LEFT JOIN quota_usage_events qe ON qe.org_id = oq.org_id
  AND qe.created_at >= date_trunc('month', now())
GROUP BY o.name, oq.recording_seconds_limit, oq.storage_bytes_limit, oq.ai_tokens_limit
ORDER BY o.name;
```

## Updating a quota

### Raise a single org's storage limit to 50 GB

```sql
UPDATE org_quotas
SET storage_bytes_limit = 53687091200  -- 50 * 1024^3
WHERE org_id = '<org-id>';
```

### Remove all caps for an enterprise org

```sql
UPDATE org_quotas
SET recording_seconds_limit = -1,
    storage_bytes_limit = -1,
    ai_tokens_limit = -1
WHERE org_id = '<org-id>';
```

### Reset monthly usage counters (e.g., after a billing dispute)

Usage events are append-only — there is no direct counter column to reset. To credit a tenant, insert a negative event:

```sql
INSERT INTO quota_usage_events (org_id, event_type, quantity, metadata)
VALUES (
  '<org-id>',
  'ai_tokens',
  -50000,  -- negative quantity reverses the consumption
  '{"reason": "operator credit — TRIB-<ticket>"}'::jsonb
);
```

This is auditable and does not alter historical events.

## Creating quotas for a new org

New orgs receive default quota rows via an `after insert` trigger. If the row is missing (e.g., a manually seeded org):

```sql
INSERT INTO org_quotas (org_id, recording_seconds_limit, storage_bytes_limit, ai_tokens_limit)
VALUES ('<org-id>', 14400, 10737418240, 500000)
ON CONFLICT (org_id) DO NOTHING;
```

## Escalation

If an org's legitimate usage consistently exceeds its limit, the appropriate path is to upgrade their Stripe subscription. The billing system (Stripe webhooks + `organizations.plan` column) automatically elevates limits on plan changes. Do not indefinitely increase limits manually without a corresponding billing change — this creates plan-vs-limits drift that is difficult to audit.

## Related

- [Cost and quota investigation](../platform-runbooks/cost-and-quota-investigation) — diagnosing cost spikes from runaway usage
- [Storage alerts](storage-alerts) — threshold-based alerting when orgs approach their storage ceiling
