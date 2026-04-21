---
title: Log access and audit
description: Who can read which logs, log retention periods, and how to capture evidence for incident response.
audience: system-admin
section: security
order: 30
related:
  - security/incident-response
  - security/abuse-handling
tags:
  - runbook
  - logs
  - audit
  - sentry
---

## Overview

Tribora emits structured logs through three pipelines: Pino JSON logs (application and worker), Sentry error events and traces, and Supabase API edge logs. Each pipeline has a different access path, retention period, and appropriate use case. This runbook documents how to reach each log source and what each contains.

## Pino application logs

**Location:** Railway log viewer (production), terminal (development)

**Format:** JSON in production, pretty-printed in development

**Retention:** Railway retains 7 days of logs on the Starter plan. Logs are not persisted elsewhere unless Railway log drain is configured.

**Access:**

1. Open [railway.app](https://railway.app) → recorder project.
2. Select the **web** service (Next.js app) or the **worker** service.
3. Click **Logs** in the left sidebar.
4. Filter by text using the search bar. Common filters:
   - `WARN` or `ERROR` — surfaces problems
   - `[docs:db]` — DB adapter events
   - `[security]` — auth and access-control events
   - `component: ingest_vendor_docs` — vendor sync events

**Who can access:** System admins with Railway project membership.

### Useful Pino log patterns

| Pattern | What it means |
|---|---|
| `[docs:db] loadDbPages failed` | DB adapter couldn't load — check Supabase connectivity |
| `[SECURITY] Non-system-admin` | Someone tried to hit a system-admin endpoint |
| `[requireSystemAdmin] Error fetching user` | Admin client query failed — check service role key |
| `[worker] job failed, attempt N/3` | Handler error — check the `error` field for the root cause |

## Sentry error events and traces

**Location:** [sentry.io](https://sentry.io) → Tribora organization → recorder project

**Retention:** 90 days for error events, 30 days for performance traces.

**Access:** All engineers with Sentry org membership. System admins should have `owner` or `manager` role.

### Finding errors after an incident

1. Open Sentry → Issues → filter by `environment: production`.
2. Set the time range to the incident window.
3. Sort by **First Seen** to find new error types introduced by the incident.
4. For traces: open Performance → filter by transaction name or URL path.

### Capturing a Sentry issue for a report

1. Open the issue.
2. Click **Share** → copy the link. The link is accessible to anyone with Sentry org membership.
3. To export for external documentation (legal, law enforcement): use **Download** → JSON.

### Sentry alert rules

Sentry alert rules are configured to notify on:

- New error types in production (Slack channel `#alerts-prod`)
- Error rate spike > 10x baseline (PagerDuty, if configured)

## Supabase API edge logs

**Location:** Supabase dashboard → clpatptmumyasbypvmun project → Logs → API Edge Logs

**Retention:** Supabase retains API edge logs for 7 days on the Pro plan.

**Format:** Each entry includes: timestamp, method, path, response status, response time, user agent, and the request's JWT sub (user ID, if authenticated).

**Access:** Supabase project members with `owner` role.

### Finding unauthorized access in API edge logs

Filter by status `403` or `401`:

```
status: 403
```

Or filter by path pattern:

```
path: /rest/v1/docs_pages
```

To narrow to a specific user's requests, filter by the JWT `sub` field (user ID).

### Exporting logs for evidence preservation

1. Apply the relevant time and filter combination.
2. Click **Download** to export as CSV.
3. Store the CSV in a secure location (not the code repository).
4. Reference the download in the incident post-mortem.

## `security_audit_log` table

Certain operator actions are written to the `security_audit_log` table (takedowns, quota caps, manual session terminations). This is the canonical audit trail for operator actions.

```sql
SELECT action, actor_id, target_id, target_type, metadata, created_at
FROM security_audit_log
WHERE created_at > '<incident-start>'
ORDER BY created_at;
```

This table is append-only — rows are never deleted. Service-role access only.

## Log access policy

| Log source | Access level | Retention |
|---|---|---|
| Railway (Pino) | System admin (Railway membership) | 7 days |
| Sentry events | All engineers | 90 days |
| Sentry traces | All engineers | 30 days |
| Supabase edge logs | System admin (Supabase owner) | 7 days |
| `security_audit_log` | System admin (via admin SQL) | Indefinite |

## Related

- [Security incident response](incident-response) — what to preserve and when
- [Abuse handling](abuse-handling) — building a timeline from logs during a suspected abuse event
