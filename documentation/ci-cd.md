# CI/CD

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** GitHub → Vercel (Next.js) + Supabase (Postgres/Storage) + Worker (Node). Handles install/lint/typecheck/tests/build/migrations/preview deploys/release tagging/rollbacks/secret management.

This document defines our **end‑to‑end delivery pipeline**: what runs on every commit, how previews work, how we gate production, how DB migrations are applied, and how we recover. Copy/pasteable YAML is included.

---

## 1) Goals & Principles

* **Safe by default**: prod deploys are gated by tests, typechecks, migration checks, and approvals.
* **Fast feedback**: < 8 min CI on typical PR; parallelized jobs with caching.
* **Deterministic releases**: version/tag generated from Conventional Commits; changelog automated.
* **One button rollback**: instant Vercel rollback; DB roll-forward preferred; down-migrations available.
* **No long‑lived credentials**: GitHub OIDC to Vercel and Supabase; secrets live in cloud managers.

---

## 2) Branching Model & Environments

* **Branches**: `main` (protected) + short‑lived feature branches.
* **Preview**: every PR gets a Vercel Preview + ephemeral env vars (non‑prod keys).
* **Staging**: optional branch `release/*` or deployment from `main` with `env=staging`.
* **Production**: tagged release from `main` after approvals.

**Protections on `main`:** required checks (lint, typecheck, unit tests, build, migrations-check), 1+ code review, signed commits optional.

---

## 3) Pipeline Overview (per change)

1. **Prepare**: checkout, setup pnpm/node, restore caches.
2. **Static checks**: ESLint, Prettier, TypeScript.
3. **Tests**: unit + integration (API) + optional E2E (on label or nightly).
4. **Build**: Next.js build; bundle size check (client impact).
5. **Migrations (plan)**: generate & diff schema; ensure backward‑compat (see Migration Playbook).
6. **Preview Deploy**: deploy to Vercel; comment preview URL.
7. **Release (on merge)**: run semantic‑release → tag + changelog; promote to staging; run DB migrations; then promote to prod.

---

## 4) GitHub Actions Workflows

### 4.1 CI (pull_request)

```yaml
name: ci
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      pnpm-cache: ${{ steps.pnpm-cache.outputs.cache-hit }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test -- --reporter=junit --coverage
      - run: pnpm run build

  migrations-plan:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Supabase plan (no apply)
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF_STAGING }}
        run: |
          npx supabase db diff --linked || true
          npx supabase db lint || true
      - name: Validate SQL migration filenames
        run: node scripts/check-migration-names.js

  bundle-size:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - name: Measure client bundles
        run: node scripts/report-bundle-size.mjs

  preview-deploy:
    if: ${{ github.event.pull_request.draft == false }}
    needs: [setup, migrations-plan]
    runs-on: ubuntu-latest
    permissions:
      id-token: write # OIDC
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: .
          vercel-args: '--prebuilt' # use previous build artifacts if enabled
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      - name: Comment preview URL
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: preview
          message: |
            ✅ Preview: ${{ steps.vercel.outputs.preview-url }}
```

> Notes: We prefer OIDC to Vercel (via `vercel-token` scoped); if using Vercel’s Git integration, this job can be omitted and previews auto-deploy.

### 4.2 Release (push to main)

```yaml
name: release
on:
  push:
    branches: [main]
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false
permissions:
  contents: write
  id-token: write
jobs:
  test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build

  migrate-staging:
    needs: test-build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Apply DB migrations (staging)
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF_STAGING }}
        run: npx supabase db push --linked

  deploy-staging:
    needs: migrate-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (staging)
        uses: amondnet/vercel-action@v25
        with:
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_STAGING }}
          vercel-args: '--prod'
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

  smoke-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Run smoke tests (health, routes, webhooks)
        run: pnpm run smoke:staging

  migrate-prod:
    needs: smoke-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Apply DB migrations (prod)
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF_PROD }}
        run: npx supabase db push --linked

  deploy-prod:
    needs: migrate-prod
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (prod)
        uses: amondnet/vercel-action@v25
        with:
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}

  semantic-release:
    needs: deploy-prod
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Semantic Release
        uses: cycjimmy/semantic-release-action@v4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4.3 Worker Deploy (if separate)

If the worker is deployed separately (e.g., Railway/Fly/Render/K8s), add a job after `migrate-prod` that builds and deploys the worker container, using OIDC to the provider.

---

## 5) Secrets & Credentials

* **OIDC**: Prefer GitHub OIDC to mint short‑lived tokens for Vercel and Supabase (avoid static tokens).
* **Secret stores**: Vercel Project Env Vars; Supabase Project Keys; GitHub Encrypted Secrets for things used in CI only (e.g., `VERCEL_TOKEN` if OIDC not possible).
* **Rotation**: quarterly; document in changelog; validate with a dry run in staging prior to prod.

**Required secrets (minimum)**

* `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID[_STAGING]`, `VERCEL_TOKEN` (or OIDC).
* `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF_{STAGING,PROD}`.
* `STRIPE_WEBHOOK_SECRET_{STAGING,PROD}` (not in CI; configured in Vercel env).
* `OPENAI_API_KEY_{STAGING,PROD}` (Vercel env).
* `RESEND_API_KEY_{STAGING,PROD}` (Vercel env).
* `CLERK_SECRET_KEY_{STAGING,PROD}` (Vercel env).

---

## 6) Environment Variables & Config Promotion

* Use a **single source** `lib/env.ts` (zod) for server‑side env.
* Never read env in client code.
* Promote env values from staging → prod via Vercel dashboard/CLI; keep `.env.example` current.
* For previews, define **Preview** envs (non‑prod keys) in Vercel.

---

## 7) Database Migrations & Safety Gates

* **Authoring**: timestamped SQL in `db/` with **up** (and optional **down**) scripts.
* **Compatibility**: follow Expand/Contract (add columns nullable → backfill → make NOT NULL; dual‑write when renaming).
* **Checks**: CI `migrations-plan` runs `supabase db lint/diff`.
* **Applying**:

  1. staging: `supabase db push` (linked)
  2. smoke tests
  3. production: `supabase db push`
* **Rollback**: prefer roll‑forward; if necessary, `down` script with snapshot restore reference; record run in `migration_runs` table.

---

## 8) Testing Strategy in CI

* **Unit**: run on every PR; JUnit + coverage artifact.
* **Integration**: Next route handlers with mocked vendors; optional ephemeral Postgres (docker).
* **E2E**: gated by label `e2e` or nightly workflow; Playwright against preview URL.

**Artifacts**: junit.xml, coverage, build stats, bundle size report.

---

## 9) Preview Deploys

* Every PR gets a Vercel Preview URL commented.
* Preview env vars use non‑prod keys.
* Feature reviewers verify: core pages render, auth flows, recorder loads (with vendor mocks if needed).

**Manual QA checklist** (attach to PR template):

* [ ] Marketing pages render (pricing, home).
* [ ] Sign‑in/out flows.
* [ ] New recording page loads (no real capture in CI).
* [ ] Recording detail displays mock transcript/doc.
* [ ] Assistant chat streams with mock responses.

---

## 10) Release Management

* **Versioning**: Semantic Versioning via **semantic‑release** using Conventional Commits.
* **Changelog**: auto‑generated and committed to `CHANGELOG.md`.
* **Tags**: `vX.Y.Z` on `main` after successful prod deploy.
* **Announcements**: short note in `changelog-and-release-notes.md`; optional email via Resend for major changes.

---

## 11) Rollback & Incident Playbook

* **App rollback**: Vercel → select previous successful deployment → Rollback (instant).
* **DB rollback**: prefer roll‑forward; if impossible, apply `down` script; if catastrophic, restore from snapshot (see Backup & DR).
* **Feature flag kill‑switches**: disable `FEATURE_PUBLIC_SHARE`, provider toggles, etc.
* **Comms**: update status page; post incident in `runbooks-and-incidents.md`; notify affected customers for SEV1.

**Triage checklist**

1. Identify blast radius (env/orgs/routes).
2. Check metrics/dashboards (5xx, queue depth, provider errors).
3. Roll back app if request failures > 1% or login broken.
4. Pause background jobs if they amplify damage.
5. Decide on DB roll‑forward/rollback.
6. Document timeline and actions.

---

## 12) Caching & Performance in CI/CD

* `actions/setup-node` + pnpm cache; Next build cache enabled on Vercel.
* Split jobs for parallel execution; enable concurrency cancelation for PRs.
* Bundle size guardrail script fails if client bundle > budget (see Coding Standards).

---

## 13) Supply Chain & Integrity

* **Lockfile**: commit `pnpm-lock.yaml`; PRs update with Renovate (weekly).
* **Pin Actions**: use major versions and renovate to keep updated.
* **SLSA** (future): attest build provenance via GitHub OIDC and Vercel.

---

## 14) Worker Operations

* If worker is a long‑running process: health endpoint and liveness/readiness checks.
* Rolling deploy after DB migrations.
* Concurrency/env flags controlled via provider UI/env.

---

## 15) Observability Hooks in CI/CD

* Post deployment, hit `/api/health` and critical endpoints.
* Emit a `deployment` event to analytics with git SHA, version, and environment.
* Sentry release created with commit range for source maps (if configured).

**Sentry example step**

```yaml
- name: Create Sentry release
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: your-project
  with:
    environment: production
    version: ${{ github.sha }}
```

---

## 16) Manual Operations (Runbooks)

* **Backfill job**: `pnpm tsx scripts/backfill-embeddings.ts --org <id>` (requires staging/prod env locally).
* **Reindex**: enqueue `embeddings:rebuild` for an org via admin API.
* **Rotate webhook secrets**: update vendor dashboard → Vercel env → deploy config‑only redeploy.

---

## 17) PR Template (snippet)

```
## Summary

## Screenshots / Demos

## Checklist
- [ ] Types complete; inputs validated
- [ ] RBAC enforced; no secrets in client
- [ ] Tests updated/added
- [ ] Migrations backward‑compatible
- [ ] Bundle impact considered
- [ ] Docs updated
```

---

## 18) Nightly Jobs

* Run E2E tests against staging.
* Dependency updates via Renovate.
* Security scans (npm audit/OSSIndex) with alerts, not hard fails.

---

## 19) FAQ

* **Why stage before prod?** To catch data issues in a prod‑like environment with real services.
* **Why semantic‑release?** Deterministic versions/changelog without manual tagging.
* **What if a migration requires downtime?** Schedule a window; add feature flag to disable affected paths; run migration with lock and maintenance banner.

---

## 20) References

* `migration-playbook.md`, `coding-standards.md`, `observability-and-alerting.md`, `runbooks-and-incidents.md`
