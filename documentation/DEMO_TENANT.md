# Demo Tenant — Acme Support Demo

Canonical demo organization for local development, staging demos, and integration testing. Seeded by `scripts/demo-seed/`.

---

## Organization

| Field | Value |
|---|---|
| Name | Acme Support Demo |
| Slug | `acme-support-demo` |
| Plan | `pro` |
| Billing email | `billing@demo.tribora.test` |
| Created / Onboarded | 2026-01-01T00:00:00Z (frozen) |
| Metadata | `{ "seed": "demo", "generated_by": "scripts/demo-seed" }` |

**Org ID (deterministic):** see `DEMO_ORG_ID` in `scripts/demo-seed/fixtures.ts`

---

## Departments

| Name | Slug | Visibility |
|---|---|---|
| Executive | `executive` | `org` |
| Support Ops | `support-ops` | `department` |
| Support | `support` | `department` |

Department IDs are exported as `DEMO_DEPARTMENT_IDS` from `scripts/demo-seed/fixtures.ts`.

---

## User Roster

All users:
- `email_verified = true`, `status = 'active'`
- `timezone = 'America/New_York'`, `phone = null`
- `onboarded_at = 2026-01-01T00:00:00Z` (frozen)
- No password hash — magic-link sign-in only

| Email | Name | Role | Title | Department |
|---|---|---|---|---|
| `owner@demo.tribora.test` | Dana Okafor | `owner` | VP Customer Experience | Executive |
| `admin@demo.tribora.test` | Priya Rangan | `admin` | Head of Support Ops | Support Ops |
| `lead@demo.tribora.test` | Marcus Chen | `contributor` | Senior Support Engineer | Support |
| `agent@demo.tribora.test` | Sofía Alvarez | `contributor` | Support Agent | Support |
| `reader@demo.tribora.test` | Jordan Blake | `reader` | New Hire — Support | Support |

User IDs are exported as `DEMO_USER_IDS` from `scripts/demo-seed/fixtures.ts`:

```typescript
import { DEMO_USER_IDS, DEMO_ORG_ID } from 'scripts/demo-seed/fixtures';

DEMO_USER_IDS.owner   // Dana Okafor
DEMO_USER_IDS.admin   // Priya Rangan
DEMO_USER_IDS.lead    // Marcus Chen
DEMO_USER_IDS.agent   // Sofía Alvarez
DEMO_USER_IDS.reader  // Jordan Blake
```

---

## ID Derivation

All IDs are UUID v5 derived from a frozen namespace (`6f4c0b8a-8f2a-4d7e-9b11-tribora-demo00`). Derivation helpers are in `scripts/demo-seed/ids.ts`.

| Record | Input |
|---|---|
| Org | `org:acme-support` |
| User | `user:<email.toLowerCase()>` |
| Member | `member:<orgId>:<userId>` |
| Account | `account:credential:<userId>` |
| Department | `department:<orgId>:<slug>` |

IDs are stable across machines, reruns, and environments. **Do not rotate the namespace.**

---

## Seeding

```bash
# Local
DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local

# Dry run
DEMO_SEED_ENABLED=1 npm run demo:seed -- --env=local --dry-run
```

Full operational docs: `scripts/demo-seed/README.md`

---

## Downstream References

| Ticket | Purpose |
|---|---|
| TRIB-145 | This seed foundation |
| TRIB-148 | Content seed — imports IDs from `fixtures.ts` |
| TRIB-151 | Reset/verify hook — uses `metadata.seed = 'demo'` to identify rows |

---

## Identifying Seed Rows in the Database

Every seeded row carries `metadata` with `"seed": "demo"`:

```sql
-- Organizations
SELECT * FROM organizations WHERE metadata::jsonb ->> 'seed' = 'demo';

-- Users (app table)  
SELECT * FROM users WHERE id IN (
  '<owner-id>', '<admin-id>', '<lead-id>', '<agent-id>', '<reader-id>'
);
```

Use the exported constants from `fixtures.ts` rather than hardcoding raw UUIDs in queries.
