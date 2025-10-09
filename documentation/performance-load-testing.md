# Performance & Load Testing

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** End‑to‑end performance objectives (SLIs/SLOs), perf budgets (client + server + pipeline), test plans using **k6** (HTTP) and **Locust** (workflows), data sets, dashboards, profiling, regression gates, and capacity planning.

This document defines how we **measure, test, and enforce** performance. It is prescriptive and tied to release gates in CI/CD.

---

## 1) SLIs & SLOs

### 1.1 User‑facing SLIs

| Flow                      | SLI                              | Target (SLO)         | Notes                                 |
| ------------------------- | -------------------------------- | -------------------- | ------------------------------------- |
| App shell render          | **TTFB**                         | P95 ≤ 500 ms         | server render of authenticated pages  |
| Dashboard first content   | **FCP**                          | P95 ≤ 1.3 s          | with warm cache                       |
| Assistant first token     | **Time‑to‑First‑Token**          | P50 ≤ 3 s, P95 ≤ 8 s | includes retrieval + LLM stream start |
| Upload resilience         | **Successful chunk upload rate** | ≥ 99.5%              | across 10MB parts                     |
| 30‑min recording pipeline | **Transcribe→Docify ready**      | P95 ≤ 10 min         | staging≈prod providers                |
| Search                    | **Top‑K latency**                | P95 ≤ 300 ms         | pgvector query only                   |
| Player                    | **Start to first frame**         | P95 ≤ 1.0 s          | processed WebM playback               |

### 1.2 System SLIs

| Layer  | Metric                          | Target                                                             |
| ------ | ------------------------------- | ------------------------------------------------------------------ |
| API    | p95 latency per route           | ≤ 350 ms for standard CRUD; ≤ 900 ms for `assistant/query` pre‑LLM |
| Worker | Job age (p95)                   | ≤ 2 min for `transcribe`; ≤ 1 min for `embed`                      |
| DB     | Buffer cache hit ratio          | ≥ 95%                                                              |
| Vector | ANN recall vs brute‑force @k=20 | ≥ 0.96                                                             |
| Queue  | Dead‑letter rate                | = 0 under normal load                                              |

**Error budget**: 28,800 seconds/month (≈ 8 hours) for SLO breaches across all critical SLIs. Exceeding consumes error budget and triggers a feature freeze.

---

## 2) Performance Budgets (Guardrails)

* **Client**: route JS ≤ 180 KB gz; *initial* CSS ≤ 40 KB; images lazy‑loaded; font display swap.
* **Server**: API CPU ≤ 50 ms p50 per request; memory steady ≤ 300 MB per instance.
* **DB**: single query ≤ 150 ms p95; avoid sequential scans on hot paths.
* **Vector**: top‑k=6, dim=1536; HNSW ef_search tuned for ≤ 50 ms p95.
* **LLM**: prompt ≤ 3k tokens; max output tokens default 512.

Budgets are enforced via CI scripts (bundle size) and k6 thresholds (latency).

---

## 3) Test Environments & Data

* **Staging** mirrors prod services (Vercel, Supabase, providers with test keys).
* **Synthetic data**:

  * 100 orgs × 20 users × 200 recordings (mixed durations),
  * transcripts avg 10k tokens,
  * 50k vector chunks per org.
* **Data loader**: `scripts/seed-perf.ts --orgs 100 --users 20 --recordings 200` (idempotent).
* **Feature flags**: enable `FEATURE_PII_REDACTION` for worst‑case token usage runs.

---

## 4) k6 Plans (HTTP‑level)

### 4.1 Assistant Query Soak & Spike

**Goal**: verify latency & 429 rate under bursty Q/A traffic.

**Profile**

* Warm‑up 2 min @ 10 VUs
* Ramp 0→500 VUs over 5 min
* Spike 1,000 VUs for 60 s
* Soak 200 VUs for 20 min

**Thresholds**

* `http_req_duration{route:/api/assistant/query}` p95 < 900 ms (pre‑LLM)
* `checks` > 99%
* `http_req_failed` < 1%
* `rate_limited` < 5% (expect some 429s by design)

**Script (excerpt)**

```js
// tests/k6/assistant-query.js
import http from 'k6/http'
import { sleep, check } from 'k6'
export const options = {
  scenarios: {
    traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '20m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '120s',
    },
  },
  thresholds: {
    'http_req_duration{route:/api/assistant/query}': ['p(95)<900'],
    'http_req_failed': ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const payload = JSON.stringify({ query: 'How do I reset the DB connection?', scope: {} })
  const res = http.post(`${__ENV.BASE_URL}/api/assistant/query`, payload, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.TEST_TOKEN}` },
    tags: { route: '/api/assistant/query' },
  })
  const ok = check(res, {
    'status 200/429': r => [200, 429].includes(r.status),
    'has request id': r => !!r.headers['x-request-id'],
  })
  sleep(1)
}
```

### 4.2 Upload Throughput & Error Handling

**Goal**: ensure 99.5% successful part uploads; verify resume on 429/503.

**Approach**: use k6 to PUT chunks to signed URLs; inject artificial 429/503 from a test bucket path that simulates throttling.

**Thresholds**

* `successful_parts/total_parts` ≥ 0.995
* mean throughput ≥ 5 Mbps per client (lab)

---

## 5) Locust Plans (Workflow‑level)

### 5.1 Record→Finalize→Transcribe→Docify→Embed

**Goal**: E2E pipeline latency & stability under concurrent creators.

**Workload**

* 300 concurrent creators start sessions, each uploads a 5‑min sample (pre‑cut).
* 20% users trigger **Regenerate Docify** once.
* 10% users delete a recording.

**KPIs**

* P95 **Finalize→Transcript Ready** ≤ 6 min
* P95 **Transcript Ready→Doc Ready** ≤ 2 min
* `job_fail_rate` < 0.5%

**Locustfile (excerpt)**

```py
# tests/locust/pipeline.py
from locust import HttpUser, task, between
import json, random

class Creator(HttpUser):
    wait_time = between(1, 5)

    @task(2)
    def upload_and_finalize(self):
        init = self.client.post('/api/recordings/init', json={"size": 200_000_000})
        rid = init.json().get('recordingId')
        # (simulate 20 chunks)
        for i in range(20):
            self.client.put(f"/upload/signed/{rid}/{i}", data=b'x'*10_000_000)
        self.client.post('/api/recordings/finalize', json={"path": f"org/x/{rid}.webm", "size": 200_000_000, "sha256": "..."})

    @task(1)
    def ask_assistant(self):
        self.client.post('/api/assistant/query', json={"query": "summarize onboarding"})
```

---

## 6) Dashboards & What to Watch

### 6.1 API & App (Sentry / Vercel / Grafana)

* **Latency** (p50/p95) per route;
* **Error rate**;
* **429 rate**;
* **TTFB/FCP/LCP** via Real User Monitoring (RUM) if enabled.

### 6.2 Worker/Queues

* Job **queue depth** and **age** per type;
* Success/fail counts;
* Provider latency histograms (transcription/LLM/embeddings).

### 6.3 Database (Supabase)

* Top slow queries;
* Cache hit ratio;
* Connections;
* Lock waits;
* pgvector index stats.

### 6.4 Cost Overlay

* Tokens/min;
* Transcription minutes/min;
* Storage egress;
* Alerts if slope exceeds plan.

---

## 7) Profiling & Optimization Playbook

* **Hot endpoint** → capture flamegraph (Node — `clinic flame` or Vercel profiler).
* **N+1** → add prefetch/joins or materialized views.
* **Vector latency** → tune HNSW `ef_search`; add re‑ranker cache.
* **LLM TTFB** → reduce context, compress snippets, switch to faster model tier.
* **Upload stalls** → lower part size, increase retries with jitter.

---

## 8) Regression Gates in CI

* k6 smoke on PR label `perf` with thresholds for `/assistant/query` and `/recordings/finalize`.
* Build fails if thresholds violated.
* Bundle guardrail script fails when over budget.

---

## 9) Failure Injection

* **429 storm** from KV: lower limits temporarily in staging to validate backoff UX.
* **Provider 5xx**: mock 20% error rate for transcription/LLM; ensure retries/backoff.
* **DB failover** (if supported): simulate connection churn; verify exponential reconnect.

---

## 10) Capacity Planning (Back‑of‑Envelope)

* If average org performs **1,000 assistant queries/day**:

  * QPS avg ≈ 0.012, peak (10×) ≈ 0.12 QPS/org.
  * For 1,000 o
