---
title: Deployment lifecycle
description: Vercel build pipeline, Railway worker rollout, migration gates, and rollback procedures for Tribora platform deployments.
audience: system-admin
section: platform-runbooks
order: 20
related:
  - platform-runbooks/worker-ops
  - platform-runbooks/cost-and-quota-investigation
  - security/incident-response
tags:
  - runbook
  - deployment
  - vercel
  - railway
---

## Overview

Every production deployment passes through three sequenced layers: the Next.js application on Vercel, the background job worker on Railway, and any pending Supabase migrations. Each layer has its own rollout path and rollback mechanism. This runbook covers the normal lifecycle and the recovery procedures when something goes wrong.

## Pre-deploy checklist

Before promoting any branch to `main`, verify:

1. `npm run verify` exits 0 on the PR. This runs `type:check → lint → build` in sequence. A failing build on CI is a hard block — do not merge.
2. `npm run prebuild` compiled all docs pages without error. The build script is a pre-requisite step; if new pages were added, the manifest must be current.
3. All Supabase migrations in `supabase/migrations/` have been applied to production via `mcp__supabase__apply_migration`. **Never deploy an app that references columns or tables that do not yet exist in production.**
4. Environment variables required by new code are present in Vercel and Railway. Check the respective dashboards before merging.

## Vercel deployment

Vercel auto-deploys on push to `main`. The pipeline runs:

```
install → npm run prebuild → next build → deploy
```

**Monitor the build** at [vercel.com/nycon57/recorder](https://vercel.com/nycon57/recorder). Build failures surface within two minutes. Common causes:

- Missing environment variable — Vercel build log shows `undefined` or a thrown error at import time. Fix: add the variable in the Vercel dashboard under Settings → Environment Variables, then redeploy.
- Docs manifest stale — `prebuild` fails if a new `.md` file has invalid frontmatter. Fix: correct the frontmatter locally, push, redeploy.
- TypeScript error introduced by a merge conflict — Fix: resolve the conflict, push a corrective commit.

**Rollback:** In the Vercel dashboard, open Deployments, find the last successful deployment, and click "Promote to Production." This is instantaneous and does not require a code change.

## Railway worker deployment

The background job worker runs on Railway. It is deployed by pushing to `main` — Railway tracks the same branch.

**Worker startup:** Railway builds the Docker image and restarts the service. The worker process begins polling the `jobs` table within 30 seconds of startup. Confirm it is running:

```bash
# Check Railway service status
railway status --service worker
```

Or visit the Railway dashboard → recorder → worker → Deployments.

**Migration safety:** The worker uses the same Supabase credentials as the web app. If a migration adds a required column, deploy the migration first, then push the app and worker together. The worker will restart automatically.

**Rollback:** In the Railway dashboard, open the worker service, go to Deployments, and click "Rollback" on the previous successful build.

## Supabase migration gates

Migrations are additive-only for normal releases. The rules:

- **Never deploy** a migration that drops a column or table in the same PR as the code that removed its usage. Decouple: remove the code first (reads null gracefully), merge, then drop the column in a follow-up migration.
- Always use `IF NOT EXISTS` / `IF EXISTS` guards on every DDL statement. Migrations must be idempotent.
- Apply via `mcp__supabase__apply_migration` — never `psql` directly or `npx supabase db push` in production.

**Rollback a migration:** Supabase does not support automatic migration rollback. Author a reverse migration manually and apply it:

```sql
-- Example: reverse the docs_pages migration
drop table if exists public.docs_pages;
```

Apply the reverse migration via MCP, then revert the application code.

## Deployment verification

After a production deploy, perform these smoke checks:

1. Visit `/docs` — the docs landing page should render with the correct sections.
2. Sign in as a system-admin user and visit `/admin` — the admin dashboard must load without a 500.
3. Check the worker log in Railway for any `ERROR` lines within the first 60 seconds of startup.
4. Check Sentry for new error events with `environment: production` triggered after the deploy.

## Hotfix path

When a critical bug requires an emergency deploy:

1. Branch from `main` (never from a feature branch).
2. Make the minimal fix. Run `npm run verify`.
3. Open a PR against `main` with `hotfix:` in the title.
4. Merge with one approver rather than waiting for full review cycle.
5. Monitor Vercel and Railway deployments as above.
6. If the fix also requires a migration, apply the migration to production immediately before merging the code change.

## Related

- [Worker operations](worker-ops) — queue introspection and stuck-job recovery
- [Cost and quota investigation](cost-and-quota-investigation) — diagnosing cost spikes post-deploy
- [Security incident response](../security/incident-response) — if the deployment introduces a security regression
