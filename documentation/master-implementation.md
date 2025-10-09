# Master Implementation Plan

Version: 1.0  
Date: October 07, 2025

This document is the step by step build plan for the entire SaaS. It aggregates and sequences the work across architecture, repo setup, coding standards, database, backend, frontend, pipelines, operational limits, and marketing. Source documents are embedded at the end for reference.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Quick Start Checklist](#quick-start-checklist)
- [Phase 0. Planning, Requirements, and Architecture](#phase-0-planning,-requirements,-and-architecture)
- [Phase 1. Local Environment and Repo Setup](#phase-1-local-environment-and-repo-setup)
- [Phase 2. Database and Backend Services](#phase-2-database-and-backend-services)
- [Phase 3. Frontend App and Site Map](#phase-3-frontend-app-and-site-map)
- [Phase 4. Core Features and Integrations](#phase-4-core-features-and-integrations)
- [Phase 5. Implementation Pipelines and DevOps](#phase-5-implementation-pipelines-and-devops)
- [Phase 6. Quality, Security, and Limits](#phase-6-quality,-security,-and-limits)
- [Phase 7. Launch, Marketing, and Brand Readiness](#phase-7-launch,-marketing,-and-brand-readiness)
- [Appendix A. Source Docs (Embedded)](#appendix-a-source-docs-(embedded))

---

## Executive Summary

This plan provides an end-to-end implementation path that engineering and contributors can follow from a clean machine to production launch. It aligns the tech stack, repository structure, coding standards, database schema, product features, site map, CI/CD pipelines, rate limits, and marketing deliverables into a single checklist-driven guide. Use this as the source of truth during build-out.

Key references used in this plan include:
- Architecture Overview
- Tech Stack
- Repository Structure
- Coding Standards
- Database Schema
- Product Features
- Site Map
- Implementation Pipelines
- Rate Limits and Quotas
- Marketing and Brand

---

## Quick Start Checklist

1. Confirm architecture and stack selections are locked.  
2. Initialize repo and install required tooling.  
3. Stand up local dev environment with environment variables and secrets.  
4. Provision database from schema and run migrations.  
5. Scaffold backend services and API boundaries.  
6. Scaffold frontend app from Site Map routes.  
7. Wire feature modules end to end with analytics events.  
8. Enable CI for linting, type checks, tests, and preview deployments.  
9. Configure rate limits, auth, and observability.  
10. Prepare marketing assets and launch plan.  


## Master Build Checklist (Production‑Ready, End‑to‑End)

> Use this as the single source of truth for building **from a clean machine to a live, production SaaS**.  
> Convention for annotations: **Owner:** `___`  **Due:** `____`  **Notes:** `____`  **Link to PR/Doc:** `____`

### Phase 0 — Planning, Requirements, and Architecture
- [ ] Confirm **MVP scope** and Phase 2 roadmap documented and approved. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Write **Problem, Goals, Non‑Goals** doc and circulate for sign‑off. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Finalize **system architecture** (context + component + sequence diagrams). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Select **IdP/Auth** (e.g., Kinde/Supabase Auth/Clerk) and **RBAC model**; capture ADR. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Define **data classification** & PII handling (storage, access, retention). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Select **observability stack** (logs, traces, metrics, alerts) and SLOs. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] List **external integrations** (APIs, webhooks, keys), quotas, and credentials plan. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Approve **success metrics** (activation, DAU/WAU, conversion, latency SLOs, error budget). *(Owner: ___  Due: ___  Notes: ___)*

### Phase 1 — Local Environment and Repo Setup
- [ ] Install runtimes (e.g., **Node LTS 20+**, **pnpm**/**bun**, **Docker**). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Initialize **repo** (monorepo/polyrepo) per Repository Structure. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Add **editorconfig**, **prettier**, **eslint**, **tsconfig**, **commitlint** + **husky** pre‑commit. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Create **.env.example** and **secret management** plan (1Password/Vault/Vercel envs). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Set up **CI** (GitHub Actions) for lint, type‑check, unit tests on PR. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Add **CODEOWNERS**, PR template, issue templates, labels, and branching strategy. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Scaffold **app shell** (e.g., Next.js App Router) with Tailwind/design tokens. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Create **ADR directory** and record initial decisions. *(Owner: ___  Due: ___  Notes: ___)*

### Phase 2 — Database and Backend Services
- [ ] Provision **database** (e.g., Supabase/Postgres) and create environments (**dev/stage/prod**). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Apply **baseline schema migrations**; verify idempotency. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Implement **RLS/RBAC** policies and row‑level tests. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Seed **reference data** and create **factory seeds** for local/CI. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Build **data access layer** (e.g., drizzle/prisma/sqlc) with query performance budget. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Define **API contracts** (REST/GraphQL/trpc) per feature domain; generate types. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Add **health checks** (`/healthz`, `/readyz`), structured logging, and request IDs. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Implement **rate‑limiting** boundaries (per‑IP, per‑user, per‑org) and quotas. *(Owner: ___  Due: ___  Notes: ___)*

### Phase 3 — Frontend App and Site Map
- [ ] Generate **routes/pages** from Site Map; add 404/500 and loading states. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Implement **global layout**, navigation, and responsive breakpoints. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Build **UI component library** (buttons, forms, tables, modals, toasts). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Integrate **auth flows** (sign‑up/in/out, forgot password, magic links, SSO). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Add **state management** (server components/hooks/query caching) and error boundaries. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Wire **analytics** (e.g., PostHog/GA4) + consent + event schema. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Add **feature flags**/experiments and remote config (e.g., GrowthBook/LaunchDarkly). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Implement **accessibility pass** (keyboard nav, aria, contrast CI check). *(Owner: ___  Due: ___  Notes: ___)*

### Phase 4 — Core Features and Integrations (repeat per feature)
- [ ] Define **user stories + acceptance criteria** for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Backend: endpoints, validations, happy/sad path tests for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Frontend: screens, forms, empty/error states for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Integrations: keys, webhooks, retries/backoff, idempotency for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Telemetry: events, metrics, logs, traces for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Docs: **runbook + how‑to** for Feature `X`. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **UAT** sign‑off for Feature `X` (checklist captured). *(Owner: ___  Due: ___  Notes: ___)*

### Phase 5 — Implementation Pipelines and DevOps
- [ ] CI: unit/integration/e2e **test matrix** across OS/runtime; artifact caching. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Build & publish **containers**/artifacts; SBOM + provenance (SLSA‑level target). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Preview deployments** on PRs; ephemeral DBs/seed data. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Staging** pipeline with manual approvals & database migrations. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Production** deploy with canary/blue‑green and automated rollback. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Secrets management** for CI runners; least privilege. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Backups** scheduled + **restore drill** documented and executed. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Infra as Code** (e.g., Terraform/Pulumi) for all cloud resources. *(Owner: ___  Due: ___  Notes: ___)*

### Phase 6 — Quality, Security, and Limits
- [ ] Expand **test coverage** thresholds; flaky‑test quarantine; smoke tests post‑deploy. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **SAST/DAST/Dependency** scanning; secret scanning; container scans. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Update **threat model** (STRIDE) and mitigations; run **tabletop IR** exercise. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Validate **rate‑limits** & error codes; DOS/abuse simulations. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Observability**: golden signals dashboards; **SLOs & alerts** tuned; on‑call runbook. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Privacy & compliance** checks: DPA, ToS, Privacy Policy, cookie consent, data requests flow. *(Owner: ___  Due: ___  Notes: ___)*

### Phase 7 — Launch, Marketing, and Brand Readiness
- [ ] Lock **brand kit** (logo, color, typography, components). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] Website **copy & pricing** finalized; **SEO** (sitemap, meta, OG) verified. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Onboarding** flows + emails/sequences + in‑app tours. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Billing** (plans, trials, coupons, taxes) and **dunning** flows tested. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Support** setup (help center, intercom/zendesk, status page, SLA). *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Security page** w/ posture summary and contact; **changelog** published. *(Owner: ___  Due: ___  Notes: ___)*
- [ ] **Go/No‑Go** checklist completed; rollback plan ready; owners on‑call for T‑0. *(Owner: ___  Due: ___  Notes: ___)*

---

### Per‑Task Notes Template (copy as needed)
```
Task: ____________________________________________
Owner: __________________  Due: ________________
Context/Links:
- Spec/Issue: ___________________________________
- PR: ___________________________________________

Validation:
- [ ] Unit tests updated
- [ ] Integration tests updated
- [ ] e2e tests cover happy + sad paths
- [ ] Docs/runbook updated
- [ ] Observability events added

Result/Notes:
_________________________________________________
```

---

## Phase 0. Planning, Requirements, and Architecture

**Goals**
- Finalize product scope and sequencing for MVP and subsequent phases.
- Confirm architecture decisions and cross-cutting concerns like auth, observability, and data flows.

**Inputs**
- Architecture Overview
- Tech Stack
- Product Features

**Tasks**
- Document product goals and guardrails for MVP vs phase 2.  
- Confirm system context diagram, service boundaries, and data flow.  
- Decide on identity provider, session strategy, and RBAC model.  
- Select logging, tracing, error reporting, and dashboards.  
- Identify external integrations and required credentials.  

> Reference: Architecture Overview  
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


---

## Phase 1. Local Environment and Repo Setup

**Goals**
- Create a consistent local developer environment.  
- Establish repository structure and coding standards.  

**Inputs**
- Tech Stack
- Repository Structure
- Coding Standards

**Tasks**
- Install runtimes and package managers per Tech Stack.  
- Initialize monorepo or polyrepo per Repository Structure.  
- Add coding standards configuration for lint, format, types, commit hooks.  
- Create example environment files and secret management process.  
- Set up basic CI job to run lint and type checks on pull requests.  

> Reference: Tech Stack  
Tech Stack and Services

This document enumerates all major technology choices for the project – front-end, back-end, database, hosting, and external services – along with the rationale behind each choice and notes on scalability. Our stack is chosen to accelerate development while ensuring we can scale to meet user demand.

Frontend
	•	Framework: Next.js (latest version with the App Router) with React and TypeScript. We chose Next.js for its hybrid rendering capabilities (static generation for marketing pages, server-side rendering for dynamic app pages) and its first-class support for App Router which simplifies routing and layouts. React with TypeScript provides a robust developer experience, catching errors early and enabling rich IDE support.
	•	UI & Styling: Tailwind CSS (utility-first CSS) for rapid UI development and consistency. Paired with a ShadCN to build accessible components quickly. This combination lets us maintain a consistent design system and easily adjust to branding needs.
	•	State Management: Rely primarily on React’s built-in state and Context. Next.js App Router encourages using React context or server components for data fetching. If needed, we may introduce a library like Zustand or Redux for global state, but initial complexity is kept low by leveraging React and Next features.
	•	Recording Interface: We utilize the MediaDevices API (getUserMedia/getDisplayMedia) and MediaRecorder in the browser to capture screen, camera, and microphone. The front-end includes a custom recording UI that guides the user to grant screen/camera permissions and shows recording controls (start/stop, possibly pause). For combined screen + webcam recording, we capture both streams and composite them (for example, drawing webcam video on a canvas over the screen video to produce a single stream). This is done to ensure the screen and face-cam are synchronized in one video file.
	•	Frontend Build & Tooling: The project uses modern toolchain (ESLint, Prettier, Jest/React Testing Library for testing components). Next.js handles bundling via Webpack/Turbopack, and we can leverage Vercel’s optimization for images and assets.

Rationale: Next.js accelerates development by handling common web app requirements (routing, code-splitting, API routes) and is well-suited for our SaaS which has both a public website and an application. Tailwind and ready-made UI components speed up styling while ensuring a polished, responsive UI out-of-the-box. Using the native MediaRecorder API avoids heavy dependencies and gives us flexibility; it’s supported on modern browsers and lets us stream data for large recordings rather than load entire files in memory.

Backend
	•	Platform: Next.js API Routes / Route Handlers for building our HTTP API. Since our app is primarily serverless and front-end driven, we use Next’s built-in API layer for convenience. This allows co-locating backend endpoint code with the front-end project, simplifying integration.
	•	Language: TypeScript on the server as well (Node.js runtime) for consistency with the front-end and to catch type issues across the stack.
	•	Web Server / Hosting: Vercel is used for hosting the Next.js application (both front-end and API routes). Vercel provides automatic scaling, edge network, and CI/CD integration. It’s optimized for Next.js, which means easy deployments and fast global delivery for our static content.
	•	Asynchronous Workers: For long-running processes (transcription, document generation, etc.), we decouple from the request/response cycle. There are two approaches:
	•	Serverless Tasks: We initiate work in an API route (or Vercel Edge Function) and immediately return, then use callbacks/webhooks to continue processing. For example, when a video is uploaded, an API route can enqueue a transcription job and return quickly. The actual transcription is done by an external service or background process, which calls our webhook when done.
	•	Dedicated Worker Service: As we scale, we may introduce a separate background worker service (e.g. a Node.js or Python process) that pulls jobs from a queue (like Redis or Supabase PG listen/notify) and processes them. This service can run on AWS (Lambda, ECS) or another environment. Initially, we try to leverage external APIs (OpenAI, etc.) that are asynchronous so that our own infrastructure can stay minimal.
	•	API Design: We adopt RESTful endpoints within Next.js for simplicity (detailed in api-spec.md). We also use Edge Middleware (via Clerk and custom logic) for tasks like authentication and rate-limiting where low-latency filtering is needed.

Rationale: Keeping the backend within Next.js (at least initially) reduces complexity – we don’t maintain a separate Express server. Vercel’s serverless model means we don’t worry about managing servers for the API, and it scales automatically per request. By offloading heavy tasks to asynchronous workflows or third-party services, we avoid serverless timeouts and keep the app responsive. This setup is very scalable for bursty workloads – Vercel can spawn more lambdas for API routes as needed – and we’ll design our system to be stateless so this scaling is seamless. If needed, introducing a dedicated worker service for background jobs will further improve throughput without impacting user-facing performance.

Database
	•	Primary Database: PostgreSQL 15 (with the pgvector extension for embeddings). We use a relational database to store structured application data (users, organizations, recordings, transcripts, etc.). The pgvector extension allows us to store and query embedding vectors for our AI search features directly in Postgres.
	•	Hosting: Supabase (managed Postgres) or Amazon RDS for Postgres. Supabase is an attractive choice as it provides a hosted Postgres with pgvector support out-of-the-box, plus convenience features like row level security (RLS) and a built-in API if needed. It also bundles nicely with storage. Alternatively, we could use RDS or Cloud SQL and self-manage the vector extension.
	•	Connection & ORM: We use a query builder/ORM such as Prisma or Knex for type-safe database queries, or SQL directly for full control especially when using vector similarity queries. Prisma has preview support for pgvector, which could simplify integration. We must ensure efficient queries for vector search (HNSW index) and typical relational data.

Rationale: PostgreSQL is a proven, robust database that covers our needs for structured data and now unstructured vector search. By using Postgres for both standard data and embeddings, we reduce operational complexity (one database to maintain) and avoid data synchronization issues between separate systems. This choice is cost-effective as well – early benchmarks show pgvector can handle moderate vector workloads with high performance and low cost, even outperforming some specialized vector DBs at our scale. As we scale, if we encounter performance limits or operational challenges, we can partition data or consider moving to a specialized vector DB (as discussed in vector-strategy.md). In the meantime, a single Postgres simplifies our stack and leverages our team’s familiarity with SQL.

Storage & File Handling
	•	Video/Audio Storage: Original recordings (video files) are stored in object storage. We are considering Supabase Storage (which is S3 under the hood) versus AWS S3 directly. Both provide durable, scalable object storage. Supabase Storage offers a simple integration (we can manage buckets and permissions in the same dashboard as our DB) and even supports resumable uploads and 50GB file sizes now. Alternatively, using S3 via AWS SDK gives us more direct control and is practically the same underlying technology.
	•	CDN: Whichever storage we use, the files are served via a CDN (Supabase uses CDN by default; with S3 we’d front it with CloudFront or use Vercel’s built-in asset proxies). This ensures fast playback/download of videos for end users.
	•	Transcripts & Derived Docs Storage: These are textual and stored in the database (as text columns or possibly in a text search index for backup). We do not expect these to be huge (relative to video), so DB storage is fine. We will also keep vector embeddings in the DB (as part of the pgvector setup).
	•	Backups: Rely on managed service backups (Supabase daily backups for DB; versioning on S3 for storage, etc.) and potentially periodic exports for redundancy.

Rationale: Using a managed storage solution like Supabase or S3 means we don’t worry about capacity – we get virtually infinite storage and high availability. Supabase Storage is essentially S3 with a convenient API and built-in auth integration, which speeds up development (no need to implement our own signing if we use their client libraries). On the other hand, direct S3 might be beneficial if we want fine-grained control or our own AWS account isolation; it also has a rich ecosystem of tools. Both options are scalable; we lean towards starting with Supabase Storage for simplicity and fewer moving parts, and we can switch to raw S3 if needed (since Supabase can export buckets, etc.). The CDN ensures that as we scale to many users or global users, video content is delivered quickly from edge locations.

External Services
	•	User Authentication: Clerk is our auth provider. Clerk manages user sign-up, login, multi-factor, social logins, and its Organization feature gives us ready-made support for multi-tenant (B2B) scenarios (multiple users under organizations with roles). This saves us from building authentication and user management from scratch, and provides a secure, maintained solution.
	•	Payments: Stripe is used for billing. We’ll integrate Stripe for subscription management (plan tiers) and possibly usage-based billing if needed. Stripe’s reliability and ecosystem (Checkout, customer portal, etc.) let us implement billing with minimal custom code. It scales from startup to enterprise seamlessly.
	•	Transcription Service: We use a speech-to-text API for transcribing audio. Options include OpenAI Whisper API, AssemblyAI, or Google Cloud Speech-to-Text. Currently we favor OpenAI Whisper API for its accuracy and reasonable cost, processing the audio to text automatically. If the recording audio is large, we upload it to storage and provide a URL to the transcription service for asynchronous processing (AssemblyAI, for example, can take a file URL and callback). This offloads heavy compute from our servers.
	•	LLM for Document Generation: We leverage OpenAI GPT-4 or GPT-3.5 to convert raw transcripts into structured documentation. After transcription, our backend calls OpenAI’s completion API with a prompt to produce a well-formatted Markdown or outline based on the transcript. We may start with GPT-3.5 (for cost efficiency) and allow opting into GPT-4 for higher quality summarization. This service is external but crucial to our “Docify” feature.
	•	Embedding Vector Generation: We use OpenAI’s text-embedding-ada-002 model to generate high-dimensional embeddings from transcript chunks or docs. This model returns a 1536-dimension vector that we store in Postgres. It’s fast and reasonably priced, and ensures our vector search (in Postgres or Pinecone) has state-of-the-art semantic representations. We could also consider local embedding models (like sentence-transformers) later for cost savings, but OpenAI’s offering helps us start quickly and with strong performance.
	•	Vector Search (Future): If/when we migrate to Pinecone for vector search, Pinecone itself is an external service. It provides a fully-managed vector database with an easy-to-use API, high performance, and scaling to billions of vectors. We will use it when our Postgres approach needs a boost (see vector-strategy.md for details).
	•	Email/Notifications: For system emails (invites, passwordless links from Clerk, etc.), Clerk handles most by default. If we need custom emails (e.g. “Your document is ready”), we can integrate an email API like SendGrid or use Clerk’s notification hooks. This ensures reliable email delivery at scale.
	•	Analytics & Monitoring: We include services like Sentry for error monitoring and LogRocket or Vercel Analytics for client-side performance/error tracking. These help us maintain quality as we scale. For product analytics (feature usage, funnel tracking), we might use PostHog or a simple integration with e.g. Google Analytics for marketing pages. These external tools ensure we can debug issues and understand usage in production.

Rationale: By leveraging best-of-breed external services, we can implement complex functionality with minimal custom code. Clerk provides a secure auth system with features like org management that would be time-consuming to build ourselves ￼. Stripe handles the nuances of subscription billing and taxes. OpenAI’s models allow us to implement AI features (transcription, summarization, semantic search) that would be infeasible to build from scratch. Using these services allows us to move fast and deliver a high-quality product from day one, and each of them scales far beyond our initial needs. We are mindful of vendor lock-in and cost: our architecture keeps data (transcripts, vectors) in our database so we can switch providers if needed (for example, we could swap out OpenAI embeddings for an open-source model later). Each choice will be continuously evaluated as we grow, but this stack gives us an excellent balance of development speed, capability, and scalability at the start.

Scalability Considerations

Each component of our tech stack has a path to scale:
	•	Next.js/Vercel: Scales automatically for traffic. We should ensure our API routes are stateless and optimize cold start where possible (using edge functions for latency-critical routes). We may introduce caching (Vercel’s Edge Cache or CDN) for public content and even certain API responses to handle high read load.
	•	Postgres (Supabase): We start with a single-node that can handle our initial workload. As usage grows, we can scale vertically (more CPU/RAM, use Supabase’s higher tiers) and horizontally with read replicas. We will optimize queries (indexes, partitioning if needed for very large tables). If write load grows, we consider sharding by tenant (org) or using a connection pooler like PgBouncer. Supabase automatically handles many optimizations and offers features like caching and full-text search which we can use to offload certain queries.
	•	pgvector/Pinecone: Our vector strategy is to use pgvector now, which is sufficient up to millions of vectors on a decent instance. We will monitor query performance (especially as data grows) – pgvector’s HNSW index gives near-constant-time similarity search and can be tuned. When we near the limit (in terms of memory or maintenance complexity) or need multi-region vector queries, we will migrate to Pinecone, which can scale to billion-scale vectors easily. Pinecone will let us distribute by namespace (org) and not worry about index maintenance at large scale. This two-stage approach (pgvector then Pinecone) ensures we use the right tool at the right time, balancing cost and performance.
	•	Storage (videos): Object storage (S3/Supabase) is effectively infinitely scalable. We will implement chunked uploads so even very large files can be handled, and use CDN delivery so load on origin is minimized. We might set up lifecycle rules (e.g. archive or delete old raw videos if not needed) to control costs in the long term. If user base grows globally, we could consider multi-region storage or additional CDN layers, but that is likely handled by our provider.
	•	External services: All chosen services (Clerk, Stripe, OpenAI, etc.) are designed to scale for huge workloads. We will just need to manage rate limits and quotas (for OpenAI, we’ll apply for rate limit increases as needed, or use multiple API keys/ accounts if appropriate). We also keep an eye on cost as usage grows (e.g. OpenAI embedding costs linearly with content volume; we may incorporate caching or move to open-source models internally if that becomes more economical at scale).
	•	Modularity: Our stack is modular – for example, if one part becomes a bottleneck, we can replace it. The app’s architecture (detailed in other docs) ensures we aren’t tightly coupling logic to a single provider. This means we can introduce services (like a dedicated search service, or a separate microservice for heavy AI tasks) without a complete rewrite.

In summary, our tech stack leverages modern frameworks and services to deliver a feature-rich product quickly. Each choice is backed by rationale focusing on developer productivity and the ability to serve our users reliably. As we grow, the same choices provide paths to scale, whether by configuration, paid upgrades, or swapping in more powerful specialized components. This balanced approach ensures we can focus on building unique value (expert recordings to knowledge) rather than reinventing wheels.

> Reference: Repository Structure  
# Repository Structure

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Stack:** Next.js (App Router), TypeScript, Clerk, Supabase (Postgres + Storage + pgvector), OpenAI, Stripe, Resend, Tailwind + shadcn/ui, Vercel

This document defines our **flat** repo layout, naming, import boundaries, and file placement rules. It includes scaffolding checklists for new routes, APIs, jobs, and webhooks, plus guardrails that keep RSC/Client code safe and maintainable.

---

## 1) Goals & Constraints

* **Flat & predictable**: minimal nesting; everything discoverable in seconds.
* **App Router first**: server components by default; client components opt‑in.
* **Strict boundaries**: no client → DB; no server code imported into client bundles.
* **Typed configs**: zod-validated env; typed API handlers and payloads.
* **Batteries included**: scripts for dev/test/lint/typecheck/build/preview/migrate.

---

## 2) Tooling Overview

* **Package manager**: `pnpm`
* **TS**: `typescript@^5`
* **Lint**: `eslint`, `@next/eslint-plugin-next`, `@typescript-eslint`
* **Format**: `prettier`
* **Schema/Migrations**: `supabase` CLI (or `drizzle-kit` if adopted later)
* **Tests**: `vitest` + `@testing-library/react`, optional `playwright`
* **Emails**: `react-email` for Resend templates
* **Styling**: `tailwindcss` + `shadcn/ui` components
* **ENV typing**: `zod` schema in `lib/env.ts`

---

## 3) Top-Level Layout (Flat)

```
root/
  app/                      # Next.js App Router: marketing + app + API
  components/               # UI components (client or server)
  lib/                      # Server libs: db, auth, vector, email, billing, utils
  styles/                   # Tailwind & global CSS
  public/                   # Static assets (favicons, og images)
  worker/                   # Background worker (Node) & job handlers
  emails/                   # React Email templates for Resend
  scripts/                  # One-off scripts (backfills, exports, checks)
  tests/                    # Unit/integration test helpers, fixtures
  db/                       # SQL migrations, seeders, (optionally drizzle)
  .github/workflows/        # CI pipelines
  .vscode/                  # Editor settings & recommended extensions
  README.md
  package.json
  pnpm-lock.yaml
  tsconfig.json
  next.config.mjs
  tailwind.config.ts
  postcss.config.mjs
  .env.example
  .eslintrc.cjs
  .prettierrc
```

**Why this shape?**  Flat root folders map 1:1 to core concerns (routing, UI, server libs, background work, migrations). Agents and new teammates can jump directly to the right place.

---

## 4) Directory Contracts (What lives where)

### 4.1 `app/` (Next.js App Router)

**Rules**

* Server Components **by default**.
* Client Components **only** where browser APIs or interactivity needed (e.g., recorder, drag‑and‑drop). Declare `'use client'` at file top.
* API routes live under `app/api/*/route.ts` (thin orchestration only).

**Recommended grouping**

```
app/
  (marketing)/              # Marketing site sections
    page.tsx
    pricing/page.tsx
    blog/[slug]/page.tsx

  (auth)/                   # Auth pages (Clerk wrappers)
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx

  (app)/                    # Authenticated product UI
    layout.tsx              # shell: nav/sidebar, org switcher
    dashboard/page.tsx
    recordings/
      page.tsx              # library grid/list
      new/page.tsx          # recorder UI (client component)
      [id]/page.tsx         # detail: video + transcript + doc
    documents/
      [id]/page.tsx
    assistant/page.tsx      # global chat
    settings/
      organization/page.tsx
      billing/page.tsx
      profile/page.tsx

  api/
    recordings/
      init/route.ts         # POST
      finalize/route.ts     # POST
      [id]/route.ts         # GET/DELETE/PATCH
    webhooks/
      transcription/route.ts
      stripe/route.ts
    assistant/query/route.ts
    docify/[recording_id]/route.ts
    embeddings/rebuild/[recording_id]/route.ts
```

**Boundary**: do not import `@supabase` server client or Node-only libs into Client Components. Use Server Actions/route handlers for mutations; fetch via `fetch()` from client when needed.

### 4.2 `components/`

* UI primitives and feature components.
* Partition with folders per domain (`recordings/`, `assistant/`, `layout/`).
* **Suffix conventions**: `*.client.tsx` (forced client) if you want clarity; otherwise rely on `'use client'`.
* Co-locate styles only if component-specific; otherwise global tokens live in `styles/`.

### 4.3 `lib/`

```
lib/
  db.ts                     # Postgres client (server-only)
  sql/                      # Tagged SQL helpers or queries
  auth.ts                   # Clerk helpers; org/role extraction
  rbac.ts                   # server-side authorization checks
  storage.ts                # Supabase Storage helpers (signed URLs)
  vector.ts                 # embeddings + pgvector queries
  docify.ts                 # LLM prompts & wrappers
  transcription.ts          # provider adapters + HMAC verify
  stripe.ts                 # billing helpers + customer portal links
  emails.ts                 # Resend send helpers
  env.ts                    # zod-validated process.env
  logger.ts                 # structured logger (pino/console wrapper)
  errors.ts                 # typed errors; error → HTTP mapping
  rate-limit.ts             # Upstash/Vercel KV sliding-window helpers
  utils.ts                  # small shared utilities (no side effects)
  types.ts                  # cross-cutting types
```

**Rule**: `lib/*` is **server-only** unless the file name explicitly says it is safe for the client (e.g., `lib/utils.ts`). Put any Node/secret code here, never in `components/`.

### 4.4 `worker/`

```
worker/
  index.ts                  # job runner bootstrap
  jobs/
    transcribe.ts
    docify.ts
    embed.ts
    notifications.ts
    usage-rollup.ts
  queue.ts                  # db-backed queue impl
  telemetry.ts              # traces/metrics for jobs
```

* Runs as a separate Node process (or serverless cron).
* Imports **only** from `lib/` (server-safe).
* No UI awareness.

### 4.5 `emails/`

* React Email templates (`.tsx`) with minimal logic; compiled and sent via `lib/emails.ts`.

### 4.6 `db/`

* SQL migrations in timestamped files: `2025-01-15-1200__create-recordings.sql`.
* Seeders (`seed.sql` or `seed.ts`).
* Migration runner scripts in `scripts/` (wrapping Supabase CLI).

### 4.7 `scripts/`

* Operational scripts: backfills, data exports, integrity checks.
* Must be idempotent and read org context from flags (`--org-id`).

### 4.8 `tests/`

* Unit tests near sources **or** consolidated here; integration and API tests live here.
* Fixtures under `tests/fixtures`.

---

## 5) Naming & Conventions

* **Files & folders**: `kebab-case` (`recording-detail`, `usage-rollup`).
* **React components**: `PascalCase.tsx`.
* **Types**: `PascalCase` for interfaces/types; `camelCase` for variables.
* **Routes**: plural resource names (`/recordings`, `/documents`).
* **Dynamic segments**: `[id]`, `[orgSlug]` as needed; avoid deep nesting.
* **API methods**: RESTful where possible; POST for actions that create/trigger jobs.
* **Errors**: standardized `{ code, message, details?, requestId }`.

---

## 6) Import Boundaries (Very Important)

* **Client Components may import only:** other client components, shared UI utils, and **not** server libs.
* **Server Components & API** may import from `lib/*` and use secrets.
* **Worker** may import from `lib/*` only.
* Enforce with ESLint rule `no-restricted-imports` and file globs: prevent `lib/db` from being pulled into client bundles.

**Example ESLint snippet**

```js
// .eslintrc.cjs
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@/lib/db', message: 'Server-only: import in server files/route handlers/workers.' }],
        patterns: [
          { group: ['@/lib/**'], importNames: ['default'], message: 'Check client/server boundary.' }
        ]
      }
    ]
  }
}
```

---

## 7) App Router Patterns

* **Layouts**: put org switcher, nav, and Toaster in `(app)/layout.tsx`.
* **Data fetching**: Server Components read from DB via `lib/db.ts`; Client Components fetch via `/api/*` or use `use` action props.
* **Error boundaries**: `error.tsx` per route group; `not-found.tsx` for 404s.
* **Streaming**: use RSC streaming where answers are long (assistant).

**Route Handler Template**

```ts
// app/api/recordings/finalize/route.ts
import { z } from 'zod'
import { authOrg } from '@/lib/auth'
import { finalizeUpload } from '@/lib/storage'
import { enqueueJob } from '@/lib/queue'
import { httpError, withRequestId } from '@/lib/errors'

const Body = z.object({ path: z.string().min(1), size: z.number().int().positive(), sha256: z.string().length(64) })

export async function POST(req: Request) {
  const requestId = withRequestId()
  try {
    const { orgId, userId } = await authOrg()
    const body = Body.parse(await req.json())
    const ok = await finalizeUpload({ orgId, ...body })
    if (!ok) throw httpError('BAD_REQUEST', 'Object not found')
    const recordingId = await createRecording({ orgId, userId, path: body.path, size: body.size })
    await enqueueJob('transcribe', { recordingId }, { dedupeKey: `transcribe:${recordingId}` })
    return Response.json({ recordingId, status: 'queued' }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    const e = httpError.from(err)
    return Response.json({ code: e.code, message: e.message, requestId }, { status: e.status })
  }
}
```

---

## 8) Environment & Config Files

* `.env.local` (dev), Vercel/Supabase envs for staging/prod.
* `lib/env.ts` validates and exports typed config (never read `process.env` elsewhere).

**Example**

```ts
// lib/env.ts
import { z } from 'zod'
const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  RESEND_API_KEY: z.string(),
})
export const env = Env.parse(process.env)
```

---

## 9) Styling & Design System

* Tailwind config lives in `tailwind.config.ts` with semantic tokens (brand, fg, bg).
* shadcn/ui components are generated under `components/ui/*`.
* Global styles: `styles/globals.css` (resets, variables, dark mode).

---

## 10) Testing Layout

```
tests/
  api/
    recordings.finalize.test.ts
    assistant.query.test.ts
  lib/
    docify.test.ts
    vector.test.ts
  components/
    RecorderToolbar.test.tsx
  fixtures/
    transcripts/
    documents/
```

* Unit: Vitest + RTL for React.
* Integration/API: supertest (Next test helpers) or `undici` against dev server.
* E2E (optional): Playwright in `tests/e2e`.

---

## 11) Scripts (package.json)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "format": "prettier -w .",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "db:push": "supabase db push",
    "db:gen": "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > lib/types.gen.ts",
    "worker": "tsx worker/index.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

---

## 12) Scaffolding Playbooks

### 12.1 New **page** in `(app)`

1. Create folder under `app/(app)/<route>/page.tsx`.
2. If interactive, add `'use client'` and keep all server code in actions/API.
3. Add loading/error boundaries if long‑running.

### 12.2 New **API route**

1. Create `app/api/<resource>/<action>/route.ts`.
2. Define `zod` schemas for request/response.
3. Enforce org/role with `authOrg()`.
4. Use typed errors; return `x-request-id`.
5. Add unit/integration tests under `tests/api/`.

### 12.3 New **DB table**

1. Author migration in `db/` (timestamped).
2. Update `lib/db` queries and types.
3. Add indexes (and RLS policy in phase 2).
4. Seed and write tests.

### 12.4 New **job** (worker)

1. Implement in `worker/jobs/<name>.ts` (idempotent).
2. Add enqueue helper in `lib/queue` with `dedupeKey`.
3. Register in `worker/index.ts` dispatcher.
4. Add metrics and tests.

### 12.5 New **webhook**

1. Route at `app/api/webhooks/<vendor>/route.ts`.
2. Verify HMAC/signature; record provider ids; ensure idempotency.
3. Persist and enqueue downstream jobs; 202 asap.
4. Add replay test and signature tests.

---

## 13) Git & Branching

* Default branch `main`; PRs from short‑lived feature branches.
* Conventional Commits (`feat:`, `fix:`, `chore:`…).
* Required PR checks: typecheck, lint, unit tests, build, migrations dry-run.

---

## 14) CI File Locations

* Workflows live in `.github/workflows/`:

  * `ci.yml` (lint, typecheck, test, build)
  * `preview.yml` (Vercel preview)
  * `migrations.yml` (db plan/check)

---

## 15) Path Aliases (tsconfig)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/app/*": ["app/*"],
      "@/lib/*": ["lib/*"],
      "@/components/*": ["components/*"]
    }
  }
}
```

**Rule**: always use `@/` imports (never `../../..`).

---

## 16) Recorder-Specific Placement

* **UI**: `app/(app)/recordings/new/page.tsx` (client) and `components/recordings/*` for toolbar, PiP overlay.
* **Upload helpers**: `lib/storage.ts`
* **Finalize API**: `app/api/recordings/finalize/route.ts`
* **Playback**: `components/recordings/Player.tsx` (server wrapper + client video)

---

## 17) Guardrails & Linters

* ESLint custom rule set to forbid `lib/db` in client bundles.
* `eslint-plugin-security` basic checks.
* `eslint-config-next` for React/Next best practices.
* Prettier mandatory; CI will fail on formatting drift.

---

## 18) Example: Feature Folder (Recordings)

```
components/recordings/
  RecorderToolbar.client.tsx
  UploadProgress.client.tsx
  Player.client.tsx
  RecordingCard.tsx

app/(app)/recordings/
  page.tsx                 # list
  new/page.tsx             # recorder (client)
  [id]/page.tsx            # details (server wrapper)

app/api/recordings/
  init/route.ts
  finalize/route.ts
  [id]/route.ts
```

---

## 19) Documentation & ADRs

* Keep `docs/` lightweight; primary operational docs are these `.md` files.
* Record any **Architecture Decision** as `docs/adr/NNN-title.md`.

---

## 20) Appendix: `.env.example`

```
# App
NODE_ENV=development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
```

---

## 21) Future-Proofing

* If we adopt Pinecone later: add `lib/vector-pinecone.ts` and keep `lib/vector.ts` as a strategy delegator.
* If we adopt Storybook: place config under `/.storybook` and stories next to components.
* If we split worker into its own service: promote `worker/` to a separate repo or package, keep interfaces in `lib/types.ts`.


> Reference: Coding Standards  
# Coding Standards

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** TypeScript/React/Next.js (App Router), API handlers, worker jobs, SQL/migrations, tests, tooling, docs.

This doc defines our **ground rules** for writing code: style, patterns, safety, testing, and review. It is intentionally prescriptive to maximize reliability and speed for a solo‑to‑small team scaling to production.

---

## 1) Languages, Runtimes, Toolchain

* **TypeScript:** `^5.x` with `strict` enabled, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
* **Node runtime:** `>=18.x` (Vercel & worker). No Node built-ins in client code.
* **Next.js:** `^14` (App Router). Prefer **Server Components**; Client Components opt‑in.
* **Package manager:** `pnpm`.
* **Schema/migrations:** Supabase SQL (optionally Drizzle later).
* **Tests:** Vitest + React Testing Library; optional Playwright.

---

## 2) Project Conventions

### 2.1 Naming & Files

* **Files/folders:** `kebab-case` (e.g., `recording-card.tsx`).
* **React components:** `PascalCase.tsx`. One default export per file.
* **Types/interfaces:** `PascalCase` (`Recording`, `TranscriptWord`).
* **Constants:** `SCREAMING_SNAKE_CASE` for env-like constants; `camelCase` otherwise.
* **Tests:** co-locate or place in `tests/`, suffix with `.test.ts[x]`.

### 2.2 Imports

* Use path aliases `@/` from `tsconfig.json`. No `../../../`.
* Do **not** import server-only libs (`@/lib/db`, `@/lib/stripe`, etc.) from Client Components.
* Side-effect imports must be documented at top comment.

### 2.3 Comments & Docs

* File header (optional) when non-obvious: purpose, invariants, ownership.
* JSDoc for exported functions/types where intent isn’t obvious.
* TODOs must include **owner + context**: `// TODO(jane): explain retry strategy here`.

---

## 3) TypeScript Standards

* `strict: true`, `noImplicitAny: true`, `noPropertyAccessFromIndexSignature: true`.
* Never `any` unless you **prove** a narrower type is impossible; annotate `// intentionally-any: reason`.
* Use **discriminated unions** over string enums when possible.
* Define **zod** schemas beside types for runtime validation at boundaries (API, webhooks, env, job payloads).
* Prefer **readonly** for object/array fields that shouldn’t mutate.
* Narrow types early with guards (`if (!value) return;`).
* Utility types live in `@/lib/types.ts`.

---

## 4) React/Next Patterns

### 4.1 Server vs Client Components

* Default to **Server Components** for data fetching and composition.
* Client Components only for: MediaRecorder/DOM APIs, eventful widgets, or stateful interactions.
* **Do not** pass secrets or server-only objects as props to Client Components.

### 4.2 Data Fetching & Mutations

* Server Components call DB via `@/lib/db` or fetch internal APIs.
* Client Components **never** call DB; use API route handlers (`/app/api/*`) or Server Actions.
* Validate all inputs with zod at the **edge** (route handler boundary).

### 4.3 State & Forms

* Local UI state: React state or `useReducer`. Avoid global stores for now.
* Forms: use **controlled** inputs when validation/formatting is needed; otherwise uncontrolled with refs is fine.
* Debounce expensive client events (≥ 150ms) and throttle scroll/resize.

### 4.4 Rendering & Performance

* Avoid unnecessary `'use client'`. Hoist heavy logic to server.
* Memoize lists with `key` and `React.memo` when items > ~100.
* Split large Client Components; use dynamic import for heavy widgets.
* Streaming responses for chat/long docs.

### 4.5 Accessibility

* Every interactive element must be keyboard accessible with visible focus.
* Use shadcn/ui primitives correctly with ARIA roles/labels.
* Provide alt text for images and captions for videos where relevant.

---

## 5) Styling & UI

* Tailwind with semantic tokens (brand, fg, bg). Avoid raw hex.
* Component class names: order **layout → spacing → typography → color → state**.
* Prefer shadcn/ui components; extend via className, not forks.
* Motion via Framer Motion; respect `prefers-reduced-motion`.

---

## 6) API & Error Contracts

### 6.1 HTTP Patterns

* RESTful where practical; `POST` for actions.
* Pagination: `?cursor=` model with opaque cursors; default page size 25; max 100.
* Idempotency: `Idempotency-Key` for POSTs that can be retried (finalize, regenerate, etc.).

### 6.2 Request/Response Validation

* zod schema per route; parse request at the boundary. Return `{ code, message, details?, requestId }` on errors.

### 6.3 Error Mapping

* 400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 422 `UNPROCESSABLE`, 429 `RATE_LIMITED`, 5xx `INTERNAL`.
* Do **not** leak internals in messages; include `requestId` and user-actionable hints.

### 6.4 Versioning & Deprecation

* Avoid breaking changes; add new fields, keep old until migration.
* Deprecations announced via changelog; support both for ≥ 2 minor versions.

---

## 7) Security Rules

* No secrets in client code or logs. Use `@/lib/env` on server only.
* HSTS, CSP (no `unsafe-inline`), strict CORS (app domain only).
* Webhooks: HMAC verification; timestamp skew ≤ 5m; reject replays (nonce store).
* Input sanitization: validate + escape; never trust client `org_id`.
* RBAC checks **server-side** for every mutation and sensitive read.
* Signed URLs: short TTL; minimal scope; validate object ownership (`org_id` prefix).
* Redact PII before embedding; mark redaction rules in metadata.

---

## 8) Database & Queries

* SQL in tagged helpers or views; prefer parameterized queries. No string concatenation.
* Enforce **FKs** and indexes; default `NOT NULL` unless justified.
* Migrations are backward-compatible (expand/contract). See migration playbook.
* RLS (phase 2): policies per table; ensure Clerk JWT → `current_setting('request.jwt.claims')` mapping.
* Use `LIMIT` and pagination; never load unbounded lists.

---

## 9) Jobs & Webhooks

* All jobs must be **idempotent**. Use `dedupe_key` and upserts.
* Exponential backoff with jitter. Max attempts set per job.
* Webhooks: 202 quickly; do heavy work in jobs. Log provider ids.

---

## 10) Logging, Metrics, Tracing

* Structured logs (JSON): `ts, level, requestId, orgId, userId, route, outcome, latencyMs`.
* Always attach a `requestId` and propagate to vendors via headers if available.
* Emit metrics for: request counts, p50/p95 latency, error rate, queue depth, provider latencies, token usage, storage egress.
* Add trace spans for upload, finalize, transcription webhook, docify, embedding, assistant completion.

---

## 11) Testing Strategy

* **Unit**: functions/components in isolation; mock external calls. Coverage goal: 80% for `lib/`.
* **Integration**: API routes with realistic inputs; hit staging DB if feasible in CI (shadow schema) or use dockerized Postgres locally.
* **E2E (optional)**: Playwright for critical journeys (record → finalize (mock) → docify (mock) → search).
* **Contracts**: JSON schema snapshots for API responses to detect breaking changes.
* **Security tests**: RLS policy tests (phase 2), webhook signature tests, rate-limit tests.

---

## 12) Performance Budgets & Guards

* Page TTFB ≤ 200ms for cached marketing; app pages aim ≤ 500ms server render.
* Client bundles: prefer ≤ 180KB gz per route group; dynamic import heavy libs.
* Upload concurrency default 4; chunk size 10MB; configurable by network.
* Assistant: top‑k ≤ 6; prompt tokens ≤ 3k by default.

---

## 13) Accessibility Standards

* WCAG 2.1 AA baseline.
* Ensure focus management on dialogs/menus; escape closes; tab trap prohibited.
* Provide keyboard shortcuts with help modal (`?`).

---

## 14) Code Review & PR Checklist

### 14.1 Review Philosophy

* Small, focused PRs (< 500 LOC diff preferred).
* Reasoned trade-offs; reference ADRs when relevant.

### 14.2 Checklist (copy into PR description)

* [ ] Types complete; no stray `any` (or explained `intentionally-any`).
* [ ] Inputs validated (zod) at boundaries.
* [ ] AuthZ enforced (org/role).
* [ ] Logs & metrics added for non-trivial paths.
* [ ] Errors mapped with requestId; no secret leakage.
* [ ] Tests added/updated (unit/integration).
* [ ] Docs updated (API/contracts/migrations).
* [ ] UI a11y pass (labels, focus, contrast).
* [ ] Bundle impact considered (if client changes).

---

## 15) Git Hygiene & Commits

* **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`.
* **Message rule**: imperative mood, ≤ 72 char subject; details in body if needed.
* **One feature/bug per PR.**

---

## 16) Feature Flags & Config

* Use `organizations.settings` JSONB and env flags. Read via `@/lib/env` and `getOrgSettings()`.
* Default safe; guard experimental paths behind flags.

---

## 17) Internationalization & Locale

* Content (transcripts/docs) may be non‑English. UI is English for MVP.
* Dates: store UTC; format in user locale on client.
* Numbers/currency: use Intl APIs on client.

---

## 18) Time, Precision & Math

* Always use milliseconds (number) in code; convert at edges.
* Avoid floating point accumulation for billing; use integers (cents, token counts) or `bigint`/decimal in DB.

---

## 19) Third‑Party Libraries Policy

* Prefer small, maintained libs; avoid abandoned deps.
* Add dep only if it removes meaningful complexity.
* Record rationale in PR for heavy deps (> 20KB gz client or complex server deps).

---

## 20) Example Patterns

### 20.1 Route Handler with Validation & RequestId

```ts
import { z } from 'zod'
import { authOrg } from '@/lib/auth'
import { httpError, withRequestId } from '@/lib/errors'

const Body = z.object({ query: z.string().min(1), scope: z.object({ recordingId: z.string().uuid() }).partial() })

export async function POST(req: Request) {
  const requestId = withRequestId()
  try {
    const { orgId } = await authOrg()
    const body = Body.parse(await req.json())
    const answer = await answerQuestion(orgId, body)
    return Response.json({ answer }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    const e = httpError.from(err)
    return Response.json({ code: e.code, message: e.message, requestId }, { status: e.status })
  }
}
```

### 20.2 Job Handler (Idempotent)

```ts
// worker/jobs/docify.ts
export async function docify({ recordingId }: { recordingId: string }) {
  const rec = await getRecording(recordingId)
  if (!rec || rec.status !== 'transcribed') return 'noop'
  if (await hasDocument(recordingId)) return 'dedup'
  const markdown = await runDocify(rec.transcript)
  await saveDocument({ recordingId, markdown, version: 'ai:1' })
  await enqueueJob('embed', { recordingId }, { dedupeKey: `embed:${recordingId}` })
}
```

---

## 21) Lint & Format

* ESLint extends `next/core-web-vitals`, `@typescript-eslint/recommended`.
* Prettier required; CI fails on drift. No custom print width unless needed.
* Additional rules:

  * forbid `console.log` in prod paths (use logger),
  * disallow `any` w/o comment,
  * `eqeqeq`,
  * `no-floating-promises` (via eslint‑plugin‑promise/ts‑eslint).

---

## 22) Secrets & Env Handling

* Centralized in `@/lib/env`. Never access `process.env` elsewhere.
* Rotate keys quarterly; document rotations in changelog.
* Mask secrets in logs; avoid echoing in errors.

---

## 23) Accessibility PR Gate

* Run Axe check for changed pages.
* Keyboard path demo in PR (gif or steps) for new interactive widgets.

---

## 24) Deprecation & Removal Process

1. Mark as deprecated in code comments + docs.
2. Feature flag old path off by default for new orgs.
3. Announce in release notes with timeline.
4. Remove after ≥ 2 minor versions and zero usage for 30 days.

---

## 25) Appendices

### 25.1 tsconfig (core parts)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

### 25.2 Prettier

```json
{ "singleQuote": true, "semi": false, "printWidth": 100 }
```

### 25.3 .editorconfig

```
root = true
[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

---

## 26) Non‑Negotiables (TL;DR)

* Validate at boundaries **every time**.
* No secrets on the client **ever**.
* Idempotent jobs & webhooks **always**.
* Org isolation at all layers.
* Tests for business logic and APIs before shipping.
* Observability on anything that costs money or can fail.


---

## Phase 2. Database and Backend Services

**Goals**
- Provision database and run baseline migrations.  
- Implement backend services, API routes, and data access patterns.  

**Inputs**
- Database Schema
- Architecture Overview
- Product Features

**Tasks**
- Create database, roles, and apply migrations from the Database Schema.  
- Implement data access layer aligned to schema and RLS or RBAC policies.  
- Define API contracts for each feature area.  
- Add seed data and test fixtures for local and CI.  
- Add health checks, structured logging, and request tracing.  

> Reference: Database Schema  
Database Schema and Design

This document describes the PostgreSQL database schema in detail. It lists each table, its purpose, key columns (with types), relationships (foreign keys), and any access rules or constraints. The schema is designed to support multi-organization data separation, the recording-to-document pipeline, and the vector search capabilities. All tables use singular names (for clarity) and are organized to minimize data duplication while ensuring efficient queries.

Overview

Our database is PostgreSQL with the pgvector extension enabled for vector similarity search. We use UUIDs as primary keys for most tables (except where noted) to have globally unique identifiers, especially since data is multi-tenant. The schema is normalized to avoid data anomalies, but we also consider indexing and query patterns to optimize performance.

Every table that is organization-specific will have an org_id column referencing the Organizations table. This ensures row-level security (RLS) policies can enforce tenant isolation (if using Supabase or custom RLS rules). For simplicity and clarity, all foreign keys (user_id, org_id, etc.) are explicitly stored rather than relying solely on an external auth token.

Below is a table-by-table breakdown:

Tables

1. users

Stores application users. Even though we use Clerk for authentication, we maintain a users table to track additional metadata and to join with content.
	•	user_id UUID PRIMARY KEY: Unique identifier for the user (we generate this, or we can use Clerk’s user ID as UUID if possible). Alternatively, we could use a text ID from Clerk (like user_abc123), but a UUID gives consistency.
	•	clerk_id TEXT UNIQUE: (Optional) The Clerk-provided user ID, if not using it as primary key. This helps link back to Clerk.
	•	email TEXT: User’s email address. (We may store this for convenience, even though Clerk has it, to use in RLS policies or to display in the UI without extra API calls.)
	•	name TEXT: Full name or display name.
	•	created_at TIMESTAMPTZ DEFAULT now(): Timestamp when the user was first registered in our DB.
	•	last_login TIMESTAMPTZ: (Optional) Last time the user logged in (could be updated via webhook or on session verify).

Purpose: This table holds core profile info and serves as the target for any foreign key that needs to reference a user (e.g., who created a recording). It might also be used for analytics (number of active users, etc.). Access: Generally, a user can view their own data here (via Clerk session) but not others’ personal info except maybe name. In an org context, user names/emails might be visible to org mates for identification.

Access Rules: If using RLS, we’d allow a user to select their own row (using something like auth.uid() = user_id if we include the sub in JWT). For admins, we might allow reading all users in their org via a join on membership (see below). However, we can also avoid exposing this table directly and fetch user names via our backend code when needed.

2. organizations

Represents an organization (tenant workspace).
	•	org_id UUID PRIMARY KEY: Unique identifier for the org.
	•	name TEXT: Organization name (e.g., company or team name).
	•	clerk_org_id TEXT UNIQUE: (Optional) If using Clerk Organizations, their ID for this org. We can store it to reconcile membership automatically.
	•	created_at TIMESTAMPTZ DEFAULT now(): When the org was created.
	•	created_by UUID REFERENCES users(user_id): Who created the org (usually the first user, automatically an admin).
	•	plan TEXT: The subscription plan or tier (e.g., “free”, “pro”, “enterprise”). This is updated via billing events, and can be used to enforce limits (like number of recordings).
	•	settings JSONB: (Optional) Misc org-level settings, e.g., whether public sharing is allowed, org logo URL, etc.

Purpose: Defines a tenant. All content is tied to an org. We will enforce that any user action is scoped to their current org. This also stores billing plan which might gate certain features or usage quotas.

Access Rules: Typically, only members of an org can see its details. RLS can enforce that a selecting user must be a member (we can maintain a membership table to check). Clerk’s JWT might carry org context; if so, auth.org_id() = org_id could be used in RLS. In our backend, we’ll fetch org info for display (e.g., show org name in UI). Non-members cannot see this table’s data at all.

3. user_organizations (Memberships)

Join table connecting users to organizations, with roles.
	•	user_id UUID REFERENCES users(user_id) ON DELETE CASCADE: The user in the org.
	•	org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE: The organization.
	•	role TEXT: Role of the user in the org (e.g., ‘admin’, ‘member’). We can default this to ‘member’ and have one user (creator) as ‘admin’, or use Clerk’s roles if syncing.
	•	joined_at TIMESTAMPTZ DEFAULT now(): When the user joined the org.
	•	invited_by UUID: Who invited the user (if applicable).

Composite primary key on (user_id, org_id) to ensure uniqueness of membership.

Purpose: Enables many-to-many between users and orgs (since a user can be in multiple orgs, and each org has multiple users). It’s central for permission checks. For example, to list all recordings a user can access, we ensure recordings.org_id IN (orgs the user is a member of).

Access Rules: A user should only see memberships for orgs they belong to. RLS example: user_id = auth.uid() allows a user to see their own membership entries (and thereby see which orgs they belong to, and their role). Alternatively, we might not expose this table directly in API, using it only for joins in server queries. For admin actions (like listing all members of my org), we could allow if org_id in a subquery of orgs where that admin has role ‘admin’.

4. recordings

Each row represents a recording (the source video content). This is a primary table in the pipeline.
	•	recording_id UUID PRIMARY KEY: Unique ID for the recording.
	•	org_id UUID REFERENCES organizations(org_id): The organization that owns this recording.
	•	user_id UUID REFERENCES users(user_id): The user who created/recorded it.
	•	title TEXT: A title for the recording (could be user-provided or auto-generated from content or filename). Defaults to something like “Untitled Recording” or the date if not set.
	•	description TEXT: (Optional) A brief description of the recording’s content.
	•	video_url TEXT: URL or storage key for the video file. If using Supabase, this might be a path like recordings/recording_id.webm. If using S3, a full s3 or CDN URL. We store it for retrieval. (We might also store a thumbnail_url or key if we generate thumbnails.)
	•	duration INT: Length of the video in seconds (for quick reference and UI).
	•	status TEXT: Current processing status. Allowed values: ‘uploaded’, ‘transcribing’, ‘transcribed’, ‘doc_generating’, ‘completed’, ‘error’.
	•	error_message TEXT: If status = ‘error’, details on what went wrong.
	•	created_at TIMESTAMPTZ DEFAULT now(): When recording entry was created (initiated).
	•	completed_at TIMESTAMPTZ: When processing (transcript+doc) was fully done.

Indexes: We’ll index org_id (since we often query recordings by org) and possibly user_id for filtering by creator. We might also index status if we frequently query incomplete items for a worker to pick up, but if we use external triggers, maybe not necessary.

Purpose: Represents the primary content object. The pipeline updates its status as things progress. We also use this table for listing content in the UI (e.g., “My Recordings”). Title and description help in identifying and searching. Relations: one recording has one transcript (see transcripts table) and one document (see documents table), and many transcript chunks (for vector search). We separate those for performance and size reasons.

Access Rules: Only members of the same org should access a recording. RLS: org_id = auth.org_id() (if JWT has org claim) ensures isolation. Additionally, we might allow only the owner or admins to delete or update certain fields. For example, allow anyone in org to read, but to delete or modify a recording, either the user_id matches the auth user (they own it) or the auth user has admin role via membership. This can be done with a check against membership on writes (Supabase RLS can use subqueries, or in our server logic we enforce it).

5. transcripts

Stores the full transcript text for each recording (one-to-one relationship).
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: Use the same ID as the recording for convenience (1-1). Also serves as primary key.
	•	text TEXT: The full transcript text (could be very long for lengthy videos). We store it as one large text blob.
	•	language TEXT: Language code (e.g., ‘en’, ‘es’) detected or used for transcription.
	•	transcribed_at TIMESTAMPTZ: When the transcription was completed.
	•	updated_at TIMESTAMPTZ: When the transcript was last updated (in case user edits it).
	•	words JSONB: (Optional) Could store structured data like an array of words with timestamps, or paragraphs with timestamps. Alternatively, we might have a separate table for timing if we want fine-grained search. But storing as JSONB is an option (e.g., an array of objects { word, start_time, end_time }).

Purpose: Holds the raw text output of the speech-to-text process. Kept separate to avoid slowing down queries on recordings list (we don’t want to always pull giant transcript text when listing recordings). Also, easier to manage updates to transcript without touching recording metadata. This is useful for search and for feeding to document generation.

Access Rules: Same as recording – accessible only within org. We usually fetch a transcript by joining with recording to ensure org context. One could also enforce via RLS that recording_id in a subquery of recordings the user has access to.

6. documents

Stores the AI-generated structured document for a recording.
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: 1-1 with recording (each recording has at most one doc, initially).
	•	content TEXT: The generated document content, likely in Markdown (or some markup). Could be quite long.
	•	summary TEXT: (Optional) A short summary or excerpt of the recording (if we generate a summary separately).
	•	generated_at TIMESTAMPTZ: When the document was first generated.
	•	updated_at TIMESTAMPTZ: When it was last edited by a user.
	•	generator_model TEXT: Which AI model was used (e.g., ‘gpt-4’ or ‘gpt-3.5’) for reference.
	•	version INT: Version number if we regenerate multiple times. Starting at 1.
	•	is_published BOOLEAN DEFAULT FALSE: Whether this document is marked for public sharing (see product-features on publishing). If true, an anonymous link can access it (with possibly another table to hold the token or just use recording_id in a hashed form).

Purpose: Contains the refined knowledge artifact. It’s stored separately since it’s a different representation of the content (not the verbatim transcript). The user can edit it, so it diverges from the transcript. We may want to track versions in the future (either here or separate table), but for now a single current content is stored.

Access Rules: Tied to recording’s org; same access. If is_published is true, we might allow read access without auth via a specific endpoint that checks this flag (or via a separate signed token). But within app, only org members can normally fetch it. Edits should be allowed to the recording owner or any member (depending on collaboration decisions). Possibly only owner and admins can edit docs – we’ll enforce in app logic or via RLS (we could allow update if user_id = auth.uid() or user is admin).

7. transcript_chunks

Stores chunks of transcript or document content for vector embedding. Each row is a semantic chunk with its embedding vector.
	•	chunk_id BIGSERIAL PRIMARY KEY: Unique ID for the chunk (could use UUID, but serial is fine since mainly internal).
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Which recording this chunk is from.
	•	org_id UUID: Denormalization of org (we might store org_id here as well for easy filtering without join, because we will often filter by org when querying vectors).
	•	text TEXT: The content of this chunk (a sentence or paragraph from transcript or doc).
	•	embedding vector(1536): The embedding vector for the text, using pgvector type. (1536 dim if using OpenAI’s Ada, adjust if using a different model).
	•	index INT: The position of this chunk in the source transcript/doc (like chunk 0,1,2…). This could help if we need to reconstruct context or for debugging results order.
	•	source_type TEXT: Indicates origin of chunk, e.g., ‘transcript’ or ‘document’. We might choose to embed only transcripts initially (then source_type might not be needed). But if we embed both, this helps to know where the text came from.
	•	metadata JSONB: (Optional) Additional metadata like {"start_time": 120.5, "end_time": 150.0} if chunk aligns to a portion of video, or section titles.

Indexes: A vector index for embedding (HNSW or IVF index via pgvector) for similarity search. Also an index on org_id so we can efficiently apply org filter (some queries might do WHERE org_id = X ORDER BY embedding <-> query limit k, which will use the ivfflat index that can include an additional condition, or we might need a partial or separate approach; HNSW in pgvector can support an additional filter in the WHERE clause).

Purpose: This is the backbone for semantic search. By chunking the text, we capture fine-grained pieces of knowledge. Each chunk is like a Q&A snippet that the AI assistant can use. We separate it to optimize vector operations (we don’t run those on the full text), and to allow limiting search to an org easily. Also, if we use Pinecone later, this table’s data would be what we sync to Pinecone.

Access Rules: Only accessible within org. If someone somehow queried this table, they should only see rows where org_id matches theirs. RLS: org_id = auth.org_id(). In practice, our app will not directly expose this table; instead, the backend will perform vector searches and return results in a user-friendly way. But RLS is a good safety net.

8. jobs (or pipeline_tasks)

Optional: Track asynchronous pipeline jobs for processing. This can log steps like transcription, doc generation, embedding.
	•	job_id UUID PRIMARY KEY: ID for the job.
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Related recording.
	•	type TEXT: ‘transcription’ | ‘doc_generation’ | ‘embedding’ etc.
	•	status TEXT: ‘pending’ | ‘in_progress’ | ‘completed’ | ‘failed’.
	•	created_at TIMESTAMPTZ DEFAULT now().
	•	started_at TIMESTAMPTZ.
	•	finished_at TIMESTAMPTZ.
	•	error_message TEXT: if failed.
	•	attempt INT: attempt count for retries.

We might not need this if we handle state just in recordings.status and use external services for workflow. But if multiple jobs can run or be retried, tracking here helps. For example, if doc generation fails but transcript is fine, we could just mark that job failed and allow retry without resetting transcription status.

Purpose: Provide resilience and audit trail for background tasks. Could be used by a worker process to pick up pending jobs in queue (if we use DB as queue), or just to store events from external webhooks (like “transcription done”).

Access Rules: Orgs probably don’t need direct access; it’s internal. But if needed (maybe to show an admin a pipeline log), we’d restrict by org via join on recording.

Relations and Notable Constraints
	•	A user can belong to many orgs (user_organizations), and an org has many users.
	•	A recording belongs to one org and one user (owner). An org has many recordings; a user can have many recordings (those they created).
	•	Transcript and Document are each 1-1 with Recording (sharing the same primary key ID as recording_id). This means we can use LEFT JOIN transcripts ON recordings.recording_id = transcripts.recording_id to get transcript data easily in queries.
	•	Transcript_chunks are many-to-1 with Recording. They also have org stored to ease filtering.
	•	Delete behavior:
	•	If a recording is deleted, cascade to transcript, document, chunks, jobs – so no orphan data.
	•	If a user is removed, we might keep their recordings (since knowledge stays with org). We may set user_id to NULL or to a special “deleted user” marker, rather than cascade delete recordings. So perhaps user_id should be nullable and on user deletion we do a soft approach. But with Clerk, user deletion is rare. We’ll keep ON DELETE CASCADE on user_organizations, but not on recordings.user_id. Instead, handle in application if needed (or disallow user deletion if it has data).
	•	If an org is deleted (like a company offboards), we cascade to all recordings and related data to truly wipe it. Or we might soft-delete orgs for safety.
	•	Row Level Security (RLS): If using Supabase or Postgres RLS, we enable it on all tables. Example policies:
	•	For recordings: SELECT policy: org_id = current_setting('jwt.claims.org_id')::uuid (in Supabase’s case, they might cast the claim). Similar for transcripts, docs, chunks by joining or since they share org via recording or direct field.
	•	Insert: Only allow if the org_id of the new row is one of the orgs the user is member of (we can check via membership table – a subquery like EXISTS (SELECT 1 FROM user_organizations m WHERE m.org_id = new.org_id AND m.user_id = auth.uid())).
	•	Update/Delete: Only if user has permission – either owner or admin. Could check membership role or recording.user_id for updates. Alternatively, in app logic we enforce those for now.

If using Supabase, we’d heavily rely on RLS with the JWT. If not, our API endpoints will implement these access checks manually using the membership info from Clerk (e.g., clerk provides current org and role in session, or we query our membership table for that user and org).

Example Schema (DDL Excerpts)

Below are representative DDL statements for a subset of tables to illustrate:
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

CREATE TABLE organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    clerk_org_id TEXT UNIQUE,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(user_id)
);

CREATE TABLE user_organizations (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, org_id)
);

CREATE TABLE recordings (
    recording_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    title TEXT,
    description TEXT,
    video_url TEXT,
    duration INT,
    status TEXT NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Transcript & document share ID with recording:
CREATE TABLE transcripts (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    text TEXT,
    language TEXT,
    transcribed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    words JSONB
);

CREATE TABLE documents (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    content TEXT,
    summary TEXT,
    generated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    generator_model TEXT,
    version INT DEFAULT 1,
    is_published BOOL DEFAULT FALSE
);

CREATE TABLE transcript_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    text TEXT,
    embedding vector(1536),
    index INT,
    source_type TEXT,
    metadata JSONB
);
-- Index for vector search (pgvector):
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat (embedding) WITH (lists=100);
CREATE INDEX idx_chunks_org ON transcript_chunks(org_id);

(We would also create indexes on recordings for org_id, maybe on user_id, etc., and perhaps a composite on org_id + recording_id for quick org scoping.)

Note: The actual SQL might differ slightly depending on whether we use Supabase (which would use auth.uid() instead of a direct JWT setting). The above is illustrative.

Data Access Patterns
	•	Listing Recordings: Query SELECT recording_id, title, status, created_at, user_id FROM recordings WHERE org_id = currentOrg ORDER BY created_at DESC. Possibly join users to get name of owner for display. Since transcripts and docs are not needed in the list, we don’t join them here.
	•	Viewing a Recording Detail: Query recordings by id (with org check), join transcript and document. E.g., SELECT r.*, t.text, d.content FROM recordings r LEFT JOIN transcripts t ON r.recording_id=t.recording_id LEFT JOIN documents d ON r.recording_id=d.recording_id WHERE r.recording_id = X AND r.org_id = currentOrg. This fetches everything needed (video URL, status, transcript text, doc content).
	•	Vector Search: We will run a function to search chunks. For example, in Postgres: SELECT recording_id, text, (embedding <-> query_vec) AS distance FROM transcript_chunks WHERE org_id = currentOrg ORDER BY embedding <-> query_vec LIMIT 5;. This returns top relevant chunks and which recording they belong to. We then likely join or map back to get perhaps the recording title or doc content around that. We might store enough context in metadata (like chunk start time or chunk order) to allow fetching neighboring chunks if needed for more context.
	•	Maintaining org isolation: If using RLS, these queries automatically restrict by current user’s org claim. If not, every query in our backend includes an org filter derived from session info. This double layer ensures a query can never mix data from multiple orgs.
	•	Deletion cascade: When a recording is deleted (by user action or org cleanup), the database will remove its transcript, document, chunks, and any jobs referencing it. We need to ensure to also delete the actual video file from storage separately (that’s outside DB scope).

Access Control Summary

We rely on a combination of:
	•	Application-level checks: Our API endpoints will verify that the current session user is allowed to perform the action (e.g., only owner or admin can delete a recording, as per business rules).
	•	Database constraints/RLS: To enforce tenant isolation and basic access:
	•	RLS ensures a user can’t query or alter data outside their org even if they somehow manipulate an API call.
	•	The schema itself (foreign keys and cascades) prevents data inconsistencies (e.g., can’t have a recording with an org_id that doesn’t exist, etc.).

If using Supabase, each request will carry a JWT with sub = user_id and org_id (we might customize Clerk’s JWT to include org_id and role in custom claims, or use Supabase JWT if we sync users to Supabase). Then RLS policies use those. If not using Supabase RLS, our Node backend will query with proper filters and never expose raw table access to the client.

Future Schema Considerations
	•	We might introduce a comments table (recording_comments) with fields (comment_id, recording_id, user_id, text, timestamp) to allow discussion on recordings. This would reference recordings and users and be isolated by org via the recording join.
	•	A billing table could track Stripe subscription IDs, customer IDs, etc., possibly linking to organizations.
	•	For analytics, a events table could log things like “user X asked question Y at time Z” or “video viewed” but this might also be handled by an external analytics service rather than clogging our primary DB.
	•	If we allow tags or categories on recordings, a tags table and a join table recording_tags could be added to filter and organize content (with org context).
	•	If performance becomes an issue with the vector search in Postgres at scale, we might stop adding to transcript_chunks and instead use an external vector DB. In that case, transcript_chunks would either be replaced or only used for testing, and Pinecone would hold vectors. But we would keep something like transcript_chunks schema for the sake of data completeness and perhaps to allow local fallbacks or migrations.

Every column and relationship in this schema is chosen to support the features described in product-features.md and the flows in implementation-pipelines.md. By having a clear schema, we enable straightforward implementation of features and maintain data integrity as the system scales.

---

## Phase 3. Frontend App and Site Map

**Goals**
- Scaffold the app shell and routing based on the Site Map.  
- Implement shared UI components and state management.  

**Inputs**
- Site Map
- Product Features
- Coding Standards

**Tasks**
- Generate routes and page templates from the Site Map.  
- Implement layout, navigation, and design tokens.  
- Create reusable UI components library.  
- Integrate auth flows and protected routes.  
- Add analytics instrumentation and feature flags.  

> Reference: Site Map  
Sitemap and Route Structure

This document outlines the complete sitemap for both the public marketing site and the authenticated web application (Next.js 13 App Router). It lists all primary routes, their purposes, and access requirements, providing a high-level view of the application’s pages.

Marketing Site (Public)

The marketing site is accessible to everyone and showcases the product’s value. These pages are statically generated for performance and SEO, using Next.js App Router conventions.
	•	/ – Homepage. Introduces the product (expert recording to docs & AI assistant), key benefits, and a call-to-action to sign up. It features a hero section, brief feature overview, and social proof.
	•	/features – Features Overview. Lists major product features (recording, transcription, document generation, vector search/chat, etc.) with descriptions and screenshots. Educates visitors on capabilities and how it solves their pain points.
	•	/pricing – Pricing Plans. Details plan tiers (e.g. Free, Pro, Enterprise), feature differences, and a sign-up link for each. Includes billing FAQs and “Contact Sales” for enterprise inquiries.
	•	/about – About Us. (Optional) Provides company background, mission, and team info, to build trust with potential customers.
	•	/contact – Contact Page. (Optional) Allows visitors to get in touch for support or sales. Could be a form or mailto link.
	•	/login and /signup – Authentication Pages. Redirects to or embeds Clerk’s login and signup components. These might be on separate domain (app subdomain) or as modal on marketing pages. (If using Clerk Hosted Pages, these routes may not be needed, but we include them for completeness).
	•	/terms – Terms of Service. Legal terms for using the service.
	•	/privacy – Privacy Policy. Details on data usage and privacy.

Each marketing page is implemented as a React server component with static generation. Navigation links across the top (e.g. Features, Pricing, Login) make it easy to explore. The tone is persuasive and concise, targeting our top-of-funnel audience.

Web Application (App - Authenticated)

The app is the secure, logged-in area where users record content, manage their recordings and documents, and interact with the AI assistant. It uses Next.js App Router with protected route groups (requiring authentication via Clerk).
	•	/app – Dashboard Home. The main landing after login. Shows the user’s workspace (if multi-organization, the active org’s name), recent recordings/docs, and an entry point to start a new recording. Acts as a “library” of knowledge captures.
	•	/app/record – New Recording. Launches the screen/camera recording interface. Users can select screen(s) to share and camera/microphone, then record. May be a modal or dedicated page. Upon finishing, it directs to the recording’s detail page.
	•	/app/recordings – My Recordings Library. (If separate from dashboard) Lists all recordings/documents the user has access to (in the active organization), with statuses (transcribing, ready, etc.). Allows searching within titles or descriptions.
	•	/app/recordings/[recordingId] – Recording Detail & Document. Page to view a specific recording and its derived content. It includes:
	•	A video player for the recorded screen/camera video.
	•	The transcript (with possible editing capability).
	•	The generated structured document (formatted notes/guide).
	•	An AI Q&A chat interface specific to this recording’s content (allowing the user to query the transcript/doc).
These sections might be in tabs or panels on the page. Users can also update metadata (title, description) here.
	•	/app/assist (or /app/search) – Global AI Assistant. Provides a chat or search interface that can retrieve information across all of the user’s recordings and documents. The assistant uses vector search to find relevant content and answer questions. This page might show recent queries or suggestions, and results link back to source recordings/docs.
	•	/app/settings – User/Org Settings. Contains sub-pages:
	•	/app/settings/profile – Update personal info (name, email) if applicable, or link to Clerk profile management.
	•	/app/settings/organization – Org management (if user is admin): organization name, invite members, manage roles, transfer ownership, etc.
	•	/app/settings/billing – (If applicable) shows current plan, usage, and a link to manage billing (Stripe customer portal).
	•	/app/admin – Admin Dashboard. (Optional, for internal admin roles) If we have an internal admin interface or for organization owners to see analytics, it can live under an admin route.

Route Access & Behavior: All /app/* routes require authentication. We use Clerk’s Next.js middleware to protect these routes – unauthorized users are redirected to login. Clerk provides the user and active organization context to the application. If a user has multiple organizations, they can switch the active org (e.g. via a selector in the dashboard header), which will update which data is shown. The URL structure remains the same (still under /app), but the content is filtered by active org.

Each route corresponds to a Next.js App Router file or folder. For example, the recording detail page is implemented by a dynamic route file at app/recordings/[recordingId]/page.tsx. This uses Next’s file-based routing and can fetch the recording data (server-side) and render client components for video player and AI chat, etc. Marketing pages like /features correspond to app/(marketing)/features/page.tsx (perhaps grouped in a marketing folder for clarity), and are public.

This sitemap ensures we have clear navigation between discovering the product (marketing site) and using it (web app). It will also guide our Next.js routing setup, ensuring each path has a defined purpose and component. All user flows (recording content, viewing results, asking questions, managing account) are accounted for in this structure.

---

## Phase 4. Core Features and Integrations

**Goals**
- Deliver vertical slices for each feature end to end.  
- Integrate any third party services.  

**Inputs**
- Product Features
- Architecture Overview
- Database Schema

**Tasks (repeat per feature)**
- Define acceptance criteria and user flows.  
- Implement backend endpoints, models, and tests.  
- Implement frontend screens and interactions.  
- Add analytics events and business metrics.  
- Add docs and runbook notes for the feature.  

> Reference: Product Features  
Product Features and Rationale

This document provides a comprehensive breakdown of the SaaS app’s features, organized by domain area. For each feature or group of features, we describe what it is, why it exists (rationale), and how users are expected to interact with it. This helps engineers and AI agents understand the scope of the product and the reasoning behind design decisions.

Recording & Capture Features

1. Screen and Camera Recording (Browser-Based):
Feature: Users can record their screen (specific application or entire desktop) along with their webcam and microphone, directly from the browser. The UI allows choosing which screen or window to capture and toggling the webcam on/off (webcam feed appears as a small overlay, e.g. picture-in-picture style). The user can start, pause, resume, and stop the recording.
Rationale: The core of our product is capturing expert knowledge in an easy way. Screen recording with voice (and optional face video) lets an expert show and tell a process or concept without writing anything. Including the camera personalizes the content, which can aid engagement and clarity. Browser-based capture means no installs required, lowering the barrier to usage.
Expected Behavior: The user clicks “New Recording” in the app, is prompted by the browser to select what to share (screen) and to allow camera/mic. Once granted, they see a recording toolbar (e.g., a small control panel with a timer, pause/stop buttons). They carry out their demonstration or explanation while the app records. They might pause if needed (e.g., to switch a window or take a break) and then resume. On clicking stop, the recording finalizes: the user is then taken to the next step (upload or processing screen). The video data is uploaded in the background (if not already during recording) and the user is informed that transcription is in progress.

2. Live Notes Bookmarking (Planned):
Feature: (Planned for future) During recording, the user can hit a “bookmark” hotkey or button to mark important moments. They might also be able to type a quick note or label for that bookmark.
Rationale: This helps the expert highlight key points or sections while recording, which can later be used to structure the document or allow viewers to jump to that point. It bridges the gap between freeform recording and structured output by letting the expert impose some structure on the fly if they want.
Expected Behavior: While recording, if the user hits (for example) the “B” key or clicks a “Add Marker” button, the app records the current timestamp and possibly opens a small text input for a note. The expert can jot “Important tip here” or similar. These markers are saved and will appear on the timeline for reference once the recording is processed (e.g., on the video player, and in the transcript as highlighted lines). This feature would be optional and introduced once basic flow is stable.

3. Multi-Stream Capture Composition:
Feature: The app captures multiple streams (screen, webcam, audio) and merges them into one recording. We implement this by drawing video streams into a single canvas or combining tracks so the output is a single file with all streams.
Rationale: This is largely a behind-the-scenes feature, but it ensures the end video is convenient (one file) and the webcam overlay is burned into the video. It avoids having to manage separate files for screen and camera. For the user, it just works seamlessly – they see their face in the corner of the recording as it’s happening and in the final playback.
Expected Behavior: The user doesn’t directly interact with this logic. They simply choose to record with camera on, and the system handles merging. From an engineering perspective, we expect a slight performance cost on the client (due to canvas compositing) and we must manage that (e.g., rendering at a reasonable resolution/frame rate to balance quality and performance). The end result should be a standard format video (e.g., webm with VP8/VP9 + Vorbis if using Chrome’s default, or mp4/H.264 if using certain browsers) that can be played back easily in the app.

4. Re-record and Editing (Basic):
Feature: If a user is not satisfied with a recording, they can discard it and record again. After stopping a recording, before they leave the recording page, we may offer a preview and a “Retake” option. Basic editing (like trimming the start/end) might be offered after recording.
Rationale: Experts may make mistakes or want a do-over. Providing a quick way to retry keeps the user from getting frustrated with a one-take outcome. Trimming helps remove idle time at start or end (like “Oh is this recording? … Ok let’s start.” moments).
Expected Behavior: After stopping, the video might be shown with a “Retake Recording” button. If clicked, the current recording is scrapped (not uploaded) and the user can immediately start a new one. For trimming, a simple slider UI to cut off a few seconds from start or finish can be presented. The user adjusts, then confirms. Trimming would be done either in browser (if feasible for small trims using MediaRecorder’s data) or on server after upload.

These recording features focus on making capture easy and high-quality. The rationale is always to minimize friction for the expert while ensuring the output contains all needed context (screen + voice + face).

Transcription Features

1. Automatic Speech-to-Text Transcription:
Feature: Once a recording is uploaded, the audio track is automatically transcribed to text (via our transcription service). This produces a full transcript of everything said in the video.
Rationale: The transcript is the foundation for search, document generation, and accessibility. Having text means the content is easily skimmable and indexable. Automated transcription saves the user from ever having to manually transcribe or jot notes. It’s crucial for speed and for the subsequent AI processing.
Expected Behavior: The user doesn’t have to click anything – after recording, they see a status like “Transcribing audio…”. The system sends the audio for transcription. In a few minutes (depending on length), the transcript is returned. The user might get a notification (“Transcript ready!”). When they open the recording’s page, they see the transcript text aligned with the video (e.g., displayed as an interactive transcript where clicking a line jumps the video to that point, if possible). The transcript accuracy is high but not perfect, so some words might be wrong – the user can later edit if needed (see next feature).

2. Transcript Editing & Annotation:
Feature: Users can edit the transcript text in the app. This is like a lightweight text editor on the transcript. They can correct any transcription errors, redact sensitive info, or annotate sections. Edits do not change the original video/audio, just the text.
Rationale: No transcription is 100% perfect, especially with domain-specific terms or names. Allowing edits means the user can ensure the transcript’s accuracy and usefulness. Annotations (like adding a comment or highlighting an important sentence) can help later when generating the doc or for readers of the transcript. Essentially, it gives some control back to the user to refine the AI output.
Expected Behavior: Once the transcript is available, in the recording detail page the user can click into the transcript text and type to change it (inline editing). We might implement this with a rich text component. Edits are autosaved (or saved with a button). Perhaps a “Mark as final” toggle to indicate they’ve reviewed it. If the user changes wording significantly, we don’t re-run the AI processing automatically (to avoid confusion), but we might prompt “If you edited a lot, consider regenerating the summary doc.” The user can also highlight text and leave a comment (if we support comments) or mark a segment as important for their own reference.

3. Timestamp Alignment and Playback Sync:
Feature: The transcript is time-aligned with the video. Each sentence or word knows the timestamp in the video. This allows features like: clicking a transcript line jumps the video, and as the video plays, the current spoken text is highlighted in the transcript.
Rationale: This improves user experience for consuming the content. Someone might prefer reading but want to hear a certain part – they can click the text to play that segment. Or as they watch the video, they can follow along in text (useful if audio quality isn’t perfect or for accessibility). It also helps the AI assistant later to reference “at 5:32, the user explained X”.
Expected Behavior: The transcription service we use (like Whisper) may provide word-level or sentence-level timestamps. We store these. In the frontend, we use them to map video currentTime to transcript position. The user sees a subtle highlight following along the transcript. They can scroll through text and double-click a sentence to play from there. This requires a bit of UI synchronization logic. For editing, if the user edits text, we might maintain the original timings for reference (unless re-aligned later).

4. Multi-language Support:
Feature: The transcription supports multiple languages (e.g., if the expert speaks in Spanish or French, we can still transcribe, possibly auto-detected or by user selection).
Rationale: Many teams are multilingual. Supporting at least major languages out-of-the-box broadens our market and makes the tool useful in non-English contexts. Even if our UI is English-only initially, the content captured can be other languages.
Expected Behavior: Ideally the transcription API auto-detects language. If not, we might let the user specify the spoken language before recording or before transcription. The rest of the flow remains the same. The generated document and AI assistant would then operate in that language for that piece of content. (We’d have to prompt the LLM accordingly to output in the content’s language). We expect initial use mostly in English, but this feature ensures we’re not hardwired to English transcripts.

5. Speaker Identification (if needed):
Feature: (If multiple speakers present) Identify speakers in the transcript (e.g., Speaker 1 vs Speaker 2), such as if an expert and a colleague were both speaking in a recorded Zoom call.
Rationale: If our use-case expands to recording meetings or interviews, distinguishing speakers is important for readability. It might not be heavily used in single-expert monologue scenarios, but it’s a nice capability if two voices are present.
Expected Behavior: The transcript service might label speakers if it has that feature (some APIs do). Otherwise, we likely won’t implement this in early version. If implemented, the transcript would show e.g. “Alice: … Bob: …” for different voices. The user could also edit these labels (because detection isn’t always accurate). This feature is lower priority unless we see users recording dialogues often.

Transcription features ensure that once the video is recorded, we have a text version that’s accurate and user-refined. The rationale behind each is to maximize the utility of the transcript: it should be correct, easy to navigate, and ready for the next steps (document generation and search).

Document Generation (“Docify”) Features

1. Automated Structured Document Creation:
Feature: After transcription (and optionally after user edits), the system automatically generates a structured document from the transcript. This can be a Markdown or HTML document with sections, headings, bullet points, code blocks (if code was mentioned), and other formatting to make it readable and structured.
Rationale: A raw transcript is often a verbatim dump – hard to read and not well-organized. The goal of “Docify” is to turn that into something resembling a user manual, guide, or article that captures the essence of what was taught in the video. This saves huge time for the expert, who would otherwise have to manually write documentation. It also makes the content more consumable for others (someone can read the summary doc instead of watching a long video).
Expected Behavior: Once the transcript is ready, the user sees a status like “Generating document…”. We prompt an LLM in the backend with the transcript (or segmented parts of it) to create an organized doc. The result is stored and displayed perhaps alongside the transcript. For example, if the expert recorded a how-to on configuring a server, the structured doc might come out with an introduction, a list of steps, code blocks for commands said, and a conclusion. The user can open the “Document” tab on the recording page and see this formatted output. The first version is fully AI-generated.

2. Document Editing & Versioning:
Feature: Users can edit the generated document to refine or add missing details. The document is stored so that further changes by the AI won’t override user edits without consent. Potentially, we keep versions (initial AI version, and then user’s edits as the current version).
Rationale: The AI does heavy lifting, but the expert might want to tweak phrasing, fix any mistakes the AI made, or add extra context. Editing capability ensures the final document can meet high standards of accuracy and style that the organization may require. Versioning is important so that if the user regenerates the doc later (say after editing transcript or after an improved model), we don’t silently lose their manual edits.
Expected Behavior: In the UI, the doc appears as rich text (or Markdown editor). The user can click “Edit” which turns it into an editable area. They can make changes (formatting toolbar for basic styles, or directly editing Markdown). We might auto-save changes or have a save button. The system could highlight which parts were AI-generated vs edited by the user for clarity. If we support version history, a user could revert to the AI original or see changes. Likely we start simpler: one editable version that once edited, is considered the source of truth unless the user deliberately regenerates.

3. Regeneration Options (Docify):
Feature: The user can trigger regenerating the document. Options might include “Regenerate full document” (which reruns the AI on the latest transcript) or future enhancements like “Summarize to X length” or “Focus on bullet points”.
Rationale: AI generation might not get it perfect on first try, or the user may update the transcript and want a new doc reflecting changes. They might also want different formats (maybe one version as a quick summary, another as a detailed guide). Providing regeneration allows for iteration. It’s also a way to incorporate improvements (if our prompts or model improve later, the user can re-run to get a better structured doc).
Expected Behavior: A “Regenerate Document” button is present near the doc. Possibly a dropdown with options like “Regenerate (overwrite)” or “Generate new version”. If clicked, we warn if it will overwrite their edits. Perhaps we let them generate a second version for comparison. The user waits a short time as the AI runs again. The new output is then displayed. If we see common desires (like “make it more concise” or “include code examples”), we could add toggles or prompt enhancements for those, but initially it’s just a re-run of the same process.

4. Document Templates (Future):
Feature: (Planned) Ability to choose a style or template for the document. For example: “Tutorial style” vs “Summary memo” vs “Slide deck outline”. This would guide the AI generation to different formats.
Rationale: Different use cases might want the output in different forms. One might want a step-by-step tutorial, another might want a one-page executive summary of a talk. By allowing template choices, we cater to more needs and make the feature more flexible. This is a future idea once we have baseline doc generation working reliably.
Expected Behavior: The user might see a dropdown or set of buttons before generation like “Generate as: [Guide/Documentation] [Summary] [Q&A Handbook]”. Selecting one changes the prompt for the AI. The output is then tailored. The user can regenerate with different templates to see which they prefer. For initial version, we likely default to a general guide format.

5. Publishing/Exporting Documents:
Feature: Users can export or share the structured document. Export formats might include PDF, Word, or a Markdown download. We may also have a “Publish to knowledge base” toggle that makes the doc accessible via a public (or internal) URL.
Rationale: Once the doc is created and edited, it becomes a valuable knowledge asset. Users will want to share it – maybe put it on an internal wiki, send to a colleague, or include in a report. Exporting makes our product’s output portable (not locking content inside). Publishing internally (within the app) with a link allows quick sharing without the friction of copy-paste.
Expected Behavior: On the doc page, options like “Download Markdown” or “Export PDF” will be available. We’ll use a Markdown-to-PDF library or similar for that. For publishing, if enabled, we generate a unique URL (maybe our site has a /pub/doc/<id> route) that anyone with the link can view (read-only). The user can send this link to others. They can also revoke/unpublish if needed. This essentially turns the doc into a mini web page, possibly including the video or transcript if we choose. If we support public publish, we’ll ensure the user understands what data becomes public (maybe limit to within org or password-protect initially). This drives adoption too – recipients of the shared content may become interested in the platform.

The document generation features are aimed at maximizing the usefulness of the captured knowledge. The rationale is always that the expert’s effort of recording should multiply into various forms of knowledge with minimal additional work. We want the structured docs to be as good as something a human would author given the transcript, and give the user control to refine it. Over time, these docs can form a knowledge repository for the team.

Vector Search & AI Assistant Features

1. Semantic Search (Vector Search):
Feature: Users can search their content semantically by asking questions or entering keywords in natural language. The system will find relevant parts of any transcript or document, even if the exact keywords differ. This is powered by vector similarity matching of embeddings.
Rationale: Traditional keyword search is limited – users might not recall exact phrasing used in a video. Semantic search understands the query’s meaning and finds related information in the transcripts/docs. This is crucial because it transforms the collection of videos/documents into a queryable knowledge base. It addresses the core pain: “Somewhere in all these recordings, the answer exists – how do I find it quickly?”
Expected Behavior: In the dashboard or a dedicated “Assistant” page, there’s a search bar or chat box. If the user types a query like “How do I reset the database connection?”, the system will:
	•	Convert the query to an embedding,
	•	Search the vector index for the closest matches (limited to that user’s/org’s data).
	•	Return a list of results: possibly specific segments of transcripts or docs that are relevant. We might show a snippet of the text and which recording it’s from, with a link.
For a better UX, this is integrated with the AI Q&A (next feature), but even a direct search result list is useful. The expected result is that even if the transcript said “restart the DB connection pool” and user asked “reset database connection”, the semantic search can match those as similar concepts.

2. AI Q&A Assistant (Chatbot):
Feature: A conversational assistant that can answer questions by drawing from the recorded knowledge. The user interacts in a chat interface, asking something like “What steps did Jane mention for configuring the firewall?” The AI then finds relevant context from the transcripts/docs and formulates an answer, often with references (like “According to Jane’s recording on Network Setup, the steps are X, Y”).
Rationale: This is a marquee feature that makes the knowledge easily accessible to non-recorders. Team members who didn’t watch a video can still ask questions and get answers as if they consulted the expert. It leverages the combination of transcripts + vector search + LLM to provide a natural, quick way to get information. This drives value for consumers of the content, not just the creators.
Expected Behavior: The assistant is available in a chat UI (perhaps on its own page or as a sidebar in the recording detail page for context-specific Q&A). The user asks a question in text. The backend uses a retrieval augmented generation approach:
	•	It vector-searches the query against our embeddings (filtering to the current org’s data).
	•	It takes the top relevant excerpts (maybe sentences or paragraphs from transcripts/docs).
	•	It feeds those, along with the question, into an LLM (OpenAI GPT-4/3.5) to get a composed answer.
	•	The answer is then streamed to the UI (token by token, for a nice experience). The answer might say, “To configure the firewall, you need to open the settings, go to Security > Firewall, then add a new rule…” with a citation or reference to the source video/doc (which we can hyperlink).
The user can then ask a follow-up question, and the assistant will keep the context (we may maintain a short dialogue memory plus always refer back to the knowledge base for each query). The chat feels like talking to a knowledgeable colleague who has watched all the videos.

3. Contextual Assistant (within Recording):
Feature: When viewing a specific recording’s page, the AI assistant can answer questions scoped to that recording. For example, on a video page, a user might ask “What were the key takeaways here?” and the assistant will summarize or answer based only on that video’s content.
Rationale: Sometimes a user is consuming one piece of content and wants a quick clarification or summary without searching the whole org database. A context-limited assistant improves the experience of that single recording. It’s like an AI that you can ask “explain this differently” or “what did they mean by X in this video?”
Expected Behavior: On the recording detail page, we might have a Q&A box pre-loaded with that recording’s context. The system knows to filter vector search to that recording or even just use the transcript directly for answers. If a user asks a question, the assistant can even quote the transcript from earlier in the video. We expect this to be used for clarifications (“When in the video did they mention database? – Answer: around 12:45 mark, they said ‘…’”) or summarization (“Summarize this video – Answer: [summary]”). This is basically the same mechanism as global assistant but with a filter = current recording only, and possibly some UX cues that it’s in “local mode”.

4. Multi-Document Query (Cross-video):
Feature: The assistant can combine information from multiple recordings/documents to answer a question.
Rationale: Often knowledge is distributed. One video might cover A, another B, but a question might need both. Our AI should be able to retrieve bits from multiple sources. E.g., “How do I set up the database and connect it to the server?” – maybe one recording was about database setup, another about server config. The assistant should pull from both to give a complete answer.
Expected Behavior: When the user asks a broad question in the global assistant, the vector search likely returns top snippets that could be from different recordings. The LLM will see all those and try to synthesize. We should present the answer with references to each source snippet (e.g., “From Database Setup video: …; and in Server Config doc: …”). The user might get an answer that merges knowledge, which is powerful. We have to ensure the context we give the LLM isn’t too large (so we might limit to top 3-5 relevant chunks for now). If needed, user can clarify or follow up.

5. Filters and Namespace Isolation:
Feature: Users (especially org admins) can restrict searches to certain subsets of content using filters. For instance, filter by tag or by a specific project. Additionally, each organization’s data is isolated – the assistant will never use data from another org.
Rationale: Privacy and relevance: We must guarantee that one company’s query doesn’t leak answers from another’s data. That’s handled by namespace isolation at the database level and in any vector index (each org is a separate namespace). Filters allow the user more control, e.g., “Search only in Finance videos” if they categorize content. This can improve result precision especially as the knowledge base grows.
Expected Behavior: By default, the assistant implicitly filters to the current organization (we include org_id in every query to the vector DB). If we use Pinecone later, we use separate Pinecone namespaces or metadata like org_id to ensure isolation. The user might see an UI element to refine search scope: maybe a dropdown of tags or a checkbox “This folder only”. Implementing tagging/categorization might be a later feature, but we design the search to handle a filter parameter. The assistant should respect it (only pass vectors from allowed set). In a multi-org scenario, if the user switches org context, the assistant context switches too (e.g., only that org’s data is loaded). Essentially, each org’s data is siloed by design.

6. Proactive Suggestions:
Feature: (Future idea) The assistant can proactively suggest answers or content as the user types a query (auto-complete with knowledge) or highlight new content (“You have a new recording about X, ask me about it!”).
Rationale: This isn’t core, but could enhance UX by making the system feel intelligent and helpful. For instance, if a user just uploaded a video about “Onboarding process”, when they go to the assistant, it might suggest “New: Onboarding process – ask me something like ‘How do I create a new account?’” This drives engagement with the new content. Auto-complete could help formulate better queries or discover terminology that exists in the content.
Expected Behavior: We would need to gather frequent queries or use an index of terms from transcripts to implement suggestions. This is down the line. Initially, we might simply show recent recordings or popular questions on the assistant page as static suggestions.

The vector search and assistant features are all about unlocking the knowledge captured in recordings and documents. The rationale is to enable users (especially those who didn’t create the content) to get answers quickly without wading through hours of video. It turns our platform from just a repository of info into an active knowledge provider. By grouping these features, we see that we need robust backend support (vector indexes, isolation by org, integration with LLMs) and a smooth UI for asking questions and viewing answers.

Collaboration & Organization Features

1. Multi-Organization (Tenant) Support:
Feature: The platform supports multiple organizations, meaning a user can belong to one or more org workspaces. Each organization has its own separate set of recordings, docs, and members. Users can switch between orgs if they belong to several (e.g., a contractor might work with two companies, each with their own knowledge base).
Rationale: This is crucial for B2B SaaS – each customer (company/team) gets a private space. It ensures data separation (security) and also reflects real-world use: companies don’t want their data mingled. For our internal use, it also allows development/test orgs separate from live. Clerk’s organization feature gives us much of this out-of-the-box.
Expected Behavior: When a user signs up, they might create an organization (e.g., “Acme Corp”) or join an existing one via an invite. In the UI, if a user has access to multiple orgs, a selector (perhaps a dropdown with org name) is available in the header. Switching orgs changes all the content to that context (the URL might even include an org slug if we implement that, e.g., acme.app.com or /org/acme/…). Each org has its own admin(s) who can manage membership. We store org_id with every relevant record to enforce backend isolation. The user’s role in the org (admin or member) dictates what they can do (see roles below).

2. Roles and Permissions:
Feature: Role-based access control within an organization. At minimum, roles like Admin and Member exist. Admins can invite/remove users, change settings, and access all recordings. Members (non-admin) can create recordings and view the org’s recordings, but maybe cannot delete others’ content or manage the team. Possibly a Viewer role could be considered (view content but not create).
Rationale: Not all users are equal in a team setting. We want to prevent accidents (only admins delete or publish content globally) and support enterprise needs (maybe only certain people can manage billing). Clerk Organizations come with a default role set which we can use or extend. This ensures security (e.g., a member shouldn’t access billing or remove someone).
Expected Behavior: The system likely uses Clerk’s org roles: e.g., “basic_member” vs “admin” (Clerk allows custom role names). In the UI, admin-only features (like the Settings -> Organization page, or deleting a recording not your own) are only shown if your role is admin. On the backend, any admin-level action double-checks the user’s role. We might also restrict some features in future (like perhaps only an admin can publish a document publicly). Invitations by admin default new users to member role. If needed, roles can be changed in an org settings screen.

3. Collaboration on Content:
Feature: Multiple users in the same org can collaborate on the knowledge. This includes:
	•	Viewing each other’s recordings and documents (by default, all content in an org is shared with all members, unless marked private).
	•	Possibly co-editing or commenting on transcripts/docs.
	•	Leaving comments or questions on a recording (outside of the AI assistant context, a manual comment feature).
Rationale: Since this is aimed at teams, the content created by one expert should benefit others. Collaboration features ensure knowledge flows. Commenting is useful if a viewer has a question or suggestion – it’s like adding human feedback separate from the AI. Co-editing might be useful if, say, an assistant wants to clean up the boss’s transcript for them.
Expected Behavior: By default, when Alice in org Acme records something, Bob (also in Acme) can see it on the dashboard. He can click it, watch, read transcript, etc. If Bob has a question, he could either use the AI assistant or leave a comment that Alice gets notified about (“What did you mean by step 3 here?”). For editing, if we allow it, maybe admins can edit any doc to polish it (with a history of who changed what ideally). Comments would appear in a sidebar or inline, tagged with user and timestamp. This is akin to Google Docs comments or YouTube video comments at timestamps. It’s a complex feature so maybe not in MVP, but conceptually we plan to support team collaboration in refining content.

4. Sharing Outside Organization:
Feature: Ability to share content with people outside the org. This could be a public share link for a document or a video, with optional password protection. Or an “external user” concept where you invite someone to view a specific item (without full org access).
Rationale: Sometimes an expert’s recording might be useful to clients or a broader community. While our focus is internal knowledge, enabling controlled external sharing increases flexibility. It could also serve as a marketing vector (a public doc might show “Created by DocuVision” branding, attracting new users).
Expected Behavior: On a recording or doc, an owner or admin could toggle “Share publicly” which creates a unique URL. Anyone with that URL can view the document (and maybe play the video) but not see any other content. They won’t have access to the AI assistant unless we allow a limited Q&A on that single content (interesting idea but complicated licensing wise if they aren’t a user). For more controlled sharing, we might allow adding a specific user by email with view-only rights to a particular item (which would send them an invite link). Initially, likely just a simple public link with a disclaimer “Anyone with link can view – use for external sharing carefully.” When active, maybe show a badge “Public” on that item. The system logs or counts public views so we know usage.

5. Notifications:
Feature: Notify users about relevant events, e.g., “Your transcription is complete”, “John uploaded a new recording: ‘Onboarding 101’”, “Jane commented on ‘Server Setup’”. Notifications can be in-app (badge or notification center) and optionally email.
Rationale: Keeps users engaged and informed. If a process finishes (transcription/doc ready), the user should know without constantly checking. Team members might want to know when new knowledge is added. Comments or mentions require notifying the involved users to prompt a response. Timely notifications improve collaboration and make the app feel responsive.
Expected Behavior: We’ll implement a lightweight notification system. For example, when a pipeline finishes generating a doc, we create a notification in our DB for the owner. If they’re online, maybe a toast popup says “Document ready to view”. If not, an email could be sent saying “Your recording ‘XYZ’ has been processed – click here to view the results.” For team events, perhaps a daily or weekly summary email might be less intrusive (“5 new recordings were added in your org this week”). In-app, an icon (bell) could show unread notifications. Users can adjust what they get notified about via settings (especially for emails). We may utilize Clerk’s built-in notification support if available, or implement our own via a background job sending through an email API.

6. Billing & Usage (Admin Feature):
Feature: Organization admins can view usage stats (minutes of video transcribed, number of docs, AI query count) and manage their subscription (upgrade/downgrade, payment info) via a Billing page.
Rationale: Although not a direct “product feature” for end users, this is important for transparency and for upselling. Admins should know if they are nearing limits (if any) and have a one-click way to handle billing. This is part of product polish that reduces friction in the purchasing process.
Expected Behavior: In settings, Billing section shows current plan, what that plan includes (e.g., “Up to 5 hours of video per month, 100 AI queries/day”) and current usage (“This month: 4h video, 80 queries”). If they are near or over limits, it could highlight that. A “Manage Subscription” button likely redirects to Stripe Customer Portal for self-service (update card, change plan, etc.). We handle provisioning via Stripe webhooks to update the plan in our DB. This feature ensures no surprises and gives control to the paying customer (the admin).

Each of these collaboration and org features is about making the product fit in a team/enterprise environment. The rationale is to move from a single-user tool to a multi-user knowledge hub. Users should feel it’s a shared space where knowledge is contributed and utilized together, under proper access controls. For engineers, these features imply additional considerations like permission checks in API routes (see authentication.md and api-spec.md for enforcement), and designing the data model for multi-tenancy (see database-schema.md).

In summary, our product features span from capturing information (recordings) to processing it (transcripts, docs) to retrieving it (search/assistant) and finally to enabling a team to effectively use it together (collaboration, sharing). The rationale behind this comprehensive feature set is to create a knowledge loop: capture tacit knowledge easily and turn it into explicit knowledge that can be disseminated and queried. We expect users to primarily record and consume content, while the AI/automation fills the gap of organizing and extracting value from that content. Over time, we will refine each feature based on feedback, but this outline serves as a blueprint for what the product does and why each part matters.

---

## Phase 5. Implementation Pipelines and DevOps

**Goals**
- Establish reliable CI/CD.  
- Add automated quality gates and environment promotion.  

**Inputs**
- Implementation Pipelines
- Repository Structure
- Coding Standards

**Tasks**
- CI jobs for lint, type check, unit and integration tests.  
- Build and publish artifacts or Docker images.  
- Preview deployments on branches.  
- Staging and production deploy jobs with approvals.  
- Secrets management for CI runners.  
- Backup, restore, and migration playbooks.  

> Reference: Implementation Pipelines  
Implementation Pipelines (Async Workflows)

This document describes the end-to-end asynchronous workflows that power the app’s core functionality. The main pipeline stages are: Video Ingestion → Transcription → Document Generation → Vector Embedding → Publication. Each of these stages may be handled by background jobs or external services, with triggers connecting them. We detail how each stage is implemented, how data flows, and how we ensure reliability (retries, error handling) and scalability in these pipelines.

The pipelines are largely asynchronous to provide a smooth user experience (the user doesn’t wait on a long process in a blocking manner) and to leverage specialized services (like transcription AI) that work outside our request/response cycle.

1. Video Ingestion Pipeline

Trigger: User finishes a recording in the browser and initiates upload.

Process:
	•	The recording is captured as a media file (e.g., webm or mp4) in the browser. We then upload it to our storage.
	•	Uploading Strategy: We use chunked upload with a pre-signed URL or API:
	•	The client requests an upload URL from our backend: e.g., a POST to /api/upload-url with the file metadata (name, size, content type). The server (if using S3) calls S3 to get a pre-signed URL (or multipart upload URLs if large). If using Supabase storage, the client might directly use the Supabase JS client to upload in chunks (Supabase supports resumable uploads).
	•	The client streams or uploads the file in parts. With the MediaRecorder, we can even upload on-the-fly as it records (e.g., every few seconds) for very large or long recordings. However, in MVP, simpler is: record to a Blob, then upload that Blob once the user stops recording.
	•	We show an upload progress bar. If the upload fails mid-way, the client can retry or resume if supported (with resumable upload protocol). Using Supabase’s resumable feature (which is based on chunking and can resume) or S3 multipart gives reliability.
	•	Database Entry: As soon as the user stops recording, we create a recordings row in the DB with status ‘uploaded’ (or ‘uploading’). We include metadata like user_id, org_id, and maybe an initial title (e.g., “Recording on 2025-10-06”). The video_url or storage path is filled after upload completes (or pre-determined if we know it).
	•	Once the file upload finishes, the client notifies the server (perhaps implicitly by finalizing the multipart upload or explicitly with a request). For example, after S3 multipart complete, our client might call /api/recordings/complete to indicate success.
	•	Post-Upload Acknowledgment: At this point, we update the recording’s status to ‘uploaded’ (if it isn’t already). The user might be redirected to a “Processing…” page for that recording, or the detail page with a notice that transcription is underway.

Outcome: The video file is safely stored and we have a DB record for it. This triggers the next pipeline stage (transcription).

Reliability & Scalability:
	•	We handle large files by chunking. For example, using a 10MB chunk size for multi-GB videos.
	•	The pipeline doesn’t hold the file in memory server-side; upload goes to storage directly or via a streaming endpoint.
	•	In case of failure: If upload fails, the client can retry. If the user closes the browser mid-upload, we can have logic to resume when they come back (if using a resumable protocol with an upload ID).
	•	We could use an AWS Lambda trigger or Supabase Storage webhook to detect when a file is fully uploaded to start the next step automatically. Alternatively, our explicit “complete” call triggers transcription.
	•	We ensure unique file naming (using recording_id as part of the path, e.g., org-<id>/recordings/<recording_id>.webm) to avoid conflicts and to allow direct retrieval if needed.

2. Transcription Pipeline

Trigger: A recording upload is completed (detected either by the completion API call or a storage event).

Process:
	•	We change the recordings.status to ‘transcribing’. This can be done by the API route handling the completion trigger.
	•	The server (or a background worker) now initiates transcription. Two approaches:
	1.	Via API (async): Use an external transcription service (like AssemblyAI, Deepgram, or OpenAI Whisper API). Typically, you send either the file content or a URL to the service. Because our file is in cloud storage, we can often provide a signed URL to the service. For example, with AssemblyAI, we send a POST with { audio_url: "https://...signedURL..." } and they process in the background, calling a webhook when done. We prefer this asynchronous mode to avoid holding a connection open.
	2.	Self-managed (sync or async): If using OpenAI Whisper API, it’s a direct HTTP call with the file (max ~25MB). For larger, we’d need to chunk audio or use a different method. Or we could run our own Whisper model on a server with GPU for longer audio. That requires a job queue and compute resource.
	•	Given our architecture, we likely use a service with callback. So we will:
	•	Register a webhook endpoint (e.g., /api/webhook/transcription) with the service.
	•	Start transcription via their API, including the callback URL.
	•	Store a job reference (e.g., service-specific ID) in a jobs table or in memory for tracking.
	•	Our transcripts table may already have a placeholder row or we create it upon completion. We likely wait until done to insert transcript.
	•	Webhook Handling: When transcription is done, the service calls our webhook with results:
	•	The webhook endpoint (a Next.js API route or serverless function) receives a payload containing the transcript text and possibly word timings.
	•	We verify the source (e.g., check a token if provided to ensure it’s the transcription service).
	•	We then insert into transcripts table: the full text, language, and maybe structured data if provided (some services give a JSON of words or paragraphs with timestamps). We mark transcribed_at.
	•	Update recordings.status to ‘transcribed’.
	•	Possibly update recordings.completed_at if we consider transcription alone as completion. But since we have more steps (doc, embedding), we might not mark fully complete yet; we may leave it at ‘transcribed’ until doc is done.
	•	If instead we did transcription synchronously (e.g., small file with OpenAI direct call):
	•	Our background job (or API call if risk of short length) gets the text response immediately or within some seconds.
	•	We then do the same DB updates directly.
	•	This is simpler but doesn’t scale to long videos; asynchronous external is safer for long ones.
	•	User Notification: Once transcription is done, if the user is on the recording’s page, we can push a real-time update (maybe via websockets or polling). If not, we can send an email or show a notification next time they log in: “Your recording ‘X’ has been transcribed.”

Outcome: We have the raw text of what was said in the video stored and associated with the recording.

Reliability & Scalability:
	•	We decouple user requests from this heavy task by using background jobs/webhooks. So even if transcription takes 5-10 minutes, it doesn’t tie up any server instance in the meantime.
	•	We should implement retries for webhook delivery or processing: e.g., if our webhook is down when service calls, the service might retry (AssemblyAI does a few retries). Or if our process fails to save, we might recover via a dashboard of failed jobs.
	•	If using our own job runner, we should have a queue (like Redis + bullMQ) with retry logic (X attempts with exponential backoff) for transcribing using an external API (in case API call fails due to rate limit or transient error).
	•	For multiple simultaneous transcriptions, external services handle scaling on their side (we just pay for usage). If self-hosting, we’d need a worker per concurrency or an autoscaling setup (likely not MVP).
	•	We must secure the media: the signed URL for audio should have limited lifetime and scope. And the webhook should be protected (check some signature or include a secret).
	•	If an error happens (e.g., transcription API fails, perhaps due to unsupported file or too long):
	•	We update recordings.status to ‘error’ and log the error message.
	•	Notify user that transcription failed (and perhaps they can retry via a button after addressing issue or using a different method).
	•	We might implement fallback: e.g., if OpenAI Whisper API fails due to length, maybe try AssemblyAI, or vice versa. But initial approach likely sticks to one service.

3. Document Generation Pipeline

Trigger: Transcription is completed (and stored). This could be initiated within the same webhook handler or by a separate job trigger.

Process:
	•	Set recordings.status to ‘doc_generating’.
	•	AI Generation: We prepare a prompt for an LLM to convert transcript to a structured doc. For instance, a system/user prompt combination: “You are an assistant that turns transcripts into documentation. The transcript: ... Now produce a well-formatted Markdown…”. We include guidelines like “Use headings, lists, code blocks as appropriate. Preserve important details.” We may also include context like the recording title or any user-provided notes about the intended audience.
	•	We decide on a model (e.g., GPT-4 or GPT-3.5 via OpenAI API).
	•	If using GPT-4 and the transcript is very long, we might need to chunk the prompt (maybe process it section by section then combine) or use a summarization first. Possibly GPT-4 32k context could handle ~1 hour of speech (~15k tokens)? It’s borderline but maybe.
	•	We may start with GPT-3.5 (4k context) and if transcript doesn’t fit, break into parts: e.g., split transcript by sections (maybe at our bookmarks or into ~3000 token chunks), have the AI summarize each or create partial docs, then have another prompt to merge those into one doc. This is complex; perhaps easier: if too large, we instruct the model to focus on the most important points (losing some detail).
	•	Implementation: We likely create a background job for doc generation:
	•	The job fetches the transcript from DB.
	•	Calls OpenAI API with the prompt. We use stream mode or normal; since this is not user-facing directly (only outcome used later), normal is fine. But we should handle it might take many seconds.
	•	Get the response text (the Markdown doc).
	•	Insert into documents table: the content, summary if we also asked for one, generation time, model used.
	•	Update recordings.status to ‘completed’ (meaning fully processed).
	•	After document is saved, we notify the user (in-app notification or email: “Your document for recording X is ready”).
	•	Perhaps also generate a very brief summary for quick preview or SEO if needed (we can either take first paragraph or explicitly ask LLM for a 1-2 sentence summary and store in documents.summary).

Outcome: The structured documentation is now stored and accessible. The recording’s processing pipeline is essentially done from the system perspective.

Reliability & Scalability:
	•	The LLM call might fail (due to network, rate limit, or content issues). We should:
	•	Use retries with backoff (OpenAI recommends handling server errors by retrying after short wait).
	•	If it fails after retries, mark job failed (recordings.status = ‘error’, error_message in our jobs or recording).
	•	Possibly try a smaller model if bigger fails due to capacity.
	•	For cost management, perhaps default to GPT-3.5, and maybe allow user to manually request a GPT-4 regen if they want higher quality (depending on plan).
	•	We should be mindful of token limits:
	•	If transcript is huge, one approach: skip doc generation for extremely large transcripts in one go and either require user to manually chunk, or implement a more complex strategy as above. We can also arbitrarily truncate transcript input to fit into e.g. 12k tokens for GPT-4 (losing some detail, but better something than failing).
	•	Logging: maybe log the size and model used for each doc gen for future optimizations.
	•	Running multiple doc generations concurrently: since these are external API calls, concurrency is mainly limited by API and cost. We can safely run a few in parallel; if high load, maybe queue them.
	•	If we have a job queue (like Redis), we can have a certain number of workers handling LLM calls to avoid spamming the API.
	•	If the LLM returns content that violates some policy (maybe it mis-summarized or included something weird), user will have the chance to edit it, so it’s fine. We just store what we got.
	•	We might implement a safeguard: e.g., if doc is significantly short (maybe something went wrong and it produced only a few lines for a long transcript), we could mark that as suspect and allow a regen. But that might be overkill for now.
	•	Security note: We send potentially sensitive transcript data to OpenAI. We should ensure our terms and perhaps an option for user to opt out or use a self-hosted model if needed. But early on, assume it’s acceptable or at least documented.

4. Vector Embedding Pipeline

Trigger: Document generation is done (or even transcription done, depending if we embed transcript or doc or both).

Process:
	•	We decide what text to embed for semantic search. Likely, we embed the transcript (because it’s raw and complete). We could also embed the document, but it might be more summarized. Perhaps better to embed transcript segments for recall, and use the doc mainly for reading. We might do both or either.
	•	Chunking: We split the transcript into chunks suitable for embedding:
	•	A common approach: break by paragraph or ~500 tokens segments, ensuring coherence. Possibly we use the punctuation and timestamps to chunk by topics or time blocks (~30 seconds of speech per chunk).
	•	Alternatively, after doc creation, the doc could have clearer sections; we might embed those sections (like each top-level section of doc). But then search might miss details omitted in doc.
	•	For now, we can embed transcript paragraphs. Our transcripts might not have explicit breaks. We could insert breaks at speaker changes or when a pause is long (if we had that data). Simpler: fixed-size sliding window: e.g., every 200 words or so, overlapping slightly (maybe 50% overlap to not miss context).
	•	For each chunk:
	•	We create an entry in transcript_chunks with recording_id, org_id, text (the chunk text).
	•	We call embedding API (OpenAI’s text-embedding-ada-002) with that chunk text. It’s fast (~less than a second typically).
	•	We get a 1536-d vector and store it in the embedding column.
	•	We also record the chunk index or start time metadata so that if a search result refers to chunk 3, we can map it to roughly a portion of the transcript. If times available, store start time in metadata to allow seeking video later.
	•	This can be done synchronously in code after doc gen, or as a separate job. Since embedding is relatively quick, and we likely need results soon for search, doing it immediately after doc is fine. But to isolate concerns, we might fire a separate job (especially if we plan to switch to Pinecone later, we might have a dedicated sync process).
	•	If using Pinecone or another vector DB later:
	•	For now, we do Postgres. If Pinecone, we’d batch upsert the vectors to Pinecone index with metadata (org, recording_id, chunk_id).
	•	The pipeline difference is minor; it’s just calling Pinecone’s API instead of inserting into PG. We would still keep a local record for reference or for backup maybe.
	•	Update status: Once embedding is done for all chunks, that recording is fully processed. If not already ‘completed’, set recordings.status = 'completed'.
	•	If any error in embedding (rare, maybe API issues or chunk too large for embedding model):
	•	We could attempt to shorten that chunk or skip it (losing a bit of data but not critical).
	•	We log any failures; likely continue with others.

Outcome: The recording’s textual content is now indexed for semantic search. The AI assistant can use these vectors to find relevant pieces.

Reliability & Scalability:
	•	Embedding many chunks: For a 1-hour video, transcript ~10k words maybe, chunk into say 50 chunks of ~200 words. 50 embedding calls is fine. If multiple videos at once, OpenAI’s rate limit might be a concern (we might batch multiple texts in one request as their API supports  up to 2048 tokens per request of multiple inputs).
	•	We could optimize by doing embedding in parallel for different chunks or sequentially. Given each is quick, sequential is okay unless transcripts are huge.
	•	If our volume grows, we might consider doing embedding in batches or on a separate queue to manage rate limits.
	•	Should ensure vector index is updated transactionally with transcripts: We might do it in one transaction or after confirming doc done. If doc fails, maybe still embed transcript so search still works on raw data? Possibly, but if doc fails, likely we mark error and might not embed to avoid partial data. Once user fixes/regenerates doc, we can embed then.
	•	If using Postgres:
	•	We already have pgvector index. We should periodically vacuum and ensure performance. It’s fine for a moderate number of vectors (< millions).
	•	For scale beyond that or better query latency, we plan to move to Pinecone (see vector-strategy.md), which means this pipeline would send data to Pinecone. We’d likely run both in parallel during migration (embedding to PG and Pinecone).
	•	If a new recording is added, only that recording’s embeddings are inserted. Searches will naturally include it. If a recording is deleted, we should delete its chunks (cascade will handle if foreign key).
	•	Multi-tenant: We include org_id in chunk for filtering. In PG, our similarity query will include WHERE org_id = X. In Pinecone, we’ll use namespace per org. So pipeline would specify the namespace = org_id when upserting vectors, ensuring isolation.

5. Publication & Post-processing

This is not a single step but an umbrella for any finishing touches after main pipeline:
	•	We mark things as done and available. The user can now view the transcript and doc in the UI. Possibly, we flip some flag or send an event to the front-end if they’re waiting in real-time.
	•	If the user opted to auto-publish the doc (maybe a setting), and if allowed, we generate a public URL now. That could mean:
	•	Creating a short UUID or slug for the doc and storing it in a public_docs table or in documents (like a share_id).
	•	That way, we can serve that via a public endpoint without auth. That could be done here or later when user actually clicks “share”.
	•	We might create a thumbnail of the video: e.g., take a frame from 10 seconds in. This could be done either in the client before upload (if we had the video blob, capture frame) or on server using FFmpeg. Not critical, but improves UI listing. If we do it server-side:
	•	After video is uploaded, a job could run ffmpeg on the stored file (if we have a server with ffmpeg) to grab a frame and put in storage.
	•	Or we rely on the video element in browser to generate when needed (for dashboard).
	•	Clean up: if we had any temporary files or data, remove them. In our flow, not much temp on serverless unless we downloaded the video for processing (we avoided that by direct links).
	•	Logging/analytics: We log the pipeline completion, perhaps store metrics (duration of each stage, etc.) for monitoring performance and cost.
	•	Set up any links between objects: e.g., now that doc is ready, if we have a search index for docs separate from transcripts, ensure it’s updated. (We currently use transcripts for search, but if including docs, would embed those too now.)
	•	Possibly notify other org members: e.g., “New document published: X” if we want to encourage knowledge dissemination. That could be an email or in-app feed (this could be considered later as part of engagement features).

Error Handling Summary:
	•	Each stage (upload, transcription, doc gen, embedding) has its own error handling and does not block the others unnecessarily.
	•	If transcription fails, we cannot proceed to doc or embedding. So that recording stops with error. The user might be given an option to retry transcription (maybe use a different method).
	•	If doc gen fails, we could still allow search on transcript because that’s available. But we mark error so user knows doc isn’t ready. They might retry doc gen. Our system could allow a manual “Regenerate document” which re-triggers that stage (keeping transcript and embeddings).
	•	If embedding fails for some reason, the user can still read the doc; only search/chat is affected. We could mark a non-critical error and maybe schedule a retry in background later without bothering the user, because they might not notice missing embeddings until they search. Alternatively, notify admin that search indexing failed for that recording.
	•	We plan to surface errors in the UI on the recording card, e.g., a warning icon with tooltip “Transcription failed, click to retry.”

Workflow Orchestration:
	•	We currently envision a somewhat linear chain with webhooks:
	•	Upload complete -> call transcription service -> callback -> call doc generation -> then embedding.
	•	We can implement it as:
	•	A single queue system where one job type leads to enqueueing the next job type. E.g., a job transcribe(recording_id) on completion enqueues generate_doc(recording_id), then that enqueues embed(recording_id).
	•	Or event-driven: update of DB status triggers next via a listener. If using Supabase, could use database triggers or functions (but probably easier to manage in app code).
	•	For clarity, likely manage in code: The transcription webhook itself, after saving transcript, can directly call a function to start doc generation (synchronously, which might be too slow to do in the webhook response; better to enqueue it).
	•	Perhaps better: The transcription webhook just updates DB and status. We have a background worker polling or listening for recordings in ‘transcribed’ status and then processes doc gen. (If using Supabase, could use their realtime or cron triggers to pick those up.)
	•	For MVP, a simpler approach: Kick off doc gen from webhook right away (fire-and-forget an async function, respond 200 to webhook while doc gen runs). In Node, we can do that by not awaiting the OpenAI call, but we must be careful with serverless as it might cut off execution after sending response (some platforms do). Alternatively, have the webhook call a separate job via an API or queue.
	•	Because of the complexity of orchestration, an alternate architecture: use a managed workflow service or message queue:
	•	E.g., AWS Step Functions could orchestrate: on S3 upload -> transcribe (maybe with AWS Transcribe) -> when done -> Lambda to generate doc -> etc. But that ties to AWS infra.
	•	Or simpler: an in-app queue library as mentioned. Given time, a lightweight solution might be to use the database as a queue: a jobs table where each job has type and status and a worker polling it. But on serverless (Vercel), we don’t have a always-on process to poll. Might need an external worker or use something like temporal.
	•	Perhaps the easiest: rely on external triggers as much as possible:
	•	Transcription service calls us.
	•	We call OpenAI for doc (this we have to do).
	•	For now, do that in the same request to keep it simple (if transcripts are small).
	•	If worried about timeouts (like doc generation might take 30s, maybe okay on serverless if within limits, often 10-30s?), if it might exceed, then need background approach.
	•	Vercel Edge Functions run quickly, but Node serverless might allow up to 10s by default, can be extended maybe. If GPT-4 summarizing a huge text, could exceed.
	•	We might break it: webhook returns quickly after starting doc job, and we rely on some scheduled check to finish doc. But that introduces complexity.
	•	Another approach: Offload doc gen to a separate environment (e.g., a small VM or container) that can run longer tasks. That’s more devops heavy but could be needed for robust pipeline.
	•	For MVP, we try to streamline: using GPT-3.5 if possible (faster), likely can finish in a few seconds for moderate text.
	•	We will test with realistic lengths to ensure within serverless time. If not, we consider using something like a background function (like Vercel has background functions with up to 500s execution but they are in beta or for Enterprise).
	•	If not available, we could use a workaround: split doc generation: maybe do half now, half on next request, but that’s messy.

Monitoring & Scaling:
	•	We should monitor pipeline durations and success rates. Logging each step’s start and finish times (maybe in the jobs table or an internal log) helps identify bottlenecks.
	•	For scaling, each pipeline largely fan-out per recording. If 100 recordings are being processed concurrently (like after a big import), external services might throttle. We may queue tasks to avoid hitting rate limits (like only 5 concurrent transcriptions if not handled by service, etc).
	•	Also, we consider the cost: each step (transcription minutes, OpenAI tokens, embedding calls) costs money. We might implement per-org quotas or at least tracking in the future. But pipeline doesn’t directly worry about that beyond possibly checking “if org is free tier and already used X minutes, maybe do not auto-process until they upgrade”. But to start, likely just process and we will handle billing outside pipeline (or not in MVP).
	•	If using Pinecone later, the pipeline step “embedding” would include an API call to Pinecone’s upsert. That’s fine but if Pinecone is unreachable, we need to retry. We could also first store vectors locally and have a separate sync service to push to Pinecone asynchronously (to decouple vector DB from user-facing flows slightly). Possibly not needed if Pinecone is reliable.

In summary, the pipelines ensure that from the moment a user clicks “stop recording”, the heavy lifting is done in the background, and the user is eventually presented with a transcript and document, and can use the AI assistant to query it. Each pipeline stage is designed to be fault-tolerant and scalable through the use of asynchronous jobs and external services specialized for the task. By modularizing the pipeline, we can maintain and improve each part (for instance, swap out transcription provider or add a new post-processing step like translation) without affecting the others, as long as the triggers and data contracts remain consistent.

⸻

File: api-spec.md

API Specification

This document outlines all relevant API endpoints and route handlers in our application, including their purpose, request/response format, authentication requirements, rate limiting considerations, streaming capabilities, and integration with background tasks. The API is organized by feature area (auth, recordings, transcription webhooks, documents, search/chat, etc.). All endpoints are prefixed with /api as we are using Next.js API routes (App Router). These endpoints are primarily consumed by our frontend and some by external services (webhooks).

General Considerations
	•	Auth: All endpoints (except auth callbacks or public content) require authentication. We use Clerk’s middleware to protect API routes. This means each request will have an authenticated user (with req.auth or similar providing userId, orgId, and roles). If a request is unauthenticated, it gets a 401 or redirect to login.
	•	Data Scope: Many endpoints require an org_id context (which we get from the session or header via Clerk). We ensure that the user belongs to that org and has necessary permissions for the action. If not, respond with 403 Forbidden.
	•	Rate Limiting: We will implement basic rate limiting on certain endpoints to prevent abuse:
	•	E.g., the chat endpoint (vector search / AI answer) might be limited to, say, 60 requests per minute per user or a similar quota, especially on free plan.
	•	The recording upload endpoints might be limited in number of concurrent uploads or total per day for free plan users.
	•	We can use a library or Vercel’s Edge Middleware to do rate limit by IP/user. Alternatively, since Clerk gives user ID, a simple in-memory or KV store count can be used. For MVP, we might not enforce strictly but will design to add easily.
	•	Streaming: Some endpoints (like the chat answer) will use streaming responses (Server-Sent Events or incremental HTTP chunking) to send data progressively. We ensure proper headers (Content-Type: text/event-stream or similar) and flush behavior for these.
	•	Task Queue Triggers: Certain endpoints won’t complete the full processing synchronously but will enqueue background tasks. For example, when receiving a transcription webhook, after storing data we might enqueue a doc generation job.

Now, specific endpoints:

Auth Endpoints (Clerk-managed)

We largely rely on Clerk’s hosted components for auth (so users are redirected to Clerk’s pages or using Clerk React components). Thus, we have minimal custom auth endpoints. Clerk provides:
	•	/api/auth/* (Clerk’s Next.js middleware uses internal routes).
	•	Webhooks from Clerk (if any, e.g., for user created, organization events) – we might set up an endpoint to receive those and sync to our DB.

Example:
	•	GET /api/auth/session – (Provided by Clerk) returns current session info. Not something we write; Clerk’s SDK handles retrieving user profile, etc., on front-end.
	•	Clerk Webhooks (if used): e.g., /api/webhooks/clerk – to handle events like organization created, member added, etc. We would verify the signature and update our organizations or user_organizations tables accordingly (though Clerk might make a direct call unnecessary if we query each time or use their JWT claims). If implemented:
	•	Request: JSON payload from Clerk describing the event.
	•	Response: Usually 200 if processed.
	•	Auth: Basic (Clerk signs it, we verify with secret).
	•	Behavior: Update DB or log.
	•	Rate limiting: N/A (coming from Clerk, low volume).

User/Org Management Endpoints

If we provide custom endpoints for creating orgs or inviting users (which could also be done via Clerk’s frontend):
	•	POST /api/organizations – Create a new organization.
	•	Auth: User must be authenticated (this will be the owner of new org).
	•	Request: JSON body with at least { name: "Org Name" }.
	•	Response: 201 Created with JSON of org { org_id, name, ... } or error if e.g., name invalid.
	•	Behavior: Creates org in our DB (and possibly via Clerk API if using Clerk Orgs to manage invites).
	•	If using Clerk’s organization feature, ideally we call Clerk’s server API to create an organization, which will handle membership. Clerk might then call a webhook to us or we query the created org ID to insert in our DB.
	•	If not using Clerk Orgs, we create DB entry and add user to user_organizations as admin.
	•	Rate limit: Minimal (creating org is rare).
	•	GET /api/organizations/current – Get current org’s info and membership list.
	•	Auth: Must be a member of an org (and probably admin to see full member list).
	•	Response: JSON like { org: {...}, members: [ {user_id, name, email, role}, ...] }.
	•	Behavior: Look up org by session’s org_id, fetch org info and join with user_organizations->users for members if admin, or just basic org info if member.
	•	Possibly for multi-org context, GET /api/organizations to list all orgs user is in (so they can switch).
	•	POST /api/organizations/invite – Invite a new member by email.
	•	Auth: Org Admin only.
	•	Request: { email: "foo@bar.com", role: "member" }.
	•	Response: 200 with { success: true } or error.
	•	Behavior: If using Clerk Orgs, we might call Clerk’s invite API to send an invitation. If we manage ourselves, we create a temporary invite token in DB, email it to that address with a link to sign up and join org.
	•	Rate limiting: yes, to prevent spam invites (e.g., max 10 invites per hour per org).
	•	DELETE /api/organizations/members/{userId} – Remove a member.
	•	Auth: Org Admin and cannot remove themselves unless another admin exists (perhaps).
	•	Behavior: If using Clerk, call Clerk remove member API. Also remove from our DB membership (Clerk might do that via webhook too). Return 204 No Content on success.

(We rely heavily on Clerk for auth flows, so the above may be thin wrappers or not needed if we use their components which handle invites.)

Recording Endpoints
	•	POST /api/recordings – Initiate a new recording entry (could be optional since uploading might create it).
	•	Auth: Auth required.
	•	Request: Could include metadata like { title (optional), description (optional) }. Or even could allow uploading small file directly (but we prefer separate upload step).
	•	Response: JSON with { recording_id, upload_url(s) } if we choose to return a pre-signed URL or instructions for uploading.
	•	Behavior:
	•	Generate a new recording_id (UUID).
	•	Create DB entry with status ‘uploading’ or ‘pending’.
	•	If using direct upload to S3 approach:
	•	Call S3 to get a pre-signed URL (or an AWS SDK upload ID and part URLs for multipart).
	•	Return those to client.
	•	If using Supabase:
	•	We might not need this endpoint; the client could upload via supabase library using user’s auth.
	•	But if we want to enforce a key naming scheme, we might tell client: upload to bucket X path org/<orgId>/<recording_id>.webm.
	•	If chunking with custom approach, maybe we return an endpoint /api/recordings/{id}/upload to which the client can PUT chunks with a query param like ?part=1.
	•	Note: We might simplify and not use a distinct call; the client could directly start an upload via an SDK and then call the complete endpoint.
	•	PUT /api/recordings/{id} – Update recording metadata.
	•	Auth: Owner or admin of org.
	•	Request: JSON with fields to update (title, description, maybe privacy setting).
	•	Response: 200 and updated object or 204.
	•	Behavior: Write to DB after checking permission. Title/desc can be updated anytime.
	•	Rate limit: low.
	•	DELETE /api/recordings/{id} – Delete a recording.
	•	Auth: Owner or admin.
	•	Response: 204 No Content on success.
	•	Behavior: Mark as deleting or directly remove:
	•	Delete DB entries (recording, cascades to transcript, doc, chunks).
	•	Delete video file from storage (we may call storage API or queue deletion).
	•	Possibly cancel any ongoing jobs for it (if deletion happens mid-processing).
	•	This might be a long operation if video is large to delete physically; but S3 deletion is quick, so fine.
	•	We could perform file deletion asynchronously if needed, but likely fine to do in the request since it’s a simple API call to storage.
	•	GET /api/recordings – List recordings for current org.
	•	Auth: Yes.
	•	Query Params: Could support pagination (?limit=50&offset=0) or filtering (e.g., by creator or by status).
	•	Response: JSON array of recordings (with fields like id, title, user, status, created_at, maybe partial transcript preview or doc snippet if we want).
	•	Behavior: DB query for all recordings where org_id = currentOrg. Apply any filters. Perhaps join user to get creator name.
	•	Might only list those that are not deleted. If we had soft-delete, filter that out.
	•	GET /api/recordings/{id} – Get details of a specific recording.
	•	Auth: Member of org.
	•	Response: JSON with recording details including:
	•	metadata: id, title, description, user, created_at, status.
	•	transcript text (possibly full or maybe we load lazily? Probably can send full text).
	•	document content (the markdown).
	•	We might exclude the raw embedding data – not needed by frontend.
	•	Maybe include a URL to stream or download the video (like the S3/Supabase public URL or a signed URL if private).
	•	Behavior: Fetch from DB (recordings join transcripts join documents).
	•	Also generate or provide the video link:
	•	If the bucket is private, either create a short-lived signed URL here, or route video through an API that streams it.
	•	Supabase provides a way to retrieve with user token. If using that on frontend, might not need our API to proxy.
	•	Possibly we mark our bucket as public for simplicity, since it’s mostly internal data not public, but accessible to all in org anyway. However, not all org members should have link? Actually if link is unguessable (with recording_id), still, if bucket is public and someone guesses URL they could get it. Better to keep protected.
	•	So one approach: have a route /api/recordings/{id}/video that checks auth and then streams file from storage. But that doubles bandwidth through our server (costly).
	•	Alternative: Use signed URLs: Vercel server can generate a signed URL for S3 object that lasts 1 hour and respond with redirect to it. That way client downloads directly from S3. This is efficient.
	•	For Supabase, we might rely on supabase client in front-end with user’s JWT; they can call storage.getPublicUrl (but if not public, then .download with auth).
	•	Perhaps easiest: in our GET /recordings/{id}, include video_url which if using S3 is a signed URL (just generate one each time, it will be valid short time). If using Supabase, we can call supabase storage with service key to get a URL or serve via our own.
	•	Possibly handle if not processed: if status is not completed, transcript or doc might be null or partial. We still return what we have (maybe transcript if done, doc if done).
	•	POST /api/recordings/{id}/publish – (Optional) Publish/unpublish a recording’s doc publicly.
	•	Auth: Maybe only Admin or Owner can publish.
	•	Request: JSON { "publish": true, "includeVideo": false } or similar.
	•	Response: 200 with maybe a public URL or token.
	•	Behavior: If publish true:
	•	Set documents.is_published = true for that recording.
	•	Generate a shareable link (if using ID is enough, since we can have a public route like /share/doc/{recording_id} that anyone can open if is_published).
	•	Optionally, if includeVideo was requested and we allow it, we might also mark something to allow unauthenticated video streaming (maybe we create a signed URL and embed it or serve through our share page).
	•	If publish false: set is_published false (and any existing share links would stop working or share page checks that flag).
	•	Rate limiting: minimal.

Webhook Endpoints
	•	POST /api/webhook/transcription – receives callbacks from the transcription service.
	•	Auth: It’s unauthenticated publicly, but we verify a signature or secret key included by the service.
	•	Request: The exact payload depends on service. For example, AssemblyAI might send { "status": "completed", "text": "...", "id": "xyz", ... }. We’ll document expecting certain fields:
	•	a job id or reference, which we match to a recording (we might have stored the job id in recordings or jobs).
	•	the transcript text (or a URL to fetch it from).
	•	possibly a confidence or word-by-word info.
	•	Response: Likely 200 with no content; we just acknowledge.
	•	Behavior:
	•	Verify signature (like HMAC header).
	•	Identify which recording this is for. If the service let us set a webhook per request with an ID, maybe we encoded recording_id in the webhook URL (like /api/webhook/transcription?recording_id=abc). Or we look up by the job id in DB.
	•	Update the transcripts table with the text.
	•	Update recordings.status = 'transcribed'.
	•	Kick off document generation. Possibly by simply calling the doc generation function or enqueuing a job (maybe using a small in-memory queue or something).
	•	Return 200 quickly.
	•	Rate limiting: not needed for external triggers (should be low volume, but we ensure this can handle bursts if many finish at once).
	•	POST /api/webhook/stripe – handle Stripe billing events.
	•	Auth: Verify Stripe signature.
	•	Behavior: Not core to product features, but for completeness:
	•	Listen for invoice paid, failed, subscription upgraded, etc. Update organizations.plan or set flags if needed.
	•	Notifies user or restricts service if payment failed, etc.
	•	This ensures the tech stack doc’s mention of billing integration is implemented.

AI Assistant Endpoints
	•	POST /api/chat/query – Query the AI assistant (vector search + LLM answer).
	•	Auth: Yes (org member).
	•	Request: JSON like { "query": "How do I reset the database?", "history": [ { "role": "user/assistant", "content": "..."} ], "scope": "all" | "record:ID" }.
	•	The history could be included if we maintain context on server, but likely we will manage context client-side for now. Alternatively, we use conversationId to track persistent context.
	•	scope or some param can specify if the user wants to limit search to a specific recording or tag. If scope=record:xyz, we filter vector search to that recording only.
	•	Response: This will likely be a stream. We set Transfer-Encoding: chunked and stream partial answer.
	•	We might first send some preliminary data like which records were found (maybe not to clutter answer, but sometimes showing sources as we go).
	•	We then stream the answer as it’s generated by OpenAI.
	•	We might format response in SSE format: data: ... lines, so client can use EventSource. Or use fetch and read the stream.
	•	If not streaming, we wait for full answer then return JSON { answer: “…”, references: [ {recording_id, snippet, confidence} ] }.
	•	Behavior:
	•	Receive query.
	•	Perform vector search in transcript_chunks where org_id = currentOrg (and further filter if scope given).
	•	Get top N chunks (say 5) and their text + maybe recording_id.
	•	Form a prompt for the LLM: e.g., “Using the info below, answer the question…\n\n<>\ntext…\n<>…\nQuestion: {query}\nAnswer:”. Possibly include some instruction to cite sources by maybe referring to [1], [2] etc.
	•	Call OpenAI ChatCompletion (likely gpt-3.5 or gpt-4) with system and user prompt containing those documents.
	•	We use the streaming option from OpenAI. As tokens arrive, we flush them to client.
	•	We also capture which sources were used. We might attempt to parse model output for references if we instruct it to output them, or simpler: after answer, we attach the known top chunks as context sources. Could refine later to match which chunk text overlaps answer.
	•	Once done, end stream. The client would assemble tokens into the final answer. If not including references inline, we might at the end send a JSON block with references.
	•	The client UI will show answer, and perhaps list sources (like “From Recording X (Feb 1, 2025)” linking to it).
	•	Rate limiting: Important here. We’ll likely restrict to e.g. 5 queries in 10 seconds or similar, to avoid someone making a loop to use our API as openAI proxy. And overall perhaps X per month per user on free plan. Implementation: Could use an in-memory counter or upstash redis to track queries by user id. On exceed, return 429 Too Many Requests with an error “Rate limit exceeded”.
	•	Error handling: If vector DB or LLM fails:
	•	If vector search returns nothing (rare unless no data), we can respond with something like “I don’t know” or let model handle “no relevant info”.
	•	If OpenAI API errors (timeout or 500), we catch and return a 500 with message “Assistant is currently unavailable, try again.”.
	•	POST /api/chat/feedback – (Optional) send feedback on answer quality.
	•	Could allow user to thumbs-up/down an answer, which we log to improve prompts or metrics.
	•	Auth: yes.
	•	Request: { conversationId, messageId, feedback: "up"|"down", comment: "optional text" }.
	•	Behavior: Store in a small table or send to an analytics pipeline. Not a priority initially.

Misc Endpoints
	•	If we embed images, e.g., for marketing site or user uploaded an image, might have endpoints. Not in scope now.
	•	GET /api/sitemap.xml – maybe generate sitemap for SEO. Only if needed; Next can statically do for marketing pages.

Streaming Implementation Detail

For POST /api/chat/query streaming:
	•	In Next.js (Node) API route, we can set up the response as a stream by:
	•	Using the res directly (which is a Node http.ServerResponse) to write chunks. Ensure res.writeHead(200, { Content-Type: 'text/event-stream', Cache-Control: 'no-cache', Connection: 'keep-alive' }) for SSE or text/plain if just raw chunks.
	•	Use OpenAI SDK with streaming: it gives a stream of events or callbacks per token. We’ll forward those.
	•	We need to flush periodically (res.flush() if available, or ensure auto flush).
	•	Finally end the response.
	•	Alternatively, Next 13 App Router might allow using new Response(stream) to return a streamed response. Actually, in the App Router, if using the new Route Handlers, we can do: return new NextResponse(stream, { status: 200, headers: { ... } }).
	•	We’ll have to test this, but it’s doable. The UI will use EventSource or fetch with reader to consume the stream.

Development and Testing
	•	We’ll test endpoints with tools like Postman or curl:
	•	Ensure auth middleware working (Clerk provides a way to simulate user tokens in dev).
	•	Test upload flow: hitting POST /recordings, using returned URL to PUT a file, then hitting complete.
	•	Simulate a webhook by calling it ourselves with sample data to ensure it triggers doc gen.
	•	Test chat with some known content to see if it returns expected format.
	•	For streaming, test via curl or a Node script reading from http to confirm chunked output.

Conclusion of API Spec

This API provides the backbone for our front-end to interact with the system and for external integrations. It balances synchronous operations (quick data fetches, UI actions) with asynchronous hand-offs (webhooks and background tasks). By clearly defining endpoints and their roles, internal engineers and AI agents can interact with the system predictably, and we maintain security and performance through auth checks and rate limiting where appropriate. Each endpoint corresponds to a piece of the product functionality described earlier, tying together the overall architecture.

---

## Phase 6. Quality, Security, and Limits

**Goals**
- Validate quality via tests and manual QA.  
- Enforce security controls and rate limits.  

**Inputs**
- Coding Standards
- Rate Limits and Quotas
- Architecture Overview

**Tasks**
- Expand unit, integration, and e2e tests with coverage thresholds.  
- Security checks: dependency scanning, SAST, secrets detection.  
- Pen test checklist and threat model updates.  
- Apply and verify rate limits per endpoint and actor type.  
- Observability: alert rules, dashboards, SLOs and error budgets.  

> Reference: Rate Limits and Quotas  
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


---

## Phase 7. Launch, Marketing, and Brand Readiness

**Goals**
- Prepare external assets and go-to-market activities.  
- Ensure product branding and messaging are consistent.  

**Inputs**
- Marketing and Brand
- Product Features

**Tasks**
- Finalize naming, logo, and brand assets.  
- Update website copy, pricing pages, and docs.  
- Create onboarding emails and nurture flows.  
- Publish changelog and launch blog post.  
- Define sales enablement collateral and demo scripts.  

> Reference: Marketing and Brand  
Marketing and Brand Strategy

This document defines our product’s brand positioning, early go-to-market (GTM) strategy, top-of-funnel approach, and the intended tone for our landing pages. It will guide how we present the product to the world and acquire our initial users.

Brand Positioning

Product Name (Tentative): DocuVision (for example) – a name that suggests documentation and insight. (Note: Final naming is TBD, but we’ll use this for description.)

Value Proposition: DocuVision helps organizations capture expert knowledge effortlessly and turn it into usable documentation and Q&A assistance. It’s like having a “second brain” for your team: simply record your screen and voice as you demonstrate or explain something, and our platform will transcribe it, summarize it into structured notes, and make it searchable via an AI assistant. This dramatically reduces the time to create training materials or documentation and ensures that valuable know-how isn’t lost.

Positioning Statement: For teams that struggle to document fast-changing expertise, DocuVision is a knowledge capture platform that transforms video recordings into instantly useful documentation and an AI chat assistant. Unlike traditional screen recording tools or wikis, our product not only records knowledge but also makes it easy to digest and query, so information is always at your fingertips.

We position ourselves at the intersection of knowledge management and productivity tools. The brand should evoke efficiency, intelligence, and reliability. We want customers to feel that using our product is a modern, smart way to preserve and share knowledge, as opposed to labor-intensive manual documentation.

Differentiators:
	•	We go beyond simple video recording (like Loom) by automatically generating transcripts and documents – saving time for the expert and the viewer.
	•	We incorporate AI for retrieval, meaning knowledge captured isn’t static – it’s interactive and queryable, which is a unique selling point.
	•	Emphasis on accuracy and structure: we cater to professionals, ensuring the output (transcripts/docs) are high-quality and can be trusted for reference.

Early Go-To-Market (GTM) Strategy

As an early-stage SaaS, our GTM focuses on niche targeting, community engagement, and showcasing value through content:
	•	Target Early Adopters: Identify sectors or roles that feel the pain point acutely. For example, software onboarding/training teams, customer support knowledge base creators, or consulting firms capturing internal expertise. These groups frequently need to turn complex knowledge into documentation and would readily try a tool to streamline that.
	•	Founders’ Network & Beta Program: We will start with a closed beta for friendly users in our network (e.g., via LinkedIn or industry Slack groups). Their feedback helps refine the product. Success stories from beta users can become case studies.
	•	Product Hunt and Early Traction Channels: We plan a Product Hunt launch to tap into the tech enthusiast community. This can generate initial buzz and user feedback. Similarly, we’ll engage on Hacker News or relevant forums sharing the problem we solve (without being overly promotional).
	•	Content Marketing (Educational): We create blog posts, short videos, and LinkedIn content on topics like “How to capture knowledge from your experts without writing a single document” or “Top 5 tips to build a video knowledge base”. This content serves two purposes: SEO to bring in search traffic (top-of-funnel) and establishing our authority in the space. We’ll publish tutorials on using our product effectively, and broader pieces on knowledge management best practices.
	•	Partnerships: Explore partnering with communities or businesses adjacent to our space. For example, a Slack community for technical writers or an online course platform – we might offer a guest blog or a discount for their members to try our tool.
	•	Freemium & Word of Mouth: Offering a generous free tier (for single users or limited recordings) can encourage individuals to try it. If they find value, they may introduce it to their team (bottom-up adoption). We’ll make sharing easy – e.g., allow a user to share a document or an answer with a colleague via a link, which can drive new sign-ups.

Early GTM success will be measured by user engagement (are beta users creating content regularly?), conversion to paid plans (if they hit limits), and qualitative feedback (are we solving their problem?). We will iterate our messaging and onboarding quickly based on this feedback.

Top-of-Funnel Strategy

To fill the funnel with interested prospects, we focus on:
	•	SEO and Content: As mentioned, blog content targeting keywords like “video to documentation”, “screen recording transcription tool”, “knowledge base automation” will capture searchers. We’ll also create SEO-optimized landing pages for specific use cases (e.g., “Documentation for Onboarding”, “Record and Search Meetings”), which can be discovered via Google.
	•	Social Media & Communities: Regularly post valuable snippets on LinkedIn and Twitter (now X). For example, short clips demonstrating how our AI answers a question from a video, or a before/after of manual documentation vs our automated doc. We’ll engage with #buildinpublic to share our journey; this can draw interest from early adopters and other founders. Community platforms like Reddit (subreddits r/saas, r/Productivity, r/techwriting) or Hacker News can be used to share insights or ask for feedback (authentically, not as pure ads).
	•	Email Capture & Newsletter: On the marketing site, we’ll encourage visitors to sign up for a newsletter or early access. Even if they don’t convert immediately, we nurture them via email with tips and updates (“Here’s how Company X saved 5 hours/week using DocuVision”, “New feature: Slack integration!”). This keeps us in their consideration set.
	•	Webinars/Workshops: Host a free webinar like “How to instantly turn your training videos into documentation”. This not only demonstrates our product in action but also provides genuine education. Participants who attend are highly qualified leads for conversion. We can partner with a community or influencer for broader reach.
	•	Referral Incentives: Implement a referral program (e.g., “Get 1 month free Pro for each friend who signs up”). Satisfied users can become ambassadors, helping to bring in more users through personal recommendation – one of the strongest top-of-funnel channels.

The top-of-funnel strategy is about visibility and education. We want potential users to become aware that this type of solution exists and that it can dramatically improve their workflow. By providing value upfront (through content or free tools), we earn trust, which makes them more likely to explore our product seriously.

Landing Page Tone and Messaging

The tone of our landing pages (especially the homepage) should be professional yet approachable. Our audience includes team leads, operations or enablement managers, and tech-savvy professionals – they appreciate clarity and efficiency.

Key tone elements:
	•	Clarity: We immediately state what the product does in simple terms. E.g., “Capture your screen and voice, and get instant documentation + an AI assistant.” The user shouldn’t guess our purpose.
	•	Confidence: Use active language and bold statements about benefits: “Never lose important know-how”, “Your team’s knowledge, on demand.” We want to sound like we solve the problem definitively.
	•	Empathy: Acknowledge the pain point: e.g., “Tired of writing long how-to docs? Spending hours answering the same questions?” This shows we understand the user’s struggle.
	•	Brevity with Substance: We keep sections concise, but each headline is backed by a bit of detail or a visual. For example, a section “Record Once, Get Documentation Forever” followed by a short explanation and maybe an image of a video alongside an auto-generated doc.
	•	Visual Aids: We use screenshots or perhaps a short looping demo GIF on the landing page to show the transformation (recording → transcript → Q&A) rather than just telling. Visual proof makes the product feel tangible.
	•	Social Proof: Early testimonials (even from beta users) or metrics (“500 hours of documentation generated”) add credibility. The tone here remains honest and relatable, using real names and scenarios if possible.

The landing page copy should guide a visitor through a story:
	1.	Hero section: Big headline + subheadline + call-to-action. E.g., “Unlock your team’s hidden knowledge. Record any expert, and let our AI turn it into docs and answers.” [“Get Early Access” button].
	2.	Problem section: Briefly describe the traditional problem (information silos, time wasted documenting).
	3.	Solution/How it Works: Explain in 3 steps (Record, Auto-Transcribe & Summarize, Ask AI) with an icon or illustration for each.
	4.	Features/Benefits: List the key features with user-centric benefit phrasing (“Find answers instantly” for the search feature, etc.).
	5.	Social proof or Use Cases: Logos of pilot customers or quotes: “This changed how our support team works…”.
	6.	CTA: Repeat call-to-action for sign-up, possibly offering a free trial or free tier to reduce friction.

The tone is enthusiastic but sincere – we believe in our solution and we convey that excitement, but we also are careful to not overhype beyond what we deliver. We avoid overly technical jargon on the marketing site; technical details can go in docs or whitepapers. Instead, we focus on outcomes: saving time, preserving knowledge, empowering teams.

Voice example:
	•	Instead of “Our state-of-the-art ML-driven transcription achieves 95% accuracy,” we say “Your spoken words magically become accurate text – no typing required.” (Then in a tooltip or footnote, we could mention powered by advanced AI, if needed.)
	•	Use second person (“you/your team”) to speak directly to the visitor. E.g., “You focus on explaining – we’ll handle the rest.”

By setting this tone and message, our brand comes across as a helpful partner that augments the user (not replacing them, but making them superhuman in terms of productivity). We want users to feel confident that adopting our product will make them look good (they produce more documentation, answer questions faster) without a steep learning curve.

Early Brand Design Notes

(While not the main focus here, a brief note on visual branding to complement tone:)
	•	We aim for a modern, clean aesthetic. Likely a light theme with one strong accent color that conveys trust and innovation (blue or green often works in B2B SaaS).
	•	Logo and imagery will reflect the idea of connection between video and text (maybe an abstract icon representing a video camera transforming into a document or chat bubble).
	•	We’ll ensure the brand is consistent across the marketing site, app, and any outbound communications (same tone and style).

In summary, our marketing strategy is to nail a niche use-case and expand. We start by clearly communicating our unique solution and getting it in the hands of a few enthusiastic users who become champions. The brand is positioned as the go-to solution for turning expert knowledge into accessible answers, and all our messaging and tone reinforce that identity. Over time, as we gain traction, we’ll refine our messaging with real-world success stories and possibly broaden to adjacent use cases, but early on, focus and clarity in brand and marketing will be our guiding principles.

---

## Appendix A. Source Docs (Embedded)

### architecture-overview.md
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


---

### tech-stack.md
Tech Stack and Services

This document enumerates all major technology choices for the project – front-end, back-end, database, hosting, and external services – along with the rationale behind each choice and notes on scalability. Our stack is chosen to accelerate development while ensuring we can scale to meet user demand.

Frontend
	•	Framework: Next.js (latest version with the App Router) with React and TypeScript. We chose Next.js for its hybrid rendering capabilities (static generation for marketing pages, server-side rendering for dynamic app pages) and its first-class support for App Router which simplifies routing and layouts. React with TypeScript provides a robust developer experience, catching errors early and enabling rich IDE support.
	•	UI & Styling: Tailwind CSS (utility-first CSS) for rapid UI development and consistency. Paired with a ShadCN to build accessible components quickly. This combination lets us maintain a consistent design system and easily adjust to branding needs.
	•	State Management: Rely primarily on React’s built-in state and Context. Next.js App Router encourages using React context or server components for data fetching. If needed, we may introduce a library like Zustand or Redux for global state, but initial complexity is kept low by leveraging React and Next features.
	•	Recording Interface: We utilize the MediaDevices API (getUserMedia/getDisplayMedia) and MediaRecorder in the browser to capture screen, camera, and microphone. The front-end includes a custom recording UI that guides the user to grant screen/camera permissions and shows recording controls (start/stop, possibly pause). For combined screen + webcam recording, we capture both streams and composite them (for example, drawing webcam video on a canvas over the screen video to produce a single stream). This is done to ensure the screen and face-cam are synchronized in one video file.
	•	Frontend Build & Tooling: The project uses modern toolchain (ESLint, Prettier, Jest/React Testing Library for testing components). Next.js handles bundling via Webpack/Turbopack, and we can leverage Vercel’s optimization for images and assets.

Rationale: Next.js accelerates development by handling common web app requirements (routing, code-splitting, API routes) and is well-suited for our SaaS which has both a public website and an application. Tailwind and ready-made UI components speed up styling while ensuring a polished, responsive UI out-of-the-box. Using the native MediaRecorder API avoids heavy dependencies and gives us flexibility; it’s supported on modern browsers and lets us stream data for large recordings rather than load entire files in memory.

Backend
	•	Platform: Next.js API Routes / Route Handlers for building our HTTP API. Since our app is primarily serverless and front-end driven, we use Next’s built-in API layer for convenience. This allows co-locating backend endpoint code with the front-end project, simplifying integration.
	•	Language: TypeScript on the server as well (Node.js runtime) for consistency with the front-end and to catch type issues across the stack.
	•	Web Server / Hosting: Vercel is used for hosting the Next.js application (both front-end and API routes). Vercel provides automatic scaling, edge network, and CI/CD integration. It’s optimized for Next.js, which means easy deployments and fast global delivery for our static content.
	•	Asynchronous Workers: For long-running processes (transcription, document generation, etc.), we decouple from the request/response cycle. There are two approaches:
	•	Serverless Tasks: We initiate work in an API route (or Vercel Edge Function) and immediately return, then use callbacks/webhooks to continue processing. For example, when a video is uploaded, an API route can enqueue a transcription job and return quickly. The actual transcription is done by an external service or background process, which calls our webhook when done.
	•	Dedicated Worker Service: As we scale, we may introduce a separate background worker service (e.g. a Node.js or Python process) that pulls jobs from a queue (like Redis or Supabase PG listen/notify) and processes them. This service can run on AWS (Lambda, ECS) or another environment. Initially, we try to leverage external APIs (OpenAI, etc.) that are asynchronous so that our own infrastructure can stay minimal.
	•	API Design: We adopt RESTful endpoints within Next.js for simplicity (detailed in api-spec.md). We also use Edge Middleware (via Clerk and custom logic) for tasks like authentication and rate-limiting where low-latency filtering is needed.

Rationale: Keeping the backend within Next.js (at least initially) reduces complexity – we don’t maintain a separate Express server. Vercel’s serverless model means we don’t worry about managing servers for the API, and it scales automatically per request. By offloading heavy tasks to asynchronous workflows or third-party services, we avoid serverless timeouts and keep the app responsive. This setup is very scalable for bursty workloads – Vercel can spawn more lambdas for API routes as needed – and we’ll design our system to be stateless so this scaling is seamless. If needed, introducing a dedicated worker service for background jobs will further improve throughput without impacting user-facing performance.

Database
	•	Primary Database: PostgreSQL 15 (with the pgvector extension for embeddings). We use a relational database to store structured application data (users, organizations, recordings, transcripts, etc.). The pgvector extension allows us to store and query embedding vectors for our AI search features directly in Postgres.
	•	Hosting: Supabase (managed Postgres) or Amazon RDS for Postgres. Supabase is an attractive choice as it provides a hosted Postgres with pgvector support out-of-the-box, plus convenience features like row level security (RLS) and a built-in API if needed. It also bundles nicely with storage. Alternatively, we could use RDS or Cloud SQL and self-manage the vector extension.
	•	Connection & ORM: We use a query builder/ORM such as Prisma or Knex for type-safe database queries, or SQL directly for full control especially when using vector similarity queries. Prisma has preview support for pgvector, which could simplify integration. We must ensure efficient queries for vector search (HNSW index) and typical relational data.

Rationale: PostgreSQL is a proven, robust database that covers our needs for structured data and now unstructured vector search. By using Postgres for both standard data and embeddings, we reduce operational complexity (one database to maintain) and avoid data synchronization issues between separate systems. This choice is cost-effective as well – early benchmarks show pgvector can handle moderate vector workloads with high performance and low cost, even outperforming some specialized vector DBs at our scale. As we scale, if we encounter performance limits or operational challenges, we can partition data or consider moving to a specialized vector DB (as discussed in vector-strategy.md). In the meantime, a single Postgres simplifies our stack and leverages our team’s familiarity with SQL.

Storage & File Handling
	•	Video/Audio Storage: Original recordings (video files) are stored in object storage. We are considering Supabase Storage (which is S3 under the hood) versus AWS S3 directly. Both provide durable, scalable object storage. Supabase Storage offers a simple integration (we can manage buckets and permissions in the same dashboard as our DB) and even supports resumable uploads and 50GB file sizes now. Alternatively, using S3 via AWS SDK gives us more direct control and is practically the same underlying technology.
	•	CDN: Whichever storage we use, the files are served via a CDN (Supabase uses CDN by default; with S3 we’d front it with CloudFront or use Vercel’s built-in asset proxies). This ensures fast playback/download of videos for end users.
	•	Transcripts & Derived Docs Storage: These are textual and stored in the database (as text columns or possibly in a text search index for backup). We do not expect these to be huge (relative to video), so DB storage is fine. We will also keep vector embeddings in the DB (as part of the pgvector setup).
	•	Backups: Rely on managed service backups (Supabase daily backups for DB; versioning on S3 for storage, etc.) and potentially periodic exports for redundancy.

Rationale: Using a managed storage solution like Supabase or S3 means we don’t worry about capacity – we get virtually infinite storage and high availability. Supabase Storage is essentially S3 with a convenient API and built-in auth integration, which speeds up development (no need to implement our own signing if we use their client libraries). On the other hand, direct S3 might be beneficial if we want fine-grained control or our own AWS account isolation; it also has a rich ecosystem of tools. Both options are scalable; we lean towards starting with Supabase Storage for simplicity and fewer moving parts, and we can switch to raw S3 if needed (since Supabase can export buckets, etc.). The CDN ensures that as we scale to many users or global users, video content is delivered quickly from edge locations.

External Services
	•	User Authentication: Clerk is our auth provider. Clerk manages user sign-up, login, multi-factor, social logins, and its Organization feature gives us ready-made support for multi-tenant (B2B) scenarios (multiple users under organizations with roles). This saves us from building authentication and user management from scratch, and provides a secure, maintained solution.
	•	Payments: Stripe is used for billing. We’ll integrate Stripe for subscription management (plan tiers) and possibly usage-based billing if needed. Stripe’s reliability and ecosystem (Checkout, customer portal, etc.) let us implement billing with minimal custom code. It scales from startup to enterprise seamlessly.
	•	Transcription Service: We use a speech-to-text API for transcribing audio. Options include OpenAI Whisper API, AssemblyAI, or Google Cloud Speech-to-Text. Currently we favor OpenAI Whisper API for its accuracy and reasonable cost, processing the audio to text automatically. If the recording audio is large, we upload it to storage and provide a URL to the transcription service for asynchronous processing (AssemblyAI, for example, can take a file URL and callback). This offloads heavy compute from our servers.
	•	LLM for Document Generation: We leverage OpenAI GPT-4 or GPT-3.5 to convert raw transcripts into structured documentation. After transcription, our backend calls OpenAI’s completion API with a prompt to produce a well-formatted Markdown or outline based on the transcript. We may start with GPT-3.5 (for cost efficiency) and allow opting into GPT-4 for higher quality summarization. This service is external but crucial to our “Docify” feature.
	•	Embedding Vector Generation: We use OpenAI’s text-embedding-ada-002 model to generate high-dimensional embeddings from transcript chunks or docs. This model returns a 1536-dimension vector that we store in Postgres. It’s fast and reasonably priced, and ensures our vector search (in Postgres or Pinecone) has state-of-the-art semantic representations. We could also consider local embedding models (like sentence-transformers) later for cost savings, but OpenAI’s offering helps us start quickly and with strong performance.
	•	Vector Search (Future): If/when we migrate to Pinecone for vector search, Pinecone itself is an external service. It provides a fully-managed vector database with an easy-to-use API, high performance, and scaling to billions of vectors. We will use it when our Postgres approach needs a boost (see vector-strategy.md for details).
	•	Email/Notifications: For system emails (invites, passwordless links from Clerk, etc.), Clerk handles most by default. If we need custom emails (e.g. “Your document is ready”), we can integrate an email API like SendGrid or use Clerk’s notification hooks. This ensures reliable email delivery at scale.
	•	Analytics & Monitoring: We include services like Sentry for error monitoring and LogRocket or Vercel Analytics for client-side performance/error tracking. These help us maintain quality as we scale. For product analytics (feature usage, funnel tracking), we might use PostHog or a simple integration with e.g. Google Analytics for marketing pages. These external tools ensure we can debug issues and understand usage in production.

Rationale: By leveraging best-of-breed external services, we can implement complex functionality with minimal custom code. Clerk provides a secure auth system with features like org management that would be time-consuming to build ourselves ￼. Stripe handles the nuances of subscription billing and taxes. OpenAI’s models allow us to implement AI features (transcription, summarization, semantic search) that would be infeasible to build from scratch. Using these services allows us to move fast and deliver a high-quality product from day one, and each of them scales far beyond our initial needs. We are mindful of vendor lock-in and cost: our architecture keeps data (transcripts, vectors) in our database so we can switch providers if needed (for example, we could swap out OpenAI embeddings for an open-source model later). Each choice will be continuously evaluated as we grow, but this stack gives us an excellent balance of development speed, capability, and scalability at the start.

Scalability Considerations

Each component of our tech stack has a path to scale:
	•	Next.js/Vercel: Scales automatically for traffic. We should ensure our API routes are stateless and optimize cold start where possible (using edge functions for latency-critical routes). We may introduce caching (Vercel’s Edge Cache or CDN) for public content and even certain API responses to handle high read load.
	•	Postgres (Supabase): We start with a single-node that can handle our initial workload. As usage grows, we can scale vertically (more CPU/RAM, use Supabase’s higher tiers) and horizontally with read replicas. We will optimize queries (indexes, partitioning if needed for very large tables). If write load grows, we consider sharding by tenant (org) or using a connection pooler like PgBouncer. Supabase automatically handles many optimizations and offers features like caching and full-text search which we can use to offload certain queries.
	•	pgvector/Pinecone: Our vector strategy is to use pgvector now, which is sufficient up to millions of vectors on a decent instance. We will monitor query performance (especially as data grows) – pgvector’s HNSW index gives near-constant-time similarity search and can be tuned. When we near the limit (in terms of memory or maintenance complexity) or need multi-region vector queries, we will migrate to Pinecone, which can scale to billion-scale vectors easily. Pinecone will let us distribute by namespace (org) and not worry about index maintenance at large scale. This two-stage approach (pgvector then Pinecone) ensures we use the right tool at the right time, balancing cost and performance.
	•	Storage (videos): Object storage (S3/Supabase) is effectively infinitely scalable. We will implement chunked uploads so even very large files can be handled, and use CDN delivery so load on origin is minimized. We might set up lifecycle rules (e.g. archive or delete old raw videos if not needed) to control costs in the long term. If user base grows globally, we could consider multi-region storage or additional CDN layers, but that is likely handled by our provider.
	•	External services: All chosen services (Clerk, Stripe, OpenAI, etc.) are designed to scale for huge workloads. We will just need to manage rate limits and quotas (for OpenAI, we’ll apply for rate limit increases as needed, or use multiple API keys/ accounts if appropriate). We also keep an eye on cost as usage grows (e.g. OpenAI embedding costs linearly with content volume; we may incorporate caching or move to open-source models internally if that becomes more economical at scale).
	•	Modularity: Our stack is modular – for example, if one part becomes a bottleneck, we can replace it. The app’s architecture (detailed in other docs) ensures we aren’t tightly coupling logic to a single provider. This means we can introduce services (like a dedicated search service, or a separate microservice for heavy AI tasks) without a complete rewrite.

In summary, our tech stack leverages modern frameworks and services to deliver a feature-rich product quickly. Each choice is backed by rationale focusing on developer productivity and the ability to serve our users reliably. As we grow, the same choices provide paths to scale, whether by configuration, paid upgrades, or swapping in more powerful specialized components. This balanced approach ensures we can focus on building unique value (expert recordings to knowledge) rather than reinventing wheels.

---

### repository-structure.md
# Repository Structure

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Stack:** Next.js (App Router), TypeScript, Clerk, Supabase (Postgres + Storage + pgvector), OpenAI, Stripe, Resend, Tailwind + shadcn/ui, Vercel

This document defines our **flat** repo layout, naming, import boundaries, and file placement rules. It includes scaffolding checklists for new routes, APIs, jobs, and webhooks, plus guardrails that keep RSC/Client code safe and maintainable.

---

## 1) Goals & Constraints

* **Flat & predictable**: minimal nesting; everything discoverable in seconds.
* **App Router first**: server components by default; client components opt‑in.
* **Strict boundaries**: no client → DB; no server code imported into client bundles.
* **Typed configs**: zod-validated env; typed API handlers and payloads.
* **Batteries included**: scripts for dev/test/lint/typecheck/build/preview/migrate.

---

## 2) Tooling Overview

* **Package manager**: `pnpm`
* **TS**: `typescript@^5`
* **Lint**: `eslint`, `@next/eslint-plugin-next`, `@typescript-eslint`
* **Format**: `prettier`
* **Schema/Migrations**: `supabase` CLI (or `drizzle-kit` if adopted later)
* **Tests**: `vitest` + `@testing-library/react`, optional `playwright`
* **Emails**: `react-email` for Resend templates
* **Styling**: `tailwindcss` + `shadcn/ui` components
* **ENV typing**: `zod` schema in `lib/env.ts`

---

## 3) Top-Level Layout (Flat)

```
root/
  app/                      # Next.js App Router: marketing + app + API
  components/               # UI components (client or server)
  lib/                      # Server libs: db, auth, vector, email, billing, utils
  styles/                   # Tailwind & global CSS
  public/                   # Static assets (favicons, og images)
  worker/                   # Background worker (Node) & job handlers
  emails/                   # React Email templates for Resend
  scripts/                  # One-off scripts (backfills, exports, checks)
  tests/                    # Unit/integration test helpers, fixtures
  db/                       # SQL migrations, seeders, (optionally drizzle)
  .github/workflows/        # CI pipelines
  .vscode/                  # Editor settings & recommended extensions
  README.md
  package.json
  pnpm-lock.yaml
  tsconfig.json
  next.config.mjs
  tailwind.config.ts
  postcss.config.mjs
  .env.example
  .eslintrc.cjs
  .prettierrc
```

**Why this shape?**  Flat root folders map 1:1 to core concerns (routing, UI, server libs, background work, migrations). Agents and new teammates can jump directly to the right place.

---

## 4) Directory Contracts (What lives where)

### 4.1 `app/` (Next.js App Router)

**Rules**

* Server Components **by default**.
* Client Components **only** where browser APIs or interactivity needed (e.g., recorder, drag‑and‑drop). Declare `'use client'` at file top.
* API routes live under `app/api/*/route.ts` (thin orchestration only).

**Recommended grouping**

```
app/
  (marketing)/              # Marketing site sections
    page.tsx
    pricing/page.tsx
    blog/[slug]/page.tsx

  (auth)/                   # Auth pages (Clerk wrappers)
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx

  (app)/                    # Authenticated product UI
    layout.tsx              # shell: nav/sidebar, org switcher
    dashboard/page.tsx
    recordings/
      page.tsx              # library grid/list
      new/page.tsx          # recorder UI (client component)
      [id]/page.tsx         # detail: video + transcript + doc
    documents/
      [id]/page.tsx
    assistant/page.tsx      # global chat
    settings/
      organization/page.tsx
      billing/page.tsx
      profile/page.tsx

  api/
    recordings/
      init/route.ts         # POST
      finalize/route.ts     # POST
      [id]/route.ts         # GET/DELETE/PATCH
    webhooks/
      transcription/route.ts
      stripe/route.ts
    assistant/query/route.ts
    docify/[recording_id]/route.ts
    embeddings/rebuild/[recording_id]/route.ts
```

**Boundary**: do not import `@supabase` server client or Node-only libs into Client Components. Use Server Actions/route handlers for mutations; fetch via `fetch()` from client when needed.

### 4.2 `components/`

* UI primitives and feature components.
* Partition with folders per domain (`recordings/`, `assistant/`, `layout/`).
* **Suffix conventions**: `*.client.tsx` (forced client) if you want clarity; otherwise rely on `'use client'`.
* Co-locate styles only if component-specific; otherwise global tokens live in `styles/`.

### 4.3 `lib/`

```
lib/
  db.ts                     # Postgres client (server-only)
  sql/                      # Tagged SQL helpers or queries
  auth.ts                   # Clerk helpers; org/role extraction
  rbac.ts                   # server-side authorization checks
  storage.ts                # Supabase Storage helpers (signed URLs)
  vector.ts                 # embeddings + pgvector queries
  docify.ts                 # LLM prompts & wrappers
  transcription.ts          # provider adapters + HMAC verify
  stripe.ts                 # billing helpers + customer portal links
  emails.ts                 # Resend send helpers
  env.ts                    # zod-validated process.env
  logger.ts                 # structured logger (pino/console wrapper)
  errors.ts                 # typed errors; error → HTTP mapping
  rate-limit.ts             # Upstash/Vercel KV sliding-window helpers
  utils.ts                  # small shared utilities (no side effects)
  types.ts                  # cross-cutting types
```

**Rule**: `lib/*` is **server-only** unless the file name explicitly says it is safe for the client (e.g., `lib/utils.ts`). Put any Node/secret code here, never in `components/`.

### 4.4 `worker/`

```
worker/
  index.ts                  # job runner bootstrap
  jobs/
    transcribe.ts
    docify.ts
    embed.ts
    notifications.ts
    usage-rollup.ts
  queue.ts                  # db-backed queue impl
  telemetry.ts              # traces/metrics for jobs
```

* Runs as a separate Node process (or serverless cron).
* Imports **only** from `lib/` (server-safe).
* No UI awareness.

### 4.5 `emails/`

* React Email templates (`.tsx`) with minimal logic; compiled and sent via `lib/emails.ts`.

### 4.6 `db/`

* SQL migrations in timestamped files: `2025-01-15-1200__create-recordings.sql`.
* Seeders (`seed.sql` or `seed.ts`).
* Migration runner scripts in `scripts/` (wrapping Supabase CLI).

### 4.7 `scripts/`

* Operational scripts: backfills, data exports, integrity checks.
* Must be idempotent and read org context from flags (`--org-id`).

### 4.8 `tests/`

* Unit tests near sources **or** consolidated here; integration and API tests live here.
* Fixtures under `tests/fixtures`.

---

## 5) Naming & Conventions

* **Files & folders**: `kebab-case` (`recording-detail`, `usage-rollup`).
* **React components**: `PascalCase.tsx`.
* **Types**: `PascalCase` for interfaces/types; `camelCase` for variables.
* **Routes**: plural resource names (`/recordings`, `/documents`).
* **Dynamic segments**: `[id]`, `[orgSlug]` as needed; avoid deep nesting.
* **API methods**: RESTful where possible; POST for actions that create/trigger jobs.
* **Errors**: standardized `{ code, message, details?, requestId }`.

---

## 6) Import Boundaries (Very Important)

* **Client Components may import only:** other client components, shared UI utils, and **not** server libs.
* **Server Components & API** may import from `lib/*` and use secrets.
* **Worker** may import from `lib/*` only.
* Enforce with ESLint rule `no-restricted-imports` and file globs: prevent `lib/db` from being pulled into client bundles.

**Example ESLint snippet**

```js
// .eslintrc.cjs
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@/lib/db', message: 'Server-only: import in server files/route handlers/workers.' }],
        patterns: [
          { group: ['@/lib/**'], importNames: ['default'], message: 'Check client/server boundary.' }
        ]
      }
    ]
  }
}
```

---

## 7) App Router Patterns

* **Layouts**: put org switcher, nav, and Toaster in `(app)/layout.tsx`.
* **Data fetching**: Server Components read from DB via `lib/db.ts`; Client Components fetch via `/api/*` or use `use` action props.
* **Error boundaries**: `error.tsx` per route group; `not-found.tsx` for 404s.
* **Streaming**: use RSC streaming where answers are long (assistant).

**Route Handler Template**

```ts
// app/api/recordings/finalize/route.ts
import { z } from 'zod'
import { authOrg } from '@/lib/auth'
import { finalizeUpload } from '@/lib/storage'
import { enqueueJob } from '@/lib/queue'
import { httpError, withRequestId } from '@/lib/errors'

const Body = z.object({ path: z.string().min(1), size: z.number().int().positive(), sha256: z.string().length(64) })

export async function POST(req: Request) {
  const requestId = withRequestId()
  try {
    const { orgId, userId } = await authOrg()
    const body = Body.parse(await req.json())
    const ok = await finalizeUpload({ orgId, ...body })
    if (!ok) throw httpError('BAD_REQUEST', 'Object not found')
    const recordingId = await createRecording({ orgId, userId, path: body.path, size: body.size })
    await enqueueJob('transcribe', { recordingId }, { dedupeKey: `transcribe:${recordingId}` })
    return Response.json({ recordingId, status: 'queued' }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    const e = httpError.from(err)
    return Response.json({ code: e.code, message: e.message, requestId }, { status: e.status })
  }
}
```

---

## 8) Environment & Config Files

* `.env.local` (dev), Vercel/Supabase envs for staging/prod.
* `lib/env.ts` validates and exports typed config (never read `process.env` elsewhere).

**Example**

```ts
// lib/env.ts
import { z } from 'zod'
const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  RESEND_API_KEY: z.string(),
})
export const env = Env.parse(process.env)
```

---

## 9) Styling & Design System

* Tailwind config lives in `tailwind.config.ts` with semantic tokens (brand, fg, bg).
* shadcn/ui components are generated under `components/ui/*`.
* Global styles: `styles/globals.css` (resets, variables, dark mode).

---

## 10) Testing Layout

```
tests/
  api/
    recordings.finalize.test.ts
    assistant.query.test.ts
  lib/
    docify.test.ts
    vector.test.ts
  components/
    RecorderToolbar.test.tsx
  fixtures/
    transcripts/
    documents/
```

* Unit: Vitest + RTL for React.
* Integration/API: supertest (Next test helpers) or `undici` against dev server.
* E2E (optional): Playwright in `tests/e2e`.

---

## 11) Scripts (package.json)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "format": "prettier -w .",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "db:push": "supabase db push",
    "db:gen": "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > lib/types.gen.ts",
    "worker": "tsx worker/index.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

---

## 12) Scaffolding Playbooks

### 12.1 New **page** in `(app)`

1. Create folder under `app/(app)/<route>/page.tsx`.
2. If interactive, add `'use client'` and keep all server code in actions/API.
3. Add loading/error boundaries if long‑running.

### 12.2 New **API route**

1. Create `app/api/<resource>/<action>/route.ts`.
2. Define `zod` schemas for request/response.
3. Enforce org/role with `authOrg()`.
4. Use typed errors; return `x-request-id`.
5. Add unit/integration tests under `tests/api/`.

### 12.3 New **DB table**

1. Author migration in `db/` (timestamped).
2. Update `lib/db` queries and types.
3. Add indexes (and RLS policy in phase 2).
4. Seed and write tests.

### 12.4 New **job** (worker)

1. Implement in `worker/jobs/<name>.ts` (idempotent).
2. Add enqueue helper in `lib/queue` with `dedupeKey`.
3. Register in `worker/index.ts` dispatcher.
4. Add metrics and tests.

### 12.5 New **webhook**

1. Route at `app/api/webhooks/<vendor>/route.ts`.
2. Verify HMAC/signature; record provider ids; ensure idempotency.
3. Persist and enqueue downstream jobs; 202 asap.
4. Add replay test and signature tests.

---

## 13) Git & Branching

* Default branch `main`; PRs from short‑lived feature branches.
* Conventional Commits (`feat:`, `fix:`, `chore:`…).
* Required PR checks: typecheck, lint, unit tests, build, migrations dry-run.

---

## 14) CI File Locations

* Workflows live in `.github/workflows/`:

  * `ci.yml` (lint, typecheck, test, build)
  * `preview.yml` (Vercel preview)
  * `migrations.yml` (db plan/check)

---

## 15) Path Aliases (tsconfig)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/app/*": ["app/*"],
      "@/lib/*": ["lib/*"],
      "@/components/*": ["components/*"]
    }
  }
}
```

**Rule**: always use `@/` imports (never `../../..`).

---

## 16) Recorder-Specific Placement

* **UI**: `app/(app)/recordings/new/page.tsx` (client) and `components/recordings/*` for toolbar, PiP overlay.
* **Upload helpers**: `lib/storage.ts`
* **Finalize API**: `app/api/recordings/finalize/route.ts`
* **Playback**: `components/recordings/Player.tsx` (server wrapper + client video)

---

## 17) Guardrails & Linters

* ESLint custom rule set to forbid `lib/db` in client bundles.
* `eslint-plugin-security` basic checks.
* `eslint-config-next` for React/Next best practices.
* Prettier mandatory; CI will fail on formatting drift.

---

## 18) Example: Feature Folder (Recordings)

```
components/recordings/
  RecorderToolbar.client.tsx
  UploadProgress.client.tsx
  Player.client.tsx
  RecordingCard.tsx

app/(app)/recordings/
  page.tsx                 # list
  new/page.tsx             # recorder (client)
  [id]/page.tsx            # details (server wrapper)

app/api/recordings/
  init/route.ts
  finalize/route.ts
  [id]/route.ts
```

---

## 19) Documentation & ADRs

* Keep `docs/` lightweight; primary operational docs are these `.md` files.
* Record any **Architecture Decision** as `docs/adr/NNN-title.md`.

---

## 20) Appendix: `.env.example`

```
# App
NODE_ENV=development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
```

---

## 21) Future-Proofing

* If we adopt Pinecone later: add `lib/vector-pinecone.ts` and keep `lib/vector.ts` as a strategy delegator.
* If we adopt Storybook: place config under `/.storybook` and stories next to components.
* If we split worker into its own service: promote `worker/` to a separate repo or package, keep interfaces in `lib/types.ts`.


---

### coding-standards.md
# Coding Standards

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** TypeScript/React/Next.js (App Router), API handlers, worker jobs, SQL/migrations, tests, tooling, docs.

This doc defines our **ground rules** for writing code: style, patterns, safety, testing, and review. It is intentionally prescriptive to maximize reliability and speed for a solo‑to‑small team scaling to production.

---

## 1) Languages, Runtimes, Toolchain

* **TypeScript:** `^5.x` with `strict` enabled, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
* **Node runtime:** `>=18.x` (Vercel & worker). No Node built-ins in client code.
* **Next.js:** `^14` (App Router). Prefer **Server Components**; Client Components opt‑in.
* **Package manager:** `pnpm`.
* **Schema/migrations:** Supabase SQL (optionally Drizzle later).
* **Tests:** Vitest + React Testing Library; optional Playwright.

---

## 2) Project Conventions

### 2.1 Naming & Files

* **Files/folders:** `kebab-case` (e.g., `recording-card.tsx`).
* **React components:** `PascalCase.tsx`. One default export per file.
* **Types/interfaces:** `PascalCase` (`Recording`, `TranscriptWord`).
* **Constants:** `SCREAMING_SNAKE_CASE` for env-like constants; `camelCase` otherwise.
* **Tests:** co-locate or place in `tests/`, suffix with `.test.ts[x]`.

### 2.2 Imports

* Use path aliases `@/` from `tsconfig.json`. No `../../../`.
* Do **not** import server-only libs (`@/lib/db`, `@/lib/stripe`, etc.) from Client Components.
* Side-effect imports must be documented at top comment.

### 2.3 Comments & Docs

* File header (optional) when non-obvious: purpose, invariants, ownership.
* JSDoc for exported functions/types where intent isn’t obvious.
* TODOs must include **owner + context**: `// TODO(jane): explain retry strategy here`.

---

## 3) TypeScript Standards

* `strict: true`, `noImplicitAny: true`, `noPropertyAccessFromIndexSignature: true`.
* Never `any` unless you **prove** a narrower type is impossible; annotate `// intentionally-any: reason`.
* Use **discriminated unions** over string enums when possible.
* Define **zod** schemas beside types for runtime validation at boundaries (API, webhooks, env, job payloads).
* Prefer **readonly** for object/array fields that shouldn’t mutate.
* Narrow types early with guards (`if (!value) return;`).
* Utility types live in `@/lib/types.ts`.

---

## 4) React/Next Patterns

### 4.1 Server vs Client Components

* Default to **Server Components** for data fetching and composition.
* Client Components only for: MediaRecorder/DOM APIs, eventful widgets, or stateful interactions.
* **Do not** pass secrets or server-only objects as props to Client Components.

### 4.2 Data Fetching & Mutations

* Server Components call DB via `@/lib/db` or fetch internal APIs.
* Client Components **never** call DB; use API route handlers (`/app/api/*`) or Server Actions.
* Validate all inputs with zod at the **edge** (route handler boundary).

### 4.3 State & Forms

* Local UI state: React state or `useReducer`. Avoid global stores for now.
* Forms: use **controlled** inputs when validation/formatting is needed; otherwise uncontrolled with refs is fine.
* Debounce expensive client events (≥ 150ms) and throttle scroll/resize.

### 4.4 Rendering & Performance

* Avoid unnecessary `'use client'`. Hoist heavy logic to server.
* Memoize lists with `key` and `React.memo` when items > ~100.
* Split large Client Components; use dynamic import for heavy widgets.
* Streaming responses for chat/long docs.

### 4.5 Accessibility

* Every interactive element must be keyboard accessible with visible focus.
* Use shadcn/ui primitives correctly with ARIA roles/labels.
* Provide alt text for images and captions for videos where relevant.

---

## 5) Styling & UI

* Tailwind with semantic tokens (brand, fg, bg). Avoid raw hex.
* Component class names: order **layout → spacing → typography → color → state**.
* Prefer shadcn/ui components; extend via className, not forks.
* Motion via Framer Motion; respect `prefers-reduced-motion`.

---

## 6) API & Error Contracts

### 6.1 HTTP Patterns

* RESTful where practical; `POST` for actions.
* Pagination: `?cursor=` model with opaque cursors; default page size 25; max 100.
* Idempotency: `Idempotency-Key` for POSTs that can be retried (finalize, regenerate, etc.).

### 6.2 Request/Response Validation

* zod schema per route; parse request at the boundary. Return `{ code, message, details?, requestId }` on errors.

### 6.3 Error Mapping

* 400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 422 `UNPROCESSABLE`, 429 `RATE_LIMITED`, 5xx `INTERNAL`.
* Do **not** leak internals in messages; include `requestId` and user-actionable hints.

### 6.4 Versioning & Deprecation

* Avoid breaking changes; add new fields, keep old until migration.
* Deprecations announced via changelog; support both for ≥ 2 minor versions.

---

## 7) Security Rules

* No secrets in client code or logs. Use `@/lib/env` on server only.
* HSTS, CSP (no `unsafe-inline`), strict CORS (app domain only).
* Webhooks: HMAC verification; timestamp skew ≤ 5m; reject replays (nonce store).
* Input sanitization: validate + escape; never trust client `org_id`.
* RBAC checks **server-side** for every mutation and sensitive read.
* Signed URLs: short TTL; minimal scope; validate object ownership (`org_id` prefix).
* Redact PII before embedding; mark redaction rules in metadata.

---

## 8) Database & Queries

* SQL in tagged helpers or views; prefer parameterized queries. No string concatenation.
* Enforce **FKs** and indexes; default `NOT NULL` unless justified.
* Migrations are backward-compatible (expand/contract). See migration playbook.
* RLS (phase 2): policies per table; ensure Clerk JWT → `current_setting('request.jwt.claims')` mapping.
* Use `LIMIT` and pagination; never load unbounded lists.

---

## 9) Jobs & Webhooks

* All jobs must be **idempotent**. Use `dedupe_key` and upserts.
* Exponential backoff with jitter. Max attempts set per job.
* Webhooks: 202 quickly; do heavy work in jobs. Log provider ids.

---

## 10) Logging, Metrics, Tracing

* Structured logs (JSON): `ts, level, requestId, orgId, userId, route, outcome, latencyMs`.
* Always attach a `requestId` and propagate to vendors via headers if available.
* Emit metrics for: request counts, p50/p95 latency, error rate, queue depth, provider latencies, token usage, storage egress.
* Add trace spans for upload, finalize, transcription webhook, docify, embedding, assistant completion.

---

## 11) Testing Strategy

* **Unit**: functions/components in isolation; mock external calls. Coverage goal: 80% for `lib/`.
* **Integration**: API routes with realistic inputs; hit staging DB if feasible in CI (shadow schema) or use dockerized Postgres locally.
* **E2E (optional)**: Playwright for critical journeys (record → finalize (mock) → docify (mock) → search).
* **Contracts**: JSON schema snapshots for API responses to detect breaking changes.
* **Security tests**: RLS policy tests (phase 2), webhook signature tests, rate-limit tests.

---

## 12) Performance Budgets & Guards

* Page TTFB ≤ 200ms for cached marketing; app pages aim ≤ 500ms server render.
* Client bundles: prefer ≤ 180KB gz per route group; dynamic import heavy libs.
* Upload concurrency default 4; chunk size 10MB; configurable by network.
* Assistant: top‑k ≤ 6; prompt tokens ≤ 3k by default.

---

## 13) Accessibility Standards

* WCAG 2.1 AA baseline.
* Ensure focus management on dialogs/menus; escape closes; tab trap prohibited.
* Provide keyboard shortcuts with help modal (`?`).

---

## 14) Code Review & PR Checklist

### 14.1 Review Philosophy

* Small, focused PRs (< 500 LOC diff preferred).
* Reasoned trade-offs; reference ADRs when relevant.

### 14.2 Checklist (copy into PR description)

* [ ] Types complete; no stray `any` (or explained `intentionally-any`).
* [ ] Inputs validated (zod) at boundaries.
* [ ] AuthZ enforced (org/role).
* [ ] Logs & metrics added for non-trivial paths.
* [ ] Errors mapped with requestId; no secret leakage.
* [ ] Tests added/updated (unit/integration).
* [ ] Docs updated (API/contracts/migrations).
* [ ] UI a11y pass (labels, focus, contrast).
* [ ] Bundle impact considered (if client changes).

---

## 15) Git Hygiene & Commits

* **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`.
* **Message rule**: imperative mood, ≤ 72 char subject; details in body if needed.
* **One feature/bug per PR.**

---

## 16) Feature Flags & Config

* Use `organizations.settings` JSONB and env flags. Read via `@/lib/env` and `getOrgSettings()`.
* Default safe; guard experimental paths behind flags.

---

## 17) Internationalization & Locale

* Content (transcripts/docs) may be non‑English. UI is English for MVP.
* Dates: store UTC; format in user locale on client.
* Numbers/currency: use Intl APIs on client.

---

## 18) Time, Precision & Math

* Always use milliseconds (number) in code; convert at edges.
* Avoid floating point accumulation for billing; use integers (cents, token counts) or `bigint`/decimal in DB.

---

## 19) Third‑Party Libraries Policy

* Prefer small, maintained libs; avoid abandoned deps.
* Add dep only if it removes meaningful complexity.
* Record rationale in PR for heavy deps (> 20KB gz client or complex server deps).

---

## 20) Example Patterns

### 20.1 Route Handler with Validation & RequestId

```ts
import { z } from 'zod'
import { authOrg } from '@/lib/auth'
import { httpError, withRequestId } from '@/lib/errors'

const Body = z.object({ query: z.string().min(1), scope: z.object({ recordingId: z.string().uuid() }).partial() })

export async function POST(req: Request) {
  const requestId = withRequestId()
  try {
    const { orgId } = await authOrg()
    const body = Body.parse(await req.json())
    const answer = await answerQuestion(orgId, body)
    return Response.json({ answer }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    const e = httpError.from(err)
    return Response.json({ code: e.code, message: e.message, requestId }, { status: e.status })
  }
}
```

### 20.2 Job Handler (Idempotent)

```ts
// worker/jobs/docify.ts
export async function docify({ recordingId }: { recordingId: string }) {
  const rec = await getRecording(recordingId)
  if (!rec || rec.status !== 'transcribed') return 'noop'
  if (await hasDocument(recordingId)) return 'dedup'
  const markdown = await runDocify(rec.transcript)
  await saveDocument({ recordingId, markdown, version: 'ai:1' })
  await enqueueJob('embed', { recordingId }, { dedupeKey: `embed:${recordingId}` })
}
```

---

## 21) Lint & Format

* ESLint extends `next/core-web-vitals`, `@typescript-eslint/recommended`.
* Prettier required; CI fails on drift. No custom print width unless needed.
* Additional rules:

  * forbid `console.log` in prod paths (use logger),
  * disallow `any` w/o comment,
  * `eqeqeq`,
  * `no-floating-promises` (via eslint‑plugin‑promise/ts‑eslint).

---

## 22) Secrets & Env Handling

* Centralized in `@/lib/env`. Never access `process.env` elsewhere.
* Rotate keys quarterly; document rotations in changelog.
* Mask secrets in logs; avoid echoing in errors.

---

## 23) Accessibility PR Gate

* Run Axe check for changed pages.
* Keyboard path demo in PR (gif or steps) for new interactive widgets.

---

## 24) Deprecation & Removal Process

1. Mark as deprecated in code comments + docs.
2. Feature flag old path off by default for new orgs.
3. Announce in release notes with timeline.
4. Remove after ≥ 2 minor versions and zero usage for 30 days.

---

## 25) Appendices

### 25.1 tsconfig (core parts)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

### 25.2 Prettier

```json
{ "singleQuote": true, "semi": false, "printWidth": 100 }
```

### 25.3 .editorconfig

```
root = true
[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

---

## 26) Non‑Negotiables (TL;DR)

* Validate at boundaries **every time**.
* No secrets on the client **ever**.
* Idempotent jobs & webhooks **always**.
* Org isolation at all layers.
* Tests for business logic and APIs before shipping.
* Observability on anything that costs money or can fail.


---

### database-schema.md
Database Schema and Design

This document describes the PostgreSQL database schema in detail. It lists each table, its purpose, key columns (with types), relationships (foreign keys), and any access rules or constraints. The schema is designed to support multi-organization data separation, the recording-to-document pipeline, and the vector search capabilities. All tables use singular names (for clarity) and are organized to minimize data duplication while ensuring efficient queries.

Overview

Our database is PostgreSQL with the pgvector extension enabled for vector similarity search. We use UUIDs as primary keys for most tables (except where noted) to have globally unique identifiers, especially since data is multi-tenant. The schema is normalized to avoid data anomalies, but we also consider indexing and query patterns to optimize performance.

Every table that is organization-specific will have an org_id column referencing the Organizations table. This ensures row-level security (RLS) policies can enforce tenant isolation (if using Supabase or custom RLS rules). For simplicity and clarity, all foreign keys (user_id, org_id, etc.) are explicitly stored rather than relying solely on an external auth token.

Below is a table-by-table breakdown:

Tables

1. users

Stores application users. Even though we use Clerk for authentication, we maintain a users table to track additional metadata and to join with content.
	•	user_id UUID PRIMARY KEY: Unique identifier for the user (we generate this, or we can use Clerk’s user ID as UUID if possible). Alternatively, we could use a text ID from Clerk (like user_abc123), but a UUID gives consistency.
	•	clerk_id TEXT UNIQUE: (Optional) The Clerk-provided user ID, if not using it as primary key. This helps link back to Clerk.
	•	email TEXT: User’s email address. (We may store this for convenience, even though Clerk has it, to use in RLS policies or to display in the UI without extra API calls.)
	•	name TEXT: Full name or display name.
	•	created_at TIMESTAMPTZ DEFAULT now(): Timestamp when the user was first registered in our DB.
	•	last_login TIMESTAMPTZ: (Optional) Last time the user logged in (could be updated via webhook or on session verify).

Purpose: This table holds core profile info and serves as the target for any foreign key that needs to reference a user (e.g., who created a recording). It might also be used for analytics (number of active users, etc.). Access: Generally, a user can view their own data here (via Clerk session) but not others’ personal info except maybe name. In an org context, user names/emails might be visible to org mates for identification.

Access Rules: If using RLS, we’d allow a user to select their own row (using something like auth.uid() = user_id if we include the sub in JWT). For admins, we might allow reading all users in their org via a join on membership (see below). However, we can also avoid exposing this table directly and fetch user names via our backend code when needed.

2. organizations

Represents an organization (tenant workspace).
	•	org_id UUID PRIMARY KEY: Unique identifier for the org.
	•	name TEXT: Organization name (e.g., company or team name).
	•	clerk_org_id TEXT UNIQUE: (Optional) If using Clerk Organizations, their ID for this org. We can store it to reconcile membership automatically.
	•	created_at TIMESTAMPTZ DEFAULT now(): When the org was created.
	•	created_by UUID REFERENCES users(user_id): Who created the org (usually the first user, automatically an admin).
	•	plan TEXT: The subscription plan or tier (e.g., “free”, “pro”, “enterprise”). This is updated via billing events, and can be used to enforce limits (like number of recordings).
	•	settings JSONB: (Optional) Misc org-level settings, e.g., whether public sharing is allowed, org logo URL, etc.

Purpose: Defines a tenant. All content is tied to an org. We will enforce that any user action is scoped to their current org. This also stores billing plan which might gate certain features or usage quotas.

Access Rules: Typically, only members of an org can see its details. RLS can enforce that a selecting user must be a member (we can maintain a membership table to check). Clerk’s JWT might carry org context; if so, auth.org_id() = org_id could be used in RLS. In our backend, we’ll fetch org info for display (e.g., show org name in UI). Non-members cannot see this table’s data at all.

3. user_organizations (Memberships)

Join table connecting users to organizations, with roles.
	•	user_id UUID REFERENCES users(user_id) ON DELETE CASCADE: The user in the org.
	•	org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE: The organization.
	•	role TEXT: Role of the user in the org (e.g., ‘admin’, ‘member’). We can default this to ‘member’ and have one user (creator) as ‘admin’, or use Clerk’s roles if syncing.
	•	joined_at TIMESTAMPTZ DEFAULT now(): When the user joined the org.
	•	invited_by UUID: Who invited the user (if applicable).

Composite primary key on (user_id, org_id) to ensure uniqueness of membership.

Purpose: Enables many-to-many between users and orgs (since a user can be in multiple orgs, and each org has multiple users). It’s central for permission checks. For example, to list all recordings a user can access, we ensure recordings.org_id IN (orgs the user is a member of).

Access Rules: A user should only see memberships for orgs they belong to. RLS example: user_id = auth.uid() allows a user to see their own membership entries (and thereby see which orgs they belong to, and their role). Alternatively, we might not expose this table directly in API, using it only for joins in server queries. For admin actions (like listing all members of my org), we could allow if org_id in a subquery of orgs where that admin has role ‘admin’.

4. recordings

Each row represents a recording (the source video content). This is a primary table in the pipeline.
	•	recording_id UUID PRIMARY KEY: Unique ID for the recording.
	•	org_id UUID REFERENCES organizations(org_id): The organization that owns this recording.
	•	user_id UUID REFERENCES users(user_id): The user who created/recorded it.
	•	title TEXT: A title for the recording (could be user-provided or auto-generated from content or filename). Defaults to something like “Untitled Recording” or the date if not set.
	•	description TEXT: (Optional) A brief description of the recording’s content.
	•	video_url TEXT: URL or storage key for the video file. If using Supabase, this might be a path like recordings/recording_id.webm. If using S3, a full s3 or CDN URL. We store it for retrieval. (We might also store a thumbnail_url or key if we generate thumbnails.)
	•	duration INT: Length of the video in seconds (for quick reference and UI).
	•	status TEXT: Current processing status. Allowed values: ‘uploaded’, ‘transcribing’, ‘transcribed’, ‘doc_generating’, ‘completed’, ‘error’.
	•	error_message TEXT: If status = ‘error’, details on what went wrong.
	•	created_at TIMESTAMPTZ DEFAULT now(): When recording entry was created (initiated).
	•	completed_at TIMESTAMPTZ: When processing (transcript+doc) was fully done.

Indexes: We’ll index org_id (since we often query recordings by org) and possibly user_id for filtering by creator. We might also index status if we frequently query incomplete items for a worker to pick up, but if we use external triggers, maybe not necessary.

Purpose: Represents the primary content object. The pipeline updates its status as things progress. We also use this table for listing content in the UI (e.g., “My Recordings”). Title and description help in identifying and searching. Relations: one recording has one transcript (see transcripts table) and one document (see documents table), and many transcript chunks (for vector search). We separate those for performance and size reasons.

Access Rules: Only members of the same org should access a recording. RLS: org_id = auth.org_id() (if JWT has org claim) ensures isolation. Additionally, we might allow only the owner or admins to delete or update certain fields. For example, allow anyone in org to read, but to delete or modify a recording, either the user_id matches the auth user (they own it) or the auth user has admin role via membership. This can be done with a check against membership on writes (Supabase RLS can use subqueries, or in our server logic we enforce it).

5. transcripts

Stores the full transcript text for each recording (one-to-one relationship).
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: Use the same ID as the recording for convenience (1-1). Also serves as primary key.
	•	text TEXT: The full transcript text (could be very long for lengthy videos). We store it as one large text blob.
	•	language TEXT: Language code (e.g., ‘en’, ‘es’) detected or used for transcription.
	•	transcribed_at TIMESTAMPTZ: When the transcription was completed.
	•	updated_at TIMESTAMPTZ: When the transcript was last updated (in case user edits it).
	•	words JSONB: (Optional) Could store structured data like an array of words with timestamps, or paragraphs with timestamps. Alternatively, we might have a separate table for timing if we want fine-grained search. But storing as JSONB is an option (e.g., an array of objects { word, start_time, end_time }).

Purpose: Holds the raw text output of the speech-to-text process. Kept separate to avoid slowing down queries on recordings list (we don’t want to always pull giant transcript text when listing recordings). Also, easier to manage updates to transcript without touching recording metadata. This is useful for search and for feeding to document generation.

Access Rules: Same as recording – accessible only within org. We usually fetch a transcript by joining with recording to ensure org context. One could also enforce via RLS that recording_id in a subquery of recordings the user has access to.

6. documents

Stores the AI-generated structured document for a recording.
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: 1-1 with recording (each recording has at most one doc, initially).
	•	content TEXT: The generated document content, likely in Markdown (or some markup). Could be quite long.
	•	summary TEXT: (Optional) A short summary or excerpt of the recording (if we generate a summary separately).
	•	generated_at TIMESTAMPTZ: When the document was first generated.
	•	updated_at TIMESTAMPTZ: When it was last edited by a user.
	•	generator_model TEXT: Which AI model was used (e.g., ‘gpt-4’ or ‘gpt-3.5’) for reference.
	•	version INT: Version number if we regenerate multiple times. Starting at 1.
	•	is_published BOOLEAN DEFAULT FALSE: Whether this document is marked for public sharing (see product-features on publishing). If true, an anonymous link can access it (with possibly another table to hold the token or just use recording_id in a hashed form).

Purpose: Contains the refined knowledge artifact. It’s stored separately since it’s a different representation of the content (not the verbatim transcript). The user can edit it, so it diverges from the transcript. We may want to track versions in the future (either here or separate table), but for now a single current content is stored.

Access Rules: Tied to recording’s org; same access. If is_published is true, we might allow read access without auth via a specific endpoint that checks this flag (or via a separate signed token). But within app, only org members can normally fetch it. Edits should be allowed to the recording owner or any member (depending on collaboration decisions). Possibly only owner and admins can edit docs – we’ll enforce in app logic or via RLS (we could allow update if user_id = auth.uid() or user is admin).

7. transcript_chunks

Stores chunks of transcript or document content for vector embedding. Each row is a semantic chunk with its embedding vector.
	•	chunk_id BIGSERIAL PRIMARY KEY: Unique ID for the chunk (could use UUID, but serial is fine since mainly internal).
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Which recording this chunk is from.
	•	org_id UUID: Denormalization of org (we might store org_id here as well for easy filtering without join, because we will often filter by org when querying vectors).
	•	text TEXT: The content of this chunk (a sentence or paragraph from transcript or doc).
	•	embedding vector(1536): The embedding vector for the text, using pgvector type. (1536 dim if using OpenAI’s Ada, adjust if using a different model).
	•	index INT: The position of this chunk in the source transcript/doc (like chunk 0,1,2…). This could help if we need to reconstruct context or for debugging results order.
	•	source_type TEXT: Indicates origin of chunk, e.g., ‘transcript’ or ‘document’. We might choose to embed only transcripts initially (then source_type might not be needed). But if we embed both, this helps to know where the text came from.
	•	metadata JSONB: (Optional) Additional metadata like {"start_time": 120.5, "end_time": 150.0} if chunk aligns to a portion of video, or section titles.

Indexes: A vector index for embedding (HNSW or IVF index via pgvector) for similarity search. Also an index on org_id so we can efficiently apply org filter (some queries might do WHERE org_id = X ORDER BY embedding <-> query limit k, which will use the ivfflat index that can include an additional condition, or we might need a partial or separate approach; HNSW in pgvector can support an additional filter in the WHERE clause).

Purpose: This is the backbone for semantic search. By chunking the text, we capture fine-grained pieces of knowledge. Each chunk is like a Q&A snippet that the AI assistant can use. We separate it to optimize vector operations (we don’t run those on the full text), and to allow limiting search to an org easily. Also, if we use Pinecone later, this table’s data would be what we sync to Pinecone.

Access Rules: Only accessible within org. If someone somehow queried this table, they should only see rows where org_id matches theirs. RLS: org_id = auth.org_id(). In practice, our app will not directly expose this table; instead, the backend will perform vector searches and return results in a user-friendly way. But RLS is a good safety net.

8. jobs (or pipeline_tasks)

Optional: Track asynchronous pipeline jobs for processing. This can log steps like transcription, doc generation, embedding.
	•	job_id UUID PRIMARY KEY: ID for the job.
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Related recording.
	•	type TEXT: ‘transcription’ | ‘doc_generation’ | ‘embedding’ etc.
	•	status TEXT: ‘pending’ | ‘in_progress’ | ‘completed’ | ‘failed’.
	•	created_at TIMESTAMPTZ DEFAULT now().
	•	started_at TIMESTAMPTZ.
	•	finished_at TIMESTAMPTZ.
	•	error_message TEXT: if failed.
	•	attempt INT: attempt count for retries.

We might not need this if we handle state just in recordings.status and use external services for workflow. But if multiple jobs can run or be retried, tracking here helps. For example, if doc generation fails but transcript is fine, we could just mark that job failed and allow retry without resetting transcription status.

Purpose: Provide resilience and audit trail for background tasks. Could be used by a worker process to pick up pending jobs in queue (if we use DB as queue), or just to store events from external webhooks (like “transcription done”).

Access Rules: Orgs probably don’t need direct access; it’s internal. But if needed (maybe to show an admin a pipeline log), we’d restrict by org via join on recording.

Relations and Notable Constraints
	•	A user can belong to many orgs (user_organizations), and an org has many users.
	•	A recording belongs to one org and one user (owner). An org has many recordings; a user can have many recordings (those they created).
	•	Transcript and Document are each 1-1 with Recording (sharing the same primary key ID as recording_id). This means we can use LEFT JOIN transcripts ON recordings.recording_id = transcripts.recording_id to get transcript data easily in queries.
	•	Transcript_chunks are many-to-1 with Recording. They also have org stored to ease filtering.
	•	Delete behavior:
	•	If a recording is deleted, cascade to transcript, document, chunks, jobs – so no orphan data.
	•	If a user is removed, we might keep their recordings (since knowledge stays with org). We may set user_id to NULL or to a special “deleted user” marker, rather than cascade delete recordings. So perhaps user_id should be nullable and on user deletion we do a soft approach. But with Clerk, user deletion is rare. We’ll keep ON DELETE CASCADE on user_organizations, but not on recordings.user_id. Instead, handle in application if needed (or disallow user deletion if it has data).
	•	If an org is deleted (like a company offboards), we cascade to all recordings and related data to truly wipe it. Or we might soft-delete orgs for safety.
	•	Row Level Security (RLS): If using Supabase or Postgres RLS, we enable it on all tables. Example policies:
	•	For recordings: SELECT policy: org_id = current_setting('jwt.claims.org_id')::uuid (in Supabase’s case, they might cast the claim). Similar for transcripts, docs, chunks by joining or since they share org via recording or direct field.
	•	Insert: Only allow if the org_id of the new row is one of the orgs the user is member of (we can check via membership table – a subquery like EXISTS (SELECT 1 FROM user_organizations m WHERE m.org_id = new.org_id AND m.user_id = auth.uid())).
	•	Update/Delete: Only if user has permission – either owner or admin. Could check membership role or recording.user_id for updates. Alternatively, in app logic we enforce those for now.

If using Supabase, we’d heavily rely on RLS with the JWT. If not, our API endpoints will implement these access checks manually using the membership info from Clerk (e.g., clerk provides current org and role in session, or we query our membership table for that user and org).

Example Schema (DDL Excerpts)

Below are representative DDL statements for a subset of tables to illustrate:
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

CREATE TABLE organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    clerk_org_id TEXT UNIQUE,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(user_id)
);

CREATE TABLE user_organizations (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, org_id)
);

CREATE TABLE recordings (
    recording_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    title TEXT,
    description TEXT,
    video_url TEXT,
    duration INT,
    status TEXT NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Transcript & document share ID with recording:
CREATE TABLE transcripts (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    text TEXT,
    language TEXT,
    transcribed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    words JSONB
);

CREATE TABLE documents (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    content TEXT,
    summary TEXT,
    generated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    generator_model TEXT,
    version INT DEFAULT 1,
    is_published BOOL DEFAULT FALSE
);

CREATE TABLE transcript_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    text TEXT,
    embedding vector(1536),
    index INT,
    source_type TEXT,
    metadata JSONB
);
-- Index for vector search (pgvector):
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat (embedding) WITH (lists=100);
CREATE INDEX idx_chunks_org ON transcript_chunks(org_id);

(We would also create indexes on recordings for org_id, maybe on user_id, etc., and perhaps a composite on org_id + recording_id for quick org scoping.)

Note: The actual SQL might differ slightly depending on whether we use Supabase (which would use auth.uid() instead of a direct JWT setting). The above is illustrative.

Data Access Patterns
	•	Listing Recordings: Query SELECT recording_id, title, status, created_at, user_id FROM recordings WHERE org_id = currentOrg ORDER BY created_at DESC. Possibly join users to get name of owner for display. Since transcripts and docs are not needed in the list, we don’t join them here.
	•	Viewing a Recording Detail: Query recordings by id (with org check), join transcript and document. E.g., SELECT r.*, t.text, d.content FROM recordings r LEFT JOIN transcripts t ON r.recording_id=t.recording_id LEFT JOIN documents d ON r.recording_id=d.recording_id WHERE r.recording_id = X AND r.org_id = currentOrg. This fetches everything needed (video URL, status, transcript text, doc content).
	•	Vector Search: We will run a function to search chunks. For example, in Postgres: SELECT recording_id, text, (embedding <-> query_vec) AS distance FROM transcript_chunks WHERE org_id = currentOrg ORDER BY embedding <-> query_vec LIMIT 5;. This returns top relevant chunks and which recording they belong to. We then likely join or map back to get perhaps the recording title or doc content around that. We might store enough context in metadata (like chunk start time or chunk order) to allow fetching neighboring chunks if needed for more context.
	•	Maintaining org isolation: If using RLS, these queries automatically restrict by current user’s org claim. If not, every query in our backend includes an org filter derived from session info. This double layer ensures a query can never mix data from multiple orgs.
	•	Deletion cascade: When a recording is deleted (by user action or org cleanup), the database will remove its transcript, document, chunks, and any jobs referencing it. We need to ensure to also delete the actual video file from storage separately (that’s outside DB scope).

Access Control Summary

We rely on a combination of:
	•	Application-level checks: Our API endpoints will verify that the current session user is allowed to perform the action (e.g., only owner or admin can delete a recording, as per business rules).
	•	Database constraints/RLS: To enforce tenant isolation and basic access:
	•	RLS ensures a user can’t query or alter data outside their org even if they somehow manipulate an API call.
	•	The schema itself (foreign keys and cascades) prevents data inconsistencies (e.g., can’t have a recording with an org_id that doesn’t exist, etc.).

If using Supabase, each request will carry a JWT with sub = user_id and org_id (we might customize Clerk’s JWT to include org_id and role in custom claims, or use Supabase JWT if we sync users to Supabase). Then RLS policies use those. If not using Supabase RLS, our Node backend will query with proper filters and never expose raw table access to the client.

Future Schema Considerations
	•	We might introduce a comments table (recording_comments) with fields (comment_id, recording_id, user_id, text, timestamp) to allow discussion on recordings. This would reference recordings and users and be isolated by org via the recording join.
	•	A billing table could track Stripe subscription IDs, customer IDs, etc., possibly linking to organizations.
	•	For analytics, a events table could log things like “user X asked question Y at time Z” or “video viewed” but this might also be handled by an external analytics service rather than clogging our primary DB.
	•	If we allow tags or categories on recordings, a tags table and a join table recording_tags could be added to filter and organize content (with org context).
	•	If performance becomes an issue with the vector search in Postgres at scale, we might stop adding to transcript_chunks and instead use an external vector DB. In that case, transcript_chunks would either be replaced or only used for testing, and Pinecone would hold vectors. But we would keep something like transcript_chunks schema for the sake of data completeness and perhaps to allow local fallbacks or migrations.

Every column and relationship in this schema is chosen to support the features described in product-features.md and the flows in implementation-pipelines.md. By having a clear schema, we enable straightforward implementation of features and maintain data integrity as the system scales.

---

### product-features.md
Product Features and Rationale

This document provides a comprehensive breakdown of the SaaS app’s features, organized by domain area. For each feature or group of features, we describe what it is, why it exists (rationale), and how users are expected to interact with it. This helps engineers and AI agents understand the scope of the product and the reasoning behind design decisions.

Recording & Capture Features

1. Screen and Camera Recording (Browser-Based):
Feature: Users can record their screen (specific application or entire desktop) along with their webcam and microphone, directly from the browser. The UI allows choosing which screen or window to capture and toggling the webcam on/off (webcam feed appears as a small overlay, e.g. picture-in-picture style). The user can start, pause, resume, and stop the recording.
Rationale: The core of our product is capturing expert knowledge in an easy way. Screen recording with voice (and optional face video) lets an expert show and tell a process or concept without writing anything. Including the camera personalizes the content, which can aid engagement and clarity. Browser-based capture means no installs required, lowering the barrier to usage.
Expected Behavior: The user clicks “New Recording” in the app, is prompted by the browser to select what to share (screen) and to allow camera/mic. Once granted, they see a recording toolbar (e.g., a small control panel with a timer, pause/stop buttons). They carry out their demonstration or explanation while the app records. They might pause if needed (e.g., to switch a window or take a break) and then resume. On clicking stop, the recording finalizes: the user is then taken to the next step (upload or processing screen). The video data is uploaded in the background (if not already during recording) and the user is informed that transcription is in progress.

2. Live Notes Bookmarking (Planned):
Feature: (Planned for future) During recording, the user can hit a “bookmark” hotkey or button to mark important moments. They might also be able to type a quick note or label for that bookmark.
Rationale: This helps the expert highlight key points or sections while recording, which can later be used to structure the document or allow viewers to jump to that point. It bridges the gap between freeform recording and structured output by letting the expert impose some structure on the fly if they want.
Expected Behavior: While recording, if the user hits (for example) the “B” key or clicks a “Add Marker” button, the app records the current timestamp and possibly opens a small text input for a note. The expert can jot “Important tip here” or similar. These markers are saved and will appear on the timeline for reference once the recording is processed (e.g., on the video player, and in the transcript as highlighted lines). This feature would be optional and introduced once basic flow is stable.

3. Multi-Stream Capture Composition:
Feature: The app captures multiple streams (screen, webcam, audio) and merges them into one recording. We implement this by drawing video streams into a single canvas or combining tracks so the output is a single file with all streams.
Rationale: This is largely a behind-the-scenes feature, but it ensures the end video is convenient (one file) and the webcam overlay is burned into the video. It avoids having to manage separate files for screen and camera. For the user, it just works seamlessly – they see their face in the corner of the recording as it’s happening and in the final playback.
Expected Behavior: The user doesn’t directly interact with this logic. They simply choose to record with camera on, and the system handles merging. From an engineering perspective, we expect a slight performance cost on the client (due to canvas compositing) and we must manage that (e.g., rendering at a reasonable resolution/frame rate to balance quality and performance). The end result should be a standard format video (e.g., webm with VP8/VP9 + Vorbis if using Chrome’s default, or mp4/H.264 if using certain browsers) that can be played back easily in the app.

4. Re-record and Editing (Basic):
Feature: If a user is not satisfied with a recording, they can discard it and record again. After stopping a recording, before they leave the recording page, we may offer a preview and a “Retake” option. Basic editing (like trimming the start/end) might be offered after recording.
Rationale: Experts may make mistakes or want a do-over. Providing a quick way to retry keeps the user from getting frustrated with a one-take outcome. Trimming helps remove idle time at start or end (like “Oh is this recording? … Ok let’s start.” moments).
Expected Behavior: After stopping, the video might be shown with a “Retake Recording” button. If clicked, the current recording is scrapped (not uploaded) and the user can immediately start a new one. For trimming, a simple slider UI to cut off a few seconds from start or finish can be presented. The user adjusts, then confirms. Trimming would be done either in browser (if feasible for small trims using MediaRecorder’s data) or on server after upload.

These recording features focus on making capture easy and high-quality. The rationale is always to minimize friction for the expert while ensuring the output contains all needed context (screen + voice + face).

Transcription Features

1. Automatic Speech-to-Text Transcription:
Feature: Once a recording is uploaded, the audio track is automatically transcribed to text (via our transcription service). This produces a full transcript of everything said in the video.
Rationale: The transcript is the foundation for search, document generation, and accessibility. Having text means the content is easily skimmable and indexable. Automated transcription saves the user from ever having to manually transcribe or jot notes. It’s crucial for speed and for the subsequent AI processing.
Expected Behavior: The user doesn’t have to click anything – after recording, they see a status like “Transcribing audio…”. The system sends the audio for transcription. In a few minutes (depending on length), the transcript is returned. The user might get a notification (“Transcript ready!”). When they open the recording’s page, they see the transcript text aligned with the video (e.g., displayed as an interactive transcript where clicking a line jumps the video to that point, if possible). The transcript accuracy is high but not perfect, so some words might be wrong – the user can later edit if needed (see next feature).

2. Transcript Editing & Annotation:
Feature: Users can edit the transcript text in the app. This is like a lightweight text editor on the transcript. They can correct any transcription errors, redact sensitive info, or annotate sections. Edits do not change the original video/audio, just the text.
Rationale: No transcription is 100% perfect, especially with domain-specific terms or names. Allowing edits means the user can ensure the transcript’s accuracy and usefulness. Annotations (like adding a comment or highlighting an important sentence) can help later when generating the doc or for readers of the transcript. Essentially, it gives some control back to the user to refine the AI output.
Expected Behavior: Once the transcript is available, in the recording detail page the user can click into the transcript text and type to change it (inline editing). We might implement this with a rich text component. Edits are autosaved (or saved with a button). Perhaps a “Mark as final” toggle to indicate they’ve reviewed it. If the user changes wording significantly, we don’t re-run the AI processing automatically (to avoid confusion), but we might prompt “If you edited a lot, consider regenerating the summary doc.” The user can also highlight text and leave a comment (if we support comments) or mark a segment as important for their own reference.

3. Timestamp Alignment and Playback Sync:
Feature: The transcript is time-aligned with the video. Each sentence or word knows the timestamp in the video. This allows features like: clicking a transcript line jumps the video, and as the video plays, the current spoken text is highlighted in the transcript.
Rationale: This improves user experience for consuming the content. Someone might prefer reading but want to hear a certain part – they can click the text to play that segment. Or as they watch the video, they can follow along in text (useful if audio quality isn’t perfect or for accessibility). It also helps the AI assistant later to reference “at 5:32, the user explained X”.
Expected Behavior: The transcription service we use (like Whisper) may provide word-level or sentence-level timestamps. We store these. In the frontend, we use them to map video currentTime to transcript position. The user sees a subtle highlight following along the transcript. They can scroll through text and double-click a sentence to play from there. This requires a bit of UI synchronization logic. For editing, if the user edits text, we might maintain the original timings for reference (unless re-aligned later).

4. Multi-language Support:
Feature: The transcription supports multiple languages (e.g., if the expert speaks in Spanish or French, we can still transcribe, possibly auto-detected or by user selection).
Rationale: Many teams are multilingual. Supporting at least major languages out-of-the-box broadens our market and makes the tool useful in non-English contexts. Even if our UI is English-only initially, the content captured can be other languages.
Expected Behavior: Ideally the transcription API auto-detects language. If not, we might let the user specify the spoken language before recording or before transcription. The rest of the flow remains the same. The generated document and AI assistant would then operate in that language for that piece of content. (We’d have to prompt the LLM accordingly to output in the content’s language). We expect initial use mostly in English, but this feature ensures we’re not hardwired to English transcripts.

5. Speaker Identification (if needed):
Feature: (If multiple speakers present) Identify speakers in the transcript (e.g., Speaker 1 vs Speaker 2), such as if an expert and a colleague were both speaking in a recorded Zoom call.
Rationale: If our use-case expands to recording meetings or interviews, distinguishing speakers is important for readability. It might not be heavily used in single-expert monologue scenarios, but it’s a nice capability if two voices are present.
Expected Behavior: The transcript service might label speakers if it has that feature (some APIs do). Otherwise, we likely won’t implement this in early version. If implemented, the transcript would show e.g. “Alice: … Bob: …” for different voices. The user could also edit these labels (because detection isn’t always accurate). This feature is lower priority unless we see users recording dialogues often.

Transcription features ensure that once the video is recorded, we have a text version that’s accurate and user-refined. The rationale behind each is to maximize the utility of the transcript: it should be correct, easy to navigate, and ready for the next steps (document generation and search).

Document Generation (“Docify”) Features

1. Automated Structured Document Creation:
Feature: After transcription (and optionally after user edits), the system automatically generates a structured document from the transcript. This can be a Markdown or HTML document with sections, headings, bullet points, code blocks (if code was mentioned), and other formatting to make it readable and structured.
Rationale: A raw transcript is often a verbatim dump – hard to read and not well-organized. The goal of “Docify” is to turn that into something resembling a user manual, guide, or article that captures the essence of what was taught in the video. This saves huge time for the expert, who would otherwise have to manually write documentation. It also makes the content more consumable for others (someone can read the summary doc instead of watching a long video).
Expected Behavior: Once the transcript is ready, the user sees a status like “Generating document…”. We prompt an LLM in the backend with the transcript (or segmented parts of it) to create an organized doc. The result is stored and displayed perhaps alongside the transcript. For example, if the expert recorded a how-to on configuring a server, the structured doc might come out with an introduction, a list of steps, code blocks for commands said, and a conclusion. The user can open the “Document” tab on the recording page and see this formatted output. The first version is fully AI-generated.

2. Document Editing & Versioning:
Feature: Users can edit the generated document to refine or add missing details. The document is stored so that further changes by the AI won’t override user edits without consent. Potentially, we keep versions (initial AI version, and then user’s edits as the current version).
Rationale: The AI does heavy lifting, but the expert might want to tweak phrasing, fix any mistakes the AI made, or add extra context. Editing capability ensures the final document can meet high standards of accuracy and style that the organization may require. Versioning is important so that if the user regenerates the doc later (say after editing transcript or after an improved model), we don’t silently lose their manual edits.
Expected Behavior: In the UI, the doc appears as rich text (or Markdown editor). The user can click “Edit” which turns it into an editable area. They can make changes (formatting toolbar for basic styles, or directly editing Markdown). We might auto-save changes or have a save button. The system could highlight which parts were AI-generated vs edited by the user for clarity. If we support version history, a user could revert to the AI original or see changes. Likely we start simpler: one editable version that once edited, is considered the source of truth unless the user deliberately regenerates.

3. Regeneration Options (Docify):
Feature: The user can trigger regenerating the document. Options might include “Regenerate full document” (which reruns the AI on the latest transcript) or future enhancements like “Summarize to X length” or “Focus on bullet points”.
Rationale: AI generation might not get it perfect on first try, or the user may update the transcript and want a new doc reflecting changes. They might also want different formats (maybe one version as a quick summary, another as a detailed guide). Providing regeneration allows for iteration. It’s also a way to incorporate improvements (if our prompts or model improve later, the user can re-run to get a better structured doc).
Expected Behavior: A “Regenerate Document” button is present near the doc. Possibly a dropdown with options like “Regenerate (overwrite)” or “Generate new version”. If clicked, we warn if it will overwrite their edits. Perhaps we let them generate a second version for comparison. The user waits a short time as the AI runs again. The new output is then displayed. If we see common desires (like “make it more concise” or “include code examples”), we could add toggles or prompt enhancements for those, but initially it’s just a re-run of the same process.

4. Document Templates (Future):
Feature: (Planned) Ability to choose a style or template for the document. For example: “Tutorial style” vs “Summary memo” vs “Slide deck outline”. This would guide the AI generation to different formats.
Rationale: Different use cases might want the output in different forms. One might want a step-by-step tutorial, another might want a one-page executive summary of a talk. By allowing template choices, we cater to more needs and make the feature more flexible. This is a future idea once we have baseline doc generation working reliably.
Expected Behavior: The user might see a dropdown or set of buttons before generation like “Generate as: [Guide/Documentation] [Summary] [Q&A Handbook]”. Selecting one changes the prompt for the AI. The output is then tailored. The user can regenerate with different templates to see which they prefer. For initial version, we likely default to a general guide format.

5. Publishing/Exporting Documents:
Feature: Users can export or share the structured document. Export formats might include PDF, Word, or a Markdown download. We may also have a “Publish to knowledge base” toggle that makes the doc accessible via a public (or internal) URL.
Rationale: Once the doc is created and edited, it becomes a valuable knowledge asset. Users will want to share it – maybe put it on an internal wiki, send to a colleague, or include in a report. Exporting makes our product’s output portable (not locking content inside). Publishing internally (within the app) with a link allows quick sharing without the friction of copy-paste.
Expected Behavior: On the doc page, options like “Download Markdown” or “Export PDF” will be available. We’ll use a Markdown-to-PDF library or similar for that. For publishing, if enabled, we generate a unique URL (maybe our site has a /pub/doc/<id> route) that anyone with the link can view (read-only). The user can send this link to others. They can also revoke/unpublish if needed. This essentially turns the doc into a mini web page, possibly including the video or transcript if we choose. If we support public publish, we’ll ensure the user understands what data becomes public (maybe limit to within org or password-protect initially). This drives adoption too – recipients of the shared content may become interested in the platform.

The document generation features are aimed at maximizing the usefulness of the captured knowledge. The rationale is always that the expert’s effort of recording should multiply into various forms of knowledge with minimal additional work. We want the structured docs to be as good as something a human would author given the transcript, and give the user control to refine it. Over time, these docs can form a knowledge repository for the team.

Vector Search & AI Assistant Features

1. Semantic Search (Vector Search):
Feature: Users can search their content semantically by asking questions or entering keywords in natural language. The system will find relevant parts of any transcript or document, even if the exact keywords differ. This is powered by vector similarity matching of embeddings.
Rationale: Traditional keyword search is limited – users might not recall exact phrasing used in a video. Semantic search understands the query’s meaning and finds related information in the transcripts/docs. This is crucial because it transforms the collection of videos/documents into a queryable knowledge base. It addresses the core pain: “Somewhere in all these recordings, the answer exists – how do I find it quickly?”
Expected Behavior: In the dashboard or a dedicated “Assistant” page, there’s a search bar or chat box. If the user types a query like “How do I reset the database connection?”, the system will:
	•	Convert the query to an embedding,
	•	Search the vector index for the closest matches (limited to that user’s/org’s data).
	•	Return a list of results: possibly specific segments of transcripts or docs that are relevant. We might show a snippet of the text and which recording it’s from, with a link.
For a better UX, this is integrated with the AI Q&A (next feature), but even a direct search result list is useful. The expected result is that even if the transcript said “restart the DB connection pool” and user asked “reset database connection”, the semantic search can match those as similar concepts.

2. AI Q&A Assistant (Chatbot):
Feature: A conversational assistant that can answer questions by drawing from the recorded knowledge. The user interacts in a chat interface, asking something like “What steps did Jane mention for configuring the firewall?” The AI then finds relevant context from the transcripts/docs and formulates an answer, often with references (like “According to Jane’s recording on Network Setup, the steps are X, Y”).
Rationale: This is a marquee feature that makes the knowledge easily accessible to non-recorders. Team members who didn’t watch a video can still ask questions and get answers as if they consulted the expert. It leverages the combination of transcripts + vector search + LLM to provide a natural, quick way to get information. This drives value for consumers of the content, not just the creators.
Expected Behavior: The assistant is available in a chat UI (perhaps on its own page or as a sidebar in the recording detail page for context-specific Q&A). The user asks a question in text. The backend uses a retrieval augmented generation approach:
	•	It vector-searches the query against our embeddings (filtering to the current org’s data).
	•	It takes the top relevant excerpts (maybe sentences or paragraphs from transcripts/docs).
	•	It feeds those, along with the question, into an LLM (OpenAI GPT-4/3.5) to get a composed answer.
	•	The answer is then streamed to the UI (token by token, for a nice experience). The answer might say, “To configure the firewall, you need to open the settings, go to Security > Firewall, then add a new rule…” with a citation or reference to the source video/doc (which we can hyperlink).
The user can then ask a follow-up question, and the assistant will keep the context (we may maintain a short dialogue memory plus always refer back to the knowledge base for each query). The chat feels like talking to a knowledgeable colleague who has watched all the videos.

3. Contextual Assistant (within Recording):
Feature: When viewing a specific recording’s page, the AI assistant can answer questions scoped to that recording. For example, on a video page, a user might ask “What were the key takeaways here?” and the assistant will summarize or answer based only on that video’s content.
Rationale: Sometimes a user is consuming one piece of content and wants a quick clarification or summary without searching the whole org database. A context-limited assistant improves the experience of that single recording. It’s like an AI that you can ask “explain this differently” or “what did they mean by X in this video?”
Expected Behavior: On the recording detail page, we might have a Q&A box pre-loaded with that recording’s context. The system knows to filter vector search to that recording or even just use the transcript directly for answers. If a user asks a question, the assistant can even quote the transcript from earlier in the video. We expect this to be used for clarifications (“When in the video did they mention database? – Answer: around 12:45 mark, they said ‘…’”) or summarization (“Summarize this video – Answer: [summary]”). This is basically the same mechanism as global assistant but with a filter = current recording only, and possibly some UX cues that it’s in “local mode”.

4. Multi-Document Query (Cross-video):
Feature: The assistant can combine information from multiple recordings/documents to answer a question.
Rationale: Often knowledge is distributed. One video might cover A, another B, but a question might need both. Our AI should be able to retrieve bits from multiple sources. E.g., “How do I set up the database and connect it to the server?” – maybe one recording was about database setup, another about server config. The assistant should pull from both to give a complete answer.
Expected Behavior: When the user asks a broad question in the global assistant, the vector search likely returns top snippets that could be from different recordings. The LLM will see all those and try to synthesize. We should present the answer with references to each source snippet (e.g., “From Database Setup video: …; and in Server Config doc: …”). The user might get an answer that merges knowledge, which is powerful. We have to ensure the context we give the LLM isn’t too large (so we might limit to top 3-5 relevant chunks for now). If needed, user can clarify or follow up.

5. Filters and Namespace Isolation:
Feature: Users (especially org admins) can restrict searches to certain subsets of content using filters. For instance, filter by tag or by a specific project. Additionally, each organization’s data is isolated – the assistant will never use data from another org.
Rationale: Privacy and relevance: We must guarantee that one company’s query doesn’t leak answers from another’s data. That’s handled by namespace isolation at the database level and in any vector index (each org is a separate namespace). Filters allow the user more control, e.g., “Search only in Finance videos” if they categorize content. This can improve result precision especially as the knowledge base grows.
Expected Behavior: By default, the assistant implicitly filters to the current organization (we include org_id in every query to the vector DB). If we use Pinecone later, we use separate Pinecone namespaces or metadata like org_id to ensure isolation. The user might see an UI element to refine search scope: maybe a dropdown of tags or a checkbox “This folder only”. Implementing tagging/categorization might be a later feature, but we design the search to handle a filter parameter. The assistant should respect it (only pass vectors from allowed set). In a multi-org scenario, if the user switches org context, the assistant context switches too (e.g., only that org’s data is loaded). Essentially, each org’s data is siloed by design.

6. Proactive Suggestions:
Feature: (Future idea) The assistant can proactively suggest answers or content as the user types a query (auto-complete with knowledge) or highlight new content (“You have a new recording about X, ask me about it!”).
Rationale: This isn’t core, but could enhance UX by making the system feel intelligent and helpful. For instance, if a user just uploaded a video about “Onboarding process”, when they go to the assistant, it might suggest “New: Onboarding process – ask me something like ‘How do I create a new account?’” This drives engagement with the new content. Auto-complete could help formulate better queries or discover terminology that exists in the content.
Expected Behavior: We would need to gather frequent queries or use an index of terms from transcripts to implement suggestions. This is down the line. Initially, we might simply show recent recordings or popular questions on the assistant page as static suggestions.

The vector search and assistant features are all about unlocking the knowledge captured in recordings and documents. The rationale is to enable users (especially those who didn’t create the content) to get answers quickly without wading through hours of video. It turns our platform from just a repository of info into an active knowledge provider. By grouping these features, we see that we need robust backend support (vector indexes, isolation by org, integration with LLMs) and a smooth UI for asking questions and viewing answers.

Collaboration & Organization Features

1. Multi-Organization (Tenant) Support:
Feature: The platform supports multiple organizations, meaning a user can belong to one or more org workspaces. Each organization has its own separate set of recordings, docs, and members. Users can switch between orgs if they belong to several (e.g., a contractor might work with two companies, each with their own knowledge base).
Rationale: This is crucial for B2B SaaS – each customer (company/team) gets a private space. It ensures data separation (security) and also reflects real-world use: companies don’t want their data mingled. For our internal use, it also allows development/test orgs separate from live. Clerk’s organization feature gives us much of this out-of-the-box.
Expected Behavior: When a user signs up, they might create an organization (e.g., “Acme Corp”) or join an existing one via an invite. In the UI, if a user has access to multiple orgs, a selector (perhaps a dropdown with org name) is available in the header. Switching orgs changes all the content to that context (the URL might even include an org slug if we implement that, e.g., acme.app.com or /org/acme/…). Each org has its own admin(s) who can manage membership. We store org_id with every relevant record to enforce backend isolation. The user’s role in the org (admin or member) dictates what they can do (see roles below).

2. Roles and Permissions:
Feature: Role-based access control within an organization. At minimum, roles like Admin and Member exist. Admins can invite/remove users, change settings, and access all recordings. Members (non-admin) can create recordings and view the org’s recordings, but maybe cannot delete others’ content or manage the team. Possibly a Viewer role could be considered (view content but not create).
Rationale: Not all users are equal in a team setting. We want to prevent accidents (only admins delete or publish content globally) and support enterprise needs (maybe only certain people can manage billing). Clerk Organizations come with a default role set which we can use or extend. This ensures security (e.g., a member shouldn’t access billing or remove someone).
Expected Behavior: The system likely uses Clerk’s org roles: e.g., “basic_member” vs “admin” (Clerk allows custom role names). In the UI, admin-only features (like the Settings -> Organization page, or deleting a recording not your own) are only shown if your role is admin. On the backend, any admin-level action double-checks the user’s role. We might also restrict some features in future (like perhaps only an admin can publish a document publicly). Invitations by admin default new users to member role. If needed, roles can be changed in an org settings screen.

3. Collaboration on Content:
Feature: Multiple users in the same org can collaborate on the knowledge. This includes:
	•	Viewing each other’s recordings and documents (by default, all content in an org is shared with all members, unless marked private).
	•	Possibly co-editing or commenting on transcripts/docs.
	•	Leaving comments or questions on a recording (outside of the AI assistant context, a manual comment feature).
Rationale: Since this is aimed at teams, the content created by one expert should benefit others. Collaboration features ensure knowledge flows. Commenting is useful if a viewer has a question or suggestion – it’s like adding human feedback separate from the AI. Co-editing might be useful if, say, an assistant wants to clean up the boss’s transcript for them.
Expected Behavior: By default, when Alice in org Acme records something, Bob (also in Acme) can see it on the dashboard. He can click it, watch, read transcript, etc. If Bob has a question, he could either use the AI assistant or leave a comment that Alice gets notified about (“What did you mean by step 3 here?”). For editing, if we allow it, maybe admins can edit any doc to polish it (with a history of who changed what ideally). Comments would appear in a sidebar or inline, tagged with user and timestamp. This is akin to Google Docs comments or YouTube video comments at timestamps. It’s a complex feature so maybe not in MVP, but conceptually we plan to support team collaboration in refining content.

4. Sharing Outside Organization:
Feature: Ability to share content with people outside the org. This could be a public share link for a document or a video, with optional password protection. Or an “external user” concept where you invite someone to view a specific item (without full org access).
Rationale: Sometimes an expert’s recording might be useful to clients or a broader community. While our focus is internal knowledge, enabling controlled external sharing increases flexibility. It could also serve as a marketing vector (a public doc might show “Created by DocuVision” branding, attracting new users).
Expected Behavior: On a recording or doc, an owner or admin could toggle “Share publicly” which creates a unique URL. Anyone with that URL can view the document (and maybe play the video) but not see any other content. They won’t have access to the AI assistant unless we allow a limited Q&A on that single content (interesting idea but complicated licensing wise if they aren’t a user). For more controlled sharing, we might allow adding a specific user by email with view-only rights to a particular item (which would send them an invite link). Initially, likely just a simple public link with a disclaimer “Anyone with link can view – use for external sharing carefully.” When active, maybe show a badge “Public” on that item. The system logs or counts public views so we know usage.

5. Notifications:
Feature: Notify users about relevant events, e.g., “Your transcription is complete”, “John uploaded a new recording: ‘Onboarding 101’”, “Jane commented on ‘Server Setup’”. Notifications can be in-app (badge or notification center) and optionally email.
Rationale: Keeps users engaged and informed. If a process finishes (transcription/doc ready), the user should know without constantly checking. Team members might want to know when new knowledge is added. Comments or mentions require notifying the involved users to prompt a response. Timely notifications improve collaboration and make the app feel responsive.
Expected Behavior: We’ll implement a lightweight notification system. For example, when a pipeline finishes generating a doc, we create a notification in our DB for the owner. If they’re online, maybe a toast popup says “Document ready to view”. If not, an email could be sent saying “Your recording ‘XYZ’ has been processed – click here to view the results.” For team events, perhaps a daily or weekly summary email might be less intrusive (“5 new recordings were added in your org this week”). In-app, an icon (bell) could show unread notifications. Users can adjust what they get notified about via settings (especially for emails). We may utilize Clerk’s built-in notification support if available, or implement our own via a background job sending through an email API.

6. Billing & Usage (Admin Feature):
Feature: Organization admins can view usage stats (minutes of video transcribed, number of docs, AI query count) and manage their subscription (upgrade/downgrade, payment info) via a Billing page.
Rationale: Although not a direct “product feature” for end users, this is important for transparency and for upselling. Admins should know if they are nearing limits (if any) and have a one-click way to handle billing. This is part of product polish that reduces friction in the purchasing process.
Expected Behavior: In settings, Billing section shows current plan, what that plan includes (e.g., “Up to 5 hours of video per month, 100 AI queries/day”) and current usage (“This month: 4h video, 80 queries”). If they are near or over limits, it could highlight that. A “Manage Subscription” button likely redirects to Stripe Customer Portal for self-service (update card, change plan, etc.). We handle provisioning via Stripe webhooks to update the plan in our DB. This feature ensures no surprises and gives control to the paying customer (the admin).

Each of these collaboration and org features is about making the product fit in a team/enterprise environment. The rationale is to move from a single-user tool to a multi-user knowledge hub. Users should feel it’s a shared space where knowledge is contributed and utilized together, under proper access controls. For engineers, these features imply additional considerations like permission checks in API routes (see authentication.md and api-spec.md for enforcement), and designing the data model for multi-tenancy (see database-schema.md).

In summary, our product features span from capturing information (recordings) to processing it (transcripts, docs) to retrieving it (search/assistant) and finally to enabling a team to effectively use it together (collaboration, sharing). The rationale behind this comprehensive feature set is to create a knowledge loop: capture tacit knowledge easily and turn it into explicit knowledge that can be disseminated and queried. We expect users to primarily record and consume content, while the AI/automation fills the gap of organizing and extracting value from that content. Over time, we will refine each feature based on feedback, but this outline serves as a blueprint for what the product does and why each part matters.

---

### sitemap.md
Sitemap and Route Structure

This document outlines the complete sitemap for both the public marketing site and the authenticated web application (Next.js 13 App Router). It lists all primary routes, their purposes, and access requirements, providing a high-level view of the application’s pages.

Marketing Site (Public)

The marketing site is accessible to everyone and showcases the product’s value. These pages are statically generated for performance and SEO, using Next.js App Router conventions.
	•	/ – Homepage. Introduces the product (expert recording to docs & AI assistant), key benefits, and a call-to-action to sign up. It features a hero section, brief feature overview, and social proof.
	•	/features – Features Overview. Lists major product features (recording, transcription, document generation, vector search/chat, etc.) with descriptions and screenshots. Educates visitors on capabilities and how it solves their pain points.
	•	/pricing – Pricing Plans. Details plan tiers (e.g. Free, Pro, Enterprise), feature differences, and a sign-up link for each. Includes billing FAQs and “Contact Sales” for enterprise inquiries.
	•	/about – About Us. (Optional) Provides company background, mission, and team info, to build trust with potential customers.
	•	/contact – Contact Page. (Optional) Allows visitors to get in touch for support or sales. Could be a form or mailto link.
	•	/login and /signup – Authentication Pages. Redirects to or embeds Clerk’s login and signup components. These might be on separate domain (app subdomain) or as modal on marketing pages. (If using Clerk Hosted Pages, these routes may not be needed, but we include them for completeness).
	•	/terms – Terms of Service. Legal terms for using the service.
	•	/privacy – Privacy Policy. Details on data usage and privacy.

Each marketing page is implemented as a React server component with static generation. Navigation links across the top (e.g. Features, Pricing, Login) make it easy to explore. The tone is persuasive and concise, targeting our top-of-funnel audience.

Web Application (App - Authenticated)

The app is the secure, logged-in area where users record content, manage their recordings and documents, and interact with the AI assistant. It uses Next.js App Router with protected route groups (requiring authentication via Clerk).
	•	/app – Dashboard Home. The main landing after login. Shows the user’s workspace (if multi-organization, the active org’s name), recent recordings/docs, and an entry point to start a new recording. Acts as a “library” of knowledge captures.
	•	/app/record – New Recording. Launches the screen/camera recording interface. Users can select screen(s) to share and camera/microphone, then record. May be a modal or dedicated page. Upon finishing, it directs to the recording’s detail page.
	•	/app/recordings – My Recordings Library. (If separate from dashboard) Lists all recordings/documents the user has access to (in the active organization), with statuses (transcribing, ready, etc.). Allows searching within titles or descriptions.
	•	/app/recordings/[recordingId] – Recording Detail & Document. Page to view a specific recording and its derived content. It includes:
	•	A video player for the recorded screen/camera video.
	•	The transcript (with possible editing capability).
	•	The generated structured document (formatted notes/guide).
	•	An AI Q&A chat interface specific to this recording’s content (allowing the user to query the transcript/doc).
These sections might be in tabs or panels on the page. Users can also update metadata (title, description) here.
	•	/app/assist (or /app/search) – Global AI Assistant. Provides a chat or search interface that can retrieve information across all of the user’s recordings and documents. The assistant uses vector search to find relevant content and answer questions. This page might show recent queries or suggestions, and results link back to source recordings/docs.
	•	/app/settings – User/Org Settings. Contains sub-pages:
	•	/app/settings/profile – Update personal info (name, email) if applicable, or link to Clerk profile management.
	•	/app/settings/organization – Org management (if user is admin): organization name, invite members, manage roles, transfer ownership, etc.
	•	/app/settings/billing – (If applicable) shows current plan, usage, and a link to manage billing (Stripe customer portal).
	•	/app/admin – Admin Dashboard. (Optional, for internal admin roles) If we have an internal admin interface or for organization owners to see analytics, it can live under an admin route.

Route Access & Behavior: All /app/* routes require authentication. We use Clerk’s Next.js middleware to protect these routes – unauthorized users are redirected to login. Clerk provides the user and active organization context to the application. If a user has multiple organizations, they can switch the active org (e.g. via a selector in the dashboard header), which will update which data is shown. The URL structure remains the same (still under /app), but the content is filtered by active org.

Each route corresponds to a Next.js App Router file or folder. For example, the recording detail page is implemented by a dynamic route file at app/recordings/[recordingId]/page.tsx. This uses Next’s file-based routing and can fetch the recording data (server-side) and render client components for video player and AI chat, etc. Marketing pages like /features correspond to app/(marketing)/features/page.tsx (perhaps grouped in a marketing folder for clarity), and are public.

This sitemap ensures we have clear navigation between discovering the product (marketing site) and using it (web app). It will also guide our Next.js routing setup, ensuring each path has a defined purpose and component. All user flows (recording content, viewing results, asking questions, managing account) are accounted for in this structure.

---

### implementation-pipelines.md
Implementation Pipelines (Async Workflows)

This document describes the end-to-end asynchronous workflows that power the app’s core functionality. The main pipeline stages are: Video Ingestion → Transcription → Document Generation → Vector Embedding → Publication. Each of these stages may be handled by background jobs or external services, with triggers connecting them. We detail how each stage is implemented, how data flows, and how we ensure reliability (retries, error handling) and scalability in these pipelines.

The pipelines are largely asynchronous to provide a smooth user experience (the user doesn’t wait on a long process in a blocking manner) and to leverage specialized services (like transcription AI) that work outside our request/response cycle.

1. Video Ingestion Pipeline

Trigger: User finishes a recording in the browser and initiates upload.

Process:
	•	The recording is captured as a media file (e.g., webm or mp4) in the browser. We then upload it to our storage.
	•	Uploading Strategy: We use chunked upload with a pre-signed URL or API:
	•	The client requests an upload URL from our backend: e.g., a POST to /api/upload-url with the file metadata (name, size, content type). The server (if using S3) calls S3 to get a pre-signed URL (or multipart upload URLs if large). If using Supabase storage, the client might directly use the Supabase JS client to upload in chunks (Supabase supports resumable uploads).
	•	The client streams or uploads the file in parts. With the MediaRecorder, we can even upload on-the-fly as it records (e.g., every few seconds) for very large or long recordings. However, in MVP, simpler is: record to a Blob, then upload that Blob once the user stops recording.
	•	We show an upload progress bar. If the upload fails mid-way, the client can retry or resume if supported (with resumable upload protocol). Using Supabase’s resumable feature (which is based on chunking and can resume) or S3 multipart gives reliability.
	•	Database Entry: As soon as the user stops recording, we create a recordings row in the DB with status ‘uploaded’ (or ‘uploading’). We include metadata like user_id, org_id, and maybe an initial title (e.g., “Recording on 2025-10-06”). The video_url or storage path is filled after upload completes (or pre-determined if we know it).
	•	Once the file upload finishes, the client notifies the server (perhaps implicitly by finalizing the multipart upload or explicitly with a request). For example, after S3 multipart complete, our client might call /api/recordings/complete to indicate success.
	•	Post-Upload Acknowledgment: At this point, we update the recording’s status to ‘uploaded’ (if it isn’t already). The user might be redirected to a “Processing…” page for that recording, or the detail page with a notice that transcription is underway.

Outcome: The video file is safely stored and we have a DB record for it. This triggers the next pipeline stage (transcription).

Reliability & Scalability:
	•	We handle large files by chunking. For example, using a 10MB chunk size for multi-GB videos.
	•	The pipeline doesn’t hold the file in memory server-side; upload goes to storage directly or via a streaming endpoint.
	•	In case of failure: If upload fails, the client can retry. If the user closes the browser mid-upload, we can have logic to resume when they come back (if using a resumable protocol with an upload ID).
	•	We could use an AWS Lambda trigger or Supabase Storage webhook to detect when a file is fully uploaded to start the next step automatically. Alternatively, our explicit “complete” call triggers transcription.
	•	We ensure unique file naming (using recording_id as part of the path, e.g., org-<id>/recordings/<recording_id>.webm) to avoid conflicts and to allow direct retrieval if needed.

2. Transcription Pipeline

Trigger: A recording upload is completed (detected either by the completion API call or a storage event).

Process:
	•	We change the recordings.status to ‘transcribing’. This can be done by the API route handling the completion trigger.
	•	The server (or a background worker) now initiates transcription. Two approaches:
	1.	Via API (async): Use an external transcription service (like AssemblyAI, Deepgram, or OpenAI Whisper API). Typically, you send either the file content or a URL to the service. Because our file is in cloud storage, we can often provide a signed URL to the service. For example, with AssemblyAI, we send a POST with { audio_url: "https://...signedURL..." } and they process in the background, calling a webhook when done. We prefer this asynchronous mode to avoid holding a connection open.
	2.	Self-managed (sync or async): If using OpenAI Whisper API, it’s a direct HTTP call with the file (max ~25MB). For larger, we’d need to chunk audio or use a different method. Or we could run our own Whisper model on a server with GPU for longer audio. That requires a job queue and compute resource.
	•	Given our architecture, we likely use a service with callback. So we will:
	•	Register a webhook endpoint (e.g., /api/webhook/transcription) with the service.
	•	Start transcription via their API, including the callback URL.
	•	Store a job reference (e.g., service-specific ID) in a jobs table or in memory for tracking.
	•	Our transcripts table may already have a placeholder row or we create it upon completion. We likely wait until done to insert transcript.
	•	Webhook Handling: When transcription is done, the service calls our webhook with results:
	•	The webhook endpoint (a Next.js API route or serverless function) receives a payload containing the transcript text and possibly word timings.
	•	We verify the source (e.g., check a token if provided to ensure it’s the transcription service).
	•	We then insert into transcripts table: the full text, language, and maybe structured data if provided (some services give a JSON of words or paragraphs with timestamps). We mark transcribed_at.
	•	Update recordings.status to ‘transcribed’.
	•	Possibly update recordings.completed_at if we consider transcription alone as completion. But since we have more steps (doc, embedding), we might not mark fully complete yet; we may leave it at ‘transcribed’ until doc is done.
	•	If instead we did transcription synchronously (e.g., small file with OpenAI direct call):
	•	Our background job (or API call if risk of short length) gets the text response immediately or within some seconds.
	•	We then do the same DB updates directly.
	•	This is simpler but doesn’t scale to long videos; asynchronous external is safer for long ones.
	•	User Notification: Once transcription is done, if the user is on the recording’s page, we can push a real-time update (maybe via websockets or polling). If not, we can send an email or show a notification next time they log in: “Your recording ‘X’ has been transcribed.”

Outcome: We have the raw text of what was said in the video stored and associated with the recording.

Reliability & Scalability:
	•	We decouple user requests from this heavy task by using background jobs/webhooks. So even if transcription takes 5-10 minutes, it doesn’t tie up any server instance in the meantime.
	•	We should implement retries for webhook delivery or processing: e.g., if our webhook is down when service calls, the service might retry (AssemblyAI does a few retries). Or if our process fails to save, we might recover via a dashboard of failed jobs.
	•	If using our own job runner, we should have a queue (like Redis + bullMQ) with retry logic (X attempts with exponential backoff) for transcribing using an external API (in case API call fails due to rate limit or transient error).
	•	For multiple simultaneous transcriptions, external services handle scaling on their side (we just pay for usage). If self-hosting, we’d need a worker per concurrency or an autoscaling setup (likely not MVP).
	•	We must secure the media: the signed URL for audio should have limited lifetime and scope. And the webhook should be protected (check some signature or include a secret).
	•	If an error happens (e.g., transcription API fails, perhaps due to unsupported file or too long):
	•	We update recordings.status to ‘error’ and log the error message.
	•	Notify user that transcription failed (and perhaps they can retry via a button after addressing issue or using a different method).
	•	We might implement fallback: e.g., if OpenAI Whisper API fails due to length, maybe try AssemblyAI, or vice versa. But initial approach likely sticks to one service.

3. Document Generation Pipeline

Trigger: Transcription is completed (and stored). This could be initiated within the same webhook handler or by a separate job trigger.

Process:
	•	Set recordings.status to ‘doc_generating’.
	•	AI Generation: We prepare a prompt for an LLM to convert transcript to a structured doc. For instance, a system/user prompt combination: “You are an assistant that turns transcripts into documentation. The transcript: ... Now produce a well-formatted Markdown…”. We include guidelines like “Use headings, lists, code blocks as appropriate. Preserve important details.” We may also include context like the recording title or any user-provided notes about the intended audience.
	•	We decide on a model (e.g., GPT-4 or GPT-3.5 via OpenAI API).
	•	If using GPT-4 and the transcript is very long, we might need to chunk the prompt (maybe process it section by section then combine) or use a summarization first. Possibly GPT-4 32k context could handle ~1 hour of speech (~15k tokens)? It’s borderline but maybe.
	•	We may start with GPT-3.5 (4k context) and if transcript doesn’t fit, break into parts: e.g., split transcript by sections (maybe at our bookmarks or into ~3000 token chunks), have the AI summarize each or create partial docs, then have another prompt to merge those into one doc. This is complex; perhaps easier: if too large, we instruct the model to focus on the most important points (losing some detail).
	•	Implementation: We likely create a background job for doc generation:
	•	The job fetches the transcript from DB.
	•	Calls OpenAI API with the prompt. We use stream mode or normal; since this is not user-facing directly (only outcome used later), normal is fine. But we should handle it might take many seconds.
	•	Get the response text (the Markdown doc).
	•	Insert into documents table: the content, summary if we also asked for one, generation time, model used.
	•	Update recordings.status to ‘completed’ (meaning fully processed).
	•	After document is saved, we notify the user (in-app notification or email: “Your document for recording X is ready”).
	•	Perhaps also generate a very brief summary for quick preview or SEO if needed (we can either take first paragraph or explicitly ask LLM for a 1-2 sentence summary and store in documents.summary).

Outcome: The structured documentation is now stored and accessible. The recording’s processing pipeline is essentially done from the system perspective.

Reliability & Scalability:
	•	The LLM call might fail (due to network, rate limit, or content issues). We should:
	•	Use retries with backoff (OpenAI recommends handling server errors by retrying after short wait).
	•	If it fails after retries, mark job failed (recordings.status = ‘error’, error_message in our jobs or recording).
	•	Possibly try a smaller model if bigger fails due to capacity.
	•	For cost management, perhaps default to GPT-3.5, and maybe allow user to manually request a GPT-4 regen if they want higher quality (depending on plan).
	•	We should be mindful of token limits:
	•	If transcript is huge, one approach: skip doc generation for extremely large transcripts in one go and either require user to manually chunk, or implement a more complex strategy as above. We can also arbitrarily truncate transcript input to fit into e.g. 12k tokens for GPT-4 (losing some detail, but better something than failing).
	•	Logging: maybe log the size and model used for each doc gen for future optimizations.
	•	Running multiple doc generations concurrently: since these are external API calls, concurrency is mainly limited by API and cost. We can safely run a few in parallel; if high load, maybe queue them.
	•	If we have a job queue (like Redis), we can have a certain number of workers handling LLM calls to avoid spamming the API.
	•	If the LLM returns content that violates some policy (maybe it mis-summarized or included something weird), user will have the chance to edit it, so it’s fine. We just store what we got.
	•	We might implement a safeguard: e.g., if doc is significantly short (maybe something went wrong and it produced only a few lines for a long transcript), we could mark that as suspect and allow a regen. But that might be overkill for now.
	•	Security note: We send potentially sensitive transcript data to OpenAI. We should ensure our terms and perhaps an option for user to opt out or use a self-hosted model if needed. But early on, assume it’s acceptable or at least documented.

4. Vector Embedding Pipeline

Trigger: Document generation is done (or even transcription done, depending if we embed transcript or doc or both).

Process:
	•	We decide what text to embed for semantic search. Likely, we embed the transcript (because it’s raw and complete). We could also embed the document, but it might be more summarized. Perhaps better to embed transcript segments for recall, and use the doc mainly for reading. We might do both or either.
	•	Chunking: We split the transcript into chunks suitable for embedding:
	•	A common approach: break by paragraph or ~500 tokens segments, ensuring coherence. Possibly we use the punctuation and timestamps to chunk by topics or time blocks (~30 seconds of speech per chunk).
	•	Alternatively, after doc creation, the doc could have clearer sections; we might embed those sections (like each top-level section of doc). But then search might miss details omitted in doc.
	•	For now, we can embed transcript paragraphs. Our transcripts might not have explicit breaks. We could insert breaks at speaker changes or when a pause is long (if we had that data). Simpler: fixed-size sliding window: e.g., every 200 words or so, overlapping slightly (maybe 50% overlap to not miss context).
	•	For each chunk:
	•	We create an entry in transcript_chunks with recording_id, org_id, text (the chunk text).
	•	We call embedding API (OpenAI’s text-embedding-ada-002) with that chunk text. It’s fast (~less than a second typically).
	•	We get a 1536-d vector and store it in the embedding column.
	•	We also record the chunk index or start time metadata so that if a search result refers to chunk 3, we can map it to roughly a portion of the transcript. If times available, store start time in metadata to allow seeking video later.
	•	This can be done synchronously in code after doc gen, or as a separate job. Since embedding is relatively quick, and we likely need results soon for search, doing it immediately after doc is fine. But to isolate concerns, we might fire a separate job (especially if we plan to switch to Pinecone later, we might have a dedicated sync process).
	•	If using Pinecone or another vector DB later:
	•	For now, we do Postgres. If Pinecone, we’d batch upsert the vectors to Pinecone index with metadata (org, recording_id, chunk_id).
	•	The pipeline difference is minor; it’s just calling Pinecone’s API instead of inserting into PG. We would still keep a local record for reference or for backup maybe.
	•	Update status: Once embedding is done for all chunks, that recording is fully processed. If not already ‘completed’, set recordings.status = 'completed'.
	•	If any error in embedding (rare, maybe API issues or chunk too large for embedding model):
	•	We could attempt to shorten that chunk or skip it (losing a bit of data but not critical).
	•	We log any failures; likely continue with others.

Outcome: The recording’s textual content is now indexed for semantic search. The AI assistant can use these vectors to find relevant pieces.

Reliability & Scalability:
	•	Embedding many chunks: For a 1-hour video, transcript ~10k words maybe, chunk into say 50 chunks of ~200 words. 50 embedding calls is fine. If multiple videos at once, OpenAI’s rate limit might be a concern (we might batch multiple texts in one request as their API supports  up to 2048 tokens per request of multiple inputs).
	•	We could optimize by doing embedding in parallel for different chunks or sequentially. Given each is quick, sequential is okay unless transcripts are huge.
	•	If our volume grows, we might consider doing embedding in batches or on a separate queue to manage rate limits.
	•	Should ensure vector index is updated transactionally with transcripts: We might do it in one transaction or after confirming doc done. If doc fails, maybe still embed transcript so search still works on raw data? Possibly, but if doc fails, likely we mark error and might not embed to avoid partial data. Once user fixes/regenerates doc, we can embed then.
	•	If using Postgres:
	•	We already have pgvector index. We should periodically vacuum and ensure performance. It’s fine for a moderate number of vectors (< millions).
	•	For scale beyond that or better query latency, we plan to move to Pinecone (see vector-strategy.md), which means this pipeline would send data to Pinecone. We’d likely run both in parallel during migration (embedding to PG and Pinecone).
	•	If a new recording is added, only that recording’s embeddings are inserted. Searches will naturally include it. If a recording is deleted, we should delete its chunks (cascade will handle if foreign key).
	•	Multi-tenant: We include org_id in chunk for filtering. In PG, our similarity query will include WHERE org_id = X. In Pinecone, we’ll use namespace per org. So pipeline would specify the namespace = org_id when upserting vectors, ensuring isolation.

5. Publication & Post-processing

This is not a single step but an umbrella for any finishing touches after main pipeline:
	•	We mark things as done and available. The user can now view the transcript and doc in the UI. Possibly, we flip some flag or send an event to the front-end if they’re waiting in real-time.
	•	If the user opted to auto-publish the doc (maybe a setting), and if allowed, we generate a public URL now. That could mean:
	•	Creating a short UUID or slug for the doc and storing it in a public_docs table or in documents (like a share_id).
	•	That way, we can serve that via a public endpoint without auth. That could be done here or later when user actually clicks “share”.
	•	We might create a thumbnail of the video: e.g., take a frame from 10 seconds in. This could be done either in the client before upload (if we had the video blob, capture frame) or on server using FFmpeg. Not critical, but improves UI listing. If we do it server-side:
	•	After video is uploaded, a job could run ffmpeg on the stored file (if we have a server with ffmpeg) to grab a frame and put in storage.
	•	Or we rely on the video element in browser to generate when needed (for dashboard).
	•	Clean up: if we had any temporary files or data, remove them. In our flow, not much temp on serverless unless we downloaded the video for processing (we avoided that by direct links).
	•	Logging/analytics: We log the pipeline completion, perhaps store metrics (duration of each stage, etc.) for monitoring performance and cost.
	•	Set up any links between objects: e.g., now that doc is ready, if we have a search index for docs separate from transcripts, ensure it’s updated. (We currently use transcripts for search, but if including docs, would embed those too now.)
	•	Possibly notify other org members: e.g., “New document published: X” if we want to encourage knowledge dissemination. That could be an email or in-app feed (this could be considered later as part of engagement features).

Error Handling Summary:
	•	Each stage (upload, transcription, doc gen, embedding) has its own error handling and does not block the others unnecessarily.
	•	If transcription fails, we cannot proceed to doc or embedding. So that recording stops with error. The user might be given an option to retry transcription (maybe use a different method).
	•	If doc gen fails, we could still allow search on transcript because that’s available. But we mark error so user knows doc isn’t ready. They might retry doc gen. Our system could allow a manual “Regenerate document” which re-triggers that stage (keeping transcript and embeddings).
	•	If embedding fails for some reason, the user can still read the doc; only search/chat is affected. We could mark a non-critical error and maybe schedule a retry in background later without bothering the user, because they might not notice missing embeddings until they search. Alternatively, notify admin that search indexing failed for that recording.
	•	We plan to surface errors in the UI on the recording card, e.g., a warning icon with tooltip “Transcription failed, click to retry.”

Workflow Orchestration:
	•	We currently envision a somewhat linear chain with webhooks:
	•	Upload complete -> call transcription service -> callback -> call doc generation -> then embedding.
	•	We can implement it as:
	•	A single queue system where one job type leads to enqueueing the next job type. E.g., a job transcribe(recording_id) on completion enqueues generate_doc(recording_id), then that enqueues embed(recording_id).
	•	Or event-driven: update of DB status triggers next via a listener. If using Supabase, could use database triggers or functions (but probably easier to manage in app code).
	•	For clarity, likely manage in code: The transcription webhook itself, after saving transcript, can directly call a function to start doc generation (synchronously, which might be too slow to do in the webhook response; better to enqueue it).
	•	Perhaps better: The transcription webhook just updates DB and status. We have a background worker polling or listening for recordings in ‘transcribed’ status and then processes doc gen. (If using Supabase, could use their realtime or cron triggers to pick those up.)
	•	For MVP, a simpler approach: Kick off doc gen from webhook right away (fire-and-forget an async function, respond 200 to webhook while doc gen runs). In Node, we can do that by not awaiting the OpenAI call, but we must be careful with serverless as it might cut off execution after sending response (some platforms do). Alternatively, have the webhook call a separate job via an API or queue.
	•	Because of the complexity of orchestration, an alternate architecture: use a managed workflow service or message queue:
	•	E.g., AWS Step Functions could orchestrate: on S3 upload -> transcribe (maybe with AWS Transcribe) -> when done -> Lambda to generate doc -> etc. But that ties to AWS infra.
	•	Or simpler: an in-app queue library as mentioned. Given time, a lightweight solution might be to use the database as a queue: a jobs table where each job has type and status and a worker polling it. But on serverless (Vercel), we don’t have a always-on process to poll. Might need an external worker or use something like temporal.
	•	Perhaps the easiest: rely on external triggers as much as possible:
	•	Transcription service calls us.
	•	We call OpenAI for doc (this we have to do).
	•	For now, do that in the same request to keep it simple (if transcripts are small).
	•	If worried about timeouts (like doc generation might take 30s, maybe okay on serverless if within limits, often 10-30s?), if it might exceed, then need background approach.
	•	Vercel Edge Functions run quickly, but Node serverless might allow up to 10s by default, can be extended maybe. If GPT-4 summarizing a huge text, could exceed.
	•	We might break it: webhook returns quickly after starting doc job, and we rely on some scheduled check to finish doc. But that introduces complexity.
	•	Another approach: Offload doc gen to a separate environment (e.g., a small VM or container) that can run longer tasks. That’s more devops heavy but could be needed for robust pipeline.
	•	For MVP, we try to streamline: using GPT-3.5 if possible (faster), likely can finish in a few seconds for moderate text.
	•	We will test with realistic lengths to ensure within serverless time. If not, we consider using something like a background function (like Vercel has background functions with up to 500s execution but they are in beta or for Enterprise).
	•	If not available, we could use a workaround: split doc generation: maybe do half now, half on next request, but that’s messy.

Monitoring & Scaling:
	•	We should monitor pipeline durations and success rates. Logging each step’s start and finish times (maybe in the jobs table or an internal log) helps identify bottlenecks.
	•	For scaling, each pipeline largely fan-out per recording. If 100 recordings are being processed concurrently (like after a big import), external services might throttle. We may queue tasks to avoid hitting rate limits (like only 5 concurrent transcriptions if not handled by service, etc).
	•	Also, we consider the cost: each step (transcription minutes, OpenAI tokens, embedding calls) costs money. We might implement per-org quotas or at least tracking in the future. But pipeline doesn’t directly worry about that beyond possibly checking “if org is free tier and already used X minutes, maybe do not auto-process until they upgrade”. But to start, likely just process and we will handle billing outside pipeline (or not in MVP).
	•	If using Pinecone later, the pipeline step “embedding” would include an API call to Pinecone’s upsert. That’s fine but if Pinecone is unreachable, we need to retry. We could also first store vectors locally and have a separate sync service to push to Pinecone asynchronously (to decouple vector DB from user-facing flows slightly). Possibly not needed if Pinecone is reliable.

In summary, the pipelines ensure that from the moment a user clicks “stop recording”, the heavy lifting is done in the background, and the user is eventually presented with a transcript and document, and can use the AI assistant to query it. Each pipeline stage is designed to be fault-tolerant and scalable through the use of asynchronous jobs and external services specialized for the task. By modularizing the pipeline, we can maintain and improve each part (for instance, swap out transcription provider or add a new post-processing step like translation) without affecting the others, as long as the triggers and data contracts remain consistent.

⸻

File: api-spec.md

API Specification

This document outlines all relevant API endpoints and route handlers in our application, including their purpose, request/response format, authentication requirements, rate limiting considerations, streaming capabilities, and integration with background tasks. The API is organized by feature area (auth, recordings, transcription webhooks, documents, search/chat, etc.). All endpoints are prefixed with /api as we are using Next.js API routes (App Router). These endpoints are primarily consumed by our frontend and some by external services (webhooks).

General Considerations
	•	Auth: All endpoints (except auth callbacks or public content) require authentication. We use Clerk’s middleware to protect API routes. This means each request will have an authenticated user (with req.auth or similar providing userId, orgId, and roles). If a request is unauthenticated, it gets a 401 or redirect to login.
	•	Data Scope: Many endpoints require an org_id context (which we get from the session or header via Clerk). We ensure that the user belongs to that org and has necessary permissions for the action. If not, respond with 403 Forbidden.
	•	Rate Limiting: We will implement basic rate limiting on certain endpoints to prevent abuse:
	•	E.g., the chat endpoint (vector search / AI answer) might be limited to, say, 60 requests per minute per user or a similar quota, especially on free plan.
	•	The recording upload endpoints might be limited in number of concurrent uploads or total per day for free plan users.
	•	We can use a library or Vercel’s Edge Middleware to do rate limit by IP/user. Alternatively, since Clerk gives user ID, a simple in-memory or KV store count can be used. For MVP, we might not enforce strictly but will design to add easily.
	•	Streaming: Some endpoints (like the chat answer) will use streaming responses (Server-Sent Events or incremental HTTP chunking) to send data progressively. We ensure proper headers (Content-Type: text/event-stream or similar) and flush behavior for these.
	•	Task Queue Triggers: Certain endpoints won’t complete the full processing synchronously but will enqueue background tasks. For example, when receiving a transcription webhook, after storing data we might enqueue a doc generation job.

Now, specific endpoints:

Auth Endpoints (Clerk-managed)

We largely rely on Clerk’s hosted components for auth (so users are redirected to Clerk’s pages or using Clerk React components). Thus, we have minimal custom auth endpoints. Clerk provides:
	•	/api/auth/* (Clerk’s Next.js middleware uses internal routes).
	•	Webhooks from Clerk (if any, e.g., for user created, organization events) – we might set up an endpoint to receive those and sync to our DB.

Example:
	•	GET /api/auth/session – (Provided by Clerk) returns current session info. Not something we write; Clerk’s SDK handles retrieving user profile, etc., on front-end.
	•	Clerk Webhooks (if used): e.g., /api/webhooks/clerk – to handle events like organization created, member added, etc. We would verify the signature and update our organizations or user_organizations tables accordingly (though Clerk might make a direct call unnecessary if we query each time or use their JWT claims). If implemented:
	•	Request: JSON payload from Clerk describing the event.
	•	Response: Usually 200 if processed.
	•	Auth: Basic (Clerk signs it, we verify with secret).
	•	Behavior: Update DB or log.
	•	Rate limiting: N/A (coming from Clerk, low volume).

User/Org Management Endpoints

If we provide custom endpoints for creating orgs or inviting users (which could also be done via Clerk’s frontend):
	•	POST /api/organizations – Create a new organization.
	•	Auth: User must be authenticated (this will be the owner of new org).
	•	Request: JSON body with at least { name: "Org Name" }.
	•	Response: 201 Created with JSON of org { org_id, name, ... } or error if e.g., name invalid.
	•	Behavior: Creates org in our DB (and possibly via Clerk API if using Clerk Orgs to manage invites).
	•	If using Clerk’s organization feature, ideally we call Clerk’s server API to create an organization, which will handle membership. Clerk might then call a webhook to us or we query the created org ID to insert in our DB.
	•	If not using Clerk Orgs, we create DB entry and add user to user_organizations as admin.
	•	Rate limit: Minimal (creating org is rare).
	•	GET /api/organizations/current – Get current org’s info and membership list.
	•	Auth: Must be a member of an org (and probably admin to see full member list).
	•	Response: JSON like { org: {...}, members: [ {user_id, name, email, role}, ...] }.
	•	Behavior: Look up org by session’s org_id, fetch org info and join with user_organizations->users for members if admin, or just basic org info if member.
	•	Possibly for multi-org context, GET /api/organizations to list all orgs user is in (so they can switch).
	•	POST /api/organizations/invite – Invite a new member by email.
	•	Auth: Org Admin only.
	•	Request: { email: "foo@bar.com", role: "member" }.
	•	Response: 200 with { success: true } or error.
	•	Behavior: If using Clerk Orgs, we might call Clerk’s invite API to send an invitation. If we manage ourselves, we create a temporary invite token in DB, email it to that address with a link to sign up and join org.
	•	Rate limiting: yes, to prevent spam invites (e.g., max 10 invites per hour per org).
	•	DELETE /api/organizations/members/{userId} – Remove a member.
	•	Auth: Org Admin and cannot remove themselves unless another admin exists (perhaps).
	•	Behavior: If using Clerk, call Clerk remove member API. Also remove from our DB membership (Clerk might do that via webhook too). Return 204 No Content on success.

(We rely heavily on Clerk for auth flows, so the above may be thin wrappers or not needed if we use their components which handle invites.)

Recording Endpoints
	•	POST /api/recordings – Initiate a new recording entry (could be optional since uploading might create it).
	•	Auth: Auth required.
	•	Request: Could include metadata like { title (optional), description (optional) }. Or even could allow uploading small file directly (but we prefer separate upload step).
	•	Response: JSON with { recording_id, upload_url(s) } if we choose to return a pre-signed URL or instructions for uploading.
	•	Behavior:
	•	Generate a new recording_id (UUID).
	•	Create DB entry with status ‘uploading’ or ‘pending’.
	•	If using direct upload to S3 approach:
	•	Call S3 to get a pre-signed URL (or an AWS SDK upload ID and part URLs for multipart).
	•	Return those to client.
	•	If using Supabase:
	•	We might not need this endpoint; the client could upload via supabase library using user’s auth.
	•	But if we want to enforce a key naming scheme, we might tell client: upload to bucket X path org/<orgId>/<recording_id>.webm.
	•	If chunking with custom approach, maybe we return an endpoint /api/recordings/{id}/upload to which the client can PUT chunks with a query param like ?part=1.
	•	Note: We might simplify and not use a distinct call; the client could directly start an upload via an SDK and then call the complete endpoint.
	•	PUT /api/recordings/{id} – Update recording metadata.
	•	Auth: Owner or admin of org.
	•	Request: JSON with fields to update (title, description, maybe privacy setting).
	•	Response: 200 and updated object or 204.
	•	Behavior: Write to DB after checking permission. Title/desc can be updated anytime.
	•	Rate limit: low.
	•	DELETE /api/recordings/{id} – Delete a recording.
	•	Auth: Owner or admin.
	•	Response: 204 No Content on success.
	•	Behavior: Mark as deleting or directly remove:
	•	Delete DB entries (recording, cascades to transcript, doc, chunks).
	•	Delete video file from storage (we may call storage API or queue deletion).
	•	Possibly cancel any ongoing jobs for it (if deletion happens mid-processing).
	•	This might be a long operation if video is large to delete physically; but S3 deletion is quick, so fine.
	•	We could perform file deletion asynchronously if needed, but likely fine to do in the request since it’s a simple API call to storage.
	•	GET /api/recordings – List recordings for current org.
	•	Auth: Yes.
	•	Query Params: Could support pagination (?limit=50&offset=0) or filtering (e.g., by creator or by status).
	•	Response: JSON array of recordings (with fields like id, title, user, status, created_at, maybe partial transcript preview or doc snippet if we want).
	•	Behavior: DB query for all recordings where org_id = currentOrg. Apply any filters. Perhaps join user to get creator name.
	•	Might only list those that are not deleted. If we had soft-delete, filter that out.
	•	GET /api/recordings/{id} – Get details of a specific recording.
	•	Auth: Member of org.
	•	Response: JSON with recording details including:
	•	metadata: id, title, description, user, created_at, status.
	•	transcript text (possibly full or maybe we load lazily? Probably can send full text).
	•	document content (the markdown).
	•	We might exclude the raw embedding data – not needed by frontend.
	•	Maybe include a URL to stream or download the video (like the S3/Supabase public URL or a signed URL if private).
	•	Behavior: Fetch from DB (recordings join transcripts join documents).
	•	Also generate or provide the video link:
	•	If the bucket is private, either create a short-lived signed URL here, or route video through an API that streams it.
	•	Supabase provides a way to retrieve with user token. If using that on frontend, might not need our API to proxy.
	•	Possibly we mark our bucket as public for simplicity, since it’s mostly internal data not public, but accessible to all in org anyway. However, not all org members should have link? Actually if link is unguessable (with recording_id), still, if bucket is public and someone guesses URL they could get it. Better to keep protected.
	•	So one approach: have a route /api/recordings/{id}/video that checks auth and then streams file from storage. But that doubles bandwidth through our server (costly).
	•	Alternative: Use signed URLs: Vercel server can generate a signed URL for S3 object that lasts 1 hour and respond with redirect to it. That way client downloads directly from S3. This is efficient.
	•	For Supabase, we might rely on supabase client in front-end with user’s JWT; they can call storage.getPublicUrl (but if not public, then .download with auth).
	•	Perhaps easiest: in our GET /recordings/{id}, include video_url which if using S3 is a signed URL (just generate one each time, it will be valid short time). If using Supabase, we can call supabase storage with service key to get a URL or serve via our own.
	•	Possibly handle if not processed: if status is not completed, transcript or doc might be null or partial. We still return what we have (maybe transcript if done, doc if done).
	•	POST /api/recordings/{id}/publish – (Optional) Publish/unpublish a recording’s doc publicly.
	•	Auth: Maybe only Admin or Owner can publish.
	•	Request: JSON { "publish": true, "includeVideo": false } or similar.
	•	Response: 200 with maybe a public URL or token.
	•	Behavior: If publish true:
	•	Set documents.is_published = true for that recording.
	•	Generate a shareable link (if using ID is enough, since we can have a public route like /share/doc/{recording_id} that anyone can open if is_published).
	•	Optionally, if includeVideo was requested and we allow it, we might also mark something to allow unauthenticated video streaming (maybe we create a signed URL and embed it or serve through our share page).
	•	If publish false: set is_published false (and any existing share links would stop working or share page checks that flag).
	•	Rate limiting: minimal.

Webhook Endpoints
	•	POST /api/webhook/transcription – receives callbacks from the transcription service.
	•	Auth: It’s unauthenticated publicly, but we verify a signature or secret key included by the service.
	•	Request: The exact payload depends on service. For example, AssemblyAI might send { "status": "completed", "text": "...", "id": "xyz", ... }. We’ll document expecting certain fields:
	•	a job id or reference, which we match to a recording (we might have stored the job id in recordings or jobs).
	•	the transcript text (or a URL to fetch it from).
	•	possibly a confidence or word-by-word info.
	•	Response: Likely 200 with no content; we just acknowledge.
	•	Behavior:
	•	Verify signature (like HMAC header).
	•	Identify which recording this is for. If the service let us set a webhook per request with an ID, maybe we encoded recording_id in the webhook URL (like /api/webhook/transcription?recording_id=abc). Or we look up by the job id in DB.
	•	Update the transcripts table with the text.
	•	Update recordings.status = 'transcribed'.
	•	Kick off document generation. Possibly by simply calling the doc generation function or enqueuing a job (maybe using a small in-memory queue or something).
	•	Return 200 quickly.
	•	Rate limiting: not needed for external triggers (should be low volume, but we ensure this can handle bursts if many finish at once).
	•	POST /api/webhook/stripe – handle Stripe billing events.
	•	Auth: Verify Stripe signature.
	•	Behavior: Not core to product features, but for completeness:
	•	Listen for invoice paid, failed, subscription upgraded, etc. Update organizations.plan or set flags if needed.
	•	Notifies user or restricts service if payment failed, etc.
	•	This ensures the tech stack doc’s mention of billing integration is implemented.

AI Assistant Endpoints
	•	POST /api/chat/query – Query the AI assistant (vector search + LLM answer).
	•	Auth: Yes (org member).
	•	Request: JSON like { "query": "How do I reset the database?", "history": [ { "role": "user/assistant", "content": "..."} ], "scope": "all" | "record:ID" }.
	•	The history could be included if we maintain context on server, but likely we will manage context client-side for now. Alternatively, we use conversationId to track persistent context.
	•	scope or some param can specify if the user wants to limit search to a specific recording or tag. If scope=record:xyz, we filter vector search to that recording only.
	•	Response: This will likely be a stream. We set Transfer-Encoding: chunked and stream partial answer.
	•	We might first send some preliminary data like which records were found (maybe not to clutter answer, but sometimes showing sources as we go).
	•	We then stream the answer as it’s generated by OpenAI.
	•	We might format response in SSE format: data: ... lines, so client can use EventSource. Or use fetch and read the stream.
	•	If not streaming, we wait for full answer then return JSON { answer: “…”, references: [ {recording_id, snippet, confidence} ] }.
	•	Behavior:
	•	Receive query.
	•	Perform vector search in transcript_chunks where org_id = currentOrg (and further filter if scope given).
	•	Get top N chunks (say 5) and their text + maybe recording_id.
	•	Form a prompt for the LLM: e.g., “Using the info below, answer the question…\n\n<>\ntext…\n<>…\nQuestion: {query}\nAnswer:”. Possibly include some instruction to cite sources by maybe referring to [1], [2] etc.
	•	Call OpenAI ChatCompletion (likely gpt-3.5 or gpt-4) with system and user prompt containing those documents.
	•	We use the streaming option from OpenAI. As tokens arrive, we flush them to client.
	•	We also capture which sources were used. We might attempt to parse model output for references if we instruct it to output them, or simpler: after answer, we attach the known top chunks as context sources. Could refine later to match which chunk text overlaps answer.
	•	Once done, end stream. The client would assemble tokens into the final answer. If not including references inline, we might at the end send a JSON block with references.
	•	The client UI will show answer, and perhaps list sources (like “From Recording X (Feb 1, 2025)” linking to it).
	•	Rate limiting: Important here. We’ll likely restrict to e.g. 5 queries in 10 seconds or similar, to avoid someone making a loop to use our API as openAI proxy. And overall perhaps X per month per user on free plan. Implementation: Could use an in-memory counter or upstash redis to track queries by user id. On exceed, return 429 Too Many Requests with an error “Rate limit exceeded”.
	•	Error handling: If vector DB or LLM fails:
	•	If vector search returns nothing (rare unless no data), we can respond with something like “I don’t know” or let model handle “no relevant info”.
	•	If OpenAI API errors (timeout or 500), we catch and return a 500 with message “Assistant is currently unavailable, try again.”.
	•	POST /api/chat/feedback – (Optional) send feedback on answer quality.
	•	Could allow user to thumbs-up/down an answer, which we log to improve prompts or metrics.
	•	Auth: yes.
	•	Request: { conversationId, messageId, feedback: "up"|"down", comment: "optional text" }.
	•	Behavior: Store in a small table or send to an analytics pipeline. Not a priority initially.

Misc Endpoints
	•	If we embed images, e.g., for marketing site or user uploaded an image, might have endpoints. Not in scope now.
	•	GET /api/sitemap.xml – maybe generate sitemap for SEO. Only if needed; Next can statically do for marketing pages.

Streaming Implementation Detail

For POST /api/chat/query streaming:
	•	In Next.js (Node) API route, we can set up the response as a stream by:
	•	Using the res directly (which is a Node http.ServerResponse) to write chunks. Ensure res.writeHead(200, { Content-Type: 'text/event-stream', Cache-Control: 'no-cache', Connection: 'keep-alive' }) for SSE or text/plain if just raw chunks.
	•	Use OpenAI SDK with streaming: it gives a stream of events or callbacks per token. We’ll forward those.
	•	We need to flush periodically (res.flush() if available, or ensure auto flush).
	•	Finally end the response.
	•	Alternatively, Next 13 App Router might allow using new Response(stream) to return a streamed response. Actually, in the App Router, if using the new Route Handlers, we can do: return new NextResponse(stream, { status: 200, headers: { ... } }).
	•	We’ll have to test this, but it’s doable. The UI will use EventSource or fetch with reader to consume the stream.

Development and Testing
	•	We’ll test endpoints with tools like Postman or curl:
	•	Ensure auth middleware working (Clerk provides a way to simulate user tokens in dev).
	•	Test upload flow: hitting POST /recordings, using returned URL to PUT a file, then hitting complete.
	•	Simulate a webhook by calling it ourselves with sample data to ensure it triggers doc gen.
	•	Test chat with some known content to see if it returns expected format.
	•	For streaming, test via curl or a Node script reading from http to confirm chunked output.

Conclusion of API Spec

This API provides the backbone for our front-end to interact with the system and for external integrations. It balances synchronous operations (quick data fetches, UI actions) with asynchronous hand-offs (webhooks and background tasks). By clearly defining endpoints and their roles, internal engineers and AI agents can interact with the system predictably, and we maintain security and performance through auth checks and rate limiting where appropriate. Each endpoint corresponds to a piece of the product functionality described earlier, tying together the overall architecture.

---

### rate-limits-quotas.md
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


---

### marketing-and-brand.md
Marketing and Brand Strategy

This document defines our product’s brand positioning, early go-to-market (GTM) strategy, top-of-funnel approach, and the intended tone for our landing pages. It will guide how we present the product to the world and acquire our initial users.

Brand Positioning

Product Name (Tentative): DocuVision (for example) – a name that suggests documentation and insight. (Note: Final naming is TBD, but we’ll use this for description.)

Value Proposition: DocuVision helps organizations capture expert knowledge effortlessly and turn it into usable documentation and Q&A assistance. It’s like having a “second brain” for your team: simply record your screen and voice as you demonstrate or explain something, and our platform will transcribe it, summarize it into structured notes, and make it searchable via an AI assistant. This dramatically reduces the time to create training materials or documentation and ensures that valuable know-how isn’t lost.

Positioning Statement: For teams that struggle to document fast-changing expertise, DocuVision is a knowledge capture platform that transforms video recordings into instantly useful documentation and an AI chat assistant. Unlike traditional screen recording tools or wikis, our product not only records knowledge but also makes it easy to digest and query, so information is always at your fingertips.

We position ourselves at the intersection of knowledge management and productivity tools. The brand should evoke efficiency, intelligence, and reliability. We want customers to feel that using our product is a modern, smart way to preserve and share knowledge, as opposed to labor-intensive manual documentation.

Differentiators:
	•	We go beyond simple video recording (like Loom) by automatically generating transcripts and documents – saving time for the expert and the viewer.
	•	We incorporate AI for retrieval, meaning knowledge captured isn’t static – it’s interactive and queryable, which is a unique selling point.
	•	Emphasis on accuracy and structure: we cater to professionals, ensuring the output (transcripts/docs) are high-quality and can be trusted for reference.

Early Go-To-Market (GTM) Strategy

As an early-stage SaaS, our GTM focuses on niche targeting, community engagement, and showcasing value through content:
	•	Target Early Adopters: Identify sectors or roles that feel the pain point acutely. For example, software onboarding/training teams, customer support knowledge base creators, or consulting firms capturing internal expertise. These groups frequently need to turn complex knowledge into documentation and would readily try a tool to streamline that.
	•	Founders’ Network & Beta Program: We will start with a closed beta for friendly users in our network (e.g., via LinkedIn or industry Slack groups). Their feedback helps refine the product. Success stories from beta users can become case studies.
	•	Product Hunt and Early Traction Channels: We plan a Product Hunt launch to tap into the tech enthusiast community. This can generate initial buzz and user feedback. Similarly, we’ll engage on Hacker News or relevant forums sharing the problem we solve (without being overly promotional).
	•	Content Marketing (Educational): We create blog posts, short videos, and LinkedIn content on topics like “How to capture knowledge from your experts without writing a single document” or “Top 5 tips to build a video knowledge base”. This content serves two purposes: SEO to bring in search traffic (top-of-funnel) and establishing our authority in the space. We’ll publish tutorials on using our product effectively, and broader pieces on knowledge management best practices.
	•	Partnerships: Explore partnering with communities or businesses adjacent to our space. For example, a Slack community for technical writers or an online course platform – we might offer a guest blog or a discount for their members to try our tool.
	•	Freemium & Word of Mouth: Offering a generous free tier (for single users or limited recordings) can encourage individuals to try it. If they find value, they may introduce it to their team (bottom-up adoption). We’ll make sharing easy – e.g., allow a user to share a document or an answer with a colleague via a link, which can drive new sign-ups.

Early GTM success will be measured by user engagement (are beta users creating content regularly?), conversion to paid plans (if they hit limits), and qualitative feedback (are we solving their problem?). We will iterate our messaging and onboarding quickly based on this feedback.

Top-of-Funnel Strategy

To fill the funnel with interested prospects, we focus on:
	•	SEO and Content: As mentioned, blog content targeting keywords like “video to documentation”, “screen recording transcription tool”, “knowledge base automation” will capture searchers. We’ll also create SEO-optimized landing pages for specific use cases (e.g., “Documentation for Onboarding”, “Record and Search Meetings”), which can be discovered via Google.
	•	Social Media & Communities: Regularly post valuable snippets on LinkedIn and Twitter (now X). For example, short clips demonstrating how our AI answers a question from a video, or a before/after of manual documentation vs our automated doc. We’ll engage with #buildinpublic to share our journey; this can draw interest from early adopters and other founders. Community platforms like Reddit (subreddits r/saas, r/Productivity, r/techwriting) or Hacker News can be used to share insights or ask for feedback (authentically, not as pure ads).
	•	Email Capture & Newsletter: On the marketing site, we’ll encourage visitors to sign up for a newsletter or early access. Even if they don’t convert immediately, we nurture them via email with tips and updates (“Here’s how Company X saved 5 hours/week using DocuVision”, “New feature: Slack integration!”). This keeps us in their consideration set.
	•	Webinars/Workshops: Host a free webinar like “How to instantly turn your training videos into documentation”. This not only demonstrates our product in action but also provides genuine education. Participants who attend are highly qualified leads for conversion. We can partner with a community or influencer for broader reach.
	•	Referral Incentives: Implement a referral program (e.g., “Get 1 month free Pro for each friend who signs up”). Satisfied users can become ambassadors, helping to bring in more users through personal recommendation – one of the strongest top-of-funnel channels.

The top-of-funnel strategy is about visibility and education. We want potential users to become aware that this type of solution exists and that it can dramatically improve their workflow. By providing value upfront (through content or free tools), we earn trust, which makes them more likely to explore our product seriously.

Landing Page Tone and Messaging

The tone of our landing pages (especially the homepage) should be professional yet approachable. Our audience includes team leads, operations or enablement managers, and tech-savvy professionals – they appreciate clarity and efficiency.

Key tone elements:
	•	Clarity: We immediately state what the product does in simple terms. E.g., “Capture your screen and voice, and get instant documentation + an AI assistant.” The user shouldn’t guess our purpose.
	•	Confidence: Use active language and bold statements about benefits: “Never lose important know-how”, “Your team’s knowledge, on demand.” We want to sound like we solve the problem definitively.
	•	Empathy: Acknowledge the pain point: e.g., “Tired of writing long how-to docs? Spending hours answering the same questions?” This shows we understand the user’s struggle.
	•	Brevity with Substance: We keep sections concise, but each headline is backed by a bit of detail or a visual. For example, a section “Record Once, Get Documentation Forever” followed by a short explanation and maybe an image of a video alongside an auto-generated doc.
	•	Visual Aids: We use screenshots or perhaps a short looping demo GIF on the landing page to show the transformation (recording → transcript → Q&A) rather than just telling. Visual proof makes the product feel tangible.
	•	Social Proof: Early testimonials (even from beta users) or metrics (“500 hours of documentation generated”) add credibility. The tone here remains honest and relatable, using real names and scenarios if possible.

The landing page copy should guide a visitor through a story:
	1.	Hero section: Big headline + subheadline + call-to-action. E.g., “Unlock your team’s hidden knowledge. Record any expert, and let our AI turn it into docs and answers.” [“Get Early Access” button].
	2.	Problem section: Briefly describe the traditional problem (information silos, time wasted documenting).
	3.	Solution/How it Works: Explain in 3 steps (Record, Auto-Transcribe & Summarize, Ask AI) with an icon or illustration for each.
	4.	Features/Benefits: List the key features with user-centric benefit phrasing (“Find answers instantly” for the search feature, etc.).
	5.	Social proof or Use Cases: Logos of pilot customers or quotes: “This changed how our support team works…”.
	6.	CTA: Repeat call-to-action for sign-up, possibly offering a free trial or free tier to reduce friction.

The tone is enthusiastic but sincere – we believe in our solution and we convey that excitement, but we also are careful to not overhype beyond what we deliver. We avoid overly technical jargon on the marketing site; technical details can go in docs or whitepapers. Instead, we focus on outcomes: saving time, preserving knowledge, empowering teams.

Voice example:
	•	Instead of “Our state-of-the-art ML-driven transcription achieves 95% accuracy,” we say “Your spoken words magically become accurate text – no typing required.” (Then in a tooltip or footnote, we could mention powered by advanced AI, if needed.)
	•	Use second person (“you/your team”) to speak directly to the visitor. E.g., “You focus on explaining – we’ll handle the rest.”

By setting this tone and message, our brand comes across as a helpful partner that augments the user (not replacing them, but making them superhuman in terms of productivity). We want users to feel confident that adopting our product will make them look good (they produce more documentation, answer questions faster) without a steep learning curve.

Early Brand Design Notes

(While not the main focus here, a brief note on visual branding to complement tone:)
	•	We aim for a modern, clean aesthetic. Likely a light theme with one strong accent color that conveys trust and innovation (blue or green often works in B2B SaaS).
	•	Logo and imagery will reflect the idea of connection between video and text (maybe an abstract icon representing a video camera transforming into a document or chat bubble).
	•	We’ll ensure the brand is consistent across the marketing site, app, and any outbound communications (same tone and style).

In summary, our marketing strategy is to nail a niche use-case and expand. We start by clearly communicating our unique solution and getting it in the hands of a few enthusiastic users who become champions. The brand is positioned as the go-to solution for turning expert knowledge into accessible answers, and all our messaging and tone reinforce that identity. Over time, as we gain traction, we’ll refine our messaging with real-world success stories and possibly broaden to adjacent use cases, but early on, focus and clarity in brand and marketing will be our guiding principles.
