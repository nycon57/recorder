---
title: Security incident response
description: Response procedures for data exposure, credential leaks, and suspicious access. Distinct from the operational incident runbook.
audience: system-admin
section: security
order: 10
related:
  - security/abuse-handling
  - security/log-access
tags:
  - runbook
  - security
  - incident
---

## Scope and distinction

This runbook covers **security incidents**: data exposure, credential compromise, unauthorized access, and privacy breaches. It is distinct from [`platform-runbooks/incident-response`](../platform-runbooks/incident-response), which covers operational outages — service unavailability, worker failures, and infrastructure degradation.

If you are responding to "the site is down," use the platform runbook. If you are responding to "someone may have accessed data they should not have," use this one.

## Severity classification

| Severity | Definition |
|---|---|
| P0 — Critical | Confirmed unauthorized access to customer data; active credential in use; keys leaked publicly |
| P1 — High | Suspected unauthorized access; credential exposed in logs or commit history |
| P2 — Medium | Anomalous access pattern — possible bot or unauthorized automation; no confirmed data access |
| P3 — Low | Configuration drift, stale keys, minor policy violations without data impact |

## Immediate response — P0 / P1

### 1. Contain the blast radius (< 5 minutes)

**If a service account key or API key was exposed:**

1. Rotate the affected credential immediately. Do not wait for confirmation — rotate first, investigate after.
   - Supabase service role key: Supabase dashboard → Settings → API → Regenerate service_role key. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel and Railway immediately.
   - Stripe secret key: Stripe dashboard → Developers → API Keys → Roll key.
   - Any other key: follow the provider's rotation procedure.
2. Invalidate all active user sessions if the auth secret (`BETTER_AUTH_SECRET`) was exposed:

   ```sql
   DELETE FROM session WHERE expires_at > now();
   ```

   This forces all users to re-authenticate. Announce downtime if needed.

**If unauthorized access to a Supabase table is suspected:**

1. Identify the source IP or user from the Supabase audit log (Settings → Logs → API Edge Logs).
2. If an active session is in progress, revoke it:

   ```sql
   DELETE FROM session WHERE id = '<session-id>';
   ```

### 2. Assess the scope

Answer these questions before proceeding:

- Which table(s) or resource(s) were accessed?
- Which org(s) had data in those rows?
- Was the access read-only (data exposure) or write (data corruption / injection)?
- Is the vector still active (key still valid, session still live)?

### 3. Preserve evidence

Before rotating any credentials or deleting any logs:

1. Export the relevant Supabase API Edge Log entries to a file and store in a secure location (not the repo).
2. Export Sentry error events for the affected time window.
3. Take a snapshot of the `security_audit_log` table:

   ```sql
   SELECT * FROM security_audit_log
   WHERE created_at BETWEEN '<start>' AND '<end>'
   ORDER BY created_at;
   ```

4. Screenshot the Railway worker logs for the affected time window.

### 4. Notify

- **Internally:** Alert the engineering lead and any DPA (Data Processing Agreement) owners immediately. Do not send details over public Slack channels.
- **Customer notification:** Required within 72 hours for any GDPR-reportable breach (EU customer data accessed without authorization). Consult with legal before drafting the notification.
- **Regulator notification:** Required if the breach meets the GDPR Article 33 threshold. Timeline: 72 hours from awareness.

## Recovery

1. Re-issue all rotated credentials to production (Vercel and Railway env vars).
2. Verify the app and worker start cleanly with the new credentials.
3. Monitor Sentry for errors for 30 minutes post-recovery.
4. Write a post-mortem in the TRIB issue tracker within 48 hours. Include: timeline, root cause, immediate actions taken, and prevention measures.

## Post-mortem template

```markdown
## Incident: <short description>

**Date:** YYYY-MM-DD
**Severity:** P0 / P1 / P2
**Duration:** From detection to containment

### Timeline
- HH:MM — <event>
- HH:MM — <action taken>

### Root cause
<One paragraph. Evidence-based, not speculative.>

### Impact
<Which data, which orgs, estimated row count.>

### Actions taken
1. <action>

### Prevention
1. <change to code / config / process>
```

## Related

- [Abuse handling](abuse-handling) — rate-limit spikes and scraper traffic (lower severity, automated mitigation)
- [Log access and audit](log-access) — how to pull Pino JSON logs and Sentry traces
- Operational incident response (`platform-runbooks/incident-response`) — platform outages and service unavailability
