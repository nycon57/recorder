# Rate Limits & Quotas

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** Per‑endpoint *rate limits* (short‑term request shaping), per‑user/org *quotas* (consumption caps), error semantics, headers, and client/server backoff strategies. Applies to Web/API routes and background jobs (where noted).

This doc defines how we prevent abuse, contain costs, and keep performance predictable under bursty loads. It specifies **limits by endpoint**, **quota units**, **headers to return**, **retry/backoff patterns**, and **implementation patterns** using Upstash/Vercel KV or Postgres where appropriate.

---

## 1) Terminology

* **Rate limit**: short‑term throughput control (e.g., 20 req/min). Enforced by sliding window / token bucket. Returns **429** on breach.
* **Quota**: longer‑horizon consumption cap (e.g., 300 AI queries/day per org; 30 video hours/mo). Returns **402/429** depending on plan semantics.
* **Unit**: measurement for quota (requests, tokens, minutes, bytes, jobs).
* **Scope**: key used to count (IP, user_id, org_id, endpoint).

---

## 2) Enforcement Strategy

* **Edge rate limit** (preferred): Upstash/Vercel KV with **fixed or sliding window** per key. Low latency, globally replicated.
* **Server concurrency caps**: in‑process semaphore for expensive paths (e.g., docify, embeddings) to smooth bursts.
* **DB‑backed quotas**: authoritative monthly/daily counters in `usage_counters` (see `usage-metering-spec.md`).
* **Cost guardrails**: fail‑open vs fail‑closed policies per endpoint (table below).

### 2.1 Keys & Scopes

Composite keys are formatted `rl:<env>:<endpoint>:<scope-type>:<scope-id>`

* Example: `rl:prod:assistant_query:org:c2b3...`
* IP fallback for unauthenticated endpoints: `rl:prod:public_api:ip:203.0.113.5`

### 2.2 Storage Choices

* **Upstash KV/Redis**: milliseconds latency, TTL per window bucket.
* **Postgres**: authoritative quotas (daily/monthly aggregates).
* **In‑memory**: per‑instance concurrency caps only (not durable or global).

---

## 3) Standard Headers & Errors

Return the following for **every** rate‑limited endpoint:

| Header                  | Meaning                                       |
| ----------------------- | --------------------------------------------- |
| `X-RateLimit-Limit`     | Max requests per window (numeric)             |
| `X-RateLimit-Remaining` | Remaining requests in current window          |
| `X-RateLimit-Reset`     | Unix epoch seconds when window resets         |
| `Retry-After`           | Seconds to wait (on 429)                      |
| `X-Org-Quota-Remaining` | Remaining quota units for org (if applicable) |
| `X-Request-Id`          | Correlation id                                |

**Error body (JSON)**

```json
{ "code": "RATE_LIMITED", "message": "Too many requests. Try again later.", "retryAfterSec": 12, "requestId": "..." }
```

**Status codes**

* **429 RATE_LIMITED**: per‑endpoint rate violated.
* **402 PAYMENT_REQUIRED**: plan exhausted and overage disabled.
* **409 CONFLICT**: concurrent mutation guard (e.g., finalize already in progress).
* **403 FORBIDDEN**: plan/role doesn’t include capability (not a rate issue).
* **503 SERVICE_UNAVAILABLE**: circuit breaker active; include `Retry-After`.

---

## 4) Backoff & Retry Patterns

### 4.1 Client Guidance

* Use **exponential backoff with jitter**: base 500ms, factor 2, cap 30s.
* Respect `Retry-After` and `X-RateLimit-Reset`.
* For uploads: persist **upload session id**, resume after delay; max 6 retries per part.

**Pseudo**

```ts
let delay = 500
for (let attempt = 1; attempt <= 6; attempt++) {
  try { await call() ; break }
  catch (e) {
    if (e.status !== 429 && e.status !== 503) throw e
    const ra = e.headers['retry-after']
    await sleep(ra ? Number(ra) * 1000 : (delay + Math.random()*delay))
    delay = Math.min(delay * 2, 30000)
  }
}
```

### 4.2 Server Patterns

* **Token bucket** for bursty reads (assistant_query).
* **Leaky bucket/fixed window** for steady actions (webhooks).
* **Semaphore** for concurrency (docify, embeddings): `maxConcurrent= N per org`.

---

## 5) Plans → Default Limits & Quotas

> Exact numbers are starting points; adjust by telemetry.

| Capability           |                  Unit |  Free |    Team | Business |
| -------------------- | --------------------: | ----: | ------: | -------: |
| Assistant queries    |      requests/day/org |   100 |   2,000 |   10,000 |
| Assistant tokens     | output tokens/day/org |   50k |      1M |       5M |
| Recordings uploaded  |         count/day/org |    10 |     200 |    1,000 |
| Video transcription  |     minutes/month/org |   120 |   1,200 |   10,000 |
| Docify generations   |          docs/day/org |    50 |     500 |    2,000 |
| Embeddings           |        chunks/day/org | 5,000 | 100,000 |  500,000 |
| Public shares active |             links/org |     5 |      50 |      500 |
| Webhooks outbound    |    deliveries/day/org | 2,000 |  50,000 |  250,000 |

**Overages**: configurable per plan. If enabled, switch 402 → 429 and continue while tracking billable units (see `usage-metering-spec.md`).

---

## 6) Endpoint‑Level Rate Limits (MVP)

> Window format: `X req / Y sec` unless noted. Limits enforced **per org** unless specified.

### 6.1 Recording & Upload

| Endpoint                        | Limit        | Scope  | Notes                                                |
| ------------------------------- | ------------ | ------ | ---------------------------------------------------- |
| `POST /api/recordings/init`     | 10 / 60s     | user   | Prevents spam session creation                       |
| `PUT signed-url (chunks)`       | 8 concurrent | client | Client‑side gate; server validates size & part count |
| `POST /api/recordings/finalize` | 5 / 60s      | org    | Idempotent on `sha256`; rejects mismatched size      |

### 6.2 Transcription & Docify

| Endpoint                 | Limit   | Scope | Notes                                      |
| ------------------------ | ------- | ----- | ------------------------------------------ |
| job `transcribe` enqueue | 30 / 5m | org   | Queue throttle; 503 if backlog > threshold |
| job `docify`             | 20 / 5m | org   | Concurrency cap = 2/org; spillover queued  |
| job `embed`              | 40 / 5m | org   | Batch chunks per job; backpressure via DB  |

### 6.3 Assistant & Search

| Endpoint                     | Limit    | Scope | Notes                                      |
| ---------------------------- | -------- | ----- | ------------------------------------------ |
| `POST /api/assistant/query`  | 10 / 10s | user  | Token bucket; adds `X-RateLimit-*` headers |
| `GET /api/search` (if added) | 20 / 10s | user  | Cache hot queries for 30s                  |

### 6.4 Admin & Settings

| Endpoint                 | Limit    | Scope | Notes                  |
| ------------------------ | -------- | ----- | ---------------------- |
| `POST /api/shares`       | 10 / 10m | org   | Prevents link spraying |
| `DELETE /api/shares/:id` | 30 / 10m | org   |                        |
| `POST /api/invites`      | 10 / 24h | org   | Email abuse control    |

### 6.5 Webhooks (Inbound)

| Endpoint                           | Limit    | Scope       | Notes                              |
| ---------------------------------- | -------- | ----------- | ---------------------------------- |
| `POST /api/webhooks/transcription` | 60 / 60s | provider ip | Verify HMAC; dedupe by provider id |
| `POST /api/webhooks/stripe`        | 60 / 60s | provider ip | Idempotency on event id            |

### 6.6 Webhooks (Outbound)

* Deliveries are **queued** with retry policy: 5s, 30s, 2m, 10m, 1h (max 5).
* Per destination URL: **5 / 10s** (spike arrest).
* Disable endpoint after ≥ 20 consecutive failures; notify org admin.

---

## 7) Implementation Details

### 7.1 Server Helper (`lib/rate-limit.ts`)

* Exposes `rateLimit({ key, limit, windowSec })` → `{ ok, remaining, resetAt }`
* Uses Upstash KV `INCR` with TTL for fixed window or **sliding window** using two buckets (current/prev) weighted by elapsed.

**Sliding window approach**

```
now = unix()
window = 10
bucket = floor(now / window)
key1 = rl:...:${bucket}
key2 = rl:...:${bucket-1}
count = get(key1) + get(key2) * (1 - (now % window)/window)
if count >= limit → 429
else INCR key1 (TTL=window*2)
```

### 7.2 Concurrency Guard (Semaphore)

* For docify/embeddings: `org:<id>:sem:<name>` tracks permits in KV with Lua/atomic ops.
* Fallback: in‑process queue with fairness per org to avoid starvation.

### 7.3 Quotas (`usage_counters`)

* Write‑heavy actions increment counters:

  * `minutes_transcribed` from provider duration
  * `tokens_in/out` from OpenAI response usage
  * `storage_gb` via object size deltas
  * `recordings_count`, `embeddings_chunks`
* Aggregation windows: **daily** and **monthly** per org.
* On every request, fetch cached snapshot (KV) → compare to plan → allow/deny.

---

## 8) Client Integration & UX

* On 429/402, show friendly message with countdown (using `X-RateLimit-Reset`).
* Recordings page should **queue** finalize attempts when limit exceeded.
* Assistant UI: disable send while `remaining === 0`; show tooltip with reset time.
* Admin Settings → Usage: visual meters of quotas; call‑to‑upgrade when > 80% used.

---

## 9) Testing & Validation

* Unit tests for sliding window math and header generation.
* Integration tests simulating bursts: 100 req/10s; verify ~10 pass, rest 429 with proper headers.
* Smoke tests for quotas: set tiny plan in staging; ensure 402 after crossing cap.
* Chaos test: disable KV; ensure endpoints fail safe (503 with `Retry-After`).

---

## 10) Observability & Alerts

* **Metrics**: 429 rate per endpoint; average `Retry-After`; semaphore queue length; quota denials; vendor 5xx.
* **Dashboards**: per‑endpoint charts; top offending orgs/users; cost overlay (tokens/minutes).
* **Alerts**: if 429 > 5% for 5m on assistant, investigate model latency; if quota denials spike, review pricing/limits.

---

## 11) Runbook Snippets

* **Throttling false positives**: temporarily raise limits for an org via `organizations.settings.rateOverrides`.
* **Hot org shaping**: lower `assistant_query` per‑user limit but raise per‑org quota to encourage sharing.
* **Emergency kill switch**: set `FEATURE_ASSISTANT=false` at env; return 503 with banner.

---

## 12) Examples

### 12.1 Successful assistant call

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1730822405
X-Org-Quota-Remaining: 1487
X-Request-Id: req_abc123
```

### 12.2 Rate limited

```
HTTP/1.1 429 Too Many Requests
Retry-After: 9
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730822410
Content-Type: application/json

{ "code": "RATE_LIMITED", "message": "Too many requests. Try again later.", "retryAfterSec": 9, "requestId": "req_abc123" }
```

### 12.3 Quota exhausted (no overage)

```
HTTP/1.1 402 Payment Required
Content-Type: application/json

{ "code": "PLAN_LIMIT_EXCEEDED", "message": "You've reached your monthly transcription minutes. Upgrade to continue.", "requestId": "req_xyz789" }
```

---

## 13) Open Questions / Future

* Hybrid per‑endpoint cost‑aware limits (budget tokens per minute).
* Per‑region shaping if we add multi‑region.
* Org‑level credit system to buffer occasional spikes.
* Adaptive limits based on historical good behavior.
