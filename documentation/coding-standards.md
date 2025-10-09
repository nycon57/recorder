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
