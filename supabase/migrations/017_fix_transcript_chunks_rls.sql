-- Migration: Fix Critical RLS Policy on transcript_chunks Table
-- Description: Fixes overly permissive RLS policy that allows cross-tenant data access
-- Severity: CRITICAL - Data breach risk
-- Created: 2025-10-12

-- =============================================================================
-- CRITICAL SECURITY FIX
-- =============================================================================
-- Current policy allows ANY authenticated or anonymous user to read ALL chunks
-- This creates a cross-tenant data leakage vulnerability where users can access
-- embeddings and chunk text from other organizations
-- =============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow read access to transcript_chunks" ON transcript_chunks;

-- Create properly scoped policy that enforces org isolation
CREATE POLICY "Users can view chunks from their org"
  ON transcript_chunks FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Service role needs explicit access for background jobs
CREATE POLICY "Service role has full access to chunks"
  ON transcript_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- ADD MISSING WRITE POLICIES
-- =============================================================================
-- The original migration only had SELECT policy, but we need proper policies
-- for the complete data lifecycle

-- Users should NOT be able to directly modify chunks (only via API/jobs)
-- These are generated automatically by the embedding job processor

-- Anon users should have no access at all
REVOKE ALL ON transcript_chunks FROM anon;

-- =============================================================================
-- PERFORMANCE OPTIMIZATION
-- =============================================================================
-- Add index to speed up the RLS policy lookup
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_org_id_lookup
  ON transcript_chunks(org_id)
  WHERE org_id IS NOT NULL;

-- Add composite index for the common RLS + search pattern
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_org_embedding_search
  ON transcript_chunks USING ivfflat (embedding vector_cosine_ops)
  WHERE org_id IS NOT NULL;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
  policy_count INTEGER;
  bad_policy_count INTEGER;
BEGIN
  -- Check that the bad policy is gone
  SELECT COUNT(*) INTO bad_policy_count
  FROM pg_policies
  WHERE tablename = 'transcript_chunks'
    AND policyname = 'Allow read access to transcript_chunks'
    AND schemaname = 'public';

  IF bad_policy_count > 0 THEN
    RAISE EXCEPTION 'Failed to remove overly permissive policy';
  END IF;

  -- Check that new policy exists
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'transcript_chunks'
    AND policyname = 'Users can view chunks from their org'
    AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'Failed to create new org-scoped policy';
  END IF;

  -- Verify the new policy uses correct authentication pattern
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'transcript_chunks'
    AND policyname = 'Users can view chunks from their org'
    AND definition LIKE '%clerk_id = %auth.uid()::text%'
    AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE WARNING 'New policy may not have correct clerk_id pattern';
  END IF;

  RAISE NOTICE 'Successfully fixed RLS policy on transcript_chunks table';
  RAISE NOTICE 'Users can now only access chunks from their own organization';
END $$;

-- =============================================================================
-- AUDIT LOG
-- =============================================================================
INSERT INTO migration_audit_log (
  migration_name,
  severity,
  description,
  applied_at
) VALUES (
  '017_fix_transcript_chunks_rls',
  'CRITICAL',
  'Fixed cross-tenant data access vulnerability in transcript_chunks RLS policy',
  NOW()
) ON CONFLICT DO NOTHING;

-- Note: If migration_audit_log doesn't exist, remove the above INSERT or create the table first

COMMENT ON POLICY "Users can view chunks from their org" ON transcript_chunks IS
  'SECURITY FIX: Enforces org-level isolation for chunk access. Replaces overly permissive policy from migration 008.';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (DO NOT USE UNLESS ABSOLUTELY NECESSARY)
-- =============================================================================
-- To rollback (NOT RECOMMENDED - this would re-introduce the security vulnerability):
--
-- DROP POLICY IF EXISTS "Users can view chunks from their org" ON transcript_chunks;
-- DROP POLICY IF EXISTS "Service role has full access to chunks" ON transcript_chunks;
--
-- CREATE POLICY "Allow read access to transcript_chunks"
-- ON transcript_chunks
-- FOR SELECT
-- TO anon, authenticated
-- USING (true);
--
-- DROP INDEX IF EXISTS idx_transcript_chunks_org_id_lookup;
-- DROP INDEX IF EXISTS idx_transcript_chunks_org_embedding_search;
--
-- GRANT SELECT ON transcript_chunks TO anon;
-- =============================================================================