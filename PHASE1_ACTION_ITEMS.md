# Phase 1 Foundation Enhancements - Action Items

**Date**: 2025-10-12
**Status**: 🟡 READY FOR FIXES
**Estimated Time to Production Ready**: 2-3 hours

---

## Quick Summary

The Phase 1 migration (`012_phase1_foundation_enhancements.sql`) is well-designed but has **critical security issues** that must be fixed before production deployment. The same RLS authentication bug from earlier migrations was repeated, plus the `query_cache` table has no RLS policies at all.

**Good News**: All fixes are already prepared and ready to apply!

---

## Critical Issues

### 🔴 Issue #1: Broken RLS Policies (5 tables)
- **Tables**: `recording_summaries`, `video_frames`, `connector_configs`, `imported_documents`, `search_analytics`
- **Impact**: Users cannot access their own data (features broken)
- **Fix**: Migration 016 (already exists)

### 🔴 Issue #2: Missing RLS on `query_cache`
- **Impact**: Potential cross-org data leakage
- **Fix**: Migration 017 (created)

---

## Required Migrations

Apply these 4 migrations in order:

| # | File | Purpose | Time | Status |
|---|------|---------|------|--------|
| 016 | `016_fix_all_rls_policies.sql` | Fix RLS auth pattern | 5s | ✅ Exists |
| 017 | `017_fix_query_cache_rls.sql` | Add RLS to query_cache | 10s | ✅ Created |
| 018 | `018_optimize_ivfflat_indexes.sql` | Tune vector indexes | 60s | ✅ Created |
| 019 | `019_add_missing_indexes.sql` | Add performance indexes | 10s | ✅ Created |

**Total Application Time**: ~90 seconds

---

## Step-by-Step Deployment

### 1. Pre-Deployment Checks

```bash
# Verify you're on the correct project
cd /Users/jarrettstanley/Desktop/websites/recorder

# Check current migration status
supabase migration list

# Verify all fix files exist
ls -1 supabase/migrations/016_* supabase/migrations/017_* supabase/migrations/018_* supabase/migrations/019_*
```

### 2. Apply Fix Migrations

```bash
# Apply all 4 fixes at once (RECOMMENDED)
supabase db push

# OR apply individually for testing
# supabase migration apply 016_fix_all_rls_policies.sql
# supabase migration apply 017_fix_query_cache_rls.sql
# supabase migration apply 018_optimize_ivfflat_indexes.sql
# supabase migration apply 019_add_missing_indexes.sql
```

### 3. Verify RLS Policies

```sql
-- Connect to your Supabase project
-- psql or Supabase SQL Editor

-- Check that all RLS policies use correct pattern
SELECT
  schemaname,
  tablename,
  policyname,
  definition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'recording_summaries',
    'video_frames',
    'connector_configs',
    'imported_documents',
    'search_analytics',
    'query_cache'
  )
ORDER BY tablename, policyname;

-- Should show "clerk_id = auth.uid()::text" in definitions
-- Should NOT show "id = auth.uid()"
```

### 4. Test with Authenticated User

```sql
-- Simulate authenticated user (replace with real Clerk user ID)
SET request.jwt.claims TO '{"sub": "user_YOUR_CLERK_ID_HERE"}';

-- Test recording_summaries access
SELECT COUNT(*) FROM recording_summaries;
-- Should return count > 0 if you have summaries

-- Test query_cache access
SELECT COUNT(*) FROM query_cache;
-- Should return count (0 if empty, but no permission error)

-- Reset
RESET request.jwt.claims;
```

### 5. Generate Test Summary (Optional)

```bash
# Create a test job to generate a summary
# Via Supabase SQL Editor or API route
INSERT INTO jobs (type, payload, org_id, status, run_after)
VALUES (
  'generate_summary',
  '{"recordingId": "YOUR_RECORDING_ID", "transcriptId": "TRANSCRIPT_ID", "documentId": "DOCUMENT_ID", "orgId": "YOUR_ORG_ID"}',
  'YOUR_ORG_ID',
  'pending',
  NOW()
);

# Then run worker to process
yarn worker:once
```

### 6. Check Performance

```sql
-- View index statistics
SELECT * FROM vector_index_stats;

-- Check optimal lists parameter
SELECT
  'recording_summaries' AS table,
  calculate_optimal_lists('recording_summaries') AS optimal_lists,
  100 AS current_lists;

-- View index usage report
SELECT * FROM index_usage_report()
WHERE table_name LIKE '%connector%'
   OR table_name LIKE '%video_frames%'
   OR table_name LIKE '%query_cache%';
```

---

## Testing Checklist

### Functional Testing

- [ ] **RLS Policies**
  - [ ] Users can view their org's recording summaries
  - [ ] Users cannot view other orgs' summaries
  - [ ] Service role can insert summaries
  - [ ] Service role can update summaries

- [ ] **Hierarchical Search**
  - [ ] Can generate dual embeddings (1536 + 3072)
  - [ ] Summary search returns relevant recordings
  - [ ] Chunk search returns diverse results
  - [ ] Query completes in < 500ms

- [ ] **Query Cache**
  - [ ] Users can only access their org's cache
  - [ ] Cache entries are org-scoped
  - [ ] Expired entries can be deleted
  - [ ] No CHECK constraint errors

- [ ] **Connector System** (Phase 5 prep)
  - [ ] Users can create connector configs
  - [ ] Users can view only their org's connectors
  - [ ] Credentials are stored (encryption at app layer!)

### Performance Testing

- [ ] **Vector Search**
  - [ ] Summary search (3072-dim) < 150ms
  - [ ] Chunk search (1536-dim) < 150ms
  - [ ] Combined hierarchical search < 500ms

- [ ] **Index Usage**
  - [ ] IVFFlat indexes are being used (check EXPLAIN)
  - [ ] No sequential scans on large tables
  - [ ] Partial indexes correctly filter

- [ ] **Cache Cleanup**
  - [ ] Expired entries can be deleted
  - [ ] cleanup_expired_cache() runs without errors
  - [ ] Returns statistics (deleted_count, freed_bytes)

### Security Testing

- [ ] **Cross-Org Isolation**
  - [ ] User A cannot see User B's summaries (different orgs)
  - [ ] User A cannot see User B's cache entries
  - [ ] User A cannot manage User B's connectors

- [ ] **Service Role Access**
  - [ ] Service role can insert/update all tables
  - [ ] Background jobs can write summaries
  - [ ] Worker can update recording status

---

## Rollback Plan

If something goes wrong:

### Option A: Rollback Just the Fixes (Recommended)

```sql
-- Manually revert migrations 017-019
-- (Keep 016 since it fixes critical bugs)

-- Revert 019 (just drop indexes)
DROP INDEX IF EXISTS idx_connector_configs_sync_status;
DROP INDEX IF EXISTS idx_imported_documents_sync_errors;
-- etc...

-- Revert 018 (recreate indexes with default lists)
-- (See migration 012 for original definitions)

-- Revert 017 (remove org_id from query_cache)
ALTER TABLE query_cache DROP COLUMN org_id;
-- etc...
```

### Option B: Rollback Everything (Nuclear Option)

```bash
# Use the rollback migration
supabase migration apply 012_phase1_foundation_enhancements_down.sql

# WARNING: This deletes ALL data from Phase 1 tables:
# - recording_summaries
# - video_frames
# - connector_configs
# - imported_documents
# - search_analytics
# - query_cache
```

---

## Post-Deployment Monitoring

### Day 1

- [ ] Monitor slow query log for vector searches
- [ ] Check error rates on hierarchical search API
- [ ] Verify cache hit rates in `query_cache`
- [ ] Monitor connector sync status

### Week 1

- [ ] Review `vector_index_stats` view
- [ ] Check if IVFFlat `lists` needs tuning
- [ ] Analyze `search_analytics` for quality issues
- [ ] Review connector sync errors

### Month 1

- [ ] Evaluate 3072-dim vs 1536-dim embedding quality
- [ ] Measure cost impact of higher-dimensional embeddings
- [ ] Consider A/B testing different dimensions
- [ ] Tune IVFFlat parameters based on data volume

---

## Long-Term Recommendations

### Performance

1. **Monitor Data Growth**
   - Run `calculate_optimal_lists()` monthly
   - Rebuild indexes when row count grows 10x
   - Consider HNSW indexes for higher QPS (pgvector 0.5.0+)

2. **Cache Strategy**
   - Set up periodic cleanup job (daily)
   - Monitor cache hit rates
   - Adjust TTL based on usage patterns

3. **Embedding Dimensions**
   - A/B test 3072-dim vs 1536-dim for summaries
   - Measure quality improvement vs cost increase
   - Consider 768-dim as middle ground

### Security

1. **Credential Encryption**
   - Implement encryption for `connector_configs.credentials`
   - Use Supabase Vault or external KMS
   - Rotate credentials regularly

2. **Audit Logging**
   - Add INSERT policies to `search_analytics`
   - Log connector configuration changes
   - Track cache access patterns

3. **RLS Testing**
   - Add automated tests for RLS policies
   - Test cross-org isolation regularly
   - Verify service role access

### Operations

1. **Backup Strategy**
   - Point-in-time recovery enabled
   - Regular exports of connector configs
   - Document restoration procedures

2. **Monitoring Dashboards**
   - Hierarchical search latency
   - Cache hit rates
   - Connector sync success rates
   - Vector index usage

3. **Documentation**
   - Update API docs with hierarchical search
   - Document connector configuration process
   - Create runbooks for common issues

---

## Success Metrics

After deployment, track these metrics:

### Performance
- **Hierarchical search latency**: < 500ms (p95)
- **Cache hit rate**: > 30% (goal: 50%+)
- **Vector index efficiency**: > 90% index usage

### Quality
- **Search result diversity**: > 3 unique recordings in top 10 results
- **User feedback**: > 70% positive (thumbs up)
- **Summary quality**: Manual review of first 100 summaries

### Reliability
- **RLS policy correctness**: 0 cross-org leaks
- **Connector sync success rate**: > 95%
- **Job failure rate**: < 5%

---

## Files Created

### Audit Report
- `/PHASE1_SUPABASE_AUDIT.md` - Comprehensive 30-page audit

### Fix Migrations
- `/supabase/migrations/017_fix_query_cache_rls.sql` - Add RLS to query_cache
- `/supabase/migrations/018_optimize_ivfflat_indexes.sql` - Tune vector indexes
- `/supabase/migrations/019_add_missing_indexes.sql` - Add performance indexes

### Rollback
- `/supabase/migrations/012_phase1_foundation_enhancements_down.sql` - Rollback script

### Action Plan
- `/PHASE1_ACTION_ITEMS.md` - This document

---

## Next Steps

1. **Review audit report**: `PHASE1_SUPABASE_AUDIT.md`
2. **Apply fix migrations**: Run `supabase db push`
3. **Test thoroughly**: Follow testing checklist above
4. **Deploy to production**: After testing passes
5. **Monitor closely**: Track success metrics

**Estimated Total Time**: 2-3 hours from review to production

---

## Questions?

Refer to the comprehensive audit report (`PHASE1_SUPABASE_AUDIT.md`) for:
- Detailed issue explanations
- SQL examples and recommendations
- Performance optimization strategies
- Security best practices
- Long-term tuning guidelines

**Status**: ✅ All fixes prepared and ready to apply!
