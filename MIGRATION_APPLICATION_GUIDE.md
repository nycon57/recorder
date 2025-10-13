# Migration Application Guide - Phase 1, 2, 3 Fixes

**IMPORTANT**: These migrations must be applied manually using one of the methods below.

## Required Migrations (Apply in Order)

1. `012_phase1_foundation_enhancements.sql` - Phase 1 foundation tables
2. `016_fix_all_rls_policies.sql` - CRITICAL: Fix RLS bugs across all phases
3. `017_fix_query_cache_rls.sql` - CRITICAL: Add missing RLS to query_cache
4. `018_optimize_ivfflat_indexes.sql` - HIGH: Optimize vector indexes
5. `019_add_missing_indexes.sql` - HIGH: Add performance indexes

## Method 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. For each migration file (in order):
   - Copy the entire content of the migration file
   - Paste into a new query
   - Click "Run"
   - Verify success message

## Method 2: Using psql (Command Line)

```bash
# Set your database URL (get from Supabase dashboard under Project Settings > Database)
export SUPABASE_DB_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply migrations in order
psql "$SUPABASE_DB_URL" -f supabase/migrations/012_phase1_foundation_enhancements.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/016_fix_all_rls_policies.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/017_fix_query_cache_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/018_optimize_ivfflat_indexes.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/019_add_missing_indexes.sql
```

## Method 3: Using Supabase CLI

```bash
# Link your project (one-time setup)
supabase link --project-ref [YOUR-PROJECT-REF]

# Push all pending migrations
supabase db push

# Or apply specific migration
supabase migration up
```

## Verification After Migration

Run these queries to verify the migrations were applied successfully:

```sql
-- 1. Check that recording_summaries table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'recording_summaries'
);

-- 2. Verify RLS policies were fixed
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN (
  'recording_summaries',
  'query_cache',
  'agentic_search_logs'
)
ORDER BY tablename, policyname;

-- 3. Check IVFFlat index parameters (should show lists=224)
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexdef LIKE '%ivfflat%'
  AND tablename IN ('recording_summaries', 'transcript_chunks', 'query_cache');

-- 4. Verify new indexes exist
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname IN (
  'idx_recording_summaries_org_created',
  'idx_search_analytics_org_timestamp',
  'idx_query_cache_lookup'
);
```

## Expected Results

After applying all migrations, you should see:

- ✅ 6 new tables created (recording_summaries, video_frames, connector_configs, imported_documents, search_analytics, query_cache)
- ✅ All RLS policies using `clerk_id = auth.uid()::text` pattern (not `id = auth.uid()`)
- ✅ query_cache has 4 RLS policies enabled
- ✅ IVFFlat indexes optimized with `lists=224`
- ✅ 3 new composite indexes for performance

## Troubleshooting

### Error: "relation already exists"

This means the migration was partially applied. This is safe - the migrations use `CREATE TABLE IF NOT EXISTS` and similar idempotent patterns. Just continue with the next migration.

### Error: "type vector does not exist"

You need to enable the pgvector extension first:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Error: "duplicate key value violates unique constraint"

This means the migration was already applied. Skip to the next migration.

### RLS Policy Already Exists

If you get an error about policies already existing when applying migration 016 or 017, you can drop the old policies first:

```sql
-- Drop old RLS policies before applying fix migrations
DROP POLICY IF EXISTS "Users can view summaries from their org" ON recording_summaries;
DROP POLICY IF EXISTS "Users can view frames from their org" ON video_frames;
-- ... etc for each policy that needs to be recreated
```

## Post-Migration Code Deployment

After successfully applying all migrations, you can deploy the code fixes:

1. ✅ Import path fixes (already applied in code)
2. ✅ Timeout protection (already applied in code)
3. ✅ Hierarchical search fallback (already applied in code)
4. Deploy to production with `git push` or `vercel deploy`

## Rollback (If Needed)

If you need to rollback migrations, use the corresponding `_down.sql` files:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/012_phase1_foundation_enhancements_down.sql
```

**Note**: Migration 016, 017, 018, 019 are fixes and don't have down migrations. Rollback is not recommended for these as they fix critical security issues.

## Get Help

If you encounter issues:

1. Check the migration file for any specific comments or requirements
2. Review the Supabase logs in your dashboard
3. Ensure your database user has sufficient permissions (service_role recommended)
4. Contact support with the specific error message

---

**Migrations are located in**: `supabase/migrations/`

**Total estimated time**: 5-10 minutes

**CRITICAL**: Migrations 016 and 017 fix security vulnerabilities. Apply these immediately before deploying to production.
