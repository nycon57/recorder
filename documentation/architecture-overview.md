# Architecture Overview

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative); keep in sync with ADRs and API specs
> **Scope:** Browser-based capture → storage → transcription → doc generation ("docify") → embeddings → RAG assistant → sharing, plus auth/billing/observability. Excludes native desktop apps and on‑prem.

---

## 1) Purpose & Principles

### 1.1 Why this doc exists

Provide a production-grade blueprint of the platform architecture: components, boundaries, data flows, trust zones, SLIs/SLOs, failure modes, and cost/performance targets. This is the **single source of truth** used by engineers, agents, and reviewers.

### 1.2 Architectural principles

* **Zero-install capture**: frictionless screen + mic + cam recording in browser.
* **Deterministic async pipeline**: at-least-once processing; idempotent jobs and webhooks.
* **Tenant isolation**: org-scoped storage, DB rows, vectors, and caches.
* **RAG with citations**: grounded answers with explicit source snippets.
* **Observability-first**: traces, metrics, and structured logs on every boundary.
* **Backpressure-aware**: queues, rate limits, and circuit breakers protect cost & UX.
* **Minimal secrets**: short-lived tokens; HMAC/webhook signatures; least privilege.
* **Progressive enhancement**: start with pgvector; Pinecone optional for scale.

---

## 2) Goals & Non-Goals

### 2.1 Goals

* Browser-based capture of **screen/tab/window + webcam + microphone** with resumable uploads.
* Async pipeline: **transcription → docify → chunk/embed → index** with evented status.
* Multi-tenant RBAC with **Clerk**; org isolation in **Postgres + pgvector** and **Supabase Storage**.
* **LLM-backed** doc generation and chat assistant using **OpenAI** (provider-abstraction ready).
* Billing via **Stripe** with usage metering; notifications via **Resend**.
* Production observability (errors, latency, job depth, costs).

### 2.2 Non-goals (MVP)

* Native desktop/system-audio capture on macOS; on‑prem; SCIM; regional data residency; e2e encryption of videos; per-field DLP.

---

## 3) Personas & Top Journeys

* **SME (expert)**: record → auto-process → review/edit → publish.
* **Learner**: search/ask → view cited answers → open source docs/recordings.
* **Org admin**: invite/manage users/roles; view usage; manage billing & sharing policy.

**Core flows**:

1. **Record → Upload → Process → Publish**
2. **Ask → Retrieve (RAG) → Answer with citations**
3. **Admin → Invite → Monitor usage → Upgrade**

---

## 4) System Context (ASCII)

```
[Browser (Recorder UI)]
  └─ Screen|Tab|Window + Cam + Mic → MediaStreams → Canvas compose (PiP)
  └─ MediaRecorder → Chunk(≈10MB) → Resumable Upload (signed URL)
        │
        ▼
[Supabase Storage (Buckets)]  ⇄  [Vercel Edge/CDN]  ⇄  [Viewers]
        │
        └─ finalize (API) ──► verify object + create DB rows
        ▼
[Next.js API (Vercel)] ──(service role)──► [Postgres (Supabase + pgvector)]
        │                                    │
        │                                    └─ Outbox/Jobs → [Worker (Node)]
        │                                                       │
        ├──► Transcription Provider (Whisper/AssemblyAI) ◄─ webhook (HMAC)
        ├──► LLM Provider (OpenAI: docify/chat, embeddings)
        └──► Stripe (billing) / Clerk (auth/orgs) / Resend (email)
```

---

## 5) Runtime Topology & Environments

* **Production**: Next.js on Vercel (Serverless/Edge); Supabase (Postgres+Storage); Upstash Redis (rate limits, optional); external AI vendors.
* **Staging**: mirrors prod; test tenants; relaxed quotas; non-prod keys.
* **Local**: Next dev; optional Supabase local or staging; vendor mocks.

**Regions**: pick primary region close to majority of customers; all state colocated (DB/Storage) to reduce egress and latency.

---

## 6) Components & Boundaries

### 6.1 Web App (Next.js, App Router)

* **Responsibilities**: Recorder UI, playback, transcript/doc editors, assistant chat, admin/billing.
* **Boundaries**: No direct DB access from client; all mutations via API route handlers or Server Actions.
* **Client vs Server**: Client components only for browser APIs (MediaRecorder, canvas); RSC elsewhere.

### 6.2 API Route Handlers (Next.js `/app/api/*`)

* **Responsibilities**: AuthZ, input validation (zod), signed URL issuance, finalize recording, enqueue jobs, serve signed playback links, webhooks verification, assistant queries.
* **Boundaries**: Stateless; side-effects via DB/queues; idempotency enforced via keys and unique constraints.

### 6.3 Background Worker (Node process or serverless cron)

* **Responsibilities**: Claim jobs; call transcription; run docify; chunk+embed; rebuild indexes; send notifications; usage aggregation.
* **Boundaries**: No public HTTP; pulls from DB `jobs`; writes through DB/Storage; respects rate limits.

### 6.4 Postgres + pgvector (Supabase)

* **Responsibilities**: Authoritative store for org/users/recordings/transcripts/docs/embeddings/chats/usage/billing state.
* **Boundaries**: RLS for tenant isolation (phase 2); strict FKs; migrations controlled via playbook.

### 6.5 Supabase Storage

* **Responsibilities**: Large binaries (raw & processed video, thumbnails, exports). Signed, time-bound URLs. Lifecycle rules.
* **Partitioning**: `org_{org_id}/recordings/{recording_id}/...`

### 6.6 Vendors

* **Clerk**: auth + organizations, session JWTs, role claims.
* **Stripe**: subscription management, usage-based add-ons; webhook → plan state.
* **Resend**: transactional emails.
* **OpenAI**: chat/docify + embeddings; provider abstraction & feature flags.
* **Transcription**: Whisper/AssemblyAI; async webhook with HMAC.

---

## 7) Trust Zones & Data Classification

* **TZ1 – Client** (untrusted): Media streams, user inputs. Enforce file size/type limits, sanitize metadata; never trust `org_id` from client.
* **TZ2 – API** (trusted service): Derives `org_id` from Clerk session/org; enforces RBAC and quotas.
* **TZ3 – DB/Storage** (sensitive): RLS policies gate rows by `org_id`; bucket paths namespaced per org; signed URLs.
* **TZ4 – Vendors** (external): HMAC-signed webhooks; data minimization (send only necessary audio/text, no PII beyond need).

**Data classes**:

* **Public** (marketing pages), **Internal** (usage counters), **Customer-Confidential** (recordings, transcripts, docs), **Secrets** (API keys).

---

## 8) Domain Model (Primary Tables)

* `organizations(id, name, plan, settings_jsonb, created_at)`
* `users(id, email, name, created_at)` (mirrors Clerk via webhook)
* `user_organizations(user_id, org_id, role, created_at)`
* `recordings(id, org_id, title, status, duration_sec, storage_path_raw, storage_path_processed, created_by, created_at)`
* `transcripts(id, recording_id, language, text, words_json, status, created_at)`
* `documents(id, recording_id, org_id, markdown, html, version, status, created_at)`
* `transcript_chunks(id, recording_id, org_id, chunk_text, embedding vector(1536), meta_jsonb, model, created_at)`
* `jobs(id, type, payload_jsonb, status, run_at, attempts, dedupe_key, created_at)`
* `events(id, type, payload_jsonb, created_at)` (outbox)
* `notifications(id, user_id, type, payload_jsonb, read_at, created_at)`
* `shares(id, org_id, target_type, target_id, share_id, password_hash, expires_at, revoked_at, created_at)`
* `usage_counters(org_id, period, minutes_transcribed, tokens_in, tokens_out, storage_gb, recordings_count, updated_at)`

**Indexing**:

* `recordings(org_id, created_at)`;
* `transcript_chunks(org_id, recording_id)` + vector index (HNSW/IVFFLAT);
* unique `jobs(dedupe_key)`;
* `shares(share_id)`;
* partial indexes for `status` hot paths.

---

## 9) Critical Flows (Expected Behavior + Rationale)

### 9.1 Record → Upload → Finalize

**Feature**: Browser records screen+mic+cam (optional).
**Rationale**: Capture tacit knowledge with minimal friction.
**Expected**:

1. User clicks **New Recording**. Browser prompts for screen + mic + cam permissions.
2. Client composes PiP via canvas (if webcam enabled) and records via **MediaRecorder** (WebM, VP8/VP9 + Opus).
3. Client uploads chunks (≈10MB) to **signed URLs** (Supabase Storage).
4. Client calls **`POST /api/recordings/finalize`** with hash/size → API verifies object exists, creates `recordings` row, enqueues `transcribe` job.
5. UI transitions to **Processing** state; background continues.

**Notes**: resumable uploads must survive tab reloads (upload session id) and weak networks (retry with backoff; checksum per part).

### 9.2 Transcription

**Feature**: Auto speech-to-text with timestamps.
**Rationale**: Foundation for search, docify, and accessibility.
**Expected**:

1. Worker claims `transcribe` job; requests provider with storage URL & webhook callback.
2. Provider POSTs webhook → `/api/webhooks/transcription` with HMAC signature + job id.
3. API verifies signature + idempotency; writes `transcripts` (text + `words_json`), updates `recordings.status = 'transcribed'`; emits `events.transcript_ready` and enqueues `docify`.

### 9.3 Docify (Document Generation)

**Feature**: LLM converts transcript to well-structured Markdown/HTML.
**Rationale**: Turn raw speech into readable documentation, dramatically reducing authoring time.
**Expected**:

1. Worker runs prompt template with transcript (optionally bounded by tokens).
2. Save **AI v1** as `documents` with `version = 'ai:1'`.
3. Emit `document_ready`; enqueue `embed`.

### 9.4 Chunk + Embeddings + Index

**Feature**: Chunk doc (300–500 tokens; 10–20% overlap), embed to 1536‑d vectors, store in `pgvector`.
**Rationale**: Enable semantic retrieval for chat and search.
**Expected**:

1. Chunker respects headings and punctuation; keeps code blocks intact.
2. Compute embeddings; insert rows with `org_id`, `recording_id`, `start_ts`, `section` metadata.
3. Create/refresh HNSW/IVF index; store `model` version for future re-embeds.

### 9.5 Assistant (RAG)

**Feature**: Org-scoped Q&A with citations.
**Rationale**: Unlock knowledge for the team without replaying videos.
**Expected**:

1. `/api/assistant/query`: embed query; vector search (filter `org_id`, optional `recording_id/tags`).
2. Build prompt with **top‑k** passages; stream completion (SSE) with **citations**.
3. Log usage counters (tokens, latency) and store chat (optional, org policy).
4. If retrieval confidence low, answer states unknown and links to sources.

### 9.6 Publishing / Sharing

**Feature**: Optional link-based sharing of docs/recordings.
**Rationale**: Facilitate collaboration and external knowledge transfer.
**Expected**: `shares` entry creates `/pub/d/{share_id}`; supports password & expiry; revokable; no indexing by bots; rate-limited.

---

## 10) API Surfaces (Selected)

* `POST /api/recordings/init` → {signedUrls[], uploadId, recording_id}
* `POST /api/recordings/finalize` → verifies object, creates DB row, enqueues transcribe
* `GET /api/recordings/:id` → metadata + signed playback URL(s)
* `POST /api/webhooks/transcription` → HMAC + idempotent upsert
* `POST /api/docify/:recording_id` → (re)generate doc; optional template param
* `POST /api/embeddings/rebuild/:recording_id`
* `POST /api/assistant/query` → {answer, citations[]}
* `POST /api/billing/stripe-webhook`

**Contracts**: zod-validated; error shape `{code, message, details?, requestId}`; include `x-request-id` header.

---

## 11) Jobs, Idempotency & Outbox

### 11.1 Jobs Table

* States: `queued | running | succeeded | failed | dead`.
* Worker claims with `FOR UPDATE SKIP LOCKED`; visibility timeout; `run_at` for schedule/delay.
* Retry policy: exponential backoff (e.g., 3s, 15s, 60s, 5m, 30m) with max attempts per type.

### 11.2 Idempotency

* Unique `dedupe_key` per job (e.g., `transcribe:${recording_id}:${provider}`).
* Webhooks require `Idempotency-Key` or provider job id; use `INSERT ... ON CONFLICT DO NOTHING`/upserts with version guards.
* All side-effects (rows written, state changes) must be safe to replay.

### 11.3 Outbox Pattern

* DB trigger appends to `events` on critical writes.
* Worker drains outbox to deliver internal notifications/webhooks, ensuring no dual-write races.

---

## 12) Tenancy, RBAC & Storage Namespacing

* **JWT (Clerk)** carries `sub` (user), active `org_id`, and `role` (owner|admin|contributor|reader).
* **API** derives effective org from session; never trusts body parameters.
* **DB** (phase 2): RLS enforces `org_id` checks per table; service role only on server.
* **Storage**: prefix every object path with `org_{org_id}`; signed URLs are minimal-scope, short TTL.
* **Vector**: store `org_id` per row; future: Pinecone namespace per org for large tenants.

---

## 13) Security Controls & Threats (STRIDE summary)

* **Spoofing**: session hijack → Clerk session rotation, MFA opt-in, short JWT lifetime.
* **Tampering**: upload checksums, size caps, signed URLs; DB input validation; CSP.
* **Repudiation**: audit logs on admin actions; immutable events trail.
* **Information Disclosure**: org isolation, PII redaction pre-embedding, least-privileged keys.
* **DoS**: Upstash/edge rate limits; concurrency caps; job queue backpressure.
* **Elevation**: server-side RBAC checks; no client-authoritative roles; webhook signature verification.

**Headers/Policies**: HSTS, CSP (no `unsafe-inline`), SameSite=Lax cookies, strict CORS (app domain), CSRF for form posts.

---

## 14) Observability & Diagnostics

* **Correlation**: generate `x-request-id`; propagate to downstream; include in logs/metrics.
* **Logs**: structured JSON (level, ts, org_id, user_id, request_id, route, outcome, latency_ms).
* **Metrics**: request rate, p50/p95 latency, error %, queue depth, job age, provider latencies, token usage, storage egress.
* **Traces**: spans for upload, finalize, webhook handle, docify, embedding, assistant completion.
* **Dashboards**: per-env; alert thresholds (see `observability-and-alerting.md`).

---

## 15) Performance Targets (SLIs/SLOs)

* **Assistant first token**: P50 ≤ 3s; P95 ≤ 8s.
* **Pipeline for 30‑min video**: transcript+docify ready P95 ≤ 10 min.
* **Upload success rate**: ≥ 99.5% with resumable parts.
* **Docify correctness**: subjective, backed by RAG eval (see `rag-evaluation-and-benchmarks.md`).

**Perf budgets**: page TTFB ≤ 200ms (cached); chunk upload concurrency ≤ 4 by default.

---

## 16) Cost Model & Guardrails

* **Transcription**: $0.36–$0.60/hr (provider).
* **LLM docify**: $0.02–$0.10 per doc; **Embeddings**: ~$0.02 per 1K chunks.
* **Storage**: ~$0.02/GB‑mo (+ egress).
* **Guardrails**: per‑org daily caps, model routing (cheaper defaults), batch embeds, caching, proactive alerts on spikes.

---

## 17) Failure Modes & Mitigations

| Area            | Failure                   | Impact             | Mitigation                                                      |
| --------------- | ------------------------- | ------------------ | --------------------------------------------------------------- |
| Upload          | tab closed / network drop | partial objects    | resumable parts; server verifies size+hash; resume by upload id |
| Webhooks        | replay / dup              | double processing  | HMAC + nonce; idempotency keys; upserts                         |
| Provider outage | 5xx spikes                | backlog and delays | retries with backoff; circuit breaker; fallback provider        |
| DB hot rows     | contention                | latency            | partial indexes; avoid serializable tx; paginate                |
| Vector drift    | model changes             | irrelevance        | store model id; lazy re-embed; eval gates                       |
| Cost spike      | abusive usage             | bill shock         | quotas, rate limits, overage prompts                            |

---

## 18) Upload Protocol Details

* **Container**: WebM (VP8/VP9 + Opus).
* **Chunking**: 10MB parts; each with SHA‑256; final hash for whole object.
* **Resume tokens**: upload session id stored in localStorage.
* **Network**: exponential backoff; max concurrency 4; pause/resume.
* **Finalize contract**: `{recording_id, storage_path, size_bytes, sha256}`.

---

## 19) Data Lifecycle & Retention (High Level)

* **Raw video**: hot 30 days → infrequent access tier; default TTL 24 months (archived after 6).
* **Transcripts/docs**: retained until deletion; org admin purge option.
* **Embeddings**: deleted with source; re-generated on major edits.
* **Shares**: expire by policy; audit of accesses (count + last_at).
* See `data-retention-and-deletion.md` for exact TTLs and legal holds.

---

## 20) Privacy & PII Redaction (High Level)

* Detect PII via regex + optional ML; redact before embedding.
* Store original transcript; embed redacted variant; mark redaction rules applied.
* Org setting to opt-out of embedding specific recordings.
* See `privacy-and-pii-redaction.md` for categories and audit trail.

---

## 21) Configuration & Feature Flags

* `FEATURE_PUBLIC_SHARE`, `FEATURE_PII_REDACTION`, `FEATURE_PINECONE`, `FEATURE_RLS`.
* Per‑org overrides via `organizations.settings` JSONB.
* Kill-switch flags for providers (e.g., `provider.transcription=disabled`).

---

## 22) Deployment & Release Model

* Vercel previews per PR; protected main branch; migrations gate release (see `ci-cd.md` + `migration-playbook.md`).
* Rollback: instant to previous deployment; DB rollback via down migrations (carefully, prefer roll-forward).

---

## 23) Sequence Diagrams (ASCII)

### 23.1 Finalize → Transcribe

```
Client → API: POST /api/recordings/finalize {path, size, sha}
API → Storage: HEAD /bucket/path
API → DB: INSERT recordings(status='uploaded')
API → DB: INSERT jobs(type='transcribe', dedupe_key)
API → Client: 202 Accepted
Worker → DB: claim job
Worker → Transcriber: POST /transcribe {media_url, callback}
Transcriber → API: POST /api/webhooks/transcription {recording_id, text, words}
API → DB: UPSERT transcripts; UPDATE recordings.status='transcribed'; INSERT events
API → Worker: enqueue docify + embed
```

### 23.2 Assistant (RAG)

```
Client → API: POST /api/assistant/query {q, scope?}
API → Embeddings: embed(q)
API → DB: SELECT topK FROM transcript_chunks WHERE org_id=$org [AND scope]
API → LLM: prompt(context=chunks, q)
LLM → API: stream tokens
API → Client: SSE stream with citations
```

---

## 24) Compatibility & Formats

* **Video**: WebM (playback HLS optional later).
* **Transcript**: plain text + word-level timestamps JSON.
* **Document**: Markdown + rendered HTML.
* **Exports**: Markdown/PDF (server-rendered), JSON (for APIs).

---

## 25) External Dependencies

* Clerk, Stripe, Resend, OpenAI, Transcription provider, Upstash Redis, Supabase (Postgres/Storage), Vercel.
* Each must have **status page** link and operational SLO; define degradation modes.

---

## 26) Open Questions & Future Work

* System audio capture feasibility on major browsers.
* Per-tenant regional storage for data residency.
* SCIM user provisioning; SAML SSO (via Clerk) for Enterprise.
* Re-ranker (e.g., bge-reranker) in RAG for higher precision.
* Real-time captions during recording (on-device vs server).
* Pinecone adoption for organizations > N docs (namespace per org + hybrid search).

---

## 27) References

* `repository-structure.md`, `coding-standards.md`, `ci-cd.md`, `migration-playbook.md`
* `rbac-and-rls-policies.md`, `security-model-and-threats.md`
* `rag-evaluation-and-benchmarks.md`, `chunking-and-embedding-guidelines.md`
* `observability-and-alerting.md`, `data-retention-and-deletion.md`
