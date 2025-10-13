# Phase 2 Database - Priority Action Items

**Status**: ⚠️ 3 Critical Issues Found
**Estimated Fix Time**: 2-4 hours
**Priority**: P0 (Must fix before production)

---

## Critical Issues Requiring Immediate Action

### Issue 1: TypeScript Types Missing Semantic Columns ❌

**Severity**: HIGH (Blocks development)
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/lib/types/database.ts`
**Impact**: TypeScript compilation errors, no type safety for semantic fields

#### Fix Required:

Add after line 56 (after SearchMode definition):
```typescript
export type ChunkingStrategy = 'fixed' | 'semantic' | 'adaptive' | 'hybrid';
export type StructureType = 'paragraph' | 'code' | 'list' | 'table' | 'heading' | 'mixed';
export type BoundaryType = 'semantic_break' | 'size_limit' | 'structure_boundary' | 'topic_shift';
```

Update `transcript_chunks` Row type (around line 291):
```typescript
transcript_chunks: {
  Row: {
    id: string;
    recording_id: string;
    org_id: string;
    chunk_index: number;
    chunk_text: string;
    embedding: number[] | null;
    start_time_sec: number | null;
    end_time_sec: number | null;
    metadata: Json;
    model: string;
    created_at: string;
    // Phase 2: Semantic Chunking Metadata
    chunking_strategy: ChunkingStrategy;
    semantic_score: number | null;
    structure_type: StructureType | null;
    boundary_type: BoundaryType | null;
  };
  Insert: {
    id?: string;
    recording_id: string;
    org_id: string;
    chunk_index: number;
    chunk_text: string;
    embedding?: number[] | null;
    start_time_sec?: number | null;
    end_time_sec?: number | null;
    metadata?: Json;
    model?: string;
    created_at?: string;
    // Phase 2: Semantic Chunking Metadata
    chunking_strategy?: ChunkingStrategy;
    semantic_score?: number | null;
    structure_type?: StructureType | null;
    boundary_type?: BoundaryType | null;
  };
  Update: {
    embedding?: number[] | null;
    metadata?: Json;
    // Phase 2: Semantic Chunking Metadata
    chunking_strategy?: ChunkingStrategy;
    semantic_score?: number | null;
    structure_type?: StructureType | null;
    boundary_type?: BoundaryType | null;
  };
};
```

**Testing**:
```bash
yarn type:check  # Should pass without errors
```

---

### Issue 2: RLS Policy Too Permissive ⚠️

**Severity**: HIGH (Security risk - data leakage)
**Current**: `USING (true)` allows access to all organizations
**Impact**: Any authenticated user can read semantic metadata from any org

#### Fix Required:

Create new migration: `supabase/migrations/017_fix_transcript_chunks_rls.sql`

```sql
-- Migration: Fix RLS policy for transcript_chunks multi-tenant isolation
-- Description: Replace permissive RLS with org-scoped policy
-- Issue: Current policy allows cross-org data access
-- Created: 2025-10-12

-- =============================================================================
-- FIX RLS POLICY
-- =============================================================================

-- Drop permissive policy (from migration 008)
DROP POLICY IF EXISTS "Allow read access to transcript_chunks" ON transcript_chunks;
DROP POLICY IF EXISTS "Allow update access to transcript_chunks" ON transcript_chunks;

-- Add org-scoped read policy
CREATE POLICY "Users can read chunks from their org"
  ON transcript_chunks FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

COMMENT ON POLICY "Users can read chunks from their org" ON transcript_chunks IS
  'Enforces multi-tenant isolation - users can only read chunks from their organization';

-- Service role has full access (no policy needed - bypasses RLS)
-- Background jobs use service_role for INSERT/UPDATE/DELETE

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Verify policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'transcript_chunks'
    AND policyname = 'Users can read chunks from their org';

  IF policy_count != 1 THEN
    RAISE EXCEPTION 'RLS policy not created correctly';
  END IF;

  -- Verify RLS is enabled
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'transcript_chunks') THEN
    RAISE EXCEPTION 'RLS is not enabled on transcript_chunks';
  END IF;

  RAISE NOTICE 'Successfully fixed RLS policy for transcript_chunks';
END $$;
```

**Testing**:
```sql
-- Test as authenticated user (should only see own org)
SET ROLE authenticated;
SET request.jwt.claims.sub TO 'test-clerk-id';

SELECT COUNT(*) FROM transcript_chunks; -- Should match user's org only

RESET ROLE;
```

**Rollback** (if needed):
Create `supabase/migrations/017_fix_transcript_chunks_rls_down.sql`:
```sql
-- Rollback: Restore permissive RLS policy

DROP POLICY IF EXISTS "Users can read chunks from their org" ON transcript_chunks;

CREATE POLICY "Allow read access to transcript_chunks"
ON transcript_chunks
FOR SELECT
TO anon, authenticated
USING (true);

RAISE NOTICE 'Rolled back to permissive RLS policy (NOT RECOMMENDED for production)';
```

---

### Issue 3: Index Security Gap ⚠️

**Severity**: MEDIUM (Cross-org data access via index)
**Index**: `idx_transcript_chunks_strategy_quality`
**Issue**: Missing `org_id` in composite index allows cross-org queries

#### Fix Required:

Create new migration: `supabase/migrations/018_fix_strategy_quality_index.sql`

```sql
-- Migration: Fix security issue in strategy quality index
-- Description: Add org_id to prevent cross-organization data access
-- Issue: idx_transcript_chunks_strategy_quality missing org_id
-- Created: 2025-10-12

-- =============================================================================
-- FIX INDEX SECURITY
-- =============================================================================

-- Drop insecure index (from migration 013b)
DROP INDEX CONCURRENTLY IF EXISTS idx_transcript_chunks_strategy_quality;

-- Recreate with org_id for multi-tenant isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_strategy_quality
  ON transcript_chunks(org_id, chunking_strategy, semantic_score DESC)
  WHERE semantic_score IS NOT NULL;

COMMENT ON INDEX idx_transcript_chunks_strategy_quality IS
  'Optimizes quality metric aggregations grouped by chunking strategy within organization scope. Partial index for non-NULL semantic scores.';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  index_exists BOOLEAN;
  index_columns TEXT;
BEGIN
  -- Verify index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_transcript_chunks_strategy_quality'
  ) INTO index_exists;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'Index idx_transcript_chunks_strategy_quality not created';
  END IF;

  -- Verify org_id is first column (for RLS efficiency)
  SELECT indexdef INTO index_columns
  FROM pg_indexes
  WHERE indexname = 'idx_transcript_chunks_strategy_quality';

  IF NOT index_columns LIKE '%org_id%' THEN
    RAISE EXCEPTION 'Index missing org_id column';
  END IF;

  RAISE NOTICE 'Successfully fixed strategy quality index security';
END $$;
```

**Testing**:
```sql
-- Verify index is used correctly
EXPLAIN ANALYZE
SELECT chunking_strategy, AVG(semantic_score)
FROM transcript_chunks
WHERE org_id = 'test-org-id'
  AND semantic_score IS NOT NULL
GROUP BY chunking_strategy;

-- Should show: Index Scan using idx_transcript_chunks_strategy_quality
```

**Rollback** (if needed):
Create `supabase/migrations/018_fix_strategy_quality_index_down.sql`:
```sql
-- Rollback: Restore original index (NOT RECOMMENDED)

DROP INDEX CONCURRENTLY IF EXISTS idx_transcript_chunks_strategy_quality;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_strategy_quality
  ON transcript_chunks(chunking_strategy, semantic_score DESC)
  WHERE semantic_score IS NOT NULL;

RAISE NOTICE 'Rolled back to original index (security issue present)';
```

---

## Priority 1 Optimizations (After Critical Fixes)

### Optimization 1: Add Recording-Level Analytics Index

**Benefit**: 3-5x speedup for per-recording chunking metrics
**Impact**: Used by `get_recording_chunking_metrics()` function

Create migration: `supabase/migrations/019_add_recording_analytics_index.sql`

```sql
-- Migration: Add covering index for recording-level analytics
-- Description: Speeds up per-recording chunking quality metrics
-- Phase: 2 Optimization
-- Created: 2025-10-12

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_recording_strategy
  ON transcript_chunks(recording_id, chunking_strategy)
  INCLUDE (semantic_score, start_time_sec, end_time_sec);

COMMENT ON INDEX idx_transcript_chunks_recording_strategy IS
  'Covering index for per-recording chunking analytics and quality metrics. Includes semantic_score and time range for index-only scans.';

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_transcript_chunks_recording_strategy'
  ) THEN
    RAISE EXCEPTION 'Index not created';
  END IF;

  RAISE NOTICE 'Successfully added recording analytics index';
END $$;
```

**Query this optimizes**:
```sql
-- Used in get_recording_chunking_metrics() function
SELECT
  chunking_strategy,
  COUNT(*) as chunk_count,
  AVG(semantic_score) as avg_semantic_score,
  AVG(LENGTH(chunk_text))::INT as avg_chunk_size
FROM transcript_chunks
WHERE recording_id = $1
GROUP BY chunking_strategy;
```

---

## Deployment Checklist

### Before Applying Fixes

- [ ] Backup production database
- [ ] Test migrations on development environment
- [ ] Run TypeScript type checking locally
- [ ] Verify no active jobs running (pause worker)

### Apply Fixes (In Order)

```bash
# 1. Update TypeScript types (no migration needed)
# Edit lib/types/database.ts manually

# 2. Apply RLS fix
supabase migration apply 017_fix_transcript_chunks_rls.sql

# 3. Apply index security fix
supabase migration apply 018_fix_strategy_quality_index.sql

# 4. (Optional) Apply recording analytics optimization
supabase migration apply 019_add_recording_analytics_index.sql

# 5. Verify all migrations applied
supabase migration list

# 6. Type check codebase
yarn type:check
```

### Post-Deployment Verification

```sql
-- 1. Verify RLS policy
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'transcript_chunks';
-- Should show org_id filtering

-- 2. Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transcript_chunks'
  AND (indexname LIKE '%strategy%' OR indexname LIKE '%recording%');
-- Should show 3 indexes with org_id/recording_id

-- 3. Test query performance
EXPLAIN ANALYZE
SELECT chunking_strategy, COUNT(*)
FROM transcript_chunks
WHERE org_id = 'your-test-org-id'
GROUP BY chunking_strategy;
-- Should use idx_transcript_chunks_org_strategy
```

### Rollback Plan

If issues occur:
1. RLS fix: Apply `017_fix_transcript_chunks_rls_down.sql` (restores permissive policy)
2. Index fix: Apply `018_fix_strategy_quality_index_down.sql` (restores original index)
3. TypeScript types: Revert Git commit

---

## Success Criteria

### Critical Fixes Complete ✅

- [ ] TypeScript types include all semantic columns
- [ ] `yarn type:check` passes without errors
- [ ] RLS policy enforces org_id filtering
- [ ] All indexes include org_id for multi-tenant isolation
- [ ] No cross-org data leakage in test queries

### Performance Validation ✅

- [ ] Recording-level analytics < 100ms (1,000 chunks)
- [ ] Org-wide strategy breakdown < 200ms (100,000 chunks)
- [ ] Vector search with quality filter < 500ms
- [ ] No performance regression on existing queries

### Security Validation ✅

- [ ] Authenticated users only see their org's data
- [ ] Direct Supabase queries respect RLS
- [ ] No SQL injection vectors in new columns
- [ ] Constraint validation prevents invalid data

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RLS breaks existing API routes | LOW | HIGH | Test all API endpoints after migration |
| Index rebuild causes downtime | LOW | MEDIUM | Use CONCURRENTLY (no locks) |
| TypeScript type errors | MEDIUM | LOW | Run type:check before deployment |
| Performance regression | LOW | MEDIUM | Monitor query times post-deployment |
| Rollback needed | LOW | MEDIUM | Test rollback scripts on dev first |

**Overall Risk**: 🟡 MEDIUM (manageable with proper testing)

---

## Timeline

### Recommended Schedule

**Day 1** (2-4 hours):
- Update TypeScript types (Issue 1)
- Test locally with `yarn type:check`
- Create and test migration 017 on development DB

**Day 2** (1-2 hours):
- Create and test migration 018 on development DB
- Run full test suite
- Deploy to staging environment

**Day 3** (1 hour):
- Monitor staging for 24 hours
- Deploy to production during low-traffic window
- Monitor performance metrics

**Total Estimated Time**: 4-7 hours (including testing and monitoring)

---

## Contact / Questions

For questions about these fixes, refer to:
- **Full Review**: `/Users/jarrettstanley/Desktop/websites/recorder/PHASE2_SUPABASE_DATABASE_REVIEW.md`
- **Performance Analysis**: `/Users/jarrettstanley/Desktop/websites/recorder/PHASE2_PERFORMANCE_ANALYSIS.md`
- **Security Audit**: Appendix B in database review document

---

**Status**: Ready for implementation
**Last Updated**: 2025-10-12
**Review Status**: ⚠️ AWAITING FIXES
