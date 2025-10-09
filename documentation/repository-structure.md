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
