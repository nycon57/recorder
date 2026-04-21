---
title: Abuse handling
description: Rate-limit spikes, scraper traffic, and content abuse. BotID integration, rate limit configuration, and manual takedown flow.
audience: system-admin
section: security
order: 20
related:
  - security/incident-response
  - security/log-access
  - system-admin/global-quotas
tags:
  - runbook
  - abuse
  - rate-limiting
  - botid
---

## Overview

Abuse signals on Tribora fall into three categories: automated scraping (bots hitting the API or docs surface), rate-limit violations (a single client making too many requests), and content abuse (a user submitting prohibited content). Each has a different detection path and response action.

## Bot detection — BotID

The application integrates BotID for server-side bot detection on public-facing routes and the API. BotID runs at the edge (Next.js middleware) and attaches a `x-botid-score` header to each request.

### BotID score thresholds

| Score | Classification | Default action |
|---|---|---|
| 0–30 | Likely human | Pass through |
| 31–70 | Suspicious | Log + challenge (CAPTCHA if configured) |
| 71–100 | Likely bot | Block and return 403 |

### Viewing BotID signals

BotID logs are visible in:
1. The Vercel Edge Function logs (filter by `botid`)
2. Sentry — events with tag `bot_blocked: true`

### Adjusting BotID thresholds

BotID configuration lives in `src/middleware.ts`. To lower the block threshold from 70 to 50:

```typescript
// src/middleware.ts
const BOTID_BLOCK_THRESHOLD = 50; // was 70
```

Deploy the change via the normal PR flow.

## Rate limiting — Upstash Redis

API routes use `@upstash/ratelimit` with sliding-window counters keyed by IP address and (for authenticated routes) user ID.

### Viewing current rate limit state

Upstash does not have a built-in dashboard for active limiters. Check the Upstash Redis console (console.upstash.com) and scan for keys matching `ratelimit:*`:

```
SCAN 0 MATCH ratelimit:* COUNT 100
```

### Manually unblocking an IP

Rate limit keys expire automatically when the window passes. To force-unblock a specific IP:

```
DEL ratelimit:<ip-address>
```

Run this via the Upstash Redis console or the Upstash CLI.

### Raising the limit for a trusted partner IP

Rate limit rules are defined in `src/lib/rate-limit.ts`. To exempt an IP from the API limiter, add it to the allowlist:

```typescript
const ALLOWLISTED_IPS = new Set([
  '192.0.2.1', // Acme Corp integration server
]);
```

Deploy via normal PR. This is a code change — document the reason in the commit message.

## Content abuse

Content abuse means a user has submitted material that violates the terms of service (hate speech, CSAM, doxxing, etc.).

### Detection

1. User reports — abuse reports arrive via email to the support address. Forward to the on-call engineer.
2. Automated — Sentry may capture moderation-related errors if a content scan is in place.

### Takedown procedure

1. **Identify the content item** by `content.id` or by searching `content.title` / `content.org_id`.
2. **Soft-delete the item** to remove it from user-facing surfaces without destroying evidence:

   ```sql
   UPDATE content
   SET deleted_at = now(),
       deletion_reason = 'abuse_takedown',
       deleted_by = '<your-user-id>'
   WHERE id = '<content-id>';
   ```

3. **Revoke public share links** for the item:

   ```sql
   UPDATE shares
   SET revoked_at = now()
   WHERE content_id = '<content-id>'
     AND revoked_at IS NULL;
   ```

4. **Log the action** in `security_audit_log`:

   ```sql
   INSERT INTO security_audit_log (action, actor_id, target_id, target_type, metadata)
   VALUES (
     'content_takedown',
     '<your-user-id>',
     '<content-id>',
     'content',
     '{"reason": "tos_violation", "report_ref": "<ticket-or-email-id>"}'::jsonb
   );
   ```

5. **Notify the user** if the takedown is non-emergency (give them notice). Skip notification for CSAM or active harm scenarios — act first, notify legal.
6. **Escalate to legal** if the content may require law enforcement notification.

## Suspicious access patterns (P2)

If you observe an account making an unusual number of requests (e.g., bulk-exporting all recordings), but there is no confirmed breach:

1. Check their quota usage — a sudden spike in `quota_usage_events` may explain it.
2. Review recent sessions in `/admin/debug/extension-sessions?userId=<id>` for anomalous activity.
3. If warranted, temporarily disable the account:

   ```sql
   UPDATE "user"
   SET banned = true,
       ban_reason = 'Suspended pending investigation — TRIB-<ticket>'
   WHERE id = '<user-id>';
   ```

4. This invalidates all active sessions on the next request (the auth middleware reads `banned` on each call).

## Related

- [Security incident response](incident-response) — for confirmed breaches (P0/P1)
- [Log access and audit](log-access) — reading Pino and Sentry logs to build a timeline
- [Global quotas](../system-admin/global-quotas) — capping a tenant's resource consumption as a mitigation step
