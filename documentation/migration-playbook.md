# Migration Playbook

> **Audience:** internal engineers & AI coding agents
> **Status:** v1 (authoritative)
> **Scope:** Authoring and applying database migrations for Supabase Postgres (with pgvector), guaranteeing **zero or minimal downtime** using Expand/Contract, safe rollbacks, backfills, and verification. Includes job/webhook idempotency considerations.

This playbook defines rules and checklists to evolve the schema safely in a production, multi‑tenant environment.

---

## 1) Principles

* **Backwards compatible first**: API and code must work with **old & new** schema during rollout.
* **Expand → Migrate → Contract**: add new structures; backfill; switch writes/reads; remove old.
* **Small steps**: prefer multiple tiny migrations over one large; easier rollback.
* **Idempotency**: migrations and backfills can be safely re‑run.
* **Observability**: instrument migration time, row counts, errors; announce in release notes.

---

## 2) Roles & Ownership

* **Migration author**: writes SQL + app changes + runbook; owns rollout.
* **Reviewer**: validates expand/contract plan, performance impact, and RLS interplay.
* **Operator**: executes in staging, then prod; monitors dashboards and error budget.

---

## 3) File Conventions

* Files live in `db/` with timestamps: `YYYY-MM-DD-HHMM__<verb>_<object>.sql`
* Each file contains **commented sections**:

```
-- EXPAND
-- MIGRATE (optional)
-- CONTRACT (optional, in a later file)
-- DOWN (optional)
```

* If using multiple files, prefix with sequence numbers after timestamp.

---

## 4) Expand/Contract Patterns

### 4.1 Add Column

* **Expand**: `ALTER TABLE ... ADD COLUMN new_col TYPE NULL;`
* **Migrate**: backfill `UPDATE ... SET new_col = fn(old_cols)` in **batches**; add trigger for dual‑write if necessary.
* **Contract**: make NOT NULL (with default) after backfill & code switch; drop old column.

**Batching pattern**

```sql
-- 5k rows per batch; avoid long locks
UPDATE documents SET new_col = ...
WHERE id IN (
  SELECT id FROM documents WHERE new_col IS NULL ORDER BY id LIMIT 5000
);
```

### 4.2 Rename Column

* Avoid `ALTER TABLE RENAME COLUMN` unless trivial. Prefer **add new + backfill + swap reads/writes + drop old**.

### 4.3 New Table

* Create with FKs + indexes; consider RLS (phase 2). Seed minimal rows if required.

### 4.4 Indexes

* Use `CREATE INDEX CONCURRENTLY` in production.
* Drop with `DROP INDEX CONCURRENTLY`.
* Monitor for long running index builds.

### 4.5 Constraints

* Add as **NOT VALID** then `VALIDATE CONSTRAINT` to avoid long locks.
* For NOT NULL: ensure backfilled then `ALTER TABLE ... SET NOT NULL` (fast if none null).

### 4.6 Enum/Type Changes

* Prefer lookup tables over enums for evolving sets.
* If using Postgres enums, add values with `ALTER TYPE ... ADD VALUE` (non‑transactional).

### 4.7 pgvector Changes

* New embedding model? Add `model` column; **do not** mutate in place.
* Build new index alongside old; switch queries to filtered `model`; drop old after re‑embed.

---

## 5) RLS & Security Considerations

* For new tables, default `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with permissive policies in phase 1 behind a feature flag.
* Ensure all `SELECT/INSERT/UPDATE/DELETE` policies reference `org_id` and Clerk claims mapping.
* Add tests for RLS policies before enabling in prod (see `rbac-and-rls-policies.md`).

---

## 6) Backfills & Dual‑Writes

### 6.1 Backfill Strategies

* **Online backfill**: run in batches via script `scripts/backfill-*.ts`; limit with `WHERE new_col IS NULL` and `LIMIT`.
* **Nightly job**: schedule continuing backfill if dataset huge.
* **Throttling**: `SET LOCAL statement_timeout = '5s'` and short transactions.

### 6.2 Dual‑Write Pattern

* Add DB trigger or app‑layer write to fill both old and new fields during migration window.
* Include version guard to avoid loops.

**Example trigger**

```sql
CREATE OR REPLACE FUNCTION documents_dualwrite() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.new_col IS NULL THEN NEW.new_col = NEW.old_col; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_dualwrite
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION documents_dualwrite();
```

### 6.3 Verification

* Row counts: `SELECT COUNT(*) WHERE new_col IS NULL` → expect 0 before contract.
* Sample integrity: random 1k rows equality check between old vs new.
* Perf: ensure indexes used (`EXPLAIN ANALYZE`).

---

## 7) Ordering & Deployment

1. **PR 1 (Expand)**: schema + app tolerant of both states. Ship to prod.
2. **Backfill**: run script; monitor; rerun until complete.
3. **PR 2 (Switch)**: switch reads/writes to new. Ship to prod.
4. **PR 3 (Contract)**: remove old paths, drop columns/indexes. Ship to prod.

**Gates**: each step must pass CI, staging smoke, and metric thresholds.

---

## 8) Rollback Strategy

* **App rollback**: always safe (Vercel previous deploy).
* **Schema rollback**:

  * If still in **expand**: safe to revert (object additions remain benign).
  * If post‑backfill but pre‑contract: keep both fields; app rollback ok.
  * If **contracted** (dropped old fields): you can only roll‑forward. Use snapshot restore as last resort.

**Down scripts** exist only for reversible operations (indexes, added columns). Never attempt to resurrect dropped data without snapshot.

---

## 9) Performance & Locking

* Use `CONCURRENTLY` for indexes.
* Keep transactions short; batch updates.
* Monitor locks with `pg_locks` and Supabase dashboard.
* Disable long‑running queries before contract if needed.

---

## 10) Testing Migrations

* **Static lint**: `supabase db lint`.
* **Plan**: `supabase db diff --linked` for drift.
* **Local**: apply to docker Postgres; run app tests.
* **Staging**: seed perf dataset; measure long‑running step timings.
* **Property tests**: compare invariants pre/post (e.g., counts, FKs intact).

---

## 11) Example Scenarios

### 11.1 Add `model` to `transcript_chunks` for new embeddings

* Expand: add `model TEXT NULL`, create partial index on `(org_id, model)`; build new HNSW index filtered by `model`.
* Backfill: re‑embed in background; write both `model='ada-002'` and new `text-embedding-3-large`.
* Switch: query filtered by latest model.
* Contract: drop old vectors & index when usage=0.

### 11.2 Rename `documents.markdown` → `documents.content_markdown`

* Expand: add `content_markdown TEXT NULL`.
* Backfill: copy in batches.
* Switch: app reads/writes new field; keep trigger to mirror for a week.
* Contract: drop old column.

### 11.3 Split `recordings` into `assets` (raw vs processed)

* Expand: create `assets` with FK to recordings and `kind ENUM('raw','processed')`.
* Backfill: create rows for existing recordings.
* Switch: update app to read assets table; new writes create both as needed.
* Contract: remove old path from recordings; drop redundant columns.

---

## 12) Operational Checklist

* [ ] Migration reviewed for **locks** and **long scans**.
* [ ] Indices created **concurrently**.
* [ ] Backfill script written, idempotent, and tested on staging.
* [ ] Alerts set for query latency and deadlocks.
* [ ] Rollback plan documented.
* [ ] Comms drafted if downtime or user‑visible changes possible.

---

## 13) Tooling & Scripts

* `scripts/check-migration-names.js` → filename policy.
* `scripts/backfill-*.ts` → batched updates with progress logs.
* `scripts/verify-backfill.ts` → random sampling & invariants.
* `scripts/drop-dead-indexes.sql` → remove unused after contract.

---

## 14) Metrics to Watch During Rollout

* DB CPU/locks/slow queries;
* API error rates (409/500) on affected routes;
* Worker job failures;
* Vector search latency (new index warming);
* Storage egress/spikes if reprocessing.

---

## 15) Communication Templates

**Internal**: `#deployments` — “Starting migration `<id>` expand phase. Expected 0 downtime. Monitoring dashboards X/Y/Z.”
**Customer** (if visible): banner + email for changes that affect user flows; ETA window; rollback plan.

---

## 16) FAQ

* **Can I change a column type?** Use add‑new + backfill; avoid `USING` casts on large tables.
* **Can I drop a table?** Only after verifying 0 references and 30‑day grace (per retention policy).
* **How to test RLS with migrations?** Enable policies in staging
