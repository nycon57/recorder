# Demo Tenant Seed Script

Idempotent seed for the canonical Tribora demo organization (`Acme Support Demo`) and its five-user roster. Writes directly to Postgres in a single transaction, bypassing the Better Auth admin API to avoid auto-workspace creation.

## Usage

### Local

```bash
# Dry run — see what would be written, zero mutations
DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local --dry-run

# Full seed
DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local

# Force-reseed (also overwrites preserved fields: logins, preferences)
DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local --force-reseed
```

### Staging

```bash
DEMO_SEED_ENABLED=1 npm run demo:seed -- \
  --env=staging \
  --confirm=$DEMO_SEED_STAGING_CONFIRM
```

`DEMO_SEED_STAGING_CONFIRM` must be set in the environment and match the `--confirm` token.

### Production

Hard-blocked. No flag combination works. If `DIRECT_DATABASE_URL` contains the production Supabase project ref, the script exits with code 2 and a red banner.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DEMO_SEED_ENABLED` | Yes | Must be `"1"` to allow the script to run |
| `DIRECT_DATABASE_URL` | Yes | Postgres connection string. Script validates the host against the target env. |
| `DEMO_SEED_STAGING_CONFIRM` | Staging only | Secret confirmation token |

---

## Flags

| Flag | Description |
|---|---|
| `--env=local\|staging` | Required. Validates the DB host against the expected allowlist. |
| `--dry-run` | Resolve fixtures and log planned writes. Zero mutations. Reads the DB for slug collision checks. |
| `--confirm=<token>` | Required for staging. Must equal `DEMO_SEED_STAGING_CONFIRM`. |
| `--force-reseed` | Also overwrites normally-preserved fields (last_login_at, login_count, preferences). Use for TRIB-151 resets. |

---

## Three-Layer Safety Guard

1. **DEMO_SEED_ENABLED=1** — explicit opt-in. Script exits loudly otherwise.
2. **Host allowlist** — `--env=local` requires `localhost`, `127.0.0.1`, or `host.docker.internal`. `--env=staging` requires a Supabase staging host (`.pooler.supabase.com` or `.supabase.co`).
3. **Production denylist** — if `DIRECT_DATABASE_URL` references project ref `clpatptmumyasbypvmun`, the script exits with code 2 regardless of other flags. Only the last 6 chars of the ref are logged.

---

## Idempotency

Rerunning produces identical state. All writes use `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`.

| Table | Refreshed on rerun | Preserved |
|---|---|---|
| `organizations` | name, slug, plan, metadata, billing_email, onboarded_at | stripe_customer_id, stripe_subscription_id, settings |
| `"user"` | name, email, emailVerified, phone, updatedAt | createdAt |
| `"account"` | updatedAt | password (never touched — NULL = magic-link) |
| `users` (app) | email, name, role, title, department_id, timezone, status, onboarded_at | last_login_at, last_active_at, login_count, notification_preferences, ui_preferences |
| `"member"` | role, updatedAt | createdAt |
| `departments` | name, slug, description, default_visibility | — |

---

## Transaction Safety

All six tables are written inside a single `BEGIN ... COMMIT`. Any error triggers `ROLLBACK` — the seed is fully applied or not at all.

---

## Direct SQL — Why Not the Better Auth Admin API?

`auth.api.createUser` triggers `databaseHooks.user.create.after` (see `src/lib/auth/auth.ts:107-134`) which auto-creates a `"<name>'s Workspace"` org. This would conflict with our deterministic demo org. Direct SQL bypasses the hook cleanly.

**Important:** Do not refactor this script to use the Better Auth API without first confirming the hook bypass behavior. Doing so silently would create duplicate orgs.

Service-role writes bypass Supabase RLS. Do not change the connection to anon-key.

---

## Downstream Consumers

- **TRIB-148** — content seed imports `DEMO_ORG_ID` and `DEMO_USER_IDS` from `scripts/demo-seed/fixtures.ts`
- **TRIB-151** — reset hook uses `metadata.seed = 'demo'` to surgically delete seed-owned rows, then calls this script with `--force-reseed`

---

## Troubleshooting

**"DEMO_SEED_ENABLED is not set to 1"** — set `DEMO_SEED_ENABLED=1` in your environment or `.env.local`.

**"PRODUCTION DATABASE DETECTED"** — your `DIRECT_DATABASE_URL` points to the production Supabase project. Do not override this guard.

**"Slug collision"** — `acme-support-demo` slug is already owned by a different org ID in the target database. Investigate before proceeding.

**"--confirm token does not match"** — the `--confirm` value doesn't match `DEMO_SEED_STAGING_CONFIRM`. Retrieve the correct token from your staging secrets.

**"Could not parse host"** — `DIRECT_DATABASE_URL` is malformed. Verify it is a valid `postgresql://` or `postgres://` connection string.
