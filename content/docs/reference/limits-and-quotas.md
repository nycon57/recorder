---
title: 'Limits and quotas'
description: 'Storage, job concurrency, retention periods, and session size limits for Tribora. Numbers marked provisional may change before GA.'
audience: public
section: reference
order: 20
tags: [limits, quotas, storage, retention]
related: ['product/recordings', 'reference/data-model']
---

## About these limits

The values on this page reflect current platform defaults. Limits marked **[provisional]** are subject to change before general availability and may differ from values you observe in your workspace. For the current limits applied to your organization, check *Settings → Storage* or contact your account manager.

## Recording session limits

| Limit | Value | Notes |
|---|---|---|
| Maximum session duration | 4 hours | Session terminates at limit; partial upload proceeds |
| Maximum upload size per session | 2 GB | Enforced at the upload endpoint |
| Concurrent active sessions per user | 1 | Starting a new session stops the prior one |
| Local extension buffer | 500 MB | Offline buffer before upload; cleared on success |

## Storage limits per organization

Storage limits depend on the billing plan. The values below are defaults and can be raised by contacting support.

| Plan | Included storage | Overage |
|---|---|---|
| Individual | 10 GB | Not available |
| Team | 100 GB | [provisional] |
| Enterprise | Custom | Negotiated |

Storage is measured as the total of all recording files (MP4), transcripts, and generated assets currently within the retention window.

## Retention periods

| Content type | Default retention | Notes |
|---|---|---|
| Recording files (MP4) | 90 days from capture | File deleted; article retained |
| Transcripts | 90 days from capture | Deleted with recording |
| Wiki articles | Indefinite | Retained until explicitly archived |
| Conversation logs (assistant) | 90 days | Not configurable on current plans |
| Audit logs | 1 year | [provisional] |

Extended retention options (180 days, 1 year, or custom) are available on Team and Enterprise plans. Retention settings apply org-wide; per-recording overrides are not currently supported.

## Processing job concurrency

The pipeline processes recordings asynchronously. Concurrency limits determine how many of your recordings can be in the transcription and structuring stages simultaneously.

| Plan | Concurrent jobs | Notes |
|---|---|---|
| Individual | 2 | |
| Team | 10 | [provisional] |
| Enterprise | Custom | |

Jobs beyond the concurrency limit are queued and begin processing as capacity becomes available. There is no maximum queue depth.

## API rate limits

API rate limits are applied per API key.

| Endpoint class | Rate limit | Window |
|---|---|---|
| Recording uploads | 60 requests | Per hour |
| API reads (GET) | 1000 requests | Per minute |
| Webhook registrations | 10 per org | Hard limit |

Rate limit status is returned in `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers.

## Search index

- Search index update latency after publish: **under 60 seconds** in normal conditions.
- Maximum indexed body size per article: **500 KB** of Markdown. Articles exceeding this are indexed with truncation; full content is still accessible via the API.

## Requesting limit increases

Contact `support@tribora.com` or your account manager to request storage increases, higher concurrency, or extended retention. Include your organization slug and the specific limit you need raised.
