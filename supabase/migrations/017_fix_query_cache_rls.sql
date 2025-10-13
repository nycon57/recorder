-- Migration: Add RLS and org_id to query_cache
-- Description: Fixes missing RLS policies and cross-org data leakage vulnerability
-- Issue: query_cache table has no RLS enabled, allowing potential cross-org access
-- Also fixes: CHECK constraint bug that prevents cleanup of expired entries
-- Created: 2025-10-12

-- =============================================================================
-- Step 1: Add org_id column for org-scoping
-- =============================================================================

ALTER TABLE query_cache
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

COMMENT ON COLUMN query_cache.org_id IS 'Organization scope for cache isolation';

-- =============================================================================
-- Step 2: Create index on org_id
-- =============================================================================

CREATE INDEX idx_query_cache_org_id ON query_cache(org_id);

-- =============================================================================
-- Step 3: Update UNIQUE constraint to be org-scoped
-- =============================================================================

-- Drop the existing unique constraint
DROP INDEX IF EXISTS query_cache_query_hash_key;

-- Create new org-scoped unique index
-- This allows different orgs to have the same query_hash
CREATE UNIQUE INDEX query_cache_org_query_hash
  ON query_cache(org_id, query_hash);

-- =============================================================================
-- Step 4: Remove problematic CHECK constraint
-- =============================================================================

-- The CHECK (ttl > now()) constraint prevents cleanup of expired entries
-- because PostgreSQL re-validates constraints on UPDATE/DELETE
-- Remove it and rely on the partial index for filtering

ALTER TABLE query_cache DROP CONSTRAINT IF EXISTS query_cache_ttl_check;

COMMENT ON TABLE query_cache IS 'Cache layer for frequently accessed queries. Expired entries filtered via index, not constraint.';

-- =============================================================================
-- Step 5: Enable RLS
-- =============================================================================

ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Step 6: Add RLS policies
-- =============================================================================

-- Allow authenticated users to view cache from their org
CREATE POLICY "Users can view cache from their org"
  ON query_cache FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Allow authenticated users to insert cache entries for their org
CREATE POLICY "Users can create cache for their org"
  ON query_cache FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Allow authenticated users to update cache entries in their org
CREATE POLICY "Users can update cache in their org"
  ON query_cache FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text))
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Allow authenticated users to delete cache entries from their org
CREATE POLICY "Users can delete cache from their org"
  ON query_cache FOR DELETE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Allow service role full access (for background cleanup jobs)
CREATE POLICY "Service can manage all cache"
  ON query_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Step 7: Grant service role access
-- =============================================================================

GRANT ALL ON query_cache TO service_role;

-- =============================================================================
-- Step 8: Update cleanup function to respect org_id
-- =============================================================================

-- The existing cleanup_expired_cache function doesn't need changes
-- since it just deletes WHERE ttl < now(), which works fine
-- But we can improve it to return stats

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TABLE(deleted_count INTEGER, freed_bytes BIGINT) AS $$
DECLARE
  del_count INTEGER;
  freed BIGINT;
BEGIN
  -- Get size before cleanup (approximate)
  SELECT pg_total_relation_size('query_cache') INTO freed;

  -- Delete expired entries
  DELETE FROM query_cache WHERE ttl < now();

  GET DIAGNOSTICS del_count = ROW_COUNT;

  -- Calculate freed space (approximate)
  freed := freed - pg_total_relation_size('query_cache');

  RETURN QUERY SELECT del_count, freed;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_cache IS 'Removes expired cache entries and returns cleanup statistics';

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'query_cache';

  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is not enabled on query_cache table';
  END IF;

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'query_cache'
    AND schemaname = 'public';

  IF policy_count < 5 THEN
    RAISE WARNING 'Expected 5 policies on query_cache, found %', policy_count;
  END IF;

  RAISE NOTICE 'RLS successfully enabled on query_cache with % policies', policy_count;
  RAISE NOTICE 'org_id column added for cache isolation';
  RAISE NOTICE 'Problematic CHECK constraint removed';
END $$;
