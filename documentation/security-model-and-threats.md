# Security Model & Threats (STRIDE)

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** End‑to‑end security posture for the knowledge‑capture SaaS: trust boundaries, assets, identities, STRIDE analysis, mitigations, and verification. Covers web app (Next.js), APIs, background worker, Supabase (Postgres/Storage/pgvector), 3rd‑party vendors (Clerk, Stripe, Resend, LLMs, transcription), and browser capture (MediaRecorder/getDisplayMedia).

This document defines **what we protect**, **from whom**, **where risks live**, and **how we mitigate them**. It also includes checklists and policies that are enforced in code review and CI.

---

## 1) Security Objectives

1. **Tenant isolation**: no cross‑org data access (reads or writes).
2. **Content confidentiality**: recordings, transcripts, docs, embeddings are private by default; sharing is deliberate and auditable.
3. **Integrity of knowledge**: only authorized users may modify or delete content; generated artifacts are traceable to sources.
4. **Availability**: system resists abuse (rate limits/quotas) and degrades safely under attack.
5. **Privacy**: limit collection; redact PII before embedding; honor deletion and retention schedules.
6. **Compliance‑ready**: architecture supports SOC2 controls (access, logging, change management, DR).

---

## 2) Assets & Classifications

| Asset                        | Examples                       | Classification          | Notes                                |
| ---------------------------- | ------------------------------ | ----------------------- | ------------------------------------ |
| **Recordings (video/audio)** | raw .webm/.mp4 in storage      | **Confidential**        | encrypted at rest; signed URL access |
| **Transcripts**              | text + timestamps              | **Confidential**        | may contain PII/secrets              |
| **Generated docs**           | markdown/html                  | **Internal** by default | can be shared explicitly             |
| **Embeddings**               | float vectors + metadata       | **Restricted**          | redacted text only                   |
| **User data**                | name, email, org membership    | **Internal**            | minimal profile from Clerk           |
| **Billing data**             | subscription state, Stripe ids | **Restricted**          | no card data stored                  |
| **Secrets**                  | API keys, webhook secrets      | **Highly Sensitive**    | in env manager only                  |
| **Audit logs**               | auth events, admin actions     | **Restricted**          | immutable store preferred            |

---

## 3) Identities & Roles

* **Human users** (via Clerk): `admin`, `member`, `viewer` (future).
* **Service actors**: background worker, webhook providers (Stripe, transcription), outgoing webhook destinations (customer endpoints).
* **Resource owner**: organization (`org_id`) namespaces every record.

**Principals** flow: Clerk session → JWT claims (org, role, user) → server RBAC check → DB RLS (phase 2) → storage path prefix validation.

---

## 4) Trust Boundaries & Data Flows

1. **Browser ↔ App API** (HTTPS): auth via Clerk session cookies/JWT; CSRF protected via same‑site cookies + double‑submit token for non‑idempotent endpoints (if using cookies).
2. **App ↔ Supabase**: service role key from server only; RLS enforced (phase 2) when using anon key; for server, validate org prefix for storage.
3. **App/Worker ↔ Vendors**: LLMs, transcription, Stripe, Resend via HTTPS with API keys; webhooks back to app signed/HMAC‑verified.
4. **Public sharing**: signed tokenized URLs with narrow scope/TTL; optional password.
5. **Embeddings**: redact before send; store vectors with `org_id`, `doc_id`, `visibility` metadata.

---

## 5) Threat Model (STRIDE)

### 5.1 Spoofing Identity

**Risks**: stolen session cookies; JWT forgery; webhook caller impersonation; user → org elevation; public link guessing.

**Mitigations**

* Clerk session: same‑site `Lax`, `Secure`, `HttpOnly`; short TTL + rolling; device revocation.
* Server verifies **org membership & role** on each mutation; never trust client‑provided `org_id`.
* Webhooks: verify HMAC/signature + timestamp skew ≤ 5 minutes; enforce **idempotency** on provider event id.
* Public links: 128‑bit random tokens; short TTL; optional passcode; scope limited to object id.
* Admin actions require **re‑auth** (fresh session check) for destructive operations (e.g., org deletion).

### 5.2 Tampering with Data

**Risks**: IDOR on REST endpoints; editing others’ docs; tampered recording metadata; storage path traversal.

**Mitigations**

* RBAC checks on every request + **RLS policies** in DB: `org_id` equality and role gates.
* Storage keys scoped: `org/<org_id>/...`; API validates ownership **before** issuing signed URLs.
* Content hashing: `sha256` recorded at finalize; verify size/hash on download if integrity critical.
* Immutable audit log of create/update/delete events with actor/user id.

### 5.3 Repudiation

**Risks**: a user denies performing an action; lack of audit trail for webhooks/jobs.

**Mitigations**

* Append‑only audit table with `actor_user_id`, `org_id`, `action`, `request_id`, `ip`, `user_agent`.
* Clock sync (NTP) and monotonic ids.
* Store provider webhook payload hash + signature outcome.

### 5.4 Information Disclosure

**Risks**: unauthorized cross‑org reads; over‑broad signed URLs; XSS leads to token exfiltration; prompt injection causing data leakage; logs with secrets; vector leaks via semantic similarity.

**Mitigations**

* **Org isolation** at app, DB (RLS), and vector metadata.
* Signed URLs: **least privilege** (GET only), 5–15 min TTL, single object.
* CSP: default‑src 'self'; frame‑ancestors 'none'; script‑src without `unsafe-inline`; only vendor allowlists.
* HTML escaping for user content; Markdown sanitized (allowlist).
* Prompt injection defenses (see Guardrails doc): strict retrieval scope; **cite sources**; never execute external URLs found in prompts; sanitize tool outputs.
* Redact PII/secrets before embedding; store only redacted text in vectors; maintain raw→redacted mapping server‑side only.
* Logs: structured; **secret/PII scrubber**; request sampling; do not log transcript content by default.

### 5.5 Denial of Service

**Risks**: bursty assistant queries; upload floods; webhook storms; provider latency cascades.

**Mitigations**

* Per‑endpoint **rate limits** + org/user quotas (see `rate-limits-and-quotas.md`).
* Concurrency **semaphores** for docify/embeddings; queue backpressure with DLQ.
* Circuit breakers on vendors; fallback responses; disable non‑essential features under load.
* Auto‑ban IPs with anomalous 401/429 patterns (careful of NATs/VPNs).

### 5.6 Elevation of Privilege

**Risks**: missing authz checks; deserialization bugs; worker executing untrusted content; bypassing feature flags.

**Mitigations**

* Central `rbac.can(user, action, resource)`; **enforce in every mutation**.
* Zod validation → typed domain objects; never eval/Function on user data.
* Workers process **data only**—no code execution; sandbox LLM tools; timeouts on all network calls.
* Feature flags stored server‑side; don’t trust client flags.

---

## 6) Browser Recording Security

* Use `navigator.mediaDevices.getDisplayMedia` with explicit user gesture; do not auto‑start.
* Show **always‑visible** recording UI with stop button; warn on tab/window change if capture is still active.
* Never downscope Chrome capture restrictions; respect browser chrome outline (cannot be disabled).
* Microphone/camera permissions requested just‑in‑time; handle denial gracefully; no hidden capture.
* Store only after explicit **Finalize**; discard abandoned sessions after TTL.

---

## 7) Storage & Crypto

* Supabase Storage (S3‑compatible) with **server‑side encryption** (AES‑256).
* Optional client‑side encryption (future) using Web Crypto for highly sensitive tenants.
* Hash video at client (streaming SHA‑256) and record in DB to assert integrity.
* Signed URLs contain `org_id` prefix; server validates path before issuance.

---

## 8) Authentication, Sessions, RBAC

* Clerk managed auth; enforce **email verification** before org membership.
* Short session TTLs; refresh tokens rotated; revoke on password/auth change.
* **Org context** comes from server lookup, not client param.
* Role matrix: `admin` (manage members, billing, org settings, delete any content), `member` (CRUD own, read org, edit permitted docs), `viewer` (read only).
* Admin actions require fresh auth check and, where destructive, a confirmation step.

---

## 9) Webhooks (Inbound & Outbound)

* Inbound: signature verification, timestamp skew check, **idempotency** on event id; respond 202 quickly; process in background.
* Outbound: sign payload with SHA‑256 HMAC; include `id`, `timestamp`; retry with exponential backoff; **disable** endpoints after 20 consecutive failures; dashboard for replays.

---

## 10) Supply Chain & Dependencies

* Pin versions via lockfile; Renovate weekly updates; `npm audit` alerts (no hard fail).
* Only adopt libraries with maintenance signal; avoid unvetted clipboard/screen‑recorder packages.
* For build pipelines, prefer GitHub OIDC to Vercel/Supabase; no long‑lived deploy keys.
* Verify checksums for large third‑party SDKs if applicable.

---

## 11) Logging, Monitoring, Alerting

* Structured logs with `requestId`, `orgId`, `userId`, route, outcome.
* **Security log** channel for auth events, RBAC denies, admin actions, webhook signature failures.
* Alerts on:

  * auth failure spikes,
  * unusual 403/404 patterns (IDOR probing),
  * webhook signature failures > 1% over 5m,
  * vector search cross‑org filter misses (should be 0).

---

## 12) Data Privacy & Minimization

* Collect **least** required user profile fields.
* Allow opt‑out of model training with vendor (set `xai/no-train` equivalents if available).
* Encrypt backups; respect deletion/retention policies (see `data-retention-and-deletion.md`).

---

## 13) Penetration Testing & Reviews

* **SDL** checkpoints: threat model update for major features; security review on data‑flow changes.
* External pen‑test before GA; annual thereafter.
* Bug bounty (private) after MVP.

---

## 14) Checklists

### 14.1 Feature Security Checklist (to include in PR)

* [ ] All inputs validated with zod at boundary
* [ ] RBAC enforced server‑side
* [ ] Org isolation preserved (queries filtered by `org_id`; storage prefixes)
* [ ] No secrets in client; env via `lib/env`
* [ ] Logs redact sensitive data
* [ ] Rate limits/quota applied
* [ ] CSP/frame/cookie settings verified
* [ ] Webhook signatures verified (if relevant)
* [ ] Public sharing uses scoped token + TTL

### 14.2 Deployment Checklist

* [ ] Secrets rotated if scope changed
* [ ] Migrations add RLS (phase 2) or are behind a flag
* [ ] Backfills tested; performance impact measured
* [ ] Feature flags default safe; kill switch documented

---

## 15) Incident Response Hooks

* Severity definitions & comms templates: see `runbooks-and-incidents.md`.
* For suspected data leak: rotate keys, disable public sharing, snapshot logs, notify affected customers per policy.

---

## 16) Appendix: Example CSP (Next.js)

```
Content-Security-Policy:
  default-src 'self';
  frame-ancestors 'none';
  img-src 'self' data: blob: https://*.vercel-storage.com;
  media-src 'self' blob: https://*.vercel-storage.com;
  script-src 'self' 'strict-dynamic';
  style-src 'self' 'unsafe-inline'; /* Tailwind runtime classes */
  connect-src 'self' https://api.openai.com https://api.stripe.com https://*.supabase.co;
```

(Adjust for actual vendor domains; prefer nonce/hashes over `unsafe-inline` where possible.)

---

## 17) Appendix: Example RLS Skeleton (preview)

```sql
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_select_org ON recordings
  FOR SELECT USING (org_id = current_setting('app.org_id')::uuid);
CREATE POLICY p_modify_owner ON recordings
  FOR ALL TO authenticated
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
```

(See `rbac-and-rls-policies.md` for full mapping from Clerk claims.)

---

## 18) References

* `rbac-and-rls-policies.md`, `rate-limits-and-quotas.md`, `privacy-and-pii-redaction.md`, `backup-and-disaster-recovery.md`, `observability-and-alerting.md`, `runbooks-and-incidents.md`, `prompting-and-guardrails.md`
